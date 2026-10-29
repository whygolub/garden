// Лиды: вкладки источников, фильтры, счётчики, карточки / таблица / карта, выделение и экспорт.
import { html, useState, useMemo, useEffect, useRef } from './lib.js';
import { Icon } from './icons.js';
import { useStore, set, setItem, toast } from './store.js';
import { FLAGS, PRIO, LEAD_ST, WORK, CLIENTS, CLOSED, stOf, mainFlag, fmtNum, plural, ago, lsGet, lsSet, nb, isLight } from './util.js';
import { allLeads } from './base.js';
import { LeadBadge, StatusPill, Contacts, Empty, Skeleton, Seg, esc } from './ui.js';
import { isDue, lastTouch, markStatus, makeDraft, exportLeads, STOP_REASONS, stopLead } from './leadwork.js';

const SETS = [
  { v: 'active', l: 'Все лиды' }, { v: 'new', l: 'Новые (не трогала)' }, { v: 'todo', l: 'К отправке' },
  { v: 'waiting', l: 'Жду ответа' }, { v: 'talk', l: 'Ответили' }, { v: 'client', l: 'Клиенты' },
  { v: 'paused', l: 'Отложено' }, { v: 'ignore', l: 'Игнор' }, { v: 'lost', l: 'Отказ' }, { v: 'skip', l: 'Не подходит' },
  { v: 'block', l: 'В стопе' }, { v: 'all', l: 'Вообще все' },
];
const SORTS = [
  { v: 'prio', l: 'Сначала горячие' }, { v: 'new', l: 'Сначала новые' }, { v: 'reviews', l: 'Больше отзывов' },
  { v: 'rating', l: 'Выше рейтинг' }, { v: 'stale', l: 'Давно без касания' }, { v: 'name', l: 'По алфавиту' },
];
const TYPES = ['no_site', 'template', 'social', 'autopage', 'parked', 'booking', 'no_mobile', 'no_menu', 'menu_file', 'old', 'builder'];
const DEF = { q: '', src: 'all', region: '', city: '', niche: '', set: 'active', flag: '', tag: '', sort: 'prio', view: 'grid', onlyNew: false, due: false };
const PAGE = 60;

export const leadStatus = (crm, id) => crm.leads[id]?.s || 'new';

function passSet(st, f) {
  if (st === 'block') return f === 'block';
  switch (f) {
    case 'all': return true;
    case 'active': return st !== 'skip' && st !== 'lost';
    case 'waiting': return st === 'sent' || st === 'noreply';
    case 'talk': return ['replied', 'call', 'kp', 'think'].includes(st);
    case 'client': return CLIENTS.includes(st);
    default: return st === f;
  }
}

