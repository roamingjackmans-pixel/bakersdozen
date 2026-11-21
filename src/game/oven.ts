// The Shared Oven: the one real-time shared game. The host runs it; everyone draws the same trays from the
// snapshots it sends (tray timers are start times in host ms, so each screen animates them smoothly on its own).
// Pull timing is judged at the moment the player tapped (their own clock, converted to host time), so a slow
// connection does not burn your tray.
import { BAKER, BAL, skillMult } from './data';
import { Rng, clamp } from './rng';
import { bakeryOf, chaosCount, has, order, seatOpen } from './rules';
import type { GameResult, MatchState } from './types';

export type TrayGrade = '' | 'perfect' | 'golden' | 'dark' | 'burnt' | 'raw';

export interface Tray {
  id: number;
  owner: number;
  /** loaves it is worth pulled golden */
  value: number;
  golden: boolean;
  st: 'prep' | 'queue' | 'baking' | 'out';
  /** Dawn: kneads left before it can go in */
  prep: number;
  slot: number;
  start: number;
  /** ms from loading to the golden centre */
  dur: number;
  /** half-width of the golden window, ms */
  win: number;
  /** half-width of the perfect zone, ms (the same for every baker: it is timing, not skill) */
  perf: number;
  /** pulled inside the parry zone (Joe's double ★) */
  parry: boolean;
  /** after the window: smoking (still sellable, dark) for this long, then burnt */
  smoke: number;
  grade: TrayGrade;
  by: number;
  at: number;
}

export interface OvenEvent {
  n: number;
  k: 'load' | 'pull' | 'burn' | 'bump' | 'ghost' | 'prep';
  seat: number;
  tray: number;
  g?: TrayGrade;
}

export interface OvenState {
  game: 'oven' | 'dawn';
  round: number;
  slots: number;
  trays: Tray[];
  start: number;
  end: number;
  bumps: number[];
  /** loaves on each bakery's tray from the oven so far (live) */
  loaves: number[];
  events: OvenEvent[];
  n: number;
  /** Haunted Bakery: when the ghost next wobbles a timer */
  ghostAt: number;
  /** per slot: the bakery that bought it (Extra Oven Slot in free-for-all / 2v2), or -1 for anyone */
  reserved: number[];
  /** per seat: its bakery */
  seatBakery: number[];
  rng: number;
}

/** how far back a tap can be judged (a connection's delay), and how long a burnt tray waits for a tap in flight */
export const PULL_GRACE_MS = 180;

/** a pull this close to the golden centre is a parry (Joe scores it double) */
export const PARRY_MS = 60;

export const GRADE_VALUE: Record<TrayGrade, number> = { perfect: 1, golden: 0.82, dark: 0.45, burnt: 0, raw: 0, '': 0 };

export function traysPerSeat(game: 'oven' | 'dawn'): number {
  return game === 'dawn' ? 6 : 4;
}

/** one tray zone at a host time */
export function zoneAt(t: Tray, now: number): 'raw' | 'golden' | 'perfect' | 'dark' | 'burnt' {
  const d = now - (t.start + t.dur);
  if (d < -t.win) return 'raw';
  if (Math.abs(d) <= t.perf) return 'perfect';
  if (d <= t.win) return 'golden';
  if (d <= t.win + t.smoke) return 'dark';
  return 'burnt';
}

/** 0 = just loaded, 1 = golden centre, ~1.4 = burnt (for the colour ramp) */
export function bakeLevel(t: Tray, now: number): number {
  return clamp((now - t.start) / t.dur, 0, 2);
}

