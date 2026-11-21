// The storybook look in SVG strings: chunky rounded shapes with a dark ink outline (#1E120C). Icons, loaves,
// seals, candles and the night window. Drawn once into the DOM (and rasterised once for canvas, see sprite()).

export const INK = '#1E120C';
export const C = {
  wall: '#2A1A12',
  trim: '#6B4428',
  parchment: '#F3E3C3',
  amber: '#F2A541',
  gold: '#E8B84A',
  night: '#141B3A',
  wax: '#A8322D',
  cream: '#FFF4E0',
};

export const STAR = (s = 22): string =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="#E8B84A" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 8.5 L11 5.5" stroke="#FFF1C9" stroke-width="1.2" stroke-linecap="round"/></svg>`;

export const TIP = (s = 22): string =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="#D9A441" stroke="${INK}" stroke-width="1.4"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#8A5A35" stroke-width="1.4"/><path d="M12 8.5 L12 15.5 M10 10 Q12 8.5 14 10 Q12 12 10 14 Q12 15.5 14 14" stroke="#8A5A35" stroke-width="1.2" fill="none"/></svg>`;

export const LOAF13 = (s = 28): string =>
  `<svg width="${s}" height="${Math.round(s * 0.72)}" viewBox="0 0 28 20" aria-hidden="true"><ellipse cx="14" cy="11" rx="12.5" ry="8" fill="#F7C35E" stroke="${INK}" stroke-width="1.4"/><path d="M8 7 L10 13 M14 5.5 L14 12 M20 7 L18 13" stroke="#C47A1E" stroke-width="1.6" stroke-linecap="round"/></svg>`;

export const SAFFRON = (s = 22): string =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21 Q11 14 6 9" stroke="#5E9A58" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M12 21 Q13 13 18 8" stroke="#5E9A58" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M6 9 Q3 4 6 2 Q9 4 6 9Z M18 8 Q21 3 18 1.5 Q15 3.5 18 8Z M12 12 Q10 6 12 3 Q14 6 12 12Z" fill="#E8552D" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><circle cx="12" cy="4" r="1.2" fill="#FFD166"/></svg>`;

export const HOURGLASS = (s = 22, color = '#2A1A12'): string =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/></svg>`;

export const CROWN = (s = 18): string =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18 L5 7 L10 12 L12 5 L14 12 L19 7 L21 18 Z" fill="#E8B84A" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

export const SHERIFF_BADGE = (s = 40): string =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.2l2.8 4.8h5.5l-2.8 5 2.8 5h-5.5L12 21l-2.8-5H3.7l2.8-5-2.8-5h5.5z" fill="#E3B04B" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><circle cx="12" cy="11" r="3.6" fill="#C9902E" stroke="${INK}" stroke-width="1"/><path d="M8.6 6.6 Q10 5.4 12 5.2" stroke="#FFF1C9" stroke-width="1" fill="none"/><circle cx="3.9" cy="6" r="1" fill="${INK}"/><circle cx="20.1" cy="6" r="1" fill="${INK}"/><circle cx="3.9" cy="16" r="1" fill="${INK}"/><circle cx="20.1" cy="16" r="1" fill="${INK}"/></svg>`;

/** a customer's badge on the order card */
export function customerBadge(badge: string | undefined, s = 40): string {
  if (badge === 'sheriff') return SHERIFF_BADGE(s);
  if (badge === 'gary')
    // Gary's stall sign from Dungeon Joe: a coin purse
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9 Q4 20 12 21 Q20 20 18 9 Z" fill="#8A5A35" stroke="${INK}" stroke-width="1.3"/><path d="M7 9 Q12 5 17 9" stroke="${INK}" stroke-width="1.6" fill="none"/><path d="M9 6 L12 3 L15 6" stroke="#E8B84A" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="12" cy="15" r="2.6" fill="#E8B84A" stroke="${INK}" stroke-width="1"/></svg>`;
  if (badge === 'clerk')
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="1.5" fill="#F3E3C3" stroke="${INK}" stroke-width="1.3"/><path d="M8 8h8M8 11h8M8 14h5" stroke="#8A5A35" stroke-width="1.4"/><circle cx="16" cy="17" r="2.6" fill="#A8322D" stroke="${INK}" stroke-width="1"/></svg>`;
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4.5" fill="#D9A07A" stroke="${INK}" stroke-width="1.3"/><path d="M4 21 Q4 13 12 13 Q20 13 20 21 Z" fill="#6B4428" stroke="${INK}" stroke-width="1.3"/></svg>`;
}

