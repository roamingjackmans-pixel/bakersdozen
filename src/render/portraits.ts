// The six bakers' storybook portraits (from the mockups), with cosmetics: the apron on the bib and a badge on the
// hat. Joe is Dungeon Joe's Joe (his skin, his stubble, his messy hair) under the riveted helm. The Sheriff is
// Geode Gobbler's Sheriff Gobbo, redrawn with the ink outline.
import { BAKER, COSMETIC } from '../game/data';
import type { BakerId, Cosmetics } from '../game/types';
import { INK } from './art';

function apronFill(id: string, uid: string): { defs: string; fill: string; trim: string } {
  const c = COSMETIC[id];
  const look = c?.look ?? ['plain', '#FFF4E0'];
  const [kind, base = '#FFF4E0', acc = '#C8553D'] = look as [string, string?, string?];
  const pid = `ap-${id}-${uid}`;
  if (kind === 'gingham')
    return { defs: `<pattern id="${pid}" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="${base}"/><rect width="4" height="8" fill="${acc}" opacity="0.45"/><rect width="8" height="4" fill="${acc}" opacity="0.45"/></pattern>`, fill: `url(#${pid})`, trim: '' };
  if (kind === 'stripe')
    return { defs: `<pattern id="${pid}" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="${base}"/><rect width="3" height="7" fill="${acc}"/></pattern>`, fill: `url(#${pid})`, trim: '' };
  if (kind === 'stars')
    return {
      defs: `<pattern id="${pid}" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${base}"/><path d="M6 2 L7 5 L10 5 L7.5 7 L8.5 10 L6 8 L3.5 10 L4.5 7 L2 5 L5 5 Z" fill="${acc}"/></pattern>`,
      fill: `url(#${pid})`,
      trim: '',
    };
  if (kind === 'trim') return { defs: '', fill: base, trim: acc };
  return { defs: '', fill: base, trim: '' };
}

function badgeMark(id: string): string {
  const look = COSMETIC[id]?.look?.[0];
  const at = 'transform="translate(80 30)"';
  switch (look) {
    case 'daisy':
      return `<g ${at}>${[0, 60, 120, 180, 240, 300].map((a) => `<ellipse cx="0" cy="-5" rx="2.6" ry="4.6" fill="#FFFDF8" stroke="${INK}" stroke-width="1" transform="rotate(${a})"/>`).join('')}<circle r="2.8" fill="#F2C14E" stroke="${INK}" stroke-width="1"/></g>`;
    case 'star':
      return `<g ${at}><path d="M0 -8 L2.4 -2.6 L8 -2.4 L3.6 1.2 L5 7 L0 3.8 L-5 7 L-3.6 1.2 L-8 -2.4 L-2.4 -2.6 Z" fill="#E3B04B" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/></g>`;
    case 'note':
      return `<g ${at}><path d="M-2 5 L-2 -7 L6 -9 L6 3" stroke="${INK}" stroke-width="1.8" fill="none"/><circle cx="-4.5" cy="5.5" r="3" fill="#F2C14E" stroke="${INK}" stroke-width="1.2"/><circle cx="3.5" cy="3.5" r="3" fill="#F2C14E" stroke="${INK}" stroke-width="1.2"/></g>`;
    case 'd20':
      return `<g ${at}><path d="M0 -8 L7 -4 L7 4 L0 8 L-7 4 L-7 -4 Z" fill="#C3B0F0" stroke="${INK}" stroke-width="1.3"/><path d="M0 -8 L0 8 M-7 -4 L7 4 M7 -4 L-7 4" stroke="${INK}" stroke-width="0.8" opacity="0.6"/></g>`;
    case 'ember':
      return `<g ${at}><path d="M0 -9 Q6 -3 5 2 Q4 7 0 7 Q-4 7 -5 2 Q-5 -3 0 -9 Z" fill="#F2A541" stroke="${INK}" stroke-width="1.2"/><path d="M0 -3 Q2 0 2 2 Q2 5 0 5 Q-2 5 -2 2 Q-2 0 0 -3 Z" fill="#FFF3C4"/></g>`;
    case 'feather':
      return `<g ${at}><path d="M-6 8 Q-4 -4 6 -9 Q4 2 -6 8 Z" fill="#93D3D2" stroke="${INK}" stroke-width="1.2"/><path d="M-6 8 L3 -5" stroke="${INK}" stroke-width="1"/></g>`;
    default:
      return '';
  }
}

