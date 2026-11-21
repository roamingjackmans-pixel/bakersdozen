// The rules: pure functions over the plain-JSON MatchState. Only the host (or the solo game) calls them; guests
// just draw the state the host sends. No Math.random(): every draw goes through the match's seeded Rng.
import { BAKER, BAL, BUFFS, CUSTOMERS, ITEMS, MINI_IDS, MODS, PERSONAL_BUFFS, RARE_BUFFS, TEAM_BUFFS, TWIST_IDS, skillMult } from './data';

const MODS_CHAOS = new Set<string>(MODS.filter((m) => m.chaos).map((m) => m.id));
import { Rng, clamp } from './rng';
import type { Bakery, BuffId, CartItem, GameId, GameResult, Grade, MatchCfg, MatchOver, MatchState, MiniId, Order, Phase, PlayerState, RoundScore, Seat, TwistId } from './types';

// ------------------------------------------------------------------ setup

export function orderCount(cfg: MatchCfg): number {
  return cfg.length === 'quick' ? 7 : 13;
}

export function emptyStats(): PlayerState['stats'] {
  return { perfect: 0, rescues: 0, burnt: 0, perfectPulls: 0, sabotages: 0, caught: 0, natural20: false, saltLeader: false, bestBeatStreak: 0, bakes: 0, tipsEarned: 0, starsFrom: {} };
}

function newPlayer(cfg: MatchCfg): PlayerState {
  const shortage = cfg.mods.includes('shortage') || (cfg.night !== null && cfg.night >= 8);
  return { stars: 0, tips: 3, saffron: shortage ? 0 : BAL.startSaffron, loaves13: 0, buffs: [], recipeFor: null, salted: false, flourAt: 0, chipped: 0, stats: emptyStats(), last: null };
}

/** which bakery each seat bakes for */
export function bakeryGroups(cfg: MatchCfg, seats: Seat[]): number[][] {
  if (cfg.style === 'ffa') return seats.map((_, i) => [i]);
  if (cfg.style === 'teams') {
    const a = seats.map((s, i) => (s.team === 0 ? i : -1)).filter((i) => i >= 0);
    const b = seats.map((s, i) => (s.team === 1 ? i : -1)).filter((i) => i >= 0);
    return [a, b].filter((g) => g.length);
  }
  return [seats.map((_, i) => i)];
}

export function maxSeals(cfg: MatchCfg): number {
  if (cfg.mods.includes('strict')) return 2;
  if (cfg.night !== null && cfg.night >= 11) return 2;
  return 3;
}

export function newMatch(cfg: MatchCfg, seats: Seat[], now: number): MatchState {
  const rng = new Rng(cfg.seed);
  const bakeries: Bakery[] = bakeryGroups(cfg, seats).map((members) => ({
    members,
    tray: 0,
    trayExact: 0,
    trayBy: seats.map(() => 0),
    seals: maxSeals(cfg),
    maxSeals: maxSeals(cfg),
    closed: false,
    closedAt: -1,
    bribes: 0,
    ovenSlots: 0,
    apprentice: 0,
    teamBuys: 0,
    thirteenth: -1,
    filled: 0,
    fines: 0,
    sheriff: 0,
  }));
  const st: MatchState = {
    v: 1,
    cfg,
    seats,
    players: seats.map(() => newPlayer(cfg)),
    bakeries,
    orders: makeOrders(cfg, rng),
    round: 0,
    part: 0,
    phase: 'reveal',
    phaseStart: now,
    phaseEnd: now + (BAL.revealS + 2) * 1000,
    cart: [],
    done: [],
    claims: [],
    tallyStep: 0,
    events: [],
    eventN: 0,
    over: null,
    rngState: rng.s,
    hearth: false,
    endEarly: false,
  };
  return st;
}

