// End to end through the real server: Shoallhell's server (shared accounts) runs on a spare port with a temp data
// folder. Two accounts become friends, one opens a Baker's Dozen lobby and invites the other, and the host's browser
// code (HostMatch) runs a night over the relay with the guest's ClientMatch. Saves and the daily board too.
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BAL, DEFAULT_COSMETICS } from '../src/game/data';
import { ClientMatch, HostMatch, localPair, type HostMsg } from '../src/game/match';
import { newMatch } from '../src/game/rules';
import type { Seat } from '../src/game/types';

const SERVER_DIR = process.env.SHOALLHELL_DIR || path.resolve(__dirname, '..', '..', 'Shoallhell');
const HAVE_SERVER = fs.existsSync(path.join(SERVER_DIR, 'server', 'index.js'));
const PORT = 3990 + Math.floor(Math.random() * 40);
const BASE = `http://localhost:${PORT}/games/shoallhell`;
let proc: ChildProcess | null = null;
let dir = '';

async function call(method: string, p: string, token: string | null, body?: unknown): Promise<Record<string, any>> {
  const r = await fetch(`${BASE}/api${p}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: r.status, ...(await r.json()) };
}

function connect(token: string, game = 'bd'): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(`http://localhost:${PORT}`, { path: '/games/shoallhell/socket.io', auth: { token, game }, transports: ['websocket'] });
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
  });
}

const ack = <T = any>(s: Socket, ev: string, msg: unknown): Promise<T> => new Promise((res) => s.emit(ev, msg, res));
const until = async (f: () => boolean, ms = 20000): Promise<void> => {
  const t0 = Date.now();
  while (!f()) {
    if (Date.now() - t0 > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 25));
  }
};

beforeAll(async () => {
  if (!HAVE_SERVER) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-online-'));
  proc = spawn(process.execPath, [path.join(SERVER_DIR, 'server', 'index.js')], { cwd: SERVER_DIR, env: { ...process.env, PORT: String(PORT), DATA_DIR: dir }, stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(`${BASE}/api/ping`)).ok) return;
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
}, 20000);

afterAll(() => {
  BAL.timeScale = 1;
  proc?.kill();
  try {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* temp */
  }
});