// ------------------------------------------------------------------ baked goods (order items)

export function itemSVG(icon: string, w = 56, glow = false): string {
  const h = Math.round(w * 0.625);
  const top = glow ? '#FFD166' : '#EBA54E';
  const mid = glow ? '#F0B640' : '#D98A3A';
  const dark = glow ? '#D99A2B' : '#B8692A';
  const hl = `stroke="#FFF1C9" fill="none" opacity="0.7" stroke-linecap="round"`;
  const sh = `<ellipse cx="32" cy="35" rx="25" ry="4" fill="rgba(0,0,0,0.22)"/>`;
  let body = '';
  switch (icon) {
    case 'croissant':
      body = `<g stroke="#5A3414" stroke-width="2" stroke-linejoin="round"><ellipse cx="9" cy="27" rx="7.5" ry="5" transform="rotate(-38 9 27)" fill="${dark}"/><ellipse cx="55" cy="27" rx="7.5" ry="5" transform="rotate(38 55 27)" fill="${dark}"/><ellipse cx="18" cy="21" rx="10" ry="8.5" transform="rotate(-28 18 21)" fill="${mid}"/><ellipse cx="46" cy="21" rx="10" ry="8.5" transform="rotate(28 46 21)" fill="${mid}"/><ellipse cx="32" cy="18" rx="12" ry="12" fill="${top}"/></g><path d="M25 11 Q32 7 39 11" stroke-width="2.2" ${hl}/><path d="M12 17 Q16 13 21 15" stroke-width="1.8" ${hl}/><path d="M43 15 Q48 13 52 17" stroke-width="1.8" ${hl}/>`;
      break;
    case 'bun':
      body = `<path d="M8 30 Q8 8 32 8 Q56 8 56 30 Z" fill="${top}" stroke="#5A3414" stroke-width="2"/><path d="M8 30 L56 30" stroke="#5A3414" stroke-width="2"/><ellipse cx="32" cy="14" rx="12" ry="3" fill="#FFF8EA" opacity="0.7"/><circle cx="24" cy="20" r="1.4" fill="#FFF8EA"/><circle cx="38" cy="18" r="1.4" fill="#FFF8EA"/><circle cx="31" cy="23" r="1.4" fill="#FFF8EA"/>`;
      break;
    case 'pretzel':
      body = `<path d="M32 30 Q12 34 10 20 Q9 8 22 9 Q32 10 32 22 Q32 10 42 9 Q55 8 54 20 Q52 34 32 30 Z M20 28 L44 14 M44 28 L20 14" fill="none" stroke="#5A3414" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/><path d="M32 30 Q12 34 10 20 Q9 8 22 9 Q32 10 32 22 Q32 10 42 9 Q55 8 54 20 Q52 34 32 30 Z M20 28 L44 14 M44 28 L20 14" fill="none" stroke="${mid}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="20" cy="13" r="1.2" fill="#fff"/><circle cx="44" cy="22" r="1.2" fill="#fff"/><circle cx="31" cy="27" r="1.2" fill="#fff"/>`;
      break;
    case 'loaf':
      body = `<rect x="8" y="10" width="48" height="22" rx="10" fill="${mid}" stroke="#5A3414" stroke-width="2"/><path d="M18 13 L22 26 M30 12 L33 27 M42 13 L45 26" stroke="${dark}" stroke-width="2.4" stroke-linecap="round"/><path d="M14 14 Q30 9 48 13" stroke-width="2" ${hl}/>`;
      break;
    case 'boule':
      body = `<ellipse cx="32" cy="21" rx="22" ry="13" fill="${mid}" stroke="#5A3414" stroke-width="2"/><path d="M22 12 Q32 22 42 12 M20 22 Q32 30 44 22" stroke="${dark}" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M16 15 Q24 9 34 9" stroke-width="2" ${hl}/>`;
      break;
    case 'baguette':
      body = `<rect x="4" y="14" width="56" height="14" rx="7" fill="${mid}" stroke="#5A3414" stroke-width="2" transform="rotate(-8 32 21)"/><path d="M14 22 L20 16 M26 21 L32 15 M38 19 L44 13 M50 17 L54 13" stroke="${dark}" stroke-width="2.4" stroke-linecap="round"/>`;
      break;
    case 'tart':
      body = `<path d="M8 22 L14 33 L50 33 L56 22 Z" fill="${mid}" stroke="#5A3414" stroke-width="2"/><ellipse cx="32" cy="22" rx="24" ry="7" fill="#7A3A6A" stroke="#5A3414" stroke-width="2"/><circle cx="24" cy="21" r="3" fill="#9A4A86"/><circle cx="34" cy="20" r="3" fill="#9A4A86"/><circle cx="42" cy="23" r="3" fill="#9A4A86"/><path d="M14 20 L50 20" stroke="${top}" stroke-width="2" stroke-dasharray="4 4"/>`;
      break;
    case 'cookie':
      body = `<circle cx="32" cy="20" r="14" fill="${top}" stroke="#5A3414" stroke-width="2"/><path d="M24 16 L28 20 M36 14 L38 18 M30 26 L34 26" stroke="${dark}" stroke-width="2.4" stroke-linecap="round"/><circle cx="32" cy="20" r="10" fill="none" stroke="#FFF1C9" stroke-width="1.2" stroke-dasharray="2 3"/>`;
      break;
    case 'roll':
      body = `<circle cx="32" cy="20" r="15" fill="${mid}" stroke="#5A3414" stroke-width="2"/><path d="M32 20 m-3 0 a3 3 0 1 1 3 3 a6 6 0 1 1 6 -6 a9 9 0 1 1 -9 9 a12 12 0 1 1 12 -12" stroke="${dark}" stroke-width="2.4" fill="none"/><path d="M22 12 Q30 8 38 9" stroke="#FFF8EA" stroke-width="3" fill="none" opacity="0.8" stroke-linecap="round"/>`;
      break;
    case 'pie':
      body = `<path d="M6 22 L12 33 L52 33 L58 22 Z" fill="${dark}" stroke="#5A3414" stroke-width="2"/><ellipse cx="32" cy="21" rx="26" ry="9" fill="${top}" stroke="#5A3414" stroke-width="2"/><path d="M22 18 L26 22 M32 16 L32 22 M42 18 L38 22" stroke="#5A3414" stroke-width="2" stroke-linecap="round"/>`;
      break;
    case 'bagel':
      body = `<ellipse cx="32" cy="21" rx="22" ry="13" fill="${mid}" stroke="#5A3414" stroke-width="2"/><ellipse cx="32" cy="21" rx="7" ry="4" fill="#2A1A12" stroke="#5A3414" stroke-width="2"/><circle cx="18" cy="17" r="1.2" fill="#FFF8EA"/><circle cx="44" cy="15" r="1.2" fill="#FFF8EA"/><circle cx="40" cy="27" r="1.2" fill="#FFF8EA"/><circle cx="23" cy="26" r="1.2" fill="#FFF8EA"/>`;
      break;
    default:
      body = `<ellipse cx="32" cy="21" rx="22" ry="12" fill="${mid}" stroke="#5A3414" stroke-width="2"/>`;
  }
  return `<svg width="${w}" height="${h}" viewBox="0 0 64 40" aria-hidden="true">${sh}${body}</svg>`;
}

