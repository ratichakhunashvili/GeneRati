'use client';

// Client-side image normalisation.
//
// Every generated poster embeds its background image as a base64 data URI, so
// the stored image has to be small. Rather than reject big uploads, the browser
// redraws whatever is dropped in at a fixed A4 size before it is ever sent —
// which also means a 4000px Canva export and a 900px screenshot end up
// identical to the rest of the app.

import { POSTER_WIDTH, STORED_HEIGHT, STORED_WIDTH } from './templates';

const A4_RATIO = STORED_WIDTH / STORED_HEIGHT;

/**
 * Size to aim for when an image must be re-encoded.
 *
 * Base64 inflates by a third, so ~3 MB here becomes ~4 MB inside a generated
 * poster, which Drive and the preview both handle comfortably.
 */
const TARGET_BYTES = 3_000_000;

/**
 * An upload this size or smaller is stored exactly as supplied.
 *
 * Re-encoding is lossy and downscaling is destructive, and the whole point of a
 * template is that the printed poster is the user's design and nothing else. So
 * an image that is already the right shape and a reasonable weight is kept
 * byte-for-byte rather than "improved".
 */
const KEEP_ORIGINAL_MAX_BYTES = 8 * 1024 * 1024;

/** How far from the page ratio an image may stray and still be kept as-is. */
const RATIO_TOLERANCE = 0.01;

/** Read a File unchanged into a data URI. */
function fileToDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.readAsDataURL(file);
  });
}

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

  const ratio = sourceWidth / sourceHeight;
  const ratioDrift = Math.abs(ratio / A4_RATIO - 1);

  /*
    Preferred path: the upload is already the right shape, big enough to print
    and small enough to carry, so it is stored exactly as supplied. No crop, no
    resample, no re-encode — the printed poster is byte-for-byte the design that
    was handed over.
  */
  const keepAsIs =
    ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) &&
    ratioDrift <= RATIO_TOLERANCE &&
    file.size <= KEEP_ORIGINAL_MAX_BYTES &&
    sourceWidth >= POSTER_WIDTH;

  if (keepAsIs) {
    const dataUri = await fileToDataUri(file);
    if (typeof source.close === 'function') source.close();
    return {
      dataUri,
      bytes: file.size,
      sourceWidth,
      sourceHeight,
      croppedPercent: 0,
      untouched: true,
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = STORED_WIDTH;
  canvas.height = STORED_HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  // A JPEG has no alpha; fill first so any transparency lands on white, not black.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, STORED_WIDTH, STORED_HEIGHT);

  // Cover fit: fill the whole page canvas, cropping the overflowing axis evenly.
  const sourceRatio = ratio;
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

  // Lossless first. A poster design is usually flat colour and hard edges,
  // which PNG both compresses well and reproduces exactly.
  const png = await toDataUrl(canvas, 'image/png');
  let best = png;

  if (!best || best.bytes > TARGET_BYTES) {
    /*
      Too big to keep lossless. Step the JPEG quality down, but stop at 0.85:
      below that, flat colour areas band and hard edges ring, which is visible
      on a printed A3 sheet. Carrying a larger file is the better trade.
    */
    for (const quality of [0.95, 0.9, 0.85]) {
      const candidate = await toDataUrl(canvas, 'image/jpeg', quality);
      if (!candidate) continue;
      if (!best || candidate.bytes < best.bytes) best = candidate;
      if (candidate.bytes <= TARGET_BYTES) break;
    }
  }

  if (!best) throw new Error('The image could not be processed in this browser.');

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
    untouched: false,
  };
}

/** Human-readable file size. */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
