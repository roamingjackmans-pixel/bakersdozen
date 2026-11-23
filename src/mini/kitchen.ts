// All Hands, on screen: the shared kitchen seen from above. Tap a station and your baker walks there and uses it
// (tap the board again to knead). Everyone's bakers are on the same floor; the host runs the kitchen and this draws
// its snapshots, each cook carried along its path on the host clock between them.
// Where to go next, without words: the station your loaf needs next glows, with its label (FLOUR, MIX, KNEAD, BAKE,
// PULL, SERVE); the glove taps it for your first loaf and whenever you stand idle.
import { audio } from '../audio/audio';
import { BAKER } from '../game/data';
import { BAKE_MS, CLEAR_MS, GOLD_MS, KNEADS, LAYOUT, LOAF_WORK, MIX_MS, SMOKE_MS, atStation, kitchenDone, openTicket, stationOf, walked, type Cook, type KItem, type KItemK, type KStation, type KitchenState } from '../game/kitchen';
import type { GameResult, Seat } from '../game/types';
import { portrait } from '../render/portraits';
import { sprite } from '../render/art';
import { Floaters, Particles, W, blit, circle, cue, ellipse, fillInk, loop, pill, rr, text, type Live, type MiniEnv, type MiniGame } from './common';

export interface KitchenLink {
  state(): KitchenState | null;
  hostNow(): number;
  act(station: number): void;
  me: number;
  seats: Seat[];
  bakeryOf(seat: number): number;
  need: number;
}

