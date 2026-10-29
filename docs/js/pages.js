// Шаблоны, настройки, первый запуск.
import { html, useState, useMemo, useEffect, useRef } from './lib.js';
import { Icon } from './icons.js';
import {
  useStore, set, saveTemplate, deleteTemplate, templates, toast, ROBOTS, robotStatus, runRobot,
  testConnection, connect, useDemo, logout, saveSettings, start, explain,
} from './store.js';
import { NotesPanel } from './notesui.js';
import { GraphicsPanel } from './chrome.js';
import { ImportPanel } from './baseui.js';
import { allLeads } from './base.js';
import { SERVICES, SVC, IDEAS, fmtRange, OK_LABEL } from './services.js';
import { Seg } from './ui.js';
import { getTheme, setTheme } from './util.js';
import { VARS, renderTemplate, nb, ago, fmtNum, download, LEAD_ST, stOf, FLAGS, DEFAULT_TEMPLATES } from './util.js';

// ---------- услуги и цены ----------
export function Services() {
  const [tab, setTab] = useState(() => (location.hash.includes('templates') ? 'tpl' : 'prices'));
  return html`
    <div class="page-head">
      <div><h1 class="page-title">Услуги</h1>
        <div class="page-sub">${tab === 'prices' ? nb('Что предлагать и почём. Те же цифры подсказываются в карточке каждого лида') : nb('Тексты первых сообщений: название, проблема и предложение подставляются сами')}</div></div>
      <div class="toolbar-right"><${Seg} value=${tab} onChange=${setTab} items=${[{ v: 'prices', l: 'Цены и идеи' }, { v: 'tpl', l: 'Шаблоны' }]} /></div>
    </div>
    ${tab === 'prices' ? html`<${Prices} />` : html`<${Templates} embedded />`}`;
}

function Prices() {
  return html`<div class="svc-layout">
    <div class="tile" style="padding:0;overflow:hidden">
      <table class="table svc-table">
        <thead><tr><th>Услуга</th><th>Низ рынка</th><th>Мидл</th><th class="hide-m">Срок, дней</th></tr></thead>
        <tbody>${SERVICES.map((s) => html`<tr key=${s.id} style="cursor:default">
          <td><div class="t-name" style="white-space:normal;max-width:none">${s.name} ${s.ok !== 'good' ? html`<span class="badge outline ok-${s.ok}">${OK_LABEL[s.ok]}</span>` : null}</div>
            <div class="t-sub" style="white-space:normal;max-width:none">${nb(s.who)}</div></td>
          <td class="mono nowrap">${fmtRange(s.low, s.unit, s.prefix) || html`<span class="muted">—</span>`}</td>
          <td class="mono nowrap">${fmtRange(s.mid, s.unit) || html`<span class="muted">—</span>`}</td>
          <td class="hide-m mono">${s.days || ''}</td>
        </tr>`)}</tbody>
      </table>
    </div>
    <div style="display:grid;gap:12px;align-content:start">
      <div class="panel">
        <h3>Откуда цифры</h3>
        <p>${nb('Сайты — сверка с рынком 7 октября 2026 (обзоры цен на 2026 год, FL.ru, Профи). Боты, карточки и мини-приложения — сверка в октябре 2026 (FL.ru, vc.ru, обзоры цен). Меню — Kwork и студия «3 совы».')}</p>
        <p>${nb('Низ — вилка начинающих фрилансеров без самого дна бирж, мидл — опытных фрилансеров без студий. «Не сверено» — цифр нет или они случайные, перед тем как называть цену, проверь рынок.')}</p>
      </div>
      <div class="panel">
        <h3>Что ещё можно предлагать</h3>
        ${IDEAS.map((g) => html`<div class="idea" key=${g.title}>
          <div class="idea-title">${g.title}</div>
          <div class="dim" style="font-size:13px;line-height:1.5">${nb(g.hook)}</div>
          <div class="row wrap" style="gap:6px">${g.ids.map((id) => html`<span class="badge outline">${SVC[id].name}</span>`)}</div>
        </div>`)}
      </div>
    </div>
  </div>`;
}

