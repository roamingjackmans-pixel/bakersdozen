// The Shared Oven (and Dawn): everyone's trays in one oven. Tap an empty slot to load your next tray, tap a tray when
// it's golden to pull it (anyone's: rescuing a rival earns a favor), or let it burn. Bump (once) speeds up a rival's
// tray. Dawn adds a prep board (knead your tray before it can go in) and golden trays worth more.
// The host runs the oven; this draws its snapshots on the host clock, so every screen shows the same trays.
// Cues: the glove taps a free slot (LOAD) until you've loaded a couple, a tray that's ready says PULL (a rival's
// smoking one says SAVE), and at Dawn the glove taps the prep board.
import { audio } from '../audio/audio';
import { BAKER } from '../game/data';
import { PARRY_MS, bakeLevel, nextTray, zoneAt, type OvenState, type Tray } from '../game/oven';
import type { GameResult, Seat } from '../game/types';
import { portrait } from '../render/portraits';
import { sprite } from '../render/art';
import { Floaters, INK, Particles, W, blit, circle, cue, ellipse, fillInk, loop, pill, rr, text, type Live, type MiniEnv, type MiniGame } from './common';

export interface OvenLink {
  state(): OvenState | null;
  hostNow(): number;
  act(a: { k: 'load' | 'pull' | 'bump' | 'prep'; slot?: number; tray?: number; when?: number }): void;
  me: number;
  seats: Seat[];
  bakeryOf(seat: number): number;
  need: number;
  /** loaves already on each bakery's tray this order (before the oven) */
  trayBefore: number[];
  coop: boolean;
}

export const OY = 300;
export const SLOT_W = 132;
export const SLOT_H = 150;
export const PREP = { x: 120, y: 600, w: 300, h: 170 };

export function slotX(i: number, n: number): number {
  const total = n * SLOT_W + (n - 1) * 18;
  return W / 2 - 110 - total / 2 + i * (SLOT_W + 18);
}