/** the floor, the walls and every station's fixed parts (drawn once) */
export function kitchenFloor(g: CanvasRenderingContext2D): void {
  g.fillStyle = '#2A1A12';
  g.fillRect(0, 0, W, 810);
  // the back wall
  g.fillStyle = '#6E3524';
  g.fillRect(0, 86, W, 92);
  for (let x = 0; x < W; x += 64) {
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fillRect(x, 86, 2, 92);
  }
  // tiles
  for (let y = 178; y < 810; y += 60) {
    for (let x = 0; x < W; x += 60) {
      g.fillStyle = ((x + y) / 60) % 2 ? '#C9B58E' : '#BBA57C';
      g.fillRect(x, y, 60, 60);
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, 178, W, 14);
  // the ticket rail
  rr(g, 290, 96, 900, 8, 4);
  fillInk(g, '#9AA1AD', 2);
  for (const d of LAYOUT) stationBase(g, d.k, d.x, d.y, d.w, d.h);
}

export function stationBase(g: CanvasRenderingContext2D, k: KStation['k'], x: number, y: number, w: number, h: number): void {
  if (k === 'flour') {
    rr(g, x, y, w, h, 14);
    fillInk(g, '#8A5A35', 4);
    for (const [dx, dy] of [
      [30, 40],
      [80, 52],
      [44, 98],
      [86, 108],
    ] as const) {
      rr(g, x + dx - 26, y + dy - 22, 52, 46, 14);
      fillInk(g, '#F3EAD8', 3);
      text(g, 'F', x + dx, y + dy + 2, { size: 18, color: '#B07A3E', font: 'ui' });
    }
  } else if (k === 'mixer') {
    rr(g, x, y, w, h, 14);
    fillInk(g, '#9AA1AD', 4);
    circle(g, x + w / 2, y + h / 2, 40, '#DCE2EA', 4);
    circle(g, x + w / 2, y + h / 2, 30, '#B9C2CE', 2);
  } else if (k === 'oven') {
    rr(g, x, y, w, h, 12);
    fillInk(g, '#6E3524', 4);
    for (let r = 0; r < 3; r++) {
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.fillRect(x + 4, y + 24 + r * 30, w - 8, 2);
    }
    rr(g, x + 18, y + 18, w - 36, h - 40, 10);
    fillInk(g, '#3A2016', 3);
  } else if (k === 'board' || k === 'counter') {
    rr(g, x, y, w, h, 10);
    fillInk(g, '#8A5A35', 4);
    rr(g, x + 10, y + 10, w - 20, h - 20, 10);
    fillInk(g, k === 'board' ? '#D9A46A' : '#C9B58E', 3);
  } else {
    // the hatch: a window out to the shop with a bell
    rr(g, x, y, w, h, 12);
    fillInk(g, '#5A3A22', 4);
    rr(g, x + 14, y + 16, w - 28, h - 32, 10);
    fillInk(g, '#F3E3C3', 3);
    circle(g, x + w / 2, y + h - 34, 14, '#E8B84A', 3);
  }
}

/** a carried or placed thing, centred on (x, y) */
export function itemIcon(g: CanvasRenderingContext2D, k: KItemK, x: number, y: number, s = 1): void {
  if (k === 'flour') {
    rr(g, x - 18 * s, y - 16 * s, 36 * s, 34 * s, 10 * s);
    fillInk(g, '#F3EAD8', 3);
    text(g, 'F', x, y + 2 * s, { size: 16 * s, color: '#B07A3E', font: 'ui' });
  } else if (k === 'dough') {
    ellipse(g, x, y, 22 * s, 17 * s, '#F3D9A4', 3);
  } else if (k === 'shaped') {
    ellipse(g, x, y, 26 * s, 14 * s, '#F3D9A4', 3);
    g.strokeStyle = 'rgba(160,110,50,0.5)';
    g.lineWidth = 2.5;
    for (const dx of [-8, 2, 12]) {
      g.beginPath();
      g.moveTo(x + (dx - 4) * s, y - 7 * s);
      g.lineTo(x + (dx + 2) * s, y + 7 * s);
      g.stroke();
    }
  } else {
    const fill = k === 'loaf' ? '#E9A54A' : k === 'dark' ? '#8A4A22' : '#2A1A12';
    ellipse(g, x, y, 28 * s, 16 * s, fill, 3);
    g.strokeStyle = k === 'loaf' ? '#FFE59A' : 'rgba(0,0,0,0.4)';
    g.lineWidth = 3;
    for (const dx of [-10, 0, 10]) {
      g.beginPath();
      g.moveTo(x + (dx - 4) * s, y - 8 * s);
      g.lineTo(x + (dx + 3) * s, y + 8 * s);
      g.stroke();
    }
  }
}

/** a cook from above: a shadow, their coat, their face, and what they carry over their head */
export function cookBody(g: CanvasRenderingContext2D, x: number, y: number, coat: string, face: HTMLImageElement | undefined, hold: KItemK | null, me: boolean, t: number, moving: boolean): void {
  const bob = moving ? Math.abs(Math.sin(t * 12)) * 4 : 0;
  ellipse(g, x, y + 22, 30, 11, 'rgba(0,0,0,0.25)', 0);
  if (me) {
    g.strokeStyle = '#FFF4E0';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(x, y - bob, 38, 0, Math.PI * 2);
    g.stroke();
  }
  circle(g, x, y - bob, 30, coat, 3);
  blit(g, face, x - 27, y - 30 - bob, 54, 54);
  if (hold) itemIcon(g, hold, x, y - 52 - bob, 0.9);
  if (me) {
    g.beginPath();
    g.moveTo(x, y - (hold ? 82 : 46) - bob);
    g.lineTo(x - 10, y - (hold ? 96 : 60) - bob);
    g.lineTo(x + 10, y - (hold ? 96 : 60) - bob);
    g.closePath();
    fillInk(g, '#FFD166', 2);
  }
}

/** an oven's loaf by how long it's been in: raw → golden → smoking → burnt */
function ovenFill(d: number, gold: number): string {
  if (d < BAKE_MS * 0.5) return '#F3E3C3';
  if (d < BAKE_MS) return '#EFCB86';
  if (d < BAKE_MS + gold) return '#E9A54A';
  if (d < BAKE_MS + gold + SMOKE_MS) return '#8A4A22';
  return '#2A1A12';
}

export function kitchen(env: MiniEnv, link: KitchenLink): MiniGame {
  const fx = new Particles();
  const fl = new Floaters();
  const faces = link.seats.map((s, i) => sprite(`face-${s.baker}-${i}`, portrait(s.baker, 64, s.cosmetics, { ring: false })));
  let lastN = 0;
  let lastE = '';
  let clock = 0;
  let lastAct = 0;
  let acts = 0;
  const squash = new Map<number, number>();
  /** the station I last tapped (shown at once, before the host answers) */
  let tapped = -1;
  let tappedAt = 0;
  const myBakery = (): number => link.bakeryOf(link.me);
  const multi = new Set(link.seats.map((_, i) => link.bakeryOf(i)).filter((b) => b >= 0)).size > 1;
  const bakeryColor = (b: number): string => {
    const owner = link.seats.findIndex((_, s) => link.bakeryOf(s) === b);
    return owner >= 0 ? BAKER[link.seats[owner]!.baker].light : '#FFF4E0';
  };

  const center = (s: KStation): [number, number] => [s.x + s.w / 2, s.y + s.h / 2];

  function react(k: KitchenState): void {
    for (const e of k.events) {
      if (e.n <= lastN) continue;
      const s = k.stations[e.s];
      const [x, y] = s ? center(s) : [W / 2, 400];
      const mine = e.seat === link.me;
      switch (e.k) {
        case 'take':
          audio.sfx('tap', 0.6);
          break;
        case 'mix':
          audio.sfx('pour', 0.7);
          break;
        case 'dough':
          audio.sfx('ding', 0.4);
          break;
        case 'put':
        case 'pick':
          audio.sfx('thump', 0.5);
          break;
        case 'knead':
          squash.set(e.s, 1);
          audio.sfx('thump', 0.7);
          fx.spawn(x, y, 5, { color: '#FFF8EA', speed: 140, r: 5 });
          break;
        case 'shape':
          audio.sfx('good', 0.7);
          break;
        case 'load':
          audio.sfx('load', 0.7);
          break;
        case 'pull':
          audio.sfx(e.g === 'golden' ? 'perfect' : 'pull', 0.7);
          if (mine) {
            fl.add(e.g === 'golden' ? 'Golden' : 'Dark', x, y - 70, e.g === 'golden' ? '#FFD166' : '#C8904E', 30);
            lastE = e.g === 'golden' ? 'perfect' : 'hit';
          }
          break;
        case 'burn':
          audio.sfx('burn');
          fx.spawn(x, y, 16, { color: '#6A6A70', speed: 120, dir: -Math.PI / 2, spread: 1, r: 12, life: 1.2, g: -60 });
          fl.add('Burnt', x, y - 70, '#E06B5F', 30);
          if (mine) lastE = 'miss';
          break;
        case 'serve':
          audio.sfx('coin');
          fx.spawn(x, y, 14, { kind: 1, color: '#FFE7A3', speed: 240, r: 9, g: 0 });
          fl.add(mine ? 'Served' : '+1', x - 40, y - 90, '#A8D69F', mine ? 32 : 26);
          if (mine) lastE = 'perfect';
          break;
        case 'miss':
          audio.sfx('miss', 0.6);
          break;
        case 'nope':
          if (mine) {
            audio.sfx('tap', 0.3);
            fl.add('×', x, y - 60, '#E9D7B0', 34);
          }
          break;
      }
    }
    if (k.n > lastN) lastN = k.n;
  }

  /** where a cook is now: its snapshot position carried along its path */
  function posOf(k: KitchenState, c: Cook, now: number): [number, number] {
    const [x, y] = walked(c, Math.min(400, now - k.t));
    return [x, y];
  }

  /** what your loaf needs next: the station, and its label */
  function nextFor(k: KitchenState, me: Cook, now: number): { s: KStation; label: string } | null {
    const b = myBakery();
    const free = (f: (s: KStation) => boolean): KStation | undefined => {
      let best: KStation | undefined;
      let bd = Infinity;
      for (const s of k.stations) {
        if (!f(s)) continue;
        const d = Math.hypot(s.sx - me.x, s.sy - me.y);
        if (d < bd) {
          bd = d;
          best = s;
        }
      }
      return best;
    };
    const h = me.hold;
    const at = (s: KStation | undefined, label: string): { s: KStation; label: string } | null => (s ? { s, label } : null);
    if (h) {
      if (h.k === 'loaf' || h.k === 'dark') return openTicket(k, h.b) ? at(k.stations.find((s) => s.k === 'hatch'), 'SERVE') : at(free((s) => s.k === 'counter' && !s.item), 'PUT');
      if (h.k === 'shaped') return at(free((s) => s.k === 'oven' && !s.item), 'BAKE');
      if (h.k === 'dough') return at(free((s) => s.k === 'board' && !s.item), 'KNEAD');
      if (h.k === 'flour') return at(free((s) => s.k === 'mixer' && !s.item), 'MIX');
      return null;
    }
    const here = !me.path.length ? stationOf(k, me) : undefined;
    if (here?.k === 'board' && here.item?.k === 'dough') return { s: here, label: `TAP ×${KNEADS - here.taps}` };
    const pull = free((s) => s.k === 'oven' && s.item?.k === 'shaped' && s.item.b === b && now - s.start >= BAKE_MS);
    if (pull) return { s: pull, label: 'PULL' };
    const mixed = free((s) => s.k === 'mixer' && s.item?.k === 'dough' && s.item.b === b);
    if (mixed) return { s: mixed, label: 'TAKE' };
    const board = free((s) => s.k === 'board' && s.item?.k === 'dough' && s.item.b === b && !k.cooks.some((o) => o !== me && !o.path.length && atStation(o, s)));
    if (board) return { s: board, label: 'KNEAD' };
    const left = free((s) => s.k === 'counter' && !!s.item && s.item.b === b && s.item.k !== 'burnt');
    if (left) return { s: left, label: 'TAKE' };
    let pipe = 0;
    for (const o of k.cooks) if (o.hold && o.hold.b === b) pipe++;
    for (const s of k.stations) if (s.item && s.item.b === b && s.item.k !== 'burnt') pipe++;
    const want = k.tickets.filter((t) => t.b === b && (t.st === 'open' || (t.st === 'wait' && t.at - now < 6000))).length;
    if (want > pipe) return at(k.stations.find((s) => s.k === 'flour'), 'FLOUR');
    return null;
  }

  function drawStation(g: CanvasRenderingContext2D, k: KitchenState, s: KStation, now: number, t: number): void {
    const [cx, cy] = center(s);
    const it: KItem | null = s.item;
    const dot = (): void => {
      if (multi && it) circle(g, s.x + s.w - 14, s.y + 14, 9, bakeryColor(it.b), 2.5);
    };
    if (s.k === 'mixer' && it) {
      if (it.k === 'flour') {
        const p = Math.min(1, (now - s.start) / MIX_MS);
        circle(g, cx, cy, 26, '#F3EAD8', 0);
        const a = t * 9;
        g.strokeStyle = '#5A3A22';
        g.lineWidth = 6;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(cx - Math.cos(a) * 22, cy - Math.sin(a) * 22);
        g.lineTo(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22);
        g.stroke();
        progress(g, cx, cy, 46, p, '#8FD18A');
      } else itemIcon(g, 'dough', cx, cy + Math.sin(t * 6) * 2, 1.1);
      dot();
    } else if (s.k === 'oven' && it) {
      const d = now - s.start;
      const window = GOLD_MS;
      if (it.k === 'burnt') {
        itemIcon(g, 'burnt', cx, cy - 4, 1);
        g.globalAlpha = Math.max(0, 1 - d / CLEAR_MS) * 0.6;
        for (let i = 0; i < 3; i++) circle(g, cx - 20 + i * 20, cy - 40 - ((now / 6 + i * 30) % 40), 12, '#6A6A70', 0);
        g.globalAlpha = 1;
      } else {
        const fill = ovenFill(d, window);
        ellipse(g, cx, cy - 4, 30, 17, fill, 3);
        // the ring: baking, then the golden window, then smoke
        const total = BAKE_MS + window + SMOKE_MS;
        progress(g, cx, cy - 4, 46, Math.min(1, d / total), d < BAKE_MS ? '#FFF4E0' : d < BAKE_MS + window ? '#FFD166' : '#E06B5F');
        if (d >= BAKE_MS + window) {
          g.globalAlpha = 0.55;
          for (let i = 0; i < 3; i++) circle(g, cx - 20 + i * 20, cy - 40 - ((now / 8 + i * 30) % 40), 10, '#9AA1AD', 0);
          g.globalAlpha = 1;
        }
      }
      dot();
    } else if (s.k === 'board' && it) {
      const sq = squash.get(s.id) ?? 0;
      ellipse(g, cx, cy + 4, 34 + sq * 10, 22 - sq * 6, '#F3D9A4', 3);
      for (let i = 0; i < KNEADS; i++) circle(g, cx - (KNEADS - 1) * 12 + i * 24, cy + 38, 6, i < s.taps ? '#FFD166' : 'rgba(30,18,12,0.4)', 2);
      dot();
    } else if (s.k === 'counter' && it) {
      itemIcon(g, it.k, cx, cy, 1.1);
      dot();
    }
    if (s.k === 'hatch') {
      // the loaves your bakery has served out of the window, stacked up
      const b = myBakery();
      const served = k.tickets.filter((x) => x.b === b && x.st === 'done').length;
      for (let i = 0; i < Math.min(served, 12); i++) itemIcon(g, 'loaf', s.x + 32 + (i % 2) * 46, s.y + 150 - Math.floor(i / 2) * 22, 0.62);
    }
  }

  function progress(g: CanvasRenderingContext2D, x: number, y: number, r: number, p: number, color: string): void {
    g.lineWidth = 8;
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = color;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    g.stroke();
  }

  function drawTickets(g: CanvasRenderingContext2D, k: KitchenState, now: number): void {
    const b = myBakery();
    const open = k.tickets.filter((x) => x.st === 'open').sort((x, y) => (x.b === b ? 0 : 1) - (y.b === b ? 0 : 1) || x.due - y.due);
    open.slice(0, 13).forEach((tk, i) => {
      const x = 300 + i * 68;
      const left = Math.max(0, (tk.due - now) / (tk.due - tk.at));
      g.save();
      g.translate(x + 30, 104);
      g.rotate(Math.sin(i * 1.7) * 0.05);
      rr(g, -30, 0, 60, 66, 6);
      fillInk(g, tk.b === b ? '#FFF4E0' : '#D8CBB0', 2.5);
      if (multi) {
        rr(g, -30, 0, 60, 12, 4);
        fillInk(g, bakeryColor(tk.b), 2);
      }
      itemIcon(g, 'loaf', 0, 32, 0.75);
      rr(g, -24, 52, 48 * left, 8, 4);
      g.fillStyle = left < 0.3 ? '#E06B5F' : left < 0.6 ? '#F2A541' : '#8FD18A';
      g.fill();
      g.restore();
    });
  }

  return {
    background: kitchenFloor,
    update(t, dt) {
      clock = t;
      fx.update(dt);
      fl.update(dt);
      for (const [id, v] of squash) squash.set(id, Math.max(0, v - dt * 5));
      const k = link.state();
      if (k) react(k);
    },
    draw(g, t) {
      const k = link.state();
      if (!k) {
        text(g, '…', W / 2, 400, { size: 60 });
        return;
      }
      const now = link.hostNow();
      drawTickets(g, k, now);
      for (const s of k.stations) drawStation(g, k, s, now, t);
      const me = k.cooks.find((c) => c.seat === link.me);
      const next = me ? nextFor(k, me, now) : null;
      if (next) {
        const s = next.s;
        const pulse = 0.6 + 0.4 * Math.sin(t * 6);
        g.globalAlpha = pulse;
        g.strokeStyle = '#FFD166';
        g.lineWidth = 6;
        rr(g, s.x - 6, s.y - 6, s.w + 12, s.h + 12, 16);
        g.stroke();
        g.globalAlpha = 1;
        const ly = s.k === 'mixer' || s.k === 'oven' ? s.y + s.h + 26 : s.y - 22;
        pill(g, next.label, s.x + s.w / 2, s.k === 'hatch' ? s.y - 22 : ly, 20);
      }
      if (tapped >= 0 && clock - tappedAt < 0.5) {
        const s = k.stations[tapped]!;
        g.globalAlpha = 1 - (clock - tappedAt) / 0.5;
        g.strokeStyle = '#FFF4E0';
        g.lineWidth = 5;
        g.beginPath();
        g.arc(s.sx, s.sy, 20 + (clock - tappedAt) * 60, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
      }
      // cooks, back to front
      const drawn = k.cooks.map((c) => ({ c, p: posOf(k, c, now) })).sort((a, b) => a.p[1] - b.p[1]);
      for (const { c, p } of drawn) {
        const s = link.seats[c.seat];
        if (!s) continue;
        cookBody(g, p[0], p[1], BAKER[s.baker].coat, faces[c.seat], c.hold?.k ?? null, c.seat === link.me, t + c.seat, c.path.length > 0);
        if (multi && c.hold) circle(g, p[0] + 22, p[1] - 64, 7, bakeryColor(c.hold.b), 2);
      }
      fx.draw(g);
      fl.draw(g);
      // the glove: your first loaf, and whenever you stand about
      if (next && me && !me.path.length && (acts < 6 || clock - lastAct > 3)) {
        const s = next.s;
        const below = s.k === 'mixer' || s.k === 'oven';
        cue(g, s.x + s.w / 2, s.y + s.h / 2, 'tap', loop(t, 0.9), { above: !below, s: 0.8 });
      }
    },
    down(x, y) {
      const k = link.state();
      if (!k) return;
      lastAct = clock;
      for (const s of k.stations) {
        if (x >= s.x - 16 && x <= s.x + s.w + 16 && y >= s.y - 16 && y <= s.y + s.h + 16) {
          link.act(s.id);
          tapped = s.id;
          tappedAt = clock;
          acts++;
          audio.sfx('tap', 0.4);
          return;
        }
      }
    },
    move() {},
    up() {},
    key(code, down) {
      if (!down || (code !== 'Space' && code !== 'Enter')) return;
      // Space: use the station you're standing at (knead, pull, serve)
      const k = link.state();
      const me = k?.cooks.find((c) => c.seat === link.me);
      const s = k && me ? stationOf(k, me) : undefined;
      if (s) {
        lastAct = clock;
        acts++;
        link.act(s.id);
      }
    },
    live(): Live {
      const k = link.state();
      if (!k) return { v: 0.5, c: 0, e: '' };
      return { v: Math.min(1, Math.max(0, (k.work[link.me] ?? 0) / (k.per * LOAF_WORK))), c: k.served[link.me] ?? 0, e: lastE };
    },
    result(): GameResult {
      // the host scores the kitchen itself
      return { q: 0 };
    },
    finished: () => {
      const k = link.state();
      return !!k && kitchenDone(k);
    },
    goal: () => {
      const k = link.state();
      const mine = k?.tickets.filter((x) => x.b === myBakery()) ?? [];
      return [mine.filter((x) => x.st === 'done').length, mine.length];
    },
  };
}
