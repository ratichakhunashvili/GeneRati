// Colour schemes and activity-type detection, shared by the offline template
// renderer and the optional AI generator so both paths produce a consistent
// visual family for the same activity.

export const COLOR_SCHEMES = {
  sports: [
    { name: 'Stadium Green', primary: '#31d843', accent: '#eaffef', secondary: '#07160b', glow: '#10b981' },
    { name: 'Court Blue', primary: '#2680ff', accent: '#ffd23f', secondary: '#04142f', glow: '#1d4ed8' },
    { name: 'Padel Cyan', primary: '#17c3d6', accent: '#e6fbff', secondary: '#052630', glow: '#0891b2' },
  ],
  games: [
    { name: 'Dart Red', primary: '#e83f3f', accent: '#ffe8e8', secondary: '#180505', glow: '#b91c1c' },
    { name: 'Table Green', primary: '#1fa35c', accent: '#ecdfc2', secondary: '#07180f', glow: '#15803d' },
    { name: 'Tabletop Orange', primary: '#f08c1e', accent: '#ffdf9e', secondary: '#2a1708', glow: '#c2410c' },
  ],
  themed: [
    { name: 'Moonlit Purple', primary: '#9b5ce6', accent: '#e8c477', secondary: '#150a26', glow: '#7c3aed' },
    { name: 'Midnight Gold', primary: '#d4af37', accent: '#f7ecc4', secondary: '#0c0c0c', glow: '#a16207' },
    { name: 'Neon Violet', primary: '#c026ff', accent: '#22e5ff', secondary: '#0f0024', glow: '#9333ea' },
  ],
  academic: [
    { name: 'Scholar Indigo', primary: '#6366f1', accent: '#e0e7ff', secondary: '#0b0f2b', glow: '#4338ca' },
    { name: 'Lecture Teal', primary: '#14b8a6', accent: '#dffbf5', secondary: '#04211f', glow: '#0f766e' },
    { name: 'Archive Amber', primary: '#f59e0b', accent: '#fff2d6', secondary: '#1f1403', glow: '#b45309' },
  ],
};

// Keyword tables in both English and Georgian. Matching is substring-based, so
// a Georgian stem such as "ფეხბურთ" covers every case ending of the word.
const KEYWORDS = {
  sports: [
    'football', 'soccer', 'volleyball', 'padel', 'basketball', 'tennis', 'futsal',
    'running', 'marathon', 'swimming', 'fitness', 'gym', 'tournament', 'match', 'cup',
    'ფეხბურთ', 'ფრენბურთ', 'პადელ', 'კალათბურთ', 'ჩოგბურთ', 'სირბილ', 'ცურვ',
    'ტურნირ', 'შეჯიბრ', 'სპორტ',
  ],
  games: [
    'darts', 'billiards', 'pool', 'board game', 'boardgame', 'chess', 'cards', 'poker',
    'domino', 'puzzle', 'quiz', 'trivia', 'esports', 'gaming', 'playstation', 'tekken',
    'დარტს', 'ბილიარდ', 'სამაგიდო', 'ჭადრაკ', 'კარტ', 'ვიქტორინა', 'თამაშ', 'ქვიზ',
  ],
  themed: [
    'werewolf', 'mafia', 'mystery', 'escape', 'halloween', 'party', 'karaoke', 'movie',
    'cinema', 'concert', 'costume', 'disco', 'night',
    'მგელ', 'მაფია', 'საიდუმლო', 'ჰელოუინ', 'წვეულებ', 'კარაოკე', 'ფილმ', 'კინო',
    'კონცერტ', 'ღამ',
  ],
  academic: [
    'workshop', 'seminar', 'lecture', 'masterclass', 'training', 'course', 'hackathon',
    'conference', 'meetup', 'career', 'debate', 'olympiad',
    'ვორქშოპ', 'სემინარ', 'ლექცია', 'ტრენინგ', 'კურს', 'ჰაკათონ', 'კონფერენც',
    'დებატ', 'ოლიმპიად', 'შეხვედრ',
  ],
};

/**
 * Guess an activity category from its title.
 *
 * Falls back to 'sports' to match the palette the college used before this
 * table existed; an unmatched title still gets a usable poster.
 */
export function getActivityType(title) {
  const text = String(title ?? '').toLowerCase();
  for (const type of ['sports', 'games', 'themed', 'academic']) {
    if (KEYWORDS[type].some((word) => text.includes(word))) return type;
  }
  return 'sports';
}

/** The three schemes used for an activity's three poster variations. */
export function getSchemes(title) {
  return COLOR_SCHEMES[getActivityType(title)];
}
