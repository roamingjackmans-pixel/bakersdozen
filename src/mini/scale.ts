// Scale: weigh by feel. Hold to pour flour (it pours faster the longer you hold), tap for a pinch, then Weigh.
// The needle wobbles (less with Scale skill) and lags a fast pour; on Weigh it settles on the judged weight. The target
// is marked on the dial; Calibrated Scale adds a green zone exactly as wide as a good weigh and steadies the needle. The glove shows where to hold (the sack) and, once you've poured, the Weigh button.
// A nod to the old short-weight laws: the Inspector checks every gram.
import { audio } from '../audio/audio';
import type { GameResult } from '../game/types';
import { Floaters, INK, Particles, circle, cue, ellipse, fillInk, goalFor, loop, rr, seeded, text, woodBackground, type Live, type MiniEnv, type MiniGame } from './common';

export const DX = 820;
export const DY = 330;
export const DR = 190;
export const MAXG = 1000;
export const WEIGH = { x: 1030, y: 640, w: 200, h: 90 };
export const SACK = { x: 520, y: 250 };

const ang = (w: number): number => -Math.PI * 0.75 + (w / MAXG) * Math.PI * 1.5;

/** the score falls to 0 this far off the target (a share of it), along this curve */
const SPREAD = 0.22;
const CURVE = 1.15;
/** a weigh scoring this or better is good: green number, green result chip */
export const GOOD = 0.75;

/** grams off the target where a weigh stops being good. Calibrated Scale's green zone is exactly this wide, so the
 * needle resting in the green always means a good weigh (a fixed ±22 g zone was wider than good below ~450 g) */
export function goodErr(target: number): number {
  return target * SPREAD * (1 - GOOD ** (1 / CURVE));
}

/** how a weigh of `w` grams scores against `target` */
export function judgeWeigh(w: number, target: number): { score: number; good: boolean; exact: boolean } {
  const err = Math.abs(w - target);
  if (err <= 3) return { score: 1, good: true, exact: true };
  const good = err <= goodErr(target);
  const score = Math.max(0, 1 - err / (target * SPREAD)) ** CURVE;
  // the zone's edge, exactly: floating point never puts a green weigh under GOOD or a red one over it
  return { score: good ? Math.max(score, GOOD) : Math.min(score, GOOD - 1e-6), good, exact: false };
}

/** the dial: its face, the target mark (and Calibrated Scale's zone), and the needle at `shown` grams */
export function dial(g: CanvasRenderingContext2D, shown: number, target: number, zone: boolean): void {
  circle(g, DX, DY, DR + 18, '#B9862C', 5);
  circle(g, DX, DY, DR, '#FFF4E0', 4);
  for (let w = 0; w <= MAXG; w += 50) {
    const a = ang(w);
    const r1 = w % 250 === 0 ? DR - 34 : DR - 18;
    g.strokeStyle = INK;
    g.lineWidth = w % 250 === 0 ? 4 : 2;
    g.beginPath();
    g.moveTo(DX + Math.cos(a) * r1, DY + Math.sin(a) * r1);
    g.lineTo(DX + Math.cos(a) * (DR - 6), DY + Math.sin(a) * (DR - 6));
    g.stroke();
    if (w % 250 === 0) text(g, `${w}`, DX + Math.cos(a) * (DR - 58), DY + Math.sin(a) * (DR - 58), { size: 20, color: '#2A1A12', font: 'ui' });
  }
  if (zone) {
    g.strokeStyle = 'rgba(94,154,88,0.85)';
    g.lineWidth = 18;
    g.beginPath();
    g.arc(DX, DY, DR - 16, ang(target - goodErr(target)), ang(target + goodErr(target)));
    g.stroke();
  }
  // the target: a red pointer on the brass rim and a line in to the numbers
  const ta = ang(target);
  const cx = Math.cos(ta);
  const sy = Math.sin(ta);
  g.strokeStyle = '#A8322D';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(DX + cx * (DR - 40), DY + sy * (DR - 40));
  g.lineTo(DX + cx * (DR - 2), DY + sy * (DR - 2));
  g.stroke();
  g.beginPath();
  g.moveTo(DX + cx * (DR + 2), DY + sy * (DR + 2));
  g.lineTo(DX + cx * (DR + 30) - sy * 14, DY + sy * (DR + 30) + cx * 14);
  g.lineTo(DX + cx * (DR + 30) + sy * 14, DY + sy * (DR + 30) - cx * 14);
  g.closePath();
  fillInk(g, '#E06B5F', 3);
  const na = ang(Math.max(0, Math.min(MAXG, shown)));
  g.strokeStyle = INK;
  g.lineWidth = 8;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(DX, DY);
  g.lineTo(DX + Math.cos(na) * (DR - 26), DY + Math.sin(na) * (DR - 26));
  g.stroke();
  g.strokeStyle = '#A8322D';
  g.lineWidth = 4;
  g.stroke();
  circle(g, DX, DY, 14, '#2A1A12', 3);
}

