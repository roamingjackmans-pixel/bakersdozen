// Egg Juggle: eggs arc from hand to hand over the mixing bowl. Tap a hand (or F / J) as an egg drops into it to
// throw it on; after three catches an egg goes into the bowl. A missed egg cracks on the counter, a tap with no egg
// coming is a fumble (and the hand needs a moment). More eggs join once a couple are in the bowl.
// Where and when, without sound or words: a ring closes onto a hand as its next egg drops (it meets the gold ring at
// the moment to tap), the glove taps along with the first catches (and again after a run of drops), and each egg
// carries a pip for every catch it still needs.
import { audio } from '../audio/audio';
import { BAKER } from '../game/data';
import type { GameResult } from '../game/types';
import { Floaters, INK, Particles, W, circle, clamp01, cue, ellipse, fillInk, goalFor, rr, seeded, text, woodBackground, type Live, type MiniEnv, type MiniGame } from './common';

export type Hand = 'L' | 'R';

export interface Egg {
  id: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t0: number;
  t1: number;
  /** height of the arc above the straight line, px */
  h: number;
  to: Hand | 'bowl';
  /** catches it still needs before it goes in the bowl */
  left: number;
  st: 'fly' | 'drop' | 'bowl' | 'gone';
}

export const LX = 480;
export const RX = 960;
/** where a hand catches (the palm) */
export const HY = 520;
export const BOWL = { x: 720, y: 650 };
export const BASKET = { x: 150, y: 610 };
/** catches an egg needs (the first is the throw in from the basket) */
export const CATCHES = 3;
/** a ring starts closing this long before an egg lands */
export const APPROACH = 0.7;
/** two eggs never land in one hand closer together than this */
const GAP = 0.42;
/** px/s² of the arcs: an arc's height follows its time in the air */
const ARC = 168;

export const handX = (hd: Hand): number => (hd === 'L' ? LX : RX);

/** where an egg is at time t (past its landing it keeps falling: a drop) */
export function eggAt(e: Egg, t: number): [number, number] {
  const k = (t - e.t0) / Math.max(0.01, e.t1 - e.t0);
  return [e.x0 + (e.x1 - e.x0) * k, e.y0 + (e.y1 - e.y0) * k - 4 * e.h * k * (1 - k)];
}

/** the counter's egg basket */
export function basket(g: CanvasRenderingContext2D): void {
  const { x, y } = BASKET;
  ellipse(g, x, y + 54, 110, 18, 'rgba(0,0,0,0.25)', 0);
  for (const [ex, ey, r] of [
    [-40, -18, -0.3],
    [0, -26, 0.1],
    [38, -16, 0.35],
    [-16, -6, 0.2],
    [22, -4, -0.2],
  ] as const) ellipse(g, x + ex, y + ey, 19, 24, '#FFF4E0', 3, r);
  g.beginPath();
  g.moveTo(x - 96, y - 6);
  g.lineTo(x + 96, y - 6);
  g.lineTo(x + 78, y + 56);
  g.lineTo(x - 78, y + 56);
  g.closePath();
  fillInk(g, '#B07A3E', 4);
  g.strokeStyle = 'rgba(60,30,10,0.45)';
  g.lineWidth = 3;
  for (let i = 1; i < 4; i++) {
    g.beginPath();
    g.moveTo(x - 96 + i * 3, y - 6 + i * 15);
    g.lineTo(x + 96 - i * 3, y - 6 + i * 15);
    g.stroke();
  }
  for (let i = -3; i <= 3; i++) {
    g.beginPath();
    g.moveTo(x + i * 26, y - 6);
    g.lineTo(x + i * 22, y + 56);
    g.stroke();
  }
}

/** the mixing bowl, `fill` 0..1 of the way to its eggs */
export function eggBowl(g: CanvasRenderingContext2D, fill: number): void {
  const { x, y } = BOWL;
  ellipse(g, x, y - 18, 150, 34, '#5A3A22', 4);
  if (fill > 0) {
    ellipse(g, x, y - 16, 128 * (0.55 + 0.45 * fill), 24 * (0.55 + 0.45 * fill), '#FFF2C2', 0);
    const n = Math.min(9, Math.ceil(fill * 9));
    for (let i = 0; i < n; i++) circle(g, x - 70 + ((i * 53) % 140), y - 18 + ((i * 7) % 3) * 6 - 6, 11, '#F5B82E', 2);
  }
  g.beginPath();
  g.moveTo(x - 152, y - 18);
  g.quadraticCurveTo(x, y + 150, x + 152, y - 18);
  g.closePath();
  fillInk(g, '#3E8E8F', 4);
  g.strokeStyle = '#93D3D2';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(x - 110, y + 14);
  g.quadraticCurveTo(x - 30, y + 66, x + 30, y + 70);
  g.stroke();
}

