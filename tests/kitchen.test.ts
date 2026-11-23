// All Hands: the whole table in one kitchen. AI cooks must get the order out; a person who plays well scores high,
// one who stands still or taps at random doesn't; nobody gets stuck on the floor.
import { describe, expect, it } from 'vitest';
import { BAL } from '../src/game/data';
import { KNEADS, LAYOUT, aiKitchen, atStation, kitchenAct, kitchenDone, kitchenLoaves, kitchenResults, newKitchen, openTicket, ovenZone, stationOf, stepKitchen, type KitchenAiMind, type KitchenState } from '../src/game/kitchen';
import { newMatch } from '../src/game/rules';
import { aiSeats } from '../src/game/sim';
import type { AiLevel, MatchState, Style } from '../src/game/types';

function table(style: Style = 'coopetition', level: AiLevel = 2, seed = 7, person = false): { st: MatchState; k: KitchenState } {
  const seats = aiSeats(['stephanie', 'joe', 'pip', 'bea'], level, style);
  if (person) seats[0] = { ...seats[0]!, id: 'local', ai: false };
  const st = newMatch({ style, length: 'quick', mods: [], aiLevel: level, seed, night: null, daily: null }, seats, 0);
  st.orders[0]!.games = ['kitchen'];
  return { st, k: newKitchen(st, 1000, 50) };
}

/** runs the kitchen to its bell; `person` acts for seat 0 every tick */
function cook(st: MatchState, k: KitchenState, ai: number[], person?: (now: number) => void): void {
  const minds = new Map<number, KitchenAiMind>();
  for (let now = 1000; now < k.end && !kitchenDone(k); now += 50) {
    stepKitchen(k, st, now);
    aiKitchen(k, st, minds, now, ai);
    person?.(now);
  }
}

/** a person who knows the kitchen: always the next step their loaf needs, after a human moment to decide */
function goodCook(st: MatchState, k: KitchenState): (now: number) => void {
  let next = 0;
  return (now) => {
    const c = k.cooks.find((x) => x.seat === 0)!;
    if (c.path.length || now < next) return;
    next = now + 350;
    const b = k.seatBakery[0]!;
    const here = stationOf(k, c);
    const go = (kind: string, ok: (s: (typeof k.stations)[number]) => boolean = () => true): boolean => {
      const s = k.stations.filter((x) => x.k === kind && ok(x)).sort((x, y) => Math.hypot(x.sx - c.x, x.sy - c.y) - Math.hypot(y.sx - c.x, y.sy - c.y))[0];
      if (!s) return false;
      kitchenAct(k, st, 0, s.id, now);
      return true;
    };
    const h = c.hold;
    if (h?.k === 'loaf' || h?.k === 'dark') return void (openTicket(k, h.b) ? go('hatch') : go('counter', (s) => !s.item));
    if (h?.k === 'shaped') return void go('oven', (s) => !s.item);
    if (h?.k === 'dough') return void go('board', (s) => !s.item);
    if (h?.k === 'flour') return void (go('mixer', (s) => !s.item) || go('flour'));
    if (here?.k === 'board' && here.item?.k === 'dough') return void kitchenAct(k, st, 0, here.id, now);
    if (here?.k === 'oven' && here.item?.k === 'shaped' && here.item.b === b && ovenZone(st, here, now) === 'raw') return;
    if (go('oven', (s) => s.item?.k === 'shaped' && s.item.b === b && now - s.start > 3500)) return;
    if (go('mixer', (s) => s.item?.k === 'dough' && s.item.b === b)) return;
    if (go('board', (s) => s.item?.k === 'dough' && s.item.b === b)) return;
    go('flour');
  };
}

