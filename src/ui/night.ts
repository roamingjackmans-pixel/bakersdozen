// The night at the bakery (the Bakery mockup): the pinned order card, the window that is the clock, the door with
// its wax seals, the shared tray on the counter and four stations. Over it, each phase: the order reveal, the mini
// game (canvas) with the rivals in the corner, the tally and the 13th-loaf call, the peddler's cart, the Inspector's
// dawn check and the results. Everything is drawn from the host's snapshots; choices go back to the host.
import { mainMenu, show } from '../app';
import { audio } from '../audio/audio';
import { BAKER, BUFFS, CUSTOMER, EMOTES, GAMES, ITEMS, MINI_IDS, MODS, STYLES, TWISTS, ACHIEVEMENTS, COSMETIC, BAL } from '../game/data';
import { COUNTDOWN_S } from '../game/flow';
import { ClientMatch, HostMatch, localPair, soloPlayerId, type GuestMsg, type HostMsg } from '../game/match';
import { recordNight, dailyScore, type NightExtras, type Unlocks } from '../game/profile';
import { hash } from '../game/rng';
import { bakeryOf, canClaim, currentGame, isLastPlace, order, priceFor, seatOpen, seatWon } from '../game/rules';
import { save, saveNow, session } from '../game/session';
import type { BuffId, GameId, LiveProgress, MatchState, MiniId } from '../game/types';
import { demoCanvas } from '../mini/demos';
import { runMini } from '../mini/runner';
import type { Net } from '../net/socket';
import { api } from '../net/api';
import { CROWN, EMOTE_SVG, GAME_ICONS, HOURGLASS, LOAF13, SAFFRON, STAR, TIP, buffIcon, customerBadge, itemSVG, lineIcon, sealSVG, sprite } from '../render/art';
import { portrait, rollingPin, sheriffPortrait } from '../render/portraits';
import { h, modal, svg, toast } from './dom';
import { ambient, nightWindow, type NightWindow } from './scene';
import type { LState } from './lobby';

interface Ctx {
  client: ClientMatch;
  host: HostMatch | null;
  net: Net | null;
  lobby: LState | null;
  mode: 'solo' | 'host' | 'guest';
  offs: (() => void)[];
  runner: { stop(): void } | null;
  runningKey: string;
  doneKey: string;
  extras: NightExtras;
  hostAway: number;
  /** the last result we sent (re-sent if the host may have missed it) */
  lastResult: GuestMsg | null;
  recorded: Unlocks | null;
  lastEvent: number;
  hearthTaps: number;
}

let C: Ctx | null = null;
const HOST_AWAY = 'The host is reconnecting…';

export function inNight(): boolean {
  return !!C;
}

export function stopNight(): void {
  if (!C) return;
  C.runner?.stop();
  C.runner = null;
  for (const f of C.offs) f();
  C.host?.stop(C.client.st?.phase === 'over');
  C.client.close();
  audio.duckMusic(false);
  C = null;
}

// ------------------------------------------------------------------ starting a night

export function startSolo(st: MatchState, lobby: LState | null, resumed: boolean): void {
  stopNight();
  const host = new HostMatch(st, null, 'solo');
  // your seat: your account's when signed in, 'local' offline
  const client = localPair(host, soloPlayerId(st.seats, session.online ? (session.user?.id ?? null) : null));
  C = mkCtx(client, host, null, lobby, 'solo');
  host.start();
  enter();
}

export function startHost(net: Net, lobby: LState, st: MatchState): void {
  stopNight();
  const host = new HostMatch(st, { broadcast: (m: HostMsg) => net.hostSend({ t: 'm', m }) }, lobby.code ?? 'online');
  const client = localPair(host, session.user!.id);
  C = mkCtx(client, host, net, lobby, 'host');
  const c = C;
  c.offs.push(
    net.on('guestmsg', (m: { from: string; msg: { t: string; m?: GuestMsg } }) => {
      if (m.msg?.t === 'm' && m.msg.m) host.handle(m.from, m.msg.m);
      if (m.msg?.t === 'hello') host.handle(m.from, { t: 'hi' });
    }),
    net.on('room', (r: { players: { userId: string; online: boolean }[] }) => {
      for (const p of r.players) host.setPresent(p.userId, p.online);
      for (const s of host.st.seats) if (!s.ai && !r.players.some((p) => p.userId === s.id)) host.leave(s.id);
    }),
    net.on('guestleft', (m: { userId: string }) => host.leave(m.userId)),
  );
  host.start();
  enter();
}

export function startGuest(net: Net, lobby: LState): void {
  stopNight();
  const client = new ClientMatch(session.user!.id, (m) => net.guestSend({ t: 'm', m }), false);
  C = mkCtx(client, null, net, lobby, 'guest');
  const c = C;
  c.offs.push(
    net.on('hostmsg', (m: { t: string; m?: HostMsg }) => {
      if (m.t === 'm' && m.m) client.receive(m.m);
    }),
    net.on('hostaway', (m: { until: number }) => {
      c.hostAway = m.until;
      renderAll();
    }),
    net.on('hostback', () => resync(c)),
    net.on('rejoined', () => resync(c)),
    client.on('synced', () => onState()),
  );
  client.send({ t: 'hi' });
  enter();
}

/** after the host came back or our socket reconnected: measure the clock again, ask for the state, re-send our last result */
function resync(c: Ctx): void {
  c.hostAway = 0;
  if (els) els.status.style.display = 'none';
  c.client.burst();
  c.client.send({ t: 'hi' });
  if (c.lastResult) c.client.send(c.lastResult);
  renderAll();
}

export function backToLobbyFromHost(): void {
  stopNight();
  void import('./lobby').then((l) => l.lobbyScreen());
}

function mkCtx(client: ClientMatch, host: HostMatch | null, net: Net | null, lobby: LState | null, mode: Ctx['mode']): Ctx {
  return { client, host, net, lobby, mode, offs: [], runner: null, runningKey: '', doneKey: '', extras: { geode: false, hearth: false, saltLeader: false }, hostAway: 0, lastResult: null, recorded: null, lastEvent: 0, hearthTaps: 0 };
}

// ------------------------------------------------------------------ the screen

let els: {
  root: HTMLElement;
  orderCard: HTMLElement;
  win: NightWindow;
  door: HTMLElement;
  counter: HTMLElement;
  stations: HTMLElement;
  overlay: HTMLElement;
  rivals: HTMLElement;
  emotes: HTMLElement;
  status: HTMLElement;
  hearth: HTMLElement;
  timerBars: HTMLElement[];
  fps: HTMLElement | null;
} | null = null;
const keys: Record<string, string> = {};
let phaseKey = '';
let tallyAnim = 0;

function enter(): void {
  const c = C!;
  audio.music('bakery');
  show((root) => {
    for (const k of Object.keys(keys)) delete keys[k];
    phaseKey = '';
    root.appendChild(h('div.wall'));
    root.appendChild(ambient([[20, 120], [1420, 120]]));
    const orderCard = h('div.order-card');
    const win = nightWindow(162, { width: 700 });
    const door = h('div.door.wood');
    const hearth = h('div.hearth', { role: 'button', 'aria-label': 'Hearth', tabindex: '-1', style: 'left:356px;top:268px;width:64px;height:52px', onclick: () => tapHearth() });
    const top = h('div', { style: 'position:relative;display:flex;gap:28px;height:300px;flex-shrink:0' }, orderCard, win.el, door);
    const counter = h('div.counter');
    const stations = h('div.stations');
    const screen = h('div.screen', top, counter, stations);
    const overlay = h('div.overlay');
    const rivals = h('div.rivals', { style: 'display:none' });
    const emotes = h(
      'div.emote-bar',
      ...EMOTES.map((k) =>
        h(
          'button',
          {
            type: 'button',
            'aria-label': k,
            onclick: () => {
              C?.client.send({ t: 'emote', k });
              audio.sfx('emote');
            },
          },
          svg(EMOTE_SVG[k]!),
        ),
      ),
    );
    const leave = h('button.tiny', { type: 'button', 'aria-label': 'Leave the night', style: 'position:absolute;right:0;top:0;z-index:31;min-width:44px;font-size:16px', onclick: () => leaveConfirm() }, '✕');
    const status = h('div.waiting', { style: 'display:none' });
    root.append(screen, hearth, overlay, rivals, emotes, status, leave);
    const fps = session.profile.settings.fps ? h('div.fps') : null;
    if (fps) root.appendChild(fps);
    els = { root, orderCard, win, door, counter, stations, overlay, rivals, emotes, status, hearth, timerBars: [], fps };
    c.offs.push(
      c.client.on('state', () => onState()),
      c.client.on('prog', (p) => updateRivals(p as (LiveProgress | null)[])),
      c.client.on('error', (m) => toast(String(m), 'bad')),
    );
    if (c.client.st) onState();
    // the clocks and the FPS counter
    let frames = 0;
    let fpsAt = performance.now();
    let raf = 0;
    // the FPS counter only runs when it's switched on (Settings)
    const loop = (): void => {
      raf = requestAnimationFrame(loop);
      frames++;
      const n = performance.now();
      if (n - fpsAt >= 500) {
        if (els?.fps) els.fps.textContent = `${Math.round((frames * 1000) / (n - fpsAt))} fps`;
        frames = 0;
        fpsAt = n;
      }
    };
    if (fps) raf = requestAnimationFrame(loop);
    const iv = window.setInterval(tickTimers, 200);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(iv);
      clearInterval(tallyAnim);
      els = null;
    };
  });
}

