// Decorate: trace the dotted line with the piping bag. Coverage and how close you stay both count; icing off the
// line costs. Steady Hands widens the margin; Florentine's clean lines score extra (in the rules).
import { audio } from '../audio/audio';
import type { GameResult } from '../game/types';
import { Floaters, INK, Particles, circle, ellipse, fillInk, rr, seeded, text, woodBackground, type Live, type MiniEnv, type MiniGame } from './common';

type Pt = [number, number];

const CX = 600;
const CY = 410;

function heart(): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i <= 120; i++) {
    const t = Math.PI - (i / 120) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    p.push([x * 11, -y * 11 - 20]);
  }
  return p;
}
function spiral(): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i <= 160; i++) {
    const a = (i / 160) * Math.PI * 4.2;
    const r = 26 + (i / 160) * 190;
    p.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return p;
}
function starPath(): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 92 : 210;
    p.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return p;
}
function wave(): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i <= 180; i++) {
    const a = (i / 180) * Math.PI * 2 - Math.PI / 2;
    const r = 170 + Math.sin(a * 7) * 28;
    p.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return p;
}
function eight(): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i <= 160; i++) {
    const t = (i / 160) * Math.PI * 2;
    const d = 1 + Math.sin(t) ** 2;
    p.push([(230 * Math.cos(t)) / d, (230 * Math.sin(t) * Math.cos(t)) / d]);
  }
  return p;
}
function crown(): Pt[] {
  return [
    [-190, 120],
    [-200, -90],
    [-110, 10],
    [-40, -150],
    [0, -40],
    [40, -150],
    [110, 10],
    [200, -90],
    [190, 120],
    [-190, 120],
  ];
}
function wheat(): Pt[] {
  const p: Pt[] = [[0, 200]];
  for (let i = 0; i < 5; i++) {
    const y = 120 - i * 62;
    p.push([0, y], [-70, y - 50], [0, y], [70, y - 50], [0, y]);
  }
  p.push([0, -200]);
  return p;
}
function zig(): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i <= 8; i++) p.push([-220 + i * 55, i % 2 ? -110 : 110]);
  return p;
}
const SHAPES = [wave, heart, starPath, spiral, crown, wheat, eight, zig];

/** points every ~6 px along a polyline */
function resample(pts: Pt[], step = 6): Pt[] {
  const out: Pt[] = [pts[0]!];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]!;
    const [bx, by] = pts[i]!;
    const len = Math.hypot(bx - ax, by - ay);
    let d = step - carry;
    while (d <= len) {
      out.push([ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len]);
      d += step;
    }
    carry = len - (d - step);
  }
  return out;
}

interface Pattern {
  pts: Pt[];
  covered: Uint8Array;
  ink: Pt[][];
  off: number;
  inkN: number;
  distSum: number;
  done: boolean;
  score: number;
  slide: number;
  kind: 'cake' | 'cookie' | 'tart';
}

