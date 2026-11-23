// Every style, length and modifier plays a whole night to dawn without breaking the rules' invariants.
import { describe, expect, it } from 'vitest';
import { MODS, isShared } from '../src/game/data';
import { Night, OVEN_LINGER_MS } from '../src/game/flow';
import { bumperStars, gameSeconds, newMatch, settleOrder } from '../src/game/rules';
import { aiSeats, simulateNight } from '../src/game/sim';
import type { BakerId, MatchCfg, Style } from '../src/game/types';

const FOUR: BakerId[] = ['stephanie', 'joe', 'pip', 'bea'];

function cfg(style: Style, extra: Partial<MatchCfg> = {}): MatchCfg {
  return { style, length: 'quick', mods: [], aiLevel: 2, seed: 1234, night: null, daily: null, ...extra };
}

function sane(st: ReturnType<typeof simulateNight>['st']): void {
  expect(st.over).toBeTruthy();
  for (const p of st.players) {
    expect(p.stars).toBeGreaterThanOrEqual(0);
    expect(p.tips).toBeGreaterThanOrEqual(0);
    expect(p.saffron).toBeGreaterThanOrEqual(0);
    expect(p.saffron).toBeLessThanOrEqual(5);
    expect(Number.isFinite(p.stars)).toBe(true);
  }
  for (const b of st.bakeries) {
    expect(b.seals).toBeGreaterThanOrEqual(0);
    expect(b.tray).toBeGreaterThanOrEqual(0);
  }
  // the state stays plain JSON
  expect(JSON.parse(JSON.stringify(st))).toEqual(st);
}