function renderAll(): void {
  for (const k of Object.keys(keys)) delete keys[k];
  onState();
}

function region(name: string, key: string, fn: () => void): void {
  if (keys[name] === key) return;
  keys[name] = key;
  fn();
}

function me(): number {
  return C?.client.me ?? -1;
}

// ------------------------------------------------------------------ on every snapshot

function onState(): void {
  const c = C;
  const st = c?.client.st;
  if (!c || !st || !els) return;
  playEvents(st);
  renderOrderCard(st);
  renderWindow(st);
  renderDoor(st);
  renderCounter(st);
  renderStations(st);
  renderHearth(st);
  maybeRunGame(st);
  renderPhase(st);
  syncRoot();
  if (!c.hostAway && els.status.textContent === HOST_AWAY) els.status.style.display = 'none';
  if (c.hostAway && c.mode === 'guest') {
    els.status.style.display = '';
    els.status.textContent = HOST_AWAY;
  }
}

/** the bakery under a full-screen game is hidden; under a dim overlay its animations pause (no repaints) */
function syncRoot(): void {
  if (!els) return;
  els.root.classList.toggle('gaming', !!C?.runner);
  els.root.classList.toggle('dimmed', els.overlay.classList.contains('dim'));
}

function tickTimers(): void {
  const st = C?.client.st;
  if (!st || !els) return;
  const left = Math.max(0, (st.phaseEnd - C!.client.hostNow()) / 1000);
  const total = Math.max(0.1, (st.phaseEnd - st.phaseStart) / 1000);
  for (const el of els.timerBars) {
    if (!el.isConnected) continue;
    const bar = el.querySelector('i') as HTMLElement | null;
    const txt = el.querySelector('b') as HTMLElement | null;
    if (bar) bar.style.width = `${Math.round((left / total) * 100)}%`;
    if (txt) txt.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  }
  els.timerBars = els.timerBars.filter((e) => e.isConnected);
}

function timerBar(color = '#A8322D', dark = true): HTMLElement {
  const el = h(
    'div.row',
    { style: 'gap:10px' },
    svg(HOURGLASS(22, dark ? '#2A1A12' : '#FFF4E0')),
    h('div', { style: `flex:1;height:12px;border-radius:6px;background:#DCC7A0;border:2px solid #2A1A12;overflow:hidden` }, h('i', { style: `display:block;height:12px;width:100%;background-color:${color};background-image:repeating-linear-gradient(135deg,rgba(255,255,255,0.18) 0px,rgba(255,255,255,0.18) 6px,rgba(0,0,0,0) 6px,rgba(0,0,0,0) 12px);transition:width .2s linear` })),
    h('b', { style: `font-size:16px;font-weight:900;color:${dark ? '#2A1A12' : '#FFF4E0'};min-width:40px` }, ''),
  );
  els?.timerBars.push(el);
  return el;
}

// ------------------------------------------------------------------ the order card, window, door

function renderOrderCard(st: MatchState): void {
  const o = order(st);
  region('order', `${st.round}:${st.part}:${st.phase}`, () => {
    const cust = CUSTOMER[o.customer]!;
    const g = currentGame(st);
    const sec = h(
      'section.parchment.torn',
      h('svg', {}),
      h('div.row', { style: 'justify-content:space-between' }, h('span', { style: 'font-size:14px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:#8A5A35' }, `Order ${st.round + 1} / ${st.orders.length}`), o.rush ? h('span.stamp', 'Rush') : o.twist ? h('span.stamp', { style: 'font-size:11px' }, TWISTS[o.twist].name) : ''),
      h('div.row', { style: 'gap:10px' }, svg(customerBadge(cust.badge, 40)), h('span.display', { style: 'font-size:22px;font-weight:800' }, cust.name)),
      h('div.row', { style: 'justify-content:space-between' }, h('h2', { style: 'font-size:32px;font-weight:900;line-height:1' }, `${o.need} ${o.item}`), svg(itemSVG(ITEMS[o.item]?.icon ?? 'loaf', 56))),
      timerBar(),
      h('div', { style: 'height:0;border-top:2px dashed #B99C70' }),
      h('div.row', { style: 'justify-content:space-between;font-size:16px;font-weight:800' }, h('span', { style: 'color:#6B4A33' }, o.games.length > 1 ? 'Mini games' : 'Mini game'), h('span', o.games.map((x) => GAMES[x].name).join(' → '))),
      h('div.row', { style: 'justify-content:space-between;font-size:16px;font-weight:800' }, h('span', { style: 'color:#6B4A33' }, '13th loaf'), h('span', o.twist === 'nothirteenth' ? 'None this order' : `1 Saffron → +${BAL.thirteenthStars} ★`)),
    );
    sec.firstElementChild?.remove();
    void g;
    const pin = h('div.pin', svg(`<svg width="30" height="34" viewBox="0 0 30 34" aria-hidden="true"><ellipse cx="17" cy="30" rx="6" ry="2.5" fill="rgba(0,0,0,0.3)"/><path d="M15 18 L15 30" stroke="#8F96A3" stroke-width="2.5" stroke-linecap="round"/><circle cx="15" cy="12" r="10" fill="#C8553D" stroke="#1E120C" stroke-width="2"/><circle cx="11.5" cy="8.5" r="3" fill="#FFFFFF" opacity="0.5"/></svg>`));
    els!.orderCard.replaceChildren(pin, sec);
  });
}

function renderWindow(st: MatchState): void {
  region('window', `${st.round}`, () => {
    const n = st.orders.length;
    els!.win.set(n > 1 ? st.round / (n - 1) : 1, n - 1 - st.round);
  });
}

function myBakery(st: MatchState): number {
  const m = me();
  return m >= 0 ? bakeryOf(st, m) : 0;
}

function renderDoor(st: MatchState): void {
  const b = st.bakeries[myBakery(st)]!;
  region('door', `${b.seals}/${b.maxSeals}/${b.bribes}/${b.closed}`, () => {
    const seals = h('div.col', { style: 'gap:4px;align-items:center' });
    for (let i = 0; i < b.maxSeals; i++) seals.appendChild(svg(sealSVG(i >= b.seals, 60)));
    els!.door.replaceChildren(
      svg(
        `<svg width="208" height="288" viewBox="0 0 208 288" aria-hidden="true" style="position:absolute;left:0;top:0"><g transform="translate(0 92)"><path d="M0 0 L120 0 Q132 6 120 12 L0 12 Z" fill="#26262B" stroke="#1E120C" stroke-width="2"/><circle cx="14" cy="6" r="2.5" fill="#55555E"/><circle cx="50" cy="6" r="2.5" fill="#55555E"/><circle cx="90" cy="6" r="2.5" fill="#55555E"/></g><g transform="translate(0 214)"><path d="M0 0 L120 0 Q132 6 120 12 L0 12 Z" fill="#26262B" stroke="#1E120C" stroke-width="2"/><circle cx="14" cy="6" r="2.5" fill="#55555E"/><circle cx="50" cy="6" r="2.5" fill="#55555E"/><circle cx="90" cy="6" r="2.5" fill="#55555E"/></g><rect x="74" y="16" width="60" height="40" rx="20" fill="#141B3A" stroke="#1E120C" stroke-width="2.5"/><path d="M89 18 L89 54 M104 16 L104 56 M119 18 L119 54" stroke="#26262B" stroke-width="4"/><circle cx="176" cy="160" r="9" fill="none" stroke="#26262B" stroke-width="4"/><circle cx="176" cy="150" r="4" fill="#26262B"/></svg>`,
      ),
      h('span.tag', { style: 'position:relative' }, 'Fines'),
      h('div', { style: 'position:relative' }, seals),
      h('span', { style: 'position:relative;font-size:18px;font-weight:900' }, `${b.maxSeals - b.seals} / ${b.maxSeals}`),
      b.bribes ? h('span.pill', { style: 'position:relative' }, svg(buffIcon('#E8B84A')), `Bribe ×${b.bribes}`) : '',
    );
    (els!.door.firstElementChild as HTMLElement).style.cssText = 'position:absolute;left:0;top:0';
  });
}