const portraitCache = new Map<string, string>();

/** a baker's round portrait as an SVG string */
export function portrait(baker: BakerId, size = 76, cos?: Partial<Cosmetics>, opts: { ring?: boolean; mood?: 'happy' | 'sad' | 'wow' } = {}): string {
  const key = `${baker}|${size}|${cos?.apron ?? ''}|${cos?.badge ?? ''}|${opts.ring !== false}|${opts.mood ?? ''}`;
  const hit = portraitCache.get(key);
  if (hit) return hit;
  const out = drawPortrait(baker, size, cos, opts, key.replace(/[^a-z0-9]/gi, '_'));
  portraitCache.set(key, out);
  return out;
}

function drawPortrait(baker: BakerId, size: number, cos: Partial<Cosmetics> | undefined, opts: { ring?: boolean; mood?: 'happy' | 'sad' | 'wow' }, uid: string): string {
  const b = BAKER[baker];
  const ap = apronFill(cos?.apron ?? 'apron_plain', uid);
  const skin = b.skin;
  const hat = b.hat;
  const mood = opts.mood ?? 'happy';
  const mouth =
    mood === 'sad' ? `<path d="M52 70 Q60 64 68 70" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` : mood === 'wow' ? `<ellipse cx="60" cy="68" rx="5" ry="6" fill="#5A1A12" stroke="${INK}" stroke-width="2.2"/>` : `<path d="M52 66 Q60 73.5 68 66" stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
  const hair =
    hat === 'hair'
      ? `<path d="M30 94 Q22 58 33 40 Q45 23 60 23 Q75 23 87 40 Q98 58 90 94 Z" fill="#4A2C1C" stroke="${INK}" stroke-width="2.5"/>`
      : '';
  const top: Record<string, string> = {
    hair: `<path d="M34.5 50 Q35 29 60 28 Q85 29 85.5 50 Q79 37 67 36 Q59 44 46 41 Q39 43 34.5 50 Z" fill="#5A3826" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M44 35 Q54 30 64 32" stroke="#8A5A3E" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="35" cy="65" r="2.4" fill="#F2C14E" stroke="${INK}" stroke-width="1"/><circle cx="85" cy="65" r="2.4" fill="#F2C14E" stroke="${INK}" stroke-width="1"/>`,
    beanie: `<path d="M34 50 Q34 21 60 21 Q86 21 86 50 Z" fill="#E9C46A" stroke="${INK}" stroke-width="2.5"/><path d="M46 26 L44 46 M60 21 L60 46 M74 26 L76 46" stroke="#C9A24A" stroke-width="2"/><rect x="32" y="43" width="56" height="10" rx="5" fill="#C9A24A" stroke="${INK}" stroke-width="2.5"/><circle cx="60" cy="19" r="7" fill="#FFF4E0" stroke="${INK}" stroke-width="2.5"/><circle cx="44" cy="60" r="0.9" fill="#8A4A2A"/><circle cx="41" cy="62" r="0.9" fill="#8A4A2A"/><circle cx="76" cy="60" r="0.9" fill="#8A4A2A"/><circle cx="79" cy="62" r="0.9" fill="#8A4A2A"/>`,
    chef: `<path d="M41 38 L41 23 Q30 22 33 13 Q36 4 47 8 Q51 -1 60 2 Q70 -1 74 8 Q85 4 87 13 Q90 22 79 23 L79 38 Z" fill="#FFFDF8" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M50 24 L50 37 M60 22 L60 37 M70 24 L70 37" stroke="#E4D9C8" stroke-width="2"/><rect x="39" y="33" width="42" height="7" rx="3" fill="#F3EADB" stroke="${INK}" stroke-width="2"/><path d="M45.5 51 L42.5 49 M74.5 51 L77.5 49" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`,
    cap: `<path d="M34 47 Q34 26 60 26 Q86 26 88 45 Z" fill="#4A3B5C" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M60 26 L60 45 M47 29 L44 46 M73 29 L77 45" stroke="#3A2E49" stroke-width="2"/><circle cx="60" cy="26" r="2.6" fill="#3A2E49" stroke="${INK}" stroke-width="1.5"/><path d="M29 46 L94 45 Q97 51 90 52 L33 52 Q26 52 29 46 Z" fill="#3A2E49" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M67 68 L80 64" stroke="#E9D9BC" stroke-width="2.2" stroke-linecap="round"/>`,
    scarf: `<circle cx="37" cy="50" r="5.5" fill="#D8D2CB" stroke="${INK}" stroke-width="2"/><circle cx="83" cy="50" r="5.5" fill="#D8D2CB" stroke="${INK}" stroke-width="2"/><path d="M33 52 Q32 26 60 26 Q88 26 87 52 Q78 38 60 38 Q42 38 33 52 Z" fill="#3E8E8F" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="47" cy="33" r="2" fill="#FFF4E0"/><circle cx="60" cy="30" r="2" fill="#FFF4E0"/><circle cx="73" cy="33" r="2" fill="#FFF4E0"/><circle cx="53" cy="36" r="1.6" fill="#FFF4E0"/><circle cx="67" cy="36" r="1.6" fill="#FFF4E0"/><path d="M86 44 L98 40 L94 50 Z M86 46 L96 56 L88 56 Z" fill="#3E8E8F" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="50" cy="54" r="7.5" stroke="${INK}" stroke-width="2.4" fill="#FFFFFF" fill-opacity="0.12"/><circle cx="70" cy="54" r="7.5" stroke="${INK}" stroke-width="2.4" fill="#FFFFFF" fill-opacity="0.12"/><path d="M57.5 54 L62.5 54" stroke="${INK}" stroke-width="2.4"/>`,
    // Dungeon Joe's Joe: messy dark-brown hair poking out under a dented, riveted helm with a red plume and nose guard
    helm: `<path d="M33 55 Q30 47 35 44 L38 50 Z M87 55 Q90 47 85 44 L82 50 Z" fill="#4A3626" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M60 22 Q66 6 82 4 Q73 13 75 21 Q68 17 60 22 Z" fill="#B23A3A" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><path d="M32 57 Q30 22 60 22 Q90 22 88 57 L81 59 Q81 39 60 37 Q39 39 39 59 Z" fill="#9AA1AD" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M41 31 Q51 25 62 26" stroke="#FFFFFF" stroke-width="2.5" fill="none" opacity="0.5" stroke-linecap="round"/><path d="M60 22 L60 37" stroke="#6E7480" stroke-width="2.5"/><path d="M73 28 L77 32 M70 30 L72 27" stroke="#6E7480" stroke-width="2" stroke-linecap="round"/><circle cx="43" cy="40" r="1.7" fill="#5E6470"/><circle cx="50" cy="37.5" r="1.7" fill="#5E6470"/><circle cx="70" cy="37.5" r="1.7" fill="#5E6470"/><circle cx="77" cy="40" r="1.7" fill="#5E6470"/><rect x="57" y="36" width="6" height="25" rx="2" fill="#9AA1AD" stroke="${INK}" stroke-width="2"/><path d="M46 69 Q60 79 74 69 M48 73 Q60 81 72 73" stroke="#6A4A34" stroke-width="1.6" stroke-dasharray="1.4 2.6" fill="none" stroke-linecap="round"/>`,
  };
  const ring = opts.ring === false ? '' : `<circle cx="60" cy="60" r="57" fill="none" stroke="${b.light}" stroke-width="3" opacity="0.75"/>`;
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs>${ap.defs}<clipPath id="pc-${uid}"><circle cx="60" cy="60" r="58"/></clipPath></defs><g clip-path="url(#pc-${uid})"><circle cx="60" cy="60" r="58" fill="${b.tint}"/><circle cx="60" cy="48" r="40" fill="#FFFFFF" opacity="0.05"/>${hair}<rect x="52" y="70" width="16" height="16" rx="5" fill="${skin}" stroke="${INK}" stroke-width="2.5"/><path d="M15 122 C15 94 36 80 60 80 C84 80 105 94 105 122 Z" fill="${b.coat}" stroke="${INK}" stroke-width="2.5"/><path d="M60 80 C84 80 105 94 105 122 L76 122 C78 104 72 88 60 80 Z" fill="#000000" opacity="0.16"/><path d="M41 89 Q60 85 79 89 L84 122 L36 122 Z" fill="${ap.fill}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>${ap.trim ? `<path d="M41 89 Q60 85 79 89" stroke="${ap.trim}" stroke-width="3.5" fill="none"/><path d="M38.5 106 L81.5 106" stroke="${ap.trim}" stroke-width="2.5"/>` : ''}<rect x="51" y="102" width="18" height="12" rx="3" fill="#EFE0C2" stroke="${INK}" stroke-width="2"/><ellipse cx="73" cy="96" rx="5" ry="2.6" fill="#FFFFFF" opacity="0.7"/><path d="M47 82 L60 93 L73 82" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="35" cy="57" r="5.5" fill="${skin}" stroke="${INK}" stroke-width="2.5"/><circle cx="85" cy="57" r="5.5" fill="${skin}" stroke="${INK}" stroke-width="2.5"/><circle cx="60" cy="53" r="25" fill="${skin}" stroke="${INK}" stroke-width="2.5"/><path d="M66 29 Q86 36 84 58 Q82 70 70 77 Q80 58 66 29 Z" fill="#000000" opacity="0.07"/><path d="M45 46 Q50 43 55 46" stroke="#3A2414" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M65 46 Q70 43 75 46" stroke="#3A2414" stroke-width="2.6" fill="none" stroke-linecap="round"/><ellipse cx="50" cy="54" rx="3" ry="3.7" fill="${INK}"/><circle cx="51.1" cy="52.6" r="1.1" fill="#FFFFFF"/><ellipse cx="70" cy="54" rx="3" ry="3.7" fill="${INK}"/><circle cx="71.1" cy="52.6" r="1.1" fill="#FFFFFF"/><path d="M60 56 Q64 61 59 62.5" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.55"/><ellipse cx="44" cy="62" rx="5" ry="3.2" fill="#E3786A" opacity="0.45"/><ellipse cx="76" cy="62" rx="5" ry="3.2" fill="#E3786A" opacity="0.45"/>${mouth}${top[hat] ?? ''}${badgeMark(cos?.badge ?? 'badge_none')}</g>${ring}</svg>`;
}

