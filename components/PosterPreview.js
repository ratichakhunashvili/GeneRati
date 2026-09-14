'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { POSTER_HEIGHT, POSTER_WIDTH } from '@/lib/posters/page';

/**
 * Render poster HTML at its true page size inside a sandboxed iframe, scaled
 * to fit the container.
 *
 * The previous version injected the poster with `dangerouslySetInnerHTML`, which
 * could not work: each poster is a complete HTML document, and a browser
 * discards the nested <html>/<head> when parsing it into a <div>, so the
 * poster's own <style> block was dropped and the preview never resembled the
 * file. An iframe parses it as the document it is, and `sandbox` with no
 * allowances keeps the poster from running scripts against the dashboard.
 */
function ScaledPoster({ html, title, maxScale = 1 }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const measure = () => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      setScale(Math.min(width / POSTER_WIDTH, height / POSTER_HEIGHT, maxScale));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [maxScale]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <iframe
        title={title}
        srcDoc={html}
        // No allowances at all: the posters are static HTML and CSS.
        sandbox=""
        loading="lazy"
        aria-label={title}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: `${POSTER_WIDTH}px`,
          height: `${POSTER_HEIGHT}px`,
          border: 0,
          transformOrigin: 'center center',
          transform: `translate(-50%, -50%) scale(${scale})`,
          // Hide the pre-measurement frame rather than flashing it full size.
          visibility: scale ? 'visible' : 'hidden',
          pointerEvents: 'none',
          background: '#ffffff',
        }}
      />
    </div>
  );
}

/** A clickable thumbnail that keeps the page aspect ratio at any card width. */
export function PosterThumbnail({ poster, label, onOpen, onDownload }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full cursor-zoom-in bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
        style={{ aspectRatio: `${POSTER_WIDTH} / ${POSTER_HEIGHT}` }}
        aria-label={`Enlarge ${label}`}
      >
        <ScaledPoster html={poster.html} title={label} />
      </button>

      <div className="flex items-center justify-between gap-2 border-t border-gray-200 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-800">
            v{poster.variationNumber} · {poster.colorScheme}
          </p>
          <p className="text-xs text-gray-500">
            {{ custom: 'Your design', ai: 'AI generated' }[poster.source] ?? 'Built-in design'}
          </p>
        </div>
        <button
          type="button"
          onClick={onDownload}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <Download size={15} aria-hidden="true" /> Save
        </button>
      </div>
    </div>
  );
}

/** Full-screen poster view. Closes on Escape or backdrop click. */
export function PosterModal({ poster, label, onClose, onDownload }) {
  const closeRef = useRef(null);

  // Held in a ref so the effect below can depend on nothing and therefore run
  // exactly once. The dashboard passes a fresh arrow function for `onClose` on
  // every render, so an [onClose] dependency re-ran this effect — and with it
  // the .focus() call — each time an unrelated toast or sync-status update
  // re-rendered the page, yanking focus back to the close button mid-use.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    // Stop the page behind the modal from scrolling.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (!poster) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 py-2 text-white">
        <p className="truncate text-sm font-semibold">{label}</p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDownload();
            }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Download size={16} aria-hidden="true" /> Download
          </button>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/15 p-2 transition hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Close preview"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1" onClick={(event) => event.stopPropagation()}>
        <ScaledPoster html={poster.html} title={label} />
      </div>
    </div>
  );
}
