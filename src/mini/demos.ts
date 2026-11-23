// How to play each mini game, as a short looping picture: the glove doing the move on the very spot it's done (and at
// the moment it's done), over the game's own scenery. It plays over the dimmed game during the 3-2-1 and on the order
// card in the bakery, so nobody needs the sound or a paragraph of rules to know where to tap.
// Everything here is drawn in the game's 1440×810 coordinates with the games' own drawing helpers, so the picture
// lines up with the real thing underneath.
import type { GameId } from '../game/types';
import { PANTRY, pantrySVG, sprite } from '../render/art';
import { portrait } from '../render/portraits';
import { stageScale } from '../ui/stage';
import { INK, blit, board, cue, dough, ellipse, fillInk, loop, pill, rr, text, woodBackground } from './common';
import { CX as DCX, CY as DCY, cakeBase, guide, pipingBag } from './decorate';
import { SHAPES, foldBoard, foldRing, grabDot, pretzel } from './fold';
import { HY, LX, RX, basket, catchRing, closingRing, egg, eggBowl, hand } from './juggle';
import { cookBody, itemIcon, kitchenFloor } from './kitchen';
import { LAYOUT } from '../game/kitchen';
import { CX as KX, CY as KY, R as KR, approachRing, targetRing } from './knead';
import { OY, PREP, SLOT_W, arch, ovenWall, slotX, trayColor } from './oven';
import { BX, BY, bowl, riseMark, ruler } from './proof';
import { SLOT_H, SLOT_W as PANTRY_W, bubbleX, customer, nextSpot, pantryBack, slotXY } from './rush';
import { DR, DX, DY, SACK, WEIGH, dial, flourBowl, housing, sack, weighButton } from './scale';

export interface Demo {
  /** the part of the game to show on the order card: x, y, w, h (16:9) */
  box: [number, number, number, number];
  /** the scenery under it (the order card only: in the 3-2-1 the real game is underneath) */
  bg(g: CanvasRenderingContext2D): void;
  draw(g: CanvasRenderingContext2D, time: number): void;
}

const ease = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v * v * (3 - 2 * v));

/** a word that floats up and fades, starting at `at` in the loop */
function word(g: CanvasRenderingContext2D, s: string, x: number, y: number, p: number, at: number, color = '#FFD166', size = 38): void {
  if (p < at || p > at + 0.2) return;
  const k = (p - at) / 0.2;
  g.globalAlpha = 1 - k;
  text(g, s, x, y - k * 40, { size, color, stroke: 6 });
  g.globalAlpha = 1;
}

let pantryImgs: HTMLImageElement[] | null = null;
const pantry = (): HTMLImageElement[] => (pantryImgs ??= PANTRY.map((p) => sprite(`pantry-${p.id}`, pantrySVG(p.id, 96))));