export function Leads() {
  const s = useStore();
  const items = allLeads();
  const [f, setF] = useState(() => ({ ...DEF, ...lsGet('ulov.f.leads2', {}) }));
  const [q, setQ] = useState(f.q);
  const [limit, setLimit] = useState(PAGE);
  const [sel, setSel] = useState(() => new Set());
  const [exp, setExp] = useState(false);
  const upd = (p) => { setF((o) => { const n = { ...o, ...p }; lsSet('ulov.f.leads2', n); return n; }); setLimit(PAGE); };
  useEffect(() => { const t = setTimeout(() => q !== f.q && upd({ q }), 160); return () => clearTimeout(t); }, [q]);

  const srcCount = useMemo(() => ({ all: items.length, maps: items.filter((l) => !l.base).length, base: items.filter((l) => l.base).length }), [items]);
  const opts = useMemo(() => {
    const regions = new Set(), niches = new Set(), cities = new Map(), tags = new Set();
    for (const l of items) {
      regions.add(l.region); niches.add(l.niche);
      if (l.city && (!f.region || l.region === f.region)) cities.set(l.city, (cities.get(l.city) || 0) + 1);
    }
    for (const c of Object.values(s.crm.leads)) for (const t of c.tags || []) tags.add(t);
    return {
      regions: [...regions].filter(Boolean).sort(), niches: [...niches].filter(Boolean).sort(),
      cities: [...cities].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([c]) => c), tags: [...tags].sort(),
    };
  }, [items, f.region, s.crm.leads]);

  // база: всё, кроме быстрых чипов — от неё считаются счётчики
  const base = useMemo(() => {
    const qq = f.q.trim().toLowerCase();
    return items.filter((l) => {
      const c = s.crm.leads[l.id] || {};
      if (f.src === 'maps' && l.base) return false;
      if (f.src === 'base' && !l.base) return false;
      if (f.region && l.region !== f.region) return false;
      if (f.city && l.city !== f.city) return false;
      if (f.niche && l.niche !== f.niche) return false;
      if (f.tag && !(c.tags || []).includes(f.tag)) return false;
      if (!passSet(c.s || 'new', f.set)) return false;
      if (qq && !`${l.name} ${l.addr} ${l.city} ${l.niche} ${l.nicheText || ''} ${l.phone || ''} ${(c.tags || []).join(' ')}`.toLowerCase().includes(qq)) return false;
      return true;
    });
  }, [items, f.src, f.region, f.city, f.niche, f.tag, f.set, f.q, s.crm.leads]);

  const list = useMemo(() => {
    const out = base.filter((l) => {
      if (f.flag && !(l.flags || []).includes(f.flag)) return false;
      if (f.onlyNew && !l.new) return false;
      if (f.due && !isDue(s.crm.leads[l.id])) return false;
      return true;
    });
    const C = (l) => s.crm.leads[l.id] || {};
    const by = {
      prio: (a, b) => ((b.base ? 1 : 0) - (a.base ? 1 : 0)) || (b.prio - a.prio) || ((b.new ? 1 : 0) - (a.new ? 1 : 0)) || a.name.localeCompare(b.name, 'ru'),
      new: (a, b) => (b.first_seen || '').localeCompare(a.first_seen || '') || (b.prio - a.prio),
      reviews: (a, b) => (C(b).reviews || 0) - (C(a).reviews || 0) || (b.prio - a.prio),
      rating: (a, b) => (C(b).rating || 0) - (C(a).rating || 0) || (C(b).reviews || 0) - (C(a).reviews || 0),
      stale: (a, b) => (lastTouch(a.id) || Infinity) - (lastTouch(b.id) || Infinity),
      name: (a, b) => a.name.localeCompare(b.name, 'ru'),
    }[f.sort] || (() => 0);
    const low = (l) => ({ paused: 1, ignore: 2 }[C(l).s] || 0);   // отложенные и игнор всегда внизу
    return out.sort((a, b) => (low(a) - low(b)) || by(a, b));
  }, [base, f.flag, f.onlyNew, f.due, f.sort, s.crm.leads]);

  const counts = useMemo(() => {
    const c = { flags: {}, isNew: 0, due: 0, talk: 0 };
    for (const l of base) {
      for (const x of l.flags || []) c.flags[x] = (c.flags[x] || 0) + 1;
      if (l.new) c.isNew++;
      if (isDue(s.crm.leads[l.id])) c.due++;
      if (['replied', 'call', 'kp', 'think'].includes(s.crm.leads[l.id]?.s)) c.talk++;
    }
    return c;
  }, [base]);

  const sentinel = useRef();
  useEffect(() => {
    if (!sentinel.current) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setLimit((x) => x + PAGE), { rootMargin: '600px' });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [list, f.view]);

  const open = (id) => set({ open: { kind: 'lead', id }, nav: list.map((l) => l.id) });
  const toggle = (id) => setSel((o) => { const n = new Set(o); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const shown = list.slice(0, limit);
  const allOn = shown.length > 0 && shown.every((l) => sel.has(l.id));
  const selList = list.filter((l) => sel.has(l.id));
  const dot = (tone) => html`<i class="sdot ${tone}"></i>`;
  const sc = (on, content, onClick) => html`<button class="schip ${on ? 'on' : ''}" onClick=${onClick}>${content}</button>`;
  const anyFilter = f.region || f.city || f.niche || f.tag || f.flag || f.onlyNew || f.due || f.q || f.set !== 'active' || f.src !== 'all';

  return html`
    <div class="lbar">
      <div class="tabs">
        ${[['all', 'Все'], ['maps', 'С карт'], ['base', 'Моя база']].map(([v, label]) => html`<button class=${f.src === v ? 'on' : ''} onClick=${() => upd({ src: v })}>${label} <span class="num">${fmtNum(srcCount[v])}</span></button>`)}
      </div>
      <label class="search"><${Icon} n="search" s=${16} /><span class="sr">Поиск</span>
        <input class="input" placeholder="Поиск по всей базе…" value=${q} onInput=${(e) => setQ(e.target.value)} /></label>
      <select class="select ${f.region ? 'on' : ''}" value=${f.region} onChange=${(e) => upd({ region: e.target.value, city: '' })} aria-label="Регион">
        <option value="">Все регионы</option>${opts.regions.map((o) => html`<option value=${o}>${o}</option>`)}</select>
      <select class="select ${f.city ? 'on' : ''}" value=${f.city} onChange=${(e) => upd({ city: e.target.value })} aria-label="Город">
        <option value="">Все города</option>${opts.cities.map((o) => html`<option value=${o}>${o}</option>`)}</select>
      <select class="select ${f.set !== 'active' ? 'on' : ''}" value=${f.set} onChange=${(e) => upd({ set: e.target.value })} aria-label="Какие лиды">
        ${SETS.map((o) => html`<option value=${o.v}>${o.l}</option>`)}</select>
      <select class="select ${f.niche ? 'on' : ''}" value=${f.niche} onChange=${(e) => upd({ niche: e.target.value })} aria-label="Сфера">
        <option value="">Все сферы</option>${opts.niches.map((o) => html`<option value=${o}>${o}</option>`)}</select>
      <select class="select ${f.flag ? 'on' : ''}" value=${f.flag} onChange=${(e) => upd({ flag: e.target.value })} aria-label="Тип">
        <option value="">Все типы</option>${TYPES.filter((t) => counts.flags[t]).map((t) => html`<option value=${t}>${FLAGS[t].label}</option>`)}</select>
      ${opts.tags.length ? html`<select class="select ${f.tag ? 'on' : ''}" value=${f.tag} onChange=${(e) => upd({ tag: e.target.value })} aria-label="Метки">
        <option value="">Все метки</option>${opts.tags.map((o) => html`<option value=${o}>${o}</option>`)}</select>` : null}
      <select class="select" value=${f.sort} onChange=${(e) => upd({ sort: e.target.value })} aria-label="Сортировка">
        ${SORTS.map((o) => html`<option value=${o.v}>${o.l}</option>`)}</select>
      <div class="lbar-right">
        <button class="btn icon" title="Новый клиент" aria-label="Новый клиент" onClick=${() => set({ open: { kind: 'new-client' } })}><${Icon} n="plus" s=${16} /></button>
        <div class="pop-wrap">
          <button class="btn icon ${exp ? 'on' : ''}" title="Экспорт" aria-label="Экспорт" onClick=${() => setExp(!exp)}><${Icon} n="download" s=${16} /></button>
          ${exp ? html`<${ExportPop} list=${list} sel=${selList} onClose=${() => setExp(false)} />` : null}
        </div>
        <${Seg} value=${f.view} onChange=${(v) => upd({ view: v })} items=${[{ v: 'grid', l: '', icon: 'grid', title: 'Карточки' }, { v: 'list', l: '', icon: 'list', title: 'Таблица' }, { v: 'map', l: '', icon: 'map', title: 'Карта' }]} />
      </div>
    </div>

    <div class="sumbar">
      ${f.view !== 'map' ? html`<label class="cb" title="Выделить показанные"><input type="checkbox" checked=${allOn} onChange=${() => setSel(allOn ? new Set() : new Set(shown.map((l) => l.id)))} /><span></span></label>` : null}
      <span class="muted">Показано <b>${fmtNum(f.view === 'map' ? list.length : Math.min(limit, list.length))}</b> из <b>${fmtNum(list.length)}</b>${list.length !== items.length ? html` <span class="muted">(всего ${fmtNum(items.length)})</span>` : null}</span>
      ${counts.flags.no_site ? sc(f.flag === 'no_site', html`${dot('hot')}${fmtNum(counts.flags.no_site)} без сайта`, () => upd({ flag: f.flag === 'no_site' ? '' : 'no_site' })) : null}
      ${counts.flags.template ? sc(f.flag === 'template', html`${dot('warm')}${fmtNum(counts.flags.template)} с шаблоном`, () => upd({ flag: f.flag === 'template' ? '' : 'template' })) : null}
      ${counts.flags.social ? sc(f.flag === 'social', html`${dot('accent')}${fmtNum(counts.flags.social)} только соцсети`, () => upd({ flag: f.flag === 'social' ? '' : 'social' })) : null}
      ${counts.isNew ? sc(f.onlyNew, html`новые: ${fmtNum(counts.isNew)}`, () => upd({ onlyNew: !f.onlyNew })) : null}
      ${counts.talk ? sc(f.set === 'talk', html`<${Icon} n="chat" s=${13} />ответили: ${counts.talk}`, () => upd({ set: f.set === 'talk' ? 'active' : 'talk' })) : null}
      ${counts.due ? sc(f.due, html`<${Icon} n="clock" s=${13} />пора дожать: ${counts.due}`, () => upd({ due: !f.due })) : null}
      ${anyFilter ? html`<button class="link-btn" onClick=${() => { setQ(''); upd({ ...DEF, view: f.view, sort: f.sort }); }}>сбросить</button>` : null}
    </div>

    ${sel.size ? html`<div class="bulk">
      <b>Выбрано: ${sel.size}</b>
      <button class="btn sm" onClick=${() => { selList.forEach((l) => markStatus(l.id, 'todo')); toast(`К отправке: ${sel.size}`); setSel(new Set()); }}><${Icon} n="plus" s=${14} />В работу</button>
      <button class="btn sm" onClick=${() => { const t = prompt('Метка для выбранных:'); if (t?.trim()) { selList.forEach((l) => setItem('leads', l.id, { tags: [...new Set([...(s.crm.leads[l.id]?.tags || []), t.trim()])] })); toast('Метка добавлена'); } }}><${Icon} n="tag" s=${14} />Метка</button>
      <button class="btn sm" onClick=${() => { selList.forEach((l) => { if (!s.crm.leads[l.id]?.draft) setItem('leads', l.id, { draft: makeDraft(l) }); }); toast('Черновики составлены по шаблонам'); }}><${Icon} n="sparkle" s=${14} />Черновики</button>
      <button class="btn sm" onClick=${() => exportLeads(selList, { claude: true })}><${Icon} n="download" s=${14} />Экспорт</button>
      <button class="btn sm danger" onClick=${() => { const n = prompt(`В стоп ${sel.size}? Причина цифрой:\n${STOP_REASONS.map((r, i) => `${i + 1} — ${r}`).join('\n')}`); const r = STOP_REASONS[Number(n) - 1]; if (r) { selList.forEach((l) => setItem('leads', l.id, { s: 'block', why: r })); toast(`В стопе: ${sel.size}`); setSel(new Set()); } }}><${Icon} n="ban" s=${14} />В стоп</button>
      <button class="link-btn" onClick=${() => setSel(new Set())}>снять выделение</button>
    </div>` : null}

    ${s.phase !== 'ready' ? html`<${Skeleton} />`
      : !items.length ? html`<${Empty} kao="(｡•́︿•̀｡)" title="Пока пусто">Лиды появятся после первого запуска робота sync-3 или после импорта базы в настройках.</${Empty}>`
      : !list.length ? html`<${Empty} kao="(・・ )?" title="Ничего не нашлось">Попробуй убрать часть фильтров.</${Empty}>`
      : f.view === 'map' ? html`<${LeadMap} list=${list} onOpen=${open} />`
      : f.view === 'list' ? html`<${LeadTable} list=${shown} crm=${s.crm} sel=${sel} onToggle=${toggle} onOpen=${open} />`
      : html`<div class="grid">${shown.map((l, i) => html`<${LeadCard} key=${l.id} l=${l} i=${i % PAGE} c=${s.crm.leads[l.id]} on=${sel.has(l.id)} onToggle=${toggle} onOpen=${open} />`)}</div>`}
    ${f.view !== 'map' && list.length > limit ? html`<div class="more" ref=${sentinel}><button class="btn" onClick=${() => setLimit(limit + PAGE)}>Показать ещё</button></div>` : null}
  `;
}

function ExportPop({ list, sel, onClose }) {
  const [n, setN] = useState(sel.length ? 'sel' : 20);
  const [claude, setClaude] = useState(lsGet('ulov.exp.claude', true));
  const [toTodo, setToTodo] = useState(false);
  const [sheets, setSheets] = useState(lsGet('ulov.exp.sheets', false));
  const pick = n === 'sel' ? sel : n === 'all' ? list : list.slice(0, n);
  useEffect(() => {
    const h = (e) => !e.target.closest('.pop-wrap') && onClose();
    setTimeout(() => document.addEventListener('click', h), 0);
    return () => document.removeEventListener('click', h);
  }, []);
  return html`<div class="pop">
    <div class="sec-title">Экспорт CSV</div>
    <div class="dim" style="font-size:12.5px">${nb(`Сколько лидов сверху текущего списка (${list.length}, как отсортировано)`)}</div>
    <div class="row wrap" style="gap:6px">
      ${sel.length ? html`<button class="chip ${n === 'sel' ? 'on' : ''}" onClick=${() => setN('sel')}>выбранные ${sel.length}</button>` : null}
      ${[10, 20, 50, 100].map((x) => html`<button class="chip ${n === x ? 'on' : ''}" onClick=${() => setN(x)}>${x}</button>`)}
      <button class="chip ${n === 'all' ? 'on' : ''}" onClick=${() => setN('all')}>все</button>
    </div>
    <label class="opt"><input type="checkbox" checked=${claude} onChange=${(e) => { setClaude(e.target.checked); lsSet('ulov.exp.claude', e.target.checked); }} />
      <span><b>Файл для Claude</b> — правила и всё о заведениях. Перетащи его в чат с Claude, и он сразу напишет сообщения</span></label>
    <label class="opt"><input type="checkbox" checked=${toTodo} onChange=${(e) => setToTodo(e.target.checked)} />
      <span>Перевести выгруженных новых в «Хочу написать»</span></label>
    <label class="opt"><input type="checkbox" checked=${sheets} onChange=${(e) => { setSheets(e.target.checked); lsSet('ulov.exp.sheets', e.target.checked); }} />
      <span>Для Google Таблиц (номер не станет формулой)</span></label>
    <button class="btn primary" disabled=${!pick.length} onClick=${() => { exportLeads(pick, { claude, toTodo, sheets }); onClose(); }}>
      Выгрузить ${pick.length} ${plural(pick.length, 'лид', 'лида', 'лидов')}${claude ? ' + файл для Claude' : ''}</button>
  </div>`;
}

function Rating({ c }) {
  if (!c?.rating && !c?.reviews) return null;
  return html`<span class="rate">${c.rating ? html`<b>${String(c.rating).replace('.', ',')}</b><${Icon} n="star" s=${12} />` : null}${c.reviews ? html`<span class="muted">${fmtNum(c.reviews)}</span>` : null}</span>`;
}

function LeadCard({ l, i, c, on, onToggle, onOpen }) {
  const st = c?.s || 'new';
  return html`<article class="card prio-${l.prio} ${on ? 'sel' : ''}" style=${{ '--i': Math.min(i, 24) }} onClick=${() => onOpen(l.id)}
      tabindex="0" onKeyDown=${(e) => e.key === 'Enter' && onOpen(l.id)}>
    <div class="card-top">
      <label class="cb" onClick=${(e) => e.stopPropagation()}><input type="checkbox" checked=${on} onChange=${() => onToggle(l.id)} /><span></span></label>
      <${LeadBadge} l=${l} />
      ${l.new ? html`<span class="badge new">новое</span>` : null}
      ${l.base ? html`<span class="badge accent">база</span>` : null}
      ${isDue(c) ? html`<span class="badge ${c.due < new Date().toISOString().slice(0, 10) ? 'hot' : 'warm'}" title=${c.next || ''}><${Icon} n="clock" s=${11} />дожать</span>` : null}
    </div>
    <div class="card-name">${l.name}</div>
    <div class="card-meta"><${Icon} n="pin" /><span class="grow">${l.city || l.region}${l.nicheText || l.niche ? ` · ${(l.nicheText || l.niche).toLowerCase()}` : ''}</span><${Rating} c=${c} /></div>
    <div class="card-foot">
      <${Contacts} l=${l} compact />
      <span class="status">
        ${st === 'new'
          ? html`<button class="btn sm ghost" onClick=${(e) => { e.stopPropagation(); markStatus(l.id, 'todo'); }}><${Icon} n="plus" s=${14} />В работу</button>`
          : html`<${StatusPill} list=${LEAD_ST} k=${st} />`}
      </span>
    </div>
  </article>`;
}

function LeadTable({ list, crm, sel, onToggle, onOpen }) {
  const stop = (e) => e.stopPropagation();
  return html`<div class="tbl-wrap"><table class="table ltable">
    <thead><tr><th></th><th>Тип</th><th>Заведение</th><th class="hide-m">Телефон</th><th class="hide-m">Написать</th><th class="hide-m">Сайт</th><th class="hide-m">Рейтинг</th><th>Статус</th><th class="hide-m">Черновик сообщения</th></tr></thead>
    <tbody>${list.map((l) => {
      const c = crm.leads[l.id] || {};
      const f = mainFlag(l);
      const instead = f === 'social' || f === 'template';
      return html`<tr key=${l.id} class=${sel.has(l.id) ? 'sel' : ''} onClick=${() => onOpen(l.id)}>
        <td onClick=${stop}><label class="cb"><input type="checkbox" checked=${sel.has(l.id)} onChange=${() => onToggle(l.id)} /><span></span></label></td>
        <td><${LeadBadge} l=${l} /></td>
        <td class="t-main"><div class="t-name">${l.name} ${l.new ? html`<span class="badge new">новое</span>` : null}</div>
          <div class="t-sub">${[l.city || l.region, (l.nicheText || l.niche || '').toLowerCase()].filter(Boolean).join(' · ')}</div></td>
        <td class="hide-m mono nowrap" style="font-size:12.5px">${l.phone || '—'}</td>
        <td class="hide-m" onClick=${stop}><${Contacts} l=${l} compact /></td>
        <td class="hide-m t-site">${l.site ? html`${instead ? html`<div class="t-instead">вместо сайта</div>` : null}<a href=${l.site.startsWith('http') ? l.site : 'https://' + l.site} target="_blank" rel="noopener" onClick=${stop}>${l.site.replace(/^https?:\/\/(www\.)?/, '').slice(0, 32)}</a>` : html`<span class="muted">—</span>`}</td>
        <td class="hide-m nowrap">${c.rating || c.reviews ? html`<${Rating} c=${c} />` : html`<span class="muted">—</span>`}</td>
        <td onClick=${stop}><select class="select sm-select" value=${c.s || 'new'} onChange=${(e) => markStatus(l.id, e.target.value)} aria-label="Статус">
          ${LEAD_ST.filter((x) => x.k !== 'block').map((x) => html`<option value=${x.k}>${x.label}</option>`)}</select></td>
        <td class="hide-m t-draft" onClick=${stop}>${c.draft ? html`<div class="draft-cell" onClick=${() => onOpen(l.id)}>${c.draft}</div>`
          : html`<button class="draft-cell empty" onClick=${() => setItem('leads', l.id, { draft: makeDraft(l) })}><${Icon} n="sparkle" s=${13} />составить</button>`}</td>
      </tr>`;
    })}</tbody>
  </table></div>`;
}

// ---------- карта ----------
let leafletP;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leafletP) {
    leafletP = new Promise((res, rej) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'vendor/leaflet.css';
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = 'vendor/leaflet.js'; js.onload = () => res(window.L); js.onerror = rej;
      document.head.appendChild(js);
    });
  }
  return leafletP;
}
const PRIO_HEX = { 3: '#e5604f', 2: '#f2b33d', 1: '#8b8b96', 0: '#3fae5a' };