export function newOven(st: MatchState, now: number, seconds: number): OvenState {
  const game = order(st).games.includes('dawn') ? 'dawn' : 'oven';
  const r = new Rng(st.rngState ^ 0x5a17);
  const per = traysPerSeat(game);
  const trays: Tray[] = [];
  let id = 1;
  st.seats.forEach((s, seat) => {
    if (!seatOpen(st, seat)) return;
    const b = st.bakeries[bakeryOf(st, seat)]!;
    const k = Math.max(1, b.members.length);
    const base = (order(st).need / (k * per)) * BAL.yieldFactor * 0.92 * (1 + BAL.chaosAllowance * chaosCount(st));
    const mult = skillMult(s.baker, game);
    const tiny = has(st, 'tiny') ? 0.7 : 1;
    // Salt Shaker: this baker's trays have a narrower window
    const salt = st.players[seat]!.salted ? 0.7 : 1;
    for (let i = 0; i < per; i++) {
      const golden = game === 'dawn' && i % 3 === 2;
      trays.push({
        id: id++,
        owner: seat,
        value: Math.max(1, Math.round(base * (golden ? 1.6 : 1))),
        golden,
        st: game === 'dawn' ? 'prep' : 'queue',
        prep: game === 'dawn' ? 3 : 0,
        slot: -1,
        start: 0,
        dur: Math.round(r.range(5200, 8200) * (order(st).rush ? 0.85 : 1)),
        win: Math.round(720 * mult * tiny * salt),
        smoke: Math.round(900 * mult),
        perf: Math.round(240 * tiny * salt),
        parry: false,
        grade: '',
        by: -1,
        at: 0,
      });
    }
  });
  const open = st.seats.filter((_, i) => seatOpen(st, i)).length;
  const base = Math.max(2, open - 1) + (game === 'dawn' ? 2 : 0);
  // an Extra Oven Slot belongs to the bakery that bought it (with one shared bakery, that's everyone)
  const reserved: number[] = Array.from({ length: base }, () => -1);
  st.bakeries.forEach((b, bi) => {
    if (b.closed) return;
    for (let i = 0; i < b.ovenSlots; i++) reserved.push(st.bakeries.length > 1 ? bi : -1);
  });
  return {
    game,
    round: st.round,
    slots: reserved.length,
    reserved,
    seatBakery: st.seats.map((_, i) => bakeryOf(st, i)),
    trays,
    start: now,
    end: now + seconds * 1000,
    bumps: st.seats.map(() => 0),
    loaves: st.bakeries.map(() => 0),
    events: [],
    n: 0,
    ghostAt: has(st, 'haunted') ? now + 6000 : 0,
    rng: r.s,
  };
}

function ev(ov: OvenState, k: OvenEvent['k'], seat: number, tray: number, g?: TrayGrade): void {
  ov.n++;
  ov.events.push({ n: ov.n, k, seat, tray, ...(g ? { g } : {}) });
  if (ov.events.length > 30) ov.events.splice(0, ov.events.length - 30);
}

export function slotFor(ov: OvenState, slot: number, seat: number): boolean {
  const r = ov.reserved?.[slot] ?? -1;
  return r < 0 || r === ov.seatBakery?.[seat];
}

export function freeSlot(ov: OvenState, want: number, seat: number): number {
  if (!Number.isInteger(want)) want = -1;
  const used = new Set<number>();
  for (const t of ov.trays) if (t.st === 'baking') used.add(t.slot);
  if (want >= 0 && want < ov.slots && !used.has(want) && slotFor(ov, want, seat)) return want;
  // your bakery's own slots first, then the shared ones
  for (let i = 0; i < ov.slots; i++) if (!used.has(i) && (ov.reserved?.[i] ?? -1) >= 0 && slotFor(ov, i, seat)) return i;
  for (let i = 0; i < ov.slots; i++) if (!used.has(i) && slotFor(ov, i, seat)) return i;
  return -1;
}

export function nextTray(ov: OvenState, seat: number, st: 'queue' | 'prep' = 'queue'): Tray | undefined {
  return ov.trays.find((t) => t.owner === seat && t.st === st);
}

/** Dawn: knead your next tray so it can go in */
export function prep(ov: OvenState, seat: number, now: number): boolean {
  if (now > ov.end) return false;
  const t = nextTray(ov, seat, 'prep');
  if (!t) return false;
  t.prep--;
  if (t.prep <= 0) t.st = 'queue';
  ev(ov, 'prep', seat, t.id);
  return true;
}

export function load(ov: OvenState, seat: number, slot: number, now: number): boolean {
  if (now > ov.end) return false;
  const t = nextTray(ov, seat);
  if (!t) return false;
  const s = freeSlot(ov, slot, seat);
  if (s < 0) return false;
  t.st = 'baking';
  t.slot = s;
  t.start = now;
  ev(ov, 'load', seat, t.id);
  return true;
}