/** the brick oven front and the counter below it */
export function ovenWall(g: CanvasRenderingContext2D): void {
  g.fillStyle = '#2A1A12';
  g.fillRect(0, 0, W, 810);
  const bw = 64;
  for (let y = 120; y < 560; y += 30) {
    for (let x = ((y / 30) % 2) * -32; x < W; x += bw) {
      g.fillStyle = (x + y) % 3 ? '#6E3524' : '#78402B';
      g.fillRect(x + 1, y + 1, bw - 3, 27);
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 120, W, 440);
  rr(g, -20, 560, W + 40, 70, 12);
  fillInk(g, '#8A5A35', 4);
  g.fillStyle = '#3A2419';
  g.fillRect(0, 610, W, 200);
}

/** an oven mouth, its fire glowing by `glow` (0..1) */
export function arch(g: CanvasRenderingContext2D, x: number, glow: number): void {
  g.beginPath();
  g.moveTo(x, OY + SLOT_H);
  g.lineTo(x, OY + 40);
  g.quadraticCurveTo(x, OY, x + SLOT_W / 2, OY);
  g.quadraticCurveTo(x + SLOT_W, OY, x + SLOT_W, OY + 40);
  g.lineTo(x + SLOT_W, OY + SLOT_H);
  g.closePath();
  fillInk(g, `rgba(${Math.round(180 + glow * 60)},${Math.round(70 + glow * 40)},20,1)`, 5);
  g.fillStyle = 'rgba(255,200,90,0.35)';
  g.fillRect(x + 10, OY + SLOT_H - 26, SLOT_W - 20, 18);
}

/** raw dough → golden → dark → burnt */
export function trayColor(lv: number, z: string): string {
  if (z === 'burnt') return '#2A1A12';
  if (lv < 0.55) return '#F3E3C3';
  if (lv < 0.85) return '#EFCB86';
  if (z === 'perfect' || z === 'golden') return '#E9A54A';
  if (z === 'dark') return '#8A4A22';
  return '#E9B868';
}

export function oven(env: MiniEnv, link: OvenLink): MiniGame {
  const fx = new Particles();
  const fl = new Floaters();
  const faces = link.seats.map((s, i) => sprite(`face-${s.baker}-${i}`, portrait(s.baker, 64, s.cosmetics, { ring: false })));
  let bumpMode = false;
  let lastN = 0;
  let lastE = '';
  let combo = 0;
  const pending = new Set<number>();
  // the glove shows loading until you've done it a couple of times (or when you've a tray waiting and stall)
  let loads = 0;
  let pulls = 0;
  let lastAct = 0;
  let clock = 0;
  let hover = -1;
  let px = 0;
  let py = 0;
  const dawn = env.game === 'dawn';
  const prepBox = PREP;
  const bumpBtn = { x: 1010, y: 640, w: 180, h: 80 };

  const slotOf = (x: number, y: number, n: number): number => {
    for (let i = 0; i < n; i++) {
      const sx = slotX(i, n);
      if (x >= sx - 6 && x <= sx + SLOT_W + 6 && y >= OY - 20 && y <= OY + SLOT_H + 20) return i;
    }
    return -1;
  };

  function react(ov: OvenState): void {
    // play the host's events once each
    for (const e of ov.events) {
      if (e.n <= lastN) continue;
      const t = ov.trays.find((x) => x.id === e.tray);
      const sx = t && t.slot >= 0 ? slotX(t.slot, ov.slots) + SLOT_W / 2 : W / 2;
      if (e.k === 'pull' && e.seat === link.me) {
        pending.delete(e.tray);
        pulls++;
        if (e.g === 'perfect') {
          const parry = t && t.parry;
          fl.add(parry ? 'Parry' : 'Perfect', sx, OY - 30, '#FFD166', 38);
          audio.sfx(parry && env.baker === 'joe' ? 'parry' : 'perfect');
          lastE = 'perfect';
          combo++;
        } else if (e.g === 'golden') {
          fl.add('Golden', sx, OY - 30, '#A8D69F', 32);
          audio.sfx('pull');
          lastE = 'hit';
          combo++;
        } else {
          fl.add('Dark', sx, OY - 30, '#C8904E', 30);
          audio.sfx('pull');
          lastE = 'hit';
          combo = 0;
        }
        if (t && t.owner !== link.me) fl.add('Rescued', sx, OY - 70, '#93D3D2', 26);
        fx.spawn(sx, OY + 70, 12, { kind: 1, color: '#FFE7A3', speed: 260, r: 9, g: 0 });
      } else if (e.k === 'pull') {
        audio.sfx('pull');
        if (t && t.owner === link.me) fl.add(`${link.seats[e.seat]?.name ?? ''} saved it`, sx, OY - 40, '#93D3D2', 22);
      } else if (e.k === 'burn') {
        audio.sfx('burn');
        fx.spawn(sx, OY + 40, 16, { color: '#6A6A70', speed: 120, dir: -Math.PI / 2, spread: 1, r: 12, life: 1.2, g: -60 });
        if (t?.owner === link.me) {
          lastE = 'miss';
          combo = 0;
          fl.add('Burnt', sx, OY - 30, '#E06B5F', 34);
        }
      } else if (e.k === 'load') {
        audio.sfx('load');
        if (e.seat === link.me) loads++;
      }
      else if (e.k === 'bump') {
        audio.sfx('bump');
        if (t?.owner === link.me) fl.add('Bumped', sx, OY - 30, '#C3B0F0', 28);
      } else if (e.k === 'ghost') audio.sfx('ghost');
    }
    if (ov.n > lastN) lastN = ov.n;
  }

  return {
    background(g) {
      g.fillStyle = '#2A1A12';
      g.fillRect(0, 0, W, 810);
      // brick oven front
      const bw = 64;
      for (let y = 120; y < 560; y += 30) {
        for (let x = ((y / 30) % 2) * -32; x < W; x += bw) {
          g.fillStyle = (x + y) % 3 ? '#6E3524' : '#78402B';
          g.fillRect(x + 1, y + 1, bw - 3, 27);
        }
      }
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(0, 120, W, 440);
      rr(g, -20, 560, W + 40, 70, 12);
      fillInk(g, '#8A5A35', 4);
      g.fillStyle = '#3A2419';
      g.fillRect(0, 610, W, 200);
    },
    update(t, dt) {
      clock = t;
      fx.update(dt);
      fl.update(dt);
      const ov = link.state();
      if (ov) react(ov);
    },
    draw(g, t) {
      const ov = link.state();
      if (!ov) {
        text(g, '…', W / 2, 400, { size: 60 });
        return;
      }
      const now = link.hostNow();
      // oven mouth glow (flicker)
      const glow = 0.5 + Math.sin(t * 7) * 0.08 + Math.sin(t * 13) * 0.05;
      for (let i = 0; i < ov.slots; i++) {
        const x = slotX(i, ov.slots);
        g.beginPath();
        g.moveTo(x, OY + SLOT_H);
        g.lineTo(x, OY + 40);
        g.quadraticCurveTo(x, OY, x + SLOT_W / 2, OY);
        g.quadraticCurveTo(x + SLOT_W, OY, x + SLOT_W, OY + 40);
        g.lineTo(x + SLOT_W, OY + SLOT_H);
        g.closePath();
        fillInk(g, `rgba(${Math.round(180 + glow * 60)},${Math.round(70 + glow * 40)},20,1)`, 5);
        g.fillStyle = 'rgba(255,200,90,0.35)';
        g.fillRect(x + 10, OY + SLOT_H - 26, SLOT_W - 20, 18);
        text(g, `${i + 1}`, x + SLOT_W / 2, OY + SLOT_H + 26, { size: 20, font: 'ui', color: '#F3E6CF' });
        // a slot one bakery bought: its colour on the arch
        const rb = ov.reserved?.[i] ?? -1;
        if (rb >= 0) {
          const owner = link.seats.findIndex((_, s) => link.bakeryOf(s) === rb);
          const col = owner >= 0 ? BAKER[link.seats[owner]!.baker].light : '#FFF4E0';
          rr(g, x + SLOT_W / 2 - 30, OY - 16, 60, 12, 6);
          fillInk(g, col, 2);
        }
        if (hover === i) {
          g.strokeStyle = '#F2A541';
          g.lineWidth = 4;
          g.stroke();
        }
      }
      // trays in the oven
      for (const tr of ov.trays) {
        if (tr.st !== 'baking' || tr.slot < 0 || pending.has(tr.id)) continue;
        drawTray(g, tr, slotX(tr.slot, ov.slots), now);
      }
      // what to do now: PULL over your ready trays, SAVE over a rival's smoking one
      const myBakery = link.bakeryOf(link.me);
      let readyTray: Tray | null = null;
      for (const tr of ov.trays) {
        if (tr.st !== 'baking' || tr.slot < 0 || pending.has(tr.id)) continue;
        const z = zoneAt(tr, now);
        const x = slotX(tr.slot, ov.slots) + SLOT_W / 2;
        const pulse = 1 + 0.06 * Math.sin(t * 9);
        if (tr.owner === link.me && (z === 'golden' || z === 'perfect')) {
          readyTray ??= tr;
          g.save();
          g.translate(x, OY - 40);
          g.scale(pulse, pulse);
          pill(g, 'PULL', 0, 0, 26);
          g.restore();
        } else if (z === 'dark') {
          pill(g, tr.owner === link.me ? 'PULL!' : 'SAVE', x, OY - 40, 24, tr.owner === link.me ? '#E06B5F' : '#93D3D2');
        }
      }
      // free slots you can load (not one another bakery bought)
      const busy = new Set(ov.trays.filter((q) => q.st === 'baking' && q.slot >= 0).map((q) => q.slot));
      const free: number[] = [];
      for (let i = 0; i < ov.slots; i++) {
        const rb = ov.reserved?.[i] ?? -1;
        if (!busy.has(i) && (rb < 0 || rb === myBakery)) free.push(i);
      }
      const waiting = nextTray(ov, link.me);
      if (waiting) {
        // a faint plus in every free arch
        g.globalAlpha = 0.55 + 0.25 * Math.sin(t * 5);
        for (const i of free) {
          const cx = slotX(i, ov.slots) + SLOT_W / 2;
          g.strokeStyle = '#FFF4E0';
          g.lineWidth = 8;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(cx - 18, OY + 80);
          g.lineTo(cx + 18, OY + 80);
          g.moveTo(cx, OY + 62);
          g.lineTo(cx, OY + 98);
          g.stroke();
        }
        g.globalAlpha = 1;
      }
      const stalled = clock - lastAct > 3;
      if (readyTray && (pulls < 2 || stalled)) {
        cue(g, slotX(readyTray.slot, ov.slots) + SLOT_W / 2, OY + 92, 'tap', loop(t, 0.9));
      } else if (waiting && free.length && (loads < 2 || stalled)) {
        cue(g, slotX(free[0]!, ov.slots) + SLOT_W / 2, OY + 80, 'tap', loop(t, 1), { label: 'LOAD' });
      } else if (dawn && !waiting && nextTray(ov, link.me, 'prep') && (loads < 2 || stalled)) {
        cue(g, prepBox.x + 150, prepBox.y + 92, 'tap', loop(t, 0.6), { above: true, label: 'TAP' });
      }
      // the shared tray counter(s)
      const bakeries = [...new Set(link.seats.map((_, i) => link.bakeryOf(i)))].filter((b) => b >= 0);
      bakeries.forEach((b, i) => {
        const have = Math.max(0, (link.trayBefore[b] ?? 0) + (ov.loaves[b] ?? 0));
        const mine = b === link.bakeryOf(link.me);
        const x = 1240;
        const y = 420 + i * 90;
        rr(g, x - 110, y - 34, 220, 68, 14);
        fillInk(g, mine ? '#F3E3C3' : '#C9B58E', 3);
        text(g, `${Math.min(have, 99)} / ${link.need}`, x + 20, y, { size: 34, color: '#2A1A12' });
        const owner = link.seats.findIndex((_, s) => link.bakeryOf(s) === b);
        const img = faces[owner];
        if (img?.complete && bakeries.length > 1) blit(g, img, x - 102, y - 26, 52, 52);
        else text(g, 'Tray', x - 70, y, { size: 20, font: 'ui', color: '#2A1A12' });
      });
      // your queue (and Dawn's prep board)
      const mineQ = ov.trays.filter((x) => x.owner === link.me && (x.st === 'queue' || x.st === 'prep'));
      const nextQ = nextTray(ov, link.me);
      if (dawn) {
        rr(g, prepBox.x, prepBox.y, prepBox.w, prepBox.h, 20);
        fillInk(g, '#C8904E', 4);
        const p = nextTray(ov, link.me, 'prep');
        if (p) {
          const squash = (3 - p.prep) / 3;
          ellipse(g, prepBox.x + 150, prepBox.y + 92, 70 + squash * 22, 44 - squash * 10, '#F3D9A4', 4);
          text(g, `Knead ${p.prep}`, prepBox.x + 150, prepBox.y + 28, { size: 22, font: 'ui', color: '#2A1A12' });
        } else text(g, '—', prepBox.x + 150, prepBox.y + 90, { size: 30, color: '#2A1A12' });
      }
      const qx = dawn ? 460 : 160;
      text(g, nextQ ? (free.length ? 'Tap a slot' : 'Oven full · wait') : mineQ.length ? 'Knead' : 'All in', qx + 160, 640, { size: 22, font: 'ui', color: '#F3E6CF', align: 'center' });
      mineQ.slice(0, 6).forEach((tr, i) => {
        const x = qx + i * 64;
        rr(g, x, 668, 120, 70, 12);
        fillInk(g, tr.st === 'prep' ? '#8A7A66' : '#9AA1AD', 3);
        ellipse(g, x + 60, 700, 40, 18, tr.golden ? '#FFE59A' : '#F3E3C3', 3);
      });
      // bump button (not in co-op)
      if (!link.coop) {
        const used = (ov.bumps[link.me] ?? 0) > 0;
        rr(g, bumpBtn.x, bumpBtn.y, bumpBtn.w, bumpBtn.h, 16);
        fillInk(g, used ? '#5A4A40' : bumpMode ? '#C3B0F0' : '#7A5FB8', 4);
        text(g, used ? 'Bumped' : bumpMode ? 'Pick a tray' : 'Bump', bumpBtn.x + bumpBtn.w / 2, bumpBtn.y + bumpBtn.h / 2, { size: bumpMode ? 22 : 28, color: used ? '#9A8A7A' : '#1E120C' });
      }
      fx.draw(g);
      fl.draw(g);
      if (combo >= 2) text(g, `${combo} in a row`, W / 2 - 110, 200, { size: 26, color: '#FFD166', stroke: 6, font: 'ui' });
      void px;
      void py;
    },
    down(x, y) {
      const ov = link.state();
      if (!ov) return;
      lastAct = clock;
      const now = link.hostNow();
      if (!link.coop && x >= bumpBtn.x && x <= bumpBtn.x + bumpBtn.w && y >= bumpBtn.y && y <= bumpBtn.y + bumpBtn.h) {
        if (!(ov.bumps[link.me] ?? 0)) bumpMode = !bumpMode;
        audio.sfx('tap');
        return;
      }
      if (dawn && x >= prepBox.x && x <= prepBox.x + prepBox.w && y >= prepBox.y && y <= prepBox.y + prepBox.h) {
        link.act({ k: 'prep' });
        audio.sfx('thump', 0.6);
        fx.spawn(prepBox.x + 150, prepBox.y + 92, 6, { color: '#FFF8EA', speed: 160, r: 6 });
        return;
      }
      const s = slotOf(x, y, ov.slots);
      if (s < 0) return;
      const tr = ov.trays.find((q) => q.st === 'baking' && q.slot === s && !pending.has(q.id));
      if (!tr) {
        bumpMode = false;
        link.act({ k: 'load', slot: s });
        return;
      }
      if (bumpMode && tr.owner !== link.me) {
        bumpMode = false;
        link.act({ k: 'bump', tray: tr.id });
        return;
      }
      const z = zoneAt(tr, now);
      // a rival's tray can only be rescued once it's smoking
      if (tr.owner !== link.me && z !== 'dark' && z !== 'burnt') {
        fl.add(z === 'raw' ? 'Not yet' : 'Not yours', slotX(s, ov.slots) + SLOT_W / 2, OY - 20, '#E9D7B0', 24);
        audio.sfx('tap');
        return;
      }
      if (z === 'raw') {
        fl.add('Not yet', slotX(s, ov.slots) + SLOT_W / 2, OY - 20, '#E9D7B0', 24);
        audio.sfx('tap');
        return;
      }
      // optimistic: hide it now, the host confirms in a moment
      pending.add(tr.id);
      setTimeout(() => pending.delete(tr.id), 700);
      link.act({ k: 'pull', tray: tr.id, when: now });
    },
    move(x, y) {
      px = x;
      py = y;
      const ov = link.state();
      hover = ov ? slotOf(x, y, ov.slots) : -1;
    },
    up() {},
    key(code, down) {
      if (!down) return;
      const ov = link.state();
      if (!ov) return;
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
      if (m) {
        const s = Number(m[1]) - 1;
        if (s < ov.slots) {
          const x = slotX(s, ov.slots) + SLOT_W / 2;
          this.down(x, OY + 60);
        }
      }
      if (dawn && (code === 'Space' || code === 'KeyK')) this.down(prepBox.x + 10, prepBox.y + 10);
      if (code === 'KeyB' && !link.coop) bumpMode = !bumpMode;
    },
    live(): Live {
      const ov = link.state();
      if (!ov) return { v: 0.5, c: 0, e: '' };
      const own = ov.trays.filter((x) => x.owner === link.me && x.st === 'out');
      const good = own.filter((x) => x.grade === 'perfect' || x.grade === 'golden').length;
      return { v: own.length ? good / own.length : 0.5, c: combo, e: lastE };
    },
    result(): GameResult {
      // the host scores the oven itself
      return { q: 0 };
    },
  };

  function drawTray(g: CanvasRenderingContext2D, tr: Tray, x: number, now: number): void {
    const z = zoneAt(tr, now);
    const lv = bakeLevel(tr, now);
    const cx = x + SLOT_W / 2;
    const cy = OY + 92;
    // the tray and its loaves
    rr(g, x + 10, cy + 8, SLOT_W - 20, 22, 6);
    fillInk(g, '#55555E', 3);
    const col = trayColor(lv, z);
    for (let k = -1; k <= 1; k++) ellipse(g, cx + k * 34, cy, 18, 14, tr.golden ? (z === 'golden' || z === 'perfect' ? '#FFD166' : col) : col, 3);
    // the timer ring: the golden zone and the perfect notch, and where the bake is now
    const R = 52;
    const span = tr.dur + tr.win + tr.smoke;
    const ang = (ms: number): number => -Math.PI / 2 + (Math.min(span, Math.max(0, ms)) / span) * Math.PI * 2;
    g.lineWidth = 8;
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.beginPath();
    g.arc(cx, cy - 6, R, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = '#E9A54A';
    g.beginPath();
    g.arc(cx, cy - 6, R, ang(tr.dur - tr.win), ang(tr.dur + tr.win));
    g.stroke();
    g.strokeStyle = '#FFE59A';
    g.lineWidth = 11;
    g.beginPath();
    g.arc(cx, cy - 6, R, ang(tr.dur - tr.perf), ang(tr.dur + tr.perf));
    g.stroke();
    if (env.baker === 'joe' && tr.owner === link.me) {
      g.strokeStyle = '#FFFFFF';
      g.lineWidth = 13;
      g.beginPath();
      g.arc(cx, cy - 6, R, ang(tr.dur - PARRY_MS), ang(tr.dur + PARRY_MS));
      g.stroke();
    }
    g.strokeStyle = '#5A2A1A';
    g.lineWidth = 8;
    g.beginPath();
    g.arc(cx, cy - 6, R, ang(tr.dur + tr.win), ang(span));
    g.stroke();
    const a = ang(now - tr.start);
    circle(g, cx + Math.cos(a) * R, cy - 6 + Math.sin(a) * R, 9, z === 'raw' ? '#FFF4E0' : z === 'dark' ? '#E06B5F' : '#FFD166', 3);
    // smoke when it's going dark
    if (z === 'dark') {
      g.globalAlpha = 0.5;
      for (let k = 0; k < 3; k++) circle(g, cx - 20 + k * 20, cy - 60 - ((now / 8 + k * 30) % 40), 10, '#9AA1AD', 0);
      g.globalAlpha = 1;
    }
    // whose tray: a flag in the baker's colour with their face
    const s = link.seats[tr.owner];
    if (s) {
      const b = BAKER[s.baker];
      rr(g, x + 4, OY + 4, 44, 44, 10);
      fillInk(g, b.light, 3);
      const img = faces[tr.owner];
      blit(g, img, x + 6, OY + 6, 40, 40);
      if (tr.owner === link.me) {
        g.strokeStyle = '#FFF4E0';
        g.lineWidth = 4;
        rr(g, x - 2, OY - 2, SLOT_W + 4, SLOT_H + 4, 16);
        g.stroke();
      }
    }
    void INK;
  }
}
