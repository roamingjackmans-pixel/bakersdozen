// Knead: tap on the beat. Fold rings close in on the dough; tap as a ring meets it. The beat is scheduled on the
// audio clock and taps are judged against what you hear (output latency and your calibration taken off).
// Metronome (buff) keeps the rings visible all the way in and lights the beat; without it they fade near the end.
import { audio } from '../audio/audio';
import type { GameResult } from '../game/types';
import { DISPLAY, Floaters, GRADE_COLORS, INK, Particles, W, board, circle, dough, rr, fillInk, seeded, text, woodBackground, type Live, type MiniEnv, type MiniGame } from './common';

interface Note {
  t: number;
  side: -1 | 1;
  judged: '' | 'perfect' | 'good' | 'miss';
  sounded: boolean;
}

const CX = 600;
const CY = 380;
const R = 118;
const APPROACH = 1.25;

export function knead(env: MiniEnv): MiniGame {
  const rnd = seeded(env.seed);
  const bpm = Math.round((96 + rnd() * 20) * (env.rush ? 1.1 : 1));
  const beat = 60 / bpm;
  const notes: Note[] = [];
  const end = env.seconds - 1.2;
  // bars of 8 eighth notes; it gets busier through the game
  const pats = [
    [1, 0, 1, 0, 1, 0, 1, 0],
    [1, 0, 1, 0, 1, 0, 1, 1],
    [1, 0, 0, 1, 1, 0, 1, 0],
    [1, 1, 0, 1, 1, 0, 1, 0],
    [1, 0, 1, 1, 0, 1, 1, 0],
    [1, 1, 1, 0, 1, 1, 1, 0],
  ];
  let t = 2 * beat + 0.6;
  let bar = 0;
  while (t < end) {
    const busy = Math.min(pats.length - 1, Math.floor((t / end) * pats.length + rnd() * 1.4));
    const p = bar < 2 ? pats[0]! : pats[busy]!;
    for (let i = 0; i < 8; i++) {
      const nt = t + i * (beat / 2);
      if (p[i] && nt < end) {
        // Salt Shaker: some beats land off the grid
        const off = env.salted && rnd() < 0.28 ? (rnd() < 0.5 ? -1 : 1) * beat * 0.25 : 0;
        notes.push({ t: nt + off, side: i % 4 < 2 ? -1 : 1, judged: '', sounded: false });
      }
    }
    t += 4 * beat;
    bar++;
  }
  const metro = env.buffs.includes('metronome');
  const perfectW = 0.05 * env.skill * (env.tiny < 1 ? 0.85 : 1);
  const goodW = 0.115 * env.skill * (env.tiny < 1 ? 0.85 : 1);
  const scale = [293.7, 329.6, 349.2, 392, 440, 493.9, 523.3, 587.3];
  const melody = notes.map(() => scale[Math.floor(rnd() * scale.length)]!);
  let a0 = -1;
  let scheduledBeats = 0;
  let perfect = 0;
  let good = 0;
  let miss = 0;
  let stray = 0;
  let combo = 0;
  let streak = 0;
  let bestStreak = 0;
  let squash = 0;
  let slap = 0;
  let lastE = '';
  let beatFlash = 0;
  const fx = new Particles();
  const fl = new Floaters();

  /** song time (s since the game started) of what you are hearing now */
  const heard = (): number => (a0 < 0 ? 0 : audio.time() - audio.latency() - a0);

  function judge(): void {
    const now = heard();
    let best: Note | null = null;
    let bd = Infinity;
    for (const n of notes) {
      if (n.judged) continue;
      const d = Math.abs(n.t - now);
      if (d < bd) {
        bd = d;
        best = n;
      }
      if (n.t > now + goodW) break;
    }
    slap = 1;
    if (!best || bd > goodW) {
      // a tap with no beat near: it breaks the streak and counts against you (no mashing your way through)
      streak = 0;
      stray++;
      combo = 0;
      audio.sfx('squish', 0.6);
      return;
    }
    if (bd <= perfectW) {
      best.judged = 'perfect';
      perfect++;
      streak++;
      bestStreak = Math.max(bestStreak, streak);
      fl.add('Perfect', CX, CY - R - 40, GRADE_COLORS.perfect);
      fx.spawn(CX + best.side * R * 0.7, CY, 10, { color: '#FFF8EA', speed: 240, r: 6 });
      fx.spawn(CX, CY - R, 4, { kind: 1, color: '#FFE7A3', speed: 160, r: 10, g: 0 });
      lastE = 'perfect';
    } else {
      best.judged = 'good';
      good++;
      streak = 0;
      fl.add('Good', CX, CY - R - 40, GRADE_COLORS.good, 28);
      fx.spawn(CX + best.side * R * 0.7, CY, 6, { color: '#FFF8EA', speed: 180, r: 5 });
      lastE = 'hit';
    }
    combo++;
    squash = 1;
    audio.sfx('thump', 0.8);
  }

  return {
    background(g) {
      woodBackground(g);
      board(g, CX - 330, CY - 230, 660, 460);
    },
    update(_t, dt) {
      if (a0 < 0) {
        audio.unlock();
        a0 = audio.time() + 0.05;
        audio.duckMusic(true);
      }
      const now = heard();
      // schedule the song a little ahead
      const ahead = audio.time() + 0.6;
      for (let i = 0; i < notes.length; i++) {
        const n = notes[i]!;
        if (n.sounded) continue;
        const at = a0 + n.t;
        if (at > ahead) break;
        n.sounded = true;
        audio.pluck(melody[i]!, Math.max(audio.time(), at), 0.16, 'sfx');
      }
      while (a0 + scheduledBeats * beat < ahead && scheduledBeats * beat < env.seconds) {
        const at = a0 + scheduledBeats * beat;
        audio.drum(Math.max(audio.time(), at), metro ? 0.3 : 0.16, 'sfx', scheduledBeats % 4 === 0);
        scheduledBeats++;
      }
      // beats you let pass
      for (const n of notes) {
        if (n.judged) continue;
        if (n.t < now - goodW) {
          n.judged = 'miss';
          miss++;
          combo = 0;
          streak = 0;
          lastE = 'miss';
          fl.add('Miss', CX, CY - R - 40, GRADE_COLORS.miss, 26);
        } else break;
      }
      const ph = (now / beat) % 1;
      beatFlash = ph < 0.15 ? 1 - ph / 0.15 : 0;
      squash = Math.max(0, squash - dt * 6);
      slap = Math.max(0, slap - dt * 7);
      fx.update(dt);
      fl.update(dt);
    },
    draw(g) {
      const now = heard();
      // beat guide (Metronome): the board edge pulses on every beat
      if (metro && beatFlash > 0) {
        g.globalAlpha = beatFlash * 0.6;
        g.strokeStyle = '#F2C14E';
        g.lineWidth = 10;
        rr(g, CX - 336, CY - 236, 672, 472, 32);
        g.stroke();
        g.globalAlpha = 1;
      }
      // approach rings
      for (const n of notes) {
        if (n.judged) continue;
        const k = (n.t - now) / APPROACH;
        if (k > 1) break;
        if (k < -0.2) continue;
        const vis = metro ? 1 : k > 0.3 ? 1 : Math.max(0, (k - 0.05) / 0.25);
        if (vis <= 0) continue;
        const rr2 = R + Math.max(0, k) * 250;
        g.globalAlpha = vis * (0.5 + 0.5 * (1 - k));
        g.lineWidth = 7;
        g.strokeStyle = INK;
        g.beginPath();
        g.arc(CX, CY, rr2, 0, Math.PI * 2);
        g.stroke();
        g.lineWidth = 4;
        g.strokeStyle = n.side < 0 ? '#F2C14E' : '#F2A08C';
        g.stroke();
        // which hand: a little fold mark on that side
        circle(g, CX + n.side * rr2, CY, 9, n.side < 0 ? '#F2C14E' : '#F2A08C', 2.5);
        g.globalAlpha = 1;
      }
      // the target line on the dough
      g.strokeStyle = 'rgba(255,244,224,0.5)';
      g.lineWidth = 3;
      g.setLineDash([8, 10]);
      g.beginPath();
      g.arc(CX, CY, R + 4, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      // smoother dough the better it goes
      const acc = perfect + good + miss ? (perfect + good * 0.6) / (perfect + good + miss) : 0.5;
      const col = `rgb(${Math.round(232 + acc * 14)},${Math.round(200 + acc * 22)},${Math.round(140 + acc * 30)})`;
      dough(g, CX, CY, R, squash, col);
      if (acc < 0.5) {
        g.strokeStyle = 'rgba(140,90,40,0.35)';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(CX - 40, CY + 10);
        g.lineTo(CX - 10, CY + 30);
        g.moveTo(CX + 30, CY - 20);
        g.lineTo(CX + 50, CY + 5);
        g.stroke();
      }
      // the baker's hands
      for (const side of [-1, 1] as const) {
        const hx = CX + side * (R + 40 - slap * 30);
        const hy = CY - 20 + slap * 14;
        rr(g, hx - 38, hy + 34, 76, 70, 20);
        fillInk(g, env.coat, 4);
        circle(g, hx, hy + 18, 34, '#E8BE92', 4);
        g.strokeStyle = INK;
        g.lineWidth = 3;
        for (let f = -1; f <= 1; f++) {
          g.beginPath();
          g.moveTo(hx + f * 12, hy - 4);
          g.lineTo(hx + f * 12, hy + 10);
          g.stroke();
        }
      }
      fx.draw(g);
      fl.draw(g);
      // streak and combo
      text(g, `${combo}`, CX, CY + R + 150, { size: 54, color: combo >= 8 ? '#FFD166' : '#FFF4E0', stroke: 7 });
      text(g, 'combo', CX, CY + R + 192, { size: 20, font: 'ui', color: '#F3E6CF', stroke: 5 });
      if (streak >= 5) text(g, `${streak} perfect`, CX, CY - R - 90, { size: 26, color: '#FFD166', stroke: 6, font: 'ui' });
      // left/right hint
      text(g, 'Tap · Space', W / 2 - 120, 780, { size: 20, font: 'ui', color: 'rgba(255,244,224,0.55)' });
      void DISPLAY;
    },
    down() {
      judge();
    },
    move() {},
    up() {},
    key(code, down) {
      if (down && (code === 'Space' || code === 'KeyJ' || code === 'KeyF' || code === 'KeyK' || code === 'KeyD' || code === 'Enter')) judge();
    },
    peek: () => ({ notes, now: heard(), perfectW, goodW }),
    live(): Live {
      const n = perfect + good + miss;
      return { v: n ? (perfect + good * 0.6) / (n + stray * 0.6) : 0.5, c: combo, e: lastE };
    },
    result(): GameResult {
      // only the beats that came round count (a game cut short by Swap Shop or the bell)
      const upto = heard() + goodW;
      const total = notes.filter((n) => n.t <= upto).length || 1;
      audio.duckMusic(false);
      return { q: Math.min(1, (perfect + good * 0.6) / (total + stray * 0.6)), perfect, beatStreak: bestStreak };
    },
    stop() {
      audio.duckMusic(false);
    },
  };
}
