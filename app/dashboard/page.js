'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import QRCode from 'qrcode';
import { AlertTriangle, Calendar, Check, CloudOff, Loader2, LogOut, RefreshCw, Wand2 } from 'lucide-react';
import ActivityCard from '@/components/ActivityCard';
import ActivityForm from '@/components/ActivityForm';
import { PosterModal } from '@/components/PosterPreview';
import { ToastStack, useToasts } from '@/components/Toast';
import { loadLocalActivities, mergeActivities, saveLocalActivities } from '@/lib/storage';
import { slugify } from '@/lib/format';

/** POST/PUT helper that turns a non-2xx response into a thrown Error. */
async function sendJson(url, body, method = 'POST') {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    /* An empty or non-JSON body is handled by the status check below. */
  }

  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

/** The same, for a GET — which may not carry a body at all. */
async function getJson(url) {
  const response = await fetch(url, { cache: 'no-store' });

  let data = {};
  try {
    data = await response.json();
  } catch {
    /* Handled by the status check below. */
  }

  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A poster takes about a minute on the host GPU, and the first render after
// ComfyUI starts also loads ~11GB of weights. Five minutes covers the bad case.
const RENDER_TIMEOUT_MS = 5 * 60 * 1000;
const RENDER_POLL_MS = 2000;

/**
 * How many polls in a row may fail before a render is written off.
 *
 * Polls genuinely do fail mid-render: the host machine is under real memory
 * pressure while the model is resident, and both ComfyUI and the tunnel can stop
 * answering for a stretch. Treating the first failure as fatal throws away a
 * poster that is still rendering perfectly well. At 2s a poll this tolerates a
 * minute of silence.
 */
const MAX_POLL_FAILURES = 30;

/** Build the QR payload from the registration form the poster is made for. */
async function buildQrCode(formLink) {
  if (!formLink) return null;
  try {
    return await QRCode.toDataURL(formLink, {
      width: 440,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  } catch (err) {
    console.error('QR generation failed:', err);
    return null;
  }
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toasts, push, dismiss } = useToasts();

  const [activities, setActivities] = useState([]);
  const [posters, setPosters] = useState({});
  const [busy, setBusy] = useState({});
  const [config, setConfig] = useState(null);
  const [syncState, setSyncState] = useState('idle'); // idle | saving | saved | error
  const [restoring, setRestoring] = useState(true);
  const [modal, setModal] = useState(null); // { activityId, index }
  const [progress, setProgress] = useState({}); // activityId -> progress line

  const hydrated = useRef(false);
  const saveTimer = useRef(null);

  // Two guards on the Drive write-back, because a naive "save whenever the list
  // changes" destroys data:
  //
  // `driveReadOk` — if the initial read failed we do not know what Drive holds,
  // so writing the browser's copy over it could wipe activities saved from
  // another machine. On a fresh browser that copy is empty, which would replace
  // a full index with nothing.
  //
  // `pendingSave` — hydration itself replaces the activities array, which would
  // otherwise fire a pointless write-back on every single page load.
  const driveReadOk = useRef(false);
  const pendingSave = useRef(false);

  const setActivityBusy = useCallback((id, value) => {
    setBusy((current) => ({ ...current, [id]: value }));
  }, []);

  const setProgressLine = useCallback((id, value) => {
    setProgress((current) => ({ ...current, [id]: value }));
  }, []);

  /** Surface an error, routing an expired session to a re-sign-in prompt. */
  const reportError = useCallback(
    (err, fallback) => {
      if (err?.code === 'REAUTH_REQUIRED' || err?.status === 401) {
        push('error', 'Your Google sign-in expired. Please sign out and sign in again.');
        return;
      }
      push('error', err?.message || fallback);
    },
    [push],
  );

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  // A refresh failure only becomes visible on the session object, so watch it.
  useEffect(() => {
    if (session?.error === 'RefreshAccessTokenError') {
      push('error', 'Your Google session expired. Sign out and sign in again to keep using Drive.');
    }
  }, [session?.error, push]);

  // Load: browser cache first so the list paints immediately, then Drive.
  useEffect(() => {
    if (status !== 'authenticated') return;

    const local = loadLocalActivities();
    setActivities(local);

    let cancelled = false;

    (async () => {
      try {
        const [configResponse, activitiesResponse] = await Promise.all([
          fetch('/api/config'),
          fetch('/api/activities'),
        ]);

        if (cancelled) return;

        if (configResponse.ok) setConfig(await configResponse.json());

        if (!activitiesResponse.ok) {
          throw new Error(`Drive returned ${activitiesResponse.status}`);
        }

        const data = await activitiesResponse.json();
        const remote = data.activities ?? [];
        driveReadOk.current = true;

        const merged = mergeActivities(local, remote);
        setActivities(merged);
        saveLocalActivities(merged);

        // Anything this browser has that Drive does not is an unsaved draft —
        // usually an activity added just before the last tab closed. Flag it so
        // the debounced save carries it up; an identical list writes nothing.
        const remoteIds = new Set(remote.map((activity) => activity.id));
        if (merged.some((activity) => !remoteIds.has(activity.id))) {
          pendingSave.current = true;
        }

        if (data.corrupt) {
          push(
            'warning',
            'The activity list saved in Drive could not be read. Your next change will rewrite it.',
          );
        } else if (remote.length > 0 && local.length === 0) {
          push(
            'info',
            `Restored ${remote.length} ${remote.length === 1 ? 'activity' : 'activities'} from Google Drive.`,
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Restore failed:', err);
          driveReadOk.current = false;
          push(
            'warning',
            'Could not reach Google Drive. You can keep working — changes are saved in this browser — but reload once Drive is reachable so they sync.',
          );
        }
      } finally {
        if (!cancelled) {
          hydrated.current = true;
          setRestoring(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, push]);

  // Persist: the browser copy is written synchronously, Drive on a debounce so
  // a burst of edits becomes one upload.
  useEffect(() => {
    if (!hydrated.current) return undefined;

    saveLocalActivities(activities);
    if (!pendingSave.current) return undefined;

    if (!driveReadOk.current) {
      setSyncState('offline');
      return undefined;
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSyncState('saving');
      pendingSave.current = false;
      try {
        await sendJson('/api/activities', { activities }, 'PUT');
        setSyncState('saved');
      } catch (err) {
        console.error('Drive sync failed:', err);
        // Put the flag back so the next change retries this write too.
        pendingSave.current = true;
        setSyncState('error');
      }
    }, 1200);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [activities]);

  // Every mutation below marks the list dirty, which is what allows the save
  // effect to distinguish a real edit from hydration replacing the array.
  const patchActivity = useCallback((id, changes) => {
    pendingSave.current = true;
    setActivities((current) =>
      current.map((activity) => (activity.id === id ? { ...activity, ...changes } : activity)),
    );
  }, []);

  const handleAdd = useCallback(
    (fields) => {
      const activity = {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ...fields,
        createdAt: new Date().toISOString(),
        folderId: null,
        folderLink: null,
        formId: null,
        formLink: null,
        formEditLink: null,
        posterCount: 0,
        posterJobId: null,
      };
      pendingSave.current = true;
      setActivities((current) => [activity, ...current]);
      push('success', `“${activity.title}” added. Generate its poster next.`);
    },
    [push],
  );

  const handleDelete = useCallback(
    (activity) => {
      const warning = activity.folderId
        ? '\n\nIts Google Drive folder and registration form will NOT be deleted — remove those in Drive if you want them gone.'
        : '';
      if (!window.confirm(`Remove “${activity.title}” from this list?${warning}`)) return;

      pendingSave.current = true;
      setActivities((current) => current.filter((item) => item.id !== activity.id));
      setPosters((current) => {
        const next = { ...current };
        delete next[activity.id];
        return next;
      });
      push('info', `“${activity.title}” removed from the list.`);
    },
    [push],
  );

  /**
   * Make sure the activity has a Drive folder and a registration form.
   *
   * This runs before the poster is rendered, not after. The QR code printed on
   * the poster has to point at the form, so the form has to exist first —
   * otherwise the poster carries a QR to nothing and has to be thrown away.
   */
  const ensureForm = useCallback(
    async (activity) => {
      let { folderId, folderLink, formId, formLink, formEditLink } = activity;

      if (!folderId) {
        const folder = await sendJson('/api/drive-integration', {
          action: 'createFolder',
          activityTitle: activity.title,
        });
        folderId = folder.folderId;
        folderLink = folder.folderLink;

        if (folder.usedFallback) {
          push(
            'warning',
            `GOOGLE_DRIVE_FOLDER_ID could not be used (${folder.fallbackReason}). The folder was created at the root of your Drive instead.`,
          );
        }
      }

      if (!formId) {
        const form = await sendJson('/api/create-form', {
          activityTitle: activity.title,
          date: activity.date,
          time: activity.time,
          location: activity.location,
          folderId,
        });
        formId = form.formId;
        formLink = form.formLink;
        formEditLink = form.editLink;
      }

      patchActivity(activity.id, { folderId, folderLink, formId, formLink, formEditLink });
      return { folderId, folderLink, formId, formLink, formEditLink };
    },
    [patchActivity, push],
  );

  /**
   * Generate the poster: form first, then render, then lay the QR over it.
   *
   * The waiting happens here in the browser rather than inside one long request,
   * because a serverless function cannot stay open for the minute a render takes.
   */
  const handleGenerate = useCallback(
    async (activity) => {
      setActivityBusy(activity.id, 'generate');
      setProgressLine(activity.id, 'Preparing the registration form…');

      try {
        const { formLink } = await ensureForm(activity);
        const qrCodeUrl = await buildQrCode(formLink);

        setProgressLine(activity.id, 'Queueing the render…');
        const { jobId } = await sendJson('/api/generate-image', { activity });

        const startedAt = Date.now();
        let ready = false;
        let failures = 0;

        while (Date.now() - startedAt < RENDER_TIMEOUT_MS) {
          await sleep(RENDER_POLL_MS);
          const elapsed = Math.round((Date.now() - startedAt) / 1000);

          let jobStatus;
          try {
            jobStatus = await getJson(`/api/generate-image/${jobId}`);
            failures = 0;
          } catch (err) {
            // A rejected session or a locked-down account will not fix itself.
            if (err.status === 401 || err.status === 403) throw err;

            failures += 1;
            if (failures >= MAX_POLL_FAILURES) {
              throw new Error(
                'Lost contact with the poster generator mid-render. Check that ComfyUI, Caddy ' +
                  'and cloudflared are all still running on the host machine.',
              );
            }
            setProgressLine(
              activity.id,
              `Rendering… ${elapsed}s — host machine not responding, still retrying`,
            );
            continue;
          }

          if (jobStatus.status === 'done') {
            ready = true;
            break;
          }
          if (jobStatus.status === 'error') {
            throw new Error(jobStatus.message || 'The render failed on the GPU.');
          }

          setProgressLine(activity.id, `Rendering the poster… ${elapsed}s`);
        }

        if (!ready) {
          throw new Error(
            'The render is still not finished after five minutes. Check ComfyUI on the host ' +
              'machine — it may be out of memory or stuck behind a queued job.',
          );
        }

        setProgressLine(activity.id, 'Adding the QR code…');
        const compose = () =>
          sendJson('/api/generate-posters', { activity, qrCodeUrl, jobId });

        // This step pulls the full poster back through the tunnel, the largest
        // transfer in the flow and the one most likely to be interrupted by a
        // machine still recovering from the render. One retry turns the common
        // case from a lost poster into a pause.
        let data;
        try {
          data = await compose();
        } catch (err) {
          if (err.code !== 'COMFY_UNAVAILABLE') throw err;
          setProgressLine(activity.id, 'Adding the QR code… retrying');
          await sleep(3000);
          data = await compose();
        }

        setPosters((current) => ({ ...current, [activity.id]: data.posters }));
        patchActivity(activity.id, { posterJobId: jobId });

        push(
          'success',
          'Poster ready. Check the date and time on it before publishing — the model gets ' +
            'those wrong more often than not, so regenerate if they are off.',
        );
      } catch (err) {
        reportError(err, 'Poster generation failed.');
      } finally {
        setActivityBusy(activity.id, null);
        setProgressLine(activity.id, null);
      }
    },
    [ensureForm, patchActivity, push, reportError, setActivityBusy, setProgressLine],
  );

  /** Upload the approved poster into the activity's Drive folder. */
  const handlePublish = useCallback(
    async (activity) => {
      const poster = posters[activity.id]?.[0];
      if (!poster) {
        push('error', 'Generate a poster first, then publish it.');
        return;
      }

      setActivityBusy(activity.id, 'publish');
      try {
        // The folder always exists by now: generating the poster created it
        // along with the form. This is only a guard against a stale record.
        const { folderId, folderLink } = await ensureForm(activity);

        await sendJson('/api/drive-integration', {
          action: 'uploadFile',
          folderId,
          fileName: `${slugify(activity.title)}_poster`,
          fileContent: poster.html,
        });

        patchActivity(activity.id, { posterCount: (activity.posterCount ?? 0) + 1 });
        push('success', `Published “${activity.title}” to Drive.`, {
          link: folderLink,
          linkLabel: 'Open Drive folder',
        });
      } catch (err) {
        reportError(err, 'Publishing to Drive failed.');
      } finally {
        setActivityBusy(activity.id, null);
      }
    },
    [ensureForm, patchActivity, posters, push, reportError, setActivityBusy],
  );

  /**
   * Download a poster as a file.
   *
   * A Blob URL rather than a `data:` URL: Chrome refuses to navigate to long
   * top-level data URLs, and a poster with an embedded image far exceeds that.
   */
  const handleDownload = useCallback(
    (activity, index) => {
      const poster = posters[activity.id]?.[index];
      if (!poster) {
        push('error', 'That poster is no longer available. Generate it again.');
        return;
      }

      const blob = new Blob([poster.html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${slugify(activity.title)}_poster.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoking immediately can cancel the download in Safari.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
    [posters, push],
  );

  if (status === 'loading' || (status === 'authenticated' && restoring && activities.length === 0)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Loader2 size={44} className="mx-auto mb-4 animate-spin text-blue-600" aria-hidden="true" />
          <p className="text-gray-600">Loading your activities…</p>
        </div>
      </div>
    );
  }

  if (status !== 'authenticated') return null;

  const modalActivity = modal && activities.find((item) => item.id === modal.activityId);
  const modalPoster = modal && posters[modal.activityId]?.[modal.index];

  const syncLabel = {
    saving: { icon: RefreshCw, text: 'Saving to Drive…', className: 'text-gray-500 animate-spin' },
    saved: { icon: Check, text: 'Saved to Drive', className: 'text-green-600' },
    error: { icon: CloudOff, text: 'Drive save failed — saved in this browser', className: 'text-amber-600' },
    offline: {
      icon: CloudOff,
      text: 'Drive unreachable — saved in this browser only, reload to sync',
      className: 'text-amber-600',
    },
  }[syncState];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-800 sm:text-3xl">
              SkillWill Activity Calendar
            </h1>
            <p className="mt-1 truncate text-gray-600">
              Signed in as {session?.user?.name || session?.user?.email}
            </p>
            {syncLabel && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                <syncLabel.icon size={13} className={syncLabel.className} aria-hidden="true" />
                {syncLabel.text}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-bold text-white transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            <LogOut size={20} aria-hidden="true" /> Sign out
          </button>
        </div>
      </header>

      {config && !config.adminListConfigured && (
        <div className="border-b border-amber-200 bg-amber-50">
          <p className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong>ADMIN_EMAILS is empty</strong> — any Google account can sign in and create
              folders in your Drive. Set it to your own address before sharing the link.
            </span>
          </p>
        </div>
      )}

      {/* Without this the generate button is simply absent, with nothing to say
          why — and every reason it can be absent has a different fix. */}
      {config && !config.imageGenAvailable && config.imageGenBlockedReason && (
        <div className="border-b border-slate-200 bg-slate-50">
          <p className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-3 text-sm text-slate-700">
            <Wand2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong>Poster generation is off</strong> — {config.imageGenBlockedReason}
            </span>
          </p>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="sticky top-8 rounded-lg bg-white p-6 shadow-lg">
              <h2 className="mb-6 text-2xl font-bold text-gray-800">Create activity</h2>
              <ActivityForm onAdd={handleAdd} />
            </div>
          </div>

          <div className="lg:col-span-2">
            {activities.length === 0 ? (
              <div className="rounded-lg bg-white p-12 text-center shadow-lg">
                <Calendar size={48} className="mx-auto mb-4 text-gray-400" aria-hidden="true" />
                <p className="text-lg text-gray-500">
                  No activities yet. Create one to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {activities.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    posters={posters[activity.id]}
                    busy={busy[activity.id]}
                    progress={progress[activity.id]}
                    imageGenAvailable={Boolean(config?.imageGenAvailable)}
                    onGenerate={() => handleGenerate(activity)}
                    onPublish={() => handlePublish(activity)}
                    onDelete={() => handleDelete(activity)}
                    onOpenPoster={(index) => setModal({ activityId: activity.id, index })}
                    onDownloadPoster={(index) => handleDownload(activity, index)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {modalPoster && modalActivity && (
        <PosterModal
          poster={modalPoster}
          label={`${modalActivity.title} — generated poster`}
          onClose={() => setModal(null)}
          onDownload={() => handleDownload(modalActivity, modal.index)}
        />
      )}

      <ToastStack toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
