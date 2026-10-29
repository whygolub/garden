// Боковая панель: карточка лида и карточка вакансии/заказа.
import { html, useState, useMemo, useEffect } from './lib.js';
import { Icon } from './icons.js';
import { useStore, set, setItem, getItem, templates, toast } from './store.js';
import {
  FLAGS, PRIO, LEAD_ST, VAC_ST, ORDER_ST, stOf, renderTemplate, copy, urlOf, tgHref, phoneHref,
  mapLinks, nb, ago, fmtDay, parseDate,
} from './util.js';
import { LeadBadge } from './ui.js';
import { NotesBox } from './notesui.js';
import { LeadPanel } from './leadpanel.js';
import { PriceHints, BriefButton, BaseForm, NewClientDrawer } from './baseui.js';
import { allLeads } from './base.js';
import { PRIO_LETTER } from './services.js';

export function Drawer() {
  const s = useStore();
  const o = s.open;
  useEffect(() => {
    if (!o) return;
    const onKey = (e) => e.key === 'Escape' && !document.querySelector('.stop-menu') && close();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [o]);
  if (!o) return null;
  return html`
    <div class="scrim" onClick=${close}></div>
    <aside class="drawer" role="dialog" aria-modal="true">
      ${o.kind === 'new-client' ? html`<${NewClientDrawer} />`
        : o.kind === 'lead' ? html`<${LeadPanel} id=${o.id} key=${o.id} />` : html`<${PostPanel} kind=${o.kind} id=${o.id} key=${o.id} />`}
    </aside>`;
}
const close = () => set({ open: null });

function StatusButtons({ list, value, onChange }) {
  return html`<div class="status-grid">
    ${list.map((st) => html`<button class=${value === st.k ? 'on' : ''} onClick=${() => onChange(st.k)}>
      <span class="dot" style=${{ background: st.color }}></span>${st.label}</button>`)}
  </div>`;
}

function Tags({ kind, id }) {
  const tags = getItem(kind, id).tags || [];
  const [v, setV] = useState('');
  const add = () => {
    const t = v.trim().replace(/,$/, '');
    if (t && !tags.includes(t)) setItem(kind, id, { tags: [...tags, t] });
    setV('');
  };
  return html`<div class="tags">
    ${tags.map((t) => html`<span class="tag">${t}<button aria-label="Убрать метку" onClick=${() => setItem(kind, id, { tags: tags.filter((x) => x !== t) })}><${Icon} n="x" s=${12} /></button></span>`)}
    <input class="tag-input" placeholder="+ метка" value=${v} onInput=${(e) => setV(e.target.value)}
      onKeyDown=${(e) => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), add())} onBlur=${add} />
  </div>`;
}

function History({ kind, id, list }) {
  const s = useStore();
  const rows = s.crm.log.filter((x) => x.k === kind && x.id === id).slice(-8).reverse();
  if (!rows.length) return null;
  return html`<div class="drawer-sec"><div class="sec-title">История</div>
    <div class="timeline">${rows.map((r) => html`<div><span class="muted">${ago(new Date(r.t).toISOString())}</span><span>${stOf(list, r.from).label} → ${stOf(list, r.s).label}</span></div>`)}</div>
  </div>`;
}

// ---------- вакансия / заказ ----------
function PostPanel({ kind, id }) {
  const s = useStore();
  const p = s.data[kind].items.find((x) => x.id === id);
  const list = kind === 'vacancies' ? VAC_ST : ORDER_ST;
  if (!p) return html`<div class="empty"><div class="kao">(・_・;)</div><b>Не найдено</b><button class="btn" onClick=${close}>Закрыть</button></div>`;
  const st = getItem(kind, id).s || 'new';
  return html`
    <div class="drawer-head">
      <div class="grow">
        <div class="page-sub" style="margin:0 0 6px">${kind === 'vacancies' ? p.chat : p.source} · ${ago(p.date)}${p.price ? ' · ' + p.price : ''}</div>
        <h2 class="drawer-title">${kind === 'vacancies' ? firstLine(p.text) : p.title}</h2>
      </div>
      <button class="btn icon ghost" aria-label="Закрыть" onClick=${close}><${Icon} n="x" /></button>
    </div>
    <div class="drawer-sec" style="border-top:0;padding-top:4px">
      <div class="post-text">${p.text}</div>
      <div class="row wrap">${[...(p.roles || p.hits || []), ...(p.places || [])].map((h) => html`<span class="badge outline">${h}</span>`)}</div>
      ${p.url ? html`<div><a class="btn primary" href=${p.url} target="_blank" rel="noopener"><${Icon} n="ext" s=${15} />Открыть ${kind === 'vacancies' ? 'сообщение' : 'заказ'}</a></div>` : null}
    </div>
    <div class="drawer-sec">
      <${BriefButton} kind=${kind} item=${p} />
    </div>
    <div class="drawer-sec">
      <div class="sec-title">Статус</div>
      <${StatusButtons} list=${list} value=${st} onChange=${(k) => setItem(kind, id, { s: k })} />
    </div>
    <div class="drawer-sec">
      <div class="sec-title row">Заметки и файлы <${Icon} n="lock" s=${12} /></div>
      <${NotesBox} kind=${kind} id=${id} />
    </div>
    <${History} kind=${kind} id=${id} list=${list} />
  `;
}
export function firstLine(t = '') {
  const line = t.split('\n').map((x) => x.trim())
    .find((x) => x.replace(/#[\p{L}\p{N}_]+/gu, '').replace(/[^\p{L}\p{N}]/gu, '').length > 3) || t.slice(0, 80);
  return line.length > 110 ? line.slice(0, 108) + '…' : line;
}
