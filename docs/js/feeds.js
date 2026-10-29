// Ленты: заказы с бирж и вакансии.
import { html, useState, useMemo, useEffect } from './lib.js';
import { Icon } from './icons.js';
import { useStore, set, setItem, enterFeed } from './store.js';
import { ORDER_ST, VAC_ST, stOf, ago, fmtNum, sourceKey, SOURCE_COLORS, lsGet, lsSet, plural } from './util.js';
import { Empty, Seg, StatusPill } from './ui.js';
import { firstLine } from './drawer.js';

const CONF = {
  orders: {
    title: 'Заказы с бирж', list: ORDER_ST, open: 'заказ', srcLabel: 'Источник',
    empty: 'Заказы появятся, когда робот «Заказы с бирж» найдёт что-то по твоим ключевым словам.',
    tabs: [{ v: 'inbox', l: 'Входящие' }, { v: 'fav', l: 'Интересные' }, { v: 'applied', l: 'Откликнулась' }, { v: 'won', l: 'Взяла' }, { v: 'skip', l: 'Скрытые' }, { v: 'all', l: 'Все' }],
  },
  vacancies: {
    title: 'Вакансии', list: VAC_ST, open: 'сообщение', srcLabel: 'Чат',
    empty: 'Вакансии появятся после первого запуска робота «Вакансии из Telegram».',
    tabs: [{ v: 'inbox', l: 'Входящие' }, { v: 'fav', l: 'Интересные' }, { v: 'applied', l: 'Откликнулась' }, { v: 'interview', l: 'Собесы' }, { v: 'offer', l: 'Офферы' }, { v: 'rejected', l: 'Отказы' }, { v: 'skip', l: 'Скрытые' }, { v: 'all', l: 'Все' }],
  },
};
const PERIODS = [{ v: '1', l: 'Сутки' }, { v: '3', l: '3 дня' }, { v: '7', l: 'Неделя' }, { v: '', l: 'Всё' }];

