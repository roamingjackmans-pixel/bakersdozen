// Fold: shape pretzels and croissants. Each pastry is two or three moves: grab the green end, drag it to its gold
// ring, let go on it. The dough is springy: its end trails your finger and swings past where you stop, so a quick
// drag has to settle before you let go. Let go far from the ring and it springs back (a miss); the closer to the
// ring's middle, the better the move. Pretzel: each arm over to the far side of the belly. Croissant: roll it up from
// the base to the tip, then curl each horn in.
// Cues: the glove drags from the green end to the ring (the first moves, and after a few idle seconds); LET GO shows
// once the end is on the ring and still.
import { audio } from '../audio/audio';
import type { GameResult } from '../game/types';
import { Floaters, INK, Particles, W, board, circle, cue, fillInk, goalFor, loop, pill, seeded, text, woodBackground, type Live, type MiniEnv, type MiniGame } from './common';

export type Shape = 'pretzel' | 'croissant';
type P = [number, number];

export interface Move {
  from: P;
  to: P;
  /** the croissant's roll runs straight up its middle */
  axis: boolean;
}

export const SHAPES: Record<Shape, Move[]> = {
  pretzel: [
    { from: [420, 250], to: [800, 556], axis: false },
    { from: [1020, 250], to: [640, 556], axis: false },
  ],
  croissant: [
    { from: [720, 640], to: [720, 300], axis: true },
    { from: [540, 300], to: [600, 430], axis: false },
    { from: [900, 300], to: [840, 430], axis: false },
  ],
};

/** the floured board the pastry sits on */
export function foldBoard(g: CanvasRenderingContext2D): void {
  woodBackground(g);
  board(g, 300, 140, 840, 600);
}

const DOUGH = '#F3D9A4';

function bez(a: P, c: P, b: P, s: number): P {
  const u = 1 - s;
  return [u * u * a[0] + 2 * u * s * c[0] + s * s * b[0], u * u * a[1] + 2 * u * s * c[1] + s * s * b[1]];
}
function cubic(a: P, c1: P, c2: P, b: P, s: number): P {
  const u = 1 - s;
  return [u * u * u * a[0] + 3 * u * u * s * c1[0] + 3 * u * s * s * c2[0] + s * s * s * b[0], u * u * u * a[1] + 3 * u * u * s * c1[1] + 3 * u * s * s * c2[1] + s * s * s * b[1]];
}

