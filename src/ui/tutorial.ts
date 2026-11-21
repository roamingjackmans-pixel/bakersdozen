// How to Play: four steps on a parchment scroll, under a minute, skippable. Plays on a profile's first game and any
// time from the menu. Finishing or skipping goes on (to baker select on the first run).
import { show } from '../app';
import { audio } from '../audio/audio';
import { save, session } from '../game/session';
import { LOAF13, SAFFRON, STAR, TIP, itemSVG, sealSVG } from '../render/art';
import { h, svg } from './dom';
import { ambient } from './scene';

const STEPS = [
  { title: 'Fill the tray together', body: 'Every order needs 12 bakes. Everyone’s bakes go on one shared tray.' },
  { title: 'Bake the 13th loaf', body: 'It protects the bakery and earns big ★, but costs a rare ingredient. Never bake one and you lose half your ★ at the end.' },
  { title: 'Three fines, everyone loses', body: 'A short order cracks a seal. Crack all three and the Inspector closes the bakery.' },
  { title: 'Most ★ wins', body: 'Earn ★ and Tips in mini games. Spend Tips at the market between orders.' },
];

const COLORS = ['#F2A08C', '#A9C2E6', '#A8D69F', '#93D3D2'];

function picture(step: number): HTMLElement {
  if (step === 0) {
    const tray = h('div.tray', { style: 'transform:scale(0.92)' });
    for (let i = 0; i < 12; i++) tray.appendChild(h('div.slot.on', { style: `animation-delay:${i * 0.08}s` }, svg(itemSVG('croissant', 50), 'pop'), h('span.who', { style: `background:${COLORS[i % 4]}` })));
    tray.appendChild(h('div.slot.thirteen', svg(LOAF13(30))));
    return tray;
  }
  if (step === 1)
    return h(
      'div.row',
      { style: 'gap:22px;justify-content:center' },
      h('div.slot.thirteen.on', { style: 'width:110px;height:92px' }, svg(itemSVG('croissant', 90, true))),
      h('div.display', { style: 'font-size:46px' }, '='),
      svg(SAFFRON(56)),
      h('div.display', { style: 'font-size:46px' }, '→'),
      h('div.display', { style: 'font-size:46px;color:#B9862C' }, '+5'),
      svg(STAR(56)),
    );
  if (step === 2) return h('div.row', { style: 'gap:20px;justify-content:center' }, svg(sealSVG(true, 110), 'pop'), svg(sealSVG(true, 110), 'pop'), svg(sealSVG(false, 110)));
  return h(
    'div.row',
    { style: 'gap:40px;justify-content:center' },
    h('div.col', { style: 'align-items:center' }, svg(STAR(80)), h('div.display', { style: 'font-size:28px' }, '★ = score')),
    h('div.col', { style: 'align-items:center' }, svg(TIP(80)), h('div.display', { style: 'font-size:28px' }, 'Tips = buffs')),
  );
}

export function tutorial(then: () => void): void {
  let step = 0;
  const finish = (): void => {
    session.profile.tutorialSeen = true;
    save();
    then();
  };
  show((root) => {
    root.appendChild(h('div.wall'));
    root.appendChild(ambient([[24, 120], [1418, 120]], 6));
    const box = h('div');
    root.appendChild(h('div.screen', { style: 'align-items:center;justify-content:center' }, box));
    const render = (): void => {
      const s = STEPS[step]!;
      const dots = h('div.row', { style: 'gap:10px;justify-content:center' }, ...STEPS.map((_, i) => h('span', { style: `width:14px;height:14px;border-radius:50%;border:2px solid #1E120C;background:${i === step ? '#F2A541' : '#E9D7B0'}` })));
      box.replaceChildren(
        h(
          'div.parchment.torn.rise',
          { style: 'width:920px;padding:44px 54px 36px;border-radius:6px;display:flex;flex-direction:column;gap:24px' },
          h('div.row', h('span.tag', `Step ${step + 1} of 4`), h('div.grow'), h('button.tiny', { onclick: () => (audio.sfx('back'), finish()) }, 'Skip')),
          h('h2', { style: 'font-size:54px' }, s.title),
          h('div', { style: 'min-height:150px;display:flex;align-items:center;justify-content:center' }, picture(step)),
          h('div', { style: 'font-size:22px;font-weight:800;line-height:1.4' }, s.body),
          dots,
          h(
            'div.row',
            { style: 'justify-content:space-between' },
            h('button.big', { disabled: step === 0, onclick: () => ((step = Math.max(0, step - 1)), audio.sfx('back'), render()) }, 'Back'),
            step === 3 ? h('button.primary.big', { onclick: () => (audio.sfx('select'), finish()) }, 'Start baking') : h('button.primary.big', { onclick: () => ((step += 1), audio.sfx('select'), render()) }, 'Next'),
          ),
        ),
      );
    };
    render();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowRight' && step < 3) (step++, render());
      if (e.key === 'ArrowLeft' && step > 0) (step--, render());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
}
