// Shared pieces of the bakery scene: the candle-and-flour ambience, the night window that is the clock (the sky
// moves from midnight to sunrise and the Inspector's lantern walks closer), and the menu's bread display.
import { CLOUDS, CURTAIN, INSPECTOR, MOON, SKYLINE, candleSVG, itemSVG, skyAt } from '../render/art';
import { h, svg } from './dom';

/** candles on the wall at these stage positions, and drifting flour dust */
export function ambient(candles: [number, number][], motes = 9): HTMLElement {
  const wrap = h('div.ambient');
  candles.forEach(([x, y], i) => {
    const c = svg(candleSVG(i * 0.4), 'candle');
    c.setAttribute('style', `left:${x - 60}px;top:${y - 90}px;width:120px;height:140px`);
    wrap.appendChild(c);
  });
  const spots = [
    [90, 760],
    [300, 700],
    [520, 780],
    [760, 720],
    [980, 770],
    [1180, 700],
    [1350, 760],
    [640, 560],
    [1100, 520],
  ];
  for (let i = 0; i < Math.min(motes, spots.length); i++) {
    const [x, y] = spots[i]!;
    const r = 2 + (i % 3);
    wrap.appendChild(h('span.mote.bd-mo', { style: `left:${x}px;top:${y}px;width:${r * 2}px;height:${r * 2}px;animation-delay:${(i * 1.3) % 8}s` }));
  }
  return wrap;
}

const STARS: [number, number, number, number][] = [
  [45, 13, 5, 2.0],
  [13, 38, 3, 1.1],
  [11, 36, 4, 0.1],
  [59, 30, 3, 0.7],
  [74, 31, 3, 2.5],
  [19, 18, 6, 2.8],
  [77, 41, 5, 0.1],
  [32, 6, 6, 2.6],
  [41, 30, 4, 1.6],
  [77, 23, 6, 2.4],
  [27, 10, 6, 1.7],
  [28, 27, 3, 1.6],
  [12, 40, 3, 1.9],
  [67, 47, 6, 1.3],
  [44, 33, 6, 2.8],
  [50, 23, 4, 2.4],
  [93, 19, 3, 1.7],
  [71, 35, 4, 2.2],
  [40, 42, 3, 0.4],
  [57, 14, 4, 0.5],
  [66, 30, 3, 2.9],
  [13, 52, 6, 1.7],
];

export interface NightWindow {
  el: HTMLElement;
  /** t 0..1 through the night; away = orders until the Inspector is at the door */
  set(t: number, away: number | null): void;
}

