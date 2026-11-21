// AI rivals: how well they bake (by level and the baker's skills), whether they pay for the 13th loaf, what they
// buy. Personalities come from each baker's greed (keeps Saffron for their own ★, leaves the bakery's 13th loaf
// to you) and mischief (sabotage).
import { BAKER, BAL, BUFFS, MINI_IDS, skillMult } from './data';
import { Rng, clamp } from './rng';
import { bakeryOf, canClaim, has, isLastPlace, order, priceFor, seatOpen, type BuyMsg } from './rules';
import type { GameId, GameResult, MatchState, MiniId } from './types';

// Easy rivals are easier to beat on ★ but still decent bakers: a weak table would sink your bakery (harder, not easier)
const LEVEL_Q = { 1: 0.59, 2: 0.645, 3: 0.76 } as const;

export function aiQuality(st: MatchState, seat: number, game: GameId, r: Rng): number {
  const s = st.seats[seat]!;
  const p = st.players[seat]!;
  let mean = LEVEL_Q[s.aiLevel] + (skillMult(s.baker, game) - 1) * 0.38;
  const def = MINI_IDS.includes(game as MiniId) ? p.buffs.some((b) => BUFFS[b].game === game) : false;
  // a buff for this game (people get about this much from Metronome, Steady Hands, Sharp Memory…)
  if (def) mean += 0.07;
  // Nonna Bea's perk is a free Sharp Memory
  if (s.baker === 'bea' && game === 'rush' && !def) mean += 0.07;
  if (p.salted) mean -= 0.15;
  if (p.flourAt) mean -= 0.07;
  for (const m of ['mirror', 'lightsout', 'tiny', 'flourstorm', 'swap', 'haunted'] as const) if (has(st, m)) mean -= 0.025;
  if (order(st).rush || has(st, 'midnight')) mean -= 0.03;
  if (order(st).twist === 'blackout') mean -= 0.03;
  return clamp(mean + r.gauss() * BAL.aiSpread, 0.05, 0.99);
}

export function aiResult(st: MatchState, seat: number, game: GameId, r: Rng): GameResult {
  const q = aiQuality(st, seat, game, r);
  const res: GameResult = { q };
  if (game === 'knead') res.beatStreak = Math.round(q * q * 18);
  if (game === 'proof' && q > 0.93 && r.chance(0.2)) res.natural20 = true;
  return res;
}

/** does this AI want the 13th loaf this order? */
export function aiWantsThirteenth(st: MatchState, seat: number, r: Rng): boolean {
  if (!canClaim(st, seat)) return false;
  const s = st.seats[seat]!;
  const p = st.players[seat]!;
  const greed = BAKER[s.baker].greed;
  const b = st.bakeries[bakeryOf(st, seat)]!;
  const short = order(st).need - b.tray;
  const late = st.round >= st.orders.length - 4;
  const humansHere = b.members.filter((m) => !st.seats[m]!.ai && !st.seats[m]!.standIn && st.players[m]!.saffron > 0 && m !== seat);
  if (short === 1) {
    if (st.cfg.style === 'ffa' || b.members.length === 1) return true;
    if (st.cfg.style === 'coop' || st.cfg.style === 'teams') return r.chance(0.85);
    if (b.seals <= 1) return r.chance(0.92);
    // solo co-opetition: greedy rivals leave the bakery's 13th loaf to you
    if (humansHere.length) return r.chance(0.12 + (1 - greed) * 0.2);
    return r.chance(0.55 + (1 - greed) * 0.4);
  }
  if (short <= 0) {
    if (p.loaves13 === 0 && late) return r.chance(0.75);
    return p.saffron >= 2 && r.chance(0.12 + greed * 0.3);
  }
  // too short to save: only for the ★, with Saffron to spare
  return p.saffron >= 2 && r.chance(greed * 0.25);
}

/** what this AI buys at the market this round (tried in order) */
export function aiShopping(st: MatchState, seat: number, r: Rng): BuyMsg[] {
  const s = st.seats[seat]!;
  const p = st.players[seat]!;
  const def = BAKER[s.baker];
  const buys: BuyMsg[] = [];
  if (!seatOpen(st, seat)) return buys;
  let tips = p.tips;
  const b = st.bakeries[bakeryOf(st, seat)]!;
  st.cart.forEach((it, i) => {
    const d = BUFFS[it.buff];
    const price = priceFor(st, seat, it);
    if (d.kind === 'staple') {
      if (p.saffron === 0 && tips >= price && r.chance(0.75)) {
        buys.push({ item: i });
        tips -= price;
      }
      return;
    }
    if (d.kind === 'team') {
      const left = it.price - (it.pool[bakeryOf(st, seat)] ?? 0);
      if (left <= 0) return;
      const need = it.buff === 'bribe' ? (b.seals < b.maxSeals ? 0.9 : 0.25) : 0.45;
      const chance = st.cfg.style === 'coop' ? need + 0.1 : need * (1 - def.greed * 0.6);
      if (tips > 1 && r.chance(chance)) {
        const share = Math.ceil(left / Math.max(1, b.members.length));
        const amt = Math.min(tips - 1, st.cfg.style === 'ffa' ? left : Math.max(2, share));
        if (amt > 0) {
          buys.push({ item: i, amount: amt });
          tips -= amt;
        }
      }
      return;
    }
    if (d.kind === 'personal') {
      // Stephanie sees the next order, so she buys the buff it needs
      const next = st.orders[st.round + 1]?.games ?? [];
      const wanted = s.baker === 'stephanie' && next.includes(d.game!) ? 0.9 : 0.35;
      if (!p.buffs.includes(it.buff) && tips >= price + 2 && r.chance(wanted)) {
        buys.push({ item: i });
        tips -= price;
      }
      return;
    }
    // rare
    if (it.soldTo >= 0 || tips < price) return;
    if (it.buff === 'recipe' && r.chance(0.3)) {
      const best = (Object.entries(def.skills) as [MiniId, number][]).sort((x, y) => y[1] - x[1])[0]![0];
      buys.push({ item: i, game: best });
      tips -= price;
      return;
    }
    if (d.sabotage && st.cfg.style !== 'coop' && r.chance(def.mischief * (isLastPlace(st, seat) ? 0.8 : 0.5))) {
      const target = sabotageTarget(st, seat, r);
      if (target >= 0) {
        buys.push({ item: i, target });
        tips -= price;
      }
    }
  });
  return buys;
}

/** the rival to pick on: the leader, usually */
export function sabotageTarget(st: MatchState, seat: number, r: Rng): number {
  const rivals = st.seats
    .map((_, i) => i)
    .filter((i) => i !== seat && seatOpen(st, i) && !(st.cfg.style === 'teams' && st.seats[i]!.team === st.seats[seat]!.team));
  if (!rivals.length) return -1;
  rivals.sort((a, b) => st.players[b]!.stars - st.players[a]!.stars);
  return r.chance(0.7) ? rivals[0]! : r.pick(rivals);
}
