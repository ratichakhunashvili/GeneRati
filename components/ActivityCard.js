'use client';

import {
  AlertTriangle,
  Calendar,
  Clock,
  CloudUpload,
  ExternalLink,
  FolderOpen,
  Loader2,
  MapPin,
  Pencil,
  RefreshCw,
  Trash2,
  Wand2,
} from 'lucide-react';
import { PosterThumbnail } from './PosterPreview';
import { formatDateEn, formatTime } from '@/lib/format';
import { expectedPosterText } from '@/lib/posterPrompt';

function Spinner() {
  return <Loader2 size={18} className="animate-spin" aria-hidden="true" />;
}

function ActionButton({ onClick, disabled, busy, icon: Icon, children, tone = 'neutral' }) {
  const tones = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    publish: 'bg-orange-600 hover:bg-orange-700 text-white',
    neutral: 'bg-gray-700 hover:bg-gray-800 text-white',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-400 ${tones[tone]}`}
    >
      {busy ? <Spinner /> : <Icon size={18} aria-hidden="true" />}
      {children}
    </button>
  );
}

function LinkRow({ href, icon: Icon, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 underline underline-offset-2 hover:text-blue-900"
    >
      <Icon size={15} aria-hidden="true" />
      {children}
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}

export default function ActivityCard({
  activity,
  posters,
  busy,
  progress,
  imageGenAvailable,
  onGenerate,
  onPublish,
  onDelete,
  onOpenPoster,
  onDownloadPoster,
}) {
  const isBusy = Boolean(busy);
  const published = Boolean(activity.folderId);
  const hasPoster = Boolean(posters?.length);

  // What the poster was asked to say. Shown beside it because the model gets
  // the date wrong more often than it gets it right, and the only practical
  // check is reading the two side by side.
  const expected = expectedPosterText(activity);

  // Keyed by `label`, not by `value`: a location typed as "18:00" would collide
  // with the formatted time and give two rows the same React key.
  const details = [
    { label: 'date', icon: Calendar, value: formatDateEn(activity.date) },
    { label: 'time', icon: Clock, value: formatTime(activity.time) },
    { label: 'location', icon: MapPin, value: activity.location },
  ];

  return (
    <article className="overflow-hidden rounded-lg bg-white shadow-lg">
      <header className="border-b border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
                  published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {published ? 'Published' : 'Draft'}
              </span>
              {activity.posterCount > 0 && (
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  {activity.posterCount} in Drive
                </span>
              )}
            </div>

            <h3 className="break-words text-2xl font-bold text-gray-800">{activity.title}</h3>

            <dl className="mt-3 space-y-2 text-gray-600">
              {details.map(({ label, icon: Icon, value }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon size={18} className="shrink-0 text-blue-600" aria-hidden="true" />
                  <dd className="break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <button
            type="button"
            onClick={onDelete}
            disabled={isBusy}
            className="shrink-0 rounded-lg p-2 text-red-600 transition hover:bg-red-50 hover:text-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:text-gray-300"
            aria-label={`Delete ${activity.title}`}
          >
            <Trash2 size={22} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="border-b border-gray-200 bg-gray-50 p-6">
        <div className="flex flex-wrap gap-3">
          <ActionButton
            onClick={onGenerate}
            disabled={isBusy || !imageGenAvailable}
            busy={busy === 'generate'}
            icon={hasPoster ? RefreshCw : Wand2}
            tone="primary"
          >
            {hasPoster ? 'Regenerate poster' : 'Generate poster'}
          </ActionButton>

          <ActionButton
            onClick={onPublish}
            disabled={isBusy || !hasPoster}
            busy={busy === 'publish'}
            icon={CloudUpload}
            tone="publish"
          >
            Publish to Drive
          </ActionButton>
        </div>

        {!published && !hasPoster && (
          <p className="mt-3 text-sm text-gray-600">
            Generating the poster also creates the Drive folder and the registration form, so the
            QR code printed on it points at a form that already exists.
          </p>
        )}

        {progress && (
          <p className="mt-3 flex items-center gap-2 text-sm text-blue-800">
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            {progress}
          </p>
        )}

        {(activity.folderLink || activity.formLink) && (
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            {activity.folderLink && (
              <LinkRow href={activity.folderLink} icon={FolderOpen}>
                Drive folder
              </LinkRow>
            )}
            {activity.formLink && (
              <LinkRow href={activity.formLink} icon={ExternalLink}>
                Registration form
              </LinkRow>
            )}
            {activity.formEditLink && (
              <LinkRow href={activity.formEditLink} icon={Pencil}>
                Edit form / see responses
              </LinkRow>
            )}
          </div>
        )}
      </div>

      {hasPoster && (
        <div className="p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <h4 className="mb-3 font-bold text-gray-800">
                Poster
                <span className="ml-2 text-sm font-normal text-gray-500">click to enlarge</span>
              </h4>
              <PosterThumbnail
                poster={posters[0]}
                label={`${activity.title} — generated poster`}
                onOpen={() => onOpenPoster(0)}
                onDownload={() => onDownloadPoster(0)}
              />
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-start gap-2 text-sm font-bold text-amber-900">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                Check the poster says exactly this
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                {[
                  ['Title', expected.title],
                  ['Date', expected.date],
                  ['Time', expected.time],
                  ['Location', expected.location],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs uppercase tracking-wide text-amber-700">{label}</dt>
                    <dd className="font-mono font-semibold text-amber-950">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-amber-800">
                The image model spells the title reliably but gets dates wrong most of the time.
                If anything differs, hit <strong>Regenerate poster</strong> — it takes about a
                minute and produces a different design each time.
              </p>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