// ------------------------------------------------------------------ the shared tray

function trayShown(st: MatchState): number {
  const b = st.bakeries[myBakery(st)]!;
  if (st.phase === 'tally' && st.tallyStep === 0 && tallyShown >= 0) return Math.min(b.tray, tallyShown);
  return b.tray;
}
let tallyShown = -1;

/** who baked which of the tray's loaves: shares split by largest remainder, in seat order */
function owners(b: MatchState['bakeries'][number], shown: number): number[] {
  const n = Math.min(shown, 13);
  const total = b.trayBy.reduce((s, x) => s + Math.max(0, x), 0);
  if (total <= 0 || n <= 0) return [];
  const want = b.trayBy.map((x) => (Math.max(0, x) / total) * n);
  const base = want.map((x) => Math.floor(x));
  let left = n - base.reduce((s, x) => s + x, 0);
  const byRest = want.map((x, i) => [x - Math.floor(x), i] as [number, number]).sort((p, q) => q[0] - p[0]);
  for (const [, i] of byRest) {
    if (left <= 0) break;
    base[i]!++;
    left--;
  }
  const out: number[] = [];
  base.forEach((k, seat) => {
    for (let j = 0; j < k; j++) out.push(seat);
  });
  return out;
}

let slotEls: HTMLElement[] = [];
let slotState: string[] = [];
let countEl: HTMLElement | null = null;
let overEl: HTMLElement | null = null;