/** the night's orders: four simple ones to teach, then twists and chained games, then Dawn */
export function makeOrders(cfg: MatchCfg, rng: Rng): Order[] {
  const n = orderCount(cfg);
  const orders: Order[] = [];
  const intro = rng.shuffle(['knead', 'proof', 'decorate', 'scale', 'rush', 'oven'] as MiniId[]).slice(0, 4);
  // the oven is the loudest game: make sure it shows up in the teaching rounds
  if (!intro.includes('oven')) intro[rng.int(1, 3)] = 'oven';
  const used: Record<string, number> = {};
  let lastCustomer = '';
  let lastGame: GameId = 'knead';
  const night = cfg.night ?? 0;
  const twistP = cfg.night !== null ? clamp(0.25 + night * 0.055, 0.25, 0.95) : cfg.daily ? 0.65 : 0.55;
  const chainAll = cfg.length === 'long' || cfg.mods.includes('doubleshift');
  for (let i = 0; i < n; i++) {
    const last = i === n - 1;
    // the Sheriff comes by every few orders (never twice running)
    let cust = rng.pick(CUSTOMERS);
    if (i % 4 === 1 && lastCustomer !== 'sheriff') cust = CUSTOMERS[0]!;
    while (cust.id === lastCustomer || (cust.id === 'sheriff' && i % 4 !== 1 && rng.chance(0.5))) cust = rng.pick(CUSTOMERS);
    lastCustomer = cust.id;
    const item = rng.pick(cust.items);
    let games: GameId[];
    let twist: TwistId | null = null;
    if (last) games = ['dawn'];
    else {
      const pickGame = (avoid: GameId[]): MiniId => {
        const pref = (ITEMS[item]?.games ?? MINI_IDS).filter((g) => !avoid.includes(g));
        const pool = pref.length && rng.chance(0.6) ? pref : MINI_IDS.filter((g) => !avoid.includes(g));
        // least used first, so a night shows every game
        pool.sort((a, b) => (used[a] ?? 0) - (used[b] ?? 0) + (rng.next() - 0.5) * 0.9);
        return pool[0] ?? 'knead';
      };
      const first: MiniId = i < 4 ? intro[i]! : pickGame([lastGame]);
      games = [first];
      if (i >= 4 && rng.chance(twistP)) {
        twist = rng.pick(TWIST_IDS);
        // a co-op night has nothing to sabotage
        if (twist === 'watch' && cfg.style === 'coop') twist = 'taster';
      }
      if (chainAll || twist === 'double' || (i >= 4 && !twist && rng.chance(0.22))) {
        const second = pickGame([first, 'oven']);
        games = first === 'oven' ? [second, first] : [first, second];
      }
      for (const g of games) used[g] = (used[g] ?? 0) + 1;
      lastGame = games[games.length - 1]!;
    }
    orders.push({
      idx: i,
      customer: cust.id,
      item,
      games,
      rush: !last && (twist === 'rush' || (i >= 2 && !twist && rng.chance(0.18))),
      twist,
      need: twist === 'spotcheck' ? 13 : 12,
    });
  }
  return orders;
}

// ------------------------------------------------------------------ helpers

export function rngOf(st: MatchState): Rng {
  return new Rng(st.rngState);
}
export function saveRng(st: MatchState, r: Rng): void {
  st.rngState = r.s;
}

export function order(st: MatchState): Order {
  return st.orders[Math.min(st.round, st.orders.length - 1)]!;
}

export function currentGame(st: MatchState): GameId {
  const o = order(st);
  return o.games[Math.min(st.part, o.games.length - 1)]!;
}

export function bakeryOf(st: MatchState, seat: number): number {
  return st.bakeries.findIndex((b) => b.members.includes(seat));
}

export function seatOpen(st: MatchState, seat: number): boolean {
  const b = st.bakeries[bakeryOf(st, seat)];
  return !!b && !b.closed;
}

export function has(st: MatchState, ...mods: string[]): boolean {
  return mods.some((m) => (st.cfg.mods as string[]).includes(m));
}

export function pushEvent(st: MatchState, k: string, extra: Partial<{ seat: number; to: number; v: number; s: string }> = {}): void {
  st.eventN++;
  st.events.push({ n: st.eventN, k, ...extra });
  if (st.events.length > 40) st.events.splice(0, st.events.length - 40);
}

