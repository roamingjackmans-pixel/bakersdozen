// Each mini game played headless by bots: a perfect player must score high, an idle one nothing, and mashing or
// scribbling must not pay. The middle bot (a decent person) should land where the AI rivals' Normal level sits.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { audio } from '../src/audio/audio';
import type { MiniEnv, MiniGame } from '../src/mini/common';
import { DONE_AT, decorate } from '../src/mini/decorate';
import { fold } from '../src/mini/fold';
import { juggle } from '../src/mini/juggle';
import { knead } from '../src/mini/knead';
import { proof } from '../src/mini/proof';
import { rush } from '../src/mini/rush';
import { GOOD, goodErr, judgeWeigh, scale } from '../src/mini/scale';
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
  it("the green zone is exactly a good weigh, for every target", () => {
    // targets run 180..880 g in steps of 5
    for (let target = 180; target <= 880; target += 5) {
      const edge = goodErr(target);
      for (const side of [1, -1]) {
        const inside = judgeWeigh(target + side * (edge - 0.01), target);
        const outside = judgeWeigh(target + side * (edge + 0.01), target);
        expect(inside.good).toBe(true);
        expect(inside.score).toBeGreaterThanOrEqual(GOOD);
        expect(outside.good).toBe(false);
        expect(outside.score).toBeLessThan(GOOD);
      }
    }
    // the old fixed ±22 g zone called a 200 g target's 220 g "green"; it's too heavy
    expect(judgeWeigh(220, 200).good).toBe(false);
    expect(goodErr(200)).toBeLessThan(22);
  });
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

