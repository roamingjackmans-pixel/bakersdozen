// Proof: push your luck. Hold to let the dough rise, let go to bake it. Every dough has a hidden peak: rise past it
// and it collapses. Bailing early is safe but plain. Let go at the exact peak for a Natural 20.
// The dough trembles just before it goes (longer with Proof skill); Baker's Nose adds a shimmer warning. The glove
// shows where to hold, the first doughs say "let go to bake", and the ruler is shaded where doughs start to give.
import { audio } from '../audio/audio';
import type { GameResult } from '../game/types';
import { Floaters, INK, Particles, cue, ellipse, fillInk, loop, pill, rr, seeded, sparkle, text, woodBackground, type Live, type MiniEnv, type MiniGame } from './common';

interface Dough {
  peak: number;
  h: number;
  state: 'wait' | 'rise' | 'baked' | 'collapsed';
  score: number;
  t: number;
}

export const BX = 560;
export const BY = 560;

/** the proofing cabinet's ruler, shaded from 50 % up: most doughs give somewhere in there */
export function ruler(g: CanvasRenderingContext2D): void {
  rr(g, 860, 150, 90, 420, 14);
  fillInk(g, '#E9D7B0', 4);
  const gr = g.createLinearGradient(0, 360, 0, 160);
  gr.addColorStop(0, 'rgba(242,193,78,0.15)');
  gr.addColorStop(0.5, 'rgba(242,140,60,0.45)');
  gr.addColorStop(1, 'rgba(200,60,45,0.6)');
  g.fillStyle = gr;
  g.fillRect(863, 160, 84, 200);
  for (let i = 0; i <= 10; i++) {
    const y = 560 - i * 40;
    g.fillStyle = INK;
    g.fillRect(860, y - 1.5, i % 5 === 0 ? 40 : 24, 3);
    if (i % 5 === 0) text(g, `${i * 10}`, 920, y, { size: 22, color: '#2A1A12', font: 'ui' });
  }
}

/** the dough `h` high in the bowl (0..1+), shaken sideways by `sx`; returns the dough's top */
export function bowl(g: CanvasRenderingContext2D, h: number, fill: string, sx = 0): number {
  ellipse(g, BX, BY + 10, 230, 40, '#5A3A22', 4);
  const top = BY - 30 - h * 380;
  g.beginPath();
  g.moveTo(BX - 200, BY);
  g.bezierCurveTo(BX - 205 + sx, top + 40, BX - 120 + sx, top, BX + sx, top);
  g.bezierCurveTo(BX + 120 + sx, top, BX + 205 + sx, top + 40, BX + 200, BY);
  g.closePath();
  fillInk(g, fill, 4);
  g.fillStyle = 'rgba(255,255,255,0.32)';
  g.beginPath();
  g.ellipse(BX - 70 + sx, top + 50, 50, 18, -0.3, 0, Math.PI * 2);
  g.fill();
  // bowl front
  g.beginPath();
  g.moveTo(BX - 240, BY - 10);
  g.quadraticCurveTo(BX, BY + 220, BX + 240, BY - 10);
  g.closePath();
  fillInk(g, '#C8553D', 4);
  g.strokeStyle = '#E98A74';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(BX - 180, BY + 30);
  g.quadraticCurveTo(BX - 60, BY + 110, BX + 40, BY + 112);
  g.stroke();
  return top;
}

/** the rise marker on the ruler */
export function riseMark(g: CanvasRenderingContext2D, h: number): void {
  const my = 560 - Math.min(1.1, h) * 400;
  g.beginPath();
  g.moveTo(850, my);
  g.lineTo(826, my - 14);
  g.lineTo(826, my + 14);
  g.closePath();
  fillInk(g, '#F2A541', 3);
  text(g, `${Math.round(h * 100)}%`, 790, my, { size: 30, stroke: 6 });
}

