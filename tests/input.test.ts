// A tap lands where you see it. The stage is a 1440×810 board scaled and centred in the window, so a tap's screen
// position has to go through where the canvas really is. (It once used the unscaled 1440×810 at the window's corner:
// the oven took taps above the arches and Rush Order's pantry took none.) The runner measures the canvas with
// getBoundingClientRect on start, on resize and on every press; this checks the arithmetic.
import { describe, expect, it } from 'vitest';
import { toStage } from '../src/mini/runner';

describe('a tap on screen → the game', () => {
  it('a wide window: the stage scaled up and centred left to right', () => {
    // 2400×1080 window: scale 1.333, 240 px of wood each side
    const r = { left: 240, top: 0, width: 1920, height: 1080 };
    expect(toStage(240, 0, r)).toEqual([0, 0]);
    expect(toStage(1200, 540, r)).toEqual([720, 405]);
    expect(toStage(2160, 1080, r)).toEqual([1440, 810]);
  });
  it('a tall window: scaled down and centred top to bottom', () => {
    // 1000×800 window: scale 0.694, 119 px above and below
    const r = { left: 0, top: 118.75, width: 1000, height: 562.5 };
    const [x, y] = toStage(500, 400, r);
    expect(x).toBeCloseTo(720);
    expect(y).toBeCloseTo(405);
  });
  it('Mirror Kitchen flips left and right', () => {
    const r = { left: 0, top: 0, width: 1440, height: 810 };
    expect(toStage(100, 300, r, true)).toEqual([1340, 300]);
  });
});
