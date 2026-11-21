// The night's clock: reveal → play (one or two games) → tally (count, the 13th loaf, fines) → market → next order,
// then the Inspector's dawn check. The host (or the solo game) calls tick() about 20 times a second; guests send
// their results and choices in. The sim tests drive the same class with a fake clock.
import { aiResult, aiShopping, aiWantsThirteenth, sabotageTarget } from './ai';
import { BAL } from './data';
import { aiOven, bump, closeOven, load, newOven, ovenResults, prep, pull, stepOven, type OvenAiMind, type OvenState } from './oven';
import { Rng, clamp } from './rng';
import {
  beginTally,
  buy,
  canClaim,
  claimThirteenth,
  closeMarket,
  currentGame,
  finishNight,
  gameSeconds,
  openMarket,
  order,
  pushEvent,
  resetTrays,
  resolveThirteenth,
  rngOf,
  saveRng,
  scoreResult,
  seatOpen,
  setPhase,
  settleOrder,
  useHeldSabotage,
  type BuyMsg,
} from './rules';
import type { GameResult, LiveProgress, MatchState } from './types';

/** seconds of "3, 2, 1" before each game starts (included in the play phase) */
export const COUNTDOWN_S = 3;

export class Night {
  st: MatchState;
  oven: OvenState | null = null;
  results: (GameResult | null)[];
  private minds = new Map<number, OvenAiMind>();
  /** AI choices scheduled at host times this phase: [when, seat, what] */
  private plan: { at: number; seat: number; act: () => void }[] = [];
  /** AI live progress (what their corner portrait shows) */
  aiProg = new Map<number, LiveProgress & { q: number }>();
  /** bumped when the state changed in a way guests must see */
  dirty = true;
  ovenDirty = false;
  private planned = '';

  constructor(st: MatchState, restore?: { results?: (GameResult | null)[]; oven?: OvenState | null }) {
    this.st = st;
    this.results = restore?.results && restore.results.length === st.seats.length ? restore.results : st.seats.map(() => null);
    if (st.phase === 'play' && (currentGame(st) === 'oven' || currentGame(st) === 'dawn')) {
      // resumed mid-oven after a refresh: the saved oven, or a fresh one for what's left of the clock
      this.oven = restore?.oven && restore.oven.round === st.round ? restore.oven : newOven(st, st.phaseStart + COUNTDOWN_S * 1000, (st.phaseEnd - st.phaseStart) / 1000 - COUNTDOWN_S);
    }
  }

  /** after a refresh: AI rivals pick up what they were doing (their plans aren't saved) */
  resume(now: number): void {
    const st = this.st;
    if (this.plan.length) return;
    if (st.phase === 'tally' && st.tallyStep === 1) {
      const r = this.rng();
      for (const seat of this.aiSeats()) {
        if (st.done.includes(seat) || !canClaim(st, seat)) continue;
        const want = aiWantsThirteenth(st, seat, r);
        this.plan.push({ at: now + r.range(500, 2000), seat, act: () => this.claim(seat, want) });
      }
      saveRng(st, r);
    }
    if (st.phase === 'market') this.planMarket(now);
    if (st.phase === 'play' && !this.oven) {
      const r = this.rng();
      const g = currentGame(st);
      for (const seat of this.aiSeats()) {
        if (!seatOpen(st, seat) || this.results[seat]) continue;
        const res = aiResult(st, seat, g, r);
        this.aiProg.set(seat, { q: res.q, v: 0, c: 0, e: '', at: now });
        this.results[seat] = res;
      }
      saveRng(st, r);
    }
  }

  /** seats a person plays (not AI, not an AI standing in for a dropped person) */
  humanSeats(): number[] {
    return this.st.seats.map((s, i) => (!s.ai && !s.standIn ? i : -1)).filter((i) => i >= 0);
  }
  aiSeats(): number[] {
    return this.st.seats.map((s, i) => (s.ai || s.standIn ? i : -1)).filter((i) => i >= 0);
  }