const SPARKLES = `<svg width="66" height="56" viewBox="0 0 72 60" aria-hidden="true" style="position:absolute;inset:0"><path class="bd-sp" transform="translate(10 10) scale(0.8)" d="M0 -8 Q1 -1 8 0 Q1 1 0 8 Q-1 1 -8 0 Q-1 -1 0 -8 Z" fill="#FFE7A3"/><path class="bd-sp" style="animation-delay:0.6s" transform="translate(62 14) scale(0.6)" d="M0 -8 Q1 -1 8 0 Q1 1 0 8 Q-1 1 -8 0 Q-1 -1 0 -8 Z" fill="#FFE7A3"/><path class="bd-sp" style="animation-delay:1.1s" transform="translate(58 50) scale(0.7)" d="M0 -8 Q1 -1 8 0 Q1 1 0 8 Q-1 1 -8 0 Q-1 -1 0 -8 Z" fill="#FFE7A3"/></svg>`;
const PIE = `<svg width="96" height="110" viewBox="0 0 96 110" aria-hidden="true"><ellipse cx="48" cy="100" rx="40" ry="6" fill="rgba(0,0,0,0.25)"/><path class="bd-st" d="M30 56 Q26 46 32 40" stroke="#FFF4E0" stroke-width="2.5" fill="none" opacity="0.5" stroke-linecap="round"/><path class="bd-st" style="animation-delay:1s" d="M60 54 Q56 44 62 38" stroke="#FFF4E0" stroke-width="2.5" fill="none" opacity="0.5" stroke-linecap="round"/><path d="M8 62 Q8 98 48 98 Q88 98 88 62 Z" fill="#C8553D" stroke="#1E120C" stroke-width="2.5"/><ellipse cx="48" cy="62" rx="40" ry="7" fill="#F3E3C3" stroke="#1E120C" stroke-width="2"/><path d="M14 72 Q30 86 50 86" stroke="#E98A74" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;

function renderCounter(st: MatchState): void {
  const bi = myBakery(st);
  const b = st.bakeries[bi]!;
  const shown = trayShown(st);
  const o = order(st);
  const icon = ITEMS[o.item]?.icon ?? 'loaf';
  const team = [b.ovenSlots ? `Extra Oven Slot${b.ovenSlots > 1 ? ` ×${b.ovenSlots}` : ''}` : '', b.apprentice ? `Apprentice ×${b.apprentice}` : ''].filter(Boolean);
  const rivals = st.bakeries.length > 1 && st.bakeries.length <= 2 ? st.bakeries.filter((_, i) => i !== bi) : [];
  // the frame is rebuilt rarely; the twelve slots below are patched in place
  region('counter', `${st.round}/${icon}/${o.need}/${team.join()}/${rivals.map((r) => `${r.tray}:${r.seals}`).join()}/${b.thirteenth}/${st.cfg.style}`, () => {
    const slots = h('div.tray');
    slotEls = [];
    slotState = [];
    for (let i = 0; i < o.need; i++) {
      const el = h('div.slot');
      slotEls.push(el);
      slotState.push('');
      slots.appendChild(el);
    }
    const t13 = b.thirteenth >= 0;
    const thirteen = h(`div.slot.thirteen${t13 ? '.on' : ''}`, t13 ? svg(itemSVG(icon, 52, true)) : svg(LOAF13(30)), t13 && st.seats[b.thirteenth] ? h('span.who', { style: `background:${BAKER[st.seats[b.thirteenth]!.baker].light}` }) : '');
    thirteen.appendChild(svg(SPARKLES));
    slots.appendChild(thirteen);
    countEl = h('span.display.shadowed', { style: 'font-size:26px' }, '');
    overEl = h('span.pill', { style: 'display:none' }, '');
    const label = h(
      'div.row',
      { style: 'justify-content:space-between' },
      h('div.row', { style: 'gap:12px;align-items:baseline' }, h('span.tag', st.cfg.style === 'ffa' ? 'Your tray' : st.cfg.style === 'teams' ? 'Team tray' : 'Shared tray'), countEl, overEl),
      h(
        'div.row',
        { style: 'gap:8px' },
        ...rivals.map((r) => h('span.pill', `Rivals ${r.tray} / ${o.need} · ${'●'.repeat(r.seals)}${'○'.repeat(r.maxSeals - r.seals)}`)),
        team.length ? h('span', { style: 'font-size:13px;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;color:#F3E6CF' }, 'Team') : '',
        ...team.map((t) => h('span', { style: 'display:flex;align-items:center;gap:6px;padding:4px 12px 4px 6px;border-radius:999px;background:#2A1A12;border:2px solid #F2A541;font-size:14px;font-weight:800' }, svg(buffIcon('#E07A1F', 18)), t)),
      ),
    );
    els!.counter.replaceChildren(h('div', { style: 'width:96px;flex-shrink:0' }), h('div.col', { style: 'flex:1;min-width:0;gap:8px' }, label, slots), svg(PIE));
  });
  // only the slots that changed get new content (the tray doesn't re-pop every loaf)
  const who = owners(b, Math.min(shown, o.need));
  for (let i = 0; i < slotEls.length; i++) {
    const s = who[i];
    const want = i < shown ? `on:${s ?? -1}` : 'off';
    if (slotState[i] === want) continue;
    slotState[i] = want;
    const el = slotEls[i]!;
    el.className = i < shown ? 'slot on' : 'slot';
    const kids: Node[] = [];
    if (i < shown) {
      kids.push(svg(itemSVG(icon, 52)));
      if (s !== undefined && st.seats[s]) kids.push(h('span.who', { style: `background:${BAKER[st.seats[s]!.baker].light}` }));
    }
    el.replaceChildren(...kids);
  }
  if (countEl) countEl.textContent = `${Math.min(shown, 99)} / ${o.need}`;
  if (overEl) {
    overEl.style.display = shown > o.need ? '' : 'none';
    overEl.textContent = shown > o.need ? `+${shown - o.need} spare` : '';
  }
}

// ------------------------------------------------------------------ stations

function renderStations(st: MatchState): void {
  const top = Math.max(...st.players.map((p) => p.stars));
  const parts = st.seats.map((s, i) => {
    const p = st.players[i]!;
    const b = st.bakeries[bakeryOf(st, i)]!;
    return [s.baker, s.name, s.ai, s.standIn, p.stars, p.tips, p.saffron, p.loaves13, p.buffs.join(','), p.stars === top && top > 0, st.done.includes(i), st.claims.includes(i), b.closed, b.tray, b.seals, st.phase, st.tallyStep, p.salted, p.recipeFor].join('|');
  });
  region('stations', parts.join('#') + st.seats.length, () => {
    const mine = me();
    els!.stations.style.gridTemplateColumns = `repeat(${Math.max(4, st.seats.length)}, minmax(0, 1fr))`;
    els!.stations.replaceChildren(
      ...st.seats.map((s, i) => {
        const p = st.players[i]!;
        const b = BAKER[s.baker];
        const bk = st.bakeries[bakeryOf(st, i)]!;
        const leader = p.stars === top && top > 0;
        const label = `P${i + 1}${i === mine ? ' · You' : s.standIn ? ' · AI stand-in' : s.ai ? ' · AI' : ''}`;
        let status = '';
        if (bk.closed) status = 'Closed';
        else if (st.phase === 'play') status = st.done.includes(i) ? 'Done' : 'Baking…';
        else if (st.phase === 'tally' && st.tallyStep === 1) status = st.claims.includes(i) ? 'Wants the 13th' : canClaim(st, i) ? 'Thinking…' : p.saffron ? '' : 'No Saffron';
        else if (st.phase === 'market') status = st.done.includes(i) ? 'Done shopping' : 'Shopping…';
        const freeload = st.cfg.style !== 'coop' && p.loaves13 === 0;
        const showBakery = st.bakeries.length > 2 || (st.cfg.style === 'teams' && false);
        return h(
          `div.station${i === mine ? '.me' : ''}${bk.closed ? '.closed' : ''}`,
          { 'data-seat': String(i), style: st.cfg.style === 'teams' ? `border-color:${s.team ? '#5B7BA6' : '#C8553D'}` : '' },
          h('div.band', { style: `background-color:${b.light}` }, h('span', label), svg(CROWN(18))),
          h(
            'div.body',
            h('div.row', { style: 'gap:12px' }, svg(portrait(s.baker, 70, s.cosmetics)), h('div', h('div.name', s.name === b.name || s.ai ? b.name : s.name), h('div.status', s.name !== b.name && !s.ai ? b.name : b.title))),
            h(
              'div.row',
              { style: 'gap:6px;flex-wrap:wrap' },
              h('span.chip', svg(STAR(20)), `${p.stars}`),
              h('span.chip', svg(TIP(20)), `${p.tips}`),
              h(`span.chip${freeload ? '.warn' : ''}`, { title: freeload ? 'Never baked a 13th loaf: loses half ★ at dawn' : '13th loaves' }, svg(LOAF13(26)), `${p.loaves13}`),
              h('span.chip', { title: 'Saffron' }, svg(SAFFRON(20)), `${p.saffron}`),
            ),
            showBakery ? h('div.small', { style: 'font-weight:800' }, `Tray ${bk.tray} / ${order(st).need} · ${'●'.repeat(bk.seals)}${'○'.repeat(bk.maxSeals - bk.seals)}`) : '',
            h(
              'div.buffs',
              ...p.buffs.map((bf) => h('span.pill.icon', { title: BUFFS[bf].name, 'aria-label': BUFFS[bf].name }, svg(buffIcon(BUFFS[bf].color, 18)))),
              p.recipeFor ? h('span.pill', { title: 'Secret Family Recipe' }, svg(buffIcon('#FFD166', 16)), GAMES[p.recipeFor].name) : '',
              p.salted ? h('span.pill', { style: 'border-color:#FFFDF8' }, 'Salted') : '',
            ),
            status ? h('div.status', status) : '',
          ),
        );
      }),
    );
    // the crown only on the leader
    els!.stations.querySelectorAll('.station').forEach((el, i) => {
      const crown = el.querySelector('.band .svg') as HTMLElement | null;
      if (crown) crown.style.opacity = st.players[i]!.stars === top && top > 0 ? '1' : '0';
    });
  });
}

function stationEl(seat: number): HTMLElement | null {
  return (els?.stations.querySelector(`[data-seat="${seat}"]`) as HTMLElement) ?? null;
}

function floatAt(seat: number, text: string, color = '#E8B84A', delay = 0): void {
  const el = stationEl(seat);
  if (!el) return;
  const f = h('div.float-num', { style: `color:${color};animation-delay:${delay}s` }, text);
  el.appendChild(f);
  setTimeout(() => f.remove(), 1700 + delay * 1000);
}

// ------------------------------------------------------------------ the hidden hearth (Rest at the Hearth)

function renderHearth(st: MatchState): void {
  region('hearth', String(st.hearth), () => {
    const lit = st.hearth;
    els!.hearth.innerHTML = `<svg width="64" height="52" viewBox="0 0 64 52" aria-hidden="true"><path d="M4 52 L4 22 Q4 4 32 4 Q60 4 60 22 L60 52 Z" fill="#1A0F0A" stroke="#1E120C" stroke-width="3"/><path d="M8 52 L8 24 Q8 9 32 9 Q56 9 56 24 L56 52" fill="none" stroke="#4A2E20" stroke-width="3"/><path d="M14 48 L50 42 M16 42 L48 48" stroke="#5A3A22" stroke-width="5" stroke-linecap="round"/>${
      lit
        ? `<circle cx="32" cy="34" r="22" fill="#FFC56B" opacity="0.35" class="bd-gl"/><path class="bd-fl" d="M32 14 Q44 28 40 38 Q36 46 32 44 Q28 46 24 38 Q20 28 32 14 Z" fill="#F2A541" stroke="#E07A1F" stroke-width="1.5"/><path class="bd-fl" style="animation-delay:.3s" d="M32 24 Q38 32 36 38 Q34 42 32 41 Q30 42 28 38 Q26 32 32 24 Z" fill="#FFF3C4"/>`
        : `<circle cx="28" cy="40" r="1.6" fill="#7A2A12"/><circle cx="36" cy="42" r="1.2" fill="#7A2A12"/>`
    }</svg>`;
    els!.hearth.style.cursor = lit ? 'default' : 'pointer';
  });
}

function tapHearth(): void {
  const c = C;
  if (!c?.client.st || c.client.st.hearth) return;
  c.hearthTaps++;
  audio.sfx('tap');
  els?.hearth.classList.remove('shake');
  void els?.hearth.offsetWidth;
  els?.hearth.classList.add('shake');
  if (c.hearthTaps >= 3) {
    c.extras.hearth = true;
    c.client.send({ t: 'hearth' });
    audio.sfx('hearth');
  }
}

// ------------------------------------------------------------------ events: sounds and little moments

function playEvents(st: MatchState): void {
  const c = C!;
  if (st.eventN < c.lastEvent) c.lastEvent = st.eventN;
  if (!c.lastEvent) {
    // joining mid-night: don't replay history
    c.lastEvent = st.eventN;
    return;
  }
  for (const e of st.events) {
    if (e.n <= c.lastEvent) continue;
    switch (e.k) {
      case 'emote': {
        const el = stationEl(e.seat ?? -1);
        if (el && e.s && EMOTE_SVG[e.s]) {
          const pop = svg(EMOTE_SVG[e.s]!, 'emote-pop');
          el.appendChild(pop);
          setTimeout(() => pop.remove(), 1900);
          audio.sfx('emote');
        }
        break;
      }
      case 'thirteenth':
        audio.sfx('thirteenth');
        floatAt(e.seat ?? 0, `+${BAL.thirteenthStars} ★`);
        break;
      case 'filled':
        if (e.v === myBakery(st)) audio.sfx('filled');
        break;
      case 'fine':
        if (e.v === myBakery(st)) {
          audio.sfx('crack');
          els?.door.classList.remove('shake');
          void els?.door.offsetWidth;
          els?.door.classList.add('shake');
        }
        break;
      case 'bribed':
        if (e.v === myBakery(st)) audio.sfx('coin');
        break;
      case 'closed':
        if (e.v === myBakery(st)) audio.sfx('lose');
        break;
      case 'buy':
      case 'chip':
        audio.sfx(e.seat === me() ? 'buy' : 'coin');
        break;
      case 'teambuy':
        audio.sfx('filled');
        break;
      case 'salted':
      case 'floured':
        audio.sfx(e.k === 'salted' ? 'salt' : 'flour');
        floatAt(e.to ?? 0, e.k === 'salted' ? 'Salted' : 'Floured', '#FFFDF8');
        break;
      case 'caught':
        audio.sfx('bell');
        floatAt(e.seat ?? 0, `Caught −${e.v} ★`, '#E06B5F');
        break;
      case 'bestinshow':
        floatAt(e.seat ?? 0, 'Best in Show +3 ★');
        audio.sfx('star');
        break;
      case 'apprentice':
        if (e.v === myBakery(st)) audio.sfx('loaf');
        break;
      case 'hearth':
        if (!c.extras.hearth) audio.sfx('hearth');
        break;
      case 'recipe':
        floatAt(e.seat ?? 0, 'Family Recipe ×2', '#FFD166');
        break;
    }
  }
  c.lastEvent = st.eventN;
}

// ------------------------------------------------------------------ the mini game

function maybeRunGame(st: MatchState): void {
  const c = C!;
  const key = `${st.round}:${st.part}`;
  if (st.phase !== 'play') {
    if (c.runner) {
      c.runner.stop();
      c.runner = null;
    }
    c.runningKey = '';
    els!.rivals.style.display = 'none';
    return;
  }
  const mine = me();
  if (mine < 0) return;
  const g = currentGame(st);
  if (c.runningKey === key || c.doneKey === key) return;
  if (!c.client.synced) return;
  if (!seatOpen(st, mine)) {
    c.doneKey = key;
    showRivals(st);
    return;
  }
  const startAt = c.client.toLocal(st.phaseStart + COUNTDOWN_S * 1000);
  const seconds = (st.phaseEnd - st.phaseStart) / 1000 - COUNTDOWN_S;
  if (performance.now() > startAt + seconds * 1000 - 1500) {
    // too late to play this one (joined or refreshed near the end): an AI fills in
    c.doneKey = key;
    showRivals(st);
    return;
  }
  c.runningKey = key;
  const p = st.players[mine]!;
  const o = order(st);
  const seed = hash(`${st.cfg.seed}:${st.round}:${st.part}`);
  let swapTo: GameId | undefined;
  if (st.cfg.mods.includes('swap') && g !== 'oven' && g !== 'dawn') {
    const pool = MINI_IDS.filter((x) => x !== g && x !== 'oven');
    swapTo = pool[seed % pool.length];
  }
  const trayBefore = st.bakeries.map((b) => b.tray);
  const isDawn = g === 'dawn';
  audio.music(isDawn ? 'dawn' : 'game');
  c.runner = runMini(els!.root, {
    game: g,
    seed,
    seconds,
    baker: st.seats[mine]!.baker,
    buffs: p.buffs,
    salted: p.salted,
    rush: o.rush,
    mods: st.cfg.mods,
    twist: o.twist,
    startAt,
    flourAt: p.flourAt ? c.client.toLocal(p.flourAt) : 0,
    sheriff: o.customer === 'sheriff',
    swapTo,
    label: `${CUSTOMER[o.customer]?.name ?? ''} · ${o.need} ${o.item}`,
    link:
      g === 'oven' || isDawn
        ? {
            state: () => c.client.oven,
            hostNow: () => c.client.hostNow(),
            act: (a) => {
              if (a.k === 'bump' && isDawn && a.tray !== undefined) {
                const tr = c.client.oven?.trays.find((t) => t.id === a.tray);
                if (tr && isLeader(st, tr.owner)) c.extras.saltLeader = true;
              }
              c.client.send({ t: 'ov', a });
            },
            me: mine,
            seats: st.seats,
            bakeryOf: (s) => bakeryOf(st, s),
            need: o.need,
            trayBefore,
            coop: st.cfg.style === 'coop',
          }
        : undefined,
    onLive: (l) => {
      c.client.send({ t: 'pr', l: { ...l, at: 0 } });
      myLive = l;
    },
    onDone: (res) => {
      if (res.geode) c.extras.geode = true;
      if (g !== 'oven' && g !== 'dawn') {
        c.lastResult = { t: 'res', r: st.round, p: st.part, res };
        c.client.send(c.lastResult);
      }
      c.doneKey = key;
      c.runner?.stop();
      c.runner = null;
      myLive = null;
      syncRoot();
      audio.music('bakery');
      const cur = c.client.st;
      if (cur && cur.phase === 'play') showRivals(cur);
    },
  });
  showRivals(st);
}

let myLive: { v: number; c: number; e: string } | null = null;

function isLeader(st: MatchState, seat: number): boolean {
  const top = Math.max(...st.players.map((p) => p.stars));
  return st.players[seat]!.stars === top;
}

let rivalsKey = '';
function showRivals(st: MatchState): void {
  const r = els!.rivals;
  r.style.display = '';
  // built once per game; the bars are then moved in place (updateRivals)
  const key = `${st.round}:${st.part}:${st.seats.map((s) => s.baker).join()}:${me()}`;
  if (key !== rivalsKey || !r.firstChild) {
    rivalsKey = key;
    r.replaceChildren(
    ...st.seats.map((s, i) =>
      h(
        `div.rival${i === me() ? '.me' : ''}`,
        { 'data-seat': String(i) },
        svg(portrait(s.baker, 36, s.cosmetics, { ring: false })),
        h('div.grow', h('div.nm', i === me() ? 'You' : BAKER[s.baker].name), h('div.bar', h('i')), h('div.cb', '')),
      ),
    ),
    );
    updateRivals(C!.client.prog);
  }
  // between games the waiting line shows how many are still baking
  const waiting = st.seats.filter((_, i) => !st.done.includes(i) && seatOpen(st, i)).length;
  if (!C!.runner && currentGame(st) !== 'oven' && currentGame(st) !== 'dawn') {
    els!.status.style.display = '';
    els!.status.textContent = waiting ? `Waiting for ${waiting} baker${waiting > 1 ? 's' : ''}…` : 'Counting…';
  }
}

function updateRivals(p: (LiveProgress | null)[]): void {
  if (!els || els.rivals.style.display === 'none') return;
  els.rivals.querySelectorAll('.rival').forEach((el, i) => {
    const l = i === me() && myLive ? myLive : p[i];
    if (!l) return;
    const bar = el.querySelector('.bar i') as HTMLElement | null;
    if (bar) bar.style.transform = `scaleX(${Math.max(0.03, Math.min(1, l.v)).toFixed(3)})`;
    const cb = el.querySelector('.cb') as HTMLElement | null;
    if (cb) cb.textContent = l.c >= 2 ? `${l.c} combo` : '';
    el.classList.remove('hit', 'miss', 'perfect');
    if (l.e) el.classList.add(l.e === 'perfect' ? 'perfect' : l.e === 'miss' ? 'miss' : 'hit');
  });
}

// ------------------------------------------------------------------ phase overlays

function renderPhase(st: MatchState): void {
  const c = C!;
  const pk = `${st.phase}:${st.round}:${st.part}:${st.tallyStep}`;
  const changed = pk !== phaseKey;
  phaseKey = pk;
  const ov = els!.overlay;
  const mine = me();
  if (st.phase !== 'play' && changed) els!.status.style.display = 'none';
  els!.emotes.style.display = st.phase === 'play' && c.runner ? 'none' : '';
  if (st.phase === 'reveal') {
    if (!changed) return;
    audio.music('bakery');
    ov.className = 'overlay dim';
    ov.replaceChildren(st.part > 0 ? nextGameBanner(st) : h('div.row', { style: 'gap:30px;align-items:center' }, bigOrder(st), howTo(order(st).games)));
    audio.sfx(st.part > 0 ? 'swap' : 'bell');
    return;
  }
  if (st.phase === 'play') {
    if (changed) {
      ov.className = 'overlay';
      ov.replaceChildren();
    }
    if (!c.runner) showRivals(st);
    else els!.status.style.display = 'none';
    return;
  }
  if (st.phase === 'tally') {
    if (st.tallyStep === 0 && changed) {
      ov.className = 'overlay';
      ov.replaceChildren(h('div', { style: 'position:absolute;top:330px;left:50%;transform:translateX(-50%)' }, h('span.tag.pop', { style: 'font-size:20px;padding:6px 18px' }, 'Tally')));
      startTallyAnim(st);
      st.seats.forEach((_, i) => {
        const l = st.players[i]!.last;
        if (!l || !seatOpen(st, i)) return;
        floatAt(i, `+${l.stars} ★`, '#E8B84A', 0.1 * i);
        if (l.tips) floatAt(i, `+${l.tips} tips`, '#D9A441', 0.5 + 0.1 * i);
        if (l.saffron) floatAt(i, '+1 Saffron', '#F2A541', 0.9 + 0.1 * i);
      });
    }
    if (st.tallyStep === 1) {
      ov.className = 'overlay';
      const b = st.bakeries[myBakery(st)]!;
      region('ask', `${st.round}:${b.tray}:${st.claims.join()}:${st.done.join()}:${st.players[mine]?.saffron}`, () => ov.replaceChildren(thirteenthAsk(st, mine)));
    } else delete keys.ask;
    if (st.tallyStep === 2 && changed) {
      tallyShown = -1;
      renderCounter(st);
      ov.className = 'overlay';
      ov.replaceChildren(verdictStamp(st));
    }
    return;
  }
  if (st.phase === 'market') {
    ov.className = 'overlay dim';
    if (changed) audio.sfx('bell');
    // only when something on the cart or in your pockets changed (a rebuilt button loses a tap in flight)
    const p = st.players[mine];
    const cartKey = st.cart.map((it) => `${it.buff}:${it.pool.join('/')}:${it.soldTo}:${it.buyers.join('/')}:${it.by[mine] ?? 0}:${priceFor(st, mine, it)}`).join('|');
    region('market', `${st.round}:${cartKey}:${p?.tips}:${p?.saffron}:${p?.buffs.join()}:${st.done.join()}`, () => ov.replaceChildren(marketBox(st, mine)));
    return;
  }
  delete keys.market;
  if (st.phase === 'dawncheck') {
    if (!changed) return;
    audio.music('dawn');
    els!.win.set(1, 0);
    audio.sfx('knock');
    ov.className = 'overlay dim';
    ov.replaceChildren(dawnVerdict(st));
    return;
  }
  if (st.phase === 'over') {
    if (!changed && c.recorded) return;
    if (!c.recorded) c.recorded = record(st);
    audio.music('results');
    ov.className = 'overlay dim';
    ov.replaceChildren(results(st));
  }
}

function startTallyAnim(st: MatchState): void {
  clearInterval(tallyAnim);
  const b = st.bakeries[myBakery(st)]!;
  const start = b.tray - b.trayBy.reduce((s, n) => s + n, 0);
  tallyShown = Math.max(0, start);
  const total = b.tray;
  if (total <= tallyShown) {
    tallyShown = -1;
    return;
  }
  const step = Math.max(90, Math.min(300, (BAL.tallyCountS * 1000 * 0.8) / Math.max(1, total - tallyShown)));
  tallyAnim = window.setInterval(() => {
    tallyShown++;
    audio.sfx('loaf', tallyShown % 8);
    const cur = C?.client.st;
    if (cur) renderCounter(cur);
    if (tallyShown >= total) {
      clearInterval(tallyAnim);
      tallyShown = -1;
    }
  }, step);
}

function gameChip(g: GameId, big = false): HTMLElement {
  const d = GAMES[g];
  return h(
    'div.row',
    { style: `gap:10px;padding:${big ? '10px 16px' : '6px 12px'};border-radius:14px;background:#2A1A12;border:2px solid ${d.color}` },
    svg(lineIcon(GAME_ICONS[g] ?? '', big ? 34 : 24, d.color, 2.2)),
    h('div', h('div.display', { style: `font-size:${big ? 26 : 20}px;color:${d.color}` }, d.name), h('div', { style: 'font-size:14px;font-weight:800;color:#F3E6CF' }, d.how)),
  );
}

