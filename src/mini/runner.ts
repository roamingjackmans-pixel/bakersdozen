// Runs one mini game on the stage canvas: the 3-2-1, the clock, input (mouse, touch, keys), and everything laid
// over the game: modifiers (Flour Storm, Lights Out, Mirror Kitchen, Haunted, Swap Shop), a rival's Flour Cloud,
// and the Sheriff's geode. Backgrounds are drawn once; nothing uses canvas filters or shadows (smooth on phones).
import { audio } from '../audio/audio';
import { BAKER, GAMES, skillMult } from '../game/data';
import type { BuffId, GameId, GameResult, ModId, TwistId } from '../game/types';
import { onScale, stageScale } from '../ui/stage';
import { H, INK, W, rr, fillInk, sparkle, text, type Live, type MiniEnv, type MiniGame } from './common';
import { decorate } from './decorate';
import { knead } from './knead';
import { oven, type OvenLink } from './oven';
import { proof } from './proof';
import { rush } from './rush';
import { scale } from './scale';

export interface RunOpts {
  game: GameId;
  seed: number;
  seconds: number;
  baker: import('../game/types').BakerId;
  buffs: BuffId[];
  salted: boolean;
  rush: boolean;
  mods: ModId[];
  twist: TwistId | null;
  /** performance.now() when the game starts (after the countdown) */
  startAt: number;
  /** performance.now() of a rival's Flour Cloud, or 0 */
  flourAt: number;
  sheriff: boolean;
  link?: OvenLink;
  /** Swap Shop: the game it turns into halfway */
  swapTo?: GameId;
  label: string;
  onLive(l: Live): void;
  onDone(r: GameResult): void;
}

function envFor(o: RunOpts, game: GameId, seed: number): MiniEnv {
  // Swap Shop: each half is a game of its own length
  const seconds = o.swapTo ? o.seconds / 2 : o.seconds;
  const b = BAKER[o.baker];
  return {
    game,
    seed,
    seconds,
    baker: o.baker,
    coat: b.coat,
    light: b.light,
    skill: skillMult(o.baker, game),
    buffs: o.buffs,
    salted: o.salted,
    tiny: o.mods.includes('tiny') ? 0.7 : 1,
    rush: o.rush,
  };
}

function make(o: RunOpts, game: GameId, seed: number): MiniGame {
  const env = envFor(o, game, seed);
  switch (game) {
    case 'knead':
      return knead(env);
    case 'proof':
      return proof(env);
    case 'decorate':
      return decorate(env);
    case 'scale':
      return scale(env);
    case 'rush':
      return rush(env);
    default:
      return oven(env, o.link!);
  }
}

function offscreen(w: number, h: number, k: number, draw: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * k);
  c.height = Math.ceil(h * k);
  const g = c.getContext('2d')!;
  g.setTransform(k, 0, 0, k, 0, 0);
  draw(g);
  return c;
}

let cloudSprite: HTMLCanvasElement | null = null;
function cloud(): HTMLCanvasElement {
  cloudSprite ??= offscreen(320, 200, 1, (g) => {
    for (const [x, y, r] of [
      [100, 110, 70],
      [170, 80, 80],
      [240, 115, 62],
      [150, 130, 70],
      [210, 140, 55],
    ] as const) {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,250,240,0.95)');
      gr.addColorStop(0.65, 'rgba(255,250,240,0.75)');
      gr.addColorStop(1, 'rgba(255,250,240,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 320, 200);
    }
  });
  return cloudSprite;
}

let darkSprite: HTMLCanvasElement | null = null;
/** a dark sheet with a candle-lit hole in the middle, at half resolution (it is soft anyway) */
function darkness(): HTMLCanvasElement {
  darkSprite ??= offscreen(W, H, 1, (g) => {
    g.fillStyle = 'rgba(8,5,3,0.95)';
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out';
    const gr = g.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 130);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(0.7, 'rgba(0,0,0,0.85)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(255,170,80,0.08)';
    g.beginPath();
    g.arc(W / 2, H / 2, 120, 0, Math.PI * 2);
    g.fill();
  });
  return darkSprite;
}

