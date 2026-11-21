// What every mini game shares: the interface the runner drives, the storybook drawing helpers (chunky shapes with a
// dark ink outline, no canvas filters or shadows), pooled particles, and pre-rendered backgrounds.
import type { BakerId, BuffId, GameId, GameResult } from '../game/types';

export const W = 1440;
export const H = 810;
export const INK = '#1E120C';
export const DISPLAY = 'Fraunces, Georgia, serif';
export const UI = 'Nunito, system-ui, sans-serif';

export interface MiniEnv {
  game: GameId;
  /** the same content for every baker this round (fair races) */
  seed: number;
  seconds: number;
  baker: BakerId;
  coat: string;
  light: string;
  /** this baker's skill multiplier for the game (wider windows, longer looks) */
  skill: number;
  buffs: BuffId[];
  salted: boolean;
  /** Tiny Kitchen: 0.7, else 1 */
  tiny: number;
  rush: boolean;
}

export interface Live {
  v: number;
  c: number;
  e: string;
}

export interface MiniGame {
  update(t: number, dt: number): void;
  draw(g: CanvasRenderingContext2D, t: number): void;
  down(x: number, y: number): void;
  move(x: number, y: number, pressed: boolean): void;
  up(x: number, y: number): void;
  key(code: string, down: boolean): void;
  live(): Live;
  result(): GameResult;
  /** the background, drawn once into an offscreen canvas */
  background?(g: CanvasRenderingContext2D): void;
  /** the game has nothing left to do (the runner ends it early) */
  finished?(): boolean;
  /** how far through its own content (for Swap Shop's handover) */
  stop?(): void;
  /** tests only: the game's hidden state, so a bot can play it */
  peek?(): Record<string, unknown>;
}

// ------------------------------------------------------------------ drawing helpers

export function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + k, y);
  g.arcTo(x + w, y, x + w, y + h, k);
  g.arcTo(x + w, y + h, x, y + h, k);
  g.arcTo(x, y + h, x, y, k);
  g.arcTo(x, y, x + w, y, k);
  g.closePath();
}

export function fillInk(g: CanvasRenderingContext2D, fill: string, lw = 3): void {
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = lw;
  g.strokeStyle = INK;
  g.lineJoin = 'round';
  g.stroke();
}

export function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, lw = 3): void {
  g.beginPath();
  g.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
  if (lw > 0) fillInk(g, fill, lw);
  else {
    g.fillStyle = fill;
    g.fill();
  }
}

export function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, lw = 3, rot = 0): void {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  if (lw > 0) fillInk(g, fill, lw);
  else {
    g.fillStyle = fill;
    g.fill();
  }
}

export function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, o: { size?: number; weight?: number; color?: string; align?: CanvasTextAlign; font?: 'display' | 'ui'; stroke?: number; base?: CanvasTextBaseline } = {}): void {
  g.font = `${o.weight ?? 900} ${o.size ?? 24}px ${o.font === 'ui' ? UI : DISPLAY}`;
  g.textAlign = o.align ?? 'center';
  g.textBaseline = o.base ?? 'middle';
  if (o.stroke) {
    g.lineWidth = o.stroke;
    g.strokeStyle = INK;
    g.lineJoin = 'round';
    g.strokeText(s, x, y);
  }
  g.fillStyle = o.color ?? '#FFF4E0';
  g.fillText(s, x, y);
}

/** the wooden counter top most games sit on */
export function woodBackground(g: CanvasRenderingContext2D, top = '#3A2419', board = '#8A5A35'): void {
  g.fillStyle = '#2A1A12';
  g.fillRect(0, 0, W, H);
  // wall planks
  for (let x = 0; x < W; x += 120) {
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(x, 0, 2, H);
    g.fillStyle = 'rgba(255,220,170,0.03)';
    g.fillRect(x + 2, 0, 40, H);
  }
  // warm candle glow corners (drawn once, so a gradient is fine here)
  for (const [cx, cy, r] of [
    [140, 0, 520],
    [1300, 40, 460],
  ] as const) {
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, 'rgba(255,170,80,0.16)');
    gr.addColorStop(1, 'rgba(255,170,80,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
  // the counter
  g.fillStyle = top;
  g.fillRect(0, 560, W, 250);
  rr(g, -20, 540, W + 40, 60, 14);
  fillInk(g, board, 3);
  for (let y = 552; y < 600; y += 11) {
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, y, W, 2);
  }
}

/** a floured wooden board seen from above */
export function board(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  rr(g, x, y, w, h, 28);
  fillInk(g, '#C8904E', 4);
  for (let i = 1; i < 8; i++) {
    g.fillStyle = 'rgba(120,70,30,0.18)';
    g.fillRect(x + 12, y + (h / 8) * i, w - 24, 3);
  }
  // flour dusting
  for (let i = 0; i < 160; i++) {
    const a = (i * 137.5 * Math.PI) / 180;
    const rad = Math.sqrt(i / 160) * Math.min(w, h) * 0.45;
    g.fillStyle = `rgba(255,248,234,${0.25 + (i % 5) * 0.06})`;
    g.beginPath();
    g.arc(x + w / 2 + Math.cos(a) * rad * (w / h), y + h / 2 + Math.sin(a) * rad, 2 + (i % 4), 0, Math.PI * 2);
    g.fill();
  }
}