/** the player tapped a tray at host time `when` (their clock); judged then, if it is plausible */
export function pull(ov: OvenState, st: MatchState, seat: number, trayId: number, now: number, when?: number): TrayGrade | '' {
  const t = ov.trays.find((x) => x.id === trayId);
  if (!t || t.st !== 'baking') return '';
  // judged when the player tapped (their clock), allowing for a normal connection's delay but no more
  const at = when !== undefined && Number.isFinite(when) ? clamp(when, now - PULL_GRACE_MS, now) : now;
  const z = zoneAt(t, at);
  if (z === 'raw' || z === 'burnt') return '';
  // a rival's tray can only be rescued once it's smoking: nobody steals your golden pull
  if (t.owner !== seat && z !== 'dark') return '';
  t.st = 'out';
  t.grade = z === 'perfect' ? 'perfect' : z === 'golden' ? 'golden' : 'dark';
  t.by = seat;
  t.at = at;
  t.parry = Math.abs(at - (t.start + t.dur)) <= PARRY_MS;
  t.slot = -1;
  ov.loaves[bakeryOf(st, t.owner)]! += t.value;
  ev(ov, 'pull', seat, t.id, t.grade);
  return t.grade;
}

/** speed up a rival's raw tray (light sabotage, once per game) */
export function bump(ov: OvenState, st: MatchState, seat: number, trayId: number, now: number): boolean {
  if (st.cfg.style === 'coop' || ov.bumps[seat]! > 0) return false;
  const t = ov.trays.find((x) => x.id === trayId);
  if (!t || t.st !== 'baking' || t.owner === seat) return false;
  if (st.cfg.style === 'teams' && st.seats[t.owner]!.team === st.seats[seat]!.team) return false;
  const toWindow = t.start + t.dur - t.win - now;
  if (toWindow <= 200) return false;
  t.start -= Math.round(toWindow * 0.45);
  ov.bumps[seat] = 1;
  ev(ov, 'bump', seat, t.id);
  return true;
}

/** burn what's left in too long, let the ghost wobble timers; returns true if anything changed */
export function stepOven(ov: OvenState, st: MatchState, now: number): boolean {
  let changed = false;
  for (const t of ov.trays) {
    if (t.st !== 'baking') continue;
    // burnt a moment after the screen shows it, so a tap already on its way still counts
    if (zoneAt(t, now - PULL_GRACE_MS) === 'burnt') {
      t.st = 'out';
      t.grade = 'burnt';
      t.slot = -1;
      t.at = now;
      ov.loaves[bakeryOf(st, t.owner)]! -= 1;
      ev(ov, 'burn', t.owner, t.id, 'burnt');
      changed = true;
    }
  }
  if (ov.ghostAt && now >= ov.ghostAt && now < ov.end) {
    const r = new Rng(ov.rng);
    const baking = ov.trays.filter((t) => t.st === 'baking' && zoneAt(t, now) === 'raw');
    if (baking.length) {
      const t = r.pick(baking);
      t.start += r.chance(0.5) ? 700 : -700;
      ev(ov, 'ghost', -1, t.id);
      changed = true;
    }
    ov.ghostAt = now + r.range(5000, 8000);
    ov.rng = r.s;
  }
  return changed;
}

/** the bell: trays still in the oven are pulled by the apprentice as they are */
export function closeOven(ov: OvenState, st: MatchState): void {
  for (const t of ov.trays) {
    if (t.st !== 'baking') continue;
    const z = zoneAt(t, ov.end);
    t.st = 'out';
    t.slot = -1;
    t.by = t.owner;
    t.at = ov.end;
    if (z === 'raw') t.grade = 'raw';
    else {
      t.grade = z === 'dark' ? 'dark' : 'golden';
      ov.loaves[bakeryOf(st, t.owner)]! += t.value;
    }
  }
}

