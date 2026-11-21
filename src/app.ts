// The app shell: sign-in (shared Shoallhell accounts), the main menu on the hanging sign beside the night window,
// friends and invites, and routing to every screen. Screens render into #screen inside the scaled #stage.
import { audio } from './audio/audio';
import { ACHIEVEMENTS } from './game/data';
import { checkCosmetics } from './game/profile';
import { saveNow, session, signOut, startOffline, startOnline } from './game/session';
import { api, getToken } from './net/api';
import { Net } from './net/socket';
import { lineIcon } from './render/art';
import { clear, closeModals, h, modal, stage, svg, toast } from './ui/dom';
import { ambient, breadShelf, nightWindow } from './ui/scene';
import { GAME_VERSION } from './version';

let cleanup: (() => void) | null = null;

export function screenRoot(): HTMLElement {
  let el = document.getElementById('screen');
  if (!el) {
    el = h('div#screen', { style: 'position:absolute;inset:0' });
    stage().prepend(el);
  }
  return el;
}

/** show a screen: clears the previous one (and runs its cleanup) */
export function show(render: (root: HTMLElement) => (() => void) | void): void {
  cleanup?.();
  cleanup = null;
  closeModals();
  const root = screenRoot();
  clear(root);
  const c = render(root);
  if (c) cleanup = c;
}

export async function boot(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const join = params.get('join');
  // someone who chose to play offline goes straight in next time
  if (!getToken() && localStorage.getItem('bd.offlineMode') === '1') {
    startOffline();
    afterSignIn(join);
    return;
  }
  if (getToken()) {
    show((root) => {
      root.appendChild(h('div.wall'));
      root.appendChild(h('div.screen', { style: 'align-items:center;justify-content:center' }, h('div.sign', h('h1', "Baker's Dozen"), h('div.sub', 'Lighting the ovens…'))));
    });
    try {
      const me = await api.me();
      startOnline(me.user, me.profile, me.rev);
      afterSignIn(join);
      return;
    } catch {
      /* token expired: sign in again */
    }
  }
  authScreen(join);
}

function afterSignIn(join: string | null): void {
  checkCosmetics(session.profile);
  if (session.online) void connectFriends();
  // a refresh mid-night: straight back to the table
  void import('./ui/lobby').then((m) => {
    if (m.resumeIfAny()) return;
    if (join) {
      history.replaceState(null, '', location.pathname);
      void m.joinOnline(join);
      return;
    }
    mainMenu();
  });
}

async function connectFriends(): Promise<void> {
  try {
    const net = await Net.shared();
    net.on('invite', (m: { fromName: string; code: string; game?: string; gameName?: string }) => {
      if (m.game && m.game !== 'bd') {
        toast(`${m.fromName} invited you to their ${m.gameName ?? 'other game'} lobby (${m.code}).`, 'gold', 6000);
        return;
      }
      audio.sfx('bell');
      const close = modal(
        h(
          'div.col',
          { style: 'width:420px' },
          h('h2', 'An invitation'),
          h('div', h('b', m.fromName), ` wants you in their bakery (lobby ${m.code}).`),
          h('div.row', h('button.primary', { onclick: () => (close(), void import('./ui/lobby').then((x) => x.joinOnline(m.code))) }, 'Join'), h('button', { onclick: () => close() }, 'Not now')),
        ),
      );
    });
  } catch {
    /* offline for now */
  }
}

// ------------------------------------------------------------------ sign-in