/** a tray of three loaves in an oven slot, `lv` baked (0..1), with its timer ring at `f` (0..1) */
function demoTray(g: CanvasRenderingContext2D, x: number, lv: number, zone: string, f: number, gold: [number, number]): void {
  const cx = x + SLOT_W / 2;
  const cy = OY + 92;
  rr(g, x + 10, cy + 8, SLOT_W - 20, 22, 6);
  fillInk(g, '#55555E', 3);
  for (let k = -1; k <= 1; k++) ellipse(g, cx + k * 34, cy, 18, 14, trayColor(lv, zone), 3);
  const R = 52;
  const ang = (v: number): number => -Math.PI / 2 + v * Math.PI * 2;
  g.lineWidth = 8;
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.beginPath();
  g.arc(cx, cy - 6, R, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = '#E9A54A';
  g.beginPath();
  g.arc(cx, cy - 6, R, ang(gold[0]), ang(gold[1]));
  g.stroke();
  g.strokeStyle = '#5A2A1A';
  g.beginPath();
  g.arc(cx, cy - 6, R, ang(gold[1]), ang(1));
  g.stroke();
  const a = ang(f);
  const dot = zone === 'raw' ? '#FFF4E0' : zone === 'dark' ? '#E06B5F' : '#FFD166';
  ellipse(g, cx + Math.cos(a) * R, cy - 6 + Math.sin(a) * R, 9, 9, dot, 3);
}

export const DEMOS: Record<GameId, Demo> = {
  // a ring closes onto the dough; the glove taps the moment it lands, the target flashes and the board pulses
  knead: {
    box: [KX - 360, KY - 205, 720, 405],
    bg(g) {
      woodBackground(g);
      board(g, KX - 330, KY - 230, 660, 460);
    },
    draw(g, time) {
      const P = 1.2;
      const HIT = 0.8;
      const p = loop(time, P);
      const after = p - HIT;
      const flash = after >= 0 && after < 0.12 ? 1 - after / 0.12 : 0;
      if (flash > 0) {
        g.globalAlpha = flash * 0.7;
        g.strokeStyle = '#F2C14E';
        g.lineWidth = 10;
        rr(g, KX - 336, KY - 236, 672, 472, 32);
        g.stroke();
        g.globalAlpha = 1;
      }
      if (p < HIT) approachRing(g, 1 - p / HIT, 1, true);
      targetRing(g, flash);
      dough(g, KX, KY, KR, after >= 0 && after < 0.16 ? 1 - after / 0.16 : 0, '#F3DCA8');
      word(g, 'Perfect', KX, KY - KR - 40, p, HIT);
      cue(g, KX, KY + 40, 'tap', loop(time, P, 0.5 - HIT), { label: 'TAP · SPACE' });
    },
  },
  // hold: the dough rises; it trembles near the top; let go and it bakes
  proof: {
    box: [150, 110, 960, 540],
    bg(g) {
      woodBackground(g);
      ruler(g);
    },
    draw(g, time) {
      const P = 3.6;
      const UP = 0.1;
      const LET = 0.72;
      const p = loop(time, P);
      const h = p < UP ? 0 : p < LET ? ease((p - UP) / (LET - UP)) * 0.9 : 0.9;
      const tremble = p > LET - 0.14 && p < LET;
      const top = bowl(g, h, p >= LET ? '#D98A3A' : '#F3D9A4', tremble ? Math.sin(time * 70) * 5 : 0);
      riseMark(g, h);
      if (p < LET) cue(g, BX, BY - 70, 'hold', Math.min(0.999, p / LET), { label: tremble ? 'LET GO' : 'HOLD · SPACE' });
      else cue(g, BX, BY - 70, 'release', 0.3 + ((p - LET) / (1 - LET)) * 0.7, { label: 'LET GO' });
      word(g, 'Perfect', BX, top - 40, p, LET + 0.02);
    },
  },
  // the glove drags the piping bag from the green dot along the line, icing behind it
  decorate: (() => {
    const path: [number, number][] = Array.from({ length: 61 }, (_, i) => [-170 + (i * 340) / 60, -60 * Math.sin((i / 60) * Math.PI * 2)]);
    const covered = new Uint8Array(path.length);
    return {
      box: [200, 140, 800, 450],
      bg(g) {
        woodBackground(g);
        ellipse(g, DCX, DCY + 250, 300, 40, '#6B4428', 4);
        rr(g, DCX - 30, DCY + 200, 60, 60, 8);
        fillInk(g, '#5A3A22', 3);
      },
      draw(g, time) {
        const P = 2.8;
        const p = loop(time, P);
        const n = path.length;
        const m = p < 0.12 ? 0 : Math.min(1, (p - 0.12) / 0.62);
        const upto = Math.floor(m * (n - 1));
        covered.fill(0);
        if (m > 0) covered.fill(1, 0, upto + 1);
        g.save();
        g.translate(DCX, DCY);
        cakeBase(g, 'cake');
        guide(g, n, (i) => path[i]!, covered, time, 26);
        if (upto > 0) {
          g.lineCap = 'round';
          g.lineJoin = 'round';
          g.beginPath();
          g.moveTo(path[0]![0], path[0]![1]);
          for (let i = 1; i <= upto; i++) g.lineTo(path[i]![0], path[i]![1]);
          g.lineWidth = 20;
          g.strokeStyle = INK;
          g.stroke();
          g.lineWidth = 16;
          g.strokeStyle = '#F0A8CF';
          g.stroke();
        }
        g.restore();
        const [x, y] = path[upto]!;
        pipingBag(g, DCX + x, DCY + y);
        if (p < 0.12) cue(g, DCX + path[0]![0], DCY + path[0]![1], 'tap', (p / 0.12) * 0.5, { label: 'DRAG' });
        else if (m < 1) cue(g, DCX + x, DCY + y, 'press', 0, { label: 'DRAG' });
        else cue(g, DCX + x, DCY + y, 'release', 0.3 + ((p - 0.74) / 0.26) * 0.7);
        word(g, 'Perfect', DCX, DCY - 200, p, 0.76);
      },
    };
  })(),
  // hold the sack: flour pours and the needle climbs to the red target mark; then tap Weigh
  scale: {
    box: [100, 110, 1150, 647],
    bg: housing,
    draw(g, time) {
      const P = 4;
      const POUR0 = 0.1;
      const POUR1 = 0.55;
      const TAP = 0.72;
      const p = loop(time, P);
      const grams = p < POUR0 ? 0 : p < POUR1 ? ease((p - POUR0) / (POUR1 - POUR0)) * 600 : 600;
      const pouring = p >= POUR0 && p < POUR1;
      // the target card
      rr(g, 120, 120, 250, 130, 14);
      fillInk(g, '#F3E3C3', 4);
      text(g, 'Target', 245, 150, { size: 20, color: '#8A5A35', font: 'ui' });
      text(g, '600 g', 245, 205, { size: 52, color: '#2A1A12' });
      sack(g, pouring ? Math.min(1, (p - POUR0) / 0.25) : 0);
      flourBowl(g, grams);
      dial(g, grams + (pouring ? Math.sin(time * 9) * 12 : 0), 600, false);
      const tapped = p >= TAP;
      weighButton(g, grams > 0 && !tapped, grams > 0 && !tapped ? 0.3 : 0);
      if (p < POUR1) cue(g, SACK.x, SACK.y + 20, 'hold', Math.min(0.999, p / POUR1), { label: 'HOLD TO POUR' });
      else if (p < TAP + 0.12) cue(g, WEIGH.x + WEIGH.w / 2, WEIGH.y + 12, 'tap', loop(time, P, 0.5 - TAP), { above: true, label: 'TAP' });
      if (tapped) text(g, '600 g', DX, DY + 90, { size: 40, color: '#2A1A12' });
      word(g, 'Exact', DX, DY - DR - 40, p, TAP + 0.01, '#FFD166', 42);
    },
  },
  // the customer shows the recipe, it hides, the glove taps the same things back in the same order
  rush: {
    box: [60, 70, 1262, 710],
    bg: pantryBack,
    draw(g, time) {
      const P = 5;
      const SHOW = 0.34;
      const items = [0, 1, 2];
      const taps = [0.48, 0.63, 0.78];
      const p = loop(time, P);
      const imgs = pantry();
      const showing = p < SHOW;
      const got = taps.filter((x) => p >= x).length;
      customer(g);
      if (showing) {
        items.forEach((it, i) => {
          blit(g, imgs[it], bubbleX(i, 3) - 44, 156, 88, 88);
          text(g, `${i + 1}`, bubbleX(i, 3), 268, { size: 18, color: '#8A5A35', font: 'ui' });
        });
        rr(g, 170, 290, 800 * (1 - p / SHOW), 8, 4);
        g.fillStyle = '#C3B0F0';
        g.fill();
        pill(g, 'REMEMBER', 570, 340, 24);
      } else {
        if (got < 3) nextSpot(g, bubbleX(got, 3), time);
        for (let i = 0; i < 3; i++) {
          if (i < got) blit(g, imgs[items[i]!], bubbleX(i, 3) - 40, 160, 80, 80);
          else text(g, '?', bubbleX(i, 3), 200, { size: 64, color: '#C8B89A' });
        }
        pill(g, 'TAP THEM IN ORDER', 560, 442, 24);
      }
      for (let i = 0; i < 8; i++) {
        const [x, y] = slotXY(i);
        rr(g, x, y, PANTRY_W, SLOT_H, 18);
        const lit = taps.some((tp, k) => items[k] === i && p >= tp && p < tp + 0.07);
        fillInk(g, lit ? '#A8D69F' : showing ? '#C9B58E' : '#F3E3C3', 4);
        blit(g, imgs[i], x + PANTRY_W / 2 - 44, y + 14, 88, 88);
        text(g, `${i + 1}`, x + 18, y + 18, { size: 18, color: '#8A5A35', font: 'ui' });
      }
      if (!showing && p < 0.86) {
        const k = Math.min(2, got);
        const at = got < 3 ? taps[got]! : taps[2]!;
        const [x, y] = slotXY(items[k]!);
        const ph = got < 3 ? Math.max(0, 0.5 - ((at - p) * P) / 0.9) : 0.5 + ((p - at) * P) / 0.9;
        cue(g, x + PANTRY_W / 2, y + SLOT_H / 2, 'tap', Math.min(0.999, ph));
      }
      word(g, 'Order up', 640, 120, p, 0.8, '#FFD166', 40);
    },
  },
  // tap an empty slot to put your tray in; when its ring reaches gold the tray says PULL: tap it
  oven: {
    box: [300, 190, 620, 349],
    bg: ovenWall,
    draw(g, time) {
      const P = 4.6;
      const LOAD = 0.1;
      const IN = 0.14;
      const GOLD0 = 0.5;
      const PULL = 0.6;
      const GOLD1 = 0.68;
      const END = 0.8;
      const p = loop(time, P);
      for (let i = 0; i < 3; i++) arch(g, slotX(i, 3), 0.5 + Math.sin(time * 7) * 0.08);
      const x = slotX(1, 3);
      const cx = x + SLOT_W / 2;
      if (p >= IN && p < PULL) {
        const zone = p < GOLD0 ? 'raw' : p < GOLD1 ? 'golden' : 'dark';
        const span = END - IN;
        demoTray(g, x, Math.min(1, (p - IN) / (GOLD0 - IN)), zone, (p - IN) / span, [(GOLD0 - IN) / span, (GOLD1 - IN) / span]);
        if (zone === 'golden') {
          g.save();
          g.translate(cx, OY - 40);
          const s = 1 + 0.06 * Math.sin(time * 9);
          g.scale(s, s);
          pill(g, 'PULL', 0, 0, 26);
          g.restore();
        }
      } else if (p < IN) {
        g.strokeStyle = '#FFF4E0';
        g.lineWidth = 8;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(cx - 18, OY + 80);
        g.lineTo(cx + 18, OY + 80);
        g.moveTo(cx, OY + 62);
        g.lineTo(cx, OY + 98);
        g.stroke();
      }
      if (p < IN + 0.06) cue(g, cx, OY + 80, 'tap', loop(time, P, 0.5 - LOAD), { label: 'LOAD · 1-9' });
      else if (p > GOLD0 - 0.05 && p < PULL + 0.1) cue(g, cx, OY + 92, 'tap', loop(time, P, 0.5 - PULL));
      word(g, 'Perfect', cx, OY - 30, p, PULL);
    },
  },
  // an egg arcs from hand to hand; a ring closes onto the hand it drops into and the glove taps as it lands
  juggle: {
    box: [260, 150, 920, 518],
    bg(g) {
      woodBackground(g);
      basket(g);
    },
    draw(g, time) {
      const P = 2.6;
      const p = loop(time, P);
      // left to right in the first half, back in the second
      const half = p < 0.5 ? p / 0.5 : (p - 0.5) / 0.5;
      const from = p < 0.5 ? LX : RX;
      const to = p < 0.5 ? RX : LX;
      const x = from + (to - from) * half;
      const y = HY - 10 - 4 * 330 * half * (1 - half);
      eggBowl(g, 0.3);
      hand(g, 'L', '#5E9A58', '#E0A97E', p > 0.96 || p < 0.04 ? 10 : 0);
      hand(g, 'R', '#5E9A58', '#E0A97E', Math.abs(p - 0.5) < 0.04 ? 10 : 0);
      catchRing(g, 'L', p > 0.97 || p < 0.03 ? 1 : 0);
      catchRing(g, 'R', Math.abs(p - 0.5) < 0.03 ? 1 : 0);
      if (half > 0.55) closingRing(g, to === RX ? 'R' : 'L', (1 - half) / 0.45);
      egg(g, x, y, time * 5, 2);
      const land = to === RX ? 'R' : 'L';
      cue(g, land === 'R' ? RX : LX, HY + 4, 'tap', Math.min(0.999, 0.5 - (1 - half) * 0.6), { label: land === 'R' ? 'TAP · J' : 'TAP · F' });
      word(g, 'Perfect', land === 'R' ? LX : RX, HY - 90, half, 0.02);
    },
  },
  // grab the green end of the dough, drag it to the gold ring, let go on it
  fold: {
    box: [280, 130, 880, 495],
    bg: foldBoard,
    draw(g, time) {
      const P = 2.8;
      const p = loop(time, P);
      const m = SHAPES.pretzel[0]!;
      const DRAG0 = 0.12;
      const DRAG1 = 0.62;
      const LET = 0.74;
      const k = p < DRAG0 ? 0 : p < DRAG1 ? ease((p - DRAG0) / (DRAG1 - DRAG0)) : 1;
      // the end trails the finger and swings a little past before it settles
      const swing = p > DRAG1 && p < LET ? Math.sin(((p - DRAG1) / (LET - DRAG1)) * Math.PI * 2) * 14 * (1 - (p - DRAG1) / (LET - DRAG1)) : 0;
      const e1: [number, number] = [m.from[0] + (m.to[0] - m.from[0]) * k + swing, m.from[1] + (m.to[1] - m.from[1]) * k + swing * 0.6];
      pretzel(g, e1, [1020, 250]);
      foldRing(g, m.to[0], m.to[1], 36, p > DRAG1, time);
      if (p < DRAG0) {
        grabDot(g, m.from[0], m.from[1], time);
        cue(g, m.from[0], m.from[1], 'tap', (p / DRAG0) * 0.5, { label: 'DRAG' });
      } else if (p < LET) cue(g, e1[0], e1[1], 'press', 0, { label: p > DRAG1 + 0.06 ? 'LET GO' : 'DRAG' });
      else cue(g, e1[0], e1[1], 'release', 0.3 + ((p - LET) / (1 - LET)) * 0.7);
      word(g, 'Perfect', m.to[0], m.to[1] - 60, p, LET + 0.01);
    },
  },
  // a cook walks flour → mixer → board (three kneads) → oven → hatch, the glove tapping each station as it goes
  kitchen: (() => {
    const at = (i: number): [number, number] => [LAYOUT[i]!.sx, LAYOUT[i]!.sy];
    // station index, the moment the glove taps it, what the cook carries after, its label
    const stops: [number, number, string | null, string][] = [
      [0, 0.04, 'flour', 'FLOUR'],
      [1, 0.2, 'dough', 'MIX'],
      [6, 0.38, 'shaped', 'KNEAD'],
      [3, 0.56, null, 'BAKE'],
      [3, 0.72, 'loaf', 'PULL'],
      [9, 0.9, null, 'SERVE'],
    ];
    return {
      box: [120, 90, 1280, 720],
      bg: kitchenFloor,
      draw(g, time) {
        const P = 9;
        const p = loop(time, P);
        let i = stops.findIndex((s) => p < s[1]);
        if (i < 0) i = stops.length;
        const prev = stops[Math.max(0, i - 1)]!;
        const next = stops[Math.min(stops.length - 1, i)]!;
        const a = i === 0 ? at(9) : at(prev[0]);
        const b = at(next[0]);
        const t0 = i === 0 ? 0 : prev[1] + 0.03;
        const k = i >= stops.length ? 1 : Math.max(0, Math.min(1, (p - t0) / Math.max(0.01, next[1] - 0.02 - t0)));
        const x = a[0] + (b[0] - a[0]) * ease(k);
        const y = a[1] + (b[1] - a[1]) * ease(k);
        const hold = i === 0 ? null : (prev[2] as Parameters<typeof itemIcon>[1] | null);
        // what's in the oven between BAKE and PULL
        const ov = LAYOUT[3]!;
        if (p >= 0.56 && p < 0.72) {
          const lv = (p - 0.56) / 0.16;
          ellipse(g, ov.x + ov.w / 2, ov.y + ov.h / 2 - 4, 30, 17, lv < 0.7 ? '#EFCB86' : '#E9A54A', 3);
        }
        const st = LAYOUT[next[0]]!;
        if (i < stops.length) {
          g.globalAlpha = 0.6 + 0.4 * Math.sin(time * 6);
          g.strokeStyle = '#FFD166';
          g.lineWidth = 6;
          rr(g, st.x - 6, st.y - 6, st.w + 12, st.h + 12, 16);
          g.stroke();
          g.globalAlpha = 1;
          const below = st.k === 'mixer' || st.k === 'oven';
          pill(g, next[3], st.x + st.w / 2, below ? st.y + st.h + 26 : st.y - 22, 20);
          if (k >= 0.92 || i === 0) cue(g, st.x + st.w / 2, st.y + st.h / 2, 'tap', loop(time, 0.6), { above: !below, s: 0.8 });
        }
        cookBody(g, x, y, '#5E9A58', sprite('face-pip-demo', portrait('pip', 64, undefined, { ring: false })), (hold as never) ?? null, true, time, k > 0 && k < 1);
      },
    };
  })(),
  // Dawn: knead your tray on the prep board (three taps), load it, pull it when gold
  dawn: {
    box: [60, 236, 980, 551],
    bg: ovenWall,
    draw(g, time) {
      const P = 4.4;
      const taps = [0.1, 0.2, 0.3];
      const LOAD = 0.44;
      const p = loop(time, P);
      for (let i = 0; i < 3; i++) arch(g, slotX(i, 3), 0.5 + Math.sin(time * 7) * 0.08);
      rr(g, PREP.x, PREP.y, PREP.w, PREP.h, 20);
      fillInk(g, '#C8904E', 4);
      const k = taps.filter((x) => p >= x).length;
      if (p < LOAD) {
        const sq = (k === 3 ? 3 : k) / 3;
        ellipse(g, PREP.x + 150, PREP.y + 92, 70 + sq * 22, 44 - sq * 10, '#F3D9A4', 4);
        text(g, `Knead ${3 - k}`, PREP.x + 150, PREP.y + 28, { size: 22, font: 'ui', color: '#2A1A12' });
      }
      const x = slotX(1, 3);
      const cx = x + SLOT_W / 2;
      if (p >= LOAD + 0.02) {
        const IN = LOAD + 0.02;
        const GOLD0 = 0.82;
        const span = 1 - IN;
        const zone = p < GOLD0 ? 'raw' : 'golden';
        demoTray(g, x, Math.min(1, (p - IN) / (GOLD0 - IN)), zone, (p - IN) / span, [(GOLD0 - IN) / span, 0.97]);
        if (zone === 'golden') pill(g, 'PULL', cx, OY - 40, 26);
      }
      if (p < 0.36) cue(g, PREP.x + 150, PREP.y + 92, 'tap', loop(p, 0.1, 0.4), { above: true, label: 'TAP ×3' });
      else if (p < LOAD + 0.08) cue(g, cx, OY + 80, 'tap', loop(time, P, 0.5 - LOAD), { label: 'LOAD' });
    },
  },
};

/**
 * A small canvas playing a game's demo (the order card). It runs while it is on the page and frees itself once it's
 * taken off.
 */
export function demoCanvas(game: GameId, cssW: number): HTMLCanvasElement {
  const d = DEMOS[game];
  const [bx, by, bw, bh] = d.box;
  const cssH = Math.round((cssW * bh) / bw);
  const px = Math.min(1.5, Math.max(0.75, stageScale() * (window.devicePixelRatio || 1)));
  const c = document.createElement('canvas');
  c.className = 'demo-canvas';
  c.width = Math.round(cssW * px);
  c.height = Math.round(cssH * px);
  c.style.width = `${cssW}px`;
  c.style.height = `${cssH}px`;
  const s = c.width / bw;
  const bg = document.createElement('canvas');
  bg.width = c.width;
  bg.height = c.height;
  const bgc = bg.getContext('2d')!;
  bgc.setTransform(s, 0, 0, s, -bx * s, -by * s);
  d.bg(bgc);
  const g = c.getContext('2d', { alpha: false })!;
  const t0 = performance.now();
  let seen = false;
  const frame = (now: number): void => {
    if (!c.isConnected) {
      if (seen) {
        c.width = c.height = bg.width = bg.height = 0;
        return;
      }
    } else seen = true;
    requestAnimationFrame(frame);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(bg, 0, 0);
    g.setTransform(s, 0, 0, s, -bx * s, -by * s);
    d.draw(g, (now - t0) / 1000);
  };
  requestAnimationFrame(frame);
  return c;
}
