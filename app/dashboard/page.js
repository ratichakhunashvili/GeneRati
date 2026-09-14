'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  Calendar,
  Check,
  CloudOff,
  LayoutTemplate,
  Loader2,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import ActivityCard from '@/components/ActivityCard';
import ActivityForm from '@/components/ActivityForm';
import { PosterModal } from '@/components/PosterPreview';
import { ToastStack, useToasts } from '@/components/Toast';
import { loadLocalActivities, mergeActivities, saveLocalActivities } from '@/lib/storage';
import { slugify } from '@/lib/format';
import { matchTemplate } from '@/lib/templates';

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

/**
 * Decide how a poster should be generated for an activity.
 *
 * "auto" is resolved here rather than on the server so that an activity with no
 * keyword match quietly falls back to the built-in designs instead of coming
 * back as an error.
 */
function resolvePosterMode(activity, templates) {
  const choice = activity.templateId ?? 'auto';

  if (choice === 'builtin') return { mode: 'builtin' };
  if (templates.length === 0) return { mode: 'builtin' };

  if (choice === 'auto') {
    const match = matchTemplate(templates, activity.title);
    return match
      ? { mode: 'custom', templateId: match.id }
      : // Falling back is right, but doing it silently is not: the poster comes
        // back looking nothing like the user's design with no explanation.
        { mode: 'builtin', fellBackFrom: 'no-keyword-match' };
  }

  const exists = templates.some((template) => template.id === choice);
  return exists
    ? { mode: 'custom', templateId: choice }
    : { mode: 'builtin', fellBackFrom: 'template-deleted' };
}

/** Explain a fallback so it never looks like the app ignored the choice. */
const FALLBACK_MESSAGE = {
  'no-keyword-match':
    'None of your templates has a keyword matching this title, so the built-in designs were used. ' +
    'Add a matching keyword on the Templates page, or pick a template directly when creating the activity.',
  'template-deleted':
    'The template chosen for this activity no longer exists, so the built-in designs were used.',
};

