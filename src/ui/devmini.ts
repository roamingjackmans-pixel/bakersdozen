// Dev only: ?mini=knead (or proof, decorate, scale, rush, juggle, fold, kitchen) runs one mini game on its own and
// shows the result. Add &baker=joe&salted&mods=mirror,lightsout&seconds=20 to try variations. ?mini=kitchen runs All
// Hands here in the tab with three AI cooks (&ai=0..3 of them, &level=1..3).
import { audio } from '../audio/audio';
import { DEFAULT_COSMETICS } from '../game/data';
import { aiKitchen, kitchenResults, newKitchen, stepKitchen, kitchenAct, type KitchenAiMind, type KitchenState } from '../game/kitchen';
import { now as hostNow } from '../game/match';
import { newMatch } from '../game/rules';
import type { AiLevel, BakerId, GameId, MatchState, ModId, Seat } from '../game/types';
import type { KitchenLink } from '../mini/kitchen';
import { runMini } from '../mini/runner';
import { h, stage, toast } from './dom';

/** a kitchen with AI cooks, ticked here (what the host does online) */
function localKitchen(baker: BakerId, seconds: number, startAt: number, q: URLSearchParams): { link: KitchenLink; stop(): void; k: KitchenState; st: MatchState } {
  const others: BakerId[] = (['joe', 'bea', 'florentine', 'wick', 'stephanie', 'pip'] as BakerId[]).filter((b) => b !== baker);
  const nAi = Math.max(0, Math.min(3, Number(q.get('ai') ?? 3)));
  const level = Math.max(1, Math.min(3, Number(q.get('level') ?? 2))) as AiLevel;
  const style = (q.get('style') as MatchState['cfg']['style']) ?? 'coopetition';
  const seats: Seat[] = [baker, ...others.slice(0, nAi)].map((b, i) => ({ id: i ? `ai:${i}` : 'local', name: b, baker: b, ai: i > 0, standIn: false, aiLevel: level, team: style === 'teams' ? (i < 2 ? 0 : 1) : 0, cosmetics: { ...DEFAULT_COSMETICS } }));
  const st = newMatch({ style, length: 'quick', mods: (q.get('mods')?.split(',') ?? []) as ModId[], aiLevel: level, seed: Number(q.get('seed') ?? 1234), night: null, daily: null }, seats, hostNow());
  st.orders[0]!.games = ['kitchen'];
  const k = newKitchen(st, hostNow() + (startAt - performance.now()), seconds);
  const minds = new Map<number, KitchenAiMind>();
  const ai = seats.map((_, i) => i).filter((i) => i > 0);
  const timer = setInterval(() => {
    const n = hostNow();
    stepKitchen(k, st, n);
    aiKitchen(k, st, minds, n, ai);
  }, 50);
  return {
    k,
    st,
    link: { state: () => k, hostNow, act: (s) => kitchenAct(k, st, 0, s, hostNow()), me: 0, seats, bakeryOf: (s) => st.bakeries.findIndex((b) => b.members.includes(s)), need: st.orders[0]!.need },
    stop: () => clearInterval(timer),
  };
}

export function devMini(game: GameId, q: URLSearchParams): void {
  const root = h('div', { style: 'position:absolute;inset:0;background:#2A1A12' });
  stage().appendChild(root);
  const out = h('div', { style: 'position:absolute;left:20px;bottom:20px;z-index:60;font:700 18px monospace;background:#000a;padding:8px 12px;border-radius:8px' }, '');
  stage().appendChild(out);
  const start = (): void => {
    audio.unlock();
    const baker = (q.get('baker') as BakerId) ?? 'pip';
    const seconds = Number(q.get('seconds') ?? 25);
    const startAt = performance.now() + 3000;
    const kt = game === 'kitchen' ? localKitchen(baker, seconds, startAt, q) : null;
    const run = runMini(root, {
      game,
      seed: Number(q.get('seed') ?? 1234),
      seconds,
      baker,
      buffs: (q.get('buffs')?.split(',') ?? []) as never[],
      salted: q.has('salted'),
      rush: q.has('rush'),
      mods: (q.get('mods')?.split(',') ?? []) as ModId[],
      twist: null,
      startAt,
      flourAt: q.has('flour') ? performance.now() + 8000 : 0,
      sheriff: q.has('sheriff'),
      kitchen: kt?.link,
      label: 'Dev test',
      onLive: (l) => (out.textContent = `live v=${l.v.toFixed(2)} c=${l.c} e=${l.e}`),
      onDone: (r) => {
        if (kt) {
          kt.stop();
          const res = kitchenResults(kt.k, kt.st);
          r = res[0]!;
          out.textContent = `result ${JSON.stringify(res.map((x) => ({ q: +x.q.toFixed(2), ...x.kitchen })))} tickets ${kt.k.tickets.filter((t) => t.st === 'done').length}/${kt.k.tickets.length}`;
        } else out.textContent = `result ${JSON.stringify(r)}`;
        toast(`q = ${r.q.toFixed(3)}`, 'gold', 8000);
        run.stop();
        setTimeout(start, 4000);
      },
    });
  };
  start();
}