// ------------------------------------------------------------------ the door's wax seals

export function sealSVG(cracked: boolean, s = 60): string {
  const bg = cracked ? '#5E2E2A' : '#A8322D';
  const ring = cracked ? '#4A2220' : '#7E1F1B';
  const em = cracked ? '#7A4A44' : '#E06B5F';
  const blobs = [
    [52, 30],
    [45.6, 45.6],
    [30, 52],
    [14.4, 45.6],
    [8, 30],
    [14.4, 14.4],
    [30, 8],
    [45.6, 14.4],
  ]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="${bg}"/>`)
    .join('');
  return `<svg width="${s}" height="${s}" viewBox="0 0 60 60" aria-hidden="true" style="opacity:${cracked ? 0.75 : 1}">${blobs}<circle cx="30" cy="30" r="23" fill="${bg}" stroke="${INK}" stroke-width="2"/><circle cx="30" cy="30" r="16" fill="none" stroke="${ring}" stroke-width="3"/><path d="M30 40 L30 20 M30 26 Q25 25 24 20 M30 26 Q35 25 36 20 M30 33 Q25 32 24 27 M30 33 Q35 32 36 27" stroke="${em}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M20 16 Q24 12 30 11" stroke="#FFFFFF" stroke-width="2" fill="none" opacity="0.35" stroke-linecap="round"/>${cracked ? `<path d="M27 3 L33 21 L24 31 L35 57" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ''}</svg>`;
}

// ------------------------------------------------------------------ buffs, games, achievements, emotes

export function buffIcon(color: string, s = 18): string {
  return `<svg width="${Math.round(s * 0.9)}" height="${s}" viewBox="0 0 16 18" aria-hidden="true"><rect x="2" y="5" width="12" height="12" rx="3" fill="${color}" stroke="${INK}" stroke-width="1.4"/><rect x="1" y="2" width="14" height="4" rx="1.5" fill="#8A5A35" stroke="${INK}" stroke-width="1.2"/></svg>`;
}

export const ACH_ICONS: Record<string, string> = {
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5',
  loaf: 'M3 14c0-4 4-7 9-7s9 3 9 7v4H3zM8 10l1 4M12 9v5M16 10l-1 4',
  hand: 'M7 11V6a1.5 1.5 0 0 1 3 0v5M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 9a1.5 1.5 0 0 1 3 0v4a8 8 0 0 1-8 8h-1a6 6 0 0 1-5-3l-2.5-4a1.5 1.5 0 0 1 2.5-1.5L7 14',
  salt: 'M8 8h8l-1 13H9zM9 8V5a3 3 0 0 1 6 0v3M11 4h.01M13 4h.01',
  people: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6M21 20a6 6 0 0 0-4-5.6',
  badge: 'M12 2l2.7 4.7h5.4l-2.7 4.8 2.7 4.8h-5.4L12 21l-2.7-4.7H3.9l2.7-4.8-2.7-4.8h5.4z',
  sword: 'M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2',
  music: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  d20: 'M12 2l9 5v10l-9 5-9-5V7zM12 2v20M3 7l9 5 9-5M3 17l9-5 9 5',
  lock: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5zM12 15v2',
  gem: 'M6 3h12l4 6-10 12L2 9zM2 9h20M9 3l3 6 3-6M12 9v12',
  fire: 'M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 9 0 4 3 7 7 7zM12 22c-2 0-3-1.5-3-3.5S12 14 12 14s3 2.5 3 4.5S14 22 12 22z',
};

export function lineIcon(path: string, s = 24, color = '#FFF4E0', w = 2): string {
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
}

/** the six games' icons (line art) */
export const GAME_ICONS: Record<string, string> = {
  knead: 'M4 14c0-4 3.5-7 8-7s8 3 8 7-3.5 5-8 5-8-1-8-5zM8 10l2 3M12 9v4M16 10l-2 3M2 5l3 2M22 5l-3 2',
  proof: 'M4 12h16l-2 8H6zM6 12c0-4 2.5-7 6-7s6 3 6 7M12 2v2M8 3l1 2M16 3l-1 2',
  oven: 'M3 20V10a9 9 0 0 1 18 0v10zM7 20v-6h10v6M9 8h.01M12 7h.01M15 8h.01',
  decorate: 'M14 3l7 7-9 9H5v-7zM5 19l-2 2M12 6l6 6M8 13c2-1 3 1 5 0',
  scale: 'M12 3v18M5 21h14M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z',
  rush: 'M9 5h6M12 5v3M5 12a7 7 0 1 0 14 0 7 7 0 0 0-14 0zM12 12l3-2',
  dawn: 'M2 18h20M5 18a7 7 0 0 1 14 0M12 3v4M4.2 8.2l2.1 2.1M19.8 8.2l-2.1 2.1',
};

export const EMOTE_SVG: Record<string, string> = {
  cheers: `<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><path d="M10 30 Q8 18 18 14 Q30 10 34 20 Q36 30 26 32 Z" fill="#EBA54E" stroke="${INK}" stroke-width="2.2"/><path d="M16 20 L19 26 M23 17 L25 24 M29 19 L29 25" stroke="#B8692A" stroke-width="2" stroke-linecap="round"/><path d="M6 10 L9 13 M38 8 L35 12 M22 4 L22 8" stroke="#FFD166" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  laugh: `<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><circle cx="16" cy="24" r="9" fill="#FFF4E0" stroke="${INK}" stroke-width="2"/><circle cx="28" cy="20" r="11" fill="#FFF4E0" stroke="${INK}" stroke-width="2"/><circle cx="24" cy="30" r="8" fill="#FFF4E0" stroke="${INK}" stroke-width="2"/><path d="M23 19 Q25 17 27 19 M31 19 Q33 17 35 19 M24 25 Q29 30 34 25" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
  heart: `<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><path d="M22 36 C10 28 6 22 6 16 A8 8 0 0 1 22 12 A8 8 0 0 1 38 16 C38 22 34 28 22 36 Z" fill="#C8553D" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M12 15 Q14 11 18 12" stroke="#F2A08C" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`,
  burnt: `<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true"><path d="M8 34 Q6 22 16 20 Q28 18 34 24 Q38 32 28 35 Z" fill="#3A2216" stroke="${INK}" stroke-width="2.2"/><path d="M14 16 Q12 10 16 6 M22 15 Q20 8 25 4 M30 17 Q29 12 32 9" stroke="#9AA1AD" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M16 26 L19 29 M25 25 L27 29" stroke="#1E120C" stroke-width="2"/></svg>`,
};

/** a candle on a wall sconce: the holder is static SVG; the halo and flame are HTML layers (.candle in theme.css) */
export function candleSVG(delay = 0): string {
  return (
    `<span class="halo" style="animation-delay:${delay}s"></span>` +
    `<svg width="120" height="140" viewBox="-60 -90 120 140" aria-hidden="true" style="position:relative"><path d="M-18 14 Q-18 4 -8 4 L8 4 Q18 4 18 14 Z" fill="#2B2B30" stroke="${INK}" stroke-width="2"/><path d="M0 14 L0 40 M-10 40 L10 40" stroke="#2B2B30" stroke-width="4" stroke-linecap="round"/><rect x="-7" y="-22" width="14" height="27" rx="2" fill="#F6EAD2" stroke="${INK}" stroke-width="2"/><path d="M-7 -18 Q-4 -12 -3 -18 Q0 -10 2 -18" fill="#FFFDF6"/><path d="M0 -22 L0 -27" stroke="${INK}" stroke-width="1.5"/></svg>` +
    `<span class="flame" style="animation-delay:${delay}s"><svg width="16" height="22" viewBox="-8 -45 16 22" aria-hidden="true"><path d="M0 -44 Q7 -34 4 -28 Q0 -24 -4 -28 Q-7 -34 0 -44 Z" fill="#FFC24A" stroke="#E07A1F" stroke-width="1"/><path d="M0 -38 Q3 -33 2 -30 Q0 -28 -2 -30 Q-3 -33 0 -38 Z" fill="#FFF3C4"/></svg></span>`
  );
}

// ------------------------------------------------------------------ the window is the clock

function hexToRgb(h: string): number[] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mix(stops: [number, string][], t: number): string {
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    if (t <= b[0]) {
      const k = (t - a[0]) / (b[0] - a[0] || 1);
      const ca = hexToRgb(a[1]);
      const cb = hexToRgb(b[1]);
      return `rgb(${ca.map((v, j) => Math.round(v + (cb[j]! - v) * k)).join(',')})`;
    }
  }
  return stops[stops.length - 1]![1];
}

