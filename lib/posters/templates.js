// Offline poster renderer.
//
// These three templates are the default poster path: they need no API key, no
// network, and no credit, and they render in about a millisecond. Each produces
// a standalone A4 HTML document that prints edge to edge and carries the QR
// code as an embedded data URI, so the file works after being downloaded from
// Drive onto a machine that has never seen this app.

import { escapeHtml, formatDateKa, formatTime, formatWeekdayKa } from '../format';

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
 * Titles are typed freely and Georgian words are long, so a fixed size either
 * wastes the canvas on "Chess" or overflows on a real event name.
 */
function titleSize(title, { max, min }) {
  const length = String(title ?? '').length;
  if (length <= 14) return max;
  if (length >= 60) return min;
  const ratio = (length - 14) / (60 - 14);
  return Math.round(max - ratio * (max - min));
}

const ICONS = {
  calendar:
    '<path d="M7 2v3M17 2v3M3.5 9.5h17M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5Z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  pin: '<path d="M12 21s6.5-5.5 6.5-10a6.5 6.5 0 1 0-13 0C5.5 15.5 12 21 12 21Z"/><circle cx="12" cy="11" r="2.4"/>',
};

function icon(name, color, size = 26) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

/** The QR card, or nothing at all if the QR could not be generated. */
function qrCard(qrCodeUrl, scheme, { size = 224, border = 12 } = {}) {
  if (!qrCodeUrl) return '';
  return `<div class="qr-card" style="border-color:${scheme.primary};border-width:${border}px">
        <img src="${escapeHtml(qrCodeUrl)}" width="${size}" height="${size}" alt="რეგისტრაციის QR კოდი" />
      </div>`;
}

function documentShell({ title, scheme, css, body }) {
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
    background: #4b5563;
    font-family: ${FONT_STACK};
    -webkit-font-smoothing: antialiased;
  }
  body { display: flex; justify-content: center; padding: 24px; }
  .poster {
    position: relative;
    width: ${WIDTH}px;
    height: ${HEIGHT}px;
    overflow: hidden;
    background: ${scheme.secondary};
    color: #ffffff;
    box-shadow: 0 24px 70px rgba(0, 0, 0, .45);
  }
  .qr-card {
    background: #ffffff;
    border-style: solid;
    border-radius: 22px;
    padding: 12px;
    line-height: 0;
    box-shadow: 0 16px 40px rgba(0, 0, 0, .42);
  }
  .qr-card img { display: block; border-radius: 6px; }
  .footer {
    position: absolute;
    left: 0; right: 0; bottom: 30px;
    text-align: center;
    font-size: 15px;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, .5);
  }
