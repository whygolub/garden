// Состояние приложения, загрузка данных и синхронизация CRM через GitHub API.
import { useState, useEffect } from './lib.js';
import { lsGet, lsSet, DEFAULT_TEMPLATES } from './util.js';

const API = 'https://api.github.com';
export const ROBOTS = [
  { file: 'sync-1.yml', name: 'Заказы с бирж', every: 'каждые 10 минут' },
  { file: 'sync-3.yml', name: 'Лиды с карт', every: 'по понедельникам' },
];

const emptyCrm = () => ({ v: 1, leads: {}, orders: {}, vacancies: {}, templates: {}, base: {}, log: [] });
const emptyData = () => ({ leads: { items: [] }, orders: { items: [] }, vacancies: { items: [] } });

export const S = {
  phase: 'boot',          // boot | setup | loading | ready | error
  mode: lsGet('ulov.mode', null),   // github | demo
  settings: (({ name, ...rest }) => ({ token: '', dataRepo: '', appRepo: '', ...rest }))(lsGet('ulov.settings', {})),
  error: '',
  data: emptyData(),
  crm: emptyCrm(),
  crmSha: null,
  sync: { state: 'idle', msg: '' },
  toast: null,
  seen: lsGet('ulov.seen', {}),
  seenPrev: {},
  loadedAt: null,
};

const listeners = new Set();
export function set(patch) { Object.assign(S, patch); listeners.forEach((f) => f()); }
export function useStore() {
  const [, tick] = useState(0);
  useEffect(() => { const l = () => tick((x) => x + 1); listeners.add(l); return () => listeners.delete(l); }, []);
  return S;
}

let toastTimer;
export function toast(msg) {
  clearTimeout(toastTimer);
  set({ toast: { msg, id: Date.now() } });
  toastTimer = setTimeout(() => set({ toast: null }), 2400);
}

// ---------- GitHub ----------
export async function gh(path, { method = 'GET', body, accept = 'application/vnd.github+json', raw = false, bin = false, token } = {}) {
  let r;
  try {
    r = await fetch(API + path, {
      method, cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token ?? S.settings.token}`, Accept: accept,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const err = new Error('Нет связи с GitHub. Проверь интернет.'); err.status = 0; throw err;
  }
  if (!r.ok) {
    const err = new Error(`GitHub ответил ${r.status}`); err.status = r.status;
    try { err.body = await r.json(); } catch (e) { /* пусто */ }
    throw err;
  }
  if (r.status === 204) return null;
  return bin ? r.arrayBuffer() : raw ? r.text() : r.json();
}

export function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function b64decode(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function readJson(name, fallback) {
  try {
    const text = await gh(`/repos/${S.settings.dataRepo}/contents/${name}`, { accept: 'application/vnd.github.raw+json', raw: true });
    return JSON.parse(text);
  } catch (e) {
    if (e.status === 404) return fallback;
    throw e;
  }
}

async function readCrm() {
  try {
    const j = await gh(`/repos/${S.settings.dataRepo}/contents/crm.json`);
    const text = j.content ? b64decode(j.content)
      : await gh(`/repos/${S.settings.dataRepo}/contents/crm.json`, { accept: 'application/vnd.github.raw+json', raw: true });
    return { crm: { ...emptyCrm(), ...JSON.parse(text) }, sha: j.sha };
  } catch (e) {
    if (e.status === 404) return { crm: emptyCrm(), sha: null };
    throw e;
  }
}

export function explain(e) {
  if (e.status === 401) return 'Токен не подходит или истёк. Создай новый и вставь в настройках.';
  if (e.status === 403) return 'У токена не хватает прав. Для данных нужен Contents: Read and write. Запуск роботов кнопкой требует доступа к их репозиторию, поэтому по умолчанию запускай их во вкладке Actions на GitHub.';
  if (e.status === 404) return 'Репозиторий не найден. Проверь название (вида логин/репозиторий) и что токену дали к нему доступ.';
  return e.message || String(e);
}

// ---------- CRM ----------
function mergeMap(a = {}, b = {}) {
  const o = { ...a };
  for (const k in b) if (!o[k] || (b[k]?.t || 0) >= (o[k]?.t || 0)) o[k] = b[k];
  return o;
}
export function mergeCrm(a, b) {
  const seen = new Set();
  const log = [...(a.log || []), ...(b.log || [])].filter((x) => {
    const key = `${x.t}|${x.k}|${x.id}|${x.s}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((x, y) => x.t - y.t).slice(-6000);
  return {
    v: 1,
    leads: mergeMap(a.leads, b.leads), orders: mergeMap(a.orders, b.orders),
    vacancies: mergeMap(a.vacancies, b.vacancies), templates: mergeMap(a.templates, b.templates),
    base: mergeMap(a.base, b.base), log,
  };
}
function seedTemplates(crm) {
  // новые версии шаблонов заменяют старые, если ты их не правила (t: 0)
  for (const t of DEFAULT_TEMPLATES) {
    const cur = crm.templates[t.id];
    if (!cur || (!cur.del && !cur.t && (cur.v || 1) < t.v)) crm.templates[t.id] = { ...t, t: 0 };
  }
  return crm;
}

const crmKey = () => `ulov.crm.${S.mode}`;
let saveTimer;
function changed() {
  S.crm = { ...S.crm };
  lsSet(crmKey(), S.crm);
  if (S.mode === 'github') {
    lsSet('ulov.dirty', true);
    set({ sync: { state: 'busy', msg: 'Сохраняю…' } });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveRemote, 1200);
  } else {
    set({});
  }
}

let saving = false, again = false;
async function saveRemote() {
  if (saving) { again = true; return; }
  saving = true;
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await gh(`/repos/${S.settings.dataRepo}/contents/crm.json`, {
          method: 'PUT',
          body: { message: 'crm: обновление из приложения', content: b64encode(JSON.stringify(S.crm)), ...(S.crmSha ? { sha: S.crmSha } : {}) },
        });
        S.crmSha = res.content.sha;
        lsSet('ulov.dirty', false);
        set({ sync: { state: 'ok', msg: 'Сохранено' } });
        break;
      } catch (e) {
        if ((e.status === 409 || e.status === 422) && attempt < 3) {
          const remote = await readCrm();      // кто-то сохранил раньше нас — сливаем
          S.crm = mergeCrm(remote.crm, S.crm);
          S.crmSha = remote.sha;
          continue;
        }
        throw e;
      }
    }
  } catch (e) {
    set({ sync: { state: 'err', msg: e.status === 0 ? 'Нет сети, сохраню позже' : 'Не сохранилось: ' + explain(e) } });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveRemote, 15000);
  } finally {
    saving = false;
    if (again) { again = false; saveRemote(); }
  }
}

