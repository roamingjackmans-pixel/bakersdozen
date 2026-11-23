// All Hands: everyone's baker in one kitchen at once. Tap a station and your baker walks there and uses it: flour
// from the bin, into a mixer, the dough onto a board (knead it with taps), into an oven, out when it's golden, and
// through the hatch to fill one of your bakery's tickets before the customer gives up. Everyone shares the stations
// and the floor (bakers bump each other out of the way), so the kitchen is as busy as the table.
// The host runs it like the Shared Oven: guests send the station they tapped, every screen draws the same kitchen
// from the snapshots (a cook's position is extrapolated along its path on the host clock). No Math.random here: the
// match's seeded Rng only.
import { BAL, skillMult } from './data';
import { Rng, clamp } from './rng';
import { bakeryOf, chaosCount, has, order, seatOpen } from './rules';
import type { GameResult, MatchState } from './types';

export type KItemK = 'flour' | 'dough' | 'shaped' | 'loaf' | 'dark' | 'burnt';
/** something carried or sitting on a station; `b` is the bakery it's for (whoever took the flour) */
export interface KItem {
  k: KItemK;
  b: number;
}
export type StationK = 'flour' | 'mixer' | 'board' | 'oven' | 'counter' | 'hatch';

export interface KStation {
  id: number;
  k: StationK;
  /** its box on the floor (drawing and taps) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** where a cook stands to use it */
  sx: number;
  sy: number;
  item: KItem | null;
  /** mixer / oven: host ms it started */
  start: number;
  /** board: kneads done */
  taps: number;
  /** seat that put the item in (an oven's burn is theirs) */
  by: number;
}

export interface Cook {
  seat: number;
  x: number;
  y: number;
  /** waypoints still to walk, flat [x, y, x, y, ...] */
  path: number[];
  /** the station it's walking to, or -1 */
  go: number;
  hold: KItem | null;
  /** px per second */
  speed: number;
}

export interface Ticket {
  id: number;
  b: number;
  at: number;
  due: number;
  st: 'wait' | 'open' | 'done' | 'missed';
  by: number;
}

export interface KEvent {
  n: number;
  k: 'take' | 'mix' | 'dough' | 'put' | 'pick' | 'knead' | 'shape' | 'load' | 'pull' | 'burn' | 'serve' | 'miss' | 'nope';
  seat: number;
  s: number;
  g?: string;
}

export interface KitchenState {
  game: 'kitchen';
  round: number;
  start: number;
  end: number;
  /** host ms the cooks' positions are for */
  t: number;
  cooks: Cook[];
  stations: KStation[];
  tickets: Ticket[];
  /** loaves every ticket served puts on each bakery's tray (the oven's yield; fewer served: kitchenLoaves) */
  full: number[];
  /** loaves served so far, per bakery */
  loaves: number[];
  /** per seat: the work done (each step of a loaf counts), loaves started, tickets served, loaves burnt */
  work: number[];
  started: number[];
  served: number[];
  burnt: number[];
  /** tickets per seat this game (a bakery gets about this many per baker) */
  per: number;
  seatBakery: number[];
  events: KEvent[];
  n: number;
  rng: number;
}

export const SPEED = 440;
export const COOK_R = 30;
export const MIX_MS = 2200;
export const BAKE_MS = 4600;
/** the golden window after baking (skill widens it), then smoking (still sellable, dark), then burnt */
export const GOLD_MS = 2600;
export const SMOKE_MS = 2200;
/** a burnt loaf is cleared out this long after */
export const CLEAR_MS = 1100;
export const KNEADS = 3;
/** a cook this close to a station's spot is at it */
export const REACH = 50;

/** what each step of a loaf is worth to the baker who does it (a whole loaf is LOAF_WORK) */
export const WORK = { flour: 1, mixIn: 1, doughOut: 0.5, boardIn: 0.5, knead: 0.5, load: 1, pull: 1.5, pullDark: 0.5, serve: 2, serveDark: 1.5, burn: -1 };
export const LOAF_WORK = 9;