function bigOrder(st: MatchState): HTMLElement {
  const o = order(st);
  const cust = CUSTOMER[o.customer]!;
  const sheriff = cust.id === 'sheriff';
  return h(
    'div.big-order.parchment.torn',
    h('div.row', { style: 'justify-content:space-between' }, h('span', { style: 'font-size:16px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:#8A5A35' }, `Order ${st.round + 1} / ${st.orders.length}${o.games.includes('dawn') ? ' · Dawn' : ''}`), o.rush ? h('span.stamp', { style: 'font-size:18px' }, 'Rush') : ''),
    h('div.row', { style: 'gap:14px' }, sheriff ? svg(sheriffPortrait(96)) : svg(customerBadge(cust.badge, 56)), h('div', h('div.display', { style: 'font-size:30px' }, cust.name), sheriff ? h('div', { style: 'font-weight:800;color:#8A5A35' }, 'Law & Order') : '')),
    h('div.row', { style: 'justify-content:space-between' }, h('h2', `${o.need} ${o.item}`), svg(itemSVG(ITEMS[o.item]?.icon ?? 'loaf', 110))),
    h('div.row', { style: 'gap:10px;flex-wrap:wrap' }, ...o.games.map((g) => gameChip(g, true))),
    o.twist ? h('div', { style: 'padding:10px 14px;border-radius:12px;background:#A8322D;color:#FFF4E0;font-weight:900;font-size:18px' }, `${TWISTS[o.twist].name}: ${TWISTS[o.twist].rule}`) : '',
    st.cfg.mods.length ? h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' }, ...st.cfg.mods.map((m) => h('span', { style: 'padding:3px 10px;border-radius:999px;background:#2A1A12;color:#F3E6CF;font-size:13px;font-weight:800' }, MODS.find((x) => x.id === m)!.name))) : '',
    timerBar(),
  );
}