  private rng(): Rng {
    return rngOf(this.st);
  }

  // ------------------------------------------------------------------ inputs from players

  submit(seat: number, round: number, part: number, res: GameResult): void {
    const st = this.st;
    if (st.phase !== 'play' || st.round !== round || st.part !== part) return;
    if (this.oven) return; // the oven scores itself
    if (this.results[seat]) return;
    this.results[seat] = { ...res, q: clamp(Number(res.q) || 0, 0, 1) };
    if (!st.done.includes(seat)) st.done.push(seat);
    this.dirty = true;
  }

  claim(seat: number, want: boolean): void {
    const st = this.st;
    if (st.phase !== 'tally' || st.tallyStep !== 1) return;
    claimThirteenth(st, seat, want);
    if (!st.done.includes(seat)) st.done.push(seat);
    this.dirty = true;
  }

  buy(seat: number, m: BuyMsg): string {
    const err = buy(this.st, seat, m);
    if (!err) this.dirty = true;
    return err;
  }

  throwHeld(seat: number, kind: 'salt' | 'flour', target: number): string {
    if (this.st.phase !== 'market') return 'Throw it at the market.';
    if (kind !== 'salt' && kind !== 'flour') return '';
    const err = useHeldSabotage(this.st, seat, kind, target);
    if (!err) this.dirty = true;
    return err;
  }

  marketDone(seat: number, v = true): void {
    const st = this.st;
    if (st.phase !== 'market') return;
    const i = st.done.indexOf(seat);
    if (v && i < 0) st.done.push(seat);
    if (!v && i >= 0) st.done.splice(i, 1);
    this.dirty = true;
  }

  ovenAct(seat: number, a: { k: 'load' | 'pull' | 'bump' | 'prep'; slot?: number; tray?: number; when?: number }, now: number): void {
    const ov = this.oven;
    if (!ov || this.st.phase !== 'play') return;
    if (now < ov.start) return;
    let ok = false;
    if (a.k === 'load') ok = load(ov, seat, a.slot ?? -1, now);
    if (a.k === 'prep') ok = prep(ov, seat, now);
    if (a.k === 'pull' && a.tray !== undefined) ok = !!pull(ov, this.st, seat, a.tray, now, a.when);
    if (a.k === 'bump' && a.tray !== undefined) {
      ok = bump(ov, this.st, seat, a.tray, now);
      // Salt in the Wound: bumping the leader's tray at Dawn
      const owner = ov.trays.find((t) => t.id === a.tray)?.owner ?? -1;
      if (ok && ov.game === 'dawn' && owner >= 0 && this.st.players[owner]!.stars === Math.max(...this.st.players.map((p) => p.stars))) this.st.players[seat]!.stats.saltLeader = true;
    }
    if (ok) this.ovenDirty = true;
  }

  lightHearth(): void {
    if (this.st.hearth) return;
    this.st.hearth = true;
    pushEvent(this.st, 'hearth');
    this.dirty = true;
  }

  emote(seat: number, k: string): void {
    pushEvent(this.st, 'emote', { seat, s: k });
    this.dirty = true;
  }

  // ------------------------------------------------------------------ the clock

  tick(now: number): void {
    const st = this.st;
    if (st.phase === 'over') return;
    this.runPlan(now);
    switch (st.phase) {
      case 'reveal':
        if (now >= st.phaseEnd) this.startPlay(now);
        break;
      case 'play':
        this.tickPlay(now);
        break;
      case 'tally':
        this.tickTally(now);
        break;
      case 'market':
        this.tickMarket(now);
        break;
      case 'dawncheck':
        if (now >= st.phaseEnd) {
          finishNight(st);
          setPhase(st, 'over', now, 0);
          this.dirty = true;
        }
        break;
    }
  }

  private runPlan(now: number): void {
    if (!this.plan.length) return;
    const due = this.plan.filter((p) => p.at <= now);
    if (!due.length) return;
    this.plan = this.plan.filter((p) => p.at > now);
    for (const p of due) p.act();
    this.dirty = true;
  }