describe.skipIf(!HAVE_SERVER)("Baker's Dozen online through Shoallhell's server", () => {
  it('accounts, saves, friends, invites, a hosted night over the relay, and the daily board', async () => {
    const a = await call('POST', '/signup', null, { email: 'baker1@example.test', password: 'doughpass1', name: 'Baker One' });
    const b = await call('POST', '/signup', null, { email: 'baker2@example.test', password: 'doughpass2', name: 'Baker Two' });
    expect(a.token && b.token).toBeTruthy();

    // our own save slot, separate from Shoallhell's and Smash Your Bros'
    const me0 = await call('GET', '/bd/me', a.token);
    expect(me0.profile).toBeNull();
    const put1 = await call('PUT', '/bd/profile', a.token, { profile: { v: 1, tutorialSeen: true }, rev: me0.rev });
    expect(put1.rev).toBe(1);
    expect((await call('PUT', '/bd/profile', a.token, { profile: { v: 1 }, rev: 0 })).status).toBe(409);
    expect((await call('GET', '/bd/me', a.token)).profile.tutorialSeen).toBe(true);
    expect((await call('GET', '/me', a.token)).profile).toBeNull();

    // friends both ways
    const fa = await call('GET', '/friends', a.token);
    const fb = await call('GET', '/friends', b.token);
    await call('POST', '/friends/add', a.token, { code: fb.code });
    const added = await call('POST', '/friends/add', b.token, { code: fa.code });
    expect(added.friends).toBe(true);

    const sa = await connect(a.token);
    const sb = await connect(b.token);
    const room = await ack(sa, 'host:create', { chars: [] });
    const code = room.room.code as string;
    expect(code).toMatch(/^\d{4,5}$/);

    // the invite reaches the friend with this game's id
    const invite = new Promise<any>((res) => sb.once('friend:invite', res));
    expect((await ack(sa, 'friend:invite', { userId: added.view ? (await call('GET', '/friends', a.token)).friends[0].id : '' })).ok).toBe(true);
    const inv = await invite;
    expect(inv.game).toBe('bd');
    expect(inv.code).toBe(code);
    // presence shows the friend's lobby in Baker's Dozen
    expect((await call('GET', '/friends', b.token)).friends[0].game).toBe('bd');

    // a Shoallhell socket can't join a Baker's Dozen lobby
    const sx = await connect(b.token, 'shoallhell');
    expect((await ack(sx, 'room:join', { code, chars: [] })).error).toMatch(/Baker's Dozen/);
    sx.disconnect();

    expect((await ack(sb, 'room:join', { code, chars: [] })).ok).toBe(true);

    // the night: host runs HostMatch, guest runs ClientMatch, everything goes through host:msg / guest:msg
    BAL.timeScale = 0.12;
    const seats: Seat[] = [
      { id: a.user.id, name: 'Baker One', baker: 'joe', ai: false, standIn: false, aiLevel: 2, team: 0, cosmetics: { ...DEFAULT_COSMETICS } },
      { id: b.user.id, name: 'Baker Two', baker: 'bea', ai: false, standIn: false, aiLevel: 2, team: 0, cosmetics: { ...DEFAULT_COSMETICS } },
      { id: 'ai:2', name: 'Wick', baker: 'wick', ai: true, standIn: false, aiLevel: 2, team: 0, cosmetics: { ...DEFAULT_COSMETICS } },
    ];
    const st = newMatch({ style: 'coopetition', length: 'quick', mods: [], aiLevel: 2, seed: 77, night: null, daily: null }, seats, performance.timeOrigin + performance.now());
    const host = new HostMatch(st, { broadcast: (m: HostMsg) => sa.emit('host:msg', { t: 'm', m }) }, code);
    const hc = localPair(host, a.user.id);
    sa.on('guest:msg', (m: { from: string; msg: { t: string; m?: any } }) => m.msg?.t === 'm' && host.handle(m.from, m.msg.m));
    const gc = new ClientMatch(b.user.id, (m) => sb.emit('guest:msg', { t: 'm', m }), false);
    sb.on('host:msg', (m: { t: string; m?: HostMsg }) => m.t === 'm' && m.m && gc.receive(m.m));
    // both players act like people: submit a result each game, ask for the 13th loaf, buy Saffron, press Done
    const act = (c: ClientMatch, q: number): void => {
      const s = c.st;
      if (!s) return;
      const me = c.me;
      const key = `${s.phase}:${s.round}:${s.part}:${s.tallyStep}`;
      const done = (c as any)._done ?? ((c as any)._done = new Set<string>());
      if (done.has(key)) return;
      if (s.phase === 'play' && c.hostNow() > s.phaseStart + 3000) {
        done.add(key);
        c.send({ t: 'res', r: s.round, p: s.part, res: { q } });
      } else if (s.phase === 'tally' && s.tallyStep === 1) {
        done.add(key);
        c.send({ t: 'claim', v: true });
      } else if (s.phase === 'market') {
        done.add(key);
        const saffron = s.cart.findIndex((it) => it.buff === 'saffron');
        if (saffron >= 0 && s.players[me]!.tips >= s.cart[saffron]!.price) c.send({ t: 'buy', m: { item: saffron } });
        c.send({ t: 'emote', k: 'cheers' });
        c.send({ t: 'done', v: true });
      }
    };
    const errors: string[] = [];
    gc.on('error', (m) => errors.push(String(m)));
    host.start();
    gc.send({ t: 'hi' });
    const tick = setInterval(() => {
      act(hc, 0.82);
      act(gc, 0.74);
    }, 30);
    try {
      // the guest sees the night, measures the clock and reaches the second order's market
      await until(() => !!gc.st && gc.st.round >= 1 && gc.st.phase === 'market', 60000);
      expect(Math.abs(gc.offset)).toBeLessThan(1000);
      expect(gc.st!.players[1]!.stats.bakes).toBeGreaterThanOrEqual(1);
      // guest drops: an AI stands in; comes back: the seat is theirs again
      host.setPresent(b.user.id, false);
      await until(() => !!gc.st?.seats[1]!.standIn);
      host.setPresent(b.user.id, true);
      await until(() => gc.st?.seats[1]!.standIn === false);
      // the host and guest see the same thing
      await new Promise((r) => setTimeout(r, 300));
      expect(gc.st!.players.map((p) => p.stars)).toEqual(host.st.players.map((p) => p.stars));
      expect(gc.st!.events.some((e) => e.k === 'emote' && e.seat === 1)).toBe(true);
    } finally {
      clearInterval(tick);
      host.stop();
      gc.close();
      BAL.timeScale = 1;
    }
    expect(errors).toEqual([]);

    // the daily board: your best, and your friends'
    expect((await call('POST', '/bd/daily', a.token, { date: '2026-11-21', score: 61, baker: 'joe', survived: true })).best).toBe(61);
    await call('POST', '/bd/daily', a.token, { date: '2026-11-21', score: 40, baker: 'joe', survived: true });
    await call('POST', '/bd/daily', b.token, { date: '2026-11-21', score: 75, baker: 'bea', survived: true });
    const board = await call('GET', '/bd/daily?date=2026-11-21', a.token);
    expect(board.rows.map((r: any) => [r.name, r.score])).toEqual([
      ['Baker Two', 75],
      ['Baker One', 61],
    ]);
    expect((await call('POST', '/bd/daily', a.token, { date: 'nope', score: 1 })).status).toBe(400);
    sa.disconnect();
    sb.disconnect();
  }, 90000);
});