/** how to play the order's mini games: each one's looping demo (the glove showing where and when) */
function howTo(games: GameId[]): HTMLElement {
  const w = games.length > 1 ? 380 : 440;
  return h(
    'div.howto',
    h('div.howto-head', 'How to play'),
    ...games.map((g) => h('div.col', { style: 'gap:6px' }, demoCanvas(g, w), h('div.howto-cap', h('b', { style: `color:${GAMES[g].color}` }, GAMES[g].name), ' ', GAMES[g].how))),
  );
}

function nextGameBanner(st: MatchState): HTMLElement {
  const g = currentGame(st);
  return h('div.col.pop', { style: 'align-items:center;gap:16px' }, h('span.tag', { style: 'font-size:18px' }, 'Then'), gameChip(g, true), howTo([g]), timerBar('#F2A541', false));
}

function thirteenthAsk(st: MatchState, mine: number): HTMLElement {
  const bi = myBakery(st);
  const b = st.bakeries[bi]!;
  const o = order(st);
  const short = o.need - b.tray;
  const can = mine >= 0 && canClaim(st, mine);
  const want = st.claims.includes(mine);
  const decided = st.done.includes(mine);
  const msg = o.twist === 'nothirteenth' ? 'No 13th loaf' : short <= 0 ? 'Full · bonus ★' : short === 1 ? '1 short · the 13th saves it' : `${short} short`;
  const claimants = st.claims.filter((s) => bakeryOf(st, s) === bi);
  return h(
    'div',
    { style: 'position:absolute;left:50%;top:345px;transform:translateX(-50%);width:880px' },
    h(
      'div.thirteenth-ask.parchment.pop',
      h('div', { style: 'text-align:center;min-width:150px' }, h('div.display', { style: `font-size:48px;color:${short <= 0 ? '#5E9A58' : short === 1 ? '#C47A1E' : '#A8322D'}` }, `${b.tray} / ${o.need}`), h('div', { style: 'font-weight:900;color:#6B4A33' }, 'on the tray')),
      h(
        'div.col',
        { style: 'flex:1;gap:8px' },
        h('div', { style: 'font-weight:900;font-size:20px' }, msg),
        h(
          'div.row',
          { style: 'gap:10px' },
          h(
            `button.big${want ? '.on' : '.gold'}`,
            {
              disabled: !can,
              onclick: () => {
                C?.client.send({ t: 'claim', v: true });
                audio.sfx('select');
              },
            },
            svg(LOAF13(30)),
            want ? ' Baking it' : ` Bake the 13th · 1 Saffron → +${BAL.thirteenthStars} ★`,
          ),
          h(
            `button.big${decided && !want ? '.on' : ''}`,
            {
              disabled: !can,
              onclick: () => {
                C?.client.send({ t: 'claim', v: false });
                audio.sfx('back');
              },
            },
            'Pass',
          ),
        ),
        h('div.row', { style: 'gap:8px;min-height:40px' }, claimants.length ? h('span', { style: 'font-weight:800;color:#6B4A33' }, 'Wants it:') : h('span', { style: 'font-weight:800;color:#6B4A33' }, can ? 'Fewest 13th loaves first' : st.players[mine]?.saffron ? '' : 'No Saffron'), ...claimants.map((s) => svg(portrait(st.seats[s]!.baker, 40, st.seats[s]!.cosmetics)))),
      ),
      h('div', { style: 'width:160px' }, timerBar()),
    ),
  );
}

function verdictStamp(st: MatchState): HTMLElement {
  const bi = myBakery(st);
  const b = st.bakeries[bi]!;
  const evs = st.events.filter((e) => e.v === bi && ['filled', 'fine', 'bribed', 'closed'].includes(e.k));
  const last = evs[evs.length - 1]?.k ?? 'filled';
  const map: Record<string, [string, string]> = { filled: ['Filled', '#5E9A58'], fine: ['Fined', '#A8322D'], bribed: ['Bribed', '#E8B84A'], closed: ['Closed', '#A8322D'] };
  const [label, color] = b.closed ? map.closed! : map[last]!;
  const rival = st.bakeries.length === 2 ? st.bakeries[1 - bi] : null;
  return h(
    'div',
    { style: 'position:absolute;left:50%;top:330px;transform:translateX(-50%);display:flex;gap:16px;align-items:center' },
    h('div.pop', { style: `font-family:var(--display);font-size:64px;font-weight:900;color:${color};padding:4px 28px;border:6px solid ${color};border-radius:12px;background:rgba(243,227,195,0.95);transform:rotate(-6deg);box-shadow:0 8px 0 rgba(0,0,0,0.3)` }, label),
    rival ? h('span.pill', { style: 'font-size:18px' }, `Rivals: ${rival.closed ? 'Closed' : rival.tray + (rival.thirteenth >= 0 ? 1 : 0) >= order(st).need ? 'Filled' : 'Fined'}`) : '',
  );
}

