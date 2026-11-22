// The Shared Oven with AI rivals in it: a person must get a turn. AIs pull and reload in the same tick, so without a
// rule a player waiting with a tray could watch three AIs keep every slot all game.
import { describe, expect, it } from 'vitest';
import { aiOven, load, newOven, nextTray, stepOven, type OvenAiMind } from '../src/game/oven';
import { newMatch } from '../src/game/rules';
import { aiSeats } from '../src/game/sim';
import type { BakerId, MatchCfg } from '../src/game/types';

const FOUR: BakerId[] = ['stephanie', 'joe', 'pip', 'bea'];

function ovenNight() {
  const cfg: MatchCfg = { style: 'coopetition', length: 'quick', mods: [], aiLevel: 2, seed: 99, night: null, daily: null };
  const seats = aiSeats(FOUR, 2, 'coopetition');
  // seat 0 is a person
  seats[0] = { ...seats[0]!, id: 'local', ai: false };
  const now = 1_000_000;
  const st = newMatch(cfg, seats, now);
  const ov = newOven(st, now, 60);
  return { st, ov, now };
}

describe('the shared oven', () => {
  it('leaves a just-freed slot to a waiting player with fewer trays in', () => {
    const { st, ov, now: t0 } = ovenNight();
    const minds = new Map<number, OvenAiMind>();
    const ai = [1, 2, 3];
    let firstPull = -1;
    let personLoaded = -1;
    const freeFrom = new Map<number, number>();
    // the AIs fill the oven at the bell; the person loads once a slot has stood free for 400 ms (a human reaction)
    for (let now = t0; now < t0 + 40_000; now += 50) {
      stepOven(ov, st, now);
      aiOven(ov, st, minds, now, ai);
      if (firstPull < 0 && ov.trays.some((t) => t.st === 'out')) firstPull = now;
      const used = new Set(ov.trays.filter((t) => t.st === 'baking').map((t) => t.slot));
      for (let i = 0; i < ov.slots; i++) {
        if (used.has(i)) freeFrom.delete(i);
        else if (!freeFrom.has(i)) freeFrom.set(i, now);
      }
      const ready = [...freeFrom.entries()].find(([, at]) => now - at >= 400);
      if (firstPull >= 0 && ready && nextTray(ov, 0) && load(ov, 0, ready[0], now)) {
        personLoaded = now;
        break;
      }
    }
    expect(firstPull).toBeGreaterThan(0);
    // in at the first slot an AI frees, not after the AIs run out of trays
    expect(personLoaded).toBeGreaterThan(0);
    expect(personLoaded - firstPull).toBeLessThan(1000);
  });

  it('still fills a slot a player leaves empty', () => {
    const { st, ov, now: t0 } = ovenNight();
    const minds = new Map<number, OvenAiMind>();
    // the person never loads: after the grace, the AIs keep the oven busy
    let loads = 0;
    for (let now = t0; now < t0 + 40_000; now += 50) {
      stepOven(ov, st, now);
      if (aiOven(ov, st, minds, now, [1, 2, 3])) loads = ov.trays.filter((t) => t.owner !== 0 && t.st !== 'queue').length;
    }
    expect(loads).toBeGreaterThan(5);
  });
});