/** seconds the current game lasts */
export function gameSeconds(st: MatchState): number {
  const o = order(st);
  const g = currentGame(st);
  let s: number;
  if (g === 'dawn') s = BAL.dawnS;
  else if (o.games.length > 1) s = st.cfg.length === 'long' ? BAL.longS : BAL.chainS;
  else s = st.round < 4 ? BAL.playS : BAL.playLateS;
  if (o.rush) s *= 0.75;
  if (has(st, 'midnight')) s *= 0.75;
  return Math.max(4, Math.round(s * BAL.timeScale));
}

export function starMult(st: MatchState): number {
  const o = order(st);
  let m = 1;
  if (o.rush) m *= BAL.rushStars;
  if (o.twist === 'taster') m *= 1.5;
  if (has(st, 'midnight')) m *= 1.25;
  if (has(st, 'picky')) m *= 1.5;
  if (o.games.length > 1) m *= 0.62;
  return m;
}

export function gradeOf(q: number): Grade {
  if (q >= 0.9) return 'perfect';
  if (q >= 0.75) return 'great';
  if (q >= 0.5) return 'good';
  if (q >= BAL.flopBelow) return 'plain';
  return 'flop';
}

/** under this a bake puts nothing on the tray */
export function flopLine(st: MatchState): number {
  let f = BAL.flopBelow;
  if (has(st, 'picky')) f += 0.14;
  if (order(st).twist === 'shortweight') f = Math.max(f, 0.5);
  return f;
}

/** tray loaves a perfect game makes for this seat */
export function loafCap(st: MatchState, seat: number): number {
  const b = st.bakeries[bakeryOf(st, seat)]!;
  const k = Math.max(1, b.members.length);
  let cap = (order(st).need / k) * BAL.yieldFactor;
  if (order(st).games.length > 1) cap *= 0.5;
  // the Inspector makes allowances on a chaotic night
  cap *= 1 + BAL.chaosAllowance * chaosCount(st);
  return cap;
}

export function chaosCount(st: MatchState): number {
  return st.cfg.mods.filter((m) => MODS_CHAOS.has(m)).length;
}

// ------------------------------------------------------------------ scoring one game