  private startPlay(now: number): void {
    const st = this.st;
    const secs = gameSeconds(st);
    setPhase(st, 'play', now, secs + COUNTDOWN_S);
    this.results = st.seats.map(() => null);
    this.aiProg.clear();
    this.plan = [];
    const g = currentGame(st);
    const r = this.rng();
    // sabotage lands: a Flour Cloud bursts at a random moment of the victim's game
    for (const p of st.players) if (p.flourAt) p.flourAt = now + COUNTDOWN_S * 1000 + Math.round(r.range(4, Math.max(5, secs - 6)) * 1000);
    if (g === 'oven' || g === 'dawn') {
      this.oven = newOven(st, now + COUNTDOWN_S * 1000, secs);
      this.minds.clear();
      this.ovenDirty = true;
    } else {
      this.oven = null;
      // AI results are decided now; their portraits act it out over the game
      for (const seat of this.aiSeats()) {
        if (!seatOpen(st, seat)) continue;
        const res = aiResult(st, seat, g, r);
        this.aiProg.set(seat, { q: res.q, v: 0, c: 0, e: '', at: now });
        this.results[seat] = res;
      }
      // a closed bakery's bakers sit this one out
    }
    for (let i = 0; i < st.seats.length; i++) if (!seatOpen(st, i)) this.results[i] = { q: 0 };
    saveRng(st, r);
    this.dirty = true;
  }

  private tickPlay(now: number): void {
    const st = this.st;
    const ov = this.oven;
    if (ov) {
      if (stepOven(ov, st, now)) this.ovenDirty = true;
      if (aiOven(ov, st, this.minds, now, this.aiSeats())) this.ovenDirty = true;
      if (now >= ov.end) {
        closeOven(ov, st);
        const res = ovenResults(ov, st);
        res.forEach((r, seat) => seatOpen(st, seat) && scoreResult(st, seat, r));
        this.ovenDirty = true;
        this.afterGame(now);
      }
      return;
    }
    this.fakeAiProgress(now);
    const humansIn = this.humanSeats().every((s) => !seatOpen(st, s) || this.results[s]);
    const late = now >= st.phaseEnd + BAL.resultGraceS * 1000;
    if ((now >= st.phaseEnd && humansIn) || late) {
      const r = this.rng();
      const g = currentGame(st);
      st.seats.forEach((_, seat) => {
        if (!seatOpen(st, seat)) return;
        // someone who dropped (or never sent a result): an AI fills in, a little worse than usual
        let res = this.results[seat];
        if (!res) {
          const fill = aiResult(st, seat, g, r);
          res = { ...fill, q: fill.q * 0.85 };
        }
        scoreResult(st, seat, res);
      });
      saveRng(st, r);
      this.afterGame(now);
    }
  }

  private afterGame(now: number): void {
    const st = this.st;
    const o = order(st);
    if (st.part + 1 < o.games.length) {
      st.part++;
      // a short breath, then the next game of the chain
      setPhase(st, 'reveal', now, 3);
      this.oven = null;
    } else {
      this.oven = null;
      setPhase(st, 'tally', now, BAL.tallyCountS);
      st.tallyStep = 0;
      beginTally(st);
    }
    this.dirty = true;
  }

  private fakeAiProgress(now: number): void {
    const st = this.st;
    const t0 = st.phaseStart + COUNTDOWN_S * 1000;
    const T = st.phaseEnd - t0;
    if (now < t0) return;
    const k = clamp((now - t0) / T, 0, 1);
    for (const [seat, p] of this.aiProg) {
      if (now - p.at < 380) continue;
      const wobble = Math.sin(now / 900 + seat * 2.1) * 0.05;
      p.v = clamp(p.q * (0.75 + 0.25 * k) + wobble, 0, 1);
      const roll = Math.abs(Math.sin(now / 173 + seat * 7.7));
      p.e = roll < p.q * 0.8 ? (roll < p.q * 0.25 ? 'perfect' : 'hit') : 'miss';
      p.c = p.e === 'miss' ? 0 : p.c + 1;
      p.at = now;
    }
  }

