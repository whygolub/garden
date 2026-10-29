// Работа с лидом: статусы с дожимом, касания, каналы, стоп, экспорт.
import { S, set, setItem, getItem, toast, templates } from './store.js';
import { LEAD_ST, CLOSED, stOf, urlOf, tgHref, phoneHref, mapLinks, renderTemplate, download, FLAGS, copy } from './util.js';
import { leadBrief } from './services.js';

export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const isDue = (c) => !!(c?.due && c.due <= today() && !CLOSED.includes(c.s) && !c.nofollow);

export const STOP_REASONS = ['Не моя ниша', 'Сеть или франшиза', 'Закрылись', 'Уже есть подрядчик', 'Заблокировали меня', 'Не хочу работать'];

// клавиши статусов, как в «Разведке»
export const STATUS_KEYS = { '`': 'new', 1: 'todo', 2: 'sent', 3: 'replied', 4: 'client' };

// смена статуса + автоматический дожим
export function markStatus(id, s, extra = {}) {
  const c = getItem('leads', id);
  const patch = { s, ...extra };
  if (s === 'sent' && !c.nofollow && (!c.due || c.due < today())) {
    patch.due = addDays(3);
    if (!c.next) patch.next = 'Дожать, если не ответят';
  }
  if (s === 'replied') { patch.due = today(); patch.next = c.next && c.next !== 'Дожать, если не ответят' ? c.next : 'Ответить'; }
  setItem('leads', id, patch);
}

export function addTouch(id, text, channel = '') {
  const c = getItem('leads', id);
  setItem('leads', id, { hist: [...(c.hist || []), { t: Date.now(), text, channel }].slice(-60) });
}

// все касания: ручные записи + смены статуса «написала/ответили»
export function touchesOf(id) {
  const c = S.crm.leads[id] || {};
  const manual = (c.hist || []).map((h) => ({ t: h.t, text: h.text, channel: h.channel, manual: true }));
  const fromLog = S.crm.log.filter((x) => x.k === 'leads' && x.id === id && x.s !== 'new')
    .map((x) => ({ t: x.t, text: `${stOf(LEAD_ST, x.from).label} → ${stOf(LEAD_ST, x.s).label}` }));
  return [...manual, ...fromLog].sort((a, b) => b.t - a.t);
}
export function touchCount(id) {
  const c = S.crm.leads[id] || {};
  const sent = S.crm.log.filter((x) => x.k === 'leads' && x.id === id && x.s === 'sent').length;
  return sent + (c.hist || []).length;
}
export function lastTouch(id) {
  const t = touchesOf(id)[0];
  return t ? t.t : 0;
}