// ---------- шаблоны ----------
export function Templates({ embedded }) {
  const s = useStore();
  const list = templates().sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const [sel, setSel] = useState(list[0]?.id);
  const cur = list.find((t) => t.id === sel);
  const niches = useMemo(() => [...new Set([...(s.data.leads.items || []).map((l) => l.niche), ...DEFAULT_TEMPLATES.flatMap((t) => t.niches)])].filter(Boolean).sort(), [s.data.leads]);

  const create = () => {
    const t = { id: 'tpl-' + Date.now().toString(36), name: 'Новый шаблон', niches: [], text: 'Здравствуйте! ' };
    saveTemplate(t); setSel(t.id);
  };
  return html`
    ${embedded ? html`<div class="row" style="margin-bottom:12px"><button class="btn primary" onClick=${create}><${Icon} n="plus" s=${16} />Новый шаблон</button></div>` : html`<div class="page-head">
      <div><h1 class="page-title">Шаблоны сообщений</h1>
        <div class="page-sub">${nb('Подставляются в карточке лида: название, проблема и предложение берутся автоматически')}</div></div>
      <div class="toolbar-right"><button class="btn primary" onClick=${create}><${Icon} n="plus" s=${16} />Новый шаблон</button></div>
    </div>`}
    <div class="tpl-layout">
      <div class="tpl-list">
        ${list.map((t) => html`<button class="tpl-item ${t.id === sel ? 'on' : ''}" onClick=${() => setSel(t.id)} key=${t.id}>
          <span>${t.name}</span><small>${t.niches?.length ? t.niches.join(', ') : 'Для любой ниши'}</small></button>`)}
      </div>
      ${cur ? html`<${TplEditor} key=${cur.id} t=${cur} niches=${niches} onDelete=${() => { deleteTemplate(cur.id); setSel(list.find((x) => x.id !== cur.id)?.id); }} />`
        : html`<div class="empty"><div class="kao">φ(．．)</div><b>Шаблонов нет</b><div>Создай первый.</div></div>`}
    </div>`;
}

function TplEditor({ t, niches, onDelete }) {
  const s = useStore();
  const [d, setD] = useState({ name: t.name, niches: t.niches || [], text: t.text });
  const ta = useRef();
  const dirty = d.name !== t.name || d.text !== t.text || d.niches.join() !== (t.niches || []).join();
  const sample = useMemo(() => {
    const items = s.data.leads.items || [];
    return items.find((l) => (!d.niches.length || d.niches.includes(l.niche)) && l.prio === 3) || items[0]
      || { name: 'Студия «Лаванда»', niche: 'Салоны красоты', city: 'Санкт-Петербург', flags: ['social'], offer: 'Сайт с услугами и ценами + бот онлайн-записи' };
  }, [d.niches, s.data.leads]);
  const insert = (v) => {
    const el = ta.current;
    const a = el.selectionStart ?? d.text.length, b = el.selectionEnd ?? a;
    const text = d.text.slice(0, a) + v + d.text.slice(b);
    setD({ ...d, text });
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = a + v.length; });
  };
  const toggleNiche = (n) => setD({ ...d, niches: d.niches.includes(n) ? d.niches.filter((x) => x !== n) : [...d.niches, n] });

  return html`<div class="panel">
    <div class="field"><label for="tn">Название</label>
      <input id="tn" class="input" value=${d.name} onInput=${(e) => setD({ ...d, name: e.target.value })} /></div>
    <div class="field"><label>Для каких ниш предлагать первым</label>
      <div class="row wrap">${niches.map((n) => html`<button class="chip ${d.niches.includes(n) ? 'on' : ''}" onClick=${() => toggleNiche(n)}>${n}</button>`)}</div>
      <span class="help">Ничего не выбрано — шаблон подходит для всех.</span></div>
    <div class="field"><label for="tt">Текст</label>
      <div class="vars">${VARS.map((v) => html`<button class="var" onClick=${() => insert(v)}>${v}</button>`)}</div>
      <textarea id="tt" ref=${ta} class="textarea" rows="10" value=${d.text} onInput=${(e) => setD({ ...d, text: e.target.value })}></textarea></div>
    <div class="field"><label>Как это будет выглядеть — на примере «${sample.name}»</label>
      <div class="notice" style="white-space:pre-line">${renderTemplate(d.text, sample)}</div></div>
    <div class="row wrap">
      <button class="btn primary" disabled=${!dirty} onClick=${() => { saveTemplate({ ...t, ...d }); toast('Шаблон сохранён'); }}>Сохранить</button>
      <button class="btn ghost danger" onClick=${() => confirm('Удалить шаблон?') && onDelete()}><${Icon} n="trash" s=${15} />Удалить</button>
    </div>
  </div>`;
}

// ---------- настройки ----------
export function Settings() {
  const s = useStore();
  return html`
    <div class="page-head"><div><h1 class="page-title">Настройки</h1>
      <div class="page-sub">${s.mode === 'demo' ? 'Сейчас открыты демо-данные' : `Данные: ${s.settings.dataRepo}`}</div></div></div>
    <div class="settings">
      <${ThemePanel} />
      ${s.mode === 'github' ? html`<${RobotsPanel} />` : null}
      <${NotesPanel} />
      <${ImportPanel} />
      <${DataPanel} />
      <${ConnectPanel} />
    </div>`;
}

function ThemePanel() {
  return html`<div class="panel"><h3>Оформление</h3><${GraphicsPanel} /></div>`;
}