export function Feed({ kind }) {
  const s = useStore();
  const C = CONF[kind];
  const items = s.data[kind].items || [];
  const [f, setF] = useState(() => ({ q: '', src: '', tab: 'inbox', period: '', ...lsGet(`ulov.f.${kind}`, {}) }));
  const [limit, setLimit] = useState(40);
  const upd = (p) => setF((o) => { const n = { ...o, ...p }; lsSet(`ulov.f.${kind}`, n); setLimit(40); return n; });
  const [since] = useState(() => { enterFeed(kind); return s.seenPrev[kind]; });

  const srcOf = (p) => kind === 'orders' ? sourceKey(p.source) : p.chat;
  const sources = useMemo(() => {
    const m = new Map();
    for (const p of items) m.set(srcOf(p), (m.get(srcOf(p)) || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [items]);
  const srcColor = (src) => SOURCE_COLORS[['FL.ru', 'Хабр Фриланс', 'Kwork', 'Telegram'].indexOf(src)] || 'var(--text-3)';

  const tabCount = {};
  const list = useMemo(() => {
    const qq = f.q.trim().toLowerCase();
    const minT = f.period ? Date.now() - Number(f.period) * 864e5 : 0;
    return items.filter((p) => {
      const st = s.crm[kind][p.id]?.s || 'new';
      if (f.tab === 'inbox' && !(st === 'new' || st === 'fav')) return false;
      if (f.tab !== 'inbox' && f.tab !== 'all' && st !== f.tab) return false;
      if (f.src && srcOf(p) !== f.src) return false;
      if (minT && Date.parse(p.date) < minT) return false;
      if (qq && !`${p.title || ''} ${p.text} ${p.chat || ''}`.toLowerCase().includes(qq)) return false;
      return true;
    });
  }, [items, f, s.crm[kind]]);
  for (const t of C.tabs) {
    tabCount[t.v] = t.v === 'all' ? items.length : items.filter((p) => {
      const st = s.crm[kind][p.id]?.s || 'new';
      return t.v === 'inbox' ? st === 'new' || st === 'fav' : st === t.v;
    }).length;
  }

  const sinceT = since ? Date.parse(since) : Infinity;
  const freshN = items.filter((p) => Date.parse(p.date) > sinceT).length;

  return html`
    <div class="page-head">
      <div>
        <h1 class="page-title">${C.title}</h1>
        <div class="page-sub">${s.data[kind].updated ? `Обновлено ${ago(s.data[kind].updated)}` : 'Пока не обновлялось'}${freshN ? ` · ${freshN} ${plural(freshN, 'новый', 'новых', 'новых')} с прошлого захода` : ''}</div>
      </div>
      <div class="toolbar-right"><${Seg} value=${f.period} onChange=${(v) => upd({ period: v })} items=${PERIODS} /></div>
    </div>
    <div class="quick">
      ${C.tabs.map((t) => html`<button class="chip ${f.tab === t.v ? 'on' : ''}" onClick=${() => upd({ tab: t.v })}>${t.l} <span class="num">${fmtNum(tabCount[t.v])}</span></button>`)}
    </div>
    <div class="filters">
      <label class="search"><${Icon} n="search" s=${16} /><span class="sr">Поиск</span>
        <input class="input" placeholder="Поиск по тексту…" value=${f.q} onInput=${(e) => upd({ q: e.target.value })} /></label>
      <select class="select ${f.src ? 'on' : ''}" value=${f.src} onChange=${(e) => upd({ src: e.target.value })} aria-label=${C.srcLabel}>
        <option value="">${C.srcLabel}: все</option>
        ${sources.slice(0, 120).map(([k, n]) => html`<option value=${k}>${k} (${n})</option>`)}
      </select>
    </div>

    ${!items.length ? html`<${Empty} kao="( ˘ ³˘)" title="Пока тихо">${C.empty}</${Empty}>`
      : !list.length ? html`<${Empty} kao="(・・ )?" title="Здесь пусто">Посмотри другие вкладки или убери фильтры.</${Empty}>`
      : html`<div class="feed">
          ${list.slice(0, limit).map((p, i) => html`<${Post} key=${p.id} p=${p} i=${i} kind=${kind} C=${C}
              fresh=${Date.parse(p.date) > sinceT} src=${srcOf(p)} color=${kind === 'orders' ? srcColor(srcOf(p)) : null} />`)}
        </div>
        ${list.length > limit ? html`<div class="more"><button class="btn" onClick=${() => setLimit(limit + 40)}>Показать ещё (${list.length - limit})</button></div>` : null}`}
  `;
}

function Post({ p, i, kind, C, fresh, src, color }) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const st = s.crm[kind][p.id]?.s || 'new';
  const hasNote = s.crm[kind][p.id]?.n;
  const title = kind === 'orders' ? p.title : firstLine(p.text);
  let body = kind === 'orders' ? p.text
    : p.text.replace(title.replace(/…$/, ''), '').replace(/^(\s*#[\p{L}\p{N}_]+)+\s*/u, '').trim();
  if (kind === 'orders' && body.startsWith(p.title)) body = body.slice(p.title.length).trim();
  const tags = [...(p.hits || p.roles || []), ...(p.places || [])];
  const act = (k) => setItem(kind, p.id, { s: st === k ? 'new' : k });

  return html`<article class="post ${fresh ? 'fresh' : ''} ${st === 'skip' ? 'dimmed' : ''}" style=${{ '--i': Math.min(i, 20) }}>
    <div class="post-head">
      <span class="src">${color ? html`<i style=${{ background: color }}></i>` : html`<${Icon} n="tg" s=${13} />`}${src}</span>
      <span>·</span><span title=${p.date}>${ago(p.date)}</span>
      ${p.price ? html`<span>·</span><span class="price">${p.price}</span>` : null}
      ${st !== 'new' ? html`<${StatusPill} list=${C.list} k=${st} />` : null}
      ${hasNote ? html`<span class="badge outline" title="Есть заметка"><${Icon} n="lock" s=${11} />заметка</span>` : null}
    </div>
    <div class="post-title">${title}</div>
    ${body ? html`<div class="post-text ${open ? '' : 'clamp'}" onClick=${() => setOpen(true)}>${body}</div>` : null}
    ${tags.length ? html`<div class="row wrap">${tags.slice(0, 8).map((t) => html`<span class="badge outline">${t}</span>`)}</div>` : null}

    <div class="post-actions">
      ${p.url ? html`<a class="btn sm primary" href=${p.url} target="_blank" rel="noopener"><${Icon} n="ext" s=${14} />Открыть ${C.open}</a>` : null}
      <button class="btn sm ${st === 'fav' ? 'on' : ''}" onClick=${() => act('fav')} aria-pressed=${st === 'fav'}>
        <${Icon} n="star" s=${14} style=${st === 'fav' ? { color: 'var(--accent)', fill: 'var(--accent)' } : null} />Интересно</button>
      <button class="btn sm" onClick=${() => act('applied')} aria-pressed=${st === 'applied'}>
        <${Icon} n="check" s=${14} style=${st === 'applied' ? { color: 'var(--ok)' } : null} />Откликнулась</button>
      <button class="btn sm ghost" onClick=${() => set({ open: { kind, id: p.id } })}>Подробнее</button>
      <button class="btn sm ghost icon" title=${st === 'skip' ? 'Вернуть' : 'Скрыть'} aria-label="Скрыть" onClick=${() => act('skip')}><${Icon} n="eyeoff" s=${15} /></button>
    </div>
  </article>`;
}
