'use client';

// Client-side image normalisation.
//
// Every generated poster embeds its background image as a base64 data URI, so
// the stored image has to be small. Rather than reject big uploads, the browser
// redraws whatever is dropped in at a fixed A4 size before it is ever sent —
// which also means a 4000px Canva export and a 900px screenshot end up
// identical to the rest of the app.

import { STORED_HEIGHT, STORED_WIDTH } from './templates';

const A4_RATIO = STORED_WIDTH / STORED_HEIGHT;

/**
 * Size to aim for after re-encoding.
 *
 * Base64 inflates by a third, so ~1.2 MB here becomes ~1.6 MB inside every
 * generated poster — small enough to upload to Drive and preview comfortably.
 */
const TARGET_BYTES = 1_200_000;

/** Read a File into an ImageBitmap, falling back for older browsers. */
async function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* Fall through to the <img> path below. */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('That file could not be read as an image.'));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

function toDataUrl(canvas, type, quality) {
  return new Promise((resolve) => {
    // toBlob keeps large images off the main thread better than toDataURL.
    canvas.toBlob(
      (blob) => {
        if (!blob) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve({ dataUri: reader.result, bytes: blob.size });
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      },
      type,
      quality,
    );
  });
}

/**
 * Normalise an uploaded image to an A4 background.
 *
 * Non-A4 images are cover-fitted and centre-cropped, and the result says how
 * much was trimmed so the caller can warn rather than silently cut someone's
 * design in half.
 *
 * Encodes as both JPEG and PNG and keeps the smaller: flat-colour poster
 * designs often compress far better as PNG, while photographic ones do not.
 */
export async function normaliseTemplateImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (PNG, JPEG or WebP).');
  }

  const source = await loadImage(file);
  const sourceWidth = source.width;
  const sourceHeight = source.height;
  if (!sourceWidth || !sourceHeight) throw new Error('That image appears to be empty.');

  const canvas = document.createElement('canvas');
  canvas.width = STORED_WIDTH;
  canvas.height = STORED_HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  // A JPEG has no alpha; fill first so any transparency lands on white, not black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, STORED_WIDTH, STORED_HEIGHT);

  // Cover fit: fill the whole A4 canvas, cropping the overflowing axis evenly.
  const sourceRatio = sourceWidth / sourceHeight;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (sourceRatio > A4_RATIO) {
    sw = Math.round(sourceHeight * A4_RATIO);
    sx = Math.round((sourceWidth - sw) / 2);
  } else if (sourceRatio < A4_RATIO) {
    sh = Math.round(sourceWidth / A4_RATIO);
    sy = Math.round((sourceHeight - sh) / 2);
  }

  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, STORED_WIDTH, STORED_HEIGHT);
  if (typeof source.close === 'function') source.close();

  const [jpeg, png] = await Promise.all([
    toDataUrl(canvas, 'image/jpeg', 0.92),
    toDataUrl(canvas, 'image/png'),
  ]);

  let best = [jpeg, png].filter(Boolean).sort((a, b) => a.bytes - b.bytes)[0];
  if (!best) throw new Error('The image could not be processed in this browser.');

  /*
    Every generated poster embeds this image, so its size is paid again on each
    upload to Drive and each preview in the browser. Step the JPEG quality down
    until it is comfortably small; a poster background is a photo-like image, so
    the visible difference is negligible next to the cost of carrying megabytes
    around.
  */
  for (const quality of [0.82, 0.7, 0.58]) {
    if (best.bytes <= TARGET_BYTES) break;
    const smaller = await toDataUrl(canvas, 'image/jpeg', quality);
    if (smaller && smaller.bytes < best.bytes) best = smaller;
  }

  // How far the source strayed from A4, as a percentage of the cropped axis.
  const croppedPercent = Math.round(
    (1 - Math.min(sourceRatio, A4_RATIO) / Math.max(sourceRatio, A4_RATIO)) * 100,
  );

  return {
    dataUri: best.dataUri,
    bytes: best.bytes,
    sourceWidth,
    sourceHeight,
    croppedPercent,
  };
}

/** Human-readable file size. */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