// каналы связи для России
export function channels(l) {
  const digits = String(l.phone || '').replace(/\D/g, '');
  const intl = digits.length === 11 && digits[0] === '8' ? '7' + digits.slice(1) : digits;
  return [
    { k: 'vk', key: 'Q', label: 'ВКонтакте', sub: l.vk ? l.vk.replace(/^https?:\/\/(www\.)?/, '') : 'нет', href: l.vk && urlOf(l.vk), cls: 'ch-vk' },
    { k: 'tg', key: 'W', label: 'Telegram', sub: l.tg ? l.tg.replace(/^https?:\/\//, '') : intl.length === 11 ? 'по номеру' : 'нет',
      href: l.tg ? tgHref(l.tg) : intl.length === 11 ? `https://t.me/+${intl}` : '', cls: 'ch-tg' },
    { k: 'insta', key: 'E', label: 'Instagram', sub: l.insta ? l.insta.replace(/^https?:\/\/(www\.)?/, '') : 'нет', href: l.insta && urlOf(l.insta), cls: 'ch-insta' },
    { k: 'phone', key: 'R', label: 'Позвонить', sub: l.phone || 'нет номера', href: l.phone && phoneHref(l.phone), cls: 'ch-phone' },
  ];
}

// где искать, кто принимает решения
export function whoLinks(l) {
  const q = encodeURIComponent([l.name, l.city || l.region].filter(Boolean).join(' '));
  const m = mapLinks(l);
  return [
    { label: 'Ответы на отзывы', href: l.mapUrl ? l.mapUrl.replace(/\/?$/, '/reviews/') : m.ya, hint: 'Владелец часто подписывается именем' },
    { label: 'Руспрофиль', href: `https://www.rusprofile.ru/search?query=${q}`, hint: 'Юрлицо и руководитель по названию' },
    { label: 'Контакты в ВК', href: l.vk ? urlOf(l.vk) : `https://vk.com/search?c%5Bq%5D=${encodeURIComponent(l.name || '')}&c%5Bsection%5D=communities`, hint: 'Блок «Контакты» в группе' },
    ...(l.phone ? [{ label: 'Номер в поиске', href: `https://yandex.ru/search/?text=${encodeURIComponent(l.phone)}`, hint: 'Чей это номер' }] : []),
  ];
}

// лучший шаблон под нишу
export function bestTemplate(l) {
  const all = templates();
  return all.find((t) => t.niches?.includes(l.niche)) || all.find((t) => !t.niches?.length) || all[0];
}
export function makeDraft(l) {
  const t = bestTemplate(l);
  return t ? renderTemplate(t.text, l, getItem('leads', l.id)) : '';
}

// открыть канал и скопировать черновик
export async function openChannel(l, ch) {
  if (!ch.href) return toast(`${ch.label}: контакта нет`);
  const c = getItem('leads', l.id);
  const draft = c.draft || makeDraft(l);
  if (ch.k !== 'phone' && draft) { await copy(draft); toast('Черновик скопирован, вставь в чат'); }
  window.open(ch.href, ch.k === 'phone' ? '_self' : '_blank', 'noopener');
}

export function stopLead(id, reason) {
  setItem('leads', id, { s: 'block', why: reason });
  toast(`В стопе: ${reason}`);
}

// ---------- экспорт ----------
const RULES = `# Лиды для сообщений

Напиши каждому заведению первое сообщение. Правила:
- тон мягкий и живой, не официальный; всё с маленькой буквы, кроме имён и названий;
- никогда не писать «малый бизнес»;
- 3–5 коротких предложений: одно конкретное наблюдение про них (из «что видно сразу» или «проблемы»), что я могу сделать, мягкий вопрос в конце;
- цену в первом сообщении не называть, подсказки по ценам — для меня;
- если есть «деталь» или «демо» — обязательно использовать;
- каналы: ВКонтакте, Telegram или Instagram (WhatsApp и Viber не предлагать).

`;

export function exportLeads(list, { claude = true, toTodo = false, sheets = false } = {}) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const tel = (v) => (sheets && v ? `="${v}"` : v);
  const head = ['Тип', 'Название', 'Ниша', 'Город', 'Адрес', 'Телефон', 'ВКонтакте', 'Telegram', 'Instagram', 'Сайт', 'Рейтинг', 'Отзывов', 'Статус', 'Следующий шаг', 'Дожать', 'Метки', 'Черновик'];
  const rows = list.map((l) => {
    const c = S.crm.leads[l.id] || {};
    const f = (l.flags || []).find((x) => x !== 'no_contacts');
    return [f ? FLAGS[f]?.label : '', l.name, l.nicheText || l.niche, l.city || l.region, l.addr, tel(l.phone), l.vk, l.tg, l.insta, l.site,
      c.rating ?? '', c.reviews ?? '', stOf(LEAD_ST, c.s).label, c.next, c.due, (c.tags || []).join(', '), c.draft]
      .map((v) => (typeof v === 'string' && v.startsWith('="') ? v : q(v))).join(sheets ? ',' : ';');
  });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
  download(`лиды-${stamp}.csv`, '﻿' + [head.map(q).join(sheets ? ',' : ';'), ...rows].join('\n'), 'text/csv;charset=utf-8');
  if (claude) {
    const body = list.map((l, i) => {
      const c = S.crm.leads[l.id] || {};
      const extra = [c.detail && `Деталь для персонализации: ${c.detail}`, c.demo && `Демо: ${c.demo}`, c.draft && `Мой черновик: ${c.draft}`].filter(Boolean).join('\n');
      return `## ${i + 1}. ${l.name}\n\n${leadBrief(l, c).replace(/\n\n---\nМой комментарий: $/, '')}${extra ? '\n' + extra : ''}`;
    }).join('\n\n');
    download(`лиды-для-claude-${stamp}.md`, RULES + body + '\n', 'text/markdown;charset=utf-8');
  }
  if (toTodo) for (const l of list) if (!S.crm.leads[l.id]?.s || S.crm.leads[l.id].s === 'new') setItem('leads', l.id, { s: 'todo' });
  toast(`Выгружено: ${list.length}${claude ? ' + файл для Claude' : ''}`);
}

// навигация ←/→ по текущему списку
export function navTo(delta) {
  const ids = S.nav || [];
  const i = ids.indexOf(S.open?.id);
  if (i < 0) return;
  const j = i + delta;
  if (j >= 0 && j < ids.length) set({ open: { kind: 'lead', id: ids[j] } });
}
