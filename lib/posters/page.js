// Page geometry — the single source of truth for what size a poster is.
//
// Everything that renders or previews a poster derives its dimensions from
// here, so changing paper size is a change to this file rather than a hunt
// through templates, editors and previews.

/** The paper size used in the CSS @page rule. */
export const PAGE_FORMAT = 'A3';

/**
 * A3 portrait at 96dpi.
 *
 * 297 × 420 mm ÷ 25.4 × 96 = 1122.5 × 1587.4, rounded to whole pixels.
 */
export const POSTER_WIDTH = 1123;
export const POSTER_HEIGHT = 1587;

/**
 * The coordinate system the three built-in designs are authored in.
 *
 * They were drawn against A4, and every ISO paper size shares the same √2
 * aspect ratio, so the whole design scales up to A3 uniformly instead of
 * needing new numbers for every padding and font size. The designs stay
 * readable in one coordinate space and the scale below does the conversion.
 */
export const DESIGN_WIDTH = 794;
export const DESIGN_HEIGHT = 1123;

/**
 * Scale from the design space to the page.
 *
 * X and Y differ by about 0.08% because both sizes are rounded to whole
 * pixels; scaling each axis independently avoids a hairline gap at the edge
 * that a single uniform factor would leave.
 */
export const DESIGN_SCALE_X = POSTER_WIDTH / DESIGN_WIDTH;
export const DESIGN_SCALE_Y = POSTER_HEIGHT / DESIGN_HEIGHT;

/**
 * Size an uploaded template image is resized to when it has to be resized.
 *
 * 2× the page is ~192dpi, which prints cleanly. A well-prepared upload is kept
 * byte-for-byte instead and never reaches this path — see normaliseTemplateImage.
 */
export const STORED_WIDTH = POSTER_WIDTH * 2;
export const STORED_HEIGHT = POSTER_HEIGHT * 2;

/** Aspect ratio string for CSS `aspect-ratio`. */
export const ASPECT_RATIO = `${POSTER_WIDTH} / ${POSTER_HEIGHT}`;
