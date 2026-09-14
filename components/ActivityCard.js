'use client';

import {
  Calendar,
  Clock,
  CloudUpload,
  ExternalLink,
  FolderOpen,
  Images,
  Loader2,
  MapPin,
  Pencil,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { PosterThumbnail } from './PosterPreview';
import { formatDateEn, formatTime } from '@/lib/format';

function Spinner() {
  return <Loader2 size={18} className="animate-spin" aria-hidden="true" />;
}

function ActionButton({ onClick, disabled, busy, icon: Icon, children, tone = 'neutral' }) {
  const tones = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    publish: 'bg-orange-600 hover:bg-orange-700 text-white',
    ai: 'bg-purple-600 hover:bg-purple-700 text-white',
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
  aiAvailable,
  onPreview,
  onPublish,
  onDelete,
  onOpenPoster,
  onDownloadPoster,
}) {
  const isBusy = Boolean(busy);
  const published = Boolean(activity.folderId);
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
                  {activity.posterCount} posters in Drive
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
            onClick={() => onPreview('template')}
            disabled={isBusy}
            busy={busy === 'template'}
            icon={Images}
            tone="primary"
          >
            {posters?.length ? 'Regenerate posters' : 'Generate posters'}
          </ActionButton>

          {aiAvailable && (
            <ActionButton
              onClick={() => onPreview('ai')}
              disabled={isBusy}
              busy={busy === 'ai'}
              icon={Sparkles}
              tone="ai"
            >
              AI variants
            </ActionButton>
          )}

          <ActionButton
            onClick={() => onPublish()}
            disabled={isBusy}
            busy={busy === 'publish'}
            icon={CloudUpload}
            tone="publish"
          >
            {published ? 'Update Drive' : 'Publish to Drive'}
          </ActionButton>
        </div>

        {busy === 'publish' && (
          <p className="mt-3 text-sm text-gray-600">
            Creating the folder and form, then rebuilding the posters so the QR code points at
            the form. This takes a few seconds.
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

      {posters?.length > 0 && (
        <div className="p-6">
          <h4 className="mb-4 font-bold text-gray-800">
            Poster variations
            <span className="ml-2 text-sm font-normal text-gray-500">
              click a poster to enlarge
            </span>
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            {posters.map((poster, index) => (
              <PosterThumbnail
                key={`${poster.colorScheme}-${poster.variationNumber}`}
                poster={poster}
                label={`${activity.title} — variation ${poster.variationNumber}, ${poster.colorScheme}`}
                onOpen={() => onOpenPoster(index)}
                onDownload={() => onDownloadPoster(index)}
              />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
