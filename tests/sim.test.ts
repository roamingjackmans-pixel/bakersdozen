// Every style, length and modifier plays a whole night to dawn without breaking the rules' invariants.
import { describe, expect, it } from 'vitest';
import { MODS } from '../src/game/data';
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
});
