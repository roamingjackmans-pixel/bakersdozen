import './ui/theme.css';
import { audio } from './audio/audio';
import { boot } from './app';
import { h } from './ui/dom';
import { watchStage } from './ui/stage';
import { BAL } from './game/data';

// dev: ?fast=0.3 runs every clock faster (testing whole nights quickly)
const fast = Number(new URLSearchParams(location.search).get('fast'));
if (import.meta.env.DEV && fast > 0 && fast <= 1) BAL.timeScale = fast;

watchStage();
document.body.appendChild(h('div.rotate-hint', 'Turn your phone sideways for the best view.'));
// browsers start audio on the first touch or key
const unlock = (): void => audio.unlock();
window.addEventListener('pointerdown', unlock, { once: true, capture: true });
window.addEventListener('keydown', unlock, { once: true, capture: true });
// no double-tap zoom / pinch on the board
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// fonts first, so canvas text is drawn in Fraunces/Nunito from the first frame
const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
const devGame = new URLSearchParams(location.search).get('mini');
Promise.race([fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]).finally(() => {
  if (import.meta.env.DEV && devGame) void import('./ui/devmini').then((m) => m.devMini(devGame as never, new URLSearchParams(location.search)));
  else void boot();
});