describe('Objectives: a game ends once its goal is met', () => {
  /** plays like play(), but stops at the first frame the game says it's finished; returns that game time, or -1 */
  function finishedAt(g: MiniGame, seconds: number, bot: (g: MiniGame, t: number, frame: number) => void): number {
    T = 0;
    vi.spyOn(audio, 'time').mockImplementation(() => T);
    const dt = 1 / 60;
    let f = 0;
    for (let t = 0; t < seconds; t += dt) {
      T = t;
      g.update(t, dt);
      if (g.finished?.()) return t;
      bot(g, t, f++);
    }
    return -1;
  }
  type DP = { pts: [number, number][]; slide: number; cx: number; cy: number; covered: Uint8Array; done: boolean };
  /** traces each design, lifting the pen over indexes in `skip` (a fraction range of the line) */
  const tracer = (skip?: [number, number]) => {
    let i = -1;
    return (g: MiniGame): void => {
      const p = g.peek!() as DP;
      if (p.slide > 0.05 || p.done) {
        i = -1;
        return;
      }
      const n = p.pts.length;
      if (i < 0) {
        i = 0;
        g.down(p.cx + p.pts[0]![0], p.cy + p.pts[0]![1]);
        return;
      }
      if (i >= n - 1) return;
      i = Math.min(n - 1, i + 3);
      if (skip && i >= skip[0] * n && i < skip[1] * n) {
        // over the gap: pen up, then down again on the far side
        g.up(0, 0);
        i = Math.ceil(skip[1] * n);
        g.down(p.cx + p.pts[i]![0], p.cy + p.pts[i]![1]);
        return;
      }
      g.move(p.cx + p.pts[i]![0], p.cy + p.pts[i]![1], true);
      if (i >= n - 1) g.up(0, 0);
    };
  };

  it('Scale: weighing to the gram meets the goal early', () => {
    const g = scale(env('scale'));
    let holding = false;
    const t = finishedAt(g, 50, (gm) => {
      const p = gm.peek!() as { target: { g: number; w: number; done: boolean }; pause: number; weighBtn: { x: number; y: number } };
      if (p.pause > 0 || p.target.done) return;
      if (!holding && p.target.w < p.target.g - 3) {
        gm.down(300, 300);
        holding = true;
      }
      if (holding && p.target.w >= p.target.g - (p.target.g - p.target.w > 60 ? 0 : 4)) {
        gm.up(0, 0);
        holding = false;
        gm.down(p.weighBtn.x + 10, p.weighBtn.y + 10);
      }
    });
    expect(t).toBeGreaterThan(0);
    const [done, goal] = g.goal!();
    expect(done).toBe(goal);
    expect(g.result().q).toBeGreaterThan(0.8);
  });

  it('Proof: letting go in the tremble meets the goal early', () => {
    const g = proof(env('proof'));
    const t = finishedAt(g, 50, (gm) => {
      const p = gm.peek!() as { dough: { peak: number; h: number; state: string }; pause: number };
      if (p.pause > 0) return;
      if (p.dough.state === 'wait') gm.down(0, 0);
      else if (p.dough.state === 'rise' && p.dough.h >= p.dough.peak * 0.965) gm.up(0, 0);
    });
    expect(t).toBeGreaterThan(0);
    expect(g.goal!()[0]).toBe(g.goal!()[1]);
    expect(g.result().q).toBeGreaterThan(0.9);
  });

  it('Decorate: tracing every design meets the goal early', () => {
    const g = decorate(env('decorate'));
    const t = finishedAt(g, 50, tracer());
    expect(t).toBeGreaterThan(0);
    expect(g.goal!()[0]).toBe(g.goal!()[1]);
    expect(g.result().q).toBeGreaterThan(0.85);
  });

  it('Rush: getting the goal-length recipe right meets the goal early', () => {
    const g = rush(env('rush'));
    const t = finishedAt(g, 50, (gm, _t, f) => {
      const p = gm.peek!() as { recipe: { items: number[]; got: number; phase: string }; layout: number[]; pause: number; slot: (i: number) => [number, number] };
      if (p.recipe.phase !== 'build' || p.pause > 0 || f % 12) return;
      const [x, y] = p.slot(p.layout.indexOf(p.recipe.items[p.recipe.got]!));
      gm.down(x, y);
    });
    expect(t).toBeGreaterThan(0);
    expect(g.goal!()).toEqual([6, 6]);
  });

  it('doing nothing never meets a goal', () => {
    for (const make of [scale, proof, decorate, rush, juggle, fold]) expect(finishedAt(make(env(make.name as GameId)), 50, () => {})).toBe(-1);
  });

  it('the goal scales with the game length', () => {
    expect(scale(env('scale', { seconds: 35 })).goal!()[1]).toBeLessThan(scale(env('scale', { seconds: 70 })).goal!()[1]);
    expect(proof(env('proof', { seconds: 35 })).goal!()[1]).toBeLessThan(proof(env('proof', { seconds: 70 })).goal!()[1]);
    expect(decorate(env('decorate', { seconds: 35 })).goal!()[1]).toBeLessThan(decorate(env('decorate', { seconds: 70 })).goal!()[1]);
  });

  it('Decorate: a design with a gap in its line is not done', () => {
    const g = decorate(env('decorate'));
    // skip 6% of the line in the middle (it used to be done at 94% covered)
    finishedAt(g, 12, tracer([0.45, 0.51]));
    const p = g.peek!() as DP;
    const cov = p.covered.reduce((s, v) => s + v, 0) / p.pts.length;
    expect(cov).toBeGreaterThan(0.9);
    expect(cov).toBeLessThan(DONE_AT);
    expect(p.done).toBe(false);
    expect(g.goal!()[0]).toBe(0);
  });

  it('Decorate: jumping to the end dot after 60% does not finish the design', () => {
    const g = decorate(env('decorate'));
    finishedAt(g, 12, tracer([0.62, 0.97]));
    const p = g.peek!() as DP;
    expect(p.done).toBe(false);
    expect(g.goal!()[0]).toBe(0);
  });
});