export function getItem(kind, id) { return S.crm[kind][id] || {}; }
export function setItem(kind, id, patch) {
  const prev = S.crm[kind][id] || {};
  const now = Date.now();
  S.crm[kind] = { ...S.crm[kind], [id]: { ...prev, ...patch, t: now } };
  if (patch.s !== undefined && patch.s !== (prev.s || 'new')) {
    S.crm.log = [...S.crm.log, { t: now, k: kind, id, s: patch.s, from: prev.s || 'new' }];
  }
  changed();
}
export function saveTemplate(tpl) {
  S.crm.templates = { ...S.crm.templates, [tpl.id]: { ...tpl, t: Date.now() } };
  changed();
}
export function deleteTemplate(id) {
  S.crm.templates = { ...S.crm.templates, [id]: { id, del: true, t: Date.now() } };
  changed();
}
export const templates = () => Object.values(S.crm.templates).filter((t) => !t.del);

// своя база клиентов (импорт из старой таблицы и ручное добавление)
export function saveBase(id, data) {
  S.crm.base = { ...S.crm.base, [id]: { ...data, t: Date.now() } };
  changed();
}
export function deleteBase(id) {
  S.crm.base = { ...S.crm.base, [id]: { del: true, t: Date.now() } };
  changed();
}
// массовые изменения (импорт): правим S.crm напрямую, потом один раз сохраняем
export function commit() { changed(); }

// ---------- загрузка ----------
// демо-данные сдвигаем во времени, чтобы они всегда выглядели свежими
function shiftDemo(all, ms) {
  const sh = (s) => {
    if (!s) return s;
    const d = new Date(Date.parse(s.length === 10 ? s + 'T12:00:00' : s) + ms);
    return s.length === 10 ? d.toISOString().slice(0, 10) : d.toISOString();
  };
  for (const k of ['leads', 'orders', 'vacancies']) {
    all[k].updated = sh(all[k].updated);
    for (const it of all[k].items) { if (it.date) it.date = sh(it.date); if (it.first_seen) it.first_seen = sh(it.first_seen); }
  }
  for (const k of ['leads', 'orders', 'vacancies']) for (const v of Object.values(all.crm[k])) v.t += ms;
  for (const x of all.crm.log) x.t += ms;
}
async function loadDemo() {
  const get = (n) => fetch(`demo/${n}`, { cache: 'no-store' }).then((r) => r.json());
  const [leads, orders, vacancies, crm, meta] = await Promise.all([get('leads.json'), get('orders.json'), get('vacancies.json'), get('crm.json'), get('meta.json')]);
  const days = Math.floor((Date.now() - Date.parse(meta.generated)) / 864e5);
  if (days > 0) shiftDemo({ leads, orders, vacancies, crm }, days * 864e5);
  const local = lsGet('ulov.crm.demo', null);
  return { data: { leads, orders, vacancies }, crm: local ? mergeCrm(crm, local) : { ...emptyCrm(), ...crm }, sha: null };
}
async function loadGithub() {
  const [leads, orders, vacancies, remote] = await Promise.all([
    readJson('leads.json', { items: [] }), readJson('orders.json', { items: [] }),
    readJson('vacancies.json', { items: [] }), readCrm(),
  ]);
  let crm = remote.crm;
  const local = lsGet('ulov.crm.github', null);
  const dirty = lsGet('ulov.dirty', false);
  if (dirty && local) crm = mergeCrm(crm, local);
  return { data: { leads, orders, vacancies }, crm, sha: remote.sha, dirty };
}

