// Воронка: доска со статусами, перетаскивание карточек.
import { html, useState, useMemo } from './lib.js';
import { useStore, set, setItem } from './store.js';
import { LEAD_ST, VAC_ST, stOf, lsGet, lsSet, ago, nb, fmtDay } from './util.js';
import { allLeads } from './base.js';
import { Seg, LeadBadge } from './ui.js';
import { Icon } from './icons.js';
import { firstLine } from './drawer.js';

// основные колонки показываются всегда, остальные — когда в них кто-то есть
const COLS = {
  leads: ['todo', 'sent', 'noreply', 'replied', 'call', 'kp', 'think', 'client', 'done', 'paused', 'lost'],
  vacancies: ['fav', 'applied', 'interview', 'offer', 'rejected'],
};
const CORE = new Set(['todo', 'sent', 'replied', 'call', 'kp', 'client', 'done', 'fav', 'applied', 'interview', 'offer', 'rejected']);
const HINT = {
  todo: 'Нажми «В работу» на карточке лида', sent: 'Перетащи сюда, когда напишешь', replied: 'Кто ответил', call: 'Обсуждаете задачу',
  kp: 'Отправила коммерческое предложение', client: 'Делаешь проект', done: 'Сдано и оплачено', lost: 'Отказались', fav: 'Отмеченные звёздочкой', applied: 'Куда откликнулась', interview: 'Собеседования',
  offer: 'Офферы', rejected: 'Отказы',
};

export function Board() {
  const s = useStore();
  const kind = 'leads'; // вакансии пока выключены
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const list = kind === 'leads' ? LEAD_ST : VAC_ST;

  const byId = useMemo(() => {
    const m = new Map();
    for (const x of kind === 'leads' ? allLeads() : s.data[kind].items || []) m.set(x.id, x);
    return m;
  }, [s.data, s.crm.base, kind]);

  const cols = useMemo(() => {
    const out = Object.fromEntries(COLS[kind].map((k) => [k, []]));
    for (const [id, v] of Object.entries(s.crm[kind])) {
      if (out[v.s] && byId.has(id)) out[v.s].push({ item: byId.get(id), t: v.t, note: v.n, next: v.next, due: v.due });
    }
    for (const k in out) out[k].sort((a, b) => b.t - a.t);
    return out;
  }, [s.crm, byId, kind]);

  const drop = (k) => { if (drag) setItem(kind, drag, { s: k }); setDrag(null); setOver(null); };

  return html`
    <div class="page-head">
      <div>
        <h1 class="page-title">Воронка</h1>
        <div class="page-sub">${nb('Перетаскивай карточки между колонками. На телефоне статус меняется внутри карточки.')}</div>
      </div>
      <div class="toolbar-right">

      </div>
    </div>
    <div class="board">
      ${COLS[kind].filter((k) => CORE.has(k) || cols[k].length).map((k) => {
        const st = stOf(list, k);
        return html`<section class="col ${over === k ? 'drop' : ''}" key=${k}
            onDragOver=${(e) => { e.preventDefault(); setOver(k); }} onDragLeave=${() => setOver(null)} onDrop=${() => drop(k)}>
          <div class="col-head"><span class="dot" style=${{ background: st.color }}></span>${st.label}<span class="num">${cols[k].length}</span></div>
          <div class="col-body">
            ${cols[k].length ? cols[k].slice(0, 80).map(({ item, t, note, next, due }) => html`
              <div class="mini ${drag === item.id ? 'dragging' : ''}" draggable="true" key=${item.id}
                onDragStart=${(e) => { setDrag(item.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.id); }} onDragEnd=${() => { setDrag(null); setOver(null); }}
                onClick=${() => set({ open: { kind: kind === 'leads' ? 'lead' : kind, id: item.id } })}>
                ${kind === 'leads' ? html`<div><${LeadBadge} l=${item} /></div>` : null}
                <div class="mini-name">${kind === 'leads' ? item.name : firstLine(item.text)}</div>
                <div class="mini-sub">${kind === 'leads' ? `${item.nicheText || item.niche} · ${item.city || item.region}` : item.chat} · ${ago(new Date(t).toISOString())}</div>
                ${next ? html`<div class="mini-sub" style="color:var(--text-2)">→ ${next}${due ? ` · ${fmtDay(due)}` : ''}</div>` : null}
                ${note ? html`<div class="mini-sub row" style="gap:4px"><${Icon} n="lock" s=${11} />есть заметка</div>` : null}
              </div>`)
            : html`<div class="col-empty">${nb(HINT[k])}</div>`}
          </div>
        </section>`;
      })}
    </div>
  `;
}