/** one egg (spun by `rot`), with a pip above it for every catch it still needs */
export function egg(g: CanvasRenderingContext2D, x: number, y: number, rot: number, left: number): void {
  ellipse(g, x, y, 19, 25, '#FFF4E0', 3, rot);
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.beginPath();
  g.ellipse(x - 6, y - 9, 5, 8, rot - 0.4, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < left; i++) circle(g, x - (left - 1) * 8 + i * 16, y - 40, 5, '#FFD166', 2);
}

/** a cupped hand at its catch point, coming up out of a sleeve in the baker's coat */
export function hand(g: CanvasRenderingContext2D, hd: Hand, coat: string, skin: string, dip = 0): void {
  const x = handX(hd);
  const y = HY + dip;
  const s = hd === 'L' ? -1 : 1;
  // the sleeve, from the bottom edge up to the wrist
  g.beginPath();
  g.moveTo(x + s * 120 - 46, 830);
  g.lineTo(x + s * 120 + 46, 830);
  g.lineTo(x + s * 18 + 34, y + 44);
  g.lineTo(x + s * 18 - 34, y + 44);
  g.closePath();
  fillInk(g, coat, 4);
  rr(g, x + s * 18 - 38, y + 30, 76, 24, 10);
  fillInk(g, '#FFF4E0', 3);
  // the cupped palm and its fingers
  g.beginPath();
  g.moveTo(x - 62, y + 2);
  g.quadraticCurveTo(x - 58, y + 40, x, y + 40);
  g.quadraticCurveTo(x + 58, y + 40, x + 62, y + 2);
  g.quadraticCurveTo(x, y + 18, x - 62, y + 2);
  g.closePath();
  fillInk(g, skin, 3);
  for (let i = 0; i < 4; i++) ellipse(g, x - s * (54 - i * 14), y - 2 + Math.abs(i - 1.5) * 3, 8, 11, skin, 2.5);
}

