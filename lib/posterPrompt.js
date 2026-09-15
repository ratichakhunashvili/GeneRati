// Build the FLUX prompt for an activity's poster.
//
// The only inputs are the activity's own four fields. There is deliberately no
// place for a user-written design brief: the point of this feature is that you
// fill in an activity and get a poster, with nothing else to think about.
//
// Everything here was shaped by measurement rather than taste. Four test renders
// established that FLUX.1-schnell:
//
//   * renders a HEADLINE reliably (3 of 4 perfect)
//   * gets dates wrong most of the time, and mangles numeric dates worst of all
//     ("15.10.2026" came back as "15.NO.2026")
//   * of the formats tried, "OCTOBER 15, 2026" was the only one it reproduced
//     correctly, so that is the format used below
//   * duplicates text blocks when asked for many separate lines, so the prompt
//     names each line once and explicitly forbids repeats
//
// This file is imported by client components, so it must stay free of secrets
// and server-only imports.

import { getActivityKind } from './posters/activities';

const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

/**
 * Scene per activity kind, keyed by the motif ids in posters/activities.js.
 *
 * People are avoided throughout: faces and crowds are where this model fails
 * most visibly, and a poster reads better on a strong empty setting anyway.
 */
const SCENES = {
  football: 'a floodlit football stadium at night, empty pitch, dramatic light beams, deep green and gold',
  volleyball: 'an indoor volleyball court lit from the side, net in silhouette, warm wood floor, deep blue shadows',
  basketball: 'a dramatic indoor basketball arena, polished floor reflections, hoop lit from above, orange and deep navy',
  tennis: 'a tennis court from above at golden hour, long net shadow, lime green court and chalk white lines',
  padel: 'a glass-walled padel court lit from outside at dusk, reflections in the glass, teal and warm amber',
  tabletennis: 'a table tennis table under a single overhead lamp in a dark hall, deep red and white',
  running: 'a running track curving away at sunrise, mist over the lanes, red track against a cold blue sky',
  swimming: 'a swimming pool from directly above, lane ropes and rippling light caustics, turquoise water',
  chess: 'a chessboard lit hard from one side in a dark room, long piece shadows, ivory and deep charcoal',
  darts: 'a dartboard under a single spotlight in a dark room, deep red and black, dramatic falloff',
  billiards: 'a billiards table under a low hanging lamp, green baize glowing, dark surrounding room',
  boardgames: 'board game pieces, dice and cards on a dark table under warm lamp light, rich jewel colours',
  esports: 'a dark gaming setup lit by monitors and RGB strips, neon magenta and cyan on deep black',
  quiz: 'a dark stage with a spotlit podium and floating question mark shapes, deep purple and gold',
  mystery: 'a moonlit forest clearing in fog, silhouetted pines, deep indigo night, one shaft of cold light',
  party: 'confetti and streamers frozen in mid-air on a dark background, colourful bokeh lights',
  movie: 'a glowing cinema screen in a dark auditorium, dust in the projector beam, deep red seats',
  hackathon: 'abstract flowing code and circuit patterns on a dark background, glowing cyan and violet data lines',
  debate: 'two empty lecterns facing each other on a dark stage under hard spotlights, deep blue and warm white',
  academic: 'an old library reading room in warm evening light, tall shelves receding into shadow, amber and brown',
  generic: 'bold overlapping geometric shapes under dramatic directional light, rich contrasting colour',
};

/**
 * Design treatments, rotated between renders.
 *
 * Re-rolling is expected here — the user checks each poster and regenerates the
 * ones whose date came out wrong — so consecutive attempts must not look the
 * same, or a re-roll feels broken. A fresh seed alone changes the picture but
 * not the composition; changing the treatment changes the poster.
 */
const TREATMENTS = [
  'bold modern sports poster design, huge condensed uppercase title across the top, high contrast',
  'elegant minimal poster design, generous empty space, refined thin typography, centred composition',
  'dynamic diagonal poster design, angled colour bands behind the title, energetic and loud',
  'premium cinematic poster design, deep shadows, dramatic single light source, restrained palette',
  'clean editorial poster design, strong horizontal rules, precise grid, confident sans-serif type',
];

/** "OCTOBER 15, 2026" — the one date format FLUX reproduced correctly in testing. */
export function formatPosterDate(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate ?? '').trim());
  if (!match) return String(isoDate ?? '').toUpperCase();
  const [, year, month, day] = match;
  const name = MONTHS[Number(month) - 1];
  if (!name) return String(isoDate).toUpperCase();
  return `${name} ${Number(day)}, ${year}`;
}

/** "17:30" — already unambiguous, and the model reproduced it every time. */
function formatPosterTime(time) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(time ?? '').trim());
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : String(time ?? '').trim();
}

/**
 * Strip anything that would confuse the model's text rendering.
 *
 * Quotes especially: the prompt delimits each literal string with quotes, so a
 * quote inside a title would end the string early and the rest would be read as
 * a design instruction.
 */
function clean(value, max = 70) {
  return String(value ?? '')
    .replace(/["“”'’`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * Build the prompt for one poster.
 *
 * @param {object} activity        title / date / time / location
 * @param {number} [variation]     which treatment to use; random when omitted
 */
export function buildPosterPrompt(activity, variation) {
  const kind = getActivityKind(activity?.title);
  const scene = SCENES[kind.id] ?? SCENES.generic;
  const treatment =
    TREATMENTS[
      Number.isInteger(variation)
        ? variation % TREATMENTS.length
        : Math.floor(Math.random() * TREATMENTS.length)
    ];

  const title = clean(activity?.title).toUpperCase();
  const date = formatPosterDate(activity?.date);
  const time = formatPosterTime(activity?.time);
  const location = clean(activity?.location, 40).toUpperCase();

  // One line per element, each named once. Asking for the lines as a single
  // ordered block is what stopped the model rendering three drifting copies of
  // the same string.
  return [
    `A professional event poster, vertical portrait format. ${treatment}.`,
    `The poster shows exactly four pieces of text and nothing else:`,
    `the title "${title}" in very large bold letters at the top,`,
    `then "${date}", then "${time}", then "${location}" in smaller clear text below it.`,
    `Each of those appears once only, spelled exactly as written, no repeated or duplicated text.`,
    `Background: ${scene}.`,
    `Leave the bottom strip of the poster uncluttered and free of text.`,
    `Sharp legible lettering, clean sans-serif typography, professional print quality.`,
  ].join(' ');
}

/** What the poster claims, so the UI can show it next to the image for checking. */
export function expectedPosterText(activity) {
  return {
    title: clean(activity?.title).toUpperCase(),
    date: formatPosterDate(activity?.date),
    time: formatPosterTime(activity?.time),
    location: clean(activity?.location, 40).toUpperCase(),
  };
}