export function runMini(host: HTMLElement, o: RunOpts): { stop(): void; game(): MiniGame } {
  const canvas = document.createElement('canvas');
  canvas.className = 'mini-canvas';
  host.appendChild(canvas);
  const g = canvas.getContext('2d', { alpha: false })!;
  let k = 1;
  let bg: HTMLCanvasElement | null = null;
  let games: MiniGame[] = [make(o, o.game, o.seed)];
  let gi = 0;
  const results: GameResult[] = [];
  const swapAt = o.swapTo ? o.startAt + (o.seconds * 1000) / 2 : 0;
  let swapped = false;
  let swapFlash = 0;
  const mirror = o.mods.includes('mirror');
  const lights = o.mods.includes('lightsout') || o.twist === 'blackout';
  const storm = o.mods.includes('flourstorm');
  const haunted = o.mods.includes('haunted');
  let px = W / 2;
  let py = H / 2;
  let pressed = false;
  let raf = 0;
  let slowAvg = 16;
  let slowFrames = 0;
  let last = performance.now();
  let stopped = false;
  let finished = false;
  let liveAt = 0;
  let lastCount = -1;
  let geode: { x: number; y: number; at: number; found: boolean; gone: boolean } | null = null;
  if (o.sheriff && (o.seed % 4 === 1 || o.seed % 7 === 3)) {
    geode = { x: 160 + (o.seed % 900), y: 160 + ((o.seed >> 4) % 420), at: o.startAt + (6 + (o.seed % 17)) * 1000, found: false, gone: false };
  }
  const clouds = storm ? [0, 1, 2, 3].map((i) => ({ x: i * 420 - 200, y: 120 + i * 150, s: 1.6 + (i % 2) * 0.6, v: 40 + i * 12 })) : [];

  // device pixels per stage pixel: capped at 1.5 (sharp enough on a retina screen, half the fill of 2×), and
  // stepped down by `slow` if frames keep running long on this device
  let slow = 1;
  let rect = { left: 0, top: 0, width: W, height: H };
  const resize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const nk = Math.min(1.5, Math.max(0.5, stageScale() * dpr)) * slow;
    const r = rect;
    rect = { left: r.left, top: r.top, width: r.width || W, height: r.height || H };
    if (Math.abs(nk - k) < 0.01 && canvas.width) return;
    k = nk;
    canvas.width = Math.round(W * k);
    canvas.height = Math.round(H * k);
    bg = null;
  };
  resize();
  const offScale = onScale(resize);

  const cur = (): MiniGame => games[gi]!;
  const toLocal = (e: PointerEvent): [number, number] => {
    const r = rect;
    let x = ((e.clientX - r.left) * W) / r.width;
    const y = ((e.clientY - r.top) * H) / r.height;
    if (mirror) x = W - x;
    return [x, y];
  };
  const started = (): boolean => performance.now() >= o.startAt;

  const onDown = (e: PointerEvent): void => {
    e.preventDefault();
    audio.unlock();
    try {
      canvas.setPointerCapture?.(e.pointerId);
    } catch {
      /* a pointer the browser does not track (synthetic): fine without capture */
    }
    const [x, y] = toLocal(e);
    px = x;
    py = y;
    pressed = true;
    if (geode && !geode.found && !geode.gone && performance.now() >= geode.at && Math.hypot(x - geode.x, y - geode.y) < 50) {
      geode.found = true;
      audio.sfx('achievement');
      return;
    }
    if (started() && !finished) cur().down(x, y);
  };
  const onMove = (e: PointerEvent): void => {
    const [x, y] = toLocal(e);
    px = x;
    py = y;
    if (started() && !finished) cur().move(x, y, pressed);
  };
  const onUp = (e: PointerEvent): void => {
    const [x, y] = toLocal(e);
    pressed = false;
    if (started() && !finished) cur().up(x, y);
  };
  const keyMap = (code: string): string => (mirror ? ({ KeyF: 'KeyJ', KeyJ: 'KeyF', ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft' } as Record<string, string>)[code] ?? code : code);
  const onKey = (e: KeyboardEvent): void => {
    if (e.repeat || !started() || finished) return;
    if (['Space', 'Enter'].includes(e.code) || /^(Digit|Numpad)\d$/.test(e.code)) e.preventDefault();
    cur().key(keyMap(e.code), e.type === 'keydown');
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  const finish = (): void => {
    if (finished) return;
    finished = true;
    results.push(cur().result());
    cur().stop?.();
    let res: GameResult;
    if (results.length > 1) {
      res = { ...results[0]!, ...results[1]!, q: (results[0]!.q + results[1]!.q) / 2, perfect: (results[0]!.perfect ?? 0) + (results[1]!.perfect ?? 0), natural20: results.some((r) => r.natural20), beatStreak: Math.max(...results.map((r) => r.beatStreak ?? 0)) };
    } else res = results[0]!;
    if (geode?.found) res.geode = true;
    audio.sfx('bell');
    setTimeout(() => o.onDone(res), 650);
  };

  const frame = (now: number): void => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    const frameMs = now - last;
    const dt = Math.min(0.05, frameMs / 1000);
    // a device that can't keep up: draw fewer pixels (once, after a couple of seconds of long frames)
    if (frameMs > 0 && frameMs < 200) {
      slowAvg = slowAvg * 0.97 + frameMs * 0.03;
      if (slowAvg > 24 && slow > 0.6 && ++slowFrames > 120) {
        slow -= 0.2;
        slowFrames = 0;
        slowAvg = 16;
        resize();
      }
    }
    last = now;
    const t = (now - o.startAt) / 1000;
    // Swap Shop: halfway, the game turns into another one
    if (swapAt && !swapped && now >= swapAt && !finished) {
      swapped = true;
      results.push(cur().result());
      cur().stop?.();
      games = [...games, make(o, o.swapTo!, o.seed ^ 0xbeef)];
      gi = 1;
      bg = null;
      swapFlash = 1;
      audio.sfx('swap');
    }
    if (!bg) {
      const gm = cur();
      bg = offscreen(W, H, k, (bgc) => (gm.background ? gm.background(bgc) : (bgc.fillStyle = '#2A1A12', bgc.fillRect(0, 0, W, H))));
    }
    if (t >= 0 && !finished) {
      cur().update(swapped ? t - o.seconds / 2 : t, dt);
      if (t >= o.seconds || cur().finished?.()) finish();
    }
    // draw
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(bg, 0, 0);
    g.setTransform(k, 0, 0, k, 0, 0);
    cur().draw(g, Math.max(0, t));
    // modifiers over the game
    if (storm) {
      const cs = cloud();
      g.globalAlpha = 0.55;
      for (const c of clouds) {
        c.x += c.v * dt;
        if (c.x > W + 100) c.x = -500;
        g.drawImage(cs, c.x, c.y + Math.sin(now / 1400 + c.v) * 30, 320 * c.s, 200 * c.s);
      }
      g.globalAlpha = 1;
    }
    if (haunted && t > 0) {
      const cyc = (now / 1000) % 14;
      if (cyc < 4) {
        const gx = -200 + (cyc / 4) * (W + 400);
        const gy = 300 + Math.sin(now / 500) * 60;
        g.globalAlpha = 0.5 * Math.sin((cyc / 4) * Math.PI);
        g.fillStyle = '#E8EEF8';
        g.beginPath();
        g.arc(gx, gy, 110, Math.PI, 0);
        g.lineTo(gx + 110, gy + 120);
        for (let i = 4; i >= 0; i--) g.lineTo(gx - 110 + i * 55, gy + 100 + (i % 2) * 30);
        g.closePath();
        g.fill();
        g.fillStyle = '#1E120C';
        g.beginPath();
        g.arc(gx - 36, gy - 10, 14, 0, Math.PI * 2);
        g.arc(gx + 36, gy - 10, 14, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }
    }
    if (geode && !geode.found && !geode.gone && now >= geode.at) {
      if (now > geode.at + 2600) geode.gone = true;
      else {
        g.globalAlpha = 0.6 + Math.sin(now / 80) * 0.4;
        sparkle(g, geode.x, geode.y, 16 + Math.sin(now / 120) * 6, '#E8D8FF');
        sparkle(g, geode.x + 10, geode.y - 12, 8, '#B79AF0');
        g.globalAlpha = 1;
      }
    }
    if (o.flourAt && now >= o.flourAt && now < o.flourAt + 3000) {
      const k2 = (now - o.flourAt) / 3000;
      const a = k2 < 0.15 ? k2 / 0.15 : k2 > 0.7 ? (1 - k2) / 0.3 : 1;
      if (k2 < 0.02) audio.sfx('flour');
      const cs = cloud();
      g.globalAlpha = 0.92 * a;
      for (let i = 0; i < 7; i++) g.drawImage(cs, -120 + (i % 4) * 400 + Math.sin(i * 3 + now / 700) * 40, -60 + Math.floor(i / 4) * 380, 620, 420);
      g.globalAlpha = 1;
    }
    if (lights) g.drawImage(darkness(), px - W, py - H, W * 2, H * 2);
    if (mirror) {
      // where your hand really is on a mirrored counter
      g.beginPath();
      g.arc(px, py, 14, 0, Math.PI * 2);
      g.strokeStyle = INK;
      g.lineWidth = 5;
      g.stroke();
      g.strokeStyle = '#F2A541';
      g.lineWidth = 3;
      g.stroke();
    }
    hud(g, now, t);
    if (swapFlash > 0) {
      swapFlash = Math.max(0, swapFlash - dt * 0.8);
      g.globalAlpha = Math.min(1, swapFlash * 2);
      text(g, 'Swap', W / 2, H / 2, { size: 120, color: '#FFD166', stroke: 12 });
      text(g, GAMES[o.swapTo!].how, W / 2, H / 2 + 90, { size: 34, font: 'ui', stroke: 7 });
      g.globalAlpha = 1;
    }
    // live progress for everyone's corner, ~5 times a second
    if (t > 0 && now - liveAt > 200 && !finished) {
      liveAt = now;
      o.onLive(cur().live());
    }
  };

  function hud(gc: CanvasRenderingContext2D, now: number, t: number): void {
    // the clock
    const left = Math.max(0, o.seconds - Math.max(0, t));
    const k2 = left / o.seconds;
    rr(gc, 380, 22, 560, 34, 17);
    fillInk(gc, '#DCC7A0', 3);
    rr(gc, 384, 26, Math.max(0, 552 * k2), 26, 13);
    gc.fillStyle = k2 < 0.2 ? '#A8322D' : '#F2A541';
    gc.fill();
    text(gc, `${Math.ceil(left)}`, 975, 40, { size: 30, stroke: 6 });
    text(gc, (swapped ? GAMES[o.swapTo!] : GAMES[o.game]).name, 260, 40, { size: 30, stroke: 6 });
    text(gc, o.label, 260, 76, { size: 18, font: 'ui', color: '#F3E6CF', stroke: 4 });
    if (o.salted) text(gc, 'Salted', 1060, 40, { size: 22, color: '#FFFDF8', stroke: 5, font: 'ui' });
    if (left <= 5 && left > 0) {
      const sec = Math.ceil(left);
      if (sec !== lastCount) {
        lastCount = sec;
        audio.sfx('tick');
      }
    }
    // 3, 2, 1
    if (t < 0) {
      gc.fillStyle = 'rgba(20,12,8,0.55)';
      gc.fillRect(0, 0, W, H);
      const n = Math.ceil(-t);
      if (n !== lastCount && n <= 3) {
        lastCount = n;
        audio.sfx('count');
      }
      const def = GAMES[o.game];
      text(gc, def.name, W / 2, 250, { size: 84, stroke: 10, color: def.color });
      text(gc, def.how, W / 2, 340, { size: 36, font: 'ui', stroke: 7 });
      text(gc, def.input, W / 2, 395, { size: 24, font: 'ui', color: '#F3E6CF', stroke: 5 });
      if (o.salted) text(gc, 'Salted', W / 2, 460, { size: 34, color: '#FFFDF8', stroke: 7 });
      const sc = 1 + ((-t) % 1) * 0.4;
      gc.save();
      gc.translate(W / 2, 590);
      gc.scale(sc, sc);
      text(gc, `${Math.max(1, n)}`, 0, 0, { size: 140, stroke: 12, color: '#FFD166' });
      gc.restore();
    } else if (t < 0.6) {
      if (lastCount !== 0) {
        lastCount = 0;
        audio.sfx('go');
      }
      gc.globalAlpha = 1 - t / 0.6;
      text(gc, 'Bake!', W / 2, H / 2, { size: 130, stroke: 12, color: '#FFD166' });
      gc.globalAlpha = 1;
    }
    if (finished) {
      gc.fillStyle = 'rgba(20,12,8,0.45)';
      gc.fillRect(0, 0, W, H);
      text(gc, 'Time', W / 2, H / 2, { size: 130, stroke: 12, color: '#FFF4E0' });
    }
    void now;
  }

  raf = requestAnimationFrame(frame);
  if (import.meta.env.DEV) (window as unknown as { __mini: unknown }).__mini = { cur, started, o, isFinished: () => finished, now: () => performance.now() };
  return {
    stop(): void {
      stopped = true;
      cancelAnimationFrame(raf);
      for (const gm of games) gm.stop?.();
      offScale();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      canvas.remove();
      // free the backing stores now (iOS Safari holds canvas memory until a garbage collection)
      canvas.width = canvas.height = 0;
      if (bg) bg.width = bg.height = 0;
      bg = null;
    },
    game: () => cur(),
  };
}