/** a lump of dough: r radius, squash 0..1, sheen */
export function dough(g: CanvasRenderingContext2D, x: number, y: number, r: number, squash = 0, color = '#F3D9A4'): void {
  const rx = r * (1 + squash * 0.35);
  const ry = r * (1 - squash * 0.3);
  ellipse(g, x, y + r * 0.08, rx, ry, color, 4);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.ellipse(x - rx * 0.32, y - ry * 0.35, rx * 0.28, ry * 0.16, -0.4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(160,110,50,0.12)';
  g.beginPath();
  g.ellipse(x + rx * 0.2, y + ry * 0.45, rx * 0.55, ry * 0.25, 0, 0, Math.PI * 2);
  g.fill();
}

export function star(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill = '#E8B84A', lw = 2.5): void {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  g.closePath();
  fillInk(g, fill, lw);
}

export function sparkle(g: CanvasRenderingContext2D, x: number, y: number, r: number, color = '#FFE7A3'): void {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x + r * 0.12, y - r * 0.12, x + r, y);
  g.quadraticCurveTo(x + r * 0.12, y + r * 0.12, x, y + r);
  g.quadraticCurveTo(x - r * 0.12, y + r * 0.12, x - r, y);
  g.quadraticCurveTo(x - r * 0.12, y - r * 0.12, x, y - r);
  g.fill();
}

// ------------------------------------------------------------------ particles (pooled: no garbage per frame)

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  color: string;
  kind: 0 | 1 | 2 | 3; // puff, spark, star, text-less dot
  g: number;
}

export class Particles {
  items: Particle[] = [];
  private pool: Particle[] = [];
  spawn(x: number, y: number, n: number, o: Partial<Particle> & { speed?: number; spread?: number; dir?: number } = {}): void {
    for (let i = 0; i < n; i++) {
      const p = this.pool.pop() ?? ({} as Particle);
      const a = (o.dir ?? -Math.PI / 2) + (Math.random() - 0.5) * (o.spread ?? Math.PI * 2);
      const sp = (o.speed ?? 180) * (0.4 + Math.random() * 0.8);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.max = p.life = (o.life ?? 0.7) * (0.6 + Math.random() * 0.6);
      p.r = (o.r ?? 6) * (0.6 + Math.random() * 0.8);
      p.color = o.color ?? '#FFF8EA';
      p.kind = o.kind ?? 0;
      p.g = o.g ?? 300;
      this.items.push(p);
    }
  }
  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        this.items[i] = this.items[this.items.length - 1]!;
        this.items.pop();
        this.pool.push(p);
        continue;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.985;
    }
  }
  draw(g: CanvasRenderingContext2D): void {
    for (const p of this.items) {
      const k = p.life / p.max;
      g.globalAlpha = Math.min(1, k * 1.5);
      if (p.kind === 1) sparkle(g, p.x, p.y, p.r * (0.6 + k * 0.6), p.color);
      else if (p.kind === 2) star(g, p.x, p.y, p.r, p.color, 1.5);
      else {
        g.fillStyle = p.color;
        g.beginPath();
        g.arc(p.x, p.y, p.r * (p.kind === 0 ? 1.6 - k * 0.6 : 1), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  }
}

/** floating "+3" / grade labels */
export class Floaters {
  items: { s: string; x: number; y: number; life: number; color: string; size: number }[] = [];
  add(s: string, x: number, y: number, color = '#FFF4E0', size = 34): void {
    this.items.push({ s, x, y, life: 1, color, size });
    if (this.items.length > 14) this.items.shift();
  }
  update(dt: number): void {
    for (const f of this.items) {
      f.life -= dt * 1.1;
      f.y -= dt * 60;
    }
    this.items = this.items.filter((f) => f.life > 0);
  }
  draw(g: CanvasRenderingContext2D): void {
    for (const f of this.items) {
      g.globalAlpha = Math.min(1, f.life * 2);
      text(g, f.s, f.x, f.y, { size: f.size, color: f.color, stroke: 6 });
    }
    g.globalAlpha = 1;
  }
}

export const GRADE_COLORS = { perfect: '#FFD166', good: '#A8D69F', miss: '#E06B5F' };

/** a seeded random stream for game content */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    let t = (s = (s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

const rasters = new WeakMap<HTMLImageElement, Map<number, HTMLCanvasElement>>();
/** draw an SVG sprite through a bitmap made once at 2× its drawn size */
export function blit(g: CanvasRenderingContext2D, img: HTMLImageElement | undefined, x: number, y: number, w: number, h: number): void {
  if (!img || !img.complete || !img.naturalWidth) return;
  let m = rasters.get(img);
  if (!m) rasters.set(img, (m = new Map()));
  const key = Math.round(w) * 10000 + Math.round(h);
  let c = m.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * 2));
    c.height = Math.max(1, Math.round(h * 2));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    m.set(key, c);
  }
  g.drawImage(c, x, y, w, h);
}
