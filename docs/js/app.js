import { html, render, useState, useEffect } from './lib.js';
import { Icon } from './icons.js';
import { useStore, start, freshCount, logout, set } from './store.js';
import { Leads } from './leads.js';
import { Feed } from './feeds.js';
import { Board } from './board.js';
import { Stats } from './stats.js';
import { Services, Settings, Onboarding } from './pages.js';
import { Drawer } from './drawer.js';
import { initNotes } from './notes.js';
import { Skeleton } from './ui.js';
import { ago, nb, WORK, getTheme, setTheme } from './util.js';
import { KeysPanel, GraphicsPanel, BgLayer, applyLook } from './chrome.js';

const ROUTES = [
  { r: 'leads', l: 'Лиды', icon: 'leads' },
  { r: 'orders', l: 'Заказы', icon: 'orders' },
  { r: 'board', l: 'Воронка', icon: 'board' },
  { r: 'stats', l: 'Цифры', icon: 'stats' },
  { r: 'services', l: 'Услуги', icon: 'templates' },
  { r: 'settings', l: 'Настройки', icon: 'settings' },
];
const PANELS = [{ p: 'keys', l: 'Клавиши', icon: 'keys' }, { p: 'graphics', l: 'Графика', icon: 'palette' }];
const routeNow = () => (location.hash.replace(/^#\/?/, '') || 'leads').split('?')[0];

function useRoute() {
  const [r, setR] = useState(routeNow());
  useEffect(() => {
    const on = () => { setR(routeNow()); window.scrollTo(0, 0); };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  if (r === 'templates') return 'services';
  return ROUTES.some((x) => x.r === r) ? r : 'leads';
}

function counts(s) {
  const work = Object.values(s.crm.leads).filter((x) => WORK.includes(x.s)).length;
  return { orders: freshCount('orders'), board: work };
}

function DayNight() {
  const [t, setT] = useState(getTheme());
  const light = t === 'light' || (t === 'system' && matchMedia('(prefers-color-scheme: light)').matches);
  return html`<button class="rail-btn" title="Переключить тему" onClick=${() => { const n = light ? 'dark' : 'light'; setTheme(n); setT(n); }}>
    <${Icon} n=${light ? 'sun' : 'moon'} s=${19} /><span>${light ? 'День' : 'Ночь'}</span></button>`;
}

function Rail({ route }) {
  const s = useStore();
  const c = counts(s);
  const dot = { ok: 'ok', busy: 'busy', err: 'err' }[s.sync.state] || '';
  return html`<aside class="rail">
    <div class="rail-mark" title=${s.mode === 'demo' ? 'Гарден · демо' : 'Гарден'}>Г</div>
    <nav class="rail-nav">
      ${ROUTES.slice(0, 6).map((x) => html`<a href=${'#/' + x.r} class=${`rail-btn ${route === x.r ? 'on' : ''}`} aria-current=${route === x.r ? 'page' : undefined}>
        <${Icon} n=${x.icon} s=${19} /><span>${x.l}</span>${c[x.r] ? html`<i class="rail-cnt ${x.r === 'board' ? 'soft' : ''}">${c[x.r]}</i>` : null}</a>`)}
      <div class="rail-sep"></div>
      ${PANELS.map((x) => html`<button class=${`rail-btn ${s.panel === x.p ? 'on' : ''}`} onClick=${() => set({ panel: s.panel === x.p ? null : x.p })}>
        <${Icon} n=${x.icon} s=${19} /><span>${x.l}</span></button>`)}
      <a href="#/settings" class=${`rail-btn ${route === 'settings' ? 'on' : ''}`}><${Icon} n="settings" s=${19} /><span>Настройки</span></a>
    </nav>
    <div class="rail-foot">
      <${DayNight} />
      <span class="rail-sync" title=${`${s.sync.msg || ''}${s.loadedAt ? ' · данные ' + ago(s.loadedAt) : ''}`}><span class="dot ${dot}"></span></span>
    </div>
  </aside>`;
}

function SidePanel() {
  const s = useStore();
  if (!s.panel) return null;
  const P = PANELS.find((x) => x.p === s.panel);
  return html`<aside class="sidepanel">
    <div class="pp-head"><b>${P.l}</b><button class="btn icon sm ghost" aria-label="Закрыть" onClick=${() => set({ panel: null })}><${Icon} n="x" s=${15} /></button></div>
    ${s.panel === 'keys' ? html`<${KeysPanel} />` : html`<${GraphicsPanel} />`}
  </aside>`;
}

function Tabbar({ route }) {
  const s = useStore();
  const c = counts(s);
  return html`<nav class="tabbar">
    ${ROUTES.map((x) => html`<a href=${'#/' + x.r} class=${route === x.r ? 'on' : ''}>
      <${Icon} n=${x.icon} s=${20} />${x.l}${c[x.r] && x.r !== 'board' ? html`<span class="cnt">${c[x.r]}</span>` : null}</a>`)}
  </nav>`;
}

function Page({ route }) {
  switch (route) {
    case 'orders': return html`<${Feed} kind="orders" key="orders" />`;
    case 'board': return html`<${Board} />`;
    case 'stats': return html`<${Stats} />`;
    case 'services': case 'templates': return html`<${Services} />`;
    case 'settings': return html`<${Settings} />`;
    default: return html`<${Leads} />`;
  }
}

function App() {
  const s = useStore();
  const route = useRoute();
  useEffect(() => { start(); }, []);
  useEffect(() => { if (s.phase === 'ready' && (!s.notes || s.notes.state === 'error' || !!s.notes.demo !== (s.mode === 'demo'))) initNotes(); }, [s.phase, s.mode]);

  if (s.phase === 'boot') return html`<div class="boot"><span class="boot-mark">Г</span></div>`;
  if (s.phase === 'setup') return html`<${Onboarding} />`;
  if (s.phase === 'error') {
    return html`<div class="onb"><section class="onb-left">
        <div class="kao" style="font-size:26px">(╥﹏╥)</div>
        <h1>Не получилось загрузить данные</h1>
        <div class="notice err">${s.error}</div>
        <div class="row wrap"><button class="btn primary" onClick=${start}>Попробовать ещё раз</button>
          <button class="btn" onClick=${logout}>Изменить подключение</button></div>
      </section><section class="onb-right"><p class="dim">${nb('Если только что всё настроила: роботы могли ещё ни разу не запуститься. Это не ошибка, данные появятся после первого запуска. Ошибка здесь значит, что не подошёл токен или имя репозитория.')}</p></section></div>`;
  }
  return html`
    <${BgLayer} />
    <div class=${`shell ${s.panel ? 'with-panel' : ''}`}>
      <${Rail} route=${route} />
      <${SidePanel} />
      <main class="main">
        ${s.mode === 'demo' ? html`<div class="row" style="margin-bottom:14px"><span class="demo-flag">демо-данные</span>
          <a class="muted" style="font-size:12.5px" href="#/settings">Подключить свои →</a></div>` : null}
        ${s.phase === 'loading' ? html`<${Skeleton} />` : html`<${Page} route=${route} />`}
      </main>
      <${Tabbar} route=${route} />
    </div>
    <${Drawer} />
    ${s.toast ? html`<div class="toast" key=${s.toast.id}><${Icon} n="check" s=${16} style=${{ color: 'var(--ok)' }} />${s.toast.msg}</div>` : null}
  `;
}

applyLook();
render(html`<${App} />`, document.getElementById('app'));