/** apply one seat's result for the current game; returns what it earned */
export function scoreResult(st: MatchState, seat: number, res: GameResult): RoundScore {
  const p = st.players[seat]!;
  const s = st.seats[seat]!;
  const g = currentGame(st);
  const r = rngOf(st);
  const q = clamp(Number.isFinite(res.q) ? res.q : 0, 0, 1);
  const bi = bakeryOf(st, seat);
  const b = st.bakeries[bi]!;
  const grade = gradeOf(q);
  const o = order(st);
  let loaves: number;
  let stars: number;
  if (res.oven && (g === 'oven' || g === 'dawn')) {
    // the oven counts its own trays (rescued ones still go on their owner's tray, see oven.ts)
    loaves = res.oven.loaves;
    stars = res.oven.stars * starMult(st);
    b.trayExact = Math.max(0, b.trayExact + loaves);
    b.tray = Math.round(b.trayExact);
    b.trayBy[seat] = Math.max(0, (b.trayBy[seat] ?? 0) + loaves);
    p.stats.rescues += res.oven.rescues;
    p.stats.burnt += res.oven.burnt;
    p.stats.perfectPulls += res.oven.perfectPulls;
  } else {
    // a forgiving curve: a decent bake already puts most of a share on the tray, a perfect one a little more.
    // Shares add up exactly and the tray rounds the total, so the whole table's effort counts, not each rounding.
    const exact = q < flopLine(st) ? 0 : Math.pow(q, BAL.yieldCurve) * loafCap(st, seat);
    loaves = Math.round(exact * 10) / 10;
    stars = q * BAL.starsPerGame * BAL.gameWeight[g] * starMult(st);
    // Florentine's clean lines
    if (s.baker === 'florentine' && g === 'decorate' && q >= 0.82) stars *= 1.1;
    b.trayExact += exact;
    b.tray = Math.round(b.trayExact);
    b.trayBy[seat] = (b.trayBy[seat] ?? 0) + exact;
  }
  if (p.recipeFor && p.recipeFor === g) {
    stars *= 2;
    p.recipeFor = null;
    pushEvent(st, 'recipe', { seat });
  }
  let tips = (BAL.tipsBase + q * BAL.tipsPerQ) * (o.games.length > 1 ? 0.6 : 1);
  if (has(st, 'patrons')) tips *= 2;
  if (o.twist === 'tips') tips *= 2;
  if (s.baker === 'florentine' && (grade === 'plain' || grade === 'flop')) tips -= 1;
  // a rescued tray earns a favor
  tips += res.oven?.rescues ?? 0;
  tips = Math.max(0, Math.round(tips));
  let saffron = 0;
  if (q >= BAL.saffronDropAt && r.chance(has(st, 'shortage') ? 0.25 : BAL.saffronDropChance)) saffron = 1;
  const starsI = Math.round(stars);
  p.stars += starsI;
  p.tips += tips;
  p.saffron = Math.min(5, p.saffron + saffron);
  p.stats.bakes++;
  p.stats.tipsEarned += tips;
  p.stats.starsFrom[g] = (p.stats.starsFrom[g] ?? 0) + starsI;
  if (grade === 'perfect') p.stats.perfect++;
  if (res.natural20) p.stats.natural20 = true;
  if (res.beatStreak) p.stats.bestBeatStreak = Math.max(p.stats.bestBeatStreak, res.beatStreak);
  p.salted = false;
  p.flourAt = 0;
  const prev = st.part > 0 ? p.last : null;
  p.last = prev
    ? { q: (prev.q + q) / 2, loaves: prev.loaves + loaves, stars: prev.stars + starsI, tips: prev.tips + tips, saffron: prev.saffron + saffron, grade: gradeOf((prev.q + q) / 2) }
    : { q, loaves, stars: starsI, tips, saffron, grade };
  saveRng(st, r);
  return p.last;
}

// ------------------------------------------------------------------ tally: the tray, the 13th loaf, fines

export function canClaim(st: MatchState, seat: number): boolean {
  if (order(st).twist === 'nothirteenth') return false;
  const p = st.players[seat]!;
  return p.saffron > 0 && seatOpen(st, seat);
}

export function claimThirteenth(st: MatchState, seat: number, want: boolean): void {
  if (st.phase !== 'tally' || st.tallyStep !== 1) return;
  const i = st.claims.indexOf(seat);
  if (want && i < 0 && canClaim(st, seat)) st.claims.push(seat);
  if (!want && i >= 0) st.claims.splice(i, 1);
}

/** the Apprentice puts a loaf on, Saffron Shipments land */
export function beginTally(st: MatchState): void {
  const o = order(st);
  for (const b of st.bakeries) {
    if (b.closed) continue;
    if (b.apprentice > 0) {
      b.trayExact += 1;
      b.tray = Math.round(b.trayExact);
      b.apprentice--;
      pushEvent(st, 'apprentice', { v: st.bakeries.indexOf(b) });
    }
  }
  if (o.twist === 'shipment') for (const p of st.players) p.saffron = Math.min(5, p.saffron + 1);
  if (o.twist === 'bestinshow') {
    let best = -1;
    let bq = -1;
    st.players.forEach((p, i) => {
      if (seatOpen(st, i) && p.last && p.last.q > bq) {
        bq = p.last.q;
        best = i;
      }
    });
    if (best >= 0) {
      st.players[best]!.stars += 3;
      pushEvent(st, 'bestinshow', { seat: best });
    }
  }
}