function authScreen(join: string | null): void {
  show((root) => {
    let mode: 'login' | 'signup' = 'login';
    const err = h('div', { style: 'color:#A8322D;font-weight:800;min-height:22px' });
    const email = h('input', { type: 'email', placeholder: 'Email', autocomplete: 'email', 'aria-label': 'Email' }) as HTMLInputElement;
    const pass = h('input', { type: 'password', placeholder: 'Password', autocomplete: 'current-password', 'aria-label': 'Password' }) as HTMLInputElement;
    const pass2 = h('input', { type: 'password', placeholder: 'Password again', autocomplete: 'new-password', 'aria-label': 'Password again' }) as HTMLInputElement;
    const name = h('input', { type: 'text', placeholder: 'Baker name (optional)', maxlength: '24', 'aria-label': 'Baker name' }) as HTMLInputElement;
    const extra = h('div.col');
    const go = h('button.primary.big', { type: 'submit' }, 'Sign in') as HTMLButtonElement;
    const tabs = h('div.seg');
    const form = h('form.col', email, pass, extra, err, go);
    const setMode = (m: 'login' | 'signup'): void => {
      mode = m;
      tabs.replaceChildren(
        h(`button${m === 'login' ? '.on' : ''}`, { type: 'button', onclick: () => setMode('login') }, 'Sign in'),
        h(`button${m === 'signup' ? '.on' : ''}`, { type: 'button', onclick: () => setMode('signup') }, 'Create account'),
      );
      extra.replaceChildren(...(m === 'signup' ? [pass2, name] : []));
      pass.placeholder = m === 'signup' ? 'Password (8+ characters)' : 'Password';
      pass.autocomplete = m === 'signup' ? 'new-password' : 'current-password';
      go.textContent = m === 'login' ? 'Sign in' : 'Create account';
      err.textContent = '';
    };
    setMode('login');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      audio.unlock();
      err.textContent = '';
      if (mode === 'signup' && pass.value !== pass2.value) {
        err.textContent = 'Those passwords don’t match.';
        return;
      }
      go.disabled = true;
      try {
        const r = mode === 'login' ? await api.login(email.value, pass.value) : await api.signup(email.value, pass.value, name.value);
        rememberOffline(false);
        startOnline(r.user, null, 0, r.token);
        const me = await api.me();
        startOnline(me.user, me.profile, me.rev);
        afterSignIn(join);
      } catch (x) {
        err.textContent = x instanceof Error ? x.message : 'Something went wrong.';
      } finally {
        go.disabled = false;
      }
    });
    const win = nightWindow(282, { chip: false, width: 800 });
    win.set(0.05, null);
    root.appendChild(h('div.wall'));
    root.appendChild(ambient([[24, 120], [1418, 300]]));
    root.appendChild(
      h(
        'div.screen',
        { style: 'flex-direction:row;padding:40px 72px 52px;gap:64px' },
        h(
          'div.col',
          { style: 'width:470px;justify-content:center;gap:22px' },
          titleSign(),
          h(
            'div.parchment.col',
            { style: 'padding:22px 24px;border-radius:16px;border:3px solid #1E120C;gap:10px' },
            tabs,
            form,
            h('div.small.dim', 'One account for Baker’s Dozen, Shoallhell and Smash Your Bros, with the same friends list.'),
            h('button', { type: 'button', onclick: () => (audio.unlock(), rememberOffline(true), startOffline(), afterSignIn(null)) }, 'Play offline on this device'),
          ),
        ),
        h('div.col', { style: 'flex:1;min-width:0;gap:0' }, win.el, breadShelf()),
      ),
    );
    root.appendChild(h('div.version', `v${GAME_VERSION}`));
    setTimeout(() => email.focus(), 60);
  });
}

function titleSign(): HTMLElement {
  return h(
    'div',
    { style: 'position:relative' },
    h(
      'div.sign.sway',
      { style: 'padding:22px 30px 30px' },
      svg(`<svg width="70" height="44" viewBox="0 0 64 40" aria-hidden="true"><ellipse cx="32" cy="35" rx="25" ry="4" fill="rgba(0,0,0,0.22)"/><g stroke="#5A3414" stroke-width="2" stroke-linejoin="round"><ellipse cx="9" cy="27" rx="7.5" ry="5" transform="rotate(-38 9 27)" fill="#D99A2B"/><ellipse cx="55" cy="27" rx="7.5" ry="5" transform="rotate(38 55 27)" fill="#D99A2B"/><ellipse cx="18" cy="21" rx="10" ry="8.5" transform="rotate(-28 18 21)" fill="#F0B640"/><ellipse cx="46" cy="21" rx="10" ry="8.5" transform="rotate(28 46 21)" fill="#F0B640"/><ellipse cx="32" cy="18" rx="12" ry="12" fill="#FFD166"/></g><path d="M25 11 Q32 7 39 11" stroke="#FFF1C9" stroke-width="2.2" fill="none" opacity="0.75" stroke-linecap="round"/></svg>`),
      h('h1', { style: 'font-size:82px;line-height:0.92;color:#FFE3A3;text-shadow:0 2px 0 #B9862C,0 5px 0 #1E120C' }, "Baker's", h('br'), 'Dozen'),
    ),
    h(
      'div',
      { style: 'position:relative;margin:-14px auto 0;width:320px;height:40px;display:flex;align-items:center;justify-content:center;background:#C8553D;color:#FFFFFF;font-size:15px;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;clip-path:polygon(0 0,100% 0,94% 50%,100% 100%,0 100%,6% 50%);box-shadow:inset 0 -4px 0 rgba(0,0,0,0.25)' },
      'A co-opetition bake-off',
    ),
  );
}

// ------------------------------------------------------------------ main menu

const ICON_HOW = 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01';
const ICON_MEDAL = 'M8 2l4 6 4-6M12 8a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM12 11l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.4z';
const ICON_SET = 'M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M11 16v4';

