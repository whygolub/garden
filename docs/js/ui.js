// Общие кусочки интерфейса.
import { html } from './lib.js';
import { Icon } from './icons.js';
import { FLAGS, PRIO, mainFlag, urlOf, tgHref, phoneHref, mapLinks, nb, stOf } from './util.js';

export function showTip(e, content) {
  const t = document.getElementById('tip');
  if (!t) return;
  t.innerHTML = content;
  t.classList.add('on');
  const r = t.getBoundingClientRect();
  let x = e.clientX + 14, y = e.clientY + 14;
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
  if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14;
  t.style.left = Math.max(8, x) + 'px';
  t.style.top = Math.max(8, y) + 'px';
}
export function hideTip() { document.getElementById('tip')?.classList.remove('on'); }
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function LeadBadge({ l }) {
  const f = mainFlag(l);
  if (f && f !== 'no_contacts') {
    const F = FLAGS[f];
    return html`<span class="badge ${F.tone}">${F.tone === 'hot' ? html`<${Icon} n="flame" s=${12} />` : null}${F.label}</span>`;
  }
  const p = PRIO[l.prio ?? 0];
  return html`<span class="badge ${p.tone}">${p.label}</span>`;
}

export function StatusPill({ list, k, onClick }) {
  const st = stOf(list, k || 'new');
  return html`<span class="pill" onClick=${onClick}><span class="dot" style=${{ background: st.color }}></span>${st.label}</span>`;
}

const stop = (e) => e.stopPropagation();
export function Contacts({ l, compact }) {
  const m = mapLinks(l);
  const items = [
    { k: 'phone', href: l.phone && phoneHref(l.phone), title: l.phone ? `Позвонить: ${l.phone}` : 'Телефона нет', icon: 'phone' },
    { k: 'vk', href: l.vk && urlOf(l.vk), title: 'VK', text: 'VK' },
    { k: 'tg', href: l.tg && tgHref(l.tg), title: 'Telegram', icon: 'tg' },
    { k: 'insta', href: l.insta && urlOf(l.insta), title: 'Instagram', icon: 'insta' },
    { k: 'site', href: l.site && l.site !== l.vk && l.site !== l.insta && urlOf(l.site), title: l.site || 'Сайта нет', icon: 'globe' },
    { k: 'ya', href: m.ya, title: 'Яндекс.Карты', text: 'Я' },
    { k: 'gis', href: m.gis, title: '2ГИС', text: '2Г' },
  ];
  const direct = items.some((i) => i.href && i.k !== 'ya' && i.k !== 'gis');
  const shown = !compact ? items : items.filter((i) => i.href && (direct ? i.k !== 'ya' && i.k !== 'gis' : true));
  return html`<div class="contacts">
    ${shown.map((i) => html`
      <a class="cbtn ${i.href ? '' : 'off'}" href=${i.href || undefined} target=${i.k === 'phone' ? undefined : '_blank'} rel="noopener"
        title=${i.title} aria-label=${i.title} onClick=${stop}>
        ${i.icon ? html`<${Icon} n=${i.icon} />` : i.text}
      </a>`)}
  </div>`;
}

export function Empty({ kao = '(・_・;)', title, children }) {
  return html`<div class="empty"><div class="kao">${kao}</div><b>${nb(title)}</b><div>${children}</div></div>`;
}

export function Skeleton({ n = 8 }) {
  return html`<div class="grid">${Array.from({ length: n }, (_, i) => html`<div class="skel" style="height:178px" key=${i}></div>`)}</div>`;
}

export function Select({ value, onChange, options, label, all = 'Все' }) {
  return html`<select class="select ${value ? 'on' : ''}" value=${value} aria-label=${label}
    onChange=${(e) => onChange(e.target.value)}>
    <option value="">${label}: ${all.toLowerCase()}</option>
    ${options.map((o) => html`<option value=${o.v ?? o}>${o.l ?? o}</option>`)}
  </select>`;
}

export function Seg({ value, onChange, items }) {
  return html`<div class="seg" role="tablist">
    ${items.map((i) => html`<button role="tab" aria-selected=${value === i.v} class=${value === i.v ? 'on' : ''}
      title=${i.title || i.l} onClick=${() => onChange(i.v)}>${i.icon ? html`<${Icon} n=${i.icon} s=${15} />` : null}${i.l}</button>`)}
  </div>`;
}