  private tickTally(now: number): void {
    const st = this.st;
    if (st.tallyStep === 0 && now >= st.phaseEnd) {
      const anyone = st.seats.some((_, i) => canClaim(st, i));
      st.tallyStep = 1;
      setPhase(st, 'tally', now, anyone ? BAL.tallyClaimS : 0.01);
      st.claims = [];
      if (anyone) {
        // AI rivals decide after a beat, so you see them make up their minds
        const r = this.rng();
        for (const seat of this.aiSeats()) {
          if (!canClaim(st, seat)) continue;
          const want = aiWantsThirteenth(st, seat, r);
          const at = now + r.range(1200, BAL.tallyClaimS * 1000 - 900);
          this.plan.push({ at, seat, act: () => this.claim(seat, want) });
        }
        saveRng(st, r);
      }
      this.dirty = true;
      return;
    }
    if (st.tallyStep === 1) {
      const waiting = this.humanSeats().filter((s) => canClaim(st, s) && !st.done.includes(s));
      if (now >= st.phaseEnd || (!waiting.length && !this.plan.length)) {
        this.plan = [];
        resolveThirteenth(st);
        const over = settleOrder(st);
        st.tallyStep = 2;
        setPhase(st, 'tally', now, BAL.tallyResolveS);
        st.done = [];
        if (over) st.endEarly = true;
        this.dirty = true;
      }
      return;
    }
    if (st.tallyStep === 2 && now >= st.phaseEnd) {
      const early = st.endEarly;
      const last = st.round >= st.orders.length - 1;
      if (early || last) {
        setPhase(st, 'dawncheck', now, BAL.dawnCheckS);
      } else if (order(st).twist === 'closed') {
        this.nextOrder(now);
      } else {
        openMarket(st);
        setPhase(st, 'market', now, BAL.marketS);
        this.planMarket(now);
      }
      this.dirty = true;
    }
  }

  private planMarket(now: number): void {
    const st = this.st;
    const r = this.rng();
    for (const seat of this.aiSeats()) {
      if (st.done.includes(seat)) continue;
      const buys = aiShopping(st, seat, r);
      let at = now + r.range(1500, 4000);
      for (const b of buys) {
        this.plan.push({ at, seat, act: () => void buy(st, seat, b) });
        at += r.range(900, 2600);
      }
      // free Sabotage Night throws
      for (const kind of ['salt', 'flour'] as const) {
        if (!st.players[seat]!.buffs.includes(kind)) continue;
        if (!r.chance(0.35)) continue;
        const t = sabotageTarget(st, seat, r);
        if (t >= 0) this.plan.push({ at: at + r.range(500, 3000), seat, act: () => void useHeldSabotage(st, seat, kind, t) });
      }
      this.plan.push({ at: Math.min(st.phaseEnd - 500, at + 400), seat, act: () => this.marketDone(seat) });
    }
    saveRng(st, r);
  }

  private tickMarket(now: number): void {
    const st = this.st;
    const humans = this.humanSeats();
    const allDone = humans.every((s) => st.done.includes(s)) && !this.plan.some((p) => p.at > now + 200 && p.at < st.phaseEnd);
    if (now >= st.phaseEnd || (humans.length && allDone && now - st.phaseStart > 2500)) {
      this.plan = [];
      closeMarket(st);
      this.nextOrder(now);
    }
  }

  private nextOrder(now: number): void {
    const st = this.st;
    st.round++;
    st.part = 0;
    resetTrays(st);
    st.tallyStep = 0;
    for (const p of st.players) p.last = null;
    setPhase(st, 'reveal', now, BAL.revealS);
    this.dirty = true;
  }

  /** what to show for an AI seat's live progress */
  progressOf(seat: number): LiveProgress | null {
    const p = this.aiProg.get(seat);
    return p ? { v: p.v, c: p.c, e: p.e, at: p.at } : null;
  }
}
