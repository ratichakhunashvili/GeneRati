// Per-activity artwork.
//
// Every motif supplies two pieces of inline SVG:
//
//   backdrop — full-bleed, drawn faintly behind the whole poster (viewBox is
//              the A4 canvas, 794x1123), e.g. real pitch or court markings.
//   emblem   — a bold focal graphic on a 200x200 square, used as a badge.
//
// Everything is geometry and flat fills: no external images, no icon fonts, no
// web fonts. A poster has to render identically after being downloaded from
// Drive onto a machine that has never seen this app, possibly offline.
//
// Colours come from the palette table in activities.js — never from user input
// — so nothing here needs escaping.

const W = 794;
const H = 1123;

function backdropSvg(body, opacity = 1) {
  return `<svg class="art-backdrop" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><g opacity="${opacity}">${body}</g></svg>`;
}

function emblemSvg(body) {
  return `<svg class="art-emblem" viewBox="0 0 200 200" aria-hidden="true" focusable="false">${body}</svg>`;
}

/** Scatter small dots deterministically, so a poster never changes between runs. */
function dots(count, color, seed = 1, radius = 4) {
  let out = '';
  let n = seed;
  for (let i = 0; i < count; i += 1) {
    // Cheap deterministic PRNG — Math.random() would make posters irreproducible.
    n = (n * 1103515245 + 12345) % 2147483648;
    const x = (n / 2147483648) * W;
    n = (n * 1103515245 + 12345) % 2147483648;
    const y = (n / 2147483648) * H;
    n = (n * 1103515245 + 12345) % 2147483648;
    const r = radius * (0.5 + (n / 2147483648));
    out += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${color}" opacity="0.5"/>`;
  }
  return out;
}