/** one 13th loaf per bakery: whoever has baked the fewest gets it, then the one with fewer ★ */
export function resolveThirteenth(st: MatchState): void {
  const r = rngOf(st);
  st.bakeries.forEach((b, bi) => {
    b.thirteenth = -1;
    if (b.closed) return;
    const cands = st.claims.filter((s) => b.members.includes(s) && canClaim(st, s));
    if (!cands.length) return;
    cands.sort((x, y) => {
      const px = st.players[x]!;
      const py = st.players[y]!;
      return px.loaves13 - py.loaves13 || px.stars - py.stars || r.next() - 0.5;
    });
    const w = cands[0]!;
    const p = st.players[w]!;
    p.saffron--;
    p.loaves13++;
    p.stars += BAL.thirteenthStars;
    b.thirteenth = w;
    pushEvent(st, 'thirteenth', { seat: w, v: bi });
  });
  saveRng(st, r);
}

/** fill or fine every bakery; returns true when the night is over early */
export function settleOrder(st: MatchState): boolean {
  const o = order(st);
  st.bakeries.forEach((b, bi) => {
    if (b.closed) return;
    const total = b.tray + (b.thirteenth >= 0 ? 1 : 0);
    if (total >= o.need) {
      b.filled++;
      if (o.customer === 'sheriff') b.sheriff++;
      pushEvent(st, 'filled', { v: bi, s: o.customer });
    } else if (b.bribes > 0) {
      b.bribes--;
      pushEvent(st, 'bribed', { v: bi });
    } else {
      b.seals--;
      b.fines++;
      pushEvent(st, 'fine', { v: bi });
      if (b.seals <= 0) {
        b.closed = true;
        b.closedAt = st.round;
        pushEvent(st, 'closed', { v: bi });
      }
    }
  });
  return nightOverEarly(st);
}

export function nightOverEarly(st: MatchState): boolean {
  const open = st.bakeries.filter((b) => !b.closed).length;
  if (st.cfg.style === 'ffa' || st.cfg.style === 'teams') return st.bakeries.length > 1 ? open <= 1 : open === 0;
  return open === 0;
}

/** clear the trays for the next order */
export function resetTrays(st: MatchState): void {
  for (const b of st.bakeries) {
    b.tray = 0;
    b.trayExact = 0;
    b.trayBy = st.seats.map(() => 0);
    b.thirteenth = -1;
  }
  st.claims = [];
}

// ------------------------------------------------------------------ the market

export function standings(st: MatchState): number[] {
  return st.players.map((_, i) => i).sort((a, b) => st.players[b]!.stars - st.players[a]!.stars);
}

export function isLastPlace(st: MatchState, seat: number): boolean {
  if (st.cfg.style === 'coop' || st.seats.length < 2) return false;
  const open = st.players.map((_, i) => i).filter((i) => seatOpen(st, i));
  const min = Math.min(...open.map((i) => st.players[i]!.stars));
  const max = Math.max(...open.map((i) => st.players[i]!.stars));
  return max > min && st.players[seat]!.stars === min;
}

export function priceFor(st: MatchState, seat: number, it: CartItem): number {
  const def = BUFFS[it.buff];
  let p = it.price;
  if (st.seats[seat]!.baker === 'pip') p *= 1 - BAL.pipDiscount;
  if (def.sabotage && st.seats[seat]!.baker === 'wick') p *= 1 - BAL.wickSabotageDiscount;
  if (isLastPlace(st, seat)) p *= 1 - BAL.catchUpDiscount;
  if (def.kind === 'team') return Math.max(1, Math.round(it.price));
  return Math.max(1, Math.round(p));
}

