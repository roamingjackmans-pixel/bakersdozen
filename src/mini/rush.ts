// Rush Order: the customer calls out a recipe; remember it, then rebuild it from the pantry in order.
// Recipes grow by one each time you get one right; getting the goal length right (6 in a 50 s game) ends the game.
// Sharp Memory and Nonna Bea keep the recipe up 2 s longer.
// A Salt Shaker shuffles your pantry shelves after you have looked.
// Labels say which part you're in (Remember, then Tap in order) and the next spot to fill glows.
import { audio } from '../audio/audio';
import type { GameResult } from '../game/types';
import { PANTRY, pantrySVG, sprite } from '../render/art';
import { Floaters, Particles, blit, ellipse, fillInk, pill, rr, seeded, text, woodBackground, type Live, type MiniEnv, type MiniGame } from './common';

interface Recipe {
  items: number[];
  got: number;
  phase: 'show' | 'build' | 'done';
  t: number;
  show: number;
  ok: boolean;
}

export const SLOT_W = 150;
export const SLOT_H = 130;
export const GRID_X = 220;
export const GRID_Y = 470;
/** top-left of pantry slot i */
export const slotXY = (i: number): [number, number] => [GRID_X + (i % 4) * (SLOT_W + 24), GRID_Y + Math.floor(i / 4) * (SLOT_H + 20)];
/** where recipe item i of n sits in the speech bubble (its centre x) */
export const bubbleX = (i: number, n: number): number => {
  const gap = Math.min(110, 820 / n);
  return 570 - ((n - 1) * gap) / 2 + i * gap;
};

/** the shop counter and the pantry shelves */
export function pantryBack(g: CanvasRenderingContext2D): void {
  woodBackground(g);
  rr(g, 180, 440, 760, 330, 20);
  fillInk(g, '#5A3A22', 4);
}

/** the customer at the counter and their speech bubble */
export function customer(g: CanvasRenderingContext2D): void {
  ellipse(g, 1100, 360, 70, 80, '#3A2419', 4);
  ellipse(g, 1100, 250, 50, 54, '#D9A07A', 4);
  rr(g, 120, 90, 900, 220, 30);
  fillInk(g, '#FFF4E0', 4);
  g.beginPath();
  g.moveTo(1010, 230);
  g.lineTo(1060, 260);
  g.lineTo(1010, 270);
  g.closePath();
  fillInk(g, '#FFF4E0', 4);
  g.fillStyle = '#FFF4E0';
  g.fillRect(1000, 232, 14, 36);
}

/** a glow behind the next spot to fill in the bubble */
export function nextSpot(g: CanvasRenderingContext2D, x: number, t: number): void {
  g.globalAlpha = 0.45 + 0.35 * Math.sin(t * 6);
  rr(g, x - 46, 150, 92, 100, 18);
  g.fillStyle = '#FFD166';
  g.fill();
  g.globalAlpha = 1;
  g.lineWidth = 4;
  g.strokeStyle = '#E8A93A';
  g.stroke();
}

