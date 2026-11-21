// Whole nights played by AI on a fake clock: the sim tests (every style and modifier must reach dawn) and the
// balance report (docs/BALANCE.md) use this.
import { DEFAULT_COSMETICS } from './data';
import { Night } from './flow';
import { newMatch } from './rules';
import type { AiLevel, BakerId, MatchCfg, MatchState, Seat, Style } from './types';

export function aiSeats(bakers: BakerId[], level: AiLevel, style: Style): Seat[] {
  return bakers.map((baker, i) => ({
    id: `ai:${i}`,
    name: baker,
    baker,
    ai: true,
    standIn: false,
    aiLevel: level,
    team: style === 'teams' ? (i < Math.ceil(bakers.length / 2) ? 0 : 1) : 0,
    cosmetics: { ...DEFAULT_COSMETICS },
  }));
}

export function simulateNight(cfg: MatchCfg, seats: Seat[], stepMs = 100): { st: MatchState; ms: number } {
  let now = 1_000_000;
  const night = new Night(newMatch(cfg, seats, now));
  const start = now;
  let guard = 0;
  while (night.st.phase !== 'over' && guard++ < 200_000) {
    now += stepMs;
    night.tick(now);
  }
  if (night.st.phase !== 'over') throw new Error(`night did not end (phase ${night.st.phase}, round ${night.st.round})`);
  return { st: night.st, ms: now - start };
}