export function openMarket(st: MatchState): void {
  const r = rngOf(st);
  const late = st.round >= Math.floor(st.orders.length * 0.35) || has(st, 'rarecart');
  const coop = st.cfg.style === 'coop';
  const ffa = st.cfg.style === 'ffa';
  const slots = has(st, 'rarecart') ? 4 : 3;
  const pool: BuffId[] = [...PERSONAL_BUFFS, ...PERSONAL_BUFFS, ...TEAM_BUFFS, ...TEAM_BUFFS];
  if (late) pool.push(...RARE_BUFFS.filter((b) => !(coop && BUFFS[b].sabotage)), ...RARE_BUFFS.filter((b) => !(coop && BUFFS[b].sabotage)));
  const chosen: BuffId[] = [];
  // a bakery with one seal left always sees a Bribe
  if (st.bakeries.some((b) => !b.closed && b.seals === 1 && b.maxSeals > 1)) chosen.push('bribe');
  while (chosen.length < slots && pool.length) {
    const b = pool.splice(Math.floor(r.next() * pool.length), 1)[0]!;
    if (!chosen.includes(b)) chosen.push(b);
  }
  st.cart = chosen.map((buff) => {
    const def = BUFFS[buff];
    const price = def.kind === 'team' && ffa ? Math.round(def.price * 0.55) : def.kind === 'team' && st.cfg.style === 'teams' ? Math.round(def.price * 0.75) : def.price;
    return { buff, price, pool: st.bakeries.map(() => 0), soldTo: -1, buyers: [], by: st.seats.map(() => 0) };
  });
  st.cart.push({ buff: 'saffron', price: BUFFS.saffron.price, pool: [], soldTo: -1, buyers: [], by: [] });
  // Sabotage Night: everyone gets a free shaker and cloud to throw
  if (has(st, 'sabotage') && !coop) {
    for (let i = 0; i < st.players.length; i++) {
      const p = st.players[i]!;
      if (!seatOpen(st, i)) continue;
      if (!p.buffs.includes('salt')) p.buffs.push('salt');
      if (!p.buffs.includes('flour')) p.buffs.push('flour');
    }
  }
  st.done = [];
  saveRng(st, r);
}

/** refund half-filled team pools when the cart rolls away */
export function closeMarket(st: MatchState): void {
  for (const it of st.cart) {
    if (BUFFS[it.buff].kind !== 'team') continue;
    it.pool.forEach((paid, bi) => {
      if (paid <= 0 || paid >= it.price) return;
      // pools are tracked per bakery; refund each member what they put in
      it.by.forEach((amt, seat) => {
        if (amt > 0 && bakeryOf(st, seat) === bi) {
          st.players[seat]!.tips += amt;
        }
      });
    });
  }
  st.cart = [];
}

export interface BuyMsg {
  item: number;
  amount?: number;
  target?: number;
  game?: MiniId;
}