// ------------------------------------------------------------------ the market

function marketBox(st: MatchState, mine: number): HTMLElement {
  const p = st.players[mine];
  if (!p) return h('div');
  const done = st.done.includes(mine);
  const open = seatOpen(st, mine);
  const next = st.orders[st.round + 1];
  const steph = st.seats[mine]!.baker === 'stephanie';
  const items = st.cart.map((it, i) => {
    const d = BUFFS[it.buff];
    const price = priceFor(st, mine, it);
    const kind = d.kind;
    const bi = bakeryOf(st, mine);
    let action: HTMLElement;
    let extra: HTMLElement | string = '';
    if (kind === 'team') {
      const paid = it.pool[bi] ?? 0;
      const left = it.price - paid;
      extra = h('div.col', { style: 'gap:4px' }, h('div.pool', h('i', { style: `width:${Math.round((paid / it.price) * 100)}%` })), h('div', { style: 'font-size:14px;font-weight:800' }, left <= 0 ? 'Bought for the bakery' : `${paid} / ${it.price} pooled${it.by[mine] ? ` · you: ${it.by[mine]}` : ''}`));
      action =
        left <= 0
          ? h('button.tiny', { disabled: true }, 'Bought')
          : h(
              'div.row',
              { style: 'gap:6px' },
              h('button.tiny.primary', { disabled: !open || p.tips < 1, onclick: () => buyIt(i, Math.min(2, left)) }, '+2'),
              h('button.tiny.primary', { disabled: !open || p.tips < 1, onclick: () => buyIt(i, Math.min(left, p.tips)) }, p.tips >= left ? `All ${left}` : `+${p.tips}`),
            );
    } else if (kind === 'rare') {
      const sold = it.soldTo >= 0;
      action = h('button.tiny.primary', { disabled: sold || p.tips < price || (!open && !d.sabotage), onclick: () => rareBuy(st, i, it.buff) }, sold ? `Sold to ${st.seats[it.soldTo]?.name ?? ''}` : 'Buy');
    } else if (kind === 'staple') {
      action = h('button.tiny.primary', { disabled: !open || p.tips < price || p.saffron >= 5, onclick: () => buyIt(i) }, 'Buy');
    } else {
      const have = p.buffs.includes(it.buff);
      action = h('button.tiny.primary', { disabled: !open || have || p.tips < price, onclick: () => buyIt(i) }, have ? 'Owned' : 'Buy');
    }
    const discount = kind !== 'team' && price < it.price;
    return h(
      `div.cart-item.${kind}${(kind === 'rare' && it.soldTo >= 0) || (kind === 'personal' && p.buffs.includes(it.buff)) ? '.sold' : ''}`,
      h('div.row', { style: 'justify-content:space-between' }, h('span.kind', kind === 'team' ? (st.cfg.style === 'ffa' ? 'Bakery' : 'Team · pooled') : kind === 'rare' ? (d.sabotage ? 'Rare · sabotage' : 'Rare') : kind === 'staple' ? 'Ingredient' : 'Personal'), svg(it.buff === 'saffron' ? SAFFRON(28) : buffIcon(d.color, 26))),
      h('h3', d.name),
      h('div.eff', d.effect),
      extra,
      h('div.row', { style: 'justify-content:space-between' }, kind === 'team' ? h('span.price', svg(TIP(20)), `${it.price}`) : h('span.price', svg(TIP(20)), discount ? h('s', `${it.price}`) : '', `${price}`), action),
    );
  });
  const held = (['salt', 'flour'] as const).filter((k) => p.buffs.includes(k));
  const who = st.seats.map((s, i) => (st.done.includes(i) ? h('span', { title: s.name, style: 'opacity:1' }, svg(portrait(s.baker, 34, s.cosmetics))) : h('span', { title: s.name, style: 'opacity:0.35' }, svg(portrait(s.baker, 34, s.cosmetics)))));
  return h(
    'div.market.parchment',
    { style: 'margin-top:-20px' },
    h(
      'div.row',
      { style: 'margin-bottom:14px' },
      h('h2.grow', { style: 'font-size:38px' }, 'The peddler’s cart'),
      isLastPlace(st, mine) ? h('span.pill', { style: 'background:#5E9A58;color:#FFF;border-color:#1E120C' }, 'Catch-up: 25% off') : '',
      st.seats[mine]!.baker === 'pip' ? h('span.pill', { style: 'background:#5E9A58;color:#FFF;border-color:#1E120C' }, 'Pip: 20% off') : '',
      h('span.chip', svg(TIP(22)), `${p.tips}`),
      h('span.chip', svg(SAFFRON(22)), `${p.saffron}`),
      h('div', { style: 'width:200px' }, timerBar('#A8322D')),
    ),
    h('div.cart', { style: `grid-template-columns:repeat(${st.cart.length},1fr)` }, ...items),
    h(
      'div.row',
      { style: 'margin-top:16px;gap:14px' },
      steph && next ? h('div.row', { style: 'gap:8px;padding:6px 12px;border-radius:12px;background:#2A1A12;color:#FFF4E0' }, h('span', { style: 'font-weight:900' }, 'Next order:'), ...next.games.map((g) => gameChip(g)), next.rush ? h('span.stamp', 'Rush') : '', next.twist ? h('span.pill', TWISTS[next.twist].name) : '') : '',
      ...held.map((k) => h('button.wax', { onclick: () => pickTarget(st, (t) => throwIt(st, k, t)) }, `Throw your ${BUFFS[k].name}`)),
      h('div.grow'),
      h('div.row', { style: 'gap:4px' }, ...who),
      h(`button.big${done ? '' : '.primary'}`, { onclick: () => C?.client.send({ t: 'done', v: !done }) }, done ? 'Waiting · back' : 'Done'),
    ),
  );
}

function buyIt(item: number, amount?: number): void {
  C?.client.send({ t: 'buy', m: { item, amount } });
}

function markSalt(st: MatchState, target: number): void {
  // Salt in the Wound: sabotage the leader going into the final order
  if (st.round === st.orders.length - 2 && isLeader(st, target)) C!.extras.saltLeader = true;
}

