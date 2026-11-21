// The balance report: hundreds of AI nights per style. `npm run balance` prints the table (docs/BALANCE.md);
// the test itself only holds the numbers inside the ranges the design asks for.
import { describe, expect, it } from 'vitest';
import { BAKERS } from '../src/game/data';
import { bakeryOf } from '../src/game/rules';
import { aiSeats, simulateNight } from '../src/game/sim';
import type { AiLevel, BakerId, MatchCfg, Style } from '../src/game/types';

const PRINT = !!process.env.BALANCE;
const N = PRINT ? 400 : 80;

interface Agg {
  nights: number;
  survived: number;
  fines: number;
  thirteenth: number;
  saves: number;
  minutes: number;
  short1: number;
  bakeries: number;
  bakeriesOk: number;
  wins: Record<string, number>;
  plays: Record<string, number>;
  stars: Record<string, number>;
}

function run(style: Style, level: AiLevel, length: MatchCfg['length'] = 'full', mods: MatchCfg['mods'] = []): Agg {
  const a: Agg = { nights: 0, survived: 0, fines: 0, thirteenth: 0, saves: 0, minutes: 0, short1: 0, bakeries: 0, bakeriesOk: 0, wins: {}, plays: {}, stars: {} };
  const ids = BAKERS.map((b) => b.id);
  for (let n = 0; n < N; n++) {
    // rotate who sits where so every baker meets every other
    const four: BakerId[] = [0, 1, 2, 3].map((k) => ids[(n + k * (1 + (n % 5))) % 6]!).filter((v, i, arr) => arr.indexOf(v) === i);
    while (four.length < 4) four.push(ids.find((x) => !four.includes(x))!);
    const { st, ms } = simulateNight({ style, length, mods, aiLevel: level, seed: 1000 + n * 7919, night: null, daily: null }, aiSeats(four, level, style));
    a.nights++;
    a.minutes += ms / 60000;
    if (st.over!.survived.some(Boolean)) a.survived++;
    a.bakeries += st.bakeries.length;
    a.bakeriesOk += st.over!.survived.filter(Boolean).length;
    a.fines += st.bakeries.reduce((s, b) => s + b.fines, 0);
    a.thirteenth += st.players.reduce((s, p) => s + p.loaves13, 0);
    const winner = st.over!.ranking[0]!;
    st.seats.forEach((s, i) => {
      a.plays[s.baker] = (a.plays[s.baker] ?? 0) + 1;
      a.stars[s.baker] = (a.stars[s.baker] ?? 0) + st.players[i]!.stars;
    });
    if (st.over!.survived[bakeryOf(st, winner)]) a.wins[st.seats[winner]!.baker] = (a.wins[st.seats[winner]!.baker] ?? 0) + 1;
  }
  return a;
}

function table(name: string, a: Agg): string {
  const rows = BAKERS.map((b) => {
    const plays = a.plays[b.id] ?? 1;
    return `| ${b.name} | ${(((a.wins[b.id] ?? 0) / plays) * 100).toFixed(1)}% | ${((a.stars[b.id] ?? 0) / plays).toFixed(1)} |`;
  });
  return [
    `### ${name}`,
    `${a.nights} nights · survived ${((a.survived / a.nights) * 100).toFixed(0)}% (each bakery ${((a.bakeriesOk / a.bakeries) * 100).toFixed(0)}%) · fines/night ${(a.fines / a.nights).toFixed(2)} · 13th loaves/night ${(a.thirteenth / a.nights).toFixed(1)} · ${(a.minutes / a.nights).toFixed(1)} min/night`,
    '',
    '| Baker | Win rate (per seat) | Avg ★ |',
    '| --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

describe('balance', () => {
  it('co-opetition at normal AI: the bakery usually survives, but seals crack', () => {
    const a = run('coopetition', 2);
    if (PRINT) console.log(table('Co-opetition, Full Dozen, AI level 2', a));
    const rate = a.survived / a.nights;
    expect(rate).toBeGreaterThan(0.85);
    expect(rate).toBeLessThan(0.99);
    // the Inspector is a real threat: about one cracked seal a night
    expect(a.fines / a.nights).toBeGreaterThan(0.5);
    // every baker wins between 12% and 40% of their seats (25% is even; winner-takes-all magnifies small edges)
    for (const b of BAKERS) {
      const w = (a.wins[b.id] ?? 0) / (a.plays[b.id] ?? 1);
      expect(w, b.id).toBeGreaterThan(0.12);
      expect(w, b.id).toBeLessThan(0.4);
    }
  });

  it('prints the other styles', () => {
    if (!PRINT) return;
    console.log(table('Co-opetition, Full Dozen, AI level 1', run('coopetition', 1)));
    console.log(table('Co-opetition, Full Dozen, AI level 3', run('coopetition', 3)));
    console.log(table('Co-op, Full Dozen, AI level 2', run('coop', 2)));
    console.log(table('Free-for-all, Full Dozen, AI level 2', run('ffa', 2)));
    console.log(table('2v2, Full Dozen, AI level 2', run('teams', 2)));
    console.log(table('Co-opetition, Quick Shift, AI level 2', run('coopetition', 2, 'quick')));
    console.log(table('Co-opetition, Strict Inspector', run('coopetition', 2, 'full', ['strict'])));
    console.log(table('Co-opetition, Long Night', run('coopetition', 2, 'long')));
    console.log(table('Co-opetition, every chaos modifier', run('coopetition', 2, 'full', ['flourstorm', 'mirror', 'haunted', 'sabotage', 'swap', 'lightsout', 'tiny'])));
  });
});