describe('a whole night', () => {
  for (const style of ['coopetition', 'coop', 'ffa', 'teams'] as Style[]) {
    for (const length of ['quick', 'full', 'long'] as const) {
      it(`${style} / ${length}`, () => {
        const { st, ms } = simulateNight(cfg(style, { length, seed: 77 + length.length }), aiSeats(FOUR, 2, style));
        sane(st);
        // a full night at 4 seats stays in the advertised range
        const min = ms / 60000;
        if (!st.endEarly) expect(min).toBeLessThan(length === 'long' ? 55 : length === 'full' ? 34 : 18);
      });
    }
  }

  for (const m of MODS) {
    it(`modifier ${m.id}`, () => {
      const { st } = simulateNight(cfg('coopetition', { mods: [m.id], seed: 99 }), aiSeats(FOUR, 2, 'coopetition'));
      sane(st);
    });
  }

  it('every modifier at once', () => {
    const { st } = simulateNight(cfg('teams', { mods: MODS.map((m) => m.id), length: 'full', seed: 5 }), aiSeats(FOUR, 3, 'teams'));
    sane(st);
  });

  it('solo and two-player nights', () => {
    sane(simulateNight(cfg('coopetition', { seed: 3 }), aiSeats(['joe'], 1, 'coopetition')).st);
    sane(simulateNight(cfg('ffa', { seed: 4 }), aiSeats(['joe', 'wick'], 2, 'ffa')).st);
    sane(simulateNight(cfg('teams', { seed: 6 }), aiSeats(['joe', 'wick', 'pip'], 2, 'teams')).st);
  });

  it('campaign nights get stricter', () => {
    for (const night of [1, 7, 13]) sane(simulateNight(cfg('coopetition', { night, length: night === 13 ? 'full' : 'quick', aiLevel: 3, seed: night }), aiSeats(FOUR, 3, 'coopetition')).st);
  });

  it('the same seed plays the same night', () => {
    const a = simulateNight(cfg('coopetition', { seed: 42 }), aiSeats(FOUR, 2, 'coopetition')).st;
    const b = simulateNight(cfg('coopetition', { seed: 42 }), aiSeats(FOUR, 2, 'coopetition')).st;
    expect(a.players.map((p) => p.stars)).toEqual(b.players.map((p) => p.stars));
  });

  it('every game is followed by a count, in whole loaves (Long Night chains every order)', () => {
    let now = 1_000_000;
    const night = new Night(newMatch(cfg('coopetition', { length: 'long', seed: 8 }), aiSeats(FOUR, 2, 'coopetition'), now));
    let uncounted = 0;
    let calls = 0;
    let counts = 0;
    let key = '';
    for (let guard = 0; night.st.phase !== 'over' && guard < 200_000; guard++) {
      now += 100;
      night.tick(now);
      const s = night.st;
      const k = `${s.phase}:${s.round}:${s.part}:${s.tallyStep}`;
      if (k === key) continue;
      key = k;
      if (s.phase === 'play') {
        expect(uncounted).toBe(0);
        uncounted = 1;
      }
      if (s.phase === 'tally' && s.tallyStep === 0) {
        expect(uncounted).toBe(1);
        uncounted = 0;
        counts++;
        for (const b of s.bakeries) {
          expect(Number.isInteger(b.counted)).toBe(true);
          expect(Number.isInteger(b.tray)).toBe(true);
          expect(b.counted).toBeLessThanOrEqual(b.tray);
        }
      }
      if (s.phase === 'tally' && s.tallyStep === 1) calls++;
    }
    const st = night.st;
    expect(st.phase).toBe('over');
    expect(uncounted).toBe(0);
    const played = st.orders.slice(0, st.round + 1);
    // one count per game, one 13th-loaf call per order
    expect(counts).toBe(played.reduce((n, o) => n + o.games.length, 0));
    expect(calls).toBe(played.length);
    expect(played.some((o) => o.games.length > 1)).toBe(true);
  });

  it('a game ends as soon as every person is done (AI results are decided up front)', () => {
    let now = 1_000_000;
    const seats = aiSeats(FOUR, 2, 'coopetition');
    seats[0] = { ...seats[0]!, ai: false, id: 'me' };
    const night = new Night(newMatch(cfg('coopetition', { seed: 21 }), seats, now));
    let checked = 0;
    for (let guard = 0; night.st.phase !== 'over' && guard < 200_000 && checked < 3; guard++) {
      now += 100;
      night.tick(now);
      const s = night.st;
      const g = s.orders[s.round]!.games[s.part]!;
      if (s.phase !== 'play' || isShared(g) || now < s.phaseStart + 4000) continue;
      // the person meets their game's objective 1 s into play: the night moves on without waiting for the clock
      const end = s.phaseEnd;
      night.submit(0, s.round, s.part, { q: 0.8 });
      now += 100;
      night.tick(now);
      expect(night.st.phase).not.toBe('play');
      expect(now).toBeLessThan(end - 20_000);
      checked++;
    }
    expect(checked).toBe(3);
  });

  it('the order card can be skipped once every person is ready', () => {
    let now = 1_000_000;
    const seats = aiSeats(FOUR, 2, 'coopetition');
    seats[0] = { ...seats[0]!, ai: false, id: 'me' };
    seats[2] = { ...seats[2]!, ai: false, id: 'you' };
    const night = new Night(newMatch(cfg('coopetition', { seed: 23 }), seats, now));
    expect(night.st.phase).toBe('reveal');
    const end = night.st.phaseEnd;
    // a tap carried over from the screen before doesn't count
    night.ready(0, now + 200);
    expect(night.st.done).toEqual([]);
    now += 1000;
    night.ready(0, now);
    night.tick(now);
    expect(night.st.phase).toBe('reveal'); // the other person is still reading
    night.ready(2, now);
    night.tick(now);
    expect(night.st.phase).toBe('play');
    expect(now).toBeLessThan(end - 5000);
    // ready means nothing once the card is gone
    night.ready(0, now + 1000);
    expect(night.st.done).toEqual([]);
  });

  it('the oven closes a moment after its last tray is out', () => {
    let now = 1_000_000;
    const night = new Night(newMatch(cfg('coopetition', { seed: 31 }), aiSeats(FOUR, 2, 'coopetition'), now));
    let allOut = 0;
    let early = 0;
    for (let guard = 0; night.st.phase !== 'over' && guard < 200_000; guard++) {
      now += 100;
      const wasOven = night.st.phase === 'play' && !!night.oven;
      const end = night.st.phaseEnd;
      night.tick(now);
      const ov = night.oven;
      if (ov && ov.trays.every((t) => t.st === 'out') && !allOut) allOut = now;
      if (wasOven && night.st.phase !== 'play') {
        if (allOut) {
          expect(now - allOut).toBeLessThanOrEqual(OVEN_LINGER_MS + 100);
          if (now < end) early++;
        }
        allOut = 0;
      }
    }
    expect(early).toBeGreaterThan(0);
  });

  it('the lobby picks how long mini games run (not the Shared Oven or Dawn)', () => {
    const seats = aiSeats(FOUR, 2, 'coopetition');
    const at = (pace: 'short' | 'normal' | 'long'): number[] => {
      const st = newMatch(cfg('coopetition', { pace, seed: 9 }), seats, 0);
      return st.orders.map((_, i) => ((st.round = i), (st.part = 0), gameSeconds(st)));
    };
    const [short, normal, long] = [at('short'), at('normal'), at('long')];
    const st = newMatch(cfg('coopetition', { seed: 9 }), seats, 0);
    st.orders.forEach((o, i) => {
      if (o.games[0] === 'oven' || o.games[0] === 'dawn') {
        expect(short[i]).toBe(normal[i]);
        expect(long[i]).toBe(normal[i]);
      } else {
        expect(short[i]).toBe(Math.round(normal[i]! * 0.7));
        expect(long[i]).toBe(Math.round(normal[i]! * 1.4));
      }
    });
    // and whole nights still reach dawn
    sane(simulateNight(cfg('coopetition', { pace: 'short', seed: 12 }), seats).st);
    sane(simulateNight(cfg('ffa', { pace: 'long', seed: 13 }), aiSeats(FOUR, 2, 'ffa')).st);
  });

  it('a bumper batch (3+ over the order) pays every baker on the tray', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(bumperStars)).toEqual([0, 0, 0, 1, 2, 3, 3]);
    const st = newMatch(cfg('coopetition', { seed: 2 }), aiSeats(FOUR, 2, 'coopetition'), 0);
    const b = st.bakeries[0]!;
    const need = st.orders[0]!.need;
    const before = st.players.map((p) => p.stars);
    b.tray = need + 4;
    settleOrder(st);
    expect(st.players.map((p) => p.stars)).toEqual(before.map((s) => s + 2));
    expect(st.events.some((e) => e.k === 'bumper' && e.to === 2)).toBe(true);
    // just full: no bumper
    b.tray = need + 2;
    settleOrder(st);
    expect(st.players.map((p) => p.stars)).toEqual(before.map((s) => s + 2));
  });
});