export async function start() {
  if (!S.mode) return set({ phase: 'setup' });
  set({ phase: S.phase === 'ready' ? 'ready' : 'loading', error: '' });
  try {
    const res = S.mode === 'demo' ? await loadDemo() : await loadGithub();
    for (const k of ['orders', 'vacancies']) {
      if (!S.seen[k]) S.seen[k] = new Date().toISOString();
    }
    lsSet('ulov.seen', S.seen);
    S.crmSha = res.sha;
    if (S.phase !== 'ready') window.scrollTo(0, 0);
    set({
      phase: 'ready', data: res.data, crm: seedTemplates(res.crm), loadedAt: new Date().toISOString(),
      sync: S.mode === 'demo' ? { state: 'ok', msg: 'Демо: сохраняется в браузере' } : { state: 'ok', msg: 'Синхронизировано' },
    });
    if (res.dirty) changed();
  } catch (e) {
    set({ phase: S.phase === 'ready' ? 'ready' : 'error', error: explain(e) });
    if (S.phase === 'ready') toast('Не удалось обновить: ' + explain(e));
  }
}

export function useDemo() {
  lsSet('ulov.mode', 'demo');
  set({ mode: 'demo', notes: null });
  start();
}
export function connect(settings) {
  const s = { ...S.settings, ...settings };
  lsSet('ulov.settings', s);
  lsSet('ulov.mode', 'github');
  set({ settings: s, mode: 'github', phase: 'loading', notes: null });
  start();
}
export function logout() {
  lsSet('ulov.mode', null);
  set({ mode: null, phase: 'setup', data: emptyData(), crm: emptyCrm(), notes: null });
}
export function saveSettings(patch) {
  const s = { ...S.settings, ...patch };
  lsSet('ulov.settings', s);
  set({ settings: s });
}

export async function testConnection({ token, dataRepo, appRepo }) {
  const out = [];
  const repo = await gh(`/repos/${dataRepo}`, { token });
  if (!repo.private) out.push({ tone: 'warn', text: `${dataRepo} публичный: заметки и статусы будут видны всем. Лучше сделать его приватным.` });
  if (repo.permissions && !repo.permissions.push) throw Object.assign(new Error('x'), { status: 403 });
  out.push({ tone: 'good', text: `Данные: ${dataRepo} — доступ есть.` });
  if (appRepo) {
    try {
      await gh(`/repos/${appRepo}/actions/workflows`, { token });
      out.push({ tone: 'good', text: `Роботы: ${appRepo} — статус виден.` });
    } catch (e) {
      out.push({ tone: 'warn', text: `Роботы: ${appRepo} — ${e.status === 404 ? 'не найден или нет прав Actions' : explain(e)}. Запуск из приложения работать не будет, остальное — да.` });
    }
  }
  return out;
}

// ---------- роботы ----------
export async function robotStatus(file) {
  const j = await gh(`/repos/${S.settings.appRepo}/actions/workflows/${file}/runs?per_page=1`);
  return j.workflow_runs?.[0] || null;
}
export async function runRobot(file) {
  const repo = await gh(`/repos/${S.settings.appRepo}`);
  await gh(`/repos/${S.settings.appRepo}/actions/workflows/${file}/dispatches`, { method: 'POST', body: { ref: repo.default_branch } });
}

// ---------- «новое с прошлого раза» ----------
export function enterFeed(kind) {
  S.seenPrev[kind] = S.seen[kind];
  S.seen[kind] = new Date().toISOString();
  lsSet('ulov.seen', S.seen);
}
export function freshCount(kind) {
  const since = S.seen[kind];
  if (!since) return 0;
  const t = Date.parse(since);
  return S.data[kind].items.filter((i) => Date.parse(i.date) > t && !S.crm[kind][i.id]?.s).length;
}

// автообновление раз в 5 минут, когда вкладка открыта
setInterval(() => { if (S.phase === 'ready' && document.visibilityState === 'visible') start(); }, 5 * 60 * 1000);