/** the floor a cook can stand on, and the island in the middle (kept clear by the cook's radius) */
export const FLOOR = { x0: 180, y0: 325, x1: 1260, y1: 780 };
export const ISLAND = { x0: 500, y0: 470, x1: 910, y1: 570 };
const BLOCK = { x0: ISLAND.x0 - COOK_R - 2, y0: ISLAND.y0 - COOK_R - 2, x1: ISLAND.x1 + COOK_R + 2, y1: ISLAND.y1 + COOK_R + 2 };

type StationDef = Pick<KStation, 'k' | 'x' | 'y' | 'w' | 'h' | 'sx' | 'sy'>;
export const LAYOUT: StationDef[] = [
  { k: 'flour', x: 40, y: 330, w: 120, h: 150, sx: 210, sy: 405 },
  { k: 'mixer', x: 265, y: 175, w: 130, h: 110, sx: 330, sy: 335 },
  { k: 'mixer', x: 425, y: 175, w: 130, h: 110, sx: 490, sy: 335 },
  { k: 'oven', x: 700, y: 175, w: 130, h: 110, sx: 765, sy: 335 },
  { k: 'oven', x: 850, y: 175, w: 130, h: 110, sx: 915, sy: 335 },
  { k: 'oven', x: 1000, y: 175, w: 130, h: 110, sx: 1065, sy: 335 },
  { k: 'board', x: 500, y: 470, w: 130, h: 100, sx: 565, sy: 432 },
  { k: 'board', x: 640, y: 470, w: 130, h: 100, sx: 705, sy: 432 },
  { k: 'counter', x: 780, y: 470, w: 130, h: 100, sx: 845, sy: 432 },
  { k: 'hatch', x: 1290, y: 420, w: 110, h: 200, sx: 1232, sy: 520 },
];

// ------------------------------------------------------------------ walking

/** does the segment a→b pass through the island? (Liang-Barsky against the blocked box) */
function hitsIsland(ax: number, ay: number, bx: number, by: number): boolean {
  const r = { x0: BLOCK.x0 + 1, y0: BLOCK.y0 + 1, x1: BLOCK.x1 - 1, y1: BLOCK.y1 - 1 };
  const dx = bx - ax;
  const dy = by - ay;
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  return clip(-dx, ax - r.x0) && clip(dx, r.x1 - ax) && clip(-dy, ay - r.y0) && clip(dy, r.y1 - ay) && t0 < t1;
}

/** the shortest way from (x, y) to (tx, ty) around the island, as waypoints */
export function findPath(x: number, y: number, tx: number, ty: number): number[] {
  if (!hitsIsland(x, y, tx, ty)) return [tx, ty];
  const nodes: [number, number][] = [
    [x, y],
    [BLOCK.x0 - 2, BLOCK.y0 - 2],
    [BLOCK.x1 + 2, BLOCK.y0 - 2],
    [BLOCK.x1 + 2, BLOCK.y1 + 2],
    [BLOCK.x0 - 2, BLOCK.y1 + 2],
    [tx, ty],
  ];
  const n = nodes.length;
  const dist = nodes.map(() => Infinity);
  const prev = nodes.map(() => -1);
  const done = nodes.map(() => false);
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (u < 0 || dist[i]! < dist[u]!)) u = i;
    if (u < 0 || dist[u] === Infinity || u === n - 1) break;
    done[u] = true;
    for (let v = 0; v < n; v++) {
      if (done[v] || v === u) continue;
      const [ax, ay] = nodes[u]!;
      const [bx, by] = nodes[v]!;
      if (hitsIsland(ax, ay, bx, by)) continue;
      const d = dist[u]! + Math.hypot(bx - ax, by - ay);
      if (d < dist[v]!) {
        dist[v] = d;
        prev[v] = u;
      }
    }
  }
  if (prev[n - 1] < 0) return [tx, ty];
  const out: number[] = [];
  for (let v = n - 1; v > 0; v = prev[v]!) out.unshift(nodes[v]![0], nodes[v]![1]);
  return out;
}

