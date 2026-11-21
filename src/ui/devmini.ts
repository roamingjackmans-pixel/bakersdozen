// Dev only: ?mini=knead (or proof, decorate, scale, rush) runs one mini game on its own and shows the result.
// Add &baker=joe&salted&mods=mirror,lightsout&seconds=20 to try variations.
import { audio } from '../audio/audio';
import type { BakerId, GameId, ModId } from '../game/types';
import { runMini } from '../mini/runner';
import { h, stage, toast } from './dom';

export function devMini(game: GameId, q: URLSearchParams): void {
  const root = h('div', { style: 'position:absolute;inset:0;background:#2A1A12' });
  stage().appendChild(root);
  const out = h('div', { style: 'position:absolute;left:20px;bottom:20px;z-index:60;font:700 18px monospace;background:#000a;padding:8px 12px;border-radius:8px' }, '');
  stage().appendChild(out);
  const start = (): void => {
    audio.unlock();
    const run = runMini(root, {
      game,
      seed: Number(q.get('seed') ?? 1234),
      seconds: Number(q.get('seconds') ?? 25),
      baker: (q.get('baker') as BakerId) ?? 'pip',
      buffs: (q.get('buffs')?.split(',') ?? []) as never[],
      salted: q.has('salted'),
      rush: q.has('rush'),
      mods: (q.get('mods')?.split(',') ?? []) as ModId[],
      twist: null,
      startAt: performance.now() + 3000,
      flourAt: q.has('flour') ? performance.now() + 8000 : 0,
      sheriff: q.has('sheriff'),
      label: 'Dev test',
      onLive: (l) => (out.textContent = `live v=${l.v.toFixed(2)} c=${l.c} e=${l.e}`),
      onDone: (r) => {
        out.textContent = `result ${JSON.stringify(r)}`;
        toast(`q = ${r.q.toFixed(3)}`, 'gold', 8000);
        run.stop();
        setTimeout(start, 4000);
      },
    });
  };
  start();
}
