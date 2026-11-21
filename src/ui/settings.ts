// Settings: sound and music, reduced motion, the Knead timing calibration, the FPS counter, and the account
// (name, password, sign out). Saved with the profile.
import { doSignOut, mainMenu, show } from '../app';
import { audio } from '../audio/audio';
import { applySettings, save, session } from '../game/session';
import { api } from '../net/api';
import { h, modal, toast } from './dom';

export function settingsScreen(): void {
  show((root) => {
    root.appendChild(h('div.wall'));
    const body = h('div.screen');
    root.appendChild(body);
    const render = (): void => {
      const s = session.profile.settings;
      const slider = (label: string, v: number, set: (n: number) => void): HTMLElement => {
        const input = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(v), 'aria-label': label, style: 'width:320px;accent-color:#F2A541' }) as HTMLInputElement;
        input.addEventListener('input', () => {
          set(Number(input.value));
          applySettings();
          save();
        });
        input.addEventListener('change', () => audio.sfx('select'));
        return h('div.row', h('b', { style: 'width:160px' }, label), input, h('span', `${Math.round(v * 100)}%`));
      };
      const seg = (label: string, cur: string, opts: [string, string][], set: (v: string) => void): HTMLElement =>
        h('div.row', h('b', { style: 'width:160px' }, label), h('div.seg', { style: 'width:420px' }, ...opts.map(([k, l]) => h(`button${k === cur ? '.on' : ''}`, { type: 'button', onclick: () => (set(k), applySettings(), save(), render()) }, l))));
      body.replaceChildren(
        h('div.row', h('button', { onclick: () => mainMenu() }, '◀ Menu'), h('h2.grow', { style: 'font-size:44px' }, 'Settings')),
        h(
          'div.row',
          { style: 'align-items:stretch;gap:24px' },
          h(
            'div.panel.col',
            { style: 'flex:1;gap:16px' },
            h('span.tag', 'Sound'),
            slider('Music', s.music, (n) => (s.music = n)),
            slider('Effects', s.sfx, (n) => (s.sfx = n)),
            h('span.tag', 'Motion'),
            seg('Reduced motion', s.motion, [
              ['auto', 'Like my device'],
              ['on', 'On'],
              ['off', 'Off'],
            ], (v) => (s.motion = v as typeof s.motion)),
            seg('Screen shake', s.shake ? 'y' : 'n', [
              ['y', 'On'],
              ['n', 'Off'],
            ], (v) => (s.shake = v === 'y')),
            seg('FPS counter', s.fps ? 'y' : 'n', [
              ['y', 'Show'],
              ['n', 'Hide'],
            ], (v) => (s.fps = v === 'y')),
            h('span.tag', 'Knead timing'),
            h('div.row', h('b', { style: 'width:160px' }, 'Audio offset'), h('span.display', { style: 'font-size:24px;width:90px' }, `${s.offsetMs > 0 ? '+' : ''}${s.offsetMs} ms`), h('button.tiny', { onclick: () => ((s.offsetMs -= 10), applySettings(), save(), render()) }, '−10'), h('button.tiny', { onclick: () => ((s.offsetMs += 10), applySettings(), save(), render()) }, '+10'), h('button.tiny.primary', { onclick: () => calibrate(render) }, 'Calibrate')),
            h('div.small.dim', 'If your Knead taps land early or late on Bluetooth headphones, calibrate once.'),
          ),
          h(
            'div.panel.col',
            { style: 'width:480px;gap:12px' },
            h('span.tag', 'Account'),
            session.online
              ? h(
                  'div.col',
                  h('div', { style: 'font-weight:800' }, `Signed in as ${session.user?.name} (${session.user?.email})`),
                  h('div.small.dim', 'The same account as Shoallhell and Smash Your Bros.'),
                  h('button', { onclick: () => rename() }, 'Change name'),
                  h('button', { onclick: () => password() }, 'Change password'),
                  h('button.wax', { onclick: () => void doSignOut() }, 'Sign out'),
                )
              : h('div.col', h('div', { style: 'font-weight:800' }, 'Playing offline. Progress stays in this browser.'), h('button.primary', { onclick: () => void doSignOut() }, 'Sign in or create an account')),
            h('span.tag', { style: 'margin-top:10px' }, 'Help'),
            h('button', { onclick: () => void import('./tutorial').then((m) => m.tutorial(() => settingsScreen())) }, 'Replay How to Play'),
          ),
        ),
      );
    };
    render();
  });
}

function rename(): void {
  const input = h('input', { type: 'text', maxlength: '24', value: session.user?.name ?? '', 'aria-label': 'Name' }) as HTMLInputElement;
  const close = modal(
    h(
      'div.col',
      { style: 'width:420px' },
      h('h2', 'Your name'),
      input,
      h(
        'button.primary',
        {
          onclick: async () => {
            try {
              const r = await api.rename(input.value);
              session.user = r.user;
              close();
              settingsScreen();
            } catch (e) {
              toast((e as Error).message, 'bad');
            }
          },
        },
        'Save',
      ),
    ),
  );
}

function password(): void {
  const a = h('input', { type: 'password', placeholder: 'Current password', autocomplete: 'current-password', 'aria-label': 'Current password' }) as HTMLInputElement;
  const b = h('input', { type: 'password', placeholder: 'New password (8+)', autocomplete: 'new-password', 'aria-label': 'New password' }) as HTMLInputElement;
  const close = modal(
    h(
      'div.col',
      { style: 'width:420px' },
      h('h2', 'Change password'),
      a,
      b,
      h(
        'button.primary',
        {
          onclick: async () => {
            try {
              await api.password(a.value, b.value);
              toast('Password changed.');
              close();
            } catch (e) {
              toast((e as Error).message, 'bad');
            }
          },
        },
        'Change',
      ),
    ),
  );
}

/** tap along to eight clicks; the average gap becomes the offset */
function calibrate(done: () => void): void {
  audio.unlock();
  const beat = 0.6;
  const n = 10;
  const t0 = audio.time() + 0.8;
  for (let i = 0; i < n; i++) audio.drum(t0 + i * beat, 0.5, 'sfx', true);
  const diffs: number[] = [];
  const info = h('div.display', { style: 'font-size:28px' }, 'Tap on every beat');
  const onTap = (): void => {
    const t = audio.time() - (audio.latency() - audio.offsetMs / 1000);
    const k = Math.round((t - t0) / beat);
    if (k < 2 || k >= n) return;
    diffs.push(t - (t0 + k * beat));
    info.textContent = `${diffs.length} taps`;
  };
  const pad = h('button.primary.big', { style: 'width:100%;height:160px', onpointerdown: onTap }, 'Tap');
  const key = (e: KeyboardEvent): void => {
    if (e.code === 'Space') {
      e.preventDefault();
      onTap();
    }
  };
  window.addEventListener('keydown', key);
  const close = modal(h('div.col', { style: 'width:480px;align-items:center' }, h('h2', 'Calibrate'), info, pad), {
    onClose: () => {
      window.removeEventListener('keydown', key);
      done();
    },
  });
  setTimeout(() => {
    if (diffs.length >= 4) {
      diffs.sort((x, y) => x - y);
      const med = diffs[Math.floor(diffs.length / 2)]!;
      session.profile.settings.offsetMs = Math.round((med * 1000) / 5) * 5;
      applySettings();
      save();
      toast(`Offset set to ${session.profile.settings.offsetMs} ms.`);
    } else toast('Not enough taps. Try again.', 'bad');
    close();
  }, (0.8 + n * beat + 0.6) * 1000);
}