export function nightWindow(arch: number, opts: { chip?: boolean; width?: number } = {}): NightWindow {
  const sky = h('div', { style: 'inset:0' });
  const stars = h('div', { style: 'inset:0' });
  for (const [x, y, s, d] of STARS) stars.appendChild(h('span.bd-tw', { style: `position:absolute;left:${x}%;top:${y}%;width:${s}px;height:${s}px;border-radius:50%;background:#FFF4E0;animation-delay:${d}s` }));
  stars.appendChild(svg(MOON)).setAttribute('style', 'position:absolute;left:14%;top:9%');
  const horizon = h('div', { style: 'left:0;right:0;bottom:0;height:150px' });
  const clouds = svg(CLOUDS);
  clouds.setAttribute('style', 'position:absolute;left:8%;top:18%;opacity:0');
  const sun = h('span', { style: 'left:66%;width:72px;height:72px;border-radius:50%;background:#FFD27A;box-shadow:0 0 0 10px rgba(255,210,122,0.25),0 0 50px 20px rgba(255,190,110,0.45)' });
  const sky2 = svg(SKYLINE);
  sky2.setAttribute('style', 'position:absolute;left:0;bottom:0;width:100%;height:120px');
  (sky2.firstElementChild as SVGElement | null)?.setAttribute('style', 'width:100%;height:120px');
  const lantern = h('div', { style: 'bottom:10px' });
  const cl = svg(CURTAIN);
  cl.setAttribute('style', 'position:absolute;left:0;top:0;height:100%');
  (cl.firstElementChild as SVGElement).setAttribute('height', '100%');
  const cr = svg(CURTAIN);
  cr.setAttribute('style', 'position:absolute;right:0;top:0;height:100%;transform:scaleX(-1)');
  (cr.firstElementChild as SVGElement).setAttribute('height', '100%');
  const chip = h('span.inspector-chip');
  const glass = h('div.window-glass', { style: `border-radius:${arch - 12}px ${arch - 12}px 10px 10px` }, sky, stars, horizon, clouds, sun, sky2, lantern, cl, cr, h('span.mullion-v'), h('span.mullion-h'), opts.chip === false ? '' : chip);
  const el = h('div.window-frame', { style: `border-radius:${arch}px ${arch}px 20px 20px` }, glass);
  const lanternSvg = (w: number, hh: number): string => INSPECTOR(w, hh);
  let lastKey = '';
  return {
    el,
    set(t: number, away: number | null): void {
      const k = Math.max(0, Math.min(1, t));
      const s = skyAt(k);
      sky.style.background = s.sky;
      stars.style.opacity = String(s.starOp);
      horizon.style.background = `linear-gradient(to top, ${s.horizon}, rgba(0,0,0,0))`;
      clouds.style.opacity = String(s.cloudOp);
      sun.style.top = `${s.sunTop + (opts.width ? 160 : 0)}px`;
      // the sun only comes up towards dawn
      sun.style.opacity = String(Math.max(0, Math.min(1, (k - 0.5) / 0.25)));
      const w = Math.round(40 * s.lanternScale);
      const hh = Math.round(54 * s.lanternScale);
      const key = `${w}x${hh}`;
      if (key !== lastKey) {
        lastKey = key;
        lantern.innerHTML = lanternSvg(w, hh);
      }
      lantern.style.left = `${(opts.width ?? 700) * (s.lanternX / 760)}px`;
      lantern.style.transition = 'left 1.2s ease';
      if (away !== null) chip.innerHTML = `<svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true"><rect x="2" y="4" width="10" height="12" rx="2" fill="#FFD27A" stroke="#1E120C" stroke-width="1.5"/><path d="M4 4 Q7 0 10 4" stroke="#FFD27A" stroke-width="1.5" fill="none"/></svg>Inspector · ${away <= 0 ? 'at the door' : away === 1 ? '1 order away' : `${away} orders away`}`;
    },
  };
}

/** the main menu's bread display on a shelf, with the geode from Geode Gobbler in among the loaves */
export function breadShelf(): HTMLElement {
  const loaves = ['boule', 'croissant', 'baguette', 'bun', 'pretzel', 'loaf'];
  const row = h('div', { style: 'position:absolute;left:40px;right:40px;bottom:46px;display:flex;justify-content:space-around;align-items:flex-end' });
  loaves.forEach((l, i) => {
    row.appendChild(svg(itemSVG(l, 96), i % 2 ? 'bd-st' : ''));
    if (i === 3)
      row.appendChild(
        svg(
          `<svg width="64" height="52" viewBox="0 0 64 52" aria-hidden="true"><ellipse cx="32" cy="48" rx="24" ry="4" fill="rgba(0,0,0,0.25)"/><path d="M10 40 Q6 18 22 10 Q38 2 52 14 Q62 28 54 42 Z" fill="#6A5A70" stroke="#1E120C" stroke-width="2.5"/><path d="M18 36 Q16 22 26 16 Q38 10 46 20 Q52 30 46 38 Z" fill="#B79AF0" stroke="#1E120C" stroke-width="2"/><path d="M24 22 L30 18 L36 24 L30 32 Z" fill="#E8D8FF"/><path d="M38 26 L44 24 L44 32 Z" fill="#8E6AD8"/><path class="bd-sp" d="M50 8 Q51 4 52 8 Q56 9 52 10 Q51 14 50 10 Q46 9 50 8Z" fill="#FFE7A3"/></svg>`,
          'geode',
        ),
      );
  });
  return h(
    'div',
    { style: 'position:relative;height:150px;margin-top:-40px' },
    svg(`<svg width="100%" height="150" viewBox="0 0 760 150" preserveAspectRatio="none" aria-hidden="true"><rect x="-20" y="104" width="800" height="46" rx="10" fill="#6B4428" stroke="#1E120C" stroke-width="2.5"/><rect x="-20" y="104" width="800" height="8" fill="#8A5A35"/></svg>`),
    row,
  );
}