function RobotsPanel() {
  const s = useStore();
  const [st, setSt] = useState({});
  const [busy, setBusy] = useState('');
  const load = () => {
    if (!s.settings.appRepo) return;
    ROBOTS.forEach((r) => robotStatus(r.file).then((x) => setSt((o) => ({ ...o, [r.file]: x }))).catch((e) => setSt((o) => ({ ...o, [r.file]: { error: explain(e) } }))));
  };
  useEffect(load, []);
  const run = async (file) => {
    setBusy(file);
    try { await runRobot(file); toast('Запустила. Через пару минут появятся данные'); setTimeout(load, 4000); }
    catch (e) { toast('Не запустилось: ' + explain(e)); }
    setBusy('');
  };
  const label = (x) => {
    if (!x) return 'ещё не запускался';
    if (x.error) return x.error;
    const res = x.status !== 'completed' ? 'идёт сейчас' : x.conclusion === 'success' ? 'успешно' : x.conclusion === 'failure' ? 'с ошибкой' : x.conclusion;
    return `${ago(x.updated_at)}, ${res}`;
  };
  return html`<div class="panel">
    <h3>Роботы</h3>
    ${!s.settings.appRepo ? html`<p>${nb('Укажи ниже репозиторий с роботами, чтобы запускать их отсюда.')}</p>` : html`
    <div class="robots">${ROBOTS.map((r) => {
      const x = st[r.file];
      const tone = !x ? '' : x.error || x.conclusion === 'failure' ? 'err' : x.status !== 'completed' ? 'busy' : 'ok';
      return html`<div class="robot" key=${r.file}>
        <span class="dot ${tone}"></span>
        <div class="grow"><div class="robot-name">${r.name}</div><div class="muted" style="font-size:12px">${r.every} · последний запуск: ${label(x)}</div></div>
        ${x?.html_url ? html`<a class="btn sm ghost" href=${x.html_url} target="_blank" rel="noopener">Лог</a>` : null}
        <button class="btn sm" disabled=${busy === r.file} onClick=${() => run(r.file)}><${Icon} n="play" s=${13} />Запустить</button>
      </div>`;
    })}</div>`}
  </div>`;
}

function DataPanel() {
  const s = useStore();
  const exportCsv = () => {
    const cols = ['Название', 'Ниша', 'Регион', 'Город', 'Адрес', 'Приоритет', 'Проблемы', 'Телефон', 'Сайт', 'VK', 'Telegram', 'Instagram', 'Статус', 'Метки'];
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = allLeads().map((l) => {
      const c = s.crm.leads[l.id] || {};
      return [l.name, l.niche, l.region, l.city, l.addr, l.prio, (l.flags || []).map((f) => FLAGS[f]?.label).join(', '), l.phone, l.site, l.vk, l.tg, l.insta,
        stOf(LEAD_ST, c.s).label, (c.tags || []).join(', ')].map(q).join(';');
    });
    download('лиды.csv', '﻿' + [cols.map(q).join(';'), ...rows].join('\n'), 'text/csv;charset=utf-8');
  };
  return html`<div class="panel">
    <h3>Данные</h3>
    <dl class="kv">
      <dt>Лиды</dt><dd>${fmtNum(s.data.leads.items?.length)} · ${s.data.leads.updated ? ago(s.data.leads.updated) : 'сбора не было'}</dd>
      <dt>Заказы</dt><dd>${fmtNum(s.data.orders.items?.length)} · ${s.data.orders.updated ? ago(s.data.orders.updated) : 'сбора не было'}</dd>
      <dt>Отметки</dt><dd>${fmtNum(Object.keys(s.crm.leads).length + Object.keys(s.crm.orders).length + Object.keys(s.crm.vacancies).length)} · ${s.sync.msg}</dd>
    </dl>
    <div class="row wrap">
      <button class="btn" onClick=${() => start().then(() => toast('Данные обновлены'))}><${Icon} n="refresh" s=${15} />Обновить</button>
      <button class="btn" onClick=${exportCsv}><${Icon} n="download" s=${15} />Лиды в Excel (CSV)</button>
      <button class="btn ghost" onClick=${() => download('crm.json', JSON.stringify(s.crm, null, 1))}>Резервная копия отметок</button>
    </div>
  </div>`;
}

function ConnectPanel() {
  const s = useStore();
  return html`<div class="panel">
    <h3>${s.mode === 'demo' ? 'Подключить свои данные' : 'Подключение к GitHub'}</h3>
    <${ConnectForm} />
    ${s.mode ? html`<div><button class="btn ghost sm" onClick=${() => confirm('Выйти? Токен останется сохранён в этом браузере, отметки — в GitHub.') && logout()}>
      <${Icon} n="logout" s=${14} />${s.mode === 'demo' ? 'Выйти из демо' : 'Выйти'}</button></div>` : null}
  </div>`;
}