/** a cook walked along its path for `ms`: where it is, and how many waypoints it passed (where every screen draws
 * it between snapshots) */
export function walked(c: Cook, ms: number): [number, number, number] {
  let x = c.x;
  let y = c.y;
  let passed = 0;
  let left = (c.speed * Math.max(0, ms)) / 1000;
  for (let i = 0; i + 1 < c.path.length && left > 0; i += 2) {
    const tx = c.path[i]!;
    const ty = c.path[i + 1]!;
    const d = Math.hypot(tx - x, ty - y);
    if (d <= left) {
      x = tx;
      y = ty;
      left -= d;
      passed++;
    } else {
      x += ((tx - x) / d) * left;
      y += ((ty - y) / d) * left;
      left = 0;
    }
  }
  return [x, y, passed];
}

function keepOnFloor(c: Cook): void {
  c.x = clamp(c.x, FLOOR.x0, FLOOR.x1);
  c.y = clamp(c.y, FLOOR.y0, FLOOR.y1);
  // out of the island, by the shortest way
  if (c.x > BLOCK.x0 && c.x < BLOCK.x1 && c.y > BLOCK.y0 && c.y < BLOCK.y1) {
    const out = [c.x - BLOCK.x0, BLOCK.x1 - c.x, c.y - BLOCK.y0, BLOCK.y1 - c.y];
    const m = Math.min(...out);
    if (m === out[0]) c.x = BLOCK.x0;
    else if (m === out[1]) c.x = BLOCK.x1;
    else if (m === out[2]) c.y = BLOCK.y0;
    else c.y = BLOCK.y1;
  }
}

export function atStation(c: Cook, s: KStation): boolean {
  return Math.hypot(c.x - s.sx, c.y - s.sy) <= REACH;
}

