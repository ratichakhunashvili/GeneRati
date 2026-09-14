// Render a poster from a user-supplied template image plus a layout.
//
// The background image is embedded as a data URI rather than linked, because
// the finished poster is uploaded to Drive and later downloaded and printed on
// machines that have no access to this app — a linked image would print blank.

import { escapeHtml, formatDateKa, formatTime } from '../format';
import { TEXT_FIELDS, sanitizeLayout } from '../templates';
import { PAGE_FORMAT, POSTER_HEIGHT, POSTER_WIDTH } from './page';

const FONT_STACK =
  "'Segoe UI', 'Noto Sans Georgian', 'BPG Arial', Sylfaen, system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";

/** Percentage of the poster width, as a pixel value on the A4 canvas. */
const px = (percent) => ((Number(percent) / 100) * POSTER_WIDTH).toFixed(1);

/** Build the CSS for one text box. */
function fieldStyle(field) {
  return [
    'position:absolute',
    `left:${field.x}%`,
    `top:${field.y}%`,
    `width:${field.w}%`,
    `font-size:${px(field.size)}px`,
    `line-height:${field.lineHeight}`,
    `color:${field.color}`,
    `text-align:${field.align}`,
    `font-weight:${field.weight}`,
    field.uppercase ? 'text-transform:uppercase' : 'text-transform:none',
    field.shadow ? 'text-shadow:0 3px 14px rgba(0,0,0,.55)' : 'text-shadow:none',
    'margin:0',
    'overflow-wrap:anywhere',
  ].join(';');
}

/**
 * Compose one poster.
 *
 * @param {object}  args
 * @param {object}  args.activity       title / date / time / location
 * @param {object}  args.template       name + layout
 * @param {string}  args.imageDataUri   the background, already base64-encoded
 * @param {?string} args.qrCodeUrl      QR data URI, or null to omit the QR
 */
export function buildPosterFromTemplate({ activity, template, imageDataUri, qrCodeUrl }) {
  const layout = sanitizeLayout(template.layout);

  const values = {
    title: activity.title,
    date: formatDateKa(activity.date),
    time: formatTime(activity.time),
    location: activity.location,
  };

  const textLayers = TEXT_FIELDS.map(({ key }) => {
    // Switched off because the design already carries it — commonly the title,
    // which is part of the artwork on a template made for a recurring event.
    if (layout[key].show === false) return '';
    const value = String(values[key] ?? '').trim();
    if (!value) return '';
    return `      <p class="f" style="${fieldStyle(layout[key])}">${escapeHtml(value)}</p>`;
  })
    .filter(Boolean)
    .join('\n');

  const q = layout.qr;
  const qrLayer =
    q.show && qrCodeUrl
      ? `      <div class="qr" style="left:${q.x}%;top:${q.y}%;width:${q.size}%;background:${q.bg};padding:${px(q.padding)}px;border-radius:${px(q.radius)}px;${
          q.border > 0 ? `border:${px(q.border)}px solid ${q.borderColor};` : ''
        }">
        <img src="${escapeHtml(qrCodeUrl)}" alt="რეგისტრაციის QR კოდი" />
      </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="ka">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(activity.title)} — SkillWill College</title>
<style>
  @page { size: ${PAGE_FORMAT}; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    background: #454b54;
    font-family: ${FONT_STACK};
    -webkit-font-smoothing: antialiased;
  }
  body { display: flex; justify-content: center; padding: 24px; }
  .poster {
    position: relative;
    width: ${POSTER_WIDTH}px;
    height: ${POSTER_HEIGHT}px;
    /* Stop the poster shrinking as a flex item in a narrow window. */
    flex: none;
    overflow: hidden;
    background: #000;
    box-shadow: 0 24px 70px rgba(0,0,0,.45);
    /* Without this, browsers drop background artwork when printing. */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .bg {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }
  .f { position: absolute; z-index: 2; }
  .qr {
    position: absolute; z-index: 2;
    line-height: 0;
    box-shadow: 0 10px 30px rgba(0,0,0,.35);
  }
  .qr img { display: block; width: 100%; height: auto; }
  @media print {
    html, body { background: #fff; padding: 0; }
    body { display: block; }
    .poster { box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="poster">
      <img class="bg" src="${imageDataUri}" alt="" />
${textLayers}
${qrLayer}
  </div>
</body>
</html>`;
}