function ConnectForm() {
  const s = useStore();
  const [f, setF] = useState({ token: s.settings.token, dataRepo: s.settings.dataRepo, appRepo: s.settings.appRepo });
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const clean = (v) => v.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
  const repoOk = (v) => /^[\w.-]+\/[\w.-]+$/.test(clean(v));
  const err = {
    token: f.token && !/^(github_pat_|ghp_)/.test(f.token.trim()) ? 'Токен обычно начинается с github_pat_' : '',
    dataRepo: f.dataRepo && !repoOk(f.dataRepo) ? 'Формат: логин/репозиторий' : '',
    appRepo: f.appRepo && !repoOk(f.appRepo) ? 'Формат: логин/репозиторий' : '',
  };
  const go = async () => {
    const v = { token: f.token.trim(), dataRepo: clean(f.dataRepo), appRepo: clean(f.appRepo) };
    setBusy(true); setRes(null);
    try {
      const out = await testConnection(v);
      setRes(out);
      connect(v);
    } catch (e) { setRes([{ tone: 'err', text: explain(e) }]); }
    setBusy(false);
  };
  return html`<div style="display:grid;gap:14px">
    <div class="field"><label for="tk">Токен GitHub</label>
      <input id="tk" class="input" type="password" autocomplete="off" placeholder="github_pat_…" value=${f.token} onInput=${(e) => setF({ ...f, token: e.target.value })} />
      ${err.token ? html`<span class="error">${err.token}</span>` : html`<span class="help">${nb('Хранится только в этом браузере. Нужен доступ только к репозиторию с данными (инструкция, шаг 2).')}</span>`}</div>
    <div class="field"><label for="dr">Репозиторий с данными (приватный)</label>
      <input id="dr" class="input" placeholder="логин/lead-data" value=${f.dataRepo} onInput=${(e) => setF({ ...f, dataRepo: e.target.value })} />
      ${err.dataRepo ? html`<span class="error">${err.dataRepo}</span>` : null}</div>
    <div class="field"><label for="ar">Репозиторий с роботами</label>
      <input id="ar" class="input" placeholder="логин/lead-parser" value=${f.appRepo} onInput=${(e) => setF({ ...f, appRepo: e.target.value })} />
      ${err.appRepo ? html`<span class="error">${err.appRepo}</span>` : html`<span class="help">Необязательно: чтобы видеть, когда роботы запускались.</span>`}</div>
    ${res ? html`<div style="display:grid;gap:6px">${res.map((r) => html`<div class="notice ${r.tone === 'err' ? 'err' : r.tone === 'good' ? 'good' : ''}">${nb(r.text)}</div>`)}</div>` : null}
    <div class="row wrap">
      <button class="btn primary" disabled=${busy || !f.token || !f.dataRepo || err.dataRepo || err.appRepo} onClick=${go}>
        ${busy ? 'Проверяю…' : 'Подключить'}</button>
    </div>
  </div>`;
}

// ---------- первый запуск ----------
export function Onboarding() {
  const s = useStore();
  return html`<div class="onb">
    <section class="onb-left">
      <div class="brand" style="padding:0"><div class="brand-mark">Г</div><div><div class="brand-name">Гарден</div><div class="brand-sub">клиенты и заказы</div></div></div>
      <h1>${nb('Всё, что наловили роботы, в одном месте')}</h1>
      <p>${nb('Лиды с карт и заказы с бирж. Отмечай, кому написала, веди воронку и смотри статистику. Работает бесплатно на GitHub.')}</p>
      <ol class="onb-steps">
        <li>${nb('Залей проект в публичный репозиторий и включи GitHub Pages (папка /docs).')}</li>
        <li>${nb('Создай приватный репозиторий для данных, например lead-data, с README внутри.')}</li>
        <li>${nb('Создай два токена с доступом только к lead-data (Contents: Read and write): для роботов и для приложения.')}</li>
        <li>${nb('Первый добавь в секреты роботов, второй вставь справа.')}</li>
      </ol>
      <div class="kao">ฅ^•ﻌ•^ฅ</div>
    </section>
    <section class="onb-right">
      <h2 style="margin:0;font-size:20px;letter-spacing:-.02em">Подключение</h2>
      ${s.error ? html`<div class="notice err">${s.error}</div>` : null}
      <${ConnectForm} />
      <div class="row" style="gap:12px;margin-top:6px"><span class="muted" style="font-size:12.5px">${nb('Ещё не настроила?')}</span>
        <button class="btn ghost" onClick=${useDemo}><${Icon} n="sparkle" s=${15} />Посмотреть на демо-данных</button></div>
    </section>
  </div>`;
}