/** the gold catch ring over a hand; `flash` lights it */
export function catchRing(g: CanvasRenderingContext2D, hd: Hand, flash: number, tiny = 1): void {
  const x = handX(hd);
  g.lineWidth = 9 + flash * 6;
  g.strokeStyle = INK;
  g.beginPath();
  g.arc(x, HY - 6, 46 * tiny, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 5 + flash * 6;
  g.strokeStyle = flash > 0 ? '#FFE59A' : '#F2C14E';
  g.stroke();
}

/** the ring closing onto a hand: k 1 → 0 as the egg comes down */
export function closingRing(g: CanvasRenderingContext2D, hd: Hand, k: number, tiny = 1): void {
  g.globalAlpha = 0.35 + 0.65 * (1 - k);
  g.lineWidth = 6;
  g.strokeStyle = '#FFF4E0';
  g.beginPath();
  g.arc(handX(hd), HY - 6, (46 + k * 80) * tiny, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 1;
}

export function juggle(env: MiniEnv): MiniGame {
  const rnd = seeded(env.seed ^ 0x3e66);
  const b = BAKER[env.baker];
  const salt = env.salted ? 0.75 : 1;
  const tiny = env.tiny;
  /** seconds either side of the landing: perfect, and good */
  const perf = 0.055 * env.skill * salt * (tiny < 1 ? 0.85 : 1);
  const good = 0.15 * env.skill * salt * (tiny < 1 ? 0.85 : 1);
  // the objective: this many eggs in the bowl (the pace the score asks for)
  const goal = goalFor(env.seconds, 3.6, 5);
  const eggs: Egg[] = [];
  let id = 1;
  let now = 0;
  let nextSpawn = 0.4;
  let bowl = 0;
  let perfect = 0;
  let goodN = 0;
  let drops = 0;
  let strays = 0;
  let streak = 0;
  let dropRun = 0;
  let lastE = '';
  const busy: Record<Hand, number> = { L: 0, R: 0 };
  const dip: Record<Hand, number> = { L: 0, R: 0 };
  const flash: Record<Hand, number> = { L: 0, R: 0 };
  const splats: { x: number; y: number; t: number }[] = [];
  const fx = new Particles();
  const fl = new Floaters();

  const active = (): Egg[] => eggs.filter((e) => e.st === 'fly');
  const landings = (hd: Hand): number[] => eggs.filter((e) => e.st === 'fly' && e.to === hd).map((e) => e.t1);
  const maxAir = (): number => (bowl < 2 ? 2 : 3);

  /** a time in the air for a throw to `hd` that keeps clear of the eggs already landing there */
  function airTime(hd: Hand, t0: number, lo: number, hi: number): number {
    const land = landings(hd);
    for (let i = 0; i < 10; i++) {
      const d = lo + rnd() * (hi - lo);
      if (land.every((a) => Math.abs(a - (t0 + d)) >= GAP)) return d;
    }
    return Math.max(lo, Math.max(...land) + GAP - t0);
  }

  function throwTo(e: Egg, from: [number, number], t0: number, to: Hand | 'bowl'): void {
    e.x0 = from[0];
    e.y0 = from[1];
    e.t0 = t0;
    e.to = to;
    if (to === 'bowl') {
      e.x1 = BOWL.x + (from[0] < BOWL.x ? -30 : 30);
      e.y1 = BOWL.y - 24;
      e.t1 = t0 + 0.72;
      e.h = 150;
    } else {
      // the highest throw stays under the clock
      const d = airTime(to, t0, 1.05, 1.45);
      e.x1 = handX(to);
      e.y1 = HY - 10;
      e.t1 = t0 + d;
      e.h = ARC * d * d;
    }
    e.st = 'fly';
  }

  function spawn(): void {
    const e: Egg = { id: id++, x0: 0, y0: 0, x1: 0, y1: 0, t0: 0, t1: 0, h: 0, to: 'L', left: CATCHES, st: 'fly' };
    // in from the basket to whichever hand is free sooner
    const to: Hand = landings('L').some((a) => Math.abs(a - (now + 1.1)) < GAP) ? 'R' : 'L';
    throwTo(e, [BASKET.x, BASKET.y - 40], now, to);
    eggs.push(e);
    audio.sfx('tap', 0.5);
  }

  function catchAt(hd: Hand): void {
    if (now < busy[hd]) return;
    // the egg coming down into this hand nearest its landing
    let best: Egg | null = null;
    for (const e of eggs) if (e.st === 'fly' && e.to === hd && Math.abs(now - e.t1) <= good && (!best || Math.abs(now - e.t1) < Math.abs(now - best.t1))) best = e;
    dip[hd] = 1;
    if (!best) {
      // a fumble: the hand needs a moment (mashing loses the next catch)
      strays++;
      busy[hd] = now + 0.28;
      streak = 0;
      audio.sfx('tap', 0.4);
      return;
    }
    const off = Math.abs(now - best.t1);
    const x = handX(hd);
    if (off <= perf) {
      perfect++;
      lastE = 'perfect';
      fl.add('Perfect', x, HY - 90, '#FFD166', 30);
      audio.sfx('perfect', 0.7);
    } else {
      goodN++;
      lastE = 'hit';
      fl.add('Good', x, HY - 90, '#A8D69F', 26);
      audio.sfx('good', 0.7);
    }
    streak++;
    dropRun = 0;
    flash[hd] = 1;
    best.left--;
    throwTo(best, [x, HY - 10], now, best.left <= 0 ? 'bowl' : hd === 'L' ? 'R' : 'L');
  }

  const caught = (): number => perfect + goodN;
  const accuracy = (): number => (perfect + 0.7 * goodN) / Math.max(1, caught() + drops + 0.8 * strays);

  return {
    background(g) {
      woodBackground(g);
      basket(g);
    },
    update(t, dt) {
      now = t;
      fx.update(dt);
      fl.update(dt);
      for (const hd of ['L', 'R'] as const) {
        dip[hd] = Math.max(0, dip[hd] - dt * 6);
        flash[hd] = Math.max(0, flash[hd] - dt * 5);
      }
      for (const e of eggs) {
        if (e.st === 'fly' && e.to === 'bowl' && t >= e.t1) {
          e.st = 'bowl';
          bowl++;
          fx.spawn(BOWL.x, BOWL.y - 30, 14, { color: '#F5B82E', speed: 220, r: 7 });
          fl.add(`${bowl}`, BOWL.x, BOWL.y - 120, '#FFE7A3', 34);
          audio.sfx('squish', 0.8);
        } else if (e.st === 'fly' && e.to !== 'bowl' && t > e.t1 + good) {
          // nobody caught it: it falls past the hand
          e.st = 'drop';
          drops++;
          dropRun++;
          streak = 0;
          lastE = 'miss';
        } else if (e.st === 'drop' && eggAt(e, t)[1] >= 700) {
          e.st = 'gone';
          const [x] = eggAt(e, t);
          splats.push({ x, y: 712, t });
          if (splats.length > 6) splats.shift();
          fx.spawn(x, 700, 12, { color: '#FFF4E0', speed: 200, r: 6 });
          fl.add('Cracked', x, 640, '#E06B5F', 28);
          audio.sfx('collapse', 0.8);
          nextSpawn = Math.max(nextSpawn, t + 0.8);
        }
      }
      const fly = active().length;
      if (t >= nextSpawn && fly < maxAir() && bowl + fly < goal) {
        spawn();
        nextSpawn = t + 0.9;
      }
    },
    draw(g, t) {
      // cracked eggs on the counter
      for (const s of splats) {
        g.globalAlpha = Math.max(0, 1 - (t - s.t) / 6);
        ellipse(g, s.x, s.y, 46, 12, '#FFF8EA', 0);
        circle(g, s.x + 6, s.y - 2, 10, '#F5B82E', 0);
        g.globalAlpha = 1;
      }
      eggBowl(g, Math.min(1, bowl / goal));
      for (const hd of ['L', 'R'] as const) hand(g, hd, env.coat, b.skin, dip[hd] * 12);
      // the rings: gold where to catch, white closing onto it as the next egg comes down
      for (const hd of ['L', 'R'] as const) {
        catchRing(g, hd, flash[hd], tiny);
        const next = landings(hd).filter((a) => a >= t - good).sort((a, c) => a - c)[0];
        if (next !== undefined && next - t <= APPROACH && next >= t) closingRing(g, hd, (next - t) / APPROACH, tiny);
      }
      for (const e of eggs) {
        if (e.st !== 'fly' && e.st !== 'drop') continue;
        let [x, y] = eggAt(e, t);
        if (env.salted) x += Math.sin(t * 9 + e.id) * 6;
        // an egg still waiting at the moment of the catch sits in the palm
        if (e.st === 'fly' && e.to !== 'bowl' && t > e.t1) y = HY - 10;
        egg(g, x, y, (t - e.t0) * 5 * (e.x1 > e.x0 ? 1 : -1), e.st === 'fly' && e.to !== 'bowl' ? e.left : 0);
      }
      fx.draw(g);
      fl.draw(g);
      if (streak >= 3) text(g, `${streak} in a row`, W / 2, 130, { size: 26, color: '#FFD166', stroke: 6, font: 'ui' });
      // the glove taps along with the first catches, and again after a run of drops
      if (caught() < 3 || dropRun >= 2) {
        const soon = eggs.filter((e) => e.st === 'fly' && e.to !== 'bowl').sort((a, c) => a.t1 - c.t1)[0];
        if (soon && soon.t1 - t < 0.9) {
          const hd = soon.to as Hand;
          cue(g, handX(hd), HY + 4, 'tap', clamp01(0.5 - (soon.t1 - t) / 0.9), { label: hd === 'L' ? 'TAP · F' : 'TAP · J' });
        }
      }
    },
    down(x) {
      catchAt(x < W / 2 ? 'L' : 'R');
    },
    move() {},
    up() {},
    key(code, down) {
      if (!down) return;
      if (code === 'KeyF' || code === 'ArrowLeft' || code === 'KeyD') catchAt('L');
      else if (code === 'KeyJ' || code === 'ArrowRight' || code === 'KeyK') catchAt('R');
    },
    finished: () => bowl >= goal,
    goal: () => [bowl, goal],
    peek: () => ({ eggs, now, good, perf }),
    live(): Live {
      return { v: caught() + drops ? accuracy() : 0.5, c: streak, e: lastE };
    },
    result(): GameResult {
      // a few eggs is the pace asked for; one lucky catch is not a whole shift
      const pace = Math.min(1, bowl / goal);
      return { q: clamp01(accuracy() * (0.55 + 0.45 * pace)), perfect };
    },
  };
}