/** a purchase; returns an error to show, or '' */
export function buy(st: MatchState, seat: number, m: BuyMsg): string {
  if (st.phase !== 'market') return 'The cart has rolled on.';
  if (!Number.isInteger(m.item)) return 'Sold out.';
  const it = st.cart[m.item];
  if (!it) return 'Sold out.';
  const def = BUFFS[it.buff];
  const p = st.players[seat]!;
  const open = seatOpen(st, seat);
  const price = priceFor(st, seat, it);
  if (!open && !def.sabotage) return 'Your bakery is closed.';
  if (def.kind === 'staple') {
    if (p.saffron >= 5) return 'Your pockets are full.';
    if (p.tips < price) return 'Not enough Tips.';
    p.tips -= price;
    p.saffron++;
    pushEvent(st, 'buy', { seat, s: it.buff });
    return '';
  }
  if (def.kind === 'personal') {
    if (p.buffs.includes(it.buff)) return 'You have one.';
    if (p.tips < price) return 'Not enough Tips.';
    p.tips -= price;
    p.buffs.push(it.buff);
    it.buyers.push(seat);
    pushEvent(st, 'buy', { seat, s: it.buff });
    return '';
  }
  if (def.kind === 'rare') {
    if (it.soldTo >= 0) return 'Sold out.';
    if (p.tips < price) return 'Not enough Tips.';
    if (def.sabotage) {
      if (st.cfg.style === 'coop') return 'No sabotage in co-op.';
      const t = Number.isInteger(m.target) ? m.target! : -1;
      if (t < 0 || t === seat || !st.seats[t] || !seatOpen(st, t)) return 'Pick a rival.';
      if (st.cfg.style === 'teams' && st.seats[t]!.team === st.seats[seat]!.team) return 'That is your teammate.';
    }
    if (it.buff === 'recipe' && (!m.game || !MINI_IDS.includes(m.game))) return 'Pick a game.';
    p.tips -= price;
    it.soldTo = seat;
    if (it.buff === 'recipe') p.recipeFor = m.game!;
    else sabotage(st, seat, m.target!, it.buff);
    pushEvent(st, 'buy', { seat, s: it.buff });
    return '';
  }
  // team: chip in
  const bi = bakeryOf(st, seat);
  const b = st.bakeries[bi]!;
  const left = it.price - (it.pool[bi] ?? 0);
  if (left <= 0) return 'Already bought.';
  // Pip's 20% off: each Tip he puts in counts for 1.25
  const worth = st.seats[seat]!.baker === 'pip' ? 1 / (1 - BAL.pipDiscount) : 1;
  const raw = Number(m.amount);
  const wantTips = Number.isFinite(raw) ? Math.max(1, Math.round(raw)) : Math.ceil(left / worth);
  const amt = Math.min(Math.ceil(left / worth), p.tips, wantTips);
  if (amt <= 0) return 'Not enough Tips.';
  p.tips -= amt;
  it.pool[bi] = Math.min(it.price, (it.pool[bi] ?? 0) + amt * worth);
  it.by[seat] = (it.by[seat] ?? 0) + amt;
  if ((it.pool[bi] ?? 0) >= it.price - 1e-9) {
    it.pool[bi] = it.price;
    // everyone who paid in earns the chip-in ★ (only for a buff that was actually bought)
    it.by.forEach((paid, s) => {
      if (paid <= 0 || bakeryOf(st, s) !== bi) return;
      st.players[s]!.chipped += paid;
      if (st.cfg.style !== 'ffa') st.players[s]!.stars += BAL.chipStars;
    });
    b.teamBuys++;
    if (it.buff === 'ovenslot') b.ovenSlots++;
    if (it.buff === 'apprentice') b.apprentice += 3;
    if (it.buff === 'bribe') b.bribes++;
    pushEvent(st, 'teambuy', { seat, v: bi, s: it.buff });
  } else pushEvent(st, 'chip', { seat, v: bi, s: it.buff });
  return '';
}

/** throw a Salt Shaker or a Flour Cloud (bought, or the free ones on Sabotage Night) */
export function sabotage(st: MatchState, seat: number, target: number, kind: BuffId): void {
  const p = st.players[seat]!;
  const t = st.players[target]!;
  if (kind === 'salt') t.salted = true;
  else t.flourAt = 1;
  p.stats.sabotages++;
  // Salt in the Wound: the leader, going into the final order
  if (st.round === st.orders.length - 2 && st.players[target]!.stars === Math.max(...st.players.map((x) => x.stars))) p.stats.saltLeader = true;
  const r = rngOf(st);
  const watch = order(st).twist === 'watch';
  const caughtP = has(st, 'sabotage') ? 0 : watch ? 0.5 : st.seats[seat]!.baker === 'wick' ? BAL.wickCaughtChance : 0;
  if (caughtP && r.chance(caughtP)) {
    const loss = st.seats[seat]!.baker === 'wick' ? BAL.wickCaughtStars : 2;
    p.stars = Math.max(0, p.stars - loss);
    p.stats.caught++;
    pushEvent(st, 'caught', { seat, v: loss });
  }
  saveRng(st, r);
  pushEvent(st, kind === 'salt' ? 'salted' : 'floured', { seat, to: target });
}

/** a free Salt Shaker / Flour Cloud from Sabotage Night (held in the buff list) */
export function useHeldSabotage(st: MatchState, seat: number, kind: 'salt' | 'flour', target: number): string {
  if (kind !== 'salt' && kind !== 'flour') return '';
  if (st.cfg.style === 'coop') return 'No sabotage in co-op.';
  if (!seatOpen(st, seat)) return 'Your bakery is closed.';
  const p = st.players[seat]!;
  const i = p.buffs.indexOf(kind);
  if (i < 0) return 'You have none.';
  if (target === seat || !st.seats[target] || !seatOpen(st, target)) return 'Pick a rival.';
  if (st.cfg.style === 'teams' && st.seats[target]!.team === st.seats[seat]!.team) return 'That is your teammate.';
  p.buffs.splice(i, 1);
  sabotage(st, seat, target, kind);
  return '';
}