/** a rope of dough along points, each with its own radius: the ink outline first, then the dough */
function rope(g: CanvasRenderingContext2D, pts: P[], r: (i: number) => number, fill = DOUGH): void {
  g.fillStyle = INK;
  for (let i = 0; i < pts.length; i++) {
    g.beginPath();
    g.arc(pts[i]![0], pts[i]![1], r(i) + 3, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = fill;
  for (let i = 0; i < pts.length; i++) {
    g.beginPath();
    g.arc(pts[i]![0], pts[i]![1], r(i), 0, Math.PI * 2);
    g.fill();
  }
}

const sample = (n: number, f: (s: number) => P): P[] => Array.from({ length: n + 1 }, (_, i) => f(i / n));

/** a pretzel with its arms' ends at e1 and e2 (`salted` once it's done) */
export function pretzel(g: CanvasRenderingContext2D, e1: P, e2: P, done = false): void {
  const LS: P = [600, 380];
  const RS: P = [840, 380];
  const arm = (sh: P, e: P): P[] => sample(26, (s) => bez(sh, [(sh[0] + e[0]) / 2, Math.min(sh[1], e[1]) - 100], e, s));
  const belly = sample(40, (s) => cubic(LS, [520, 660], [920, 660], RS, s));
  rope(g, belly, () => 17);
  rope(g, arm(LS, e1), () => 17);
  rope(g, arm(RS, e2), () => 17);
  if (done) {
    g.fillStyle = '#FFFFFF';
    for (let i = 0; i < 26; i++) {
      const p = belly[(i * 7) % belly.length]!;
      g.fillRect(p[0] - 3 + ((i * 13) % 9) - 4, p[1] - 3 + ((i * 5) % 7) - 3, 5, 5);
    }
  }
}

/** a croissant rolled up to `roll` (y of the roll, 640 = flat, 300 = rolled) with its horns' ends at h1 and h2 */
export function croissant(g: CanvasRenderingContext2D, roll: number, h1: P, h2: P, done = false): void {
  const tip: P = [720, 250];
  const rolled = Math.max(0, Math.min(1, (640 - roll) / 340));
  // what's still flat: a triangle from the roll up to the tip
  if (roll > tip[1] + 20) {
    const half = 180 * ((roll - tip[1]) / (640 - tip[1]));
    g.beginPath();
    g.moveTo(720 - half, roll);
    g.lineTo(720 + half, roll);
    g.lineTo(tip[0], tip[1]);
    g.closePath();
    fillInk(g, DOUGH, 3);
    g.strokeStyle = 'rgba(160,110,50,0.25)';
    g.lineWidth = 3;
    for (let k = 1; k < 4; k++) {
      const y = roll - ((roll - tip[1]) * k) / 4;
      const w = half * (1 - k / 4);
      g.beginPath();
      g.moveTo(720 - w, y);
      g.lineTo(720 + w, y);
      g.stroke();
    }
  }
  // the roll: thicker the further it's rolled, its ends where the horns are
  const mid: P = [720, roll - 6];
  const pts = sample(36, (s) => bez(h1, [mid[0], mid[1] - 30 * rolled], h2, s));
  const r0 = 14 + 22 * rolled;
  rope(g, pts, (i) => r0 * (0.55 + 0.45 * Math.sin((i / 36) * Math.PI)), done ? '#EFCB86' : DOUGH);
  g.strokeStyle = 'rgba(150,95,40,0.5)';
  g.lineWidth = 3;
  for (const s of [0.22, 0.36, 0.5, 0.64, 0.78]) {
    const [x, y] = pts[Math.round(s * 36)]!;
    const r = r0 * (0.55 + 0.45 * Math.sin(s * Math.PI)) * 0.8;
    g.beginPath();
    g.moveTo(x - r * 0.4, y - r);
    g.quadraticCurveTo(x + r * 0.3, y, x - r * 0.4, y + r);
    g.stroke();
  }
}

/** the gold ring to let go on (the dot in its middle is a perfect move) */
export function foldRing(g: CanvasRenderingContext2D, x: number, y: number, r: number, hot: boolean, t: number): void {
  g.lineWidth = 9;
  g.strokeStyle = INK;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 5;
  g.strokeStyle = hot ? '#FFE59A' : '#F2C14E';
  g.stroke();
  circle(g, x, y, 7 + (hot ? 2 * Math.sin(t * 12) : 0), '#FFD166', 2.5);
}

/** the green end to grab */
export function grabDot(g: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  circle(g, x, y, 20 + Math.sin(t * 6) * 3, '#5E9A58', 3);
  circle(g, x, y, 8, '#A8D69F', 0);
}

export function fold(env: MiniEnv): MiniGame {
  const rnd = seeded(env.seed ^ 0xf01d);
  const tinyK = env.tiny < 1 ? 0.7 : 1;
  /** let go within this of the ring's middle: a perfect move; within catchR it holds (worse further out) */
  const perfR = 14 * env.skill * tinyK;
  const catchR = 92 * env.skill * tinyK;
  const ringR = 36 * env.skill * tinyK;
  // Salted: bouncier dough (it swings further and settles slower)
  const K = env.salted ? 210 : 170;
  const C = 2 * Math.sqrt(K) * (env.salted ? 0.24 : 0.42);
  const goal = goalFor(env.seconds, 8, 3);

  let shape: Shape = rnd() < 0.5 ? 'pretzel' : 'croissant';
  let step = 0;
  /** where each move's end was let go (done moves) */
  let placed: P[] = [];
  /** where each move's end rests (a croissant's horns sit wherever its roll ended up) */
  let homes: P[] = SHAPES[shape].map((m) => [...m.from] as P);
  let scores: number[] = [];
  const all: number[] = [];
  let pastries = 0;
  let misses = 0;
  let p: P = [...SHAPES[shape][0]!.from];
  let v: P = [0, 0];
  let grab = false;
  let finger: P = [0, 0];
  /** a finished pastry sliding off (1 → 0), then the next sliding in (0 → 1) */
  let out = 0;
  let inK = 1;
  let lastAct = 0;
  let now = 0;
  let streak = 0;
  let lastE = '';
  let movesDone = 0;
  const shelf: Shape[] = [];
  const fx = new Particles();
  const fl = new Floaters();

  const move = (): Move | undefined => SHAPES[shape][step];
  const busy = (): boolean => out > 0 || inK < 1;

  function nextPastry(): void {
    shape = rnd() < 0.5 ? 'pretzel' : 'croissant';
    step = 0;
    placed = [];
    scores = [];
    homes = SHAPES[shape].map((m) => [...m.from] as P);
    p = [...homes[0]!];
    v = [0, 0];
    inK = 0;
  }

  function letGo(): void {
    const m = move();
    if (!m) return;
    grab = false;
    const d = Math.hypot(p[0] - m.to[0], p[1] - m.to[1]);
    if (d > catchR) {
      // too far: the dough springs back
      misses++;
      streak = 0;
      lastE = 'miss';
      fl.add('Springs back', p[0], p[1] - 50, '#E9D7B0', 24);
      audio.sfx('miss', 0.6);
      return;
    }
    const s = d <= perfR ? 1 : 1 - (0.7 * (d - perfR)) / (catchR - perfR);
    scores.push(s);
    all.push(s);
    placed.push([p[0], p[1]]);
    movesDone++;
    if (s >= 0.9) {
      fl.add('Perfect', m.to[0], m.to[1] - 60, '#FFD166', 32);
      audio.sfx('perfect', 0.7);
      lastE = 'perfect';
      streak++;
    } else {
      fl.add(s >= 0.65 ? 'Good' : 'Sloppy', m.to[0], m.to[1] - 60, s >= 0.65 ? '#A8D69F' : '#E9D7B0', 28);
      audio.sfx('squish', 0.8);
      lastE = 'hit';
      streak = s >= 0.65 ? streak + 1 : 0;
    }
    fx.spawn(m.to[0], m.to[1], 8, { color: '#FFF8EA', speed: 140, r: 6 });
    step++;
    // a croissant's horns are the ends of its roll, wherever it was let go
    if (shape === 'croissant' && step === 1) {
      homes[1] = [540, placed[0]![1]];
      homes[2] = [900, placed[0]![1]];
    }
    const nm = move();
    if (nm) {
      p = [...homes[step]!];
      v = [0, 0];
    } else {
      pastries++;
      shelf.push(shape);
      if (shelf.length > 8) shelf.shift();
      audio.sfx('ding', 0.7);
      out = 1;
    }
  }

  const quality = (): number => (all.length ? all.reduce((a, b) => a + b, 0) / (all.length + 0.5 * misses) : 0);

  return {
    background: foldBoard,
    update(t, dt) {
      now = t;
      fx.update(dt);
      fl.update(dt);
      if (out > 0) {
        out = Math.max(0, out - dt * 1.6);
        if (out === 0 && pastries < goal) nextPastry();
        return;
      }
      if (inK < 1) {
        inK = Math.min(1, inK + dt * 2.6);
        return;
      }
      const m = move();
      if (!m) return;
      // the end chases your finger (or springs home) on a spring: a few substeps keep it steady
      const home = homes[step]!;
      let tx = grab ? finger[0] : home[0];
      let ty = grab ? finger[1] : home[1];
      if (m.axis) {
        tx = m.from[0];
        ty = Math.max(m.to[1] - 70, Math.min(m.from[1], ty));
      }
      const n = 4;
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        v[0] += (K * (tx - p[0]) - C * v[0]) * h;
        v[1] += (K * (ty - p[1]) - C * v[1]) * h;
        p[0] += v[0] * h;
        p[1] += v[1] * h;
      }
      if (m.axis) p[0] = m.from[0];
    },
    draw(g, t) {
      const slide = out > 0 ? (1 - out) * 900 : (inK - 1) * 700;
      g.save();
      g.translate(slide, 0);
      const ms = SHAPES[shape];
      const at = (i: number): P => (i < step ? placed[i]! : i === step ? p : homes[i]!);
      if (shape === 'pretzel') pretzel(g, at(0), at(1), step >= ms.length);
      else {
        const roll = step === 0 ? p[1] : placed[0]![1];
        const end1: P = step > 1 ? placed[1]! : step === 1 ? p : [540, roll];
        const end2: P = step > 2 ? placed[2]! : step === 2 ? p : [900, roll];
        croissant(g, roll, step === 0 ? [540, roll] : end1, step === 0 ? [900, roll] : end2, step >= ms.length);
      }
      const m = move();
      if (m && !busy()) {
        const d = Math.hypot(p[0] - m.to[0], p[1] - m.to[1]);
        const still = Math.hypot(v[0], v[1]) < 60;
        foldRing(g, m.to[0], m.to[1], ringR, d <= ringR, t);
        if (!grab) grabDot(g, p[0], p[1], t);
        else if (d <= ringR && still) pill(g, 'LET GO', m.to[0], m.to[1] - ringR - 34, 22);
        // the glove shows the move: the first ones, and after a few idle seconds
        const hm = homes[step]!;
        if (!grab && (movesDone < 2 || now - lastAct > 3)) cue(g, hm[0], hm[1], 'drag', loop(t, 1.8), { dx: m.to[0] - hm[0], dy: m.to[1] - hm[1], label: 'DRAG' });
      }
      g.restore();
      // the finished pastries along the bottom of the board
      shelf.forEach((s, i) => {
        const x = 380 + i * 92;
        g.save();
        g.translate(x, 700);
        g.scale(0.16, 0.16);
        g.translate(-720, -430);
        if (s === 'pretzel') pretzel(g, [800, 556], [640, 556], true);
        else croissant(g, 300, [600, 430], [840, 430], true);
        g.restore();
      });
      fx.draw(g);
      fl.draw(g);
      if (streak >= 3) text(g, `${streak} in a row`, W / 2, 112, { size: 26, color: '#FFD166', stroke: 6, font: 'ui' });
    },
    down(x, y) {
      lastAct = now;
      if (busy() || !move()) return;
      // grab the end (where it is now: it may still be swinging)
      if (Math.hypot(x - p[0], y - p[1]) <= 64) {
        grab = true;
        finger = [x, y];
        audio.sfx('tap', 0.5);
      }
    },
    move(x, y) {
      if (grab) {
        finger = [x, y];
        lastAct = now;
      }
    },
    up() {
      if (grab) letGo();
    },
    key() {},
    finished: () => pastries >= goal && out === 0,
    goal: () => [pastries, goal],
    peek: () => ({ p, v, grab, move: busy() ? undefined : move(), home: homes[step], catchR, perfR, pastries, misses }),
    live(): Live {
      return { v: all.length ? quality() : 0.5, c: streak, e: lastE };
    },
    result(): GameResult {
      const pace = Math.min(1, pastries / goal);
      return { q: Math.max(0, Math.min(1, quality() * (0.55 + 0.45 * pace))), perfect: all.filter((s) => s >= 0.9).length };
    },
    stop() {
      grab = false;
    },
  };
}

