// Original crest-style team badge — a shield silhouette built from primitives
// (gradient fill, diagonal sash, lettering) in the team's own colors. No real
// team logos or external art; every mark is generated at runtime per team.

// Darken/lighten a '#rrggbb' color by amt (-1..1)
function shade(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16);
  const clamp = v => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + Math.round(255 * amt));
  const g = clamp(((n >> 8) & 0xff) + Math.round(255 * amt));
  const b = clamp((n & 0xff) + Math.round(255 * amt));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export function teamBadgeSVG(team, size = 190) {
  const { primary, secondary, accent } = team.colors;
  const rim = accent || secondary;
  const abbr = team.abbr;
  const fontSize = abbr.length >= 4 ? 28 : abbr.length === 3 ? 33 : 40;
  const uid = (team.id || abbr).replace(/[^a-z0-9]/gi, '');

  return `
    <svg viewBox="0 0 100 120" width="${size}" height="${Math.round(size * 1.2)}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="badgebg-${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${shade(primary, 0.08)}"/>
          <stop offset="100%" stop-color="${shade(primary, -0.32)}"/>
        </linearGradient>
      </defs>
      <path d="M50 2 L90 13 L90 55 C90 86 70 106 50 119 C30 106 10 86 10 55 L10 13 Z"
            fill="url(#badgebg-${uid})" stroke="${rim}" stroke-width="3"/>
      <path d="M12 40 L88 18 L88 30 L12 52 Z" fill="${secondary}" opacity="0.88"/>
      <line x1="22" y1="60" x2="78" y2="60" stroke="${rim}" stroke-width="1.5" opacity="0.75"/>
      <text x="50" y="73" text-anchor="middle" font-family="Impact, 'Arial Narrow', sans-serif"
            font-style="italic" font-weight="bold" font-size="${fontSize}"
            fill="#fff" stroke="#000" stroke-width="1.6" paint-order="stroke" stroke-linejoin="round">${abbr}</text>
      <line x1="22" y1="85" x2="78" y2="85" stroke="${rim}" stroke-width="1.5" opacity="0.75"/>
    </svg>`;
}
