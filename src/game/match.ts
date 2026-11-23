// Host and client for a night. The host (the solo game, or the lobby host's browser) runs the Night and sends
// everyone snapshots; each client (including the host's own) draws them and sends its choices back.
// Solo and online use the same code path: solo just wires the client straight to the host in the same tab.
import { Night } from './flow';
import type { KitchenState } from './kitchen';
import type { OvenState } from './oven';
import type { BuyMsg } from './rules';
import type { GameResult, LiveProgress, MatchState } from './types';

/** a clock every machine shares closely enough (epoch ms, monotonic within a page); offsets are measured */
export const now = (): number => performance.timeOrigin + performance.now();

export type HostMsg =
  | { t: 'st'; s: MatchState; at: number }
  | { t: 'ov'; o: OvenState; at: number }
  | { t: 'kt'; k: KitchenState; at: number }
  | { t: 'pr'; p: (LiveProgress | null)[]; at: number }
  | { t: 'pong'; id: number; th: number; to: string }
  | { t: 'err'; to: string; msg: string }
  | { t: 'bye'; reason: string };

export type OvenAct = { k: 'load' | 'pull' | 'bump' | 'prep'; slot?: number; tray?: number; when?: number };

export type GuestMsg =
  | { t: 'hi' }
  | { t: 'ping'; id: number }
  | { t: 'res'; r: number; p: number; res: GameResult }
  | { t: 'claim'; v: boolean }
  | { t: 'buy'; m: BuyMsg }
  | { t: 'done'; v: boolean }
  | { t: 'throw'; kind: 'salt' | 'flour'; target: number }
  | { t: 'ov'; a: OvenAct }
  /** All Hands: the station tapped */
  | { t: 'kt'; s: number }
  | { t: 'pr'; l: LiveProgress }
  | { t: 'emote'; k: string }
  | { t: 'hearth' };

/** the network as the host sees it */
export interface HostWire {
  broadcast(m: HostMsg): void;
}

const SAVE_KEY = (key: string): string => `bd.match.${key}`;

