'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, ImagePlus, Loader2, Pencil, Save, Trash2, X } from 'lucide-react';
import TemplateEditor from '@/components/TemplateEditor';
import { ToastStack, useToasts } from '@/components/Toast';
import { ASPECT_RATIO, PAGE_FORMAT, POSTER_HEIGHT, POSTER_WIDTH, defaultLayout } from '@/lib/templates';
import { formatBytes, normaliseTemplateImage } from '@/lib/imageResize';

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
    /* Handled by the status check below. */
  }
  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.code = data.code;
    throw error;
  }
  return data;
}

export default function TemplatesPage() {
  const { status } = useSession();
  const router = useRouter();
  const { toasts, push, dismiss } = useToasts();
  const fileInput = useRef(null);

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/templates');
      if (!response.ok) throw new Error(`Could not load templates (${response.status})`);
      const data = await response.json();
      setTemplates(data.templates ?? []);
    } catch (err) {
      push('error', err.message);
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    if (status === 'authenticated') load();
  }, [status, load]);

  /** Read the chosen file, normalise it to the page size, and open the editor. */
  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const image = await normaliseTemplateImage(file);

      if (image.croppedPercent >= 8) {
        push(
          'warning',
          `That image is not ${PAGE_FORMAT}-shaped, so about ${image.croppedPercent}% was cropped to fit. ` +
            `For an exact fit, export at ${PAGE_FORMAT} (or any ${POSTER_WIDTH} × ${POSTER_HEIGHT} ratio).`,
        );
      }

      setDraft({
        mode: 'create',
        name: file.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'New template',
        keywords: '',
        layout: defaultLayout(),
        imageUrl: image.dataUri,
        imageDataUri: image.dataUri,
        bytes: image.bytes,
      });
    } catch (err) {
      push('error', err.message);
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const startEdit = (template) => {
    setDraft({
      mode: 'edit',
      id: template.id,
      name: template.name,
      keywords: (template.keywords ?? []).join(', '),
      layout: template.layout ?? defaultLayout(),
      imageUrl: `/api/templates/image?id=${encodeURIComponent(template.id)}`,
      bytes: template.bytes,
    });
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      if (draft.mode === 'create') {
        await sendJson('/api/templates', {
          name: draft.name,
          keywords: draft.keywords,
          layout: draft.layout,
          imageDataUri: draft.imageDataUri,
        });
        push('success', `Template “${draft.name}” saved to your Drive.`);
      } else {
        await sendJson(
          '/api/templates',
          { id: draft.id, name: draft.name, keywords: draft.keywords, layout: draft.layout },
          'PUT',
        );
        push('success', `Template “${draft.name}” updated.`);
      }
      setDraft(null);
      await load();
    } catch (err) {
      push('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (template) => {
    if (!window.confirm(`Delete the template “${template.name}”? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/templates?id=${encodeURIComponent(template.id)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Could not delete that template.');
      }
      push('info', `“${template.name}” deleted.`);
      await load();
    } catch (err) {
      push('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 size={44} className="animate-spin text-blue-600" aria-hidden="true" />
      </div>
    );
  }
  if (status !== 'authenticated') return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6">
          <div>
            <Link
              href="/dashboard"
              className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-900"
            >
              <ArrowLeft size={15} aria-hidden="true" /> Back to activities
            </Link>
            <h1 className="text-2xl font-bold text-gray-800 sm:text-3xl">Poster templates</h1>
            <p className="mt-1 text-gray-600">
              Upload your own designs and choose where the text and QR code go.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {draft ? (
          <section className="rounded-lg bg-white p-6 shadow-lg">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-gray-800">
                {draft.mode === 'create' ? 'New template' : 'Edit template'}
                {draft.bytes ? (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    {formatBytes(draft.bytes)}
                  </span>
                ) : null}
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-lg bg-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-300 disabled:opacity-50"
                >
                  <X size={16} aria-hidden="true" /> Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={busy}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save template
                </button>
              </div>
            </div>

            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="tpl-name" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Template name
                </label>
                <input
                  id="tpl-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  placeholder="e.g. Football — green"
                />
              </div>
              <div>
                <label htmlFor="tpl-keys" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Keywords <span className="font-normal text-gray-500">(comma separated)</span>
                </label>
                <input
                  id="tpl-keys"
                  value={draft.keywords}
                  onChange={(e) => setDraft({ ...draft, keywords: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  placeholder="football, ფეხბურთი, soccer"
                />
                <p className="mt-1 text-xs text-gray-500">
                  When an activity title contains one of these, this template is preselected.
                </p>
              </div>
            </div>

            <TemplateEditor
              imageUrl={draft.imageUrl}
              layout={draft.layout}
              onChange={(layout) => setDraft({ ...draft, layout })}
              disabled={busy}
            />
          </section>
        ) : (
          <>
            <section className="mb-8 rounded-lg bg-white p-6 shadow-lg">
              <h2 className="mb-2 text-xl font-bold text-gray-800">Add a template</h2>
              <p className="mb-4 max-w-3xl text-sm text-gray-600">
                Design an <strong className="text-gray-800">{PAGE_FORMAT}</strong> poster (297 × 420 mm)
                in Canva, Figma or Photoshop and export it as a PNG or JPEG.
                <strong className="text-gray-800">
                  {' '}
                  Leave the title, date, time, location and QR areas empty
                </strong>{' '}
                — the app draws those on top. Anything baked into the image will show through
                underneath.
              </p>

              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={busy}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700 disabled:bg-gray-400"
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                Choose an image
              </button>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-bold text-gray-800">
                Your templates{' '}
                <span className="text-base font-normal text-gray-500">({templates.length})</span>
              </h2>

              {templates.length === 0 ? (
                <div className="rounded-lg bg-white p-12 text-center shadow-lg">
                  <ImagePlus size={44} className="mx-auto mb-4 text-gray-400" aria-hidden="true" />
                  <p className="text-gray-500">
                    No templates yet. Until you add one, activities use the built-in designs.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                  {templates.map((template) => (
                    <article
                      key={template.id}
                      className="overflow-hidden rounded-lg bg-white shadow transition hover:shadow-md"
                    >
                      <div
                        className="bg-gray-100"
                        style={{ aspectRatio: ASPECT_RATIO }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/templates/image?id=${encodeURIComponent(template.id)}`}
                          alt={template.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-3">
                        <p className="truncate text-sm font-bold text-gray-800">{template.name}</p>
                        <p className="mt-0.5 truncate text-xs text-gray-500">
                          {(template.keywords ?? []).join(', ') || 'no keywords'}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(template)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-gray-100 px-2 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-200"
                          >
                            <Pencil size={13} aria-hidden="true" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(template)}
                            disabled={busy}
                            aria-label={`Delete ${template.name}`}
                            className="rounded-md bg-red-50 px-2 py-1.5 text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <ToastStack toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