function menuBtn(icon: string, label: string, onclick: () => void, count?: string): HTMLElement {
  return h(
    'button',
    {
      type: 'button',
      onclick: () => (audio.unlock(), audio.sfx('select'), onclick()),
      onmouseenter: () => audio.sfx('hover'),
      style: 'display:flex;align-items:center;gap:14px;height:58px;padding:0 22px 0 12px;border-radius:14px;background-color:#4A2E20;background-image:repeating-linear-gradient(90deg,rgba(255,220,170,0.04) 0px,rgba(255,220,170,0.04) 3px,rgba(0,0,0,0) 3px,rgba(0,0,0,0) 26px);border:3px solid #6B4428;outline:2px solid #1E120C;font-size:22px;font-family:var(--display);text-align:left',
    },
    h('span', { style: 'width:38px;height:38px;border-radius:50%;background:#2A1A12;border:2px solid #F2A541;display:flex;align-items:center;justify-content:center' }, svg(lineIcon(icon, 20, '#F2A541', 2.2))),
    h('span', { style: 'flex:1' }, label),
    count ? h('span', { style: 'padding:3px 10px;border-radius:999px;background:#F2A541;color:#2A1A12;font-size:15px;font-weight:900;font-family:var(--ui)' }, count) : '',
  );
}

export function mainMenu(): void {
  audio.music('menu');
  show((root) => {
    const p = session.profile;
    const done = ACHIEVEMENTS.filter((a) => p.ach[a.id]?.done).length;
    const win = nightWindow(282, { chip: false, width: 800 });
    win.set(0.04, null);
    const play = h(
      'button',
      {
        type: 'button',
        onclick: () => {
          audio.unlock();
          audio.sfx('select');
          if (!p.tutorialSeen) void import('./ui/tutorial').then((m) => m.tutorial(() => void import('./ui/lobby').then((l) => l.soloLobby())));
          else void import('./ui/lobby').then((l) => l.playMenu());
        },
        style: 'display:flex;align-items:center;justify-content:center;gap:12px;height:70px;border-radius:16px;background-color:#F2A541;background-image:linear-gradient(180deg,rgba(255,255,255,0.3),rgba(255,255,255,0) 50%);border:2px solid #1E120C;box-shadow:inset 0 -6px 0 #C47A1E,0 6px 0 #1E120C;color:#2A1A12;font-size:28px;font-family:var(--display)',
      },
      svg('<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4 L20 12 L7 20 Z" fill="#2A1A12"/></svg>'),
      'Play',
    );
    const userbar = h(
      'div.userbar',
      h('span.chip', { style: 'font-size:16px' }, session.online ? session.user?.name ?? 'Baker' : 'Offline'),
      session.online ? h('button.tiny', { onclick: () => void import('./ui/friends').then((m) => m.friendsModal()) }, 'Friends') : h('button.tiny', { onclick: () => void doSignOut() }, 'Sign in'),
      h('button.tiny.icon', { 'aria-label': 'Fullscreen', title: 'Fullscreen', onclick: () => (document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen?.()) }, svg(lineIcon('M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', 20))),
    );
    root.appendChild(h('div.wall'));
    root.appendChild(ambient([[24, 120], [1418, 300]]));
    root.appendChild(userbar);
    root.appendChild(
      h(
        'div.screen',
        { style: 'flex-direction:row;padding:40px 72px 52px;gap:64px' },
        h(
          'div.col',
          { style: 'width:470px;justify-content:center;gap:36px' },
          titleSign(),
          h(
            'nav.col',
            { 'aria-label': 'Main menu', style: 'gap:14px' },
            play,
            menuBtn(ICON_HOW, 'How to Play', () => void import('./ui/tutorial').then((m) => m.tutorial(() => void import('./ui/lobby').then((l) => l.soloLobby())))),
            menuBtn(ICON_MEDAL, 'Achievements', () => void import('./ui/achievements').then((m) => m.achievementsScreen()), `${done} / ${ACHIEVEMENTS.length}`),
            menuBtn(ICON_SET, 'Settings', () => void import('./ui/settings').then((m) => m.settingsScreen())),
          ),
        ),
        h('div.col', { style: 'flex:1;min-width:0;gap:0' }, win.el, breadShelf()),
      ),
    );
    root.appendChild(h('div.version', `v${GAME_VERSION} · ${session.online ? 'saved to your account' : 'offline save'}`));
  });
}

function rememberOffline(v: boolean): void {
  try {
    if (v) localStorage.setItem('bd.offlineMode', '1');
    else localStorage.removeItem('bd.offlineMode');
  } catch {
    /* private window */
  }
}

export async function doSignOut(): Promise<void> {
  rememberOffline(false);
  await saveNow();
  await signOut();
  authScreen(null);
}