export interface SkyLook {
  sky: string;
  horizon: string;
  starOp: number;
  cloudOp: number;
  sunTop: number;
  lanternX: number;
  lanternScale: number;
}
/** t: 0 = midnight (order 1) .. 1 = sunrise (order 13) */
export function skyAt(t: number): SkyLook {
  const sunK = Math.max(0, (t - 0.6) / 0.4);
  return {
    sky: mix([[0, '#141B3A'], [0.55, '#2E3468'], [0.82, '#8A5A86'], [1, '#E8946A']], t),
    horizon: mix([[0, '#1E2550'], [0.55, '#4A3F7E'], [0.82, '#E07A5A'], [1, '#FFCF7A']], t),
    starOp: Math.max(0, 1 - t * 1.3),
    cloudOp: Math.max(0, (t - 0.5) * 2),
    sunTop: Math.round(260 - sunK * 150),
    lanternX: 600 - t * 520,
    lanternScale: 0.7 + t * 0.8,
  };
}

/** the village skyline at the bottom of the window (static) */
export const SKYLINE = `<svg viewBox="0 0 760 120" preserveAspectRatio="none" aria-hidden="true" class="skyline"><path d="M0 56 Q120 20 260 46 Q400 72 540 34 Q660 6 760 38 L760 120 L0 120 Z" fill="#251D3E"/><path d="M130 64 L130 30 L138 14 L146 30 L146 64 Z" fill="#120E20"/><rect x="136" y="38" width="4" height="7" fill="#FFCF6B"/><rect x="150" y="38" width="34" height="26" fill="#120E20"/><path d="M146 38 L167 24 L188 38 Z" fill="#120E20"/><rect x="163" y="46" width="7" height="8" fill="#FFCF6B"/><rect x="194" y="30" width="26" height="34" fill="#120E20"/><path d="M190 30 L207 16 L224 30 Z" fill="#120E20"/><rect x="203" y="38" width="7" height="8" fill="#FFCF6B"/><rect x="230" y="40" width="40" height="24" fill="#120E20"/><path d="M226 40 L250 26 L274 40 Z" fill="#120E20"/><rect x="246" y="48" width="7" height="8" fill="#FFCF6B"/><rect x="280" y="34" width="30" height="30" fill="#120E20"/><path d="M276 34 L295 20 L314 34 Z" fill="#120E20"/><rect x="291" y="42" width="7" height="8" fill="#FFCF6B"/><rect x="320" y="24" width="24" height="40" fill="#120E20"/><path d="M316 24 L332 10 L348 24 Z" fill="#120E20"/><rect x="328" y="32" width="7" height="8" fill="#FFCF6B"/><rect x="354" y="36" width="36" height="28" fill="#120E20"/><path d="M350 36 L372 22 L394 36 Z" fill="#120E20"/><rect x="368" y="44" width="7" height="8" fill="#FFCF6B"/><rect x="400" y="42" width="30" height="22" fill="#120E20"/><path d="M396 42 L415 28 L434 42 Z" fill="#120E20"/><rect x="411" y="50" width="7" height="8" fill="#FFCF6B"/><rect x="60" y="56" width="4" height="12" fill="#0E0A18"/><circle cx="62" cy="52" r="12" fill="#0E0A18"/><rect x="88" y="56" width="4" height="12" fill="#0E0A18"/><circle cx="90" cy="52" r="9" fill="#0E0A18"/><rect x="560" y="56" width="4" height="12" fill="#0E0A18"/><circle cx="562" cy="52" r="11" fill="#0E0A18"/><rect x="590" y="56" width="4" height="12" fill="#0E0A18"/><circle cx="592" cy="52" r="14" fill="#0E0A18"/><rect x="640" y="56" width="4" height="12" fill="#0E0A18"/><circle cx="642" cy="52" r="10" fill="#0E0A18"/><rect x="700" y="56" width="4" height="12" fill="#0E0A18"/><circle cx="702" cy="52" r="12" fill="#0E0A18"/><path d="M0 84 Q200 62 380 78 Q560 94 760 70 L760 120 L0 120 Z" fill="#17122A"/><path d="M0 112 Q260 92 520 94 Q660 95 760 86 L760 98 Q660 108 520 106 Q280 106 0 120 Z" fill="#3A2F52"/><path d="M30 112 L70 108 M140 104 L180 101 M260 99 L300 98 M380 97 L420 97 M500 97 L540 97 M620 95 L660 94" stroke="#5A4E74" stroke-width="2" stroke-linecap="round"/><path d="M0 100 L760 92" stroke="#2A2140" stroke-width="2"/></svg>`;

