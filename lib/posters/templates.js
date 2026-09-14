// Offline poster renderer.
//
// Three deliberately different designs per activity — Bold, Premium, Playful —
// each built on artwork chosen from the activity's title. A football event gets
// pitch markings and a ball; a quiz night gets question marks and answer
// bubbles. No API key, no network, no cost, and the same input always produces
// the same output.
//
// Each poster is a standalone A4 document that prints edge to edge and embeds
// its QR code as a data URI, so the downloaded file works on a machine that has
// never seen this app.

import { escapeHtml, formatDateKa, formatTime, formatWeekdayKa } from '../format';
import { getActivityKind } from './activities';
import { backdropFor, emblemFor } from './artwork';

// A4 at 96dpi.
const WIDTH = 794;
const HEIGHT = 1123;

// Georgian glyphs are missing from many default sans stacks, so name the faces
// that ship with Windows and macOS explicitly before falling back.
const FONT_STACK =
  "'Segoe UI', 'Noto Sans Georgian', 'BPG Arial', Sylfaen, system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";

/**
 * Pick a title size that keeps long titles inside the poster.
 *
 * Titles are typed freely and Georgian words run long, so a fixed size either
 * wastes the canvas on "Chess" or overflows on a real event name.
 */
function titleSize(title, max, min) {
  const length = String(title ?? '').length;
  if (length <= 14) return max;
  if (length >= 60) return min;
  return Math.round(max - ((length - 14) / 46) * (max - min));
}

const ICONS = {
  calendar:
    '<path d="M7 2v3M17 2v3M3.5 9.5h17M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5Z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  pin: '<path d="M12 21s6.5-5.5 6.5-10a6.5 6.5 0 1 0-13 0C5.5 15.5 12 21 12 21Z"/><circle cx="12" cy="11" r="2.4"/>',
};

function icon(name, color, size = 26, width = 1.9) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

/** The QR card, or nothing at all when the QR could not be generated. */
function qrCard(qrCodeUrl, borderColor, { size = 212, border = 11, radius = 20 } = {}) {
  if (!qrCodeUrl) return '';
  return `<div class="qr-card" style="border:${border}px solid ${borderColor};border-radius:${radius}px">
          <img src="${escapeHtml(qrCodeUrl)}" width="${size}" height="${size}" alt="რეგისტრაციის QR კოდი" />
        </div>`;
}

/**
 * Wrap a design in a complete A4 document.
 *
 * print-color-adjust is essential: without it browsers strip background
 * colours and images when printing, which would reduce these posters to text
 * on white paper.
 */
function documentShell({ title, palette, css, body }) {
  return `<!DOCTYPE html>
<html lang="ka">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} — SkillWill College</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    background: #454b54;
    font-family: ${FONT_STACK};
    -webkit-font-smoothing: antialiased;
  }
  body { display: flex; justify-content: center; padding: 24px; }
  .poster {
    position: relative;
    width: ${WIDTH}px;
    height: ${HEIGHT}px;
    overflow: hidden;
    background: ${palette.dark};
    color: #ffffff;
    box-shadow: 0 24px 70px rgba(0, 0, 0, .45);
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .art-backdrop {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    pointer-events: none;
  }
  .layer { position: relative; z-index: 2; height: 100%; }
  .qr-card { background: #fff; padding: 10px; line-height: 0; box-shadow: 0 16px 40px rgba(0,0,0,.4); flex: none; }
  .qr-card img { display: block; }
  /*
    The poster clips overflow, so a single unbreakable word — a long Georgian
    compound, a hashtag, a pasted URL — must wrap rather than run off the edge
    and take the rest of the line with it.
  */
  h1 { overflow-wrap: anywhere; word-break: break-word; }
  .footer-note {
    font-size: 14px; letter-spacing: .14em; text-transform: uppercase;
    color: rgba(255,255,255,.52);
  }
${css}
  @media print {
    html, body { background: #fff; padding: 0; }
    body { display: block; }
    .poster { box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="poster">
${body}
  </div>
</body>
</html>`;
}