/** the counter, the dial's stand and its foot */
export function housing(g: CanvasRenderingContext2D): void {
  woodBackground(g);
  rr(g, DX - 60, DY + DR - 10, 120, 170, 16);
  fillInk(g, '#8A5A35', 4);
  ellipse(g, DX, DY + 380, 210, 30, '#6B4428', 4);
}

/** the bowl on the counter with `grams` of flour in it */
export function flourBowl(g: CanvasRenderingContext2D, grams: number): void {
  ellipse(g, 560, 600, 130, 30, '#C8553D', 4);
  const pile = Math.min(1, grams / MAXG);
  g.beginPath();
  g.moveTo(450, 590);
  g.quadraticCurveTo(560, 590 - 30 - pile * 120, 670, 590);
  g.closePath();
  fillInk(g, '#FFF8EA', 3);
}

/** the flour sack and its scoop (the place to hold), pouring when `pour` > 0 (0..1 = stream width) */
export function sack(g: CanvasRenderingContext2D, pour: number): void {
  ellipse(g, SACK.x, SACK.y, 90, 100, '#E9D7B0', 4);
  text(g, 'FLOUR', SACK.x, SACK.y + 8, { size: 26, color: '#8A5A35' });
  rr(g, SACK.x + 20, SACK.y + 50, 60, 30, 10);
  fillInk(g, '#9AA1AD', 3);
  if (pour > 0) {
    g.fillStyle = 'rgba(255,248,234,0.9)';
    const wpx = 6 + pour * 16;
    g.fillRect(SACK.x + 40 - wpx / 2, SACK.y + 80, wpx, 230);
  }
}

/** the Weigh button, lit when there's something to weigh */
export function weighButton(g: CanvasRenderingContext2D, ready: boolean, glow = 0): void {
  const b = WEIGH;
  if (glow > 0) {
    g.globalAlpha = glow;
    rr(g, b.x - 8, b.y - 8, b.w + 16, b.h + 16, 24);
    g.fillStyle = '#FFD166';
    g.fill();
    g.globalAlpha = 1;
  }
  rr(g, b.x, b.y, b.w, b.h, 18);
  fillInk(g, ready ? '#F2A541' : '#8A7A66', 4);
  text(g, 'Weigh', b.x + b.w / 2, b.y + b.h / 2, { size: 34, color: '#2A1A12' });
}

interface Target {
  g: number;
  w: number;
  score: number;
  good: boolean;
  done: boolean;
}

