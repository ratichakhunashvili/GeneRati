// Activity recognition.
//
// The title is matched against keyword tables to work out what the event
// actually is, and each recognised kind carries its own colour identity and its
// own artwork motif. This is what makes a football poster look like football
// rather than "generic sports poster, green variant".
//
// Matching runs top to bottom and stops at the first hit, so more specific
// entries must come before the general ones they contain — "table tennis"
// before "tennis", "მაგიდის ჩოგბურთი" before "ჩოგბურთი".

/**
 * @typedef {object} ActivityKind
 * @property {string} id        Motif id, looked up in artwork.js
 * @property {string} label     Human-readable, shown in the dashboard
 * @property {string[]} keywords Lowercase substrings, English and Georgian
 * @property {object} palette   primary / accent / glow / dark
 */

/** @type {ActivityKind[]} */
const KINDS = [
  {
    id: 'football',
    label: 'Football',
    keywords: ['football', 'soccer', 'futsal', 'ფეხბურთ', 'მინი ფეხბურთ'],
    palette: { primary: '#22c55e', accent: '#f0fdf4', glow: '#15803d', dark: '#04140a' },
  },
  {
    id: 'volleyball',
    label: 'Volleyball',
    keywords: ['volleyball', 'beach volley', 'ფრენბურთ', 'ვოლეიბოლ'],
    palette: { primary: '#38bdf8', accent: '#fde68a', glow: '#0369a1', dark: '#04182a' },
  },
  {
    id: 'basketball',
    label: 'Basketball',
    keywords: ['basketball', 'streetball', '3x3', 'კალათბურთ', 'ბასკეტბოლ'],
    palette: { primary: '#f97316', accent: '#ffedd5', glow: '#c2410c', dark: '#190a02' },
  },
  {
    id: 'tabletennis',
    label: 'Table tennis',
    keywords: ['table tennis', 'ping pong', 'pingpong', 'მაგიდის ჩოგბურთ', 'პინგ პონგ'],
    palette: { primary: '#f43f5e', accent: '#ffe4e6', glow: '#9f1239', dark: '#16050b' },
  },
  {
    id: 'padel',
    label: 'Padel',
    keywords: ['padel', 'პადელ'],
    palette: { primary: '#14b8a6', accent: '#ccfbf1', glow: '#0f766e', dark: '#031a18' },
  },
  {
    id: 'tennis',
    label: 'Tennis',
    keywords: ['tennis', 'ჩოგბურთ'],
    palette: { primary: '#a3e635', accent: '#f7fee7', glow: '#4d7c0f', dark: '#0c1505' },
  },
  {
    id: 'running',
    label: 'Running',
    keywords: ['running', 'marathon', 'sprint', 'race', 'cross country', 'სირბილ', 'მარათონ', 'კროს'],
    palette: { primary: '#ef4444', accent: '#fee2e2', glow: '#b91c1c', dark: '#170404' },
  },
  {
    id: 'swimming',
    label: 'Swimming',
    keywords: ['swimming', 'swim', 'pool', 'ცურვ', 'საცურაო'],
    palette: { primary: '#06b6d4', accent: '#cffafe', glow: '#0e7490', dark: '#031a21' },
  },
  {
    id: 'chess',
    label: 'Chess',
    keywords: ['chess', 'ჭადრაკ'],
    palette: { primary: '#d4af37', accent: '#fafaf9', glow: '#a16207', dark: '#0b0a09' },
  },
  {
    id: 'darts',
    label: 'Darts',
    keywords: ['darts', 'dart', 'დარტს', 'ისრებ'],
    palette: { primary: '#dc2626', accent: '#fef2f2', glow: '#7f1d1d', dark: '#120303' },
  },
  {
    id: 'billiards',
    label: 'Billiards',
    keywords: ['billiards', 'billiard', 'pool table', 'snooker', 'ბილიარდ'],
    palette: { primary: '#16a34a', accent: '#fef3c7', glow: '#14532d', dark: '#05160b' },
  },
  {
    id: 'esports',
    label: 'Esports',
    keywords: ['esports', 'e-sports', 'gaming', 'playstation', 'fifa', 'tekken', 'counter', 'dota', 'ესპორტ', 'გეიმინგ'],
    palette: { primary: '#8b5cf6', accent: '#22d3ee', glow: '#6d28d9', dark: '#0a0518' },
  },
  {
    id: 'boardgames',
    label: 'Board games',
    keywords: ['board game', 'boardgame', 'monopoly', 'domino', 'cards', 'poker', 'uno', 'სამაგიდო', 'კარტ', 'დომინო'],
    palette: { primary: '#f59e0b', accent: '#fffbeb', glow: '#b45309', dark: '#170f04' },
  },
  {
    id: 'quiz',
    label: 'Quiz',
    keywords: ['quiz', 'trivia', 'jeopardy', 'ვიქტორინა', 'ქვიზ', 'კითხვა-პასუხ'],
    palette: { primary: '#a855f7', accent: '#f3e8ff', glow: '#7e22ce', dark: '#100522' },
  },
  {
    id: 'mystery',
    label: 'Mystery night',
    keywords: ['werewolf', 'mafia', 'mystery', 'escape', 'halloween', 'horror', 'მგელ', 'მაფია', 'საიდუმლო', 'ჰელოუინ'],
    palette: { primary: '#7c3aed', accent: '#e9d5ff', glow: '#4c1d95', dark: '#0b0417' },
  },
  {
    id: 'party',
    label: 'Party',
    keywords: ['party', 'disco', 'karaoke', 'concert', 'dance', 'festival', 'prom', 'წვეულებ', 'დისკო', 'კარაოკე', 'კონცერტ', 'ცეკვ', 'ფესტივალ'],
    palette: { primary: '#ec4899', accent: '#22d3ee', glow: '#be185d', dark: '#13041a' },
  },
  {
    id: 'movie',
    label: 'Movie night',
    keywords: ['movie', 'cinema', 'film', 'screening', 'ფილმ', 'კინო', 'ჩვენებ'],
    palette: { primary: '#fbbf24', accent: '#fef3c7', glow: '#b45309', dark: '#0a0a0a' },
  },
  {
    id: 'hackathon',
    label: 'Hackathon',
    keywords: ['hackathon', 'coding', 'programming', 'datathon', 'ჰაკათონ', 'პროგრამირებ', 'კოდინგ'],
    palette: { primary: '#22d3ee', accent: '#a7f3d0', glow: '#0891b2', dark: '#031317' },
  },
  {
    id: 'debate',
    label: 'Debate',
    keywords: ['debate', 'debating', 'model un', 'დებატ'],
    palette: { primary: '#fb7185', accent: '#ffe4e6', glow: '#9f1239', dark: '#0f0812' },
  },
  {
    id: 'academic',
    label: 'Workshop',
    keywords: [
      'workshop', 'seminar', 'lecture', 'masterclass', 'training', 'course', 'conference',
      'meetup', 'career', 'olympiad', 'exam', 'orientation', 'open day',
      'ვორქშოპ', 'სემინარ', 'ლექცია', 'ტრენინგ', 'კურს', 'კონფერენც', 'ოლიმპიად',
      'შეხვედრ', 'კარიერ', 'გამოცდ',
    ],
    palette: { primary: '#6366f1', accent: '#e0e7ff', glow: '#4338ca', dark: '#080c24' },
  },
];

/** Used when nothing matches — a neutral college-blue identity. */
const DEFAULT_KIND = {
  id: 'generic',
  label: 'Activity',
  keywords: [],
  palette: { primary: '#3b82f6', accent: '#dbeafe', glow: '#1d4ed8', dark: '#050f24' },
};

/**
 * Work out what an activity is from its title.
 *
 * Always returns a usable kind — an unrecognised title gets the generic
 * identity rather than no artwork at all.
 */
export function getActivityKind(title) {
  const text = String(title ?? '').toLowerCase();
  for (const kind of KINDS) {
    if (kind.keywords.some((word) => text.includes(word))) return kind;
  }
  return DEFAULT_KIND;
}

/** Every recognised kind, for documentation and tests. */
export function allKinds() {
  return [...KINDS, DEFAULT_KIND];
}
