// Each mini game played headless by bots: a perfect player must score high, an idle one nothing, and mashing or
// scribbling must not pay. The middle bot (a decent person) should land where the AI rivals' Normal level sits.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { audio } from '../src/audio/audio';
import type { MiniEnv, MiniGame } from '../src/mini/common';
import { decorate } from '../src/mini/decorate';
import { knead } from '../src/mini/knead';
import { proof } from '../src/mini/proof';
import { rush } from '../src/mini/rush';
import { scale } from '../src/mini/scale';
import type { GameId } from '../src/game/types';

function env(game: GameId, extra: Partial<MiniEnv> = {}): MiniEnv {
  return { game, seed: 4242, seconds: 50, baker: 'pip', coat: '#5E9A58', light: '#A8D69F', skill: 1, buffs: [], salted: false, tiny: 1, rush: false, ...extra };
}

let T = 0;
afterEach(() => vi.restoreAllMocks());

/** run a game at 60 fps for its whole clock; `bot` acts every frame */
function play(g: MiniGame, seconds: number, bot: (g: MiniGame, t: number, frame: number) => void): number {
  T = 0;
  vi.spyOn(audio, 'time').mockImplementation(() => T);
  const dt = 1 / 60;
  let f = 0;
  for (let t = 0; t < seconds; t += dt) {
    T = t;
    g.update(t, dt);
    bot(g, t, f++);
  }
  return g.result().q;
}

let rnd = 1;
const rand = (): number => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
const gauss = (): number => (rand() + rand() + rand() + rand() - 2) * 1.732;

describe('Knead', () => {
  type N = { t: number; judged: string };
  const perfect = (g: MiniGame): void => {
    const p = g.peek!() as { notes: N[]; now: number };
    const n = p.notes.find((x) => !x.judged);
    if (n && Math.abs(n.t - p.now) <= 1 / 120) g.key('Space', true);
  };
  it('a perfect player scores near 1', () => expect(play(knead(env('knead')), 50, perfect)).toBeGreaterThan(0.92));
  it('doing nothing scores 0', () => expect(play(knead(env('knead')), 50, () => {})).toBe(0));
  it('mashing every frame does not pay', () => expect(play(knead(env('knead')), 50, (g) => g.key('Space', true))).toBeLessThan(0.2));
  it('mashing twice a beat does not pay either', () => expect(play(knead(env('knead')), 50, (g, _t, f) => f % 15 === 0 && g.key('Space', true))).toBeLessThan(0.55));
  it('a decent player lands mid-range', () => {
    rnd = 7;
    const plan = new Map<N, number>();
    const q = play(knead(env('knead')), 50, (g) => {
      const p = g.peek!() as { notes: N[]; now: number };
      for (const n of p.notes) {
        if (n.judged) continue;
        if (!plan.has(n)) plan.set(n, rand() < 0.88 ? n.t + gauss() * 0.065 : -1);
        const at = plan.get(n)!;
        if (at > 0 && p.now >= at) {
          g.key('Space', true);
          plan.set(n, -1);
        }
        break;
      }
    });
    expect(q).toBeGreaterThan(0.45);
    expect(q).toBeLessThan(0.85);
  });
});

describe('Proof', () => {
  type D = { peak: number; h: number; state: string };
  const releaseAt = (k: number) => (g: MiniGame) => {
    const p = g.peek!() as { dough: D; pause: number };
    if (p.pause > 0) return;
    if (p.dough.state === 'wait') g.down(0, 0);
    else if (p.dough.state === 'rise' && p.dough.h >= p.dough.peak * k) g.up(0, 0);
  };
  it('letting go in the tremble scores near 1', () => expect(play(proof(env('proof')), 50, releaseAt(0.965))).toBeGreaterThan(0.9));
  it('bailing at half rise is safe but plain', () => {
    const q = play(proof(env('proof')), 50, releaseAt(0.5));
    expect(q).toBeGreaterThan(0.4);
    expect(q).toBeLessThan(0.62);
  });
  it('holding every dough to the top collapses them', () => expect(play(proof(env('proof')), 50, (g) => g.down(0, 0))).toBeLessThan(0.15));
  it('doing nothing scores 0', () => expect(play(proof(env('proof')), 50, () => {})).toBe(0));
});

describe('Decorate', () => {
  type P = { pts: [number, number][]; slide: number; cx: number; cy: number };
  it('tracing the line scores high', () => {
    let i = -1;
    const q = play(decorate(env('decorate')), 50, (g) => {
      const p = g.peek!() as P;
      if (p.slide > 0.05) {
        i = -1;
        return;
      }
      if (i < 0) {
        i = 0;
        g.down(p.cx + p.pts[0]![0], p.cy + p.pts[0]![1]);
        return;
      }
      i = Math.min(p.pts.length - 1, i + 3);
      g.move(p.cx + p.pts[i]![0], p.cy + p.pts[i]![1], true);
      if (i >= p.pts.length - 1) g.up(0, 0);
    });
    expect(q).toBeGreaterThan(0.85);
  });
  it('scribbling all over the cake does not pay', () => {
    rnd = 3;
    let down = false;
    const q = play(decorate(env('decorate')), 50, (g) => {
      const x = 600 + (rand() - 0.5) * 520;
      const y = 410 + (rand() - 0.5) * 500;
      if (!down) {
        g.down(x, y);
        down = true;
      } else g.move(x, y, true);
    });
    expect(q).toBeLessThan(0.25);
  });
});

describe('Scale', () => {
  type S = { target: { g: number; w: number; done: boolean }; pause: number; weighBtn: { x: number; y: number } };
  const pourTo = (k: number) => {
    let holding = false;
    return (g: MiniGame) => {
      const p = g.peek!() as S;
      if (p.pause > 0 || p.target.done) return;
      if (!holding && p.target.w < p.target.g * k - 3) {
        g.down(300, 300);
        holding = true;
      }
      if (holding && p.target.w >= p.target.g * k - (p.target.g * k - p.target.w > 60 ? 0 : 4)) {
        g.up(0, 0);
        holding = false;
        g.down(p.weighBtn.x + 10, p.weighBtn.y + 10);
      }
    };
  };
  it('pouring to the gram scores high', () => expect(play(scale(env('scale')), 50, pourTo(1))).toBeGreaterThan(0.8));
  it('a short pour is short weight', () => expect(play(scale(env('scale')), 50, pourTo(0.6))).toBeLessThan(0.15));
});

describe('Rush Order', () => {
  type R = { recipe: { items: number[]; got: number; phase: string }; layout: number[]; pause: number; slot: (i: number) => [number, number] };
  it('remembering everything scores high', () => {
    const q = play(rush(env('rush')), 50, (g, _t, f) => {
      const p = g.peek!() as R;
      if (p.recipe.phase !== 'build' || p.pause > 0 || f % 12) return;
      const want = p.recipe.items[p.recipe.got]!;
      const [x, y] = p.slot(p.layout.indexOf(want));
      g.down(x, y);
    });
    expect(q).toBeGreaterThan(0.9);
  });
  it('guessing does not', () => {
    rnd = 11;
    const q = play(rush(env('rush')), 50, (g, _t, f) => {
      const p = g.peek!() as R;
      if (p.recipe.phase !== 'build' || p.pause > 0 || f % 12) return;
      const [x, y] = p.slot(Math.floor(rand() * 8));
      g.down(x, y);
    });
    expect(q).toBeLessThan(0.3);
  });
});