export function proof(env: MiniEnv): MiniGame {
  const rnd = seeded(env.seed ^ 0x9f3);
  const doughs: Dough[] = [];
  const newDough = (): Dough => {
    // a few stubborn doughs peak low; most rise high
    const r = rnd();
    const peak = r < 0.2 ? 0.5 + rnd() * 0.15 : 0.68 + rnd() * 0.31;
    return { peak, h: 0, state: 'wait', score: 0, t: 0 };
  };
  doughs.push(newDough());
  const nose = env.buffs.includes('nose');
  const warn = 0.055 * env.skill * (env.tiny < 1 ? 0.75 : 1);
  let holding = false;
  let nat20 = false;
  let lastE = '';
  let combo = 0;
  let pause = 0;
  let salt = 0;
  const fx = new Particles();
  const fl = new Floaters();
  let riseTick = 0;

  const cur = (): Dough => doughs[doughs.length - 1]!;

  function bake(): void {
    const d = cur();
    if (d.state !== 'rise') return;
    d.state = 'baked';
    d.score = Math.min(1, d.h / d.peak);
    d.t = 0;
    const exact = d.peak - d.h <= 0.012;
    if (exact) {
      nat20 = true;
      fl.add('Natural 20', BX, BY - 360, '#C3B0F0', 42);
      fx.spawn(BX, BY - 200, 26, { kind: 1, color: '#E8D8FF', speed: 320, r: 12, g: 0 });
      audio.sfx('nat20');
      lastE = 'perfect';
      combo++;
    } else if (d.score >= 0.9) {
      fl.add('Perfect', BX, BY - 340, '#FFD166');
      audio.sfx('perfect');
      lastE = 'perfect';
      combo++;
    } else if (d.score >= 0.65) {
      fl.add('Good', BX, BY - 340, '#A8D69F', 30);
      audio.sfx('good');
      lastE = 'hit';
      combo++;
    } else {
      fl.add('Plain', BX, BY - 340, '#E9D7B0', 28);
      audio.sfx('good', 0.6);
      lastE = 'hit';
      combo = 0;
    }
    pause = 0.85;
  }

  function collapse(): void {
    const d = cur();
    d.state = 'collapsed';
    d.score = 0;
    d.t = 0;
    fl.add('Collapsed', BX, BY - 300, '#E06B5F', 32);
    fx.spawn(BX, BY - 120, 18, { color: '#F3D9A4', speed: 260, r: 9 });
    audio.sfx('collapse');
    lastE = 'miss';
    combo = 0;
    pause = 1;
  }

  return {
    background(g) {
      woodBackground(g);
      ruler(g);
    },
    update(_t, dt) {
      fx.update(dt);
      fl.update(dt);
      const d = cur();
      if (pause > 0) {
        pause -= dt;
        d.t += dt;
        if (pause <= 0) doughs.push(newDough());
        return;
      }
      if (d.state === 'wait' && holding) d.state = 'rise';
      if (d.state === 'rise') {
        if (!holding) return bake();
        // Salt Shaker: the rise stutters and lurches
        let k = 0.62;
        if (env.salted) {
          salt += dt * 3.3;
          k *= 0.6 + Math.abs(Math.sin(salt)) * 0.9;
        }
        d.h += k * (0.28 + d.h) * dt;
        riseTick += dt;
        if (riseTick > 0.12) {
          riseTick = 0;
          audio.sfx('rise', d.h);
        }
        if (d.h > d.peak) collapse();
      }
    },
    draw(g, t) {
      const d = cur();
      const h = d.state === 'collapsed' ? Math.max(0.08, d.h * (1 - Math.min(1, d.t * 3))) : d.h;
      // tremble just before the peak
      const near = d.state === 'rise' ? d.peak - d.h : 1;
      const shake = near < warn ? (1 - near / warn) * 7 : 0;
      const sx = shake ? Math.sin(t * 70) * shake : 0;
      const top = bowl(g, h, d.state === 'baked' ? '#D98A3A' : d.state === 'collapsed' ? '#D8C08A' : '#F3D9A4', sx);
      // Baker's Nose: a shimmer from a little further out
      if (nose && d.state === 'rise' && near < 0.13) {
        const k = 1 - near / 0.13;
        for (let i = 0; i < 5; i++) {
          const a = t * 2 + i * 1.3;
          g.globalAlpha = k * (0.5 + 0.5 * Math.sin(t * 9 + i));
          sparkle(g, BX + Math.cos(a) * 150, top + 30 + Math.sin(a * 1.3) * 30, 10 + k * 8, '#FFE7A3');
        }
        g.globalAlpha = 1;
      }
      riseMark(g, h);
      fx.draw(g);
      fl.draw(g);
      // the line of finished doughs
      const done = doughs.filter((x) => x.state === 'baked' || x.state === 'collapsed');
      done.slice(-8).forEach((x, i) => {
        const cx = 140 + i * 70;
        if (x.state === 'baked') {
          ellipse(g, cx, 700, 28, 18 + x.score * 6, '#D98A3A', 3);
          g.strokeStyle = '#B8692A';
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(cx - 10, 694);
          g.lineTo(cx + 10, 704);
          g.stroke();
        } else ellipse(g, cx, 708, 30, 9, '#D8C08A', 3);
      });
      // where to hold, and (for the first doughs) what letting go does
      if (d.state === 'wait' && pause <= 0) cue(g, BX, BY - 70, 'hold', loop(t, 1.6), { label: 'HOLD' });
      else if (d.state === 'rise' && doughs.length <= 2) pill(g, 'LET GO TO BAKE', BX, Math.max(150, top - 50), 24);
      if (combo >= 3) text(g, `${combo} in a row`, BX, 120, { size: 26, color: '#FFD166', stroke: 6, font: 'ui' });
    },
    down() {
      holding = true;
    },
    move() {},
    up() {
      holding = false;
    },
    key(code, down) {
      if (code === 'Space' || code === 'Enter' || code === 'KeyJ' || code === 'KeyF') holding = down;
    },
    peek: () => ({ dough: cur(), pause }),
    live(): Live {
      const fin = doughs.filter((x) => x.state === 'baked' || x.state === 'collapsed');
      return { v: fin.length ? fin.reduce((s, x) => s + x.score, 0) / fin.length : 0.5, c: combo, e: lastE };
    },
    result(): GameResult {
      const d = cur();
      if (d.state === 'rise') {
        holding = false;
        bake();
      }
      const fin = doughs.filter((x) => x.state === 'baked' || x.state === 'collapsed');
      const q = fin.length ? fin.reduce((s, x) => s + x.score, 0) / fin.length : 0;
      // a handful of doughs is the expected pace; one lucky dough is not a whole shift
      const pace = Math.min(1, fin.length / Math.max(3, env.seconds / 9));
      return { q: q * (0.55 + 0.45 * pace), natural20: nat20, perfect: fin.filter((x) => x.score >= 0.9).length };
    },
    stop() {
      holding = false;
    },
  };
}