const MOTIFS = {
  // ---- Sports ------------------------------------------------------------
  football: {
    backdrop: (c) => backdropSvg(
      `<g fill="none" stroke="${c.primary}" stroke-width="4">
         <rect x="60" y="150" width="674" height="830" rx="4"/>
         <line x1="60" y1="565" x2="734" y2="565"/>
         <circle cx="397" cy="565" r="130"/>
         <circle cx="397" cy="565" r="10" fill="${c.primary}" stroke="none"/>
         <rect x="220" y="150" width="354" height="150"/>
         <rect x="315" y="150" width="164" height="70"/>
         <rect x="220" y="830" width="354" height="150"/>
         <rect x="315" y="910" width="164" height="70"/>
         <path d="M320 300a90 90 0 0 0 154 0"/>
         <path d="M320 830a90 90 0 0 1 154 0"/>
       </g>`, 0.16),
    emblem: (c) => emblemSvg(
      `<circle cx="100" cy="100" r="86" fill="${c.accent}"/>
       <path d="M100 38l34 25-13 40h-42l-13-40z" fill="${c.dark}"/>
       <path d="M100 38V14M134 63l30-16M121 103l32 26M79 103l-32 26M66 63L36 47" stroke="${c.dark}" stroke-width="9" stroke-linecap="round"/>
       <circle cx="100" cy="100" r="86" fill="none" stroke="${c.dark}" stroke-width="8"/>`),
  },

  volleyball: {
    backdrop: (c) => backdropSvg(
      `<g fill="none" stroke="${c.primary}" stroke-width="4">
         <rect x="70" y="220" width="654" height="690"/>
         <line x1="70" y1="565" x2="724" y2="565"/>
         <line x1="70" y1="450" x2="724" y2="450"/>
         <line x1="70" y1="680" x2="724" y2="680"/>
       </g>
       <g stroke="${c.primary}" stroke-width="2" opacity="0.8">
         ${Array.from({ length: 23 }, (_, i) => `<line x1="${70 + i * 30}" y1="500" x2="${70 + i * 30}" y2="632"/>`).join('')}
         ${Array.from({ length: 6 }, (_, i) => `<line x1="70" y1="${500 + i * 26}" x2="724" y2="${500 + i * 26}"/>`).join('')}
       </g>`, 0.17),
    emblem: (c) => emblemSvg(
      `<circle cx="100" cy="100" r="86" fill="${c.accent}"/>
       <g fill="none" stroke="${c.dark}" stroke-width="9" stroke-linecap="round">
         <path d="M28 72c46-16 96-8 138 26"/>
         <path d="M56 168c18-44 56-78 108-88"/>
         <path d="M150 28c-26 42-32 92-14 140"/>
       </g>
       <circle cx="100" cy="100" r="86" fill="none" stroke="${c.dark}" stroke-width="8"/>`),
  },

  basketball: {
    backdrop: (c) => backdropSvg(
      `<g fill="none" stroke="${c.primary}" stroke-width="4">
         <rect x="60" y="150" width="674" height="830"/>
         <line x1="60" y1="565" x2="734" y2="565"/>
         <circle cx="397" cy="565" r="110"/>
         <rect x="277" y="150" width="240" height="230"/>
         <circle cx="397" cy="380" r="88"/>
         <path d="M120 150v120a277 277 0 0 0 554 0V150"/>
         <rect x="277" y="750" width="240" height="230"/>
         <circle cx="397" cy="750" r="88"/>
       </g>`, 0.16),
    emblem: (c) => emblemSvg(
      `<circle cx="100" cy="100" r="86" fill="${c.primary}"/>
       <g fill="none" stroke="${c.dark}" stroke-width="7">
         <line x1="14" y1="100" x2="186" y2="100"/>
         <line x1="100" y1="14" x2="100" y2="186"/>
         <path d="M38 38c40 40 40 84 0 124"/>
         <path d="M162 38c-40 40-40 84 0 124"/>
       </g>
       <circle cx="100" cy="100" r="86" fill="none" stroke="${c.dark}" stroke-width="8"/>`),
  },

  tennis: {
    backdrop: (c) => backdropSvg(
      `<g fill="none" stroke="${c.primary}" stroke-width="4">
         <rect x="90" y="200" width="614" height="730"/>
         <rect x="160" y="200" width="474" height="730"/>
         <line x1="90" y1="565" x2="704" y2="565"/>
         <line x1="160" y1="400" x2="634" y2="400"/>
         <line x1="160" y1="730" x2="634" y2="730"/>
         <line x1="397" y1="400" x2="397" y2="730"/>
       </g>`, 0.17),
    emblem: (c) => emblemSvg(
      `<ellipse cx="96" cy="76" rx="58" ry="66" fill="none" stroke="${c.accent}" stroke-width="12"/>
       <g stroke="${c.accent}" stroke-width="4" opacity="0.85">
         ${Array.from({ length: 5 }, (_, i) => `<line x1="${56 + i * 20}" y1="18" x2="${56 + i * 20}" y2="134"/>`).join('')}
         ${Array.from({ length: 5 }, (_, i) => `<line x1="40" y1="${38 + i * 20}" x2="152" y2="${38 + i * 20}"/>`).join('')}
       </g>
       <path d="M78 136l-28 50" stroke="${c.accent}" stroke-width="14" stroke-linecap="round"/>
       <circle cx="158" cy="158" r="26" fill="${c.primary}" stroke="${c.accent}" stroke-width="5"/>`),
  },

  padel: {
    backdrop: (c) => backdropSvg(
      `<g fill="none" stroke="${c.primary}" stroke-width="4">
         <rect x="90" y="200" width="614" height="730"/>
         <line x1="90" y1="565" x2="704" y2="565"/>
         <line x1="90" y1="380" x2="704" y2="380"/>
         <line x1="90" y1="750" x2="704" y2="750"/>
         <line x1="397" y1="380" x2="397" y2="750"/>
       </g>
       <g stroke="${c.primary}" stroke-width="2" opacity="0.6">
         ${Array.from({ length: 9 }, (_, i) => `<line x1="${90 + i * 77}" y1="200" x2="${90 + i * 77}" y2="930"/>`).join('')}
       </g>`, 0.16),
    emblem: (c) => emblemSvg(
      `<path d="M100 14c44 0 74 32 74 72s-30 64-74 64-74-24-74-64 30-72 74-72z" fill="${c.primary}" stroke="${c.accent}" stroke-width="7"/>
       <g fill="${c.dark}">
         ${[0, 1, 2].map((r) => [0, 1, 2, 3].map((k) => `<circle cx="${62 + k * 26}" cy="${58 + r * 26}" r="7"/>`).join('')).join('')}
       </g>
       <rect x="88" y="148" width="24" height="44" rx="10" fill="${c.accent}"/>`),
  },

  tabletennis: {
    backdrop: (c) => backdropSvg(
      `<g fill="none" stroke="${c.primary}" stroke-width="4">
         <path d="M140 760L397 330l257 430z"/>
         <line x1="397" y1="330" x2="397" y2="760"/>
         <line x1="215" y1="635" x2="579" y2="635"/>
         <rect x="245" y="600" width="304" height="70"/>
       </g>`, 0.16),
    emblem: (c) => emblemSvg(
      `<ellipse cx="94" cy="80" rx="64" ry="68" fill="${c.primary}" stroke="${c.accent}" stroke-width="7"/>
       <ellipse cx="94" cy="80" rx="44" ry="48" fill="none" stroke="${c.dark}" stroke-width="5" opacity="0.5"/>
       <rect x="82" y="142" width="26" height="50" rx="11" fill="${c.accent}"/>
       <circle cx="164" cy="146" r="24" fill="${c.accent}"/>`),
  },

  running: {
    backdrop: (c) => backdropSvg(
      `<g fill="none" stroke="${c.primary}" stroke-width="5">
         ${Array.from({ length: 7 }, (_, i) => `<path d="M-40 ${300 + i * 62}q397 -150 874 0"/>`).join('')}
       </g>
       <g fill="none" stroke="${c.primary}" stroke-width="5" opacity="0.7">
         ${Array.from({ length: 7 }, (_, i) => `<path d="M-40 ${820 + i * 62}q397 150 874 0"/>`).join('')}
       </g>`, 0.15),
    emblem: (c) => emblemSvg(
      `<circle cx="100" cy="104" r="76" fill="none" stroke="${c.accent}" stroke-width="11"/>
       <path d="M100 104V58" stroke="${c.accent}" stroke-width="11" stroke-linecap="round"/>
       <path d="M100 104l34 24" stroke="${c.primary}" stroke-width="11" stroke-linecap="round"/>
       <rect x="84" y="10" width="32" height="18" rx="7" fill="${c.accent}"/>
       <g stroke="${c.primary}" stroke-width="9" stroke-linecap="round" opacity="0.85">
         <line x1="6" y1="70" x2="36" y2="70"/><line x1="0" y1="104" x2="26" y2="104"/><line x1="6" y1="138" x2="36" y2="138"/>
       </g>`),
  },

  swimming: {
    backdrop: (c) => backdropSvg(
      `<g fill="none" stroke="${c.primary}" stroke-width="6">
         ${Array.from({ length: 9 }, (_, i) => `<path d="M-30 ${230 + i * 84}q99 -46 198 0t198 0t198 0t198 0"/>`).join('')}
       </g>`, 0.17),
    emblem: (c) => emblemSvg(
      `<path d="M100 12c34 46 56 80 56 106a56 56 0 0 1-112 0c0-26 22-60 56-106z" fill="${c.primary}" stroke="${c.accent}" stroke-width="7"/>
       <path d="M62 126q19 -16 38 0t38 0" fill="none" stroke="${c.accent}" stroke-width="8" stroke-linecap="round"/>
       <path d="M62 152q19 -16 38 0t38 0" fill="none" stroke="${c.accent}" stroke-width="8" stroke-linecap="round" opacity="0.6"/>`),
  },

  // ---- Games -------------------------------------------------------------
  chess: {
    backdrop: (c) => {
      let squares = '';
      for (let r = 0; r < 8; r += 1) {
        for (let k = 0; k < 8; k += 1) {
          if ((r + k) % 2 === 0) continue;
          squares += `<rect x="${77 + k * 80}" y="${281 + r * 80}" width="80" height="80" fill="${c.primary}"/>`;
        }
      }
      return backdropSvg(`${squares}<rect x="77" y="281" width="640" height="640" fill="none" stroke="${c.primary}" stroke-width="5"/>`, 0.13);
    },
    emblem: (c) => emblemSvg(
      `<path d="M92 16h16v14h14v16h-14v16h-16V46H78V30h14z" fill="${c.accent}"/>
       <path d="M100 72c26 0 42 16 42 34 0 14-10 22-10 34l8 44H60l8-44c0-12-10-20-10-34 0-18 16-34 42-34z" fill="${c.primary}" stroke="${c.accent}" stroke-width="6"/>
       <rect x="46" y="176" width="108" height="18" rx="7" fill="${c.accent}"/>`),
  },

  darts: {
    backdrop: (c) => {
      const segs = Array.from({ length: 20 }, (_, i) => {
        const a1 = (i * 18 - 9) * (Math.PI / 180);
        const a2 = (i * 18 + 9) * (Math.PI / 180);
        if (i % 2) return '';
        const R = 330;
        return `<path d="M397 500L${(397 + R * Math.cos(a1)).toFixed(0)} ${(500 + R * Math.sin(a1)).toFixed(0)}A${R} ${R} 0 0 1 ${(397 + R * Math.cos(a2)).toFixed(0)} ${(500 + R * Math.sin(a2)).toFixed(0)}z" fill="${c.primary}"/>`;
      }).join('');
      return backdropSvg(
        `${segs}
         <g fill="none" stroke="${c.primary}" stroke-width="5">
           <circle cx="397" cy="500" r="330"/><circle cx="397" cy="500" r="270"/>
           <circle cx="397" cy="500" r="190"/><circle cx="397" cy="500" r="130"/>
           <circle cx="397" cy="500" r="52"/><circle cx="397" cy="500" r="22"/>
         </g>`, 0.14);
    },
    emblem: (c) => emblemSvg(
      `<circle cx="100" cy="100" r="86" fill="${c.dark}" stroke="${c.accent}" stroke-width="6"/>
       <circle cx="100" cy="100" r="62" fill="none" stroke="${c.primary}" stroke-width="14"/>
       <circle cx="100" cy="100" r="34" fill="none" stroke="${c.accent}" stroke-width="10"/>
       <circle cx="100" cy="100" r="13" fill="${c.primary}"/>`),
  },

  billiards: {
    backdrop: (c) => backdropSvg(
      `<rect x="80" y="260" width="634" height="600" rx="26" fill="none" stroke="${c.primary}" stroke-width="8"/>
       <rect x="116" y="296" width="562" height="528" rx="8" fill="none" stroke="${c.primary}" stroke-width="4"/>
       <g fill="${c.primary}">
         <circle cx="116" cy="296" r="22"/><circle cx="397" cy="290" r="22"/><circle cx="678" cy="296" r="22"/>
         <circle cx="116" cy="824" r="22"/><circle cx="397" cy="830" r="22"/><circle cx="678" cy="824" r="22"/>
       </g>
       <g fill="none" stroke="${c.primary}" stroke-width="4">
         ${[0, 1, 2, 3, 4]
           .map((row) =>
             Array.from({ length: row + 1 }, (_, k) => {
               const cx = 397 - row * 22 + k * 44;
               const cy = 430 + row * 40;
               return `<circle cx="${cx}" cy="${cy}" r="20"/>`;
             }).join(''),
           )
           .join('')}
         <line x1="150" y1="800" x2="620" y2="560"/>
       </g>`, 0.16),
    emblem: (c) => emblemSvg(
      `<circle cx="100" cy="100" r="86" fill="${c.dark}" stroke="${c.accent}" stroke-width="6"/>
       <circle cx="100" cy="100" r="46" fill="${c.accent}"/>
       <path d="M86 72h20v56h-20zM82 74a22 22 0 0 1 36 0M82 126a22 22 0 0 0 36 0" fill="${c.dark}"/>
       <circle cx="100" cy="86" r="13" fill="none" stroke="${c.dark}" stroke-width="8"/>
       <circle cx="100" cy="116" r="15" fill="none" stroke="${c.dark}" stroke-width="8"/>`),
  },

  boardgames: {
    backdrop: (c) => {
      let grid = '';
      for (let r = 0; r < 9; r += 1) {
        for (let k = 0; k < 7; k += 1) {
          if ((r + k) % 3) continue;
          grid += `<rect x="${64 + k * 96}" y="${230 + r * 74}" width="84" height="62" rx="10" fill="${c.primary}"/>`;
        }
      }
      return backdropSvg(grid, 0.12);
    },
    emblem: (c) => emblemSvg(
      `<rect x="16" y="60" width="104" height="104" rx="20" fill="${c.accent}" transform="rotate(-12 68 112)"/>
       <g fill="${c.dark}" transform="rotate(-12 68 112)">
         <circle cx="44" cy="88" r="10"/><circle cx="92" cy="88" r="10"/>
         <circle cx="68" cy="112" r="10"/><circle cx="44" cy="136" r="10"/><circle cx="92" cy="136" r="10"/>
       </g>
       <rect x="96" y="30" width="88" height="88" rx="18" fill="${c.primary}" transform="rotate(14 140 74)"/>
       <g fill="${c.dark}" transform="rotate(14 140 74)">
         <circle cx="120" cy="54" r="9"/><circle cx="160" cy="54" r="9"/>
         <circle cx="120" cy="94" r="9"/><circle cx="160" cy="94" r="9"/>
       </g>`),
  },

  esports: {
    backdrop: (c) => backdropSvg(
      `<g fill="none" stroke="${c.primary}" stroke-width="3">
         ${Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="${140 + i * 80}" x2="794" y2="${140 + i * 80}"/>`).join('')}
         ${Array.from({ length: 9 }, (_, i) => `<line x1="${50 + i * 90}" y1="0" x2="${50 + i * 90}" y2="1123"/>`).join('')}
       </g>
       <g fill="none" stroke="${c.accent}" stroke-width="5" opacity="0.9">
         <path d="M50 300h180l50 60h240l50-60h174"/>
         <path d="M50 820h300l60-70h384"/>
       </g>
       ${dots(26, c.accent, 7, 5)}`, 0.18),
    emblem: (c) => emblemSvg(
      `<rect x="14" y="62" width="172" height="96" rx="42" fill="${c.primary}" stroke="${c.accent}" stroke-width="6"/>
       <g stroke="${c.accent}" stroke-width="11" stroke-linecap="round">
         <line x1="48" y1="110" x2="78" y2="110"/><line x1="63" y1="95" x2="63" y2="125"/>
       </g>
       <circle cx="135" cy="98" r="11" fill="${c.accent}"/>
       <circle cx="157" cy="120" r="11" fill="${c.accent}"/>`),
  },

  quiz: {
    backdrop: (c) => backdropSvg(
      `<g fill="${c.primary}" font-family="Georgia, serif" font-size="300" font-weight="700" opacity="0.9">
         <text x="60" y="330">?</text><text x="560" y="620">?</text><text x="250" y="960">?</text>
       </g>
       <g fill="none" stroke="${c.primary}" stroke-width="5">
         <rect x="420" y="180" width="300" height="86" rx="43"/>
         <rect x="70" y="520" width="300" height="86" rx="43"/>
         <rect x="470" y="880" width="260" height="86" rx="43"/>
       </g>`, 0.14),
    emblem: (c) => emblemSvg(
      `<rect x="20" y="20" width="160" height="160" rx="38" fill="${c.primary}" stroke="${c.accent}" stroke-width="6"/>
       <path d="M74 76a26 26 0 1 1 34 25v17" fill="none" stroke="${c.accent}" stroke-width="15" stroke-linecap="round"/>
       <circle cx="108" cy="146" r="11" fill="${c.accent}"/>`),
  },

  // ---- Evening events ----------------------------------------------------
  mystery: {
    backdrop: (c) => backdropSvg(
      `<path d="M560 120a150 150 0 1 0 118 240A170 170 0 0 1 560 120z" fill="${c.primary}"/>
       ${dots(46, c.accent, 19, 3)}
       <g fill="none" stroke="${c.primary}" stroke-width="4" opacity="0.7">
         <path d="M-20 780q200 -60 400 0t420 0"/>
         <path d="M-20 860q200 -60 400 0t420 0"/>
         <path d="M-20 940q200 -60 400 0t420 0"/>
       </g>`, 0.2),
    emblem: (c) => emblemSvg(
      `<path d="M128 22a82 82 0 1 0 54 140A92 92 0 0 1 128 22z" fill="${c.accent}"/>
       <g fill="${c.primary}">
         <path d="M44 44l8 20 20 8-20 8-8 20-8-20-20-8 20-8z"/>
         <path d="M40 140l6 14 14 6-14 6-6 14-6-14-14-6 14-6z"/>
       </g>`),
  },

  party: {
    backdrop: (c) => backdropSvg(
      `<g opacity="0.55">
         <path d="M340 0L110 1123h150L400 0z" fill="${c.primary}"/>
         <path d="M430 0L620 1123h140L500 0z" fill="${c.accent}"/>
         <path d="M120 0L-90 900h130L230 0z" fill="${c.accent}"/>
       </g>
       ${dots(60, c.accent, 11, 6)}`, 0.2),
    emblem: (c) => emblemSvg(
      `<circle cx="100" cy="108" r="78" fill="${c.primary}" stroke="${c.accent}" stroke-width="6"/>
       <g stroke="${c.accent}" stroke-width="4" opacity="0.9" fill="none">
         <line x1="22" y1="108" x2="178" y2="108"/><line x1="34" y1="70" x2="166" y2="70"/><line x1="34" y1="146" x2="166" y2="146"/>
         <line x1="100" y1="30" x2="100" y2="186"/>
         <path d="M62 34c-18 44-18 104 0 148M138 34c18 44 18 104 0 148"/>
       </g>
       <rect x="92" y="6" width="16" height="26" rx="6" fill="${c.accent}"/>`),
  },

  movie: {
    backdrop: (c) => backdropSvg(
      `<rect x="0" y="0" width="86" height="1123" fill="${c.primary}"/>
       <rect x="708" y="0" width="86" height="1123" fill="${c.primary}"/>
       <g fill="${c.dark}">
         ${Array.from({ length: 14 }, (_, i) => `<rect x="18" y="${30 + i * 80}" width="50" height="46" rx="8"/><rect x="726" y="${30 + i * 80}" width="50" height="46" rx="8"/>`).join('')}
       </g>
       <path d="M180 1123L397 430l217 693z" fill="${c.primary}" opacity="0.5"/>`, 0.18),
    emblem: (c) => emblemSvg(
      `<rect x="16" y="64" width="168" height="112" rx="14" fill="${c.primary}" stroke="${c.accent}" stroke-width="6"/>
       <path d="M16 64l26-34 40 22-26 34zM82 52l40-22 40 22-40 34z" fill="${c.accent}"/>
       <g fill="${c.dark}" opacity="0.65">
         <rect x="34" y="96" width="30" height="24" rx="5"/><rect x="86" y="96" width="30" height="24" rx="5"/><rect x="138" y="96" width="30" height="24" rx="5"/>
       </g>`),
  },

  // ---- Academic ----------------------------------------------------------
  hackathon: {
    backdrop: (c) => backdropSvg(
      `<g fill="none" stroke="${c.primary}" stroke-width="4">
         <path d="M60 260h120v120M734 260H614v120M60 880h120V760M734 880H614V760"/>
         <path d="M200 420h180l60 90h180"/><path d="M180 680h220l70-80h250"/>
         <circle cx="200" cy="420" r="12"/><circle cx="620" cy="510" r="12"/>
         <circle cx="180" cy="680" r="12"/><circle cx="720" cy="600" r="12"/>
       </g>
       <g fill="${c.primary}" font-family="Consolas, monospace" font-size="150" font-weight="700" opacity="0.7">
         <text x="120" y="600">&lt;/&gt;</text>
       </g>`, 0.16),
    emblem: (c) => emblemSvg(
      `<rect x="16" y="34" width="168" height="132" rx="16" fill="${c.dark}" stroke="${c.primary}" stroke-width="6"/>
       <rect x="16" y="34" width="168" height="30" rx="16" fill="${c.primary}"/>
       <g fill="${c.dark}"><circle cx="38" cy="49" r="7"/><circle cx="60" cy="49" r="7"/><circle cx="82" cy="49" r="7"/></g>
       <path d="M44 92l24 22-24 22" fill="none" stroke="${c.accent}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
       <line x1="86" y1="136" x2="146" y2="136" stroke="${c.accent}" stroke-width="10" stroke-linecap="round"/>`),
  },

  debate: {
    backdrop: (c) => backdropSvg(
      `<g fill="none" stroke="${c.primary}" stroke-width="5">
         <path d="M70 250h300v190H210l-60 60v-60H70z"/>
         <path d="M724 640H424v190h160l60 60v-60h80z"/>
       </g>
       <g fill="${c.primary}" opacity="0.8">
         <circle cx="150" cy="345" r="14"/><circle cx="220" cy="345" r="14"/><circle cx="290" cy="345" r="14"/>
         <circle cx="504" cy="735" r="14"/><circle cx="574" cy="735" r="14"/><circle cx="644" cy="735" r="14"/>
       </g>`, 0.16),
    emblem: (c) => emblemSvg(
      `<path d="M14 40h110v72H62l-34 30v-30H14z" fill="${c.primary}" stroke="${c.accent}" stroke-width="6"/>
       <path d="M186 92H88v70h54l32 28v-28h12z" fill="${c.accent}" stroke="${c.primary}" stroke-width="6"/>`),
  },

  academic: {
    backdrop: (c) => backdropSvg(
      `<g fill="none" stroke="${c.primary}" stroke-width="2" opacity="0.8">
         ${Array.from({ length: 23 }, (_, i) => `<line x1="0" y1="${i * 50}" x2="794" y2="${i * 50}"/>`).join('')}
         ${Array.from({ length: 17 }, (_, i) => `<line x1="${i * 50}" y1="0" x2="${i * 50}" y2="1123"/>`).join('')}
       </g>
       <g fill="none" stroke="${c.primary}" stroke-width="6">
         <circle cx="200" cy="300" r="120"/>
         <rect x="450" y="640" width="240" height="240"/>
         <path d="M120 900l140-220 140 220z"/>
       </g>`, 0.14),
    emblem: (c) => emblemSvg(
      `<path d="M100 30l90 44-90 44-90-44z" fill="${c.primary}" stroke="${c.accent}" stroke-width="6" stroke-linejoin="round"/>
       <path d="M44 96v46c0 18 25 32 56 32s56-14 56-32V96" fill="none" stroke="${c.accent}" stroke-width="11"/>
       <path d="M176 82v54" stroke="${c.accent}" stroke-width="9" stroke-linecap="round"/>
       <circle cx="176" cy="146" r="12" fill="${c.accent}"/>`),
  },

  generic: {
    backdrop: (c) => backdropSvg(
      `<g fill="none" stroke="${c.primary}" stroke-width="5">
         <circle cx="130" cy="240" r="150"/>
         <circle cx="680" cy="560" r="210"/>
         <circle cx="300" cy="920" r="170"/>
         <path d="M0 640h794M0 700h794"/>
       </g>
       ${dots(30, c.primary, 5, 6)}`, 0.14),
    emblem: (c) => emblemSvg(
      `<rect x="24" y="40" width="152" height="140" rx="22" fill="${c.primary}" stroke="${c.accent}" stroke-width="6"/>
       <rect x="24" y="40" width="152" height="40" rx="22" fill="${c.accent}"/>
       <g fill="${c.accent}">
         <rect x="52" y="100" width="34" height="30" rx="7"/><rect x="114" y="100" width="34" height="30" rx="7"/>
         <rect x="52" y="142" width="34" height="26" rx="7" opacity="0.6"/><rect x="114" y="142" width="34" height="26" rx="7" opacity="0.6"/>
       </g>
       <g fill="${c.primary}"><rect x="56" y="22" width="16" height="34" rx="7"/><rect x="128" y="22" width="16" height="34" rx="7"/></g>`),
  },
};

/** Full-bleed background artwork for an activity kind. */
export function backdropFor(kindId, palette) {
  return (MOTIFS[kindId] ?? MOTIFS.generic).backdrop(palette);
}

/** Focal badge artwork for an activity kind. */
export function emblemFor(kindId, palette) {
  return (MOTIFS[kindId] ?? MOTIFS.generic).emblem(palette);
}

/** Motif ids that have real artwork, for tests. */
export function motifIds() {
  return Object.keys(MOTIFS);
}