// ------------------------------------------------------------------ the end of the night

export function finishNight(st: MatchState): MatchOver {
  const penalties: MatchOver['penalties'] = [];
  st.players.forEach((p, i) => {
    if (st.cfg.style !== 'coop' && p.loaves13 === 0) {
      const lose = p.stars - Math.floor(p.stars * BAL.freeloaderKeeps);
      if (lose > 0) penalties.push({ seat: i, kind: 'freeloader', stars: lose });
      p.stars -= lose;
    }
    const b = st.bakeries[bakeryOf(st, i)]!;
    if (st.cfg.style !== 'ffa' && b.teamBuys > 0 && p.chipped === 0) {
      const lose = Math.min(p.stars, BAL.noChipPenalty);
      if (lose > 0) penalties.push({ seat: i, kind: 'nochip', stars: lose });
      p.stars -= lose;
    }
  });
  const survived = st.bakeries.map((b) => !b.closed);
  const seatSurvived = (i: number): boolean => survived[bakeryOf(st, i)]!;
  const idx = st.players.map((_, i) => i);
  let ranking: number[];
  let winnerTeam = -1;
  if (st.cfg.style === 'ffa') {
    ranking = idx.sort((a, b) => {
      const sa = seatSurvived(a) ? 1 : 0;
      const sb = seatSurvived(b) ? 1 : 0;
      if (sa !== sb) return sb - sa;
      if (!sa) return st.bakeries[bakeryOf(st, b)]!.closedAt - st.bakeries[bakeryOf(st, a)]!.closedAt || st.players[b]!.stars - st.players[a]!.stars;
      return st.players[b]!.stars - st.players[a]!.stars;
    });
  } else if (st.cfg.style === 'teams') {
    const sum = st.bakeries.map((b) => b.members.reduce((s, m) => s + st.players[m]!.stars, 0) / Math.max(1, b.members.length));
    const order2 = st.bakeries.map((_, i) => i).sort((a, b) => Number(survived[b]) - Number(survived[a]) || sum[b]! - sum[a]!);
    winnerTeam = survived[order2[0]!] ? st.seats[st.bakeries[order2[0]!]!.members[0]!]!.team : -1;
    ranking = order2.flatMap((bi) => [...st.bakeries[bi]!.members].sort((a, b) => st.players[b]!.stars - st.players[a]!.stars));
  } else ranking = idx.sort((a, b) => st.players[b]!.stars - st.players[a]!.stars);
  let medal: MatchOver['medal'] = null;
  if (survived.some(Boolean)) {
    const total = st.players.reduce((s, p) => s + p.stars, 0);
    const per = total / Math.max(1, st.seats.length) / st.orders.length;
    medal = per >= 4.6 ? 'gold' : per >= 3.6 ? 'silver' : 'bronze';
  }
  const over: MatchOver = { survived, ranking, winnerTeam, penalties, finalStars: st.players.map((p) => p.stars), medal };
  st.over = over;
  return over;
}

/** did this seat win the night? (for profiles and achievements) */
export function seatWon(st: MatchState, seat: number): boolean {
  const o = st.over;
  if (!o) return false;
  const bi = bakeryOf(st, seat);
  if (!o.survived[bi]) return false;
  if (st.cfg.style === 'coop') return true;
  if (st.cfg.style === 'teams') return st.seats[seat]!.team === o.winnerTeam;
  return o.ranking[0] === seat || st.players[o.ranking[0]!]!.stars === st.players[seat]!.stars;
}

export function setPhase(st: MatchState, phase: Phase, now: number, seconds: number): void {
  st.phase = phase;
  st.phaseStart = now;
  // the play phase's clock is already scaled (gameSeconds); the countdown is not
  st.phaseEnd = now + (phase === 'play' ? seconds : seconds * BAL.timeScale) * 1000;
  st.done = [];
}

export { skillMult, BAKER };
