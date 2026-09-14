// Shared formatting helpers. Used on both the server (poster templates, form
// descriptions) and the client (activity cards), so keep this free of any
// browser- or node-only APIs.

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape a value for interpolation into HTML. Activity titles and locations are
 * typed by a human and then baked into poster documents that get uploaded to
 * Drive and opened in a browser, so every interpolation must go through this.
 */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

const MONTHS_KA = [
  'იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი',
  'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი',
];

const WEEKDAYS_KA = [
  'კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი',
  'ხუთშაბათი', 'პარასკევი', 'შაბათი',
];

/**
 * Parse a yyyy-mm-dd string into a Date at local noon.
 *
 * Noon rather than midnight because `new Date('2026-03-01')` is parsed as UTC
 * midnight, which lands on the previous day for anyone west of UTC. Georgia is
 * UTC+4, so midnight UTC would render as the day before for a Tbilisi user.
 */
function parseDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "2026-03-01" -> "1 მარტი, 2026" (falls back to the raw string). */
export function formatDateKa(value) {
  const date = parseDateOnly(value);
  if (!date) return String(value ?? '');
  return `${date.getDate()} ${MONTHS_KA[date.getMonth()]}, ${date.getFullYear()}`;
}

/** "2026-03-01" -> "ორშაბათი" (empty string when unparseable). */
export function formatWeekdayKa(value) {
  const date = parseDateOnly(value);
  return date ? WEEKDAYS_KA[date.getDay()] : '';
}

/** "2026-03-01" -> "Sun, 1 March 2026" for the English admin interface. */
export function formatDateEn(value) {
  const date = parseDateOnly(value);
  if (!date) return String(value ?? '');
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Normalise an <input type="time"> value to "HH:MM". */
export function formatTime(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value ?? '').trim());
  if (!match) return String(value ?? '');
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/** True when the date is strictly before today (used for a soft warning only). */
export function isPastDate(value) {
  const date = parseDateOnly(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return date.getTime() < today.getTime();
}

/**
 * Turn an activity title into a filename-safe slug.
 *
 * Georgian letters are outside \w, so strip on an explicit blocklist of
 * characters Drive and Windows dislike instead of an allowlist, which would
 * throw away the entire title for a Georgian-language activity.
 */
export function slugify(title) {
  return String(title ?? '')
    .replace(/[\\/:*?"<>|#[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'Activity';
}