export function scale(env: MiniEnv): MiniGame {
  const rnd = seeded(env.seed ^ 0x5ca1e);
  const targets: Target[] = [];
  const add = (): void => {
    targets.push({ g: Math.round((180 + rnd() * 700) / 5) * 5, w: 0, score: 0, good: false, done: false });
  };
  add();
  const cal = env.buffs.includes('scale');
  const wobble = (42 / env.skill / (env.tiny < 1 ? 0.8 : 1)) * (cal ? 0.5 : 1);
  let holding = false;
  let holdT = 0;
  let idle = 0;
  let shown = 0;
  let needleV = 0;
  let pause = 0;
  let lastE = '';
  let combo = 0;
  let pourTick = 0;
  let flicker = 0;
  const fx = new Particles();
  const fl = new Floaters();
  const weighBtn = WEIGH;

  const cur = (): Target => targets[targets.length - 1]!;
  // the objective: this many weighs (the pace the score asks for); the game ends once they're in
  const goal = goalFor(env.seconds, 8, 3);
  const weighed = (): number => targets.filter((x) => x.done).length;

  function weigh(): void {
    const t = cur();
    if (t.done || t.w <= 0 || pause > 0) return;
    t.done = true;
    // the needle settles on the weight being judged: it lags a fast pour, so it could still read green while the bowl
    // is already heavy, and the verdict must never contradict the dial
    shown = t.w;
    needleV = 0;
    const err = Math.abs(t.w - t.g);
    const j = judgeWeigh(t.w, t.g);
    t.score = j.score;
    t.good = j.good;
    if (j.exact) {
      fl.add('Exact', DX, DY - DR - 40, '#FFD166', 42);
      audio.sfx('perfect');
      lastE = 'perfect';
      combo++;
      fx.spawn(DX, DY, 20, { kind: 1, color: '#FFE7A3', speed: 300, r: 12, g: 0 });
    } else if (j.good) {
      fl.add(`${t.w > t.g ? '+' : '−'}${Math.round(err)} g`, DX, DY - DR - 40, '#A8D69F', 36);
      audio.sfx('good');
      lastE = 'hit';
      combo++;
    } else {
      fl.add(t.w > t.g ? 'Too heavy' : 'Short weight', DX, DY - DR - 40, '#E06B5F', 34);
      audio.sfx('miss');
      lastE = 'miss';
      combo = 0;
    }
    pause = 1.4;
  }

  return {
    background(g) {
      housing(g);
    },
    update(_t, dt) {
      fx.update(dt);
      fl.update(dt);
      const t = cur();
      flicker += dt;
      if (pause > 0) {
        pause -= dt;
        if (pause <= 0 && weighed() < goal) {
          add();
          shown = 0;
          holdT = 0;
        }
      } else if (holding && !t.done) {
        holdT += dt;
        const rate = 30 + 270 * Math.min(1, holdT / 1.9) ** 1.6;
        t.w = Math.min(MAXG, t.w + rate * dt);
        idle = 0;
        pourTick += dt;
        if (pourTick > 0.08) {
          pourTick = 0;
          audio.sfx('pour', Math.min(1, rate / 300));
        }
        fx.spawn(560 + (Math.random() - 0.5) * 20, 330, 2, { color: '#FFF8EA', speed: 40, dir: Math.PI / 2, spread: 0.4, r: 4, life: 0.5, g: 900 });
      } else if (!t.done && t.w > 0) {
        idle += dt;
        if (idle > 1.8 && t.w > t.g * 0.4) weigh();
      }
      // the needle chases the weight with a springy lag and a wobble (it is a cheap scale)
      const noise = Math.sin(flicker * 7.3) * wobble * 0.6 + Math.sin(flicker * 13.1) * wobble * 0.4;
      const target = t.w + (t.done ? 0 : noise * Math.min(1, t.w / 80));
      needleV += (target - shown) * 30 * dt;
      needleV *= 0.82;
      shown += needleV * dt * 8;
    },
    draw(g, time) {
      const t = cur();
      sack(g, holding && !t.done ? Math.min(1, holdT / 1.9) : 0);
      flourBowl(g, t.w);
      dial(g, shown, t.g, cal);
      // the target card (Salt Shaker smudges a digit)
      rr(g, 120, 120, 250, 130, 14);
      fillInk(g, '#F3E3C3', 4);
      text(g, 'Target', 245, 150, { size: 20, color: '#8A5A35', font: 'ui' });
      let label = `${t.g} g`;
      if (env.salted && Math.sin(flicker * 3) > -0.3) label = label.replace(/\d(?=\d g)/, '?');
      text(g, label, 245, 205, { size: 52, color: '#2A1A12' });
      if (t.done) text(g, `${Math.round(t.w)} g`, DX, DY + 90, { size: 40, color: '#2A1A12' });
      const ready = t.w > 0 && !t.done;
      weighButton(g, ready, ready && !holding ? 0.25 + 0.2 * Math.sin(time * 6) : 0);
      text(g, 'Space: pour · Enter: weigh', 560, 770, { size: 20, font: 'ui', color: 'rgba(255,244,224,0.7)' });
      // the glove: hold the sack to pour; once there's flour in, tap Weigh
      if (!t.done && pause <= 0) {
        if (t.w <= 0 && !holding) cue(g, SACK.x, SACK.y + 20, 'hold', loop(time, 1.6), { label: 'HOLD TO POUR' });
        else if (ready && !holding && idle > 0.5) cue(g, WEIGH.x + WEIGH.w / 2, WEIGH.y + 12, 'tap', loop(time, 1), { above: true, label: 'TAP' });
      }
      // past results
      targets
        .filter((x) => x.done)
        .slice(-6)
        .forEach((x, i) => {
          rr(g, 110 + i * 80, 300, 68, 44, 10);
          fillInk(g, x.good ? '#A8D69F' : x.score > 0.3 ? '#E9D7B0' : '#E06B5F', 3);
          text(g, `${Math.round(x.score * 100)}`, 144 + i * 80, 322, { size: 22, color: '#2A1A12', font: 'ui' });
        });
      fx.draw(g);
      fl.draw(g);
      if (combo >= 2) text(g, `${combo} on weight`, 245, 400, { size: 26, color: '#FFD166', stroke: 6, font: 'ui' });
    },
    down(x, y) {
      if (x >= weighBtn.x && x <= weighBtn.x + weighBtn.w && y >= weighBtn.y && y <= weighBtn.y + weighBtn.h) return weigh();
      holding = true;
      holdT = 0;
    },
    move() {},
    up() {
      holding = false;
    },
    key(code, down) {
      if (code === 'Space' || code === 'KeyJ' || code === 'KeyF') {
        holding = down;
        if (down) holdT = 0;
      }
      if (down && (code === 'Enter' || code === 'KeyW')) weigh();
    },
    finished: () => weighed() >= goal && pause <= 0,
    goal: () => [weighed(), goal],
    peek: () => ({ target: cur(), pause, weighBtn }),
    live(): Live {
      const done = targets.filter((x) => x.done);
      return { v: done.length ? done.reduce((s, x) => s + x.score, 0) / done.length : 0.5, c: combo, e: lastE };
    },
    result(): GameResult {
      const t = cur();
      if (!t.done && t.w > t.g * 0.3) {
        pause = 0;
        weigh();
      }
      const done = targets.filter((x) => x.done);
      const q = done.length ? done.reduce((s, x) => s + x.score, 0) / done.length : 0;
      const pace = Math.min(1, done.length / goal);
      return { q: q * (0.55 + 0.45 * pace), perfect: done.filter((x) => x.score >= 0.95).length };
    },
    stop() {
      holding = false;
    },
  };
}