/* ------------------------------------------------------------------ BOLD -- */
/** Heavy, high-contrast, built to read from the far end of a corridor. */
function boldPoster(activity, kind, qrCodeUrl) {
  const c = kind.palette;
  const size = titleSize(activity.title, 96, 46);

  const css = `
  .poster { background: ${c.dark}; }
  .band {
    position: absolute; left: -14%; right: -14%; top: 330px; height: 300px;
    background: linear-gradient(100deg, ${c.primary} 0%, ${c.glow} 100%);
    transform: rotate(-8deg);
  }
  .glow {
    position: absolute; border-radius: 50%; filter: blur(110px); opacity: .5;
    background: ${c.primary};
  }
  .glow-a { width: 520px; height: 520px; top: -190px; right: -170px; }
  .glow-b { width: 460px; height: 460px; bottom: -180px; left: -150px; background: ${c.glow}; }
  .layer { display: flex; flex-direction: column; padding: 62px 58px 48px; }
  .top { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
  .kicker {
    font-size: 17px; letter-spacing: .36em; text-transform: uppercase;
    font-weight: 800; color: ${c.accent};
  }
  .tag {
    margin-top: 14px; display: inline-block;
    background: ${c.primary}; color: ${c.dark};
    padding: 7px 18px; border-radius: 99px;
    font-size: 15px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase;
  }
  .badge { width: 104px; height: 104px; flex: none; }
  .badge svg { width: 100%; height: 100%; }
  .title {
    margin-top: 36px;
    font-size: ${size}px; font-weight: 900; line-height: .98;
    letter-spacing: -.028em; text-transform: uppercase;
    text-shadow: 0 8px 30px rgba(0,0,0,.45);
  }
  .rule { width: 150px; height: 11px; background: ${c.accent}; margin-top: 28px; border-radius: 99px; }
  .info { margin-top: auto; display: flex; flex-direction: column; gap: 13px; align-items: flex-start; }
  .pill {
    display: inline-flex; align-items: center; gap: 14px;
    background: rgba(0,0,0,.5); border: 2px solid rgba(255,255,255,.18);
    padding: 14px 26px; border-radius: 99px;
    font-size: 25px; font-weight: 700;
  }
  .bottom { margin-top: 34px; display: flex; align-items: flex-end; justify-content: space-between; gap: 26px; }
  .cta { font-size: 30px; font-weight: 900; color: ${c.accent}; line-height: 1.2; max-width: 360px; text-transform: uppercase; }
  .cta small { display: block; margin-top: 10px; font-size: 16px; font-weight: 600; text-transform: none; color: rgba(255,255,255,.66); }`;

  const body = `    ${backdropFor(kind.id, c)}
    <div class="glow glow-a"></div>
    <div class="glow glow-b"></div>
    <div class="band"></div>
    <div class="layer">
      <div class="top">
        <div>
          <div class="kicker">SkillWill College</div>
          <div class="tag">${escapeHtml(kind.label)}</div>
        </div>
        <div class="badge">${emblemFor(kind.id, c)}</div>
      </div>

      <h1 class="title">${escapeHtml(activity.title)}</h1>
      <div class="rule"></div>

      <div class="info">
        <div class="pill">${icon('calendar', c.accent)}<span>${escapeHtml(formatDateKa(activity.date))}</span></div>
        <div class="pill">${icon('clock', c.accent)}<span>${escapeHtml(formatTime(activity.time))}</span></div>
        <div class="pill">${icon('pin', c.accent)}<span>${escapeHtml(activity.location)}</span></div>
      </div>

      <div class="bottom">
        <div class="cta">დარეგისტრირდი<small>დაასკანერე QR კოდი ტელეფონით</small></div>
        ${qrCard(qrCodeUrl, c.primary)}
      </div>
      <div class="footer-note" style="margin-top:26px">ორგანიზატორი: SkillWill College</div>
    </div>`;

  return documentShell({ title: activity.title, palette: c, css, body });
}

