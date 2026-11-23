// Play: solo nights, the 13-night campaign, the daily challenge and online lobbies. The lobby is the baker select
// from the mockups (3×2 portrait grid, a detail panel with perk, weakness and loaf-icon skills, four player slots)
// plus the rules: style, length, AI level, mini game length and modifiers. Online, the host owns the lobby and sends
// it to everyone.
import { mainMenu, show } from '../app';
import { audio } from '../audio/audio';
import { BAKER, BAKERS, COSMETIC, COSMETICS, DEFAULT_COSMETICS, GAMES, LENGTHS, MINI_IDS, MODS, PACES, STYLES } from '../game/data';
import { HostMatch } from '../game/match';
import { cosmeticsFor, today } from '../game/profile';
import { hash } from '../game/rng';
import { newMatch } from '../game/rules';
import { save, session } from '../game/session';
import type { AiLevel, BakerId, Cosmetics, GameId, Length, MatchCfg, ModId, Pace, Seat, Style } from '../game/types';
import { api, type FriendsView } from '../net/api';
import { Net, type RoomView } from '../net/socket';
import { GAME_ICONS, LOAF13, itemSVG, lineIcon } from '../render/art';
import { portrait, rollingPin } from '../render/portraits';
import { h, keypad, modal, svg, toast } from './dom';
import { friendRows, friendsModal } from './friends';
import { ambient } from './scene';

type Mode = 'solo' | 'online' | 'campaign' | 'daily';

interface LSeat {
  kind: 'human' | 'ai' | 'open';
  id: string;
  name: string;
  baker: BakerId | null;
  ready: boolean;
  team: number;
  level: AiLevel;
  cosmetics: Cosmetics;
  online: boolean;
}

export interface LState {
  code: string | null;
  host: string;
  seats: LSeat[];
  style: Style;
  length: Length;
  /** mini game length (campaign and daily stay normal); a lobby saved before it existed has none */
  pace?: Pace;
  mods: ModId[];
  aiLevel: AiLevel;
  mode: Mode;
  night: number | null;
  daily: string | null;
}

let L: LState | null = null;
let net: Net | null = null;
let offs: (() => void)[] = [];
let inLobbyScreen = false;
let rerender: (() => void) | null = null;

const me = (): string => (session.online ? session.user!.id : 'local');
const isHost = (): boolean => !!L && L.host === me();
const mySeat = (): LSeat | undefined => L?.seats.find((s) => s.kind === 'human' && s.id === me());

function emptySeat(team = 0): LSeat {
  return { kind: 'open', id: '', name: '', baker: null, ready: false, team, level: 2, cosmetics: { ...DEFAULT_COSMETICS }, online: true };
}

function freeBaker(skip: BakerId[] = []): BakerId {
  const taken = new Set([...(L?.seats.map((s) => s.baker).filter(Boolean) as BakerId[]), ...skip]);
  return BAKERS.find((b) => !taken.has(b.id))?.id ?? 'pip';
}

function aiSeat(team: number, level: AiLevel): LSeat {
  const baker = freeBaker();
  return { kind: 'ai', id: '', name: BAKER[baker].name, baker, ready: true, team, level, cosmetics: { ...DEFAULT_COSMETICS }, online: true };
}

function humanSeat(id: string, name: string, team = 0): LSeat {
  const fav = session.profile.lastBaker;
  const baker = id === me() && !L?.seats.some((s) => s.baker === fav) ? fav : freeBaker();
  return { kind: 'human', id, name, baker, ready: false, team, level: 2, cosmetics: id === me() ? cosmeticsFor(session.profile, baker) : { ...DEFAULT_COSMETICS }, online: true };
}

function newLobby(mode: Mode, extra: Partial<LState> = {}): LState {
  const st: LState = { code: null, host: me(), seats: [], style: 'coopetition', length: 'full', pace: 'normal', mods: [], aiLevel: 2, mode, night: null, daily: null, ...extra };
  L = st;
  st.seats = [humanSeat(me(), session.user?.name ?? 'You', 0), emptySeat(0), emptySeat(1), emptySeat(1)];
  if (mode !== 'online') for (let i = 1; i < 4; i++) st.seats[i] = aiSeat(i < 2 ? 0 : 1, st.aiLevel);
  return st;
}

// ------------------------------------------------------------------ the play menu

function modeCard(title: string, blurb: string, icon: string, onclick: () => void, accent = '#F2A541', extra?: HTMLElement): HTMLElement {
  return h(
    'button',
    {
      type: 'button',
      onclick: () => (audio.sfx('select'), onclick()),
      onmouseenter: () => audio.sfx('hover'),
      style: `display:flex;flex-direction:column;align-items:flex-start;gap:10px;text-align:left;padding:22px;min-height:250px;border-radius:20px;background:#3A2419;border:4px solid #5A3A22;outline:2px solid #1E120C;box-shadow:0 8px 0 #1E120C`,
    },
    h('span', { style: `width:64px;height:64px;border-radius:50%;background:#2A1A12;border:3px solid ${accent};display:flex;align-items:center;justify-content:center` }, svg(lineIcon(icon, 34, accent, 2.2))),
    h('span.display', { style: 'font-size:32px' }, title),
    h('span', { style: 'font-size:17px;font-weight:700;color:#F3E6CF;line-height:1.35' }, blurb),
    extra ?? '',
  );
}

