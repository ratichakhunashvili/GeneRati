// Custom poster templates.
//
// A template is an A4 background image the user designed elsewhere (Canva,
// Figma, Photoshop) plus a layout saying where the app should place the title,
// date, time, location and QR code on top of it.
//
// Every coordinate is a PERCENTAGE of the poster, never a pixel: the uploaded
// image is normalised to one size on upload, but percentages keep the layout
// correct if that ever changes, and they make the drag editor's maths trivial.

/** Text fields a template lays out, in the order they appear in the editor. */
export const TEXT_FIELDS = [
  { key: 'title', label: 'Title', sample: 'Football Tournament' },
  { key: 'date', label: 'Date', sample: '15 ოქტომბერი, 2026' },
  { key: 'time', label: 'Time', sample: '17:30' },
  { key: 'location', label: 'Location', sample: 'Main Stadium' },
];

/** Posters are rendered on this canvas: A4 at 96dpi. */
export const POSTER_WIDTH = 794;
export const POSTER_HEIGHT = 1123;

/**
 * Stored template images are normalised to twice A4, which prints crisply at
 * ~192dpi while keeping the base64 payload small enough to embed in every
 * generated poster.
 */
export const STORED_WIDTH = POSTER_WIDTH * 2;
export const STORED_HEIGHT = POSTER_HEIGHT * 2;

/** A sensible starting layout: title high, details lower left, QR lower right. */
export function defaultLayout() {
  return {
    title: {
      x: 8, y: 10, w: 84,
      size: 8.5, color: '#ffffff', align: 'left',
      weight: 900, uppercase: true, shadow: true, lineHeight: 1.02,
    },
    date: {
      x: 8, y: 62, w: 52,
      size: 3.4, color: '#ffffff', align: 'left',
      weight: 700, uppercase: false, shadow: true, lineHeight: 1.3,
    },
    time: {
      x: 8, y: 68, w: 52,
      size: 3.4, color: '#ffffff', align: 'left',
      weight: 700, uppercase: false, shadow: true, lineHeight: 1.3,
    },
    location: {
      x: 8, y: 74, w: 52,
      size: 3.4, color: '#ffffff', align: 'left',
      weight: 700, uppercase: false, shadow: true, lineHeight: 1.3,
    },
    qr: {
      show: true, x: 66, y: 70, size: 26,
      padding: 2, radius: 2, bg: '#ffffff', border: 0, borderColor: '#ffffff',
    },
  };
}

const clamp = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const hexColor = (value, fallback) =>
  /^#[0-9a-fA-F]{6}$/.test(String(value ?? '')) ? String(value) : fallback;

const oneOf = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

/**
 * Coerce a layout from the client into something safe to render.
 *
 * The layout is written straight into a style attribute in generated HTML, so
 * every value has to be range-checked and every colour pattern-matched here —
 * this is the boundary where untrusted input becomes markup.
 */
export function sanitizeLayout(input) {
  const base = defaultLayout();
  const out = {};

  for (const { key } of TEXT_FIELDS) {
    const f = input?.[key] ?? {};
    const d = base[key];
    out[key] = {
      x: clamp(f.x, -10, 110, d.x),
      y: clamp(f.y, -10, 110, d.y),
      w: clamp(f.w, 5, 120, d.w),
      size: clamp(f.size, 0.8, 30, d.size),
      color: hexColor(f.color, d.color),
      align: oneOf(f.align, ['left', 'center', 'right'], d.align),
      weight: oneOf(Number(f.weight), [300, 400, 500, 600, 700, 800, 900], d.weight),
      uppercase: Boolean(f.uppercase ?? d.uppercase),
      shadow: Boolean(f.shadow ?? d.shadow),
      lineHeight: clamp(f.lineHeight, 0.8, 2.5, d.lineHeight),
    };
  }

  const q = input?.qr ?? {};
  const dq = base.qr;
  out.qr = {
    show: q.show === undefined ? dq.show : Boolean(q.show),
    x: clamp(q.x, -10, 110, dq.x),
    y: clamp(q.y, -10, 110, dq.y),
    size: clamp(q.size, 5, 60, dq.size),
    padding: clamp(q.padding, 0, 8, dq.padding),
    radius: clamp(q.radius, 0, 10, dq.radius),
    bg: hexColor(q.bg, dq.bg),
    border: clamp(q.border, 0, 5, dq.border),
    borderColor: hexColor(q.borderColor, dq.borderColor),
  };

  return out;
}

/** Normalise the keyword list: lowercase, trimmed, deduplicated, capped. */
export function sanitizeKeywords(input) {
  const raw = Array.isArray(input)
    ? input
    : String(input ?? '').split(/[,\n]/);

  const seen = new Set();
  for (const item of raw) {
    const word = String(item ?? '').trim().toLowerCase();
    if (word && word.length <= 40) seen.add(word);
    if (seen.size >= 20) break;
  }
  return [...seen];
}

/** Trim a template name to something displayable. */
export function sanitizeName(input, fallback = 'Untitled template') {
  const name = String(input ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return name || fallback;
}

/**
 * Pick the template that best matches an activity title.
 *
 * Longer keywords win, so a template registered for "table tennis" beats one
 * registered for "tennis" on the title "Table Tennis Open". Returns null when
 * nothing matches, and the caller decides what to fall back to.
 */
export function matchTemplate(templates, title) {
  const text = String(title ?? '').toLowerCase();
  let best = null;
  let bestLength = 0;

  for (const template of templates) {
    for (const keyword of template.keywords ?? []) {
      if (keyword && text.includes(keyword) && keyword.length > bestLength) {
        best = template;
        bestLength = keyword.length;
      }
    }
  }
  return best;
}