/** the King's Inspector, a lantern-carrying silhouette walking up the road */
export const INSPECTOR = (w: number, h: number): string =>
  `<svg width="${w}" height="${h}" viewBox="0 0 60 80" aria-hidden="true"><path d="M44 44 L60 70 L30 70 Z" fill="#FFD27A" opacity="0.18"/><circle cx="45" cy="44" r="14" fill="#FFD27A" opacity="0.3" class="bd-gl"/><path d="M8 10 L30 4 L52 10 L44 14 L16 14 Z" fill="#0B0814"/><rect x="20" y="4" width="20" height="9" rx="2" fill="#0B0814"/><circle cx="30" cy="22" r="8" fill="#0B0814"/><path d="M12 78 L16 32 Q30 26 44 32 L48 78 Z" fill="#0B0814"/><path d="M14 40 L6 50 L10 52" stroke="#0B0814" stroke-width="5" fill="none" stroke-linecap="round"/><rect x="2" y="44" width="12" height="16" rx="1" fill="#E8D8BF" opacity="0.7"/><path d="M44 34 L45 38" stroke="#0B0814" stroke-width="3"/><rect x="40" y="38" width="10" height="12" rx="2" fill="#FFD27A" stroke="#0B0814" stroke-width="2"/></svg>`;

/** curtains either side of the bakery window */
export const CURTAIN = `<svg width="96" height="300" viewBox="0 0 96 300" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 L96 0 Q70 90 64 150 Q60 180 30 188 Q40 240 36 300 L0 300 Z" fill="#8E2F2B" stroke="${INK}" stroke-width="2.5"/><path d="M30 0 Q22 90 30 180 M56 0 Q42 70 46 160" stroke="#6E201D" stroke-width="3" fill="none"/><path d="M14 172 Q34 166 52 176 L48 190 Q30 182 12 186 Z" fill="#E8B84A" stroke="${INK}" stroke-width="2"/></svg>`;