export function rush(env: MiniEnv): MiniGame {
  const rnd = seeded(env.seed ^ 0x7a5);
  const imgs = PANTRY.map((p) => sprite(`pantry-${p.id}`, pantrySVG(p.id, 96)));
  let layout = PANTRY.map((_, i) => i);
  const recipes: Recipe[] = [];
  let len = 3;
  const extra = (env.buffs.includes('memory') ? 2 : 0) + (env.baker === 'bea' ? 2 : 0);
  const make = (): void => {
    const items: number[] = [];
    for (let i = 0; i < len; i++) {
      let k = Math.floor(rnd() * PANTRY.length);
      if (items.length && k === items[items.length - 1]) k = (k + 1 + Math.floor(rnd() * 3)) % PANTRY.length;
      items.push(k);
    }
    recipes.push({ items, got: 0, phase: 'show', t: 0, show: (1.1 + len * 0.42) * env.skill + extra, ok: false });
  };
  make();
  let lastE = '';
  let combo = 0;
  let flash = -1;
  let flashOk = true;
  let pause = 0;
  const fx = new Particles();
  const fl = new Floaters();

  const cur = (): Recipe => recipes[recipes.length - 1]!;
  // the objective: get a recipe this long right (6 in a 50 s game). Longer recipes score more up to here, so once
  // it's done nothing could raise the score and the game ends
  const goalLen = Math.max(4, Math.min(7, Math.floor((6 * env.seconds) / 50)));
  const best = (): number => recipes.reduce((m, x) => (x.ok ? Math.max(m, x.items.length) : m), 0);

  const slotAt = (x: number, y: number): number => {
    for (let i = 0; i < 8; i++) {
      const cx = GRID_X + (i % 4) * (SLOT_W + 24);
      const cy = GRID_Y + Math.floor(i / 4) * (SLOT_H + 20);
      if (x >= cx && x <= cx + SLOT_W && y >= cy && y <= cy + SLOT_H) return i;
    }
    return -1;
  };

  function pick(slot: number): void {
    const r = cur();
    if (r.phase !== 'build' || slot < 0 || pause > 0) return;
    const item = layout[slot]!;
    flash = slot;
    if (item === r.items[r.got]) {
      r.got++;
      audio.sfx('tap');
      flashOk = true;
      const cx = GRID_X + (slot % 4) * (SLOT_W + 24) + SLOT_W / 2;
      const cy = GRID_Y + Math.floor(slot / 4) * (SLOT_H + 20) + SLOT_H / 2;
      fx.spawn(cx, cy, 6, { color: PANTRY[item]!.color, speed: 200, r: 6 });
      if (r.got >= r.items.length) {
        r.phase = 'done';
        r.ok = true;
        fl.add('Order up', 640, 120, '#FFD166', 40);
        audio.sfx('perfect');
        lastE = 'perfect';
        combo++;
        len = Math.min(8, len + 1);
        pause = 0.9;
      }
    } else {
      r.phase = 'done';
      r.ok = false;
      flashOk = false;
      fl.add('Wrong', 640, 120, '#E06B5F', 36);
      audio.sfx('miss');
      lastE = 'miss';
      combo = 0;
      pause = 1.1;
    }
  }

  return {
    background(g) {
      pantryBack(g);
    },
    update(_t, dt) {
      fx.update(dt);
      fl.update(dt);
      const r = cur();
      r.t += dt;
      if (pause > 0) {
        pause -= dt;
        if (pause <= 0 && best() < goalLen) {
          make();
          if (env.salted) layout = [...layout].sort(() => rnd() - 0.5);
        }
        return;
      }
      if (r.phase === 'show' && r.t >= r.show) {
        r.phase = 'build';
        r.t = 0;
        if (env.salted) layout = [...layout].sort(() => rnd() - 0.5);
      }
    },
    draw(g, t) {
      const r = cur();
      customer(g);
      if (r.phase === 'show') {
        const n = r.items.length;
        const gap = Math.min(110, 820 / n);
        const x0 = 570 - ((n - 1) * gap) / 2;
        r.items.forEach((it, i) => {
          const img = imgs[it]!;
          blit(g, img, x0 + i * gap - 44, 156, 88, 88);
          text(g, `${i + 1}`, x0 + i * gap, 268, { size: 18, color: '#8A5A35', font: 'ui' });
        });
        // time left to look
        const k = Math.max(0, 1 - r.t / r.show);
        rr(g, 170, 290, 800 * k, 8, 4);
        g.fillStyle = '#C3B0F0';
        g.fill();
      } else {
        // what you've rebuilt so far, the rest as question marks (the next one glowing)
        const n = r.items.length;
        const gap = Math.min(110, 820 / n);
        const x0 = 570 - ((n - 1) * gap) / 2;
        if (r.phase === 'build') nextSpot(g, x0 + r.got * gap, t);
        for (let i = 0; i < n; i++) {
          if (i < r.got) {
            const img = imgs[r.items[i]!]!;
            blit(g, img, x0 + i * gap - 40, 160, 80, 80);
          } else text(g, '?', x0 + i * gap, 200, { size: 64, color: r.phase === 'done' && !r.ok && i === r.got ? '#A8322D' : '#C8B89A' });
        }
      }
      // pantry
      for (let i = 0; i < 8; i++) {
        const cx = GRID_X + (i % 4) * (SLOT_W + 24);
        const cy = GRID_Y + Math.floor(i / 4) * (SLOT_H + 20);
        rr(g, cx, cy, SLOT_W, SLOT_H, 18);
        const lit = flash === i && pause > 0.5;
        fillInk(g, lit ? (flashOk ? '#A8D69F' : '#E06B5F') : r.phase === 'build' ? '#F3E3C3' : '#C9B58E', 4);
        const img = imgs[layout[i]!]!;
        blit(g, img, cx + SLOT_W / 2 - 44, cy + 14, 88, 88);
        text(g, `${i + 1}`, cx + 18, cy + 18, { size: 18, color: '#8A5A35', font: 'ui' });
      }
      // which part this is
      if (r.phase === 'show') pill(g, 'REMEMBER', 570, 340, 24);
      else if (r.phase === 'build') pill(g, 'TAP THEM IN ORDER', 560, 442, 24);
      fx.draw(g);
      fl.draw(g);
      if (combo >= 2) text(g, `${combo} orders`, 1100, 470, { size: 26, color: '#FFD166', stroke: 6, font: 'ui' });
      text(g, `Recipe ${r.items.length}`, 1100, 520, { size: 22, color: '#F3E6CF', font: 'ui', stroke: 4 });
    },
    down(x, y) {
      pick(slotAt(x, y));
    },
    move() {},
    up() {},
    key(code, down) {
      if (!down) return;
      const m = /^(?:Digit|Numpad)([1-8])$/.exec(code);
      if (m) pick(Number(m[1]) - 1);
    },
    finished: () => best() >= goalLen && pause <= 0,
    goal: () => [best(), goalLen],
    peek: () => ({ recipe: cur(), layout, pause, slot: (i: number) => [GRID_X + (i % 4) * (SLOT_W + 24) + 20, GRID_Y + Math.floor(i / 4) * (SLOT_H + 20) + 20] }),
    live(): Live {
      const all = recipes.filter((x) => x.phase === 'done');
      const got = all.reduce((s, x) => s + (x.ok ? x.items.length : x.got), 0);
      const tot = all.reduce((s, x) => s + x.items.length, 0);
      return { v: tot ? got / tot : 0.5, c: combo, e: lastE };
    },
    result(): GameResult {
      // the recipe still being built at the bell counts what you got so far, without the rest against you
      const all = recipes.filter((x) => x.phase === 'done' || (x.phase === 'build' && x.got > 0));
      const got = all.reduce((s, x) => s + (x.ok ? x.items.length : x.got), 0);
      const tot = all.reduce((s, x) => s + (x.phase === 'build' ? x.got : x.items.length), 0);
      const q = tot ? got / tot : 0;
      // longer recipes are worth more, up to the objective (getting a 6 right in a 50 s game)
      const reach = Math.min(1, (len - 2) / (goalLen - 1));
      return { q: Math.min(1, q * (0.7 + 0.3 * reach)), perfect: all.filter((x) => x.ok).length };
    },
  };
}