/* --------------------------------------------------------------- PREMIUM -- */
/** Quiet, symmetrical and generous with space — the grown-up option. */
function premiumPoster(activity, kind, qrCodeUrl) {
  const c = kind.palette;
  const size = titleSize(activity.title, 76, 38);
  const weekday = formatWeekdayKa(activity.date);

  const css = `
  .poster {
    background:
      radial-gradient(120% 80% at 50% -10%, ${c.glow} 0%, transparent 55%),
      radial-gradient(90% 60% at 50% 110%, ${c.primary}33 0%, transparent 60%),
      ${c.dark};
  }
  .frame { position: absolute; inset: 30px; border: 1px solid rgba(255,255,255,.16); pointer-events: none; }
  /*
    Centred rather than top-aligned with the QR pushed down by margin:auto,
    which left a large dead area in the middle of the poster.
  */
  .layer {
    display: flex; flex-direction: column; align-items: center; text-align: center;
    justify-content: center; padding: 64px 58px 96px;
  }
  .kicker {
    font-size: 15px; letter-spacing: .44em; text-transform: uppercase;
    color: ${c.accent}; font-weight: 600;
  }
  .badge-ring {
    margin-top: 30px; width: 150px; height: 150px; flex: none;
    border: 2px solid ${c.primary}; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,.28);
  }
  .badge-ring svg { width: 94px; height: 94px; }
  .weekday {
    margin-top: 28px;
    font-size: 19px; letter-spacing: .2em; text-transform: uppercase; color: rgba(255,255,255,.55);
  }
  .title {
    margin-top: 14px;
    font-size: ${size}px; font-weight: 300; line-height: 1.1; letter-spacing: -.01em;
    max-width: 100%;
  }
  .title strong { font-weight: 700; }
  .divider { margin: 26px 0; width: 86px; height: 1px; background: ${c.primary}; }
  .meta { display: flex; gap: 0; align-items: stretch; }
  /* Sized so "15 ოქტომბერი, 2026" sits on one line instead of breaking. */
  .meta-item { padding: 0 20px; min-width: 196px; }
  .meta-item + .meta-item { border-left: 1px solid rgba(255,255,255,.16); }
  .meta-label {
    font-size: 12px; letter-spacing: .24em; text-transform: uppercase;
    color: rgba(255,255,255,.45); margin-bottom: 9px;
  }
  .meta-value { font-size: 19px; font-weight: 600; line-height: 1.35; }
  .qr-wrap { margin-top: 44px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
  .cta { font-size: 18px; letter-spacing: .1em; color: ${c.accent}; font-weight: 600; }
  .premium-footer { position: absolute; left: 0; right: 0; bottom: 40px; text-align: center; z-index: 2; }`;

  const body = `    ${backdropFor(kind.id, c)}
    <div class="frame"></div>
    <div class="layer">
      <div class="kicker">SkillWill College</div>
      <div class="badge-ring">${emblemFor(kind.id, c)}</div>

      ${weekday ? `<div class="weekday">${escapeHtml(weekday)}</div>` : ''}
      <h1 class="title"><strong>${escapeHtml(activity.title)}</strong></h1>
      <div class="divider"></div>

      <div class="meta">
        <div class="meta-item">
          <div class="meta-label">თარიღი</div>
          <div class="meta-value">${escapeHtml(formatDateKa(activity.date))}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">დრო</div>
          <div class="meta-value">${escapeHtml(formatTime(activity.time))}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">ადგილი</div>
          <div class="meta-value">${escapeHtml(activity.location)}</div>
        </div>
      </div>

      <div class="qr-wrap">
        ${qrCard(qrCodeUrl, c.primary, { size: 202, border: 8, radius: 14 })}
        <div class="cta">დაასკანერე და დარეგისტრირდი</div>
      </div>
    </div>
    <div class="premium-footer footer-note">ორგანიზატორი: SkillWill College</div>`;

  return documentShell({ title: activity.title, palette: c, css, body });
}

