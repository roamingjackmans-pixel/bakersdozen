// Scale: weigh by feel. Hold to pour flour (it pours faster the longer you hold), tap for a pinch, then Weigh.
// The needle wobbles (less with Scale skill); Calibrated Scale marks the target zone on the dial.
// A nod to the old short-weight laws: the Inspector checks every gram.
import { audio } from '../audio/audio';
import type { GameResult } from '../game/types';
import { Floaters, INK, Particles, circle, ellipse, fillInk, rr, seeded, text, woodBackground, type Live, type MiniEnv, type MiniGame } from './common';

const DX = 820;
const DY = 330;
const DR = 190;
const MAXG = 1000;

interface Target {
  g: number;
  w: number;
  score: number;
  done: boolean;
}

export function scale(env: MiniEnv): MiniGame {
  const rnd = seeded(env.seed ^ 0x5ca1e);
  const targets: Target[] = [];
  const add = (): void => {
    targets.push({ g: Math.round((180 + rnd() * 700) / 5) * 5, w: 0, score: 0, done: false });
  };
  add();
  const cal = env.buffs.includes('scale');
  const wobble = 42 / env.skill / (env.tiny < 1 ? 0.8 : 1);
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
  const weighBtn = { x: 1030, y: 640, w: 200, h: 90 };

  const cur = (): Target => targets[targets.length - 1]!;

  function weigh(): void {
    const t = cur();
    if (t.done || t.w <= 0 || pause > 0) return;
    t.done = true;
    const err = Math.abs(t.w - t.g);
    t.score = Math.max(0, 1 - err / (t.g * 0.22)) ** 1.15;
    if (err <= 3) {
      fl.add('Exact', DX, DY - DR - 40, '#FFD166', 42);
      audio.sfx('perfect');
      lastE = 'perfect';
      combo++;
      t.score = 1;
      fx.spawn(DX, DY, 20, { kind: 1, color: '#FFE7A3', speed: 300, r: 12, g: 0 });
    } else if (t.score >= 0.75) {
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
      woodBackground(g);
      // the dial's housing (static parts)
      rr(g, DX - 60, DY + DR - 10, 120, 170, 16);
      fillInk(g, '#8A5A35', 4);
      ellipse(g, DX, DY + 380, 210, 30, '#6B4428', 4);
    },
    update(_t, dt) {
      fx.update(dt);
      fl.update(dt);
      const t = cur();
      flicker += dt;
      if (pause > 0) {
        pause -= dt;
        if (pause <= 0) {
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
    draw(g) {
      const t = cur();
      // the scoop and the sack
      ellipse(g, 520, 250, 90, 100, '#E9D7B0', 4);
      g.fillStyle = '#8A5A35';
      text(g, 'FLOUR', 520, 258, { size: 26, color: '#8A5A35' });
      rr(g, 540, 300, 60, 30, 10);
      fillInk(g, '#9AA1AD', 3);
      if (holding && !t.done) {
        g.fillStyle = 'rgba(255,248,234,0.9)';
        const wpx = 6 + Math.min(1, holdT / 1.9) * 16;
        g.fillRect(560 - wpx / 2, 330, wpx, 230);
      }
      // the bowl and its flour pile
      ellipse(g, 560, 600, 130, 30, '#C8553D', 4);
      const pile = Math.min(1, t.w / MAXG);
      g.beginPath();
      g.moveTo(450, 590);
      g.quadraticCurveTo(560, 590 - 30 - pile * 120, 670, 590);
      g.closePath();
      fillInk(g, '#FFF8EA', 3);
      // the dial
      circle(g, DX, DY, DR + 18, '#B9862C', 5);
      circle(g, DX, DY, DR, '#FFF4E0', 4);
      const ang = (w: number): number => -Math.PI * 0.75 + (w / MAXG) * Math.PI * 1.5;
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
      if (cal) {
        g.strokeStyle = 'rgba(94,154,88,0.85)';
        g.lineWidth = 18;
        g.beginPath();
        g.arc(DX, DY, DR - 16, ang(t.g - 22), ang(t.g + 22));
        g.stroke();
      }
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
      // the target card (Salt Shaker smudges a digit)
      rr(g, 120, 120, 250, 130, 14);
      fillInk(g, '#F3E3C3', 4);
      text(g, 'Target', 245, 150, { size: 20, color: '#8A5A35', font: 'ui' });
      let label = `${t.g} g`;
      if (env.salted && Math.sin(flicker * 3) > -0.3) label = label.replace(/\d(?=\d g)/, '?');
      text(g, label, 245, 205, { size: 52, color: '#2A1A12' });
      if (t.done) text(g, `${Math.round(t.w)} g`, DX, DY + 90, { size: 40, color: '#2A1A12' });
      // weigh button
      rr(g, weighBtn.x, weighBtn.y, weighBtn.w, weighBtn.h, 18);
      fillInk(g, t.w > 0 && !t.done ? '#F2A541' : '#8A7A66', 4);
      text(g, 'Weigh', weighBtn.x + weighBtn.w / 2, weighBtn.y + weighBtn.h / 2, { size: 34, color: '#2A1A12' });
      text(g, 'Hold to pour · Enter', 560, 770, { size: 20, font: 'ui', color: 'rgba(255,244,224,0.55)' });
      // past results
      targets
        .filter((x) => x.done)
        .slice(-6)
        .forEach((x, i) => {
          rr(g, 110 + i * 80, 300, 68, 44, 10);
          fillInk(g, x.score >= 0.75 ? '#A8D69F' : x.score > 0.3 ? '#E9D7B0' : '#E06B5F', 3);
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
      const pace = Math.min(1, done.length / Math.max(3, env.seconds / 8));
      return { q: q * (0.55 + 0.45 * pace), perfect: done.filter((x) => x.score >= 0.95).length };
    },
    stop() {
      holding = false;
    },
  };
}