/** the station a cook is standing at (nearest spot within reach), or undefined */
export function stationOf(k: KitchenState, c: Cook): KStation | undefined {
  let best: KStation | undefined;
  let bd = REACH;
  for (const s of k.stations) {
    const d = Math.hypot(c.x - s.sx, c.y - s.sy);
    if (d <= bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

// ------------------------------------------------------------------ the kitchen

export function newKitchen(st: MatchState, now: number, seconds: number): KitchenState {
  const r = new Rng(st.rngState ^ 0x6b17);
  const open = st.seats.map((_, i) => i).filter((i) => seatOpen(st, i));
  // tickets per seat: the clock after the first loaf's start-up, at a ticket every kitchenTicketS each
  const per = Math.max(1.25, (seconds - BAL.kitchenStartS) / BAL.kitchenTicketS);
  const chain = order(st).games.length > 1 ? 0.5 : 1;
  const chaos = 1 + BAL.chaosAllowance * chaosCount(st);
  const life = clamp(seconds * BAL.kitchenTicketLife, 18, 32) * 1000;
  const full = st.bakeries.map(() => 0);
  const tickets: Ticket[] = [];
  let id = 1;
  st.bakeries.forEach((b, bi) => {
    if (b.closed) return;
    const k = b.members.filter((m) => seatOpen(st, m)).length;
    if (!k) return;
    const n = Math.max(k + 1, Math.round(per * k));
    // a bakery of one or two can't share the steps out: its customers wait a little longer
    const wait = life * (k === 1 ? 1.3 : k === 2 ? 1.15 : 1);
    full[bi] = order(st).need * BAL.yieldFactor * BAL.kitchenYield * chain * chaos;
    // tickets come in over the first half of the game; the last ones wait until the bell
    const spacing = (seconds * 1000 * 0.55) / n;
    for (let j = 0; j < n; j++) {
      const at = Math.round(now + 600 + j * spacing + r.range(0, Math.min(600, spacing * 0.4)));
      tickets.push({ id: id++, b: bi, at, due: Math.round(at + wait), st: 'wait', by: -1 });
    }
  });
  tickets.sort((a, b) => a.at - b.at);
  const cooks: Cook[] = open.map((seat, i) => {
    const mult = skillMult(st.seats[seat]!.baker, 'kitchen');
    return { seat, x: 340 + (i * 760) / Math.max(1, open.length - 1), y: 720, path: [], go: -1, hold: null, speed: Math.round(SPEED * (1 + (mult - 1) * 0.4)) };
  });
  return {
    game: 'kitchen',
    round: st.round,
    start: now,
    end: now + seconds * 1000,
    t: now,
    cooks,
    stations: LAYOUT.map((d, i) => ({ id: i, ...d, item: null, start: 0, taps: 0, by: -1 })),
    tickets,
    full,
    loaves: st.bakeries.map(() => 0),
    work: st.seats.map(() => 0),
    started: st.seats.map(() => 0),
    served: st.seats.map(() => 0),
    burnt: st.seats.map(() => 0),
    per,
    seatBakery: st.seats.map((_, i) => bakeryOf(st, i)),
    events: [],
    n: 0,
    rng: r.s,
  };
}

function ev(k: KitchenState, kind: KEvent['k'], seat: number, s: number, g?: string): void {
  k.n++;
  k.events.push({ n: k.n, k: kind, seat, s, ...(g ? { g } : {}) });
  if (k.events.length > 40) k.events.splice(0, k.events.length - 40);
}

/** an oven's loaf: raw, golden, smoking or burnt (the window is the loader's: skill widens it, salt narrows it) */
export function ovenZone(st: MatchState, s: KStation, now: number): 'raw' | 'golden' | 'smoke' | 'burnt' {
  const d = now - s.start;
  if (d < BAKE_MS) return 'raw';
  const who = st.seats[s.by];
  const mult = who ? skillMult(who.baker, 'kitchen') : 1;
  const tiny = has(st, 'tiny') ? 0.8 : 1;
  const gold = GOLD_MS * mult * tiny;
  if (d < BAKE_MS + gold) return 'golden';
  if (d < BAKE_MS + gold + SMOKE_MS) return 'smoke';
  return 'burnt';
}

/** what a bakery's served tickets put on its tray: all of them is `full`; the curve is as forgiving as the solo games'
 * (q^0.5), so most of the tickets served is most of a tray, and one jam in a shared kitchen doesn't sink the order */
export function kitchenLoaves(k: KitchenState, b: number): number {
  const mine = k.tickets.filter((t) => t.b === b);
  if (!mine.length) return 0;
  const done = mine.filter((t) => t.st === 'done').length;
  return k.full[b]! * Math.pow(done / mine.length, BAL.yieldCurve);
}

/** the oldest ticket of this bakery still waiting for a loaf */
export function openTicket(k: KitchenState, b: number): Ticket | undefined {
  return k.tickets.find((t) => t.b === b && t.st === 'open');
}

/** a cook uses the station it's at; `arrived` is the use on walking up (a board's kneads are taps, not arrivals) */
function use(k: KitchenState, st: MatchState, c: Cook, s: KStation, now: number, arrived: boolean): boolean {
  const seat = c.seat;
  const b = k.seatBakery[seat]!;
  const h = c.hold;
  const nope = (): boolean => {
    if (!arrived) ev(k, 'nope', seat, s.id);
    return false;
  };
  switch (s.k) {
    case 'flour':
      // flour can go back in the bin (with both mixers full, it's the way out)
      if (h?.k === 'flour') {
        c.hold = null;
        k.work[seat]! -= WORK.flour;
        k.started[seat]!--;
        ev(k, 'put', seat, s.id);
        return true;
      }
      if (h) return nope();
      c.hold = { k: 'flour', b };
      k.work[seat]! += WORK.flour;
      k.started[seat]!++;
      ev(k, 'take', seat, s.id);
      return true;
    case 'mixer':
      if (h?.k === 'flour' && !s.item) {
        s.item = h;
        s.start = now;
        s.by = seat;
        c.hold = null;
        k.work[seat]! += WORK.mixIn;
        ev(k, 'mix', seat, s.id);
        return true;
      }
      if (!h && s.item?.k === 'dough') {
        c.hold = s.item;
        s.item = null;
        k.work[seat]! += WORK.doughOut;
        ev(k, 'pick', seat, s.id);
        return true;
      }
      return nope();
    case 'board':
      if (h?.k === 'dough' && !s.item) {
        s.item = h;
        s.taps = 0;
        s.by = seat;
        c.hold = null;
        k.work[seat]! += WORK.boardIn;
        ev(k, 'put', seat, s.id);
        return true;
      }
      if (!h && s.item?.k === 'dough') {
        if (arrived) return false;
        s.taps++;
        k.work[seat]! += WORK.knead;
        ev(k, 'knead', seat, s.id);
        if (s.taps >= KNEADS) {
          c.hold = { k: 'shaped', b: s.item.b };
          s.item = null;
          s.taps = 0;
          ev(k, 'shape', seat, s.id);
        }
        return true;
      }
      return nope();
    case 'oven':
      if (h?.k === 'shaped' && !s.item) {
        s.item = h;
        s.start = now;
        s.by = seat;
        c.hold = null;
        k.work[seat]! += WORK.load;
        ev(k, 'load', seat, s.id);
        return true;
      }
      if (!h && s.item?.k === 'shaped') {
        const z = ovenZone(st, s, now);
        if (z === 'raw' || z === 'burnt') return nope();
        c.hold = { k: z === 'golden' ? 'loaf' : 'dark', b: s.item.b };
        s.item = null;
        k.work[seat]! += z === 'golden' ? WORK.pull : WORK.pullDark;
        ev(k, 'pull', seat, s.id, z);
        return true;
      }
      return nope();
    case 'counter':
      if (h && !s.item) {
        s.item = h;
        c.hold = null;
        ev(k, 'put', seat, s.id);
        return true;
      }
      if (!h && s.item) {
        c.hold = s.item;
        s.item = null;
        ev(k, 'pick', seat, s.id);
        return true;
      }
      return nope();
    case 'hatch': {
      if (!h || (h.k !== 'loaf' && h.k !== 'dark')) return nope();
      const tk = openTicket(k, h.b);
      if (!tk) return nope();
      tk.st = 'done';
      tk.by = seat;
      k.loaves[h.b] = kitchenLoaves(k, h.b);
      k.served[seat]!++;
      k.work[seat]! += h.k === 'loaf' ? WORK.serve : WORK.serveDark;
      c.hold = null;
      ev(k, 'serve', seat, s.id, h.k);
      return true;
    }
  }
  return false;
}

/** a seat tapped a station: walk there, or use it if already there */
export function kitchenAct(k: KitchenState, st: MatchState, seat: number, sid: number, now: number): boolean {
  if (now < k.start || now > k.end) return false;
  const c = k.cooks.find((x) => x.seat === seat);
  const s = k.stations[sid];
  if (!c || !s) return false;
  if (!c.path.length && atStation(c, s)) return use(k, st, c, s, now, false);
  c.path = findPath(c.x, c.y, s.sx, s.sy);
  c.go = sid;
  return true;
}

/** move everyone, mix, bake, burn, open and close tickets; true if anything happened */
export function stepKitchen(k: KitchenState, st: MatchState, now: number): boolean {
  const dt = clamp((now - k.t) / 1000, 0, 0.25);
  k.t = now;
  let changed = false;
  if (now < k.start) return false;
  // walk
  for (const c of k.cooks) {
    if (!c.path.length) continue;
    const [x, y, passed] = walked(c, dt * 1000);
    c.x = x;
    c.y = y;
    c.path.splice(0, passed * 2);
  }
  // bump: cooks push each other apart, sliding round to the side so two never stand nose to nose
  for (let i = 0; i < k.cooks.length; i++) {
    for (let j = i + 1; j < k.cooks.length; j++) {
      const a = k.cooks[i]!;
      const b = k.cooks[j]!;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      if (d >= COOK_R * 2) continue;
      if (d < 0.01) {
        dx = 1;
        dy = 0;
        d = 1;
      }
      const nx = dx / d;
      const ny = dy / d;
      const push = (COOK_R * 2 - d) / 2;
      const px = nx - ny * 0.5;
      const py = ny + nx * 0.5;
      a.x -= px * push;
      a.y -= py * push;
      b.x += px * push;
      b.y += py * push;
    }
  }
  for (const c of k.cooks) {
    keepOnFloor(c);
    // pushed somewhere the next leg would cross the island: find the way again
    const n = c.path.length;
    if (n && hitsIsland(c.x, c.y, c.path[0]!, c.path[1]!)) c.path = findPath(c.x, c.y, c.path[n - 2]!, c.path[n - 1]!);
    if (!c.path.length && c.go >= 0) {
      const s = k.stations[c.go]!;
      c.go = -1;
      if (atStation(c, s)) use(k, st, c, s, now, true);
      changed = true;
    }
  }
  // the stations
  for (const s of k.stations) {
    if (s.k === 'mixer' && s.item?.k === 'flour' && now - s.start >= MIX_MS) {
      s.item.k = 'dough';
      ev(k, 'dough', s.by, s.id);
      changed = true;
    }
    if (s.k === 'oven' && s.item?.k === 'shaped' && ovenZone(st, s, now) === 'burnt') {
      s.item.k = 'burnt';
      s.start = now;
      if (s.by >= 0) {
        k.burnt[s.by]!++;
        k.work[s.by]! += WORK.burn;
      }
      ev(k, 'burn', s.by, s.id);
      changed = true;
    } else if (s.k === 'oven' && s.item?.k === 'burnt' && now - s.start >= CLEAR_MS) {
      s.item = null;
      changed = true;
    }
  }
  // the tickets
  for (const t of k.tickets) {
    if (t.st === 'wait' && now >= t.at) {
      t.st = 'open';
      changed = true;
    } else if (t.st === 'open' && now >= t.due) {
      t.st = 'missed';
      ev(k, 'miss', -1, -1);
      changed = true;
    }
  }
  return changed;
}

/** every ticket is served or gone: nothing left to bake for */
export function kitchenDone(k: KitchenState): boolean {
  return k.tickets.length > 0 && k.tickets.every((t) => t.st === 'done' || t.st === 'missed');
}

/** each seat's result: q is its share of the work (its part of every loaf its bakery was asked for, golden, is a full
 * game) and how many of those tickets got served; its bakery's served loaves are split between its bakers by the
 * work they put in */
export function kitchenResults(k: KitchenState, st: MatchState): GameResult[] {
  const share = k.per * LOAF_WORK;
  return st.seats.map((_, seat) => {
    const b = k.seatBakery[seat]!;
    if (b < 0 || !seatOpen(st, seat) || !k.cooks.some((c) => c.seat === seat)) return { q: 0, kitchen: { loaves: 0, served: 0, burnt: 0 } };
    const mine = Math.max(0, k.work[seat]!);
    let team = 0;
    for (const c of k.cooks) if (k.seatBakery[c.seat] === b) team += Math.max(0, k.work[c.seat]!);
    const loaves = team > 0 ? (k.loaves[b]! * mine) / team : 0;
    const mineT = k.tickets.filter((t) => t.b === b);
    const served = mineT.length ? mineT.filter((t) => t.st === 'done').length / mineT.length : 0;
    return { q: clamp((mine / share) * (0.55 + 0.45 * served), 0, 1), kitchen: { loaves, served: k.served[seat]!, burnt: k.burnt[seat]! } };
  });
}

// ------------------------------------------------------------------ AI cooks

export interface KitchenAiMind {
  readyAt: number;
  /** the station it's heading for (others leave it be) */
  target: number;
  tapAt: number;
  pullAt: number;
  /** how sharp it is this game (1 = its level; people are streaky): its reactions, kneading and pulls scale by this */
  form: number;
}

const REACT = { 1: 1250, 2: 1050, 3: 700 } as const;
const TAP = { 1: 430, 2: 330, 3: 250 } as const;
/** how late after the loaf turns golden an AI pulls it: mean and spread, ms */
const PULL_LATE = { 1: [1000, 750], 2: [700, 600], 3: [300, 320] } as const;

function walkMs(c: Cook, s: KStation): number {
  return (Math.hypot(s.sx - c.x, s.sy - c.y) / c.speed) * 1000;
}

/** what an AI cook should do next: the station to go to (or use, if it's there), or -1 */
function chooseTask(k: KitchenState, st: MatchState, c: Cook, minds: Map<number, KitchenAiMind>, now: number): number {
  const b = k.seatBakery[c.seat]!;
  const taken = (sid: number): boolean => k.cooks.some((o) => o !== c && (o.go === sid || (minds.get(o.seat)?.target === sid && (o.path.length > 0 || atStation(o, k.stations[sid]!)))));
  const someoneAt = (s: KStation): boolean => k.cooks.some((o) => o !== c && !o.path.length && atStation(o, s));
  const nearest = (ok: (s: KStation) => boolean): number => {
    let best = -1;
    let bd = Infinity;
    for (const s of k.stations) {
      if (!ok(s) || taken(s.id)) continue;
      const d = walkMs(c, s);
      if (d < bd) {
        bd = d;
        best = s.id;
      }
    }
    return best;
  };
  const flourId = k.stations.find((s) => s.k === 'flour')!.id;
  const h = c.hold;
  if (h) {
    if (h.k === 'loaf' || h.k === 'dark') return openTicket(k, h.b) ? k.stations.find((s) => s.k === 'hatch')!.id : nearest((s) => s.k === 'counter' && !s.item);
    if (h.k === 'shaped') return nearest((s) => s.k === 'oven' && !s.item);
    if (h.k === 'dough') {
      const bd = nearest((s) => s.k === 'board' && !s.item);
      return bd >= 0 ? bd : nearest((s) => s.k === 'counter' && !s.item);
    }
    if (h.k === 'flour') {
      const mx = nearest((s) => s.k === 'mixer' && !s.item);
      // no mixer free: back in the bin, so its hands are free for the dough that's waiting
      return mx >= 0 ? mx : flourId;
    }
    return -1;
  }
  // a loaf of ours about to come out
  const oven = nearest((s) => s.k === 'oven' && s.item?.k === 'shaped' && s.item.b === b && s.start + BAKE_MS - now <= walkMs(c, s) + 400);
  if (oven >= 0) return oven;
  // our dough is (nearly) mixed
  const mixer = nearest((s) => s.k === 'mixer' && !!s.item && s.item.b === b && (s.item.k === 'dough' || s.start + MIX_MS - now <= walkMs(c, s) + 300));
  if (mixer >= 0) return mixer;
  // our dough on a board, nobody kneading it
  const board = nearest((s) => s.k === 'board' && s.item?.k === 'dough' && s.item.b === b && !someoneAt(s));
  if (board >= 0) return board;
  const counter = nearest((s) => s.k === 'counter' && !!s.item && s.item.b === b && s.item.k !== 'burnt');
  if (counter >= 0) return counter;
  // start a loaf if the tickets coming need more than is already on the go (and leave people their share)
  // ... and only with a mixer for it: four cooks with flour and two full mixers is a kitchen nobody can move in
  const fetching = k.cooks.filter((o) => o !== c && (o.hold?.k === 'flour' || o.go === flourId || (minds.get(o.seat)?.target === flourId && o.path.length > 0))).length;
  const freeMixers = k.stations.filter((s) => s.k === 'mixer' && !s.item).length;
  let pipeline = k.cooks.filter((o) => o !== c && !o.hold && o.go === flourId && k.seatBakery[o.seat] === b).length;
  for (const o of k.cooks) if (o.hold && o.hold.b === b) pipeline++;
  for (const s of k.stations) if (s.item && s.item.b === b && s.item.k !== 'burnt') pipeline++;
  const wanted = k.tickets.filter((t) => t.b === b && (t.st === 'open' || (t.st === 'wait' && t.at - now < 6000))).length;
  const late = now > k.start + (k.end - k.start) * 0.5;
  if (wanted > pipeline && freeMixers > fetching && (k.started[c.seat]! < Math.ceil(k.per) || late)) return flourId;
  return -1;
}

/** AI seats cook like people do (they walk the same floor, with reaction time and late pulls); true if anything changed */
export function aiKitchen(k: KitchenState, st: MatchState, minds: Map<number, KitchenAiMind>, now: number, aiSeats: number[]): boolean {
  if (now < k.start || now > k.end) return false;
  const r = new Rng(k.rng ^ Math.floor(now / 97));
  let changed = false;
  for (const seat of aiSeats) {
    const c = k.cooks.find((x) => x.seat === seat);
    if (!c || !seatOpen(st, seat)) continue;
    const lvl = st.seats[seat]!.aiLevel;
    let m = minds.get(seat);
    if (!m) {
      m = { readyAt: now + r.range(300, 1200), target: -1, tapAt: 0, pullAt: 0, form: clamp(1 + r.gauss() * BAL.kitchenAiForm, 0.6, 1.9) };
      minds.set(seat, m);
    }
    if (c.path.length) continue;
    const here = stationOf(k, c);
    const b = k.seatBakery[seat]!;
    // kneading: taps on a rhythm
    if (here?.k === 'board' && !c.hold && here.item?.k === 'dough') {
      if (now >= m.tapAt) {
        if (m.tapAt) use(k, st, c, here, now, false);
        m.tapAt = now + TAP[lvl] * m.form * r.range(0.8, 1.25);
        changed = true;
      }
      continue;
    }
    m.tapAt = 0;
    // at an oven of ours: wait for gold, then pull (a little late, by level)
    if (here?.k === 'oven' && !c.hold && here.item?.k === 'shaped' && here.item.b === b && m.target === here.id) {
      const z = ovenZone(st, here, now);
      if (z === 'raw') continue;
      if (!m.pullAt) m.pullAt = Math.max(now, here.start + BAKE_MS + Math.max(60, PULL_LATE[lvl][0] * m.form + r.gauss() * PULL_LATE[lvl][1]));
      if (now >= m.pullAt || z === 'smoke') {
        use(k, st, c, here, now, false);
        m.pullAt = 0;
        m.target = -1;
        m.readyAt = now + REACT[lvl] * m.form * 0.5;
        changed = true;
      }
      continue;
    }
    m.pullAt = 0;
    if (now < m.readyAt) continue;
    m.readyAt = now + REACT[lvl] * m.form * r.range(0.7, 1.3);
    const task = chooseTask(k, st, c, minds, now);
    m.target = task;
    if (task < 0) {
      // nothing to do: out of the way of the stations
      if (here) {
        c.path = findPath(c.x, c.y, clamp(c.x, 300, 1150), 740);
        changed = true;
      }
      continue;
    }
    const s = k.stations[task]!;
    if (here === s) use(k, st, c, s, now, false);
    else kitchenAct(k, st, seat, task, now);
    changed = true;
  }
  k.rng = (k.rng + 1) >>> 0;
  return changed;
}