/** Build the QR payload: the form once it exists, otherwise the event details. */
async function buildQrCode(activity) {
  const payload =
    activity.formLink ||
    `${activity.title}\n${activity.date} ${activity.time}\n${activity.location}`;
  try {
    return await QRCode.toDataURL(payload, {
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
  const [templates, setTemplates] = useState([]);
  const [syncState, setSyncState] = useState('idle'); // idle | saving | saved | error
  const [restoring, setRestoring] = useState(true);
  const [modal, setModal] = useState(null); // { activityId, index }

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
        const [configResponse, activitiesResponse, templatesResponse] = await Promise.all([
          fetch('/api/config'),
          fetch('/api/activities'),
          fetch('/api/templates'),
        ]);

        if (cancelled) return;

        if (configResponse.ok) setConfig(await configResponse.json());

        // Templates are optional: without them the built-in designs are used,
        // so a failure here must not stop the activities from loading.
        if (templatesResponse.ok) {
          const data = await templatesResponse.json();
          setTemplates(data.templates ?? []);
        }

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

    // The browser copy is always safe to write and is the offline fallback.
    saveLocalActivities(activities);

    // Nothing the user actually changed, so there is nothing to push.
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
        posterSource: null,
        templateId: fields.templateId ?? 'auto',
      };
      pendingSave.current = true;
      setActivities((current) => [activity, ...current]);
      push('success', `“${activity.title}” added. Generate posters or publish it to Drive.`);
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

  /** Generate posters for preview, without touching Drive. */
  const handlePreview = useCallback(
    async (activity, requestedMode) => {
      setActivityBusy(activity.id, requestedMode);
      try {
        const qrCodeUrl = await buildQrCode(activity);
        const { fellBackFrom, ...selection } =
          requestedMode === 'ai' ? { mode: 'ai' } : resolvePosterMode(activity, templates);

        if (fellBackFrom) push('warning', FALLBACK_MESSAGE[fellBackFrom]);

        const data = await sendJson('/api/generate-posters', {
          activity,
          qrCodeUrl,
          ...selection,
        });

        setPosters((current) => ({ ...current, [activity.id]: data.posters }));
        patchActivity(activity.id, { posterSource: data.mode });

        const note = activity.formLink
          ? 'The QR code points at the registration form.'
          : 'The QR code carries the event details — publish to Drive to point it at a form.';
        const failed = data.failedCount
          ? ` ${data.failedCount} variation${data.failedCount > 1 ? 's' : ''} failed.`
          : '';
        const what =
          data.posters.length === 1
            ? `Poster ready from “${data.posters[0].colorScheme}”.`
            : `${data.posters.length} posters ready.`;
        push('success', `${what} ${note}${failed}`);
      } catch (err) {
        reportError(err, 'Poster generation failed.');
      } finally {
        setActivityBusy(activity.id, null);
      }
    },
    [patchActivity, push, reportError, setActivityBusy, templates],
  );

  /**
   * Publish everything in the order that makes the QR code correct.
   *
   * Folder, then form, then posters — because the QR has to contain the form
   * URL, and the form URL does not exist until the form has been created. The
   * old flow generated posters first, so the printed QR never reached the form.
   */
  const handlePublish = useCallback(
    async (activity) => {
      setActivityBusy(activity.id, 'publish');
      try {
        let { folderId, folderLink, formId, formLink, formEditLink } = activity;
        // Posters already on screen were built with the form URL in their QR
        // only if the form existed when they were generated.
        const postersAlreadyCorrect = Boolean(activity.formLink && posters[activity.id]?.length);

        if (!folderId) {
          const folder = await sendJson('/api/drive-integration', {
            action: 'createFolder',
            activityTitle: activity.title,
          });
          folderId = folder.folderId;
          folderLink = folder.folderLink;
          patchActivity(activity.id, { folderId, folderLink });

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
          patchActivity(activity.id, { formId, formLink, formEditLink });
        }

        // Rebuild the posters now that the form URL exists, so the printed QR
        // actually reaches the form.
        //
        // The exception is a re-publish of AI posters that were already built
        // against this form: regenerating those would charge the Anthropic
        // account again for an identical result.
        const withForm = { ...activity, formLink };
        const { fellBackFrom, ...selection } =
          activity.posterSource === 'ai'
            ? { mode: 'ai' }
            : resolvePosterMode(withForm, templates);

        if (fellBackFrom) push('warning', FALLBACK_MESSAGE[fellBackFrom]);
        let generated;

        if (selection.mode === 'ai' && postersAlreadyCorrect) {
          generated = { posters: posters[activity.id], mode: 'ai' };
        } else {
          const qrCodeUrl = await buildQrCode(withForm);
          generated = await sendJson('/api/generate-posters', {
            activity: withForm,
            qrCodeUrl,
            ...selection,
          });
          setPosters((current) => ({ ...current, [activity.id]: generated.posters }));
        }

        const uploads = await Promise.allSettled(
          generated.posters.map((poster, index) =>
            sendJson('/api/drive-integration', {
              action: 'uploadFile',
              folderId,
              fileName: `${slugify(activity.title)}_v${index + 1}_${poster.colorScheme}`,
              fileContent: poster.html,
            }),
          ),
        );

        const uploaded = uploads.filter((result) => result.status === 'fulfilled').length;
        const failed = uploads.length - uploaded;

        patchActivity(activity.id, {
          folderId,
          folderLink,
          formId,
          formLink,
          formEditLink,
          posterCount: uploaded,
          posterSource: generated.mode,
        });

        if (failed > 0) {
          push(
            'warning',
            `Published, but ${failed} of ${uploads.length} posters failed to upload. Try “Update Drive” again.`,
            { link: folderLink, linkLabel: 'Open Drive folder' },
          );
        } else {
          push('success', `Published “${activity.title}” — ${uploaded} posters and a registration form.`, {
            link: folderLink,
            linkLabel: 'Open Drive folder',
          });
        }
      } catch (err) {
        reportError(err, 'Publishing to Drive failed.');
      } finally {
        setActivityBusy(activity.id, null);
      }
    },
    [patchActivity, posters, push, reportError, setActivityBusy, templates],
  );

  /**
   * Download a poster as a file.
   *
   * A Blob URL rather than a `data:` URL: Chrome refuses to navigate to long
   * top-level data URLs, and a full poster comfortably exceeds that limit once
   * the QR image is embedded.
   */
  const handleDownload = useCallback(
    (activity, index) => {
      const poster = posters[activity.id]?.[index];
      if (!poster) {
        push('error', 'That poster is no longer available. Generate the posters again.');
        return;
      }

      const blob = new Blob([poster.html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${slugify(activity.title)}_v${index + 1}.html`;
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

          <div className="flex items-center gap-2">
            <Link
              href="/templates"
              className="flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 font-bold text-gray-700 transition hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <LayoutTemplate size={20} aria-hidden="true" />
              Templates
              {templates.length > 0 && (
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                  {templates.length}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-bold text-white transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            >
              <LogOut size={20} aria-hidden="true" /> Sign out
            </button>
          </div>
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

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="sticky top-8 rounded-lg bg-white p-6 shadow-lg">
              <h2 className="mb-6 text-2xl font-bold text-gray-800">Create activity</h2>
              <ActivityForm onAdd={handleAdd} templates={templates} />
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
                    aiAvailable={Boolean(config?.aiPostersAvailable)}
                    onPreview={(mode) => handlePreview(activity, mode)}
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
          label={`${modalActivity.title} — variation ${modalPoster.variationNumber}, ${modalPoster.colorScheme}`}
          onClose={() => setModal(null)}
          onDownload={() => handleDownload(modalActivity, modal.index)}
        />
      )}

      <ToastStack toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