${css}
  @media print {
    html, body { background: #ffffff; padding: 0; }
    body { display: block; }
    .poster { box-shadow: none; width: 100%; height: 100vh; }
  }
</style>
</head>
<body>
  <div class="poster">
${body}
    <div class="footer">ორგანიზატორი: SkillWill College</div>
  </div>
</body>
</html>`;
}

/**
 * Variation 1 — a diagonal accent band behind a large left-aligned title, with
 * the details as pills and the QR sitting bottom-right.
 */
function diagonalTemplate(activity, scheme, qrCodeUrl) {
  const size = titleSize(activity.title, { max: 92, min: 46 });
  const css = `
  .band {
    position: absolute; left: -12%; right: -12%; top: 300px; height: 250px;
    background: linear-gradient(100deg, ${scheme.primary} 0%, ${scheme.glow} 100%);
    transform: rotate(-7deg);
    opacity: .96;
  }
  .glow {
    position: absolute; border-radius: 50%; filter: blur(90px); opacity: .45;
  }
  .glow-a { width: 480px; height: 480px; top: -160px; right: -140px; background: ${scheme.primary}; }
  .glow-b { width: 420px; height: 420px; bottom: -150px; left: -130px; background: ${scheme.glow}; }
  .content { position: relative; z-index: 2; padding: 70px 64px; height: 100%; display: flex; flex-direction: column; }
  .kicker {
    font-size: 17px; letter-spacing: .34em; text-transform: uppercase;
    color: ${scheme.accent}; margin-bottom: 22px;
  }
  .title {
    font-size: ${size}px; font-weight: 900; line-height: 1.02;
    letter-spacing: -.02em; text-shadow: 0 6px 26px rgba(0,0,0,.4);
    max-width: 96%;
  }
  .rule { width: 130px; height: 9px; border-radius: 99px; background: ${scheme.accent}; margin: 28px 0 0; }
  .info { margin-top: auto; display: flex; flex-direction: column; gap: 14px; align-items: flex-start; }
  .pill {
    display: inline-flex; align-items: center; gap: 14px;
    background: rgba(0,0,0,.42); border: 1px solid rgba(255,255,255,.16);
    padding: 15px 26px; border-radius: 99px;
    font-size: 25px; font-weight: 600;
    backdrop-filter: blur(6px);
  }
  .bottom { margin-top: 40px; display: flex; align-items: flex-end; justify-content: space-between; gap: 28px; }
  .cta { font-size: 26px; font-weight: 700; color: ${scheme.accent}; max-width: 380px; line-height: 1.3; }
  .cta small { display: block; font-size: 17px; font-weight: 500; color: rgba(255,255,255,.62); margin-top: 10px; }`;

  const body = `    <div class="glow glow-a"></div>
    <div class="glow glow-b"></div>
    <div class="band"></div>
    <div class="content">
      <div class="kicker">SkillWill College</div>
      <h1 class="title">${escapeHtml(activity.title)}</h1>
      <div class="rule"></div>
      <div class="info">
        <div class="pill">${icon('calendar', scheme.accent)}<span>${escapeHtml(formatDateKa(activity.date))}</span></div>
        <div class="pill">${icon('clock', scheme.accent)}<span>${escapeHtml(formatTime(activity.time))}</span></div>
        <div class="pill">${icon('pin', scheme.accent)}<span>${escapeHtml(activity.location)}</span></div>
      </div>
      <div class="bottom">
        <div class="cta">დარეგისტრირდი ახლავე<small>დაასკანერე QR კოდი ტელეფონით</small></div>
        ${qrCard(qrCodeUrl, scheme)}
      </div>
    </div>`;

  return documentShell({ title: activity.title, scheme, css, body });
}

/**
 * Variation 2 — a saturated header block carrying the title, over a dark panel
 * that splits the details and the QR into two columns.
 */
function splitTemplate(activity, scheme, qrCodeUrl) {
  const size = titleSize(activity.title, { max: 80, min: 40 });
  const css = `
  .head {
    position: relative; height: 430px; padding: 62px 60px;
    background: linear-gradient(135deg, ${scheme.primary} 0%, ${scheme.glow} 100%);
    display: flex; flex-direction: column; justify-content: center;
    overflow: hidden;
  }
  .head::after {
    content: ''; position: absolute; right: -110px; top: -110px;
    width: 420px; height: 420px; border-radius: 50%;
    background: rgba(255,255,255,.13);
  }
  .kicker {
    position: relative; z-index: 1;
    font-size: 17px; letter-spacing: .34em; text-transform: uppercase;
    color: rgba(255,255,255,.9); margin-bottom: 20px; font-weight: 700;
  }
  .title {
    position: relative; z-index: 1;
    font-size: ${size}px; font-weight: 900; line-height: 1.04;
    letter-spacing: -.02em; color: #ffffff;
    text-shadow: 0 4px 22px rgba(0,0,0,.28);
  }
  .notch {
    position: absolute; left: 60px; bottom: -26px; z-index: 2;
    width: 96px; height: 52px; border-radius: 12px;
    background: ${scheme.accent};
  }
  .body { position: relative; padding: 84px 60px 0; display: flex; gap: 44px; }
  .details { flex: 1; display: flex; flex-direction: column; gap: 30px; }
  .row { display: flex; align-items: center; gap: 20px; }
  .row-icon {
    width: 62px; height: 62px; flex: none; border-radius: 18px;
    background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14);
    display: flex; align-items: center; justify-content: center;
  }
  .row-label {
    font-size: 14px; letter-spacing: .2em; text-transform: uppercase;
    color: rgba(255,255,255,.45); margin-bottom: 5px;
  }
  .row-value { font-size: 27px; font-weight: 700; line-height: 1.2; }
  .qr-col { display: flex; flex-direction: column; align-items: center; gap: 18px; }
  .qr-note {
    font-size: 18px; font-weight: 700; color: ${scheme.accent};
    text-align: center; line-height: 1.35; max-width: 250px;
  }`;

  const body = `    <div class="head">
      <div class="kicker">SkillWill College</div>
      <h1 class="title">${escapeHtml(activity.title)}</h1>
      <div class="notch"></div>
    </div>
    <div class="body">
      <div class="details">
        <div class="row">
          <div class="row-icon">${icon('calendar', scheme.primary, 30)}</div>
          <div>
            <div class="row-label">თარიღი</div>
            <div class="row-value">${escapeHtml(formatDateKa(activity.date))}</div>
          </div>
        </div>
        <div class="row">
          <div class="row-icon">${icon('clock', scheme.primary, 30)}</div>
          <div>
            <div class="row-label">დრო</div>
            <div class="row-value">${escapeHtml(formatTime(activity.time))}</div>
          </div>
        </div>
        <div class="row">
          <div class="row-icon">${icon('pin', scheme.primary, 30)}</div>
          <div>
            <div class="row-label">ადგილი</div>
            <div class="row-value">${escapeHtml(activity.location)}</div>
          </div>
        </div>
      </div>
      <div class="qr-col">
        ${qrCard(qrCodeUrl, scheme, { size: 206, border: 10 })}
        <div class="qr-note">დაასკანერე და დარეგისტრირდი</div>
      </div>
    </div>`;

  return documentShell({ title: activity.title, scheme, css, body });
}

/**
 * Variation 3 — a quiet editorial layout: a vertical accent rule, an offset
 * title, the weekday called out, and a large centred QR.
 */
function editorialTemplate(activity, scheme, qrCodeUrl) {
  const size = titleSize(activity.title, { max: 86, min: 42 });
  const weekday = formatWeekdayKa(activity.date);
  const css = `
  .poster { background: radial-gradient(120% 85% at 50% 0%, ${scheme.glow}22 0%, ${scheme.secondary} 62%); }
  .frame {
    position: absolute; inset: 34px;
    border: 1px solid rgba(255,255,255,.13); border-radius: 6px;
    pointer-events: none;
  }
  .accent {
    position: absolute; left: 62px; top: 120px; bottom: 210px;
    width: 6px; border-radius: 99px;
    background: linear-gradient(180deg, ${scheme.primary} 0%, ${scheme.accent} 100%);
  }
  .content {
    position: relative; z-index: 2;
    padding: 112px 70px 0 100px; height: 100%;
    display: flex; flex-direction: column;
  }
  .kicker {
    font-size: 16px; letter-spacing: .38em; text-transform: uppercase;
    color: ${scheme.primary}; font-weight: 700; margin-bottom: 26px;
  }
  .weekday {
    font-size: 21px; letter-spacing: .16em; text-transform: uppercase;
    color: rgba(255,255,255,.48); margin-bottom: 14px;
  }
  .title {
    font-size: ${size}px; font-weight: 800; line-height: 1.05;
    letter-spacing: -.022em; max-width: 92%;
  }
  .meta { margin-top: 46px; display: flex; flex-direction: column; gap: 18px; }
  .meta-row {
    display: flex; align-items: center; gap: 16px;
    font-size: 25px; font-weight: 500; color: rgba(255,255,255,.9);
    padding-bottom: 18px; border-bottom: 1px solid rgba(255,255,255,.1);
    max-width: 560px;
  }
  .qr-wrap {
    margin-top: auto; margin-bottom: 96px;
    display: flex; flex-direction: column; align-items: center; gap: 20px;
  }
  .cta {
    font-size: 23px; font-weight: 700; color: ${scheme.accent};
    letter-spacing: .04em; text-align: center;
  }`;

  const body = `    <div class="frame"></div>
    <div class="accent"></div>
    <div class="content">
      <div class="kicker">SkillWill College</div>
      ${weekday ? `<div class="weekday">${escapeHtml(weekday)}</div>` : ''}
      <h1 class="title">${escapeHtml(activity.title)}</h1>
      <div class="meta">
        <div class="meta-row">${icon('calendar', scheme.primary)}<span>${escapeHtml(formatDateKa(activity.date))}</span></div>
        <div class="meta-row">${icon('clock', scheme.primary)}<span>${escapeHtml(formatTime(activity.time))}</span></div>
        <div class="meta-row">${icon('pin', scheme.primary)}<span>${escapeHtml(activity.location)}</span></div>
      </div>
      <div class="qr-wrap">
        ${qrCard(qrCodeUrl, scheme, { size: 232, border: 11 })}
        <div class="cta">დაასკანერე • დარეგისტრირდი • მოდი</div>
      </div>
    </div>`;

  return documentShell({ title: activity.title, scheme, css, body });
}

const TEMPLATES = [diagonalTemplate, splitTemplate, editorialTemplate];

/**
 * Render all three template posters for an activity.
 *
 * Pure and synchronous — no network, no API key, no cost.
 */
export function buildTemplatePosters(activity, schemes, qrCodeUrl) {
  return TEMPLATES.map((render, index) => ({
    html: render(activity, schemes[index], qrCodeUrl),
    colorScheme: schemes[index].name,
    variationNumber: index + 1,
    source: 'template',
  }));
}