/** a host-side ticker that keeps running in a background tab (workers aren't throttled like the page) */
function ticker(ms: number, fn: () => void): () => void {
  try {
    const src = `let t=setInterval(()=>postMessage(0),${ms});onmessage=()=>{clearInterval(t)}`;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const w = new Worker(url);
    URL.revokeObjectURL(url);
    w.onmessage = fn;
    return () => {
      w.postMessage(0);
      w.terminate();
    };
  } catch {
    const t = setInterval(fn, ms);
    return () => clearInterval(t);
  }
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** what is saved for a refresh: the state, the results already in for this game, and the oven or kitchen */
interface Saved {
  st: MatchState;
  at: number;
  results?: (GameResult | null)[];
  oven?: OvenState | null;
  kitchen?: KitchenState | null;
}
type Restore = { results?: (GameResult | null)[]; oven?: OvenState | null; kitchen?: KitchenState | null };

export class HostMatch {
  night: Night;
  private stopTick: (() => void) | null = null;
  private lastSt = 0;
  private lastOv = 0;
  private lastKt = 0;
  private lastPr = 0;
  private lastSave = 0;
  private lastPhase = '';
  private prog: (LiveProgress | null)[];
  private emoteAt: number[];
  local: ClientMatch | null = null;
  onOver: (() => void) | null = null;
  private onHide = (): void => this.persist(now());

  constructor(
    st: MatchState,
    private wire: HostWire | null,
    private saveKey: string,
    restore?: Restore,
  ) {
    // a resumed night carries what was in flight (see saved())
    const carried = (st as MatchState & { __restore?: Restore }).__restore;
    delete (st as MatchState & { __restore?: unknown }).__restore;
    this.night = new Night(st, restore ?? carried);
    this.prog = st.seats.map(() => null);
    this.emoteAt = st.seats.map(() => 0);
  }

  get st(): MatchState {
    return this.night.st;
  }

  start(): void {
    this.stopTick?.();
    this.stopTick = ticker(50, () => this.tick());
    this.night.dirty = true;
    this.night.resume(now());
    if (typeof window !== 'undefined') window.addEventListener('pagehide', this.onHide);
    this.tick();
  }

  stop(clearSave = true): void {
    this.stopTick?.();
    this.stopTick = null;
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', this.onHide);
    if (clearSave) HostMatch.clearSaved(this.saveKey);
  }

  seatOf(userId: string): number {
    return this.st.seats.findIndex((s) => s.id === userId);
  }

  /** someone dropped (an AI stands in) or came back */
  setPresent(userId: string, present: boolean): void {
    const i = this.seatOf(userId);
    const s = this.st.seats[i];
    if (!s || s.ai) return;
    if (s.standIn !== !present) {
      s.standIn = !present;
      this.night.dirty = true;
    }
  }

  /** someone left for good: their seat becomes an AI rival */
  leave(userId: string): void {
    const i = this.seatOf(userId);
    const s = this.st.seats[i];
    if (!s || s.ai) return;
    s.ai = true;
    s.standIn = false;
    s.id = `ai:${i}`;
    this.night.dirty = true;
  }

  private send(m: HostMsg): void {
    this.wire?.broadcast(m);
    // the host's own screen reads the live state (it only compares keys, never object identity)
    this.local?.receive(m);
  }

  tick(): void {
    const n = now();
    const night = this.night;
    night.tick(n);
    const phase = `${night.st.phase}:${night.st.round}:${night.st.part}:${night.st.tallyStep}`;
    if (phase !== this.lastPhase) {
      // a new game: last game's live bars start from zero
      if (night.st.phase === 'play') this.prog = night.st.seats.map(() => null);
      this.lastPhase = phase;
    }
    if (night.dirty && n - this.lastSt >= 80) {
      night.dirty = false;
      this.lastSt = n;
      this.send({ t: 'st', s: night.st, at: n });
      if (n - this.lastSave > 1000 || phase !== this.savedPhase) this.persist(n);
    }
    if (night.oven && (night.ovenDirty ? n - this.lastOv >= 60 : n - this.lastOv >= 500)) {
      night.ovenDirty = false;
      this.lastOv = n;
      this.send({ t: 'ov', o: night.oven, at: n });
    }
    // the kitchen: on every change, and often while cooks walk (screens extrapolate their paths in between)
    if (night.kitchen && (night.kitchenDirty ? n - this.lastKt >= 60 : n - this.lastKt >= 250)) {
      night.kitchenDirty = false;
      this.lastKt = n;
      this.send({ t: 'kt', k: night.kitchen, at: n });
    }
    if (night.st.phase === 'play' && n - this.lastPr >= 250) {
      this.lastPr = n;
      const p = night.st.seats.map((s, i) => (s.ai || s.standIn ? night.progressOf(i) : this.prog[i] ?? null));
      this.send({ t: 'pr', p, at: n });
    }
    if (night.st.phase === 'over' && this.stopTick) {
      this.send({ t: 'st', s: night.st, at: n });
      this.stop();
      this.onOver?.();
    }
  }

  private savedPhase = '';
  private persist(n: number): void {
    this.lastSave = n;
    this.savedPhase = `${this.st.phase}:${this.st.round}:${this.st.part}:${this.st.tallyStep}`;
    if (this.st.phase === 'over') return;
    try {
      const d: Saved = { st: this.night.st, at: n, results: this.night.results, oven: this.night.oven, kitchen: this.night.kitchen };
      sessionStorage.setItem(SAVE_KEY(this.saveKey), JSON.stringify(d));
    } catch {
      /* full or private */
    }
  }

  /** a saved night (after a refresh), its clocks moved on by the time away */
  static saved(key: string): (MatchState & { __restore?: Restore }) | null {
    try {
      const raw = sessionStorage.getItem(SAVE_KEY(key));
      if (!raw) return null;
      const d = JSON.parse(raw) as Saved;
      // too old to resume
      if (now() - d.at > 4 * 60 * 1000 || d.st.phase === 'over') return null;
      // pick up where it was: the current phase carries on with what was left on its clock
      const shift = now() - d.at;
      d.st.phaseStart += shift;
      d.st.phaseEnd += shift;
      for (const p of d.st.players) if (p.flourAt > 1) p.flourAt += shift;
      if (d.oven) {
        d.oven.start += shift;
        d.oven.end += shift;
        if (d.oven.ghostAt) d.oven.ghostAt += shift;
        for (const t of d.oven.trays) if (t.st === 'baking') t.start += shift;
      }
      if (d.kitchen) {
        const k = d.kitchen;
        k.start += shift;
        k.end += shift;
        k.t += shift;
        for (const t of k.tickets) {
          t.at += shift;
          t.due += shift;
        }
        for (const s of k.stations) if (s.start) s.start += shift;
      }
      return Object.assign(d.st, { __restore: { results: d.results, oven: d.oven, kitchen: d.kitchen } });
    } catch {
      return null;
    }
  }

  static clearSaved(key: string): void {
    try {
      sessionStorage.removeItem(SAVE_KEY(key));
    } catch {
      /* ignore */
    }
  }

  /** a guest's (or the local player's) message; anything malformed is ignored */
  handle(userId: string, m: GuestMsg): void {
    if (!m || typeof m !== 'object') return;
    const seat = this.seatOf(userId);
    const night = this.night;
    const n = now();
    if (m.t === 'hi') {
      night.dirty = true;
      night.ovenDirty = true;
      night.kitchenDirty = true;
      this.lastSt = 0;
      return;
    }
    if (m.t === 'ping') {
      if (isNum(m.id)) this.send({ t: 'pong', id: m.id, th: n, to: userId });
      return;
    }
    if (seat < 0) return;
    const err = (msg: string): void => {
      if (msg) this.send({ t: 'err', to: userId, msg });
    };
    switch (m.t) {
      case 'res':
        if (isInt(m.r) && isInt(m.p) && m.res && typeof m.res === 'object' && isNum(m.res.q)) night.submit(seat, m.r, m.p, m.res);
        break;
      case 'claim':
        night.claim(seat, !!m.v);
        break;
      case 'buy':
        if (m.m && typeof m.m === 'object' && isInt(m.m.item)) err(night.buy(seat, { item: m.m.item, amount: isNum(m.m.amount) ? m.m.amount : undefined, target: isInt(m.m.target) ? m.m.target : undefined, game: typeof m.m.game === 'string' ? m.m.game : undefined }));
        break;
      case 'done':
        // on the order card it's "ready" (skip the wait); at the market, Done / back
        if (night.st.phase === 'reveal') night.ready(seat, n);
        else night.marketDone(seat, !!m.v);
        break;
      case 'throw':
        if ((m.kind === 'salt' || m.kind === 'flour') && isInt(m.target)) err(night.throwHeld(seat, m.kind, m.target));
        break;
      case 'ov':
        if (m.a && typeof m.a === 'object' && ['load', 'pull', 'bump', 'prep'].includes(m.a.k)) {
          night.ovenAct(seat, { k: m.a.k, slot: isInt(m.a.slot) ? m.a.slot : undefined, tray: isInt(m.a.tray) ? m.a.tray : undefined, when: isNum(m.a.when) ? m.a.when : undefined }, n);
        }
        break;
      case 'kt':
        if (isInt(m.s)) night.kitchenAct(seat, m.s, n);
        break;
      case 'pr':
        if (m.l && isNum(m.l.v)) this.prog[seat] = { v: Math.max(0, Math.min(1, m.l.v)), c: Math.max(0, Math.min(999, (m.l.c as number) | 0)), e: String(m.l.e || '').slice(0, 10), at: n };
        break;
      case 'emote':
        if (n - (this.emoteAt[seat] ?? 0) > 1200 && ['cheers', 'laugh', 'heart', 'burnt'].includes(m.k)) {
          this.emoteAt[seat] = n;
          night.emote(seat, m.k);
        }
        break;
      case 'hearth':
        night.lightHearth();
        break;
    }
  }
}

type Handler = (data: unknown) => void;

/** what a player's screen holds: the latest state, oven and progress, and the clock offset to the host */
export class ClientMatch {
  st: MatchState | null = null;
  oven: OvenState | null = null;
  kitchen: KitchenState | null = null;
  prog: (LiveProgress | null)[] = [];
  /** host clock − local clock (ms) */
  offset = 0;
  /** the clock has been measured at least once (always true for the host's own screen) */
  synced: boolean;
  /** recent round trips: the offset comes from the fastest of these (a sliding window follows drift) */
  private samples: { rtt: number; off: number }[] = [];
  private pingId = 0;
  private pingSent = new Map<number, number>();
  private handlers = new Map<string, Set<Handler>>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private burstTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    public userId: string,
    private sendFn: (m: GuestMsg) => void,
    public isHost: boolean,
  ) {
    this.synced = isHost;
    if (!isHost) {
      this.burst();
      this.pingTimer = setInterval(() => this.ping(), 5000);
    }
  }

  /** a few quick pings (on joining, after the host comes back) */
  burst(): void {
    if (this.isHost) return;
    if (this.burstTimer) clearInterval(this.burstTimer);
    let n = 0;
    this.ping();
    this.burstTimer = setInterval(() => {
      this.ping();
      if (++n >= 5 && this.burstTimer) {
        clearInterval(this.burstTimer);
        this.burstTimer = null;
      }
    }, 200);
  }

  get me(): number {
    return this.st ? this.st.seats.findIndex((s) => s.id === this.userId) : -1;
  }

  hostNow(): number {
    return now() + this.offset;
  }

  /** host ms → local performance.now() */
  toLocal(hostMs: number): number {
    return hostMs - this.offset - performance.timeOrigin;
  }

  send(m: GuestMsg): void {
    this.sendFn(m);
  }

  private ping(): void {
    const id = ++this.pingId;
    this.pingSent.set(id, now());
    if (this.pingSent.size > 20) this.pingSent.delete(this.pingSent.keys().next().value!);
    this.send({ t: 'ping', id });
  }

  receive(m: HostMsg): void {
    switch (m.t) {
      case 'st':
        this.st = m.s;
        this.emit('state', m.s);
        break;
      case 'ov':
        this.oven = m.o;
        this.emit('oven', m.o);
        break;
      case 'kt':
        this.kitchen = m.k;
        this.emit('kitchen', m.k);
        break;
      case 'pr':
        this.prog = m.p;
        this.emit('prog', m.p);
        break;
      case 'pong': {
        if (m.to !== this.userId) return;
        const sent = this.pingSent.get(m.id);
        if (sent === undefined) return;
        this.pingSent.delete(m.id);
        const rtt = now() - sent;
        this.samples.push({ rtt, off: m.th - (sent + rtt / 2) });
        if (this.samples.length > 8) this.samples.shift();
        const best = this.samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
        this.offset = best.off;
        if (!this.synced) {
          this.synced = true;
          this.emit('synced', null);
        }
        break;
      }
      case 'err':
        if (m.to === this.userId) this.emit('error', m.msg);
        break;
      case 'bye':
        this.emit('bye', m.reason);
        break;
    }
  }

  on(ev: 'state' | 'oven' | 'kitchen' | 'prog' | 'error' | 'bye' | 'synced', fn: Handler): () => void {
    if (!this.handlers.has(ev)) this.handlers.set(ev, new Set());
    this.handlers.get(ev)!.add(fn);
    return () => this.handlers.get(ev)?.delete(fn);
  }

  private emit(ev: string, d: unknown): void {
    for (const f of this.handlers.get(ev) ?? []) f(d);
  }

  close(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.burstTimer) clearInterval(this.burstTimer);
    this.pingTimer = this.burstTimer = null;
    this.handlers.clear();
  }
}

/**
 * Whose seat a solo night is played from: the signed-in account's seat (the lobby seats a signed-in player under their
 * account id), else the offline player ('local'), else the night's only person. Without this a signed-in player's solo
 * night ran with nobody at their seat: no mini game opened and the bakery waited on them.
 */
export function soloPlayerId(seats: { id: string; ai: boolean }[], accountId: string | null): string {
  const people = seats.filter((s) => !s.ai);
  return (people.find((s) => s.id === accountId) ?? people.find((s) => s.id === 'local') ?? people[0])?.id ?? 'local';
}

/** solo (or the host's own screen): the client talks straight to the host in this tab */
export function localPair(host: HostMatch, userId: string): ClientMatch {
  const c = new ClientMatch(userId, (m) => queueMicrotask(() => host.handle(userId, m)), true);
  host.local = c;
  return c;
}