/* --------------------------------------------------------------- PLAYFUL -- */
/** Bright, tilted and sticker-like — the one that wins a crowded noticeboard. */
function playfulPoster(activity, kind, qrCodeUrl) {
  const c = kind.palette;
  const size = titleSize(activity.title, 86, 42);

  const css = `
  .poster {
    background: linear-gradient(160deg, ${c.primary} 0%, ${c.glow} 62%, ${c.dark} 100%);
    color: #fff;
  }
  .blob { position: absolute; border-radius: 50%; opacity: .32; }
  .blob-a { width: 420px; height: 420px; top: -140px; left: -120px; background: ${c.accent}; }
  .blob-b { width: 320px; height: 320px; bottom: 150px; right: -110px; background: #ffffff; opacity: .16; }
  .layer { display: flex; flex-direction: column; padding: 56px 52px 44px; }
  .top { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
  .chip {
    background: ${c.dark}; color: #fff;
    padding: 11px 24px; border-radius: 99px;
    font-size: 15px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase;
    transform: rotate(-2.5deg);
  }
  .badge { width: 122px; height: 122px; flex: none; transform: rotate(9deg); }
  .badge svg { width: 100%; height: 100%; }
  .title {
    margin-top: 40px;
    font-size: ${size}px; font-weight: 900; line-height: 1.0;
    letter-spacing: -.026em;
    text-shadow: 5px 5px 0 ${c.dark};
  }
  .sticker-row { margin-top: 34px; display: flex; flex-direction: column; gap: 15px; align-items: flex-start; }
  .sticker {
    display: inline-flex; align-items: center; gap: 13px;
    background: #fff; color: ${c.dark};
    padding: 13px 24px; border-radius: 18px;
    font-size: 24px; font-weight: 800;
    box-shadow: 5px 5px 0 ${c.dark};
  }
  .sticker:nth-child(1) { transform: rotate(-1.6deg); }
  .sticker:nth-child(2) { transform: rotate(1.4deg); }
  .sticker:nth-child(3) { transform: rotate(-.9deg); }
  .bottom {
    margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 24px;
    background: rgba(0,0,0,.34); border-radius: 26px; padding: 24px 28px;
  }
  .cta { font-size: 31px; font-weight: 900; line-height: 1.12; text-transform: uppercase; }
  .cta small { display: block; margin-top: 8px; font-size: 16px; font-weight: 600; text-transform: none; opacity: .8; }
  .qr-card { transform: rotate(3deg); }`;

  const body = `    ${backdropFor(kind.id, { ...c, primary: '#ffffff' })}
    <div class="blob blob-a"></div>
    <div class="blob blob-b"></div>
    <div class="layer">
      <div class="top">
        <div>
          <div class="chip">SkillWill · ${escapeHtml(kind.label)}</div>
        </div>
        <div class="badge">${emblemFor(kind.id, c)}</div>
      </div>

      <h1 class="title">${escapeHtml(activity.title)}</h1>

      <div class="sticker-row">
        <div class="sticker">${icon('calendar', c.glow, 24, 2.2)}<span>${escapeHtml(formatDateKa(activity.date))}</span></div>
        <div class="sticker">${icon('clock', c.glow, 24, 2.2)}<span>${escapeHtml(formatTime(activity.time))}</span></div>
        <div class="sticker">${icon('pin', c.glow, 24, 2.2)}<span>${escapeHtml(activity.location)}</span></div>
      </div>

      <div class="bottom">
        <div class="cta">მოდი და ითამაშე!<small>დაასკანერე QR კოდი და დარეგისტრირდი</small></div>
        ${qrCard(qrCodeUrl, '#ffffff', { size: 186, border: 8, radius: 18 })}
      </div>
      <div class="footer-note" style="margin-top:20px;text-align:center">ორგანიზატორი: SkillWill College</div>
    </div>`;

  return documentShell({ title: activity.title, palette: c, css, body });
}

const STYLES = [
  { name: 'Bold', render: boldPoster },
  { name: 'Premium', render: premiumPoster },
  { name: 'Playful', render: playfulPoster },
];

/**
 * Render all three posters for an activity.
 *
 * Pure and synchronous — no network, no API key, no cost, and deterministic:
 * the same activity always produces byte-identical posters.
 */
export function buildTemplatePosters(activity, qrCodeUrl) {
  const kind = getActivityKind(activity.title);

  return STYLES.map((style, index) => ({
    html: style.render(activity, kind, qrCodeUrl),
    colorScheme: `${kind.label} · ${style.name}`,
    variationNumber: index + 1,
    source: 'template',
  }));
}

/** Palettes for the optional AI path, so it follows the same visual identity. */
export function paletteFor(title) {
  return getActivityKind(title);
}