function rareBuy(st: MatchState, item: number, buff: BuffId): void {
  if (buff === 'recipe') {
    const close = modal(
      h(
        'div.col',
        { style: 'width:640px' },
        h('h2', 'Secret Family Recipe'),
        h('div', { style: 'font-weight:800' }, 'Double the ★ from your next game of:'),
        h(
          'div',
          { style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:10px' },
          ...MINI_IDS.map((g) =>
            h('button', { onclick: () => (close(), C?.client.send({ t: 'buy', m: { item, game: g as MiniId } })) }, svg(lineIcon(GAME_ICONS[g]!, 24, GAMES[g].color)), ` ${GAMES[g].name}`),
          ),
        ),
      ),
    );
    return;
  }
  pickTarget(st, (t) => {
    markSalt(st, t);
    C?.client.send({ t: 'buy', m: { item, target: t } });
  });
}

function throwIt(st: MatchState, kind: 'salt' | 'flour', target: number): void {
  markSalt(st, target);
  C?.client.send({ t: 'throw', kind, target });
}

function pickTarget(st: MatchState, done: (seat: number) => void): void {
  const mine = me();
  const rivals = st.seats.map((_, i) => i).filter((i) => i !== mine && seatOpen(st, i) && !(st.cfg.style === 'teams' && st.seats[i]!.team === st.seats[mine]!.team));
  const close = modal(
    h(
      'div.col',
      { style: 'width:700px' },
      h('h2', 'Pick a rival'),
      h(
        'div.row',
        { style: 'gap:14px;flex-wrap:wrap' },
        ...rivals.map((i) =>
          h(
            'button',
            { style: 'display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px', onclick: () => (close(), done(i)) },
            svg(portrait(st.seats[i]!.baker, 90, st.seats[i]!.cosmetics)),
            h('b', st.seats[i]!.name),
            h('span', `${st.players[i]!.stars} ★`),
          ),
        ),
      ),
    ),
  );
}

// ------------------------------------------------------------------ dawn and the results

function dawnVerdict(st: MatchState): HTMLElement {
  const bi = myBakery(st);
  const ok = !st.bakeries[bi]!.closed;
  const early = st.endEarly && st.round < st.orders.length - 1;
  return h(
    'div.big-order.parchment.torn',
    { style: 'width:640px;align-items:center;text-align:center' },
    h('span.tag', early ? 'The Inspector' : 'Dawn'),
    h('h2', { style: 'font-size:52px' }, ok ? 'The bakery passes' : 'The bakery is closed'),
    svg(ok ? `<svg width="140" height="140" viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="27" fill="#E8B84A" stroke="#1E120C" stroke-width="2"/><circle cx="30" cy="30" r="20" fill="none" stroke="#B9862C" stroke-width="3"/><path d="M18 24 L22 34 L30 26 L38 34 L42 24 L40 38 L20 38 Z" fill="#FFF1C9" stroke="#1E120C" stroke-width="1.6" stroke-linejoin="round"/></svg>` : sealSVG(true, 140)),
    st.bakeries.length > 1 ? h('div', { style: 'font-weight:800' }, st.bakeries.map((b, i) => `${i === bi ? 'Yours' : st.cfg.style === 'teams' ? 'Rivals' : st.seats[b.members[0]!]?.name}: ${b.closed ? 'closed' : 'passes'}`).join(' · ')) : '',
  );
}

function record(st: MatchState): Unlocks {
  const mine = me();
  if (mine < 0) return { achievements: [], cosmetics: [] };
  const u = recordNight(session.profile, st, mine, C!.extras);
  void saveNow();
  if (st.cfg.daily && session.online) void api.postDaily(st.cfg.daily, dailyScore(st, mine), st.seats[mine]!.baker, !!st.over?.survived[bakeryOf(st, mine)]).catch(() => {});
  if (u.achievements.length) setTimeout(() => audio.sfx('achievement'), 1200);
  return u;
}

function results(st: MatchState): HTMLElement {
  const c = C!;
  const over = st.over!;
  const mine = me();
  const won = mine >= 0 && seatWon(st, mine);
  const survivedAny = over.survived.some(Boolean);
  setTimeout(() => audio.sfx(won || (st.cfg.style === 'coop' && survivedAny) ? 'win' : survivedAny ? 'filled' : 'lose'), 400);
  const rank = over.ranking;
  const heights = [200, 150, 110, 80];
  const colors = ['#E8B84A', '#C9CFD8', '#C8904E', '#8A7A66'];
  const podium = h(
    'div.podium',
    ...[1, 0, 2, 3]
      .filter((k) => k < rank.length)
      .map((k) => {
        const s = rank[k]!;
        const seat = st.seats[s]!;
        const surv = over.survived[bakeryOf(st, s)];
        return h(
          'div.place',
          { style: `animation-delay:${0.15 * k}s` },
          svg(portrait(seat.baker, k === 0 ? 110 : 84, seat.cosmetics, { mood: surv ? (k === 0 ? 'wow' : 'happy') : 'sad' })),
          h('b', { style: 'font-size:18px' }, s === mine ? 'You' : seat.name),
          h('span.chip', svg(STAR(20)), `${over.finalStars[s]}`),
          svg(rollingPin(seat.cosmetics.pin, 90)),
          h('div.block', { style: `height:${heights[k]}px;background:${surv ? colors[k] : '#5A4A40'}` }, `${k + 1}`),
        );
      }),
  );
  const title =
    st.cfg.style === 'coop'
      ? survivedAny
        ? `The bakery survives${over.medal ? ` · ${over.medal} medal` : ''}`
        : 'The Inspector closed the bakery'
      : !survivedAny
        ? 'Everyone loses: the bakery closed'
        : won
          ? 'You win the night'
          : st.cfg.style === 'teams'
            ? `${over.winnerTeam === 1 ? 'Team Blue' : 'Team Red'} wins`
            : `${st.seats[rank[0]!]!.name} wins the night`;
  const stats: [string, (i: number) => number][] = [
    ['★', (i) => over.finalStars[i]!],
    ['Tips earned', (i) => st.players[i]!.stats.tipsEarned],
    ['13th loaves', (i) => st.players[i]!.loaves13],
    ['Perfect bakes', (i) => st.players[i]!.stats.perfect],
    ['Perfect pulls', (i) => st.players[i]!.stats.perfectPulls],
    ['Oven rescues', (i) => st.players[i]!.stats.rescues],
    ['Sabotage', (i) => st.players[i]!.stats.sabotages],
  ];
  const grid = h('div.statgrid', { style: `grid-template-columns:140px repeat(${st.seats.length},1fr)` });
  grid.appendChild(h('span.h', ''));
  st.seats.forEach((s, i) => grid.appendChild(h('span.h', i === mine ? 'You' : BAKER[s.baker].name)));
  for (const [label, f] of stats) {
    grid.appendChild(h('span.dim', label));
    const vals = st.seats.map((_, i) => f(i));
    const best = Math.max(...vals);
    vals.forEach((v) => grid.appendChild(h(`span${v === best && v > 0 ? '.best' : ''}`, `${v}`)));
  }
  const pens = over.penalties.map((p) => h('div', { style: 'font-weight:800;color:#F2A08C' }, `${p.seat === mine ? 'You' : st.seats[p.seat]!.name}: ${p.kind === 'freeloader' ? 'never baked a 13th loaf, half ★ lost' : 'never chipped in for the team'} (−${p.stars} ★)`));
  const unl = c.recorded ?? { achievements: [], cosmetics: [] };
  const unlocks = [...unl.achievements.map((id) => `Achievement: ${ACHIEVEMENTS.find((a) => a.id === id)?.title}`), ...unl.cosmetics.map((id) => `Unlocked: ${COSMETIC[id]?.name}`)];
  const buttons: HTMLElement[] = [];
  if (c.mode === 'solo') {
    buttons.push(h('button.primary.big', { onclick: () => again() }, 'Bake again'));
    if (st.cfg.night !== null && over.survived[bakeryOf(st, mine)] && st.cfg.night < 13) buttons.push(h('button.gold.big', { onclick: () => (stopNight(), void import('./lobby').then((l) => l.campaignScreen())) }, `Night ${st.cfg.night + 1}`));
  }
  if (c.mode === 'host') buttons.push(h('button.primary.big', { onclick: () => (stopNight(), void import('./lobby').then((l) => l.hostBackToLobby())) }, 'Back to the lobby'));
  if (c.mode === 'guest') buttons.push(h('div.dim', { style: 'font-weight:800' }, 'The host takes everyone back to the lobby.'));
  buttons.push(h('button.big', { onclick: () => exitToMenu() }, c.mode === 'solo' ? 'Menu' : 'Leave'));
  return h(
    'div.parchment',
    { style: 'width:1300px;max-height:770px;overflow:auto;padding:22px 30px;border-radius:18px;border:3px solid #1E120C;display:flex;flex-direction:column;gap:14px' },
    h('div.row', h('h2.grow', { style: 'font-size:44px' }, title), h('span.tag', `${STYLES.find((x) => x.id === st.cfg.style)!.name} · ${st.orders.length} orders${st.cfg.daily ? ` · daily ${dailyScore(st, mine)}` : ''}`)),
    h('div.row', { style: 'align-items:flex-end;gap:30px' }, h('div', { style: 'flex:1' }, podium), h('div.col', { style: 'width:520px;gap:8px' }, h('div', { style: 'background:#2A1A12;border-radius:14px;padding:14px;color:#FFF4E0' }, grid), ...pens, ...unlocks.map((u) => h('div.pop', { style: 'font-weight:900;color:#8A5A35' }, u)))),
    h('div.row', { style: 'gap:14px;justify-content:flex-end' }, ...buttons),
  );
}

function again(): void {
  const lobby = C?.lobby;
  stopNight();
  void import('./lobby').then((l) => {
    if (lobby) {
      l.setLobby(lobby);
      l.lobbyScreen();
    } else l.soloLobby();
  });
}

function exitToMenu(): void {
  const mode = C?.mode;
  stopNight();
  if (mode === 'host' || mode === 'guest') void import('./lobby').then((l) => l.leaveOnline());
  else mainMenu();
}

function leaveConfirm(): void {
  const c = C;
  if (!c) return;
  if (c.client.st?.phase === 'over') return exitToMenu();
  const close = modal(
    h(
      'div.col',
      { style: 'width:460px' },
      h('h2', 'Leave the bakery?'),
      h('div', { style: 'font-weight:700' }, c.mode === 'solo' ? 'The night ends and nothing is saved.' : c.mode === 'host' ? 'You are the host: the night ends for everyone.' : 'An AI rival takes over your station.'),
      h('div.row', h('button.wax', { onclick: () => (close(), HostMatch.clearSaved('solo'), exitToMenu()) }, 'Leave'), h('button', { onclick: () => close() }, 'Stay')),
    ),
  );
}

void save;
void sprite;