/** each seat's result from the trays */
export function ovenResults(ov: OvenState, st: MatchState): GameResult[] {
  const per = traysPerSeat(ov.game);
  return st.seats.map((s, seat) => {
    const own = ov.trays.filter((t) => t.owner === seat);
    if (!own.length) return { q: 0, oven: { loaves: 0, burnt: 0, rescues: 0, perfectPulls: 0, stars: 0 } };
    let gsum = 0;
    let loaves = 0;
    let stars = 0;
    let burnt = 0;
    for (const t of own) {
      const gv = GRADE_VALUE[t.grade];
      gsum += gv;
      if (t.grade === 'burnt') {
        burnt++;
        loaves -= 1;
      } else if (gv > 0) loaves += t.value;
      let ts = (gv * BAL.starsPerGame * BAL.gameWeight[ov.game]) / per;
      // Joe's parry: a perfectly timed pull of his own tray scores double
      if (s.baker === 'joe' && t.grade === 'perfect' && t.parry && t.by === seat) ts *= 2;
      if (t.golden) ts *= 1.5;
      stars += ts;
    }
    const rescues = ov.trays.filter((t) => t.by === seat && t.owner !== seat && t.grade !== 'burnt' && t.grade !== 'raw' && t.at < ov.end).length;
    const perfectPulls = ov.trays.filter((t) => t.by === seat && t.grade === 'perfect' && t.at < ov.end).length;
    return { q: clamp(gsum / own.length, 0, 1), oven: { loaves, burnt, rescues, perfectPulls, stars } };
  });
}

// ------------------------------------------------------------------ AI bakers at the oven

export interface OvenAiMind {
  readyAt: number;
  pullAt: Record<number, number>;
  prepAt: number;
}

const LEVEL_REACT = { 1: 1300, 2: 850, 3: 520 } as const;
const LEVEL_SD = { 1: 0.95, 2: 0.6, 3: 0.38 } as const;

/** AI seats load, pull, rescue and bump like people do (with reaction time and timing error) */
export function aiOven(ov: OvenState, st: MatchState, minds: Map<number, OvenAiMind>, now: number, aiSeats: number[]): boolean {
  if (now > ov.end) return false;
  const r = new Rng(ov.rng ^ Math.floor(now / 97));
  let changed = false;
  for (const seat of aiSeats) {
    if (!seatOpen(st, seat)) continue;
    const s = st.seats[seat]!;
    const lvl = s.aiLevel;
    const mult = skillMult(s.baker, ov.game);
    let m = minds.get(seat);
    if (!m) {
      m = { readyAt: now + r.range(400, 1400), pullAt: {}, prepAt: now + 300 };
      minds.set(seat, m);
    }
    // Dawn: knead the next tray
    if (ov.game === 'dawn' && now >= m.prepAt && nextTray(ov, seat, 'prep') && !nextTray(ov, seat)) {
      prep(ov, seat, now);
      m.prepAt = now + r.range(260, 520) / (lvl * 0.35 + 0.6);
      changed = true;
    }
    // own trays: pull near the centre
    for (const t of ov.trays) {
      if (t.st !== 'baking') continue;
      if (t.owner === seat) {
        if (m.pullAt[t.id] === undefined) m.pullAt[t.id] = t.start + t.dur + r.gauss() * t.win * LEVEL_SD[lvl] / mult + (lvl === 1 ? 260 : 60);
        if (now >= m.pullAt[t.id]!) {
          if (pull(ov, st, seat, t.id, now)) changed = true;
          else if (zoneAt(t, now) === 'raw') m.pullAt[t.id] = t.start + t.dur;
        }
      } else if (now >= m.readyAt) {
        // a rival's tray about to burn: rescue it (or let it burn)
        const z = zoneAt(t, now);
        const mates = st.cfg.style === 'coop' || bakeryOf(st, t.owner) === bakeryOf(st, seat);
        const kind = mates ? 0.85 : (1 - BAKER[s.baker].greed) * 0.45;
        if (z === 'dark' && r.chance(kind * 0.08)) {
          if (pull(ov, st, seat, t.id, now)) {
            changed = true;
            m.readyAt = now + LEVEL_REACT[lvl];
          }
        }
        // or bump a rival's raw tray once
        if (z === 'raw' && !mates && ov.bumps[seat] === 0 && r.chance(BAKER[s.baker].mischief * 0.004)) {
          if (bump(ov, st, seat, t.id, now)) changed = true;
        }
      }
    }
    // load the next tray into a free slot
    if (now >= m.readyAt && nextTray(ov, seat) && freeSlot(ov, -1, seat) >= 0) {
      if (load(ov, seat, -1, now)) {
        changed = true;
        m.readyAt = now + LEVEL_REACT[lvl] * r.range(0.7, 1.4);
      }
    }
  }
  ov.rng = (ov.rng + 1) >>> 0;
  return changed;
}