function LeadMap({ list, onOpen }) {
  const box = useRef(), map = useRef(), layer = useRef();
  const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true;
    loadLeaflet().then((L) => {
      if (!alive || map.current) return;
      map.current = L.map(box.current, { preferCanvas: true, zoomControl: true }).setView([59.94, 30.31], 9);
      const tiles = () => L.tileLayer(`https://{s}.basemaps.cartocdn.com/${isLight() ? 'light_all' : 'dark_all'}/{z}/{x}/{y}{r}.png`, {
        maxZoom: 19, subdomains: 'abcd',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      });
      let base = tiles().addTo(map.current);
      const onTheme = () => { map.current?.removeLayer(base); base = tiles().addTo(map.current); base.bringToBack(); draw(L, false); };
      window.addEventListener('themechange', onTheme);
      map.current.on('unload', () => window.removeEventListener('themechange', onTheme));
      layer.current = L.layerGroup().addTo(map.current);
      map.current.on('popupopen', (e) => {
        const b = e.popup.getElement()?.querySelector('[data-open]');
        if (b) b.onclick = () => onOpen(b.dataset.open);
      });
      draw(L, true);
    }).catch(() => setErr('Не загрузилась библиотека карты.'));
    return () => { alive = false; map.current?.remove(); map.current = null; };
  }, []);

  function draw(L, fit) {
    if (!layer.current) return;
    layer.current.clearLayers();
    const pts = [];
    for (const l of [...list].sort((a, b) => a.prio - b.prio)) {
      if (!l.lat || !l.lon) continue;
      pts.push([l.lat, l.lon]);
      const f = mainFlag(l);
      L.circleMarker([l.lat, l.lon], {
        radius: l.prio === 3 ? 6 : 5, color: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0f0f11', weight: 1.5, fillColor: PRIO_HEX[l.prio], fillOpacity: .95,
      }).bindPopup(`<div style="display:grid;gap:6px;min-width:180px">
          <b style="font-size:13.5px">${esc(l.name)}</b>
          <span style="color:var(--text-2)">${esc(l.niche)}${l.city ? ' · ' + esc(l.city) : ''}</span>
          ${f ? `<span style="color:${PRIO_HEX[l.prio]}">${esc(FLAGS[f].label)}</span>` : ''}
          <button data-open="${esc(l.id)}" class="btn sm primary" style="margin-top:4px">Открыть карточку</button></div>`)
        .addTo(layer.current);
    }
    if (fit && pts.length) map.current.fitBounds(pts, { padding: [30, 30], maxZoom: 13 });
  }
  useEffect(() => { if (window.L && map.current) draw(window.L, false); }, [list]);

  const noGeo = list.filter((l) => !l.lat).length;
  return html`<div>
    ${err ? html`<div class="notice err">${err}</div>` : null}
    <div class="mapbox" ref=${box}></div>
    <div class="map-legend">
      ${[3, 2, 1, 0].map((p) => html`<span><i style=${{ background: PRIO_HEX[p] }}></i>${PRIO[p].label}</span>`)}
      ${noGeo ? html`<span class="muted">${fmtNum(noGeo)} ${plural(noGeo, 'точка', 'точки', 'точек')} без координат</span>` : null}
    </div>
  </div>`;
}