export function playMenu(): void {
  audio.music('menu');
  show((root) => {
    const p = session.profile;
    root.appendChild(h('div.wall'));
    root.appendChild(ambient([[24, 120], [1418, 120]], 6));
    const camp = Math.min(13, p.campaign.next);
    const dailyBest = p.daily.best[today()];
    root.appendChild(
      h(
        'div.screen',
        h('div.row', h('button', { onclick: () => mainMenu() }, '◀ Menu'), h('h2.grow', { style: 'font-size:44px' }, 'Play')),
        h(
          'div',
          { style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:22px;margin-top:20px' },
          modeCard('Solo night', 'You and up to three AI rivals. Pick the style, the length and the modifiers.', GAME_ICONS.oven!, () => soloLobby()),
          modeCard('With friends', session.online ? 'Up to four bakers online. Open a lobby, invite friends, fill empty seats with AI.' : 'Sign in to bake with friends online.', 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 11a3 3 0 1 0 0-6M21 20a6 6 0 0 0-4-5.6', () => onlineHome(), '#93D3D2'),
          modeCard('Campaign', `Thirteen nights, the Inspector stricter every one. Night ${camp} of 13.${p.campaign.next > 13 ? ' Finished.' : ''}`, GAME_ICONS.dawn!, () => campaignScreen(), '#E8B84A'),
          modeCard('Daily challenge', `The same Quick Shift for everyone today.${dailyBest !== undefined ? ` Your best: ${dailyBest}.` : ''}`, 'M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM9 14l2 2 4-4', () => dailyScreen(), '#C3B0F0'),
        ),
        h('div.small.dim', { style: 'margin-top:auto' }, 'Every style: co-opetition (shared tray, most ★ wins), co-op (one team score), free-for-all (your own tray) and 2v2 rival bakeries.'),
      ),
    );
  });
}

export function soloLobby(): void {
  newLobby('solo');
  lobbyScreen();
}

// ------------------------------------------------------------------ campaign

const RECIPES = ['Croissants', 'Honey Buns', 'Pretzels', 'Rye Loaves', 'Sourdough', 'Baguettes', 'Plum Tarts', 'Shortbread', 'Cinnamon Rolls', 'Meat Pies', 'Bagels', 'Saffron Buns', 'The Dawn Loaf'];

export function campaignScreen(): void {
  show((root) => {
    const p = session.profile;
    root.appendChild(h('div.wall'));
    const nights = h('div', { style: 'display:grid;grid-template-columns:repeat(7,1fr);gap:14px' });
    for (let n = 1; n <= 13; n++) {
      const open = n <= p.campaign.next;
      const best = p.campaign.best[n];
      const icon = itemSVG(n === 13 ? 'boule' : (['croissant', 'bun', 'pretzel', 'loaf', 'boule', 'baguette', 'tart', 'cookie', 'roll', 'pie', 'bagel', 'bun'][n - 1] ?? 'loaf'), 64, n === 13);
      nights.appendChild(
        h(
          'button',
          {
            type: 'button',
            disabled: !open,
            onclick: () => startCampaign(n),
            style: `display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 8px;min-height:170px;border-radius:16px;background:${best ? '#44291C' : '#33201A'};border:3px solid ${n === p.campaign.next ? '#F2A541' : '#5A3A22'};outline:2px solid #1E120C`,
          },
          h('span.tag', `Night ${n}`),
          open ? svg(icon) : svg(lineIcon('M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5zM12 15v2', 40, '#9A8A7A')),
          h('span', { style: 'font-size:14px;font-weight:800;color:#F3E6CF' }, best ? RECIPES[n - 1] : open ? (n === 13 ? 'Full Dozen' : 'Quick Shift') : 'Locked'),
          best ? h('span', { style: 'font-size:14px;font-weight:900;color:#E8B84A' }, `${best.stars} ★${best.medal ? ` · ${best.medal}` : ''}`) : '',
        ),
      );
    }
    root.appendChild(
      h(
        'div.screen',
        h('div.row', h('button', { onclick: () => playMenu() }, '◀ Play'), h('h2.grow', { style: 'font-size:44px' }, 'Campaign'), h('span.dim', 'Recipe book: ', h('b', `${Object.keys(p.campaign.best).length} / 13`))),
        h(
          'div.parchment.torn',
          { style: 'padding:22px 26px;border-radius:6px' },
          h('div', { style: 'font-weight:800;font-size:17px;line-height:1.5' }, 'You run the bakery against greedy AI rivals who leave the 13th loaves to you. Every night the Inspector gets stricter: more twists, smarter rivals, no starting Saffron from night 8, two seals from night 11. Survive a night to add its recipe to your book.'),
        ),
        nights,
      ),
    );
  });
}

function startCampaign(n: number): void {
  newLobby('campaign', { night: n, style: 'coopetition', length: n === 13 ? 'full' : 'quick', aiLevel: n <= 4 ? 1 : n <= 9 ? 2 : 3 });
  const lvl = L!.aiLevel;
  for (const s of L!.seats) if (s.kind === 'ai') s.level = lvl;
  lobbyScreen();
}

// ------------------------------------------------------------------ daily challenge

export function dailyCfg(date: string): { mods: ModId[]; seed: number } {
  const seed = hash(`bd-daily-${date}`);
  const pool = MODS.map((m) => m.id).filter((m) => m !== 'doubleshift');
  const a = pool[seed % pool.length]!;
  const b = pool[(Math.floor(seed / 97) + 3) % pool.length]!;
  return { mods: a === b ? [a] : [a, b], seed };
}

export function dailyScreen(): void {
  show((root) => {
    const date = today();
    const d = dailyCfg(date);
    const p = session.profile;
    const board = h('div.col', h('div.dim', session.online ? 'Loading your friends’ scores…' : 'Sign in to compare with friends.'));
    root.appendChild(h('div.wall'));
    root.appendChild(
      h(
        'div.screen',
        h('div.row', h('button', { onclick: () => playMenu() }, '◀ Play'), h('h2.grow', { style: 'font-size:44px' }, 'Daily challenge'), h('span.chip', date)),
        h(
          'div.row',
          { style: 'align-items:stretch;gap:24px' },
          h(
            'div.parchment.col',
            { style: 'flex:1;padding:24px;border-radius:16px;border:3px solid #1E120C' },
            h('h3', { style: 'font-size:28px' }, 'Today’s shift'),
            h('div', { style: 'font-weight:800' }, 'Quick Shift · co-opetition · three AI rivals'),
            h('div.col', { style: 'gap:8px' }, ...d.mods.map((m) => h('div.mod.on', { style: 'cursor:default' }, h('div', h('b', MODS.find((x) => x.id === m)!.name), h('small', MODS.find((x) => x.id === m)!.rule))))),
            h('div', { style: 'font-weight:800' }, 'Score: your ★ at dawn, +25 if the bakery survives.'),
            h('div', { style: 'font-weight:900;font-size:22px' }, `Your best today: ${p.daily.best[date] ?? '—'}`),
            h('button.primary.big', { onclick: () => startDaily() }, 'Choose your baker'),
          ),
          h('div.panel.col', { style: 'width:520px' }, h('h3', { style: 'font-size:26px' }, 'Friends today'), board),
        ),
      ),
    );
    if (session.online)
      void api
        .daily(date)
        .then((r) => {
          board.replaceChildren(
            ...(r.rows.length
              ? r.rows.map((row, i) =>
                  h('div.row', { style: `padding:8px 10px;border-radius:10px;background:${row.me ? 'rgba(242,165,65,0.2)' : 'rgba(0,0,0,0.2)'}` }, h('b', { style: 'width:30px' }, `${i + 1}`), svg(portrait((BAKER[row.baker as BakerId] ? row.baker : 'pip') as BakerId, 40)), h('b.grow', row.name), h('span.display', { style: 'font-size:24px' }, `${row.score}`)),
                )
              : [h('div.dim', 'Nobody has baked today’s shift yet.')]),
          );
        })
        .catch((e: Error) => board.replaceChildren(h('div.dim', e.message)));
  });
}

function startDaily(): void {
  const date = today();
  const d = dailyCfg(date);
  newLobby('daily', { daily: date, style: 'coopetition', length: 'quick', mods: d.mods, aiLevel: 2 });
  // the same rivals for everyone
  const rivals: BakerId[] = BAKERS.map((b) => b.id).sort((a, b) => hash(date + a) - hash(date + b));
  L!.seats.forEach((s, i) => {
    if (s.kind === 'ai') {
      s.baker = rivals.find((r) => !L!.seats.some((x) => x !== s && x.baker === r)) ?? s.baker;
      s.name = BAKER[s.baker!].name;
      void i;
    }
  });
  lobbyScreen();
}

// ------------------------------------------------------------------ online

export async function onlineHome(): Promise<void> {
  if (!session.online) {
    modal(h('div.col', { style: 'width:440px' }, h('h2', 'Sign in to play online'), h('p', 'Lobbies and friends need an account (the same one as Shoallhell). Offline progress stays on this device.'), h('button.primary', { onclick: () => void import('../app').then((a) => a.doSignOut()) }, 'Sign in')));
    return;
  }
  show((root) => {
    root.appendChild(h('div.wall'));
    root.appendChild(h('div.screen', h('div.row', h('button', { onclick: () => playMenu() }, '◀ Play'), h('h2', 'With friends')), h('div.panel', 'Opening the shutters…')));
  });
  try {
    net = await Net.shared();
  } catch (e) {
    toast((e as Error).message, 'bad');
    playMenu();
    return;
  }
  show((root) => {
    const code = h('input', { type: 'text', placeholder: '4-digit code', maxlength: '5', inputmode: 'numeric', 'aria-label': 'Lobby code', style: 'width:200px;font-size:28px;text-align:center;letter-spacing:6px' }) as HTMLInputElement;
    const list = h('div.col');
    root.appendChild(h('div.wall'));
    root.appendChild(
      h(
        'div.screen',
        h('div.row', h('button', { onclick: () => playMenu() }, '◀ Play'), h('h2.grow', { style: 'font-size:44px' }, 'With friends'), h('button', { onclick: () => friendsModal(false, (c) => void joinOnline(c)) }, 'Manage friends')),
        h(
          'div.row',
          { style: 'align-items:stretch;gap:24px' },
          h(
            'div.parchment.col',
            { style: 'flex:1;padding:24px;border-radius:16px;border:3px solid #1E120C' },
            h('h3', { style: 'font-size:28px' }, 'Open a bakery'),
            h('div', { style: 'font-weight:700' }, 'Up to four bakers. You set the rules; friends join with your code, an invite or from their friends list. Empty seats can be AI rivals.'),
            h('button.primary.big', { onclick: () => void createOnline() }, 'Open a lobby'),
            h('h3', { style: 'font-size:28px;margin-top:10px' }, 'Join with a code'),
            h('div.row', code, h('button.gold.big', { onclick: () => void joinOnline(code.value.trim()) }, 'Join')),
            keypad(code, () => void joinOnline(code.value.trim())),
          ),
          h('div.panel.col', { style: 'width:560px;max-height:620px;overflow:auto' }, h('h3', { style: 'font-size:26px' }, 'Friends'), list),
        ),
      ),
    );
    code.addEventListener('keydown', (e) => e.key === 'Enter' && void joinOnline(code.value.trim()));
    const fill = async (): Promise<void> => {
      try {
        const v: FriendsView = await api.friends();
        list.replaceChildren(h('div', 'Your friend code: ', h('b.display', { style: 'font-size:26px;letter-spacing:3px' }, v.code)), ...friendRows(v, { onJoin: (c) => void joinOnline(c) }));
      } catch (e) {
        list.replaceChildren(h('div.dim', (e as Error).message));
      }
    };
    void fill();
    return net!.on('friends', () => void fill());
  });
}

/** a night is running for this lobby (the lobby's own messages stand down; night.ts owns the socket traffic) */
let nightOn = false;
export function setNightOn(v: boolean): void {
  nightOn = v;
}

function wireNet(): void {
  for (const f of offs) f();
  offs = [];
  const n = net!;
  offs.push(
    n.on('room', (r: RoomView) => {
      if (!L) return;
      if (isHost()) {
        syncMembers(r);
        if (!nightOn) broadcast();
      } else for (const s of L.seats) if (s.kind === 'human') s.online = r.players.find((p) => p.userId === s.id)?.online ?? s.online;
      if (inLobbyScreen) rerender?.();
    }),
    n.on('closed', (m: { reason: string }) => {
      toast(m.reason || 'The bakery closed.', 'bad');
      leaveOnline();
    }),
    // after a dropped connection the socket rejoins the room (socket.ts); say hello again
    n.on('rejoined', () => {
      if (L && !isHost()) n.guestSend({ t: 'hello' });
      if (L && isHost() && !nightOn) broadcast();
    }),
    n.on('hostmsg', (m: { t: string; s?: LState; back?: boolean; to?: string }) => {
      if (isHost()) return;
      if (m.t === 'lobby' && m.s) {
        // during a night only an explicit "back to the lobby" ends it for us
        if (nightOn && !m.back) return;
        L = m.s;
        if (nightOn) {
          nightOn = false;
          void import('./night').then((x) => x.backToLobbyFromHost());
        } else if (inLobbyScreen) rerender?.();
        else lobbyScreen();
      }
      if (m.t === 'go' && (!m.to || m.to === me()) && !nightOn && L) {
        nightOn = true;
        inLobbyScreen = false;
        void import('./night').then((x) => x.startGuest(n, L!));
      }
    }),
    n.on('guestmsg', (m: { from: string; msg: { t: string; baker?: BakerId; v?: boolean; cos?: Cosmetics } }) => {
      if (!L || !isHost() || !m.msg || typeof m.msg !== 'object') return;
      const t = m.msg.t;
      if (t === 'hello') {
        // someone (re)joining while the night runs goes straight to the table
        if (nightOn) n.hostSend({ t: 'go', to: m.from });
        else broadcast();
        return;
      }
      if (nightOn || (t !== 'pick' && t !== 'ready')) return;
      const s = L.seats.find((x) => x.kind === 'human' && x.id === m.from);
      if (!s) return;
      const b = m.msg.baker;
      if (t === 'pick' && typeof b === 'string' && Object.hasOwn(BAKER, b) && !L.seats.some((x) => x !== s && x.baker === b)) {
        s.baker = b;
        s.ready = false;
        if (m.msg.cos && typeof m.msg.cos === 'object') s.cosmetics = sanitizeCos(m.msg.cos);
      }
      if (t === 'ready') s.ready = !!m.msg.v;
      broadcast();
      if (inLobbyScreen) rerender?.();
    }),
  );
}

function sanitizeCos(c: Cosmetics): Cosmetics {
  const ok = (id: unknown, slot: string, fb: string): string => (typeof id === 'string' && Object.hasOwn(COSMETIC, id) && COSMETIC[id]!.slot === slot ? id : fb);
  return { apron: ok(c.apron, 'apron', DEFAULT_COSMETICS.apron), pin: ok(c.pin, 'pin', DEFAULT_COSMETICS.pin), badge: ok(c.badge, 'badge', DEFAULT_COSMETICS.badge) };
}

/** people the host removed from an empty seat (until they come back online) */
const removed = new Set<string>();

function syncMembers(r: RoomView): void {
  if (!L) return;
  const ids = r.players.map((p) => p.userId);
  // people who left on purpose free their seat
  L.seats = L.seats.map((s) => (s.kind === 'human' && !ids.includes(s.id) ? emptySeat(s.team) : s));
  for (const rp of r.players) {
    if (rp.online) removed.delete(rp.userId);
    if (removed.has(rp.userId)) continue;
    const s = L.seats.find((x) => x.kind === 'human' && x.id === rp.userId);
    if (s) {
      s.online = rp.online;
      continue;
    }
    if (nightOn) continue;
    let i = L.seats.findIndex((x) => x.kind === 'open');
    if (i < 0) i = L.seats.map((x) => x.kind).lastIndexOf('ai');
    if (i < 0) continue;
    const team = L.seats[i]!.team;
    L.seats[i] = { ...humanSeat(rp.userId, rp.name, team), baker: freeBaker() };
  }
}

function broadcast(back = false): void {
  if (L && isHost() && net) net.hostSend({ t: 'lobby', s: L, back });
}

async function createOnline(): Promise<void> {
  try {
    void import('./night').then((x) => x.stopNight());
    net = await Net.shared();
    const r = await net.create();
    nightOn = false;
    newLobby('online', { code: r.code });
    wireNet();
    remember({ role: 'host', code: r.code });
    lobbyScreen();
  } catch (e) {
    toast((e as Error).message, 'bad');
  }
}

export async function joinOnline(code: string): Promise<void> {
  if (!/^\d{4,6}$/.test(code)) {
    toast('Lobby codes are four digits.', 'bad');
    return;
  }
  if (!session.online) return void onlineHome();
  try {
    const night = await import('./night');
    night.stopNight();
    nightOn = false;
    net = await Net.shared();
    wireNet();
    await net.join(code);
    L = { code, host: '', seats: [], style: 'coopetition', length: 'full', mods: [], aiLevel: 2, mode: 'online', night: null, daily: null };
    remember({ role: 'guest', code });
    net.guestSend({ t: 'hello' });
    show((root) => {
      root.appendChild(h('div.wall'));
      root.appendChild(h('div.screen', { style: 'align-items:center;justify-content:center' }, h('div.sign', h('h1', { style: 'font-size:56px' }, `Lobby ${code}`), h('div.sub', 'Waiting for the host…')), h('button', { onclick: () => leaveOnline() }, 'Leave')));
    });
  } catch (e) {
    toast((e as Error).message, 'bad');
    forget();
  }
}

export function leaveOnline(): void {
  net?.leave();
  for (const f of offs) f();
  offs = [];
  L = null;
  nightOn = false;
  inLobbyScreen = false;
  forget();
  void import('./night').then((x) => x.stopNight());
  playMenu();
}

// remembering which lobby we are in, so a refresh puts us straight back
type Memo = { role: 'host' | 'guest'; code: string };
function remember(m: Memo): void {
  try {
    sessionStorage.setItem('bd.lobby', JSON.stringify(m));
  } catch {
    /* ignore */
  }
}
function forget(): void {
  try {
    sessionStorage.removeItem('bd.lobby');
  } catch {
    /* ignore */
  }
}

/** after a refresh: back into the solo night, or the online lobby / night we were in */
export function resumeIfAny(): boolean {
  const solo = HostMatch.saved('solo');
  if (solo) {
    void import('./night').then((x) => x.startSolo(solo, null, true));
    return true;
  }
  let memo: Memo | null = null;
  try {
    memo = JSON.parse(sessionStorage.getItem('bd.lobby') || 'null');
  } catch {
    memo = null;
  }
  if (!memo || !session.online) return false;
  void (async () => {
    try {
      net = await Net.shared();
      wireNet();
      if (memo.role === 'host') {
        await net.reclaim(memo.code);
        const st = HostMatch.saved(memo.code);
        const saved = sessionStorage.getItem('bd.lobbyState');
        L = saved ? (JSON.parse(saved) as LState) : newLobby('online', { code: memo.code });
        L.code = memo.code;
        L.host = me();
        if (st) {
          nightOn = true;
          void import('./night').then((x) => x.startHost(net!, L!, st));
        }
        else {
          lobbyScreen();
          broadcast();
        }
      } else await joinOnline(memo.code);
    } catch {
      forget();
      mainMenu();
    }
  })();
  return true;
}

// ------------------------------------------------------------------ the lobby screen

function skillRow(label: string, n: number, color: string): HTMLElement[] {
  const loaves = h('div.loaves');
  for (let i = 0; i < 5; i++) loaves.appendChild(svg(LOAF13(22), i < n ? '' : 'off')).setAttribute('style', i < n ? '' : 'opacity:0.2;filter:grayscale(1)');
  return [h('span', { style: `color:${n >= 4 ? color : n <= 2 ? '#F2A08C' : '#F3E6CF'}` }, label), loaves];
}

export function lobbyScreen(): void {
  if (!L) return playMenu();
  inLobbyScreen = true;
  audio.music('bakery');
  try {
    if (L.mode === 'online' && isHost()) sessionStorage.setItem('bd.lobbyState', JSON.stringify(L));
  } catch {
    /* ignore */
  }
  show((root) => {
    root.appendChild(h('div.wall'));
    root.appendChild(ambient([[24, 70], [1418, 70]], 5));
    const body = h('div.screen', { style: 'gap:14px' });
    root.appendChild(body);
    let focus: BakerId = mySeat()?.baker ?? 'stephanie';
    const render = (): void => {
      if (!L) return;
      const host = isHost();
      const mine = mySeat();
      if (mine?.baker) focus = focus && L.seats.every((s) => s === mine || s.baker !== focus) ? focus : mine.baker;
      const locked = L.mode === 'campaign' || L.mode === 'daily';
      const lenName = LENGTHS.find((x) => x.id === L!.length)!;
      const styleName = STYLES.find((x) => x.id === L!.style)!.name;
      const filled = L.seats.filter((s) => s.kind !== 'open').length;
      const title = L.mode === 'campaign' ? `Night ${L.night} of 13` : L.mode === 'daily' ? `Daily · ${L.daily}` : L.mode === 'online' ? `Lobby ${L.code}` : 'Solo night';
      // ---- top bar
      const top = h(
        'div.row',
        h('button', { onclick: () => (L?.mode === 'online' ? leaveOnline() : L?.mode === 'campaign' ? campaignScreen() : L?.mode === 'daily' ? dailyScreen() : playMenu()) }, L.mode === 'online' ? 'Leave' : '◀ Back'),
        h('div.grow', h('h2', { style: 'font-size:38px' }, 'Choose your baker'), h('div.dim', { style: 'font-weight:800' }, `${title} · ${styleName} · ${lenName.name} (${lenName.orders} orders, ${lenName.about}) · ${filled} baker${filled === 1 ? '' : 's'}`)),
        L.mode === 'online' ? h('span.chip', { style: 'font-size:22px' }, `Code ${L.code}`) : '',
        L.mode === 'online' ? h('button', { onclick: () => friendsModal(true) }, 'Invite friends') : '',
      );
      // ---- baker grid
      const grid = h('div.baker-grid', { style: 'width:536px' });
      for (const b of BAKERS) {
        const taker = L.seats.find((s) => s.baker === b.id);
        const takenByOther = !!taker && taker !== mine;
        const sel = mine?.baker === b.id;
        const card = h(
          `div.baker-card${sel ? '.sel' : ''}${takenByOther ? '.taken' : ''}`,
          {
            role: 'button',
            tabindex: '0',
            'aria-label': `${b.name}, ${b.title}`,
            style: sel ? `border-color:${b.light};box-shadow:0 0 0 4px ${b.light}55,0 8px 0 #1E120C` : '',
            onclick: () => {
              focus = b.id;
              if (!takenByOther && mine && !mine.ready) pick(b.id);
              else render();
            },
            onmouseenter: () => audio.sfx('hover'),
          },
          svg(portrait(b.id, 112, mine?.baker === b.id ? mine.cosmetics : cosmeticsFor(session.profile, b.id))),
          h('span.nm', b.name),
          h('span.tt', b.title),
          taker ? h('span.who', { style: `background:${b.light}` }, taker === mine ? 'You' : taker.kind === 'ai' ? 'AI' : taker.name.slice(0, 10)) : '',
        );
        grid.appendChild(card);
      }
      // ---- detail panel
      const fb = BAKER[focus];
      const detail = h(
        'div.panel.col',
        { style: 'width:344px;gap:10px' },
        h('div.row', svg(portrait(fb.id, 92, mine?.baker === fb.id ? mine.cosmetics : cosmeticsFor(session.profile, fb.id))), h('div', h('h3', { style: 'font-size:30px' }, fb.name), h('div.dim', { style: 'font-weight:800' }, fb.title))),
        h('div', h('span.tag', { style: 'background:#A8D69F' }, 'Perk'), h('div', { style: 'font-weight:800;margin-top:6px' }, fb.perk)),
        h('div', h('span.tag', { style: 'background:#F2A08C' }, 'Weakness'), h('div', { style: 'font-weight:800;margin-top:6px' }, fb.weakness)),
        h('div.skills', ...MINI_IDS.flatMap((g) => skillRow(GAMES[g].name, fb.skills[g], fb.light))),
        mine?.baker === fb.id ? h('button.tiny', { onclick: () => wardrobe(fb.id, () => render()) }, 'Wardrobe') : '',
      );
      // ---- rules
      const rules = h('div.panel.col.lobby-rules', { style: 'flex:1;min-width:0' });
      const seg = <T extends string>(opts: { id: T; name: string }[], cur: T, set: (v: T) => void, can: boolean): HTMLElement =>
        h('div.seg', ...opts.map((o) => h(`button${o.id === cur ? '.on' : ''}`, { type: 'button', disabled: !can, onclick: () => (set(o.id), changed()) }, o.name)));
      const can = host && !locked;
      rules.appendChild(h('span.tag', 'Style'));
      rules.appendChild(h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:6px' }, ...STYLES.map((s) => h(`button.tiny${s.id === L!.style ? '.on' : ''}`, { disabled: !can, onclick: () => ((L!.style = s.id), retime(), changed()) }, s.name))));
      rules.appendChild(h('div.small', { style: 'font-weight:700;color:#F3E6CF;min-height:38px' }, STYLES.find((s) => s.id === L!.style)!.rule));
      rules.appendChild(h('span.tag', 'Length'));
      rules.appendChild(seg(LENGTHS.map((x) => ({ id: x.id, name: x.name })), L.length, (v) => (L!.length = v), can));
      // a label and its choices on one line (saves the panel a row)
      const inline = (label: string, control: HTMLElement): HTMLElement => h('div.row', { style: 'gap:10px' }, h('span.tag', { style: 'flex-shrink:0;width:160px;text-align:center;white-space:nowrap' }, label), h('div', { style: 'flex:1;min-width:0' }, control));
      rules.appendChild(
        inline(
          'AI rivals',
          seg(
            [
              { id: '1', name: 'Easy' },
              { id: '2', name: 'Normal' },
              { id: '3', name: 'Hard' },
            ],
            String(L.aiLevel) as '1' | '2' | '3',
            (v) => {
              L!.aiLevel = Number(v) as AiLevel;
              for (const s of L!.seats) if (s.kind === 'ai') s.level = L!.aiLevel;
            },
            can,
          ),
        ),
      );
      // how long each mini game runs (the Shared Oven and Dawn run until their trays are out)
      rules.appendChild(inline('Mini games', seg(PACES.map((p) => ({ id: p.id, name: p.about.replace('~', '') })), locked ? 'normal' : (L.pace ?? 'normal'), (v) => (L!.pace = v), can)));
      rules.appendChild(
        h(
          'div.row',
          h('span.tag', 'Modifiers'),
          h('div.grow'),
          can ? h('button.tiny', { onclick: () => modsModal(changed) }, L.mods.length ? 'Change' : 'Add') : '',
          can ? h('button.tiny', { onclick: () => ((L!.mods = randomMods()), changed()) }, 'Random') : '',
        ),
      );
      rules.appendChild(h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' }, ...(L.mods.length ? L.mods.map((m) => h('span.pill', MODS.find((x) => x.id === m)!.name)) : [h('span.small.dim', 'None')])));
      // ---- seats
      const seats = h('div.seat-slots', { style: 'flex:1' });
      L.seats.forEach((s, i) => {
        const teamTag = L!.style === 'teams' ? h('button.tiny', { disabled: !host, style: `background:${s.team ? '#5B7BA6' : '#C8553D'}`, onclick: () => ((s.team = 1 - s.team), changed()) }, s.team ? 'Blue' : 'Red') : '';
        if (s.kind === 'open') {
          seats.appendChild(
            h(
              'div.seat',
              h('div.st', `Seat ${i + 1}`),
              host ? h('button.tiny', { onclick: () => ((L!.seats[i] = aiSeat(s.team, L!.aiLevel)), changed()) }, 'Add an AI rival') : h('div.st', 'Open'),
              L!.mode === 'online' && host ? h('button.tiny.ghost', { onclick: () => friendsModal(true) }, 'Invite a friend') : '',
              teamTag,
            ),
          );
          return;
        }
        const b = s.baker ? BAKER[s.baker] : null;
        seats.appendChild(
          h(
            'div.seat.full',
            { style: b ? `border-color:${b.light}` : '' },
            h('div.row', { style: 'gap:8px' }, b ? svg(portrait(b.id, 44, s.cosmetics)) : '', h('div', { style: 'text-align:left' }, h('div.nm', s.kind === 'ai' ? `${b?.name ?? ''} (AI)` : s.name), h('div.st', s.kind === 'ai' ? ['', 'Easy', 'Normal', 'Hard'][s.level] : !s.online ? 'Reconnecting…' : s.ready ? 'Locked in' : `Choosing… ${b?.name ?? ''}`))),
            h('div.row', { style: 'gap:6px' }, teamTag, host && (s.kind === 'ai' || (s.kind === 'human' && !s.online && s.id !== me())) && !locked ? h('button.tiny', { onclick: () => (s.kind === 'human' && removed.add(s.id), (L!.seats[i] = emptySeat(s.team)), changed()) }, 'Remove') : '', host && s.kind === 'ai' && !locked ? h('button.tiny', { onclick: () => ((s.baker = nextFreeBaker(s.baker)), (s.name = BAKER[s.baker!].name), changed()) }, 'Swap') : ''),
          ),
        );
      });
      const ready = mine?.ready;
      const humans = L.seats.filter((s) => s.kind === 'human');
      const allReady = humans.every((s) => s.ready || s.id === me());
      const startErr = startProblem();
      const actions = h(
        'div.col',
        { style: 'width:300px;gap:10px' },
        mine ? h(`button.big${ready ? '' : '.gold'}`, { onclick: () => setReady(!ready) }, ready ? 'Locked in · change' : 'Lock in') : '',
        host
          ? h('button.primary.big', { disabled: !!startErr || !allReady, onclick: () => void startNight(), title: startErr || (!allReady ? 'Waiting for everyone to lock in' : '') }, 'Start the night')
          : h('div.dim', { style: 'font-weight:800;text-align:center' }, 'The host starts the night.'),
        startErr ? h('div.small', { style: 'color:#F2A08C;font-weight:800' }, startErr) : !allReady && host ? h('div.small.dim', 'Waiting for everyone to lock in.') : '',
      );
      body.replaceChildren(top, h('div.row', { style: 'align-items:stretch;gap:24px;height:490px' }, grid, detail, rules), h('div.row', { style: 'align-items:stretch;gap:20px' }, seats, actions));
    };
    const retime = (): void => {
      // teams: two and two by default
      if (L!.style === 'teams') L!.seats.forEach((s, i) => (s.team = i < 2 ? 0 : 1));
    };
    const changed = (): void => {
      if (!L) return;
      if (L.mode === 'online') {
        broadcast();
        try {
          sessionStorage.setItem('bd.lobbyState', JSON.stringify(L));
        } catch {
          /* ignore */
        }
      }
      render();
    };
    const pick = (b: BakerId): void => {
      const s = mySeat();
      if (!s || !L) return;
      audio.sfx('select');
      s.baker = b;
      s.cosmetics = cosmeticsFor(session.profile, b);
      s.ready = false;
      session.profile.lastBaker = b;
      save();
      if (!isHost() && net) net.guestSend({ t: 'pick', baker: b, cos: s.cosmetics });
      changed();
    };
    const setReady = (v: boolean): void => {
      const s = mySeat();
      if (!s) return;
      audio.sfx(v ? 'select' : 'back');
      s.ready = v;
      if (!isHost() && net) net.guestSend({ t: 'ready', v });
      changed();
    };
    rerender = render;
    render();
    return () => {
      inLobbyScreen = false;
      rerender = null;
    };
  });
}

function nextFreeBaker(cur: BakerId | null): BakerId {
  const ids = BAKERS.map((b) => b.id);
  const start = cur ? ids.indexOf(cur) : -1;
  for (let k = 1; k <= ids.length; k++) {
    const b = ids[(start + k) % ids.length]!;
    if (!L!.seats.some((s) => s.baker === b)) return b;
  }
  return cur ?? 'pip';
}

function randomMods(): ModId[] {
  const pool = MODS.map((m) => m.id);
  const a = pool[Math.floor(Math.random() * pool.length)]!;
  let b = pool[Math.floor(Math.random() * pool.length)]!;
  if (b === a) b = pool[(pool.indexOf(a) + 5) % pool.length]!;
  return [a, b];
}

function modsModal(done: () => void): void {
  const body = h('div.col');
  // a modal fits 798 px of content (860 less padding and border); wider scrolls sideways and cuts the cards off
  const close = modal(h('div.col', { style: 'width:790px' }, h('div.row', h('h2.grow', 'Modifiers'), h('button', { onclick: () => (close(), done()) }, 'Done')), body), { onClose: done });
  const render = (): void => {
    body.replaceChildren(
      h('div.small', { style: 'font-weight:800' }, 'Mix any. Tame ones bend the rules; chaotic ones change how the games physically play.'),
      h(
        'div.mods',
        ...MODS.map((m) =>
          h(
            `button.mod${m.chaos ? '.chaos' : ''}${L!.mods.includes(m.id) ? '.on' : ''}`,
            {
              type: 'button',
              onclick: () => {
                L!.mods = L!.mods.includes(m.id) ? L!.mods.filter((x) => x !== m.id) : [...L!.mods, m.id];
                audio.sfx('tap');
                render();
              },
            },
            h('div', h('b', `${m.name}${m.chaos ? ' · chaos' : ''}`), h('small', m.rule)),
          ),
        ),
      ),
      h('div.row', h('button.tiny', { onclick: () => ((L!.mods = []), render()) }, 'Clear'), h('button.tiny', { onclick: () => ((L!.mods = randomMods()), render()) }, 'Random two')),
    );
  };
  render();
}

function wardrobe(baker: BakerId, done: () => void): void {
  const p = session.profile;
  const body = h('div.col');
  const close = modal(h('div.col', { style: 'width:900px' }, h('div.row', h('h2.grow', `${BAKER[baker].name}’s wardrobe`), h('button', { onclick: () => (close(), done()) }, 'Done')), body), { onClose: done, wide: true });
  const render = (): void => {
    const cur = cosmeticsFor(p, baker);
    const slotRow = (slot: 'apron' | 'pin' | 'badge', label: string): HTMLElement =>
      h(
        'div.col',
        { style: 'gap:6px' },
        h('span.tag', label),
        h(
          'div',
          { style: 'display:flex;flex-wrap:wrap;gap:8px' },
          ...COSMETICS.filter((c) => c.slot === slot).map((c) => {
            const have = p.unlocked.includes(c.id);
            const on = cur[slot] === c.id;
            return h(
              `button.tiny${on ? '.on' : ''}`,
              {
                disabled: !have,
                title: have ? c.name : `Locked: ${c.how}`,
                onclick: () => {
                  p.equipped[baker] = { ...cur, [slot]: c.id };
                  const s = mySeat();
                  if (s && s.baker === baker) {
                    s.cosmetics = cosmeticsFor(p, baker);
                    if (!isHost() && net) net.guestSend({ t: 'pick', baker, cos: s.cosmetics });
                    else if (L?.mode === 'online') broadcast();
                  }
                  save();
                  render();
                },
                style: 'display:flex;align-items:center;gap:6px',
              },
              slot === 'pin' ? svg(rollingPin(c.id, 60)) : '',
              have ? c.name : `${c.name} · ${c.how}`,
            );
          }),
        ),
      );
    body.replaceChildren(h('div.row', svg(portrait(baker, 150, cur)), h('div.col', svg(rollingPin(cur.pin, 160)), h('div.dim', 'Unlock more by surviving nights, the campaign and achievements.'))), slotRow('apron', 'Apron'), slotRow('pin', 'Rolling pin'), slotRow('badge', 'Hat badge'));
  };
  render();
}

function startProblem(): string {
  if (!L) return 'No lobby.';
  const seats = L.seats.filter((s) => s.kind !== 'open');
  if (seats.some((s) => !s.baker)) return 'Everyone needs a baker.';
  const bakers = seats.map((s) => s.baker);
  if (new Set(bakers).size !== bakers.length) return 'Two bakers are the same.';
  if ((L.style === 'ffa' || L.style === 'teams') && seats.length < 2) return 'Free-for-all and 2v2 need at least two bakers.';
  if (L.style === 'teams' && (!seats.some((s) => s.team === 0) || !seats.some((s) => s.team === 1))) return 'Both teams need a baker.';
  return '';
}

async function startNight(): Promise<void> {
  if (!L || startProblem()) return;
  const seatsL = L.seats.filter((s) => s.kind !== 'open');
  const seats: Seat[] = seatsL.map((s, i) => ({
    id: s.kind === 'human' ? s.id : `ai:${i}`,
    name: s.kind === 'human' ? s.name : BAKER[s.baker!].name,
    baker: s.baker!,
    ai: s.kind === 'ai',
    // someone who dropped from the lobby starts with an AI standing in (they take over if they come back)
    standIn: s.kind === 'human' && !s.online,
    aiLevel: s.kind === 'ai' ? s.level : L!.aiLevel,
    team: s.team,
    cosmetics: s.cosmetics,
  }));
  const seed = L.daily ? dailyCfg(L.daily).seed : L.night ? hash(`bd-campaign-${L.night}`) : (Math.random() * 2 ** 31) >>> 0;
  const locked = L.mode === 'campaign' || L.mode === 'daily';
  const cfg: MatchCfg = { style: L.style, length: L.length, pace: locked ? 'normal' : (L.pace ?? 'normal'), mods: L.mods, aiLevel: L.aiLevel, seed, night: L.night, daily: L.daily };
  const st = newMatch(cfg, seats, performance.timeOrigin + performance.now());
  // dev: ?games=kitchen (or fold+juggle) makes every order before Dawn play those games
  const devGames = import.meta.env.DEV ? new URLSearchParams(location.search).get('games') : null;
  if (devGames) for (const o of st.orders.slice(0, -1)) o.games = devGames.split('+') as GameId[];
  audio.sfx('bell');
  inLobbyScreen = false;
  if (L.mode === 'online' && net) {
    nightOn = true;
    net.hostSend({ t: 'go' });
    void import('./night').then((x) => x.startHost(net!, L!, st));
  } else void import('./night').then((x) => x.startSolo(st, L, false));
}

/** the lobby state to return to after a night */
export function currentLobby(): LState | null {
  return L;
}
export function setLobby(s: LState | null): void {
  L = s;
}
export function lobbyNet(): Net | null {
  return net;
}
/** the host goes back to the lobby: everyone unlocks and the lobby is sent again */
export function hostBackToLobby(): void {
  if (!L) return playMenu();
  for (const s of L.seats) if (s.kind === 'human') s.ready = false;
  nightOn = false;
  broadcast(true);
  lobbyScreen();
}