/** a rolling pin in the chosen finish (station cards, results) */
export function rollingPin(id: string, w = 96): string {
  const look = COSMETIC[id]?.look ?? ['#D9A46A', '#8A5A35'];
  const [body, handle] = look as [string, string];
  const gem = id === 'pin_geode' ? `<circle cx="48" cy="16" r="4" fill="#B79AF0" stroke="${INK}" stroke-width="1.5"/>` : '';
  const hilt = id === 'pin_bonk' ? `<path d="M8 8 L8 24 M88 8 L88 24" stroke="#5E6470" stroke-width="4" stroke-linecap="round"/>` : '';
  return `<svg width="${w}" height="${Math.round(w / 3)}" viewBox="0 0 96 32" aria-hidden="true"><rect x="2" y="11" width="16" height="10" rx="4" fill="${handle}" stroke="${INK}" stroke-width="2"/><rect x="78" y="11" width="16" height="10" rx="4" fill="${handle}" stroke="${INK}" stroke-width="2"/><rect x="14" y="6" width="68" height="20" rx="9" fill="${body}" stroke="${INK}" stroke-width="2"/><path d="M20 11 L76 11" stroke="#FFFFFF" stroke-width="2.5" opacity="0.45" stroke-linecap="round"/>${gem}${hilt}</svg>`;
}

