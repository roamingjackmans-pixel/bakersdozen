// Achievements: twelve medals saved to your profile. Filter by all, unlocked or in progress; an overall bar.
// Secret ones show ??? with a lock until unlocked, but keep their game tag as a hint.
import { mainMenu, show } from '../app';
import { ACHIEVEMENTS, BAKERS } from '../game/data';
import { session } from '../game/session';
import { ACH_ICONS, lineIcon } from '../render/art';
import { h, svg } from './dom';

export function achievementsScreen(): void {
  let filter: 'all' | 'done' | 'progress' = 'all';
  show((root) => {
    root.appendChild(h('div.wall'));
    const body = h('div.screen');
    root.appendChild(body);
    const render = (): void => {
      const p = session.profile;
      const done = ACHIEVEMENTS.filter((a) => p.ach[a.id]?.done).length;
      const list = ACHIEVEMENTS.filter((a) => {
        const d = !!p.ach[a.id]?.done;
        return filter === 'all' || (filter === 'done' ? d : !d);
      });
      const L = p.life;
      body.replaceChildren(
        h(
          'div.row',
          h('button', { onclick: () => mainMenu() }, '◀ Menu'),
          h('div.grow', h('h2', { style: 'font-size:44px' }, 'Achievements'), h('div.dim', { style: 'font-weight:800' }, `${done} of ${ACHIEVEMENTS.length} · saved to your profile`)),
          h(
            'div.seg',
            ...(
              [
                ['all', 'All'],
                ['done', 'Unlocked'],
                ['progress', 'In progress'],
              ] as const
            ).map(([k, l]) => h(`button${filter === k ? '.on' : ''}`, { type: 'button', onclick: () => ((filter = k), render()) }, l)),
          ),
        ),
        h('div', { style: 'height:14px;border-radius:7px;background:rgba(255,244,224,0.12);border:2px solid #1E120C;overflow:hidden' }, h('i', { style: `display:block;height:100%;width:${(done / ACHIEVEMENTS.length) * 100}%;background:#F2A541` })),
        h(
          'div.medals',
          ...list.map((a) => {
            const st = p.ach[a.id];
            const d = !!st?.done;
            const hidden = a.secret && !d;
            const have = st?.have ?? 0;
            return h(
              `div.medal${d ? '.done' : ''}`,
              { style: d ? '' : 'background:#2B1B14' },
              a.tag ? h('span.tagline', { style: `background:${a.tagColor ?? '#FFF4E0'}` }, a.tag) : '',
              h(
                'span',
                { style: `flex-shrink:0;width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${d ? '#F7CF62' : '#3C4048'};border:4px solid ${d ? '#E8B84A' : '#7A808C'};box-shadow:0 0 0 2px #1E120C` },
                svg(lineIcon(ACH_ICONS[hidden ? 'lock' : a.icon] ?? '', 30, d ? '#5A3414' : '#9AA1AD', 2.2)),
              ),
              h(
                'div.grow',
                h('h3', hidden ? '???' : a.title),
                h('div.desc', hidden ? 'Secret achievement.' : a.desc),
                h('div.bar', h('i', { style: `width:${Math.round(Math.min(1, have / a.need) * 100)}%;background:${d ? '#F2A541' : '#BFAF96'}` })),
                h('div', { style: `font-size:13px;font-weight:900;margin-top:4px;color:${d ? '#F2A541' : '#D8C6AB'}` }, d ? 'Unlocked' : hidden ? 'Secret' : `${have} / ${a.need}`),
              ),
            );
          }),
        ),
        h(
          'div.panel.row',
          { style: 'gap:28px;flex-wrap:wrap;font-weight:800' },
          h('span', `Nights ${L.nights}`),
          h('span', `Survived ${L.survived}`),
          h('span', `Won ${L.wins}`),
          h('span', `13th loaves ${L.insurance}`),
          h('span', `Oven rescues ${L.rescues}`),
          h('span', `Orders for the Sheriff ${L.sheriff}`),
          h('span', `Wins by baker: ${BAKERS.map((b) => `${b.name} ${p.bakerWins[b.id] ?? 0}`).join(' · ')}`),
        ),
      );
    };
    render();
  });
}