describe('Egg Juggle', () => {
  type E = { eggs: { to: string; t1: number; st: string }[]; now: number; good: number; perf: number };
  /** taps each hand right as its egg lands */
  const perfect = () => {
    const seen = new Map<unknown, number>();
    return (g: MiniGame): void => {
      const p = g.peek!() as E;
      for (const e of p.eggs) {
        if (e.st !== 'fly' || e.to === 'bowl') continue;
        if (seen.get(e) === e.t1) continue;
        if (p.now >= e.t1) {
          seen.set(e, e.t1);
          g.key(e.to === 'L' ? 'KeyF' : 'KeyJ', true);
        }
      }
    };
  };
  it('a perfect juggler scores near 1', () => expect(play(juggle(env('juggle')), 50, perfect())).toBeGreaterThan(0.9));
  it('doing nothing scores 0', () => expect(play(juggle(env('juggle')), 50, () => {})).toBe(0));
  it('mashing both hands every frame does not pay', () => expect(play(juggle(env('juggle')), 50, (g, _t, f) => g.key(f % 2 ? 'KeyF' : 'KeyJ', true))).toBeLessThan(0.25));
  it('mashing a few times a second does not pay either', () => expect(play(juggle(env('juggle')), 50, (g, _t, f) => f % 9 === 0 && g.key(f % 18 ? 'KeyF' : 'KeyJ', true))).toBeLessThan(0.45));
  it('a decent juggler lands mid-range', () => {
    rnd = 5;
    const seen = new Map<unknown, number>();
    const plan = new Map<unknown, number>();
    const q = play(juggle(env('juggle')), 50, (g) => {
      const p = g.peek!() as E;
      for (const e of p.eggs) {
        if (e.st !== 'fly' || e.to === 'bowl' || seen.get(e) === e.t1) continue;
        if (!plan.has(e) || plan.get(e) === -2) plan.set(e, rand() < 0.88 ? e.t1 + gauss() * 0.07 : -1);
        const at = plan.get(e)!;
        if (at < 0) {
          seen.set(e, e.t1);
          continue;
        }
        if (p.now >= at) {
          seen.set(e, e.t1);
          plan.set(e, -2);
          g.key(e.to === 'L' ? 'KeyF' : 'KeyJ', true);
        }
      }
    });
    expect(q).toBeGreaterThan(0.4);
    expect(q).toBeLessThan(0.85);
  });
});

describe('Fold', () => {
  type F = { p: [number, number]; v: [number, number]; grab: boolean; move?: { to: [number, number] }; home?: [number, number] };
  /** grabs the end, drags it onto the ring, waits for it to settle, lets go */
  const folder = (offset = 0) => (g: MiniGame) => {
    const s = g.peek!() as F;
    if (!s.move) return;
    if (!s.grab) return g.down(s.p[0], s.p[1]);
    g.move(s.move.to[0], s.move.to[1] + offset, true);
    const d = Math.hypot(s.p[0] - s.move.to[0], s.p[1] - s.move.to[1] - offset);
    if (d < 1.5 && Math.hypot(s.v[0], s.v[1]) < 8) g.up(0, 0);
  };
  it('folding onto every ring scores near 1', () => expect(play(fold(env('fold')), 50, folder())).toBeGreaterThan(0.9));
  it('folding a little off the middle is good, not perfect', () => {
    const q = play(fold(env('fold')), 50, folder(40));
    expect(q).toBeGreaterThan(0.6);
    expect(q).toBeLessThan(0.9);
  });
  it('letting go mid-swing (no waiting for it to settle) costs', () => {
    const q = play(fold(env('fold')), 50, (g) => {
      const s = g.peek!() as F;
      if (!s.move) return;
      if (!s.grab) return g.down(s.p[0], s.p[1]);
      g.move(s.move.to[0], s.move.to[1], true);
      // the finger is on the ring: let go at once, the dough still trailing behind
      g.up(0, 0);
    });
    expect(q).toBeLessThan(0.3);
  });
  it('doing nothing scores 0', () => expect(play(fold(env('fold')), 50, () => {})).toBe(0));
  it('scribbling all over the board does not pay', () => {
    rnd = 9;
    const q = play(fold(env('fold')), 50, (g, _t, f) => {
      const x = 300 + rand() * 840;
      const y = 140 + rand() * 600;
      if (f % 20 === 0) g.down(x, y);
      else if (f % 20 === 12) g.up(x, y);
      else g.move(x, y, true);
    });
    expect(q).toBeLessThan(0.2);
  });
  it('a pastry is done once its last move is placed, and the goal ends the game', () => {
    T = 0;
    vi.spyOn(audio, 'time').mockImplementation(() => T);
    const g = fold(env('fold'));
    const bot = folder();
    let t = 0;
    for (; t < 50 && !g.finished!(); t += 1 / 60) {
      T = t;
      g.update(t, 1 / 60);
      bot(g);
    }
    expect(g.finished!()).toBe(true);
    expect(t).toBeLessThan(45);
    expect(g.goal!()[0]).toBe(g.goal!()[1]);
  });
});