/** Sheriff Gobbo from Geode Gobbler: a round green rock-eater with a handlebar mustache, tin star and ten-gallon hat */
export function sheriffPortrait(size = 120): string {
  return `<svg viewBox="0 -20 200 190" width="${size}" height="${Math.round(size * 0.95)}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><ellipse cx="100" cy="160" rx="62" ry="8" fill="rgba(0,0,0,.35)"/><ellipse cx="70" cy="150" rx="18" ry="10" fill="#4E8A3A" stroke="${INK}" stroke-width="4"/><ellipse cx="130" cy="150" rx="18" ry="10" fill="#4E8A3A" stroke="${INK}" stroke-width="4"/><path d="M100 18 C155 18 178 60 176 98 C174 138 140 156 100 156 C60 156 26 138 24 98 C22 60 45 18 100 18Z" fill="#7DBE5A" stroke="${INK}" stroke-width="5"/><path d="M150 50 C170 80 168 130 120 152 C150 120 160 90 150 50 Z" fill="#000" opacity="0.12"/><ellipse cx="72" cy="45" rx="20" ry="9" fill="rgba(255,255,255,.3)" transform="rotate(-25 72 45)"/><circle cx="52" cy="100" r="9" fill="rgba(255,120,150,.4)"/><circle cx="148" cy="100" r="9" fill="rgba(255,120,150,.4)"/><ellipse cx="72" cy="72" rx="20" ry="22" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="74" cy="76" r="9" fill="#1b1030"/><circle cx="70" cy="71" r="3" fill="#fff"/><ellipse cx="128" cy="72" rx="20" ry="22" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="126" cy="76" r="9" fill="#1b1030"/><circle cx="122" cy="71" r="3" fill="#fff"/><path d="M70 112 Q100 130 130 112 Q100 122 70 112Z" fill="#3a0d1d" stroke="${INK}" stroke-width="4"/><path d="M84 115 l4 6 l4 -5 M108 116 l4 6 l4 -6" stroke="#fff" stroke-width="3" fill="none"/><path d="M100 104 C88 96 70 98 58 108 C66 104 74 106 78 112 C86 108 94 108 100 104Z M100 104 C112 96 130 98 142 108 C134 104 126 106 122 112 C114 108 106 108 100 104Z" fill="#3a1d0a" stroke="${INK}" stroke-width="3"/><path d="M58 108 q-8 -2 -10 -10 M142 108 q8 -2 10 -10" stroke="#3a1d0a" stroke-width="6" fill="none" stroke-linecap="round"/><polygon points="148,118 152,128 163,128 154,134 158,145 148,138 138,145 142,134 133,128 144,128" fill="#ffd34a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="148" cy="131" r="3" fill="#8a5a00"/><ellipse cx="100" cy="34" rx="78" ry="13" fill="#7a4a22" stroke="${INK}" stroke-width="5"/><path d="M58 34 C58 0 72 -14 84 -6 C92 -2 96 -10 100 -10 C104 -10 108 -2 116 -6 C128 -14 142 0 142 34 Z" fill="#7a4a22" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M60 24 L140 24 L141 32 L59 32 Z" fill="${INK}"/></svg>`;
}