export const MOON = `<svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#FFE3A3" opacity="0.18"/><circle cx="32" cy="32" r="20" fill="#FFE9B8" stroke="#E8C77A" stroke-width="2"/><circle cx="26" cy="27" r="4" fill="#E8C77A"/><circle cx="38" cy="36" r="3" fill="#E8C77A"/><circle cx="34" cy="24" r="2" fill="#E8C77A"/></svg>`;

export const CLOUDS = `<svg width="300" height="80" viewBox="0 0 300 80" aria-hidden="true"><path d="M20 60 Q10 40 34 38 Q40 18 66 26 Q84 10 106 28 Q132 24 132 46 Q150 50 140 62 Z" fill="#F7B7A0"/><path d="M170 50 Q166 34 186 34 Q196 20 216 30 Q238 26 240 44 Q256 48 248 58 L176 58 Z" fill="#F3A592"/></svg>`;

/** pantry items for Rush Order (also used by Dawn): [id, svg body in a 40×40 box] */
export const PANTRY: { id: string; color: string; body: string }[] = [
  { id: 'flour', color: '#F3E3C3', body: `<path d="M10 12 Q8 34 12 36 L28 36 Q32 34 30 12 Z" fill="#F3E3C3" stroke="${INK}" stroke-width="2"/><path d="M10 12 Q20 6 30 12" fill="#E9D7B0" stroke="${INK}" stroke-width="2"/><path d="M14 22 Q20 18 26 22 Q20 26 14 22 Z" fill="#C8A060"/>` },
  { id: 'egg', color: '#FFF4E0', body: `<path d="M20 6 Q32 8 32 24 Q32 36 20 36 Q8 36 8 24 Q8 8 20 6 Z" fill="#FFF4E0" stroke="${INK}" stroke-width="2"/><path d="M14 14 Q16 10 20 10" stroke="#fff" stroke-width="2" fill="none"/>` },
  { id: 'butter', color: '#FFD166', body: `<path d="M6 22 L20 14 L34 22 L20 30 Z" fill="#FFE59A" stroke="${INK}" stroke-width="2"/><path d="M6 22 L6 28 L20 36 L34 28 L34 22 L20 30 Z" fill="#F2C14E" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` },
  { id: 'sugar', color: '#E9E4DC', body: `<rect x="10" y="10" width="20" height="24" rx="3" fill="#C3B0F0" stroke="${INK}" stroke-width="2"/><rect x="13" y="16" width="14" height="10" rx="2" fill="#FFFDF8" stroke="${INK}" stroke-width="1.5"/><path d="M15 6 L25 6 L24 10 L16 10 Z" fill="#8E6AD8" stroke="${INK}" stroke-width="1.5"/>` },
  { id: 'milk', color: '#FFFFFF', body: `<path d="M14 8 L26 8 L26 12 L30 18 L30 36 L10 36 L10 18 L14 12 Z" fill="#FFFFFF" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><rect x="10" y="22" width="20" height="8" fill="#93D3D2"/>` },
  { id: 'honey', color: '#F2A541', body: `<path d="M10 14 Q8 36 20 36 Q32 36 30 14 Z" fill="#F2A541" stroke="${INK}" stroke-width="2"/><rect x="9" y="9" width="22" height="6" rx="2" fill="#8A5A35" stroke="${INK}" stroke-width="2"/><path d="M14 20 Q16 26 15 30" stroke="#FFD166" stroke-width="2.4" fill="none" stroke-linecap="round"/>` },
  { id: 'berry', color: '#7A3A6A', body: `<circle cx="14" cy="24" r="7" fill="#9A4A86" stroke="${INK}" stroke-width="2"/><circle cx="26" cy="26" r="7" fill="#7A3A6A" stroke="${INK}" stroke-width="2"/><circle cx="20" cy="16" r="6" fill="#B25A9A" stroke="${INK}" stroke-width="2"/><path d="M20 10 Q22 4 28 5" stroke="#5E9A58" stroke-width="2.4" fill="none" stroke-linecap="round"/>` },
  { id: 'spice', color: '#B8692A', body: `<path d="M8 30 L30 8 L34 12 L12 34 Z" fill="#B8692A" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M12 30 L30 12 M16 32 L32 16" stroke="#8A4A2A" stroke-width="1.6"/><path d="M26 28 L32 34" stroke="#B8692A" stroke-width="5" stroke-linecap="round"/>` },
];
export function pantrySVG(id: string, s = 40): string {
  const p = PANTRY.find((x) => x.id === id) ?? PANTRY[0]!;
  return `<svg width="${s}" height="${s}" viewBox="0 0 40 40" aria-hidden="true">${p.body}</svg>`;
}

// ------------------------------------------------------------------ canvas sprites from SVG

const spriteCache = new Map<string, HTMLImageElement>();
/** an <img> of an SVG string, cached; drawImage it once it has loaded (check img.complete) */
export function sprite(key: string, svgMarkup: string): HTMLImageElement {
  let img = spriteCache.get(key);
  // no DOM (tests): a stand-in that never draws
  if (typeof Image === 'undefined') return { complete: false } as HTMLImageElement;
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup.includes('xmlns') ? svgMarkup : svgMarkup.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))}`;
    spriteCache.set(key, img);
  }
  return img;
}
