// The profile saved to your account (or this browser): tutorial flag, achievements and their counters, wins per
// baker, lifetime numbers, cosmetics, the campaign, the daily challenge and settings. recordNight() turns a finished
// night into progress and returns what it unlocked.
import { ACHIEVEMENTS, BAKERS, COSMETICS, DEFAULT_COSMETICS } from './data';
import { bakeryOf, seatWon } from './rules';
import type { BakerId, Cosmetics, MatchState } from './types';

export interface Settings {
  music: number;
  sfx: number;
  motion: 'auto' | 'on' | 'off';
  offsetMs: number;
  shake: boolean;
  fps: boolean;
}

export interface NightRecord {
  at: number;
  style: string;
  length: string;
  baker: BakerId;
  stars: number;
  place: number;
  seats: number;
  survived: boolean;
  won: boolean;
  campaign: number | null;
  daily: string | null;
}

export interface Profile {
  v: 1;
  tutorialSeen: boolean;
  ach: Record<string, { have: number; done: boolean; at?: number }>;
  bakerWins: Partial<Record<BakerId, number>>;
  life: { nights: number; survived: number; wins: number; insurance: number; rescues: number; perfectPulls: number; sabotages: number; filled: number; sheriff: number; fines: number; stars: number };
  customers: Record<string, number>;
  unlocked: string[];
  equipped: Partial<Record<BakerId, Cosmetics>>;
  campaign: { next: number; best: Record<number, { stars: number; medal: string | null }> };
  daily: { best: Record<string, number>; last: string };
  settings: Settings;
  history: NightRecord[];
  lastBaker: BakerId;
}

export function newProfile(): Profile {
  return {
    v: 1,
    tutorialSeen: false,
    ach: {},
    bakerWins: {},
    life: { nights: 0, survived: 0, wins: 0, insurance: 0, rescues: 0, perfectPulls: 0, sabotages: 0, filled: 0, sheriff: 0, fines: 0, stars: 0 },
    customers: {},
    unlocked: COSMETICS.filter((c) => c.how === 'Starter').map((c) => c.id),
    equipped: {},
    campaign: { next: 1, best: {} },
    daily: { best: {}, last: '' },
    settings: { music: 0.55, sfx: 0.8, motion: 'auto', offsetMs: 0, shake: true, fps: false },
    history: [],
    lastBaker: 'stephanie',
  };
}

/** fill in anything an older or damaged save is missing */
export function fixProfile(p: Profile | null | undefined): Profile {
  const d = newProfile();
  if (!p || typeof p !== 'object') return d;
  const out: Profile = { ...d, ...p, life: { ...d.life, ...(p.life ?? {}) }, settings: { ...d.settings, ...(p.settings ?? {}) }, campaign: { ...d.campaign, ...(p.campaign ?? {}) }, daily: { ...d.daily, ...(p.daily ?? {}) } };
  out.ach = typeof p.ach === 'object' && p.ach ? p.ach : {};
  out.unlocked = Array.isArray(p.unlocked) ? [...new Set([...d.unlocked, ...p.unlocked])] : d.unlocked;
  out.history = Array.isArray(p.history) ? p.history.slice(-10) : [];
  if (!BAKERS.some((b) => b.id === out.lastBaker)) out.lastBaker = 'stephanie';
  return out;
}

export function cosmeticsFor(p: Profile, baker: BakerId): Cosmetics {
  const e = p.equipped[baker];
  const ok = (id: string | undefined, fb: string): string => (id && p.unlocked.includes(id) ? id : fb);
  return { apron: ok(e?.apron, DEFAULT_COSMETICS.apron), pin: ok(e?.pin, DEFAULT_COSMETICS.pin), badge: ok(e?.badge, DEFAULT_COSMETICS.badge) };
}

export function achDone(p: Profile, id: string): boolean {
  return !!p.ach[id]?.done;
}

/** set an achievement's counter (keeps the best); returns true if it just unlocked */
export function bump(p: Profile, id: string, have: number, mode: 'max' | 'add' = 'max'): boolean {
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (!def) return false;
  const a = (p.ach[id] ??= { have: 0, done: false });
  if (a.done) return false;
  a.have = mode === 'add' ? a.have + have : Math.max(a.have, have);
  if (a.have >= def.need) {
    a.have = def.need;
    a.done = true;
    a.at = Date.now();
    return true;
  }
  return false;
}

export interface NightExtras {
  geode: boolean;
  hearth: boolean;
  saltLeader: boolean;
}

export interface Unlocks {
  achievements: string[];
  cosmetics: string[];
}

