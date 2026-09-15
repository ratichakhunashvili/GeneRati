// Wrap a generated poster image into a printable document.
//
// FLUX draws the poster itself — title, date, time, location, artwork, layout.
// Only two things are added here, and both are added because they cannot be
// generated correctly:
//
//   QR code      — has to be machine-readable, so it must be a real QR image
//                  rather than a picture of one.
//   College name — the model spelled it "SAILLWILL" and "SKILLIWILL" in testing,
//                  and rendered it three times in one poster.
//
// Both sit on their own solid backing rather than relying on the model having
// left clean space, because it frequently does not. The prompt asks for an
// uncluttered bottom strip, but the layout below is correct either way.
//
// The image is embedded as a data URI, not linked: the finished file is uploaded
// to Drive and opened later on machines that cannot reach this app, where a
// linked image would print blank.

import { escapeHtml } from '../format';
import { PAGE_FORMAT, POSTER_HEIGHT, POSTER_WIDTH } from './page';

const FONT_STACK =
  "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif";

const ORGANIZER = 'SkillWill College';

/**
 * Compose one poster.
 *
 * @param {object}  args
 * @param {object}  args.activity      title / date / time / location
 * @param {string}  args.imageDataUri  the generated poster, base64-encoded
 * @param {?string} args.qrCodeUrl     QR data URI, or null to omit the QR
 */
export function composePoster({ activity, imageDataUri, qrCodeUrl }) {
  const qrLayer = qrCodeUrl
    ? `    <div class="qr"><img src="${escapeHtml(qrCodeUrl)}" alt="Registration QR code" /></div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(activity.title)} — ${ORGANIZER}</title>
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
  .art {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    /* The render is 0.700 and the page is 0.708, so cover crops well under a
       percent off the top and bottom rather than letterboxing. */
    object-fit: cover;
    display: block;
  }
  /* A gradient so the two overlays below stay readable whatever the model put
     at the foot of the poster. */
  .foot {
    position: absolute; left: 0; right: 0; bottom: 0;
    height: 17%;
    background: linear-gradient(to top, rgba(0,0,0,.82), rgba(0,0,0,0));
    z-index: 1;
  }
  .org {
    position: absolute; z-index: 2;
    left: 5.5%; bottom: 4.5%;
    color: #fff;
    font-size: ${(POSTER_WIDTH * 0.028).toFixed(1)}px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    text-shadow: 0 2px 10px rgba(0,0,0,.6);
  }
  .qr {
    position: absolute; z-index: 2;
    right: 5.5%; bottom: 4%;
    width: 17%;
    background: #fff;
    padding: ${(POSTER_WIDTH * 0.012).toFixed(1)}px;
    border-radius: ${(POSTER_WIDTH * 0.014).toFixed(1)}px;
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
    <img class="art" src="${imageDataUri}" alt="${escapeHtml(activity.title)} poster" />
    <div class="foot"></div>
    <div class="org">${escapeHtml(ORGANIZER)}</div>
${qrLayer}
  </div>
</body>
</html>`;
}