describe('All Hands', () => {
  it('an AI table gets most of the order out', () => {
    let done = 0;
    let total = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const { st, k } = table('coopetition', 2, seed);
      cook(st, k, [0, 1, 2, 3]);
      done += k.tickets.filter((t) => t.st === 'done').length;
      total += k.tickets.length;
      // the served loaves are the bakery's, split by work: they add up
      const res = kitchenResults(k, st);
      expect(res.reduce((s, r) => s + r.kitchen!.loaves, 0)).toBeCloseTo(k.loaves[0]!, 6);
    }
    expect(done / total).toBeGreaterThan(0.75);
  });

  it('every ticket served is a full share of the order; fewer served is less, as forgiving as the solo games', () => {
    const { st, k } = table();
    const full = st.orders[0]!.need * BAL.yieldFactor * BAL.kitchenYield;
    expect(k.full[0]).toBeCloseTo(full, 6);
    for (const t of k.tickets) t.st = 'done';
    expect(kitchenLoaves(k, 0)).toBeCloseTo(full, 6);
    k.tickets.forEach((t, i) => (t.st = i % 4 ? 'done' : 'missed'));
    const share = k.tickets.filter((t) => t.st === 'done').length / k.tickets.length;
    expect(kitchenLoaves(k, 0)).toBeCloseTo(full * Math.pow(share, BAL.yieldCurve), 6);
  });

  it('a person who plays well scores high', () => {
    const { st, k } = table('coopetition', 2, 3, true);
    cook(st, k, [1, 2, 3], goodCook(st, k));
    const q = kitchenResults(k, st)[0]!.q;
    expect(k.served[0]).toBeGreaterThan(0);
    expect(q).toBeGreaterThan(0.75);
  });

  it('a person who plays well alone (free-for-all) serves their own tickets', () => {
    const { st, k } = table('ffa', 2, 4, true);
    cook(st, k, [1, 2, 3], goodCook(st, k));
    const mine = k.tickets.filter((t) => t.b === k.seatBakery[0]);
    expect(mine.filter((t) => t.st === 'done').length).toBeGreaterThanOrEqual(mine.length - 1);
    expect(kitchenResults(k, st)[0]!.q).toBeGreaterThan(0.7);
  });

  it('standing still scores 0 (and the AI cooks carry on)', () => {
    const { st, k } = table('coopetition', 2, 5, true);
    cook(st, k, [1, 2, 3]);
    expect(kitchenResults(k, st)[0]!.q).toBe(0);
    expect(k.tickets.filter((t) => t.st === 'done').length).toBeGreaterThan(k.tickets.length * 0.5);
  });

  it('tapping stations at random does not pay', () => {
    const { st, k } = table('coopetition', 2, 6, true);
    let r = 17;
    const rand = (): number => ((r = (r * 16807) % 2147483647) / 2147483647);
    cook(st, k, [1, 2, 3], (now) => {
      if (rand() < 0.15) kitchenAct(k, st, 0, Math.floor(rand() * LAYOUT.length), now);
    });
    expect(kitchenResults(k, st)[0]!.q).toBeLessThan(0.3);
  });

  it('a board takes its kneads as taps, not as walking up to it', () => {
    const { st, k } = table('coopetition', 2, 8, true);
    const c = k.cooks.find((x) => x.seat === 0)!;
    const board = k.stations.find((s) => s.k === 'board')!;
    c.hold = { k: 'dough', b: 0 };
    kitchenAct(k, st, 0, board.id, 1000);
    for (let now = 1000; now < 5000 && c.path.length; now += 50) stepKitchen(k, st, now);
    expect(board.item?.k).toBe('dough');
    expect(atStation(c, board)).toBe(true);
    for (let i = 0; i < KNEADS - 1; i++) kitchenAct(k, st, 0, board.id, 6000 + i);
    expect(c.hold).toBe(null);
    kitchenAct(k, st, 0, board.id, 6100);
    expect(c.hold?.k).toBe('shaped');
  });

  it('a cook gets from every station to every other', () => {
    for (let a = 0; a < LAYOUT.length; a++) {
      for (let b = 0; b < LAYOUT.length; b++) {
        const { st, k } = table('coopetition', 2, 9, true);
        // alone on the floor
        k.cooks = k.cooks.filter((c) => c.seat === 0);
        const c = k.cooks[0]!;
        c.x = LAYOUT[a]!.sx;
        c.y = LAYOUT[a]!.sy;
        kitchenAct(k, st, 0, b, 1000);
        let now = 1000;
        for (; now < 6000 && (c.path.length || c.go >= 0); now += 50) stepKitchen(k, st, now);
        expect(atStation(c, k.stations[b]!), `${a} → ${b}`).toBe(true);
        expect(now - 1000, `${a} → ${b}`).toBeLessThan(4000);
      }
    }
  });

  it('the kitchen stays plain JSON', () => {
    const { st, k } = table();
    cook(st, k, [0, 1, 2, 3]);
    expect(JSON.parse(JSON.stringify(k))).toEqual(k);
  });
});