export function recordNight(p: Profile, st: MatchState, me: number, x: NightExtras): Unlocks {
  const ach: string[] = [];
  const pl = st.players[me]!;
  const seat = st.seats[me]!;
  const bi = bakeryOf(st, me);
  const b = st.bakeries[bi]!;
  const survived = !!st.over?.survived[bi];
  const won = seatWon(st, me);
  const L = p.life;
  L.nights++;
  if (survived) L.survived++;
  if (won) {
    L.wins++;
    p.bakerWins[seat.baker] = (p.bakerWins[seat.baker] ?? 0) + 1;
  }
  L.insurance += pl.loaves13;
  L.rescues += pl.stats.rescues;
  L.perfectPulls += pl.stats.perfectPulls;
  L.sabotages += pl.stats.sabotages;
  L.fines += b.fines;
  L.stars += pl.stars;
  // orders filled per customer (from the night's events would miss old ones; count from the orders and fills)
  const sheriff = b.sheriff ?? 0;
  const filledOrders = b.filled;
  L.filled += filledOrders;
  L.sheriff += sheriff;
  for (const o of st.orders.slice(0, st.round + 1)) p.customers[o.customer] = (p.customers[o.customer] ?? 0) + 1;
  const hit = (id: string, have: number, mode: 'max' | 'add' = 'max'): void => {
    if (bump(p, id, have, mode)) ach.push(id);
  };
  if (survived) hit('firstlight', 1);
  if (survived && b.fines === 0) hit('nocrumb', 1);
  hit('bakersdozen', L.insurance);
  hit('neighbor', L.rescues);
  if (pl.stats.saltLeader) hit('salt', 1);
  hit('roster', Object.values(p.bakerWins).filter((n) => (n ?? 0) > 0).length);
  hit('law', L.sheriff);
  if (x.geode) hit('shiny', 1);
  if (seat.baker === 'joe') hit('parry', pl.stats.perfectPulls);
  if (x.hearth) hit('hearth', 1);
  hit('beat', pl.stats.bestBeatStreak);
  if (pl.stats.natural20) hit('nat20', 1);
  // campaign and daily
  const cfg = st.cfg;
  if (cfg.night !== null && survived) {
    p.campaign.next = Math.max(p.campaign.next, cfg.night + 1);
    const prev = p.campaign.best[cfg.night];
    if (!prev || pl.stars > prev.stars) p.campaign.best[cfg.night] = { stars: pl.stars, medal: st.over?.medal ?? null };
  }
  if (cfg.daily) {
    const score = dailyScore(st, me);
    p.daily.best[cfg.daily] = Math.max(p.daily.best[cfg.daily] ?? 0, score);
    p.daily.last = cfg.daily;
  }
  const place = (st.over?.ranking.indexOf(me) ?? 0) + 1;
  p.history.push({ at: Date.now(), style: cfg.style, length: cfg.length, baker: seat.baker, stars: pl.stars, place, seats: st.seats.length, survived, won, campaign: cfg.night, daily: cfg.daily });
  p.history = p.history.slice(-10);
  p.lastBaker = seat.baker;
  const cos = checkCosmetics(p, st);
  return { achievements: ach, cosmetics: cos };
}

export function dailyScore(st: MatchState, me: number): number {
  const survived = !!st.over?.survived[bakeryOf(st, me)];
  return st.players[me]!.stars + (survived ? 25 : 0);
}

export function checkCosmetics(p: Profile, st?: MatchState): string[] {
  const got: string[] = [];
  const give = (id: string, cond: boolean): void => {
    if (cond && !p.unlocked.includes(id)) {
      p.unlocked.push(id);
      got.push(id);
    }
  };
  const L = p.life;
  give('apron_gingham', L.survived >= 3);
  give('apron_stripe', L.nights >= 5);
  give('apron_starry', !!st && st.cfg.length !== 'quick' && !!st.over?.survived.some(Boolean) && p.history[p.history.length - 1]?.survived === true);
  give('apron_dawn', p.campaign.next > 7);
  give('apron_gold', L.wins >= 10);
  give('apron_royal', p.campaign.next > 13);
  give('pin_marble', achDone(p, 'bakersdozen'));
  give('pin_copper', Object.keys(p.daily.best).length >= 3);
  give('pin_gold', achDone(p, 'roster'));
  give('pin_bonk', achDone(p, 'parry'));
  give('pin_geode', achDone(p, 'shiny'));
  give('badge_daisy', achDone(p, 'firstlight'));
  give('badge_star', achDone(p, 'law'));
  give('badge_note', achDone(p, 'beat'));
  give('badge_d20', achDone(p, 'nat20'));
  give('badge_ember', achDone(p, 'hearth'));
  give('badge_feather', achDone(p, 'nocrumb'));
  return got;
}

/** today's date for the daily challenge (the player's own calendar day) */
export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