export function decorate(env: MiniEnv): MiniGame {
  const rnd = seeded(env.seed ^ 0x51ce);
  const order = [...SHAPES].sort(() => rnd() - 0.5);
  // the easier ones first
  order.sort((a, b) => SHAPES.indexOf(a) - SHAPES.indexOf(b) + (rnd() - 0.5) * 3);
  const margin = 26 * env.skill * (env.buffs.includes('hands') ? 1.35 : 1) * env.tiny;
  const scaleK = env.tiny < 1 ? 0.82 : 1;
  const pats: Pattern[] = [];
  let n = 0;
  const make = (): Pattern => {
    const shape = order[n++ % order.length]!;
    const pts = resample(shape().map(([x, y]) => [x * scaleK, y * scaleK] as Pt));
    const kinds: Pattern['kind'][] = ['cake', 'cookie', 'tart'];
    return { pts, covered: new Uint8Array(pts.length), ink: [], off: 0, inkN: 0, distSum: 0, done: false, score: 0, slide: 1, kind: kinds[n % 3]! };
  };
  pats.push(make());
  let pressed = false;
  let px = CX;
  let py = CY;
  let lastInkX = -99;
  let lastInkY = -99;
  let lastE = '';
  let combo = 0;
  let wob = 0;
  let pipeTick = 0;
  const fx = new Particles();
  const fl = new Floaters();
  const icing = ['#FFF8EA', '#F0A8CF', '#A9C2E6', '#FFD166'];

  const cur = (): Pattern => pats[pats.length - 1]!;
  const offset = (i: number, t: number): Pt => {
    const p = cur().pts[i]!;
    if (!env.salted) return p;
    return [p[0] + Math.sin(t * 1.3 + i * 0.05) * 16, p[1] + Math.cos(t * 1.1 + i * 0.04) * 16];
  };

  function scoreOf(p: Pattern): number {
    const cov = p.covered.reduce((s, v) => s + v, 0) / p.pts.length;
    const offRatio = p.inkN ? p.off / p.inkN : 0;
    const precision = p.inkN ? Math.max(0, 1 - p.distSum / Math.max(1, p.inkN - p.off) / margin) : 0;
    return Math.max(0, Math.min(1, cov * Math.max(0, 1 - offRatio * 1.4) * (0.62 + 0.38 * precision)));
  }

  function finish(p: Pattern): void {
    p.done = true;
    p.score = scoreOf(p);
    const s = p.score;
    if (s >= 0.85) {
      fl.add('Perfect', CX, 120, '#FFD166', 40);
      audio.sfx('perfect');
      lastE = 'perfect';
      combo++;
      fx.spawn(CX, CY, 24, { kind: 1, color: '#FFE7A3', speed: 380, r: 12, g: 0 });
    } else if (s >= 0.6) {
      fl.add('Good', CX, 120, '#A8D69F', 34);
      audio.sfx('good');
      lastE = 'hit';
      combo++;
    } else {
      fl.add('Messy', CX, 120, '#E06B5F', 30);
      audio.sfx('miss');
      lastE = 'miss';
      combo = 0;
    }
    pats.push(make());
  }

  function ink(x: number, y: number, t: number): void {
    const p = cur();
    if (p.done || p.slide > 0.05) return;
    const lx = x - CX;
    const ly = y - CY;
    let best = Infinity;
    for (let i = 0; i < p.pts.length; i++) {
      const [ox, oy] = offset(i, t);
      const d = Math.hypot(ox - lx, oy - ly);
      if (d < best) best = d;
      if (d < margin) p.covered[i] = 1;
    }
    p.inkN++;
    if (best > margin * 1.25) p.off++;
    else p.distSum += Math.min(best, margin);
    const stroke = p.ink[p.ink.length - 1];
    if (stroke) stroke.push([lx, ly]);
    pipeTick++;
    if (pipeTick % 4 === 0) audio.sfx('pipe', Math.min(1, best / margin));
    const cov = p.covered.reduce((s, v) => s + v, 0) / p.pts.length;
    const [ex, ey] = offset(p.pts.length - 1, t);
    if (cov >= 0.94 || (cov >= 0.6 && Math.hypot(ex - lx, ey - ly) < margin && p.covered[p.pts.length - 1])) {
      pressed = false;
      finish(p);
    }
  }

  return {
    background(g) {
      woodBackground(g);
      // turntable
      ellipse(g, CX, CY + 250, 300, 40, '#6B4428', 4);
      rr(g, CX - 30, CY + 200, 60, 60, 8);
      fillInk(g, '#5A3A22', 3);
    },
    update(t, dt) {
      wob = t;
      fx.update(dt);
      fl.update(dt);
      for (const p of pats) p.slide = Math.max(0, p.slide - dt * 3.2);
      if (pressed && Math.hypot(px - lastInkX, py - lastInkY) >= 3) {
        lastInkX = px;
        lastInkY = py;
        ink(px, py, t);
      }
    },
    draw(g, t) {
      const p = cur();
      const sx = p.slide * 900;
      g.save();
      g.translate(CX + sx, CY);
      // the cake
      if (p.kind === 'cake') {
        ellipse(g, 0, 30, 270, 250, '#C2649A', 5);
        ellipse(g, 0, 0, 260, 238, '#F7D9E8', 5);
      } else if (p.kind === 'cookie') {
        ellipse(g, 0, 0, 262, 250, '#D9A46A', 5);
        g.fillStyle = 'rgba(140,80,30,0.25)';
        for (let i = 0; i < 18; i++) {
          const a = i * 2.4;
          g.beginPath();
          g.arc(Math.cos(a) * (60 + (i % 5) * 36), Math.sin(a) * (60 + (i % 4) * 40), 6, 0, Math.PI * 2);
          g.fill();
        }
      } else {
        ellipse(g, 0, 0, 266, 252, '#B8692A', 5);
        ellipse(g, 0, 0, 236, 222, '#F3E3C3', 4);
      }
      // the guide: dotted, with a start dot and an end ring
      g.fillStyle = 'rgba(42,26,18,0.55)';
      for (let i = 0; i < p.pts.length; i += 3) {
        if (p.covered[i]) continue;
        const [x, y] = offset(i, t);
        g.beginPath();
        g.arc(x, y, 4, 0, Math.PI * 2);
        g.fill();
      }
      const [x0, y0] = offset(0, t);
      circle(g, x0, y0, 14, '#5E9A58', 3);
      const [x1, y1] = offset(p.pts.length - 1, t);
      g.lineWidth = 4;
      g.strokeStyle = '#A8322D';
      g.beginPath();
      g.arc(x1, y1, 16, 0, Math.PI * 2);
      g.stroke();
      // the margin you have, faintly, around the start
      g.globalAlpha = 0.18;
      circle(g, x0, y0, margin, '#FFFFFF', 0);
      g.globalAlpha = 1;
      // icing
      g.lineCap = 'round';
      g.lineJoin = 'round';
      const col = icing[(pats.length - 1) % icing.length]!;
      for (const s of p.ink) {
        if (s.length < 2) continue;
        g.beginPath();
        g.moveTo(s[0]![0], s[0]![1]);
        for (const q of s) g.lineTo(q[0], q[1]);
        g.lineWidth = 16 * env.tiny + 4;
        g.strokeStyle = INK;
        g.stroke();
        g.lineWidth = 16 * env.tiny;
        g.strokeStyle = col;
        g.stroke();
      }
      g.restore();
      // the finished ones slide off to the left, scored
      const done = pats.filter((x) => x.done);
      done.slice(-6).forEach((x, i) => {
        const cx = 1080 + (i % 2) * 90;
        const cy = 450 + Math.floor(i / 2) * 100;
        ellipse(g, cx, cy, 36, 32, x.kind === 'cake' ? '#F7D9E8' : x.kind === 'cookie' ? '#D9A46A' : '#F3E3C3', 3);
        text(g, `${Math.round(x.score * 100)}`, cx, cy, { size: 24, color: '#2A1A12', font: 'ui' });
      });
      // the piping bag
      const bx = px;
      const by = py;
      g.save();
      g.translate(bx, by);
      g.rotate(-0.6);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(-24, -70);
      g.quadraticCurveTo(0, -96, 24, -70);
      g.closePath();
      fillInk(g, '#FFFDF8', 3);
      rr(g, -6, -8, 12, 12, 3);
      fillInk(g, '#9AA1AD', 2);
      g.restore();
      fx.draw(g);
      fl.draw(g);
      if (combo >= 2) text(g, `${combo} clean`, CX, 760, { size: 26, color: '#FFD166', stroke: 6, font: 'ui' });
      void wob;
    },
    down(x, y) {
      pressed = true;
      px = x;
      py = y;
      const p = cur();
      p.ink.push([]);
    },
    move(x, y) {
      px = x;
      py = y;
    },
    up() {
      pressed = false;
    },
    key() {},
    peek: () => ({ pts: cur().pts, slide: cur().slide, cx: CX, cy: CY, margin }),
    live(): Live {
      const all = pats.filter((x) => x.done);
      const cur2 = scoreOf(cur());
      const v = all.length ? all.reduce((s, x) => s + x.score, 0) / all.length : cur2;
      return { v, c: combo, e: lastE };
    },
    result(): GameResult {
      const all = pats.filter((x) => x.done);
      const c = cur();
      const partial = c.inkN > 5 ? [scoreOf(c) * 0.8] : [];
      const scores = [...all.map((x) => x.score), ...partial];
      const q = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
      const pace = Math.min(1, (all.length + partial.length * 0.5) / Math.max(2, env.seconds / 12));
      return { q: q * (0.55 + 0.45 * pace), perfect: all.filter((x) => x.score >= 0.85).length };
    },
    stop() {
      pressed = false;
    },
  };
}
