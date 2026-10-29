// Своя база: форма клиента, импорт таблицы, подсказки по ценам, кнопка «для Claude».
import { html, useState, useMemo } from './lib.js';
import { Icon } from './icons.js';
import { useStore, set, saveBase, deleteBase, setItem, getItem, toast } from './store.js';
import { importBase, newBaseId } from './base.js';
import { loadNote } from './notes.js';
import { KeyForm } from './notesui.js';
import { SVC, suggest, fmtRange, OK_LABEL, SITE_STATES, SERVICE_OPTIONS, NICHES_ALL, regionOf, nicheOf, leadBrief, postBrief } from './services.js';
import { copy, nb, LEAD_ST, VAC_ST, ORDER_ST, lsGet, lsSet } from './util.js';

// ---------- подсказки по ценам в карточке ----------
export function PriceHints({ l }) {
  const ids = suggest(l).filter((id) => !(l.own && id === l.serviceId));
  return html`<div class="prices">
    ${l.own ? html`<div class="price-row own">
      <div class="grow"><div class="price-name">Моя оценка${l.service ? ` · ${l.service}` : ''}</div></div>
      <div class="price-val"><span class="muted">низ</span> ${fmtRange(l.own.low)}</div>
      ${l.own.mid ? html`<div class="price-val"><span class="muted">мидл</span> ${fmtRange(l.own.mid)}</div>` : null}
    </div>` : null}
    ${ids.map((id) => { const s = SVC[id]; return html`<div class="price-row" key=${id}>
      <div class="grow"><div class="price-name">${s.name}</div><div class="price-who">${nb(s.what)}</div></div>
      ${s.low ? html`<div class="price-val"><span class="muted">низ</span> ${fmtRange(s.low, s.unit, s.prefix)}</div>` : null}
      ${s.mid ? html`<div class="price-val"><span class="muted">мидл</span> ${fmtRange(s.mid, s.unit)}</div>` : null}
      ${s.ok !== 'good' ? html`<span class="badge outline ok-${s.ok}" title="Насколько цифра проверена">${OK_LABEL[s.ok]}</span>` : null}
    </div>`; })}
  </div>`;
}

// ---------- «Скопировать для Claude» ----------
export function BriefButton({ kind, item, small }) {
  const s = useStore();
  const [withNote, setWithNote] = useState(() => lsGet('ulov.brief.note', false));
  const go = async () => {
    const c = getItem(kind, item.id);
    let note = '';
    if (withNote && c.n && s.notes?.state === 'ready') { try { note = (await loadNote(kind, item.id)).text.trim(); } catch (e) { /* без заметки */ } }
    const text = kind === 'leads' ? leadBrief(item, c, note)
      : postBrief(kind, item, c, kind === 'vacancies' ? VAC_ST : ORDER_ST, note);
    await copy(text);
    toast('Скопировано: вставь в чат с Claude и допиши комментарий');
  };
  return html`<div class="row wrap" style="gap:10px">
    <button class=${`btn ${small ? 'sm' : ''}`} onClick=${go}><${Icon} n="sparkle" s=${15} />Скопировать для Claude</button>
    <label class="row dim" style="font-size:12px;gap:6px;cursor:pointer">
      <input type="checkbox" checked=${withNote} onChange=${(e) => { setWithNote(e.target.checked); lsSet('ulov.brief.note', e.target.checked); }} />с заметкой</label>
  </div>`;
}

// ---------- форма клиента ----------
const EMPTY = { name: '', niche: '', category: '', city: '', addr: '', contact: '', site: '', social: '', mapUrl: '', channel: '',
  siteState: '', problems: '', service: '', offer: '', extra: '', priority: 'B', lowMin: '', lowMax: '', midMin: '', midMax: '', type: 'Малый бизнес' };
const CHANNELS = ['ВКонтакте', 'Telegram', 'MAX', 'Телефон', 'Почта', 'Форма на сайте', 'Лично', 'Kwork', 'FL.ru', 'Другое'];

export function BaseForm({ id, onDone }) {
  const s = useStore();
  const src = id ? s.crm.base[id] : null;
  const [d, setD] = useState({ ...EMPTY, ...(src || {}) });
  const [err, setErr] = useState('');
  const up = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const svc = SVC[{ 'Лендинг с нуля': 'landing', 'Многостраничный сайт': 'multipage', 'Редизайн / переделка': 'redesign', 'Перенос с конструктора': 'migrate', 'Доработки и правки': 'fixes', 'Чат-бот (Telegram / ВК / MAX)': 'bot', 'Мини-приложение': 'miniapp', 'Оформление карточки на картах': 'card', 'Дизайн меню': 'menu', 'Дизайн прайс-листа': 'price' }[d.service]];
  const save = () => {
    if (!d.name.trim()) return setErr('Нужно название.');
    const num = (v) => (v === '' || v == null ? undefined : Number(v));
    const out = { ...d, name: d.name.trim(), region: regionOf(d.city), category: d.category || nicheOf(`${d.niche} ${d.name}`),
      lowMin: num(d.lowMin), lowMax: num(d.lowMax), midMin: num(d.midMin), midMax: num(d.midMax), createdAt: src?.createdAt || new Date().toISOString().slice(0, 10) };
    for (const k of Object.keys(out)) if (out[k] === undefined || out[k] === '') delete out[k];
    delete out.t;
    const newId = id || newBaseId(out.name);
    saveBase(newId, out);
    toast(id ? 'Сохранено' : 'Клиент добавлен');
    onDone?.(newId);
  };
  const F = (k, label, extra = {}) => html`<div class=${`field ${extra.wide ? 'wide' : ''}`}><label for=${'bf-' + k}>${label}</label>
    ${extra.options ? html`<select id=${'bf-' + k} class="select" value=${d[k]} onChange=${up(k)}><option value="">—</option>${extra.options.map((o) => html`<option value=${o}>${o}</option>`)}</select>`
      : extra.area ? html`<textarea id=${'bf-' + k} class="textarea" rows="3" value=${d[k]} onInput=${up(k)}></textarea>`
      : html`<input id=${'bf-' + k} class="input" type=${extra.type || 'text'} placeholder=${extra.ph || ''} value=${d[k]} onInput=${up(k)} />`}
    ${extra.help ? html`<span class="help">${extra.help}</span>` : null}</div>`;
  return html`<div class="bform">
    ${F('name', 'Название *', { wide: true })}
    ${F('niche', 'Чем занимаются', { ph: 'Кафе, поминальные обеды' })}
    ${F('category', 'Ниша для фильтров', { options: NICHES_ALL, help: 'Пусто — определю сама по описанию' })}
    ${F('city', 'Город', { ph: 'Великий Новгород' })}
    ${F('addr', 'Адрес')}
    ${F('contact', 'Телефон рабочий', { help: 'Имена и личные номера пиши в заметку: она зашифрована' })}
    ${F('channel', 'Канал связи', { options: CHANNELS })}
    ${F('site', 'Сайт', { type: 'url' })}
    ${F('social', 'Соцсети (через пробел)', { ph: 'https://vk.ru/…' })}
    ${F('mapUrl', 'Карточка на картах', { type: 'url', wide: true })}
    ${F('siteState', 'Состояние сайта', { options: SITE_STATES })}
    ${F('priority', 'Приоритет', { options: ['A', 'B', 'C'] })}
    ${F('problems', 'Проблемы и наблюдения', { area: true, wide: true })}
    ${F('service', 'Услуга', { options: SERVICE_OPTIONS })}
    ${F('offer', 'Оффер', { area: true, wide: true })}
    ${F('extra', 'Доп. предложение', { area: true, wide: true })}
    ${F('lowMin', 'Низ от, ₽', { type: 'number', ph: svc?.low ? String(svc.low[0]) : '' })}
    ${F('lowMax', 'Низ до, ₽', { type: 'number', ph: svc?.low ? String(svc.low[1]) : '' })}
    ${F('midMin', 'Мидл от, ₽', { type: 'number', ph: svc?.mid ? String(svc.mid[0]) : '' })}
    ${F('midMax', 'Мидл до, ₽', { type: 'number', ph: svc?.mid ? String(svc.mid[1]) : '' })}
    ${svc?.low ? html`<div class="help wide">Подсказка по рынку для «${svc.name}»: низ ${fmtRange(svc.low, svc.unit)}${svc.mid ? `, мидл ${fmtRange(svc.mid, svc.unit)}` : ''}. Если оставить цены пустыми, в карточке будут эти рыночные цифры.</div>` : null}
    ${err ? html`<div class="error wide">${err}</div>` : null}
    <div class="row wrap wide">
      <button class="btn primary" onClick=${save}>${id ? 'Сохранить' : 'Добавить клиента'}</button>
      <button class="btn ghost" onClick=${() => onDone?.(id)}>Отмена</button>
      ${id ? html`<button class="btn ghost danger" style="margin-left:auto" onClick=${() => { if (confirm('Удалить клиента из базы? Статус и заметка останутся в истории.')) { deleteBase(id); set({ open: null }); } }}><${Icon} n="trash" s=${15} />Удалить</button>` : null}
    </div>
  </div>`;
}

export function NewClientDrawer() {
  return html`<div class="drawer-head"><div class="grow"><h2 class="drawer-title">Новый клиент</h2>
      <div class="page-sub">${nb('Добавится в твою базу, рядом с лидами с карт')}</div></div>
    <button class="btn icon ghost" aria-label="Закрыть" onClick=${() => set({ open: null })}><${Icon} n="x" /></button></div>
    <${BaseForm} onDone=${(id) => set({ open: id ? { kind: 'lead', id } : null })} />`;
}

// ---------- импорт ----------
export function ImportPanel() {
  const s = useStore();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState('');
  const [res, setRes] = useState(null);
  const count = Object.values(s.crm.base || {}).filter((b) => !b.del).length;
  const isPriv = (c) => c.person || c.comments || (/частн/i.test(c.type || '') && c.contact);
  const hasPrivate = file?.clients?.some(isPriv);
  const needKey = hasPrivate && s.notes?.state !== 'ready';
  const pick = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { const j = JSON.parse(await f.text()); const list = Array.isArray(j) ? j : j.clients; if (!Array.isArray(list)) throw 0; setFile({ name: f.name, clients: list }); setRes(null); }
    catch (err) { toast('Это не файл базы'); }
  };
  const go = async () => {
    setBusy('Начинаю…');
    try { setRes(await importBase(file.clients, setBusy)); setFile(null); }
    catch (e) { toast(e.message || 'Не получилось'); }
    setBusy('');
  };
  return html`<div class="panel">
    <h3>Моя база клиентов</h3>
    <p>${nb(`Сейчас в базе: ${count}. Сюда можно загрузить файл «база-клиентов.json» из старой живой таблицы. Названия, ниши, офферы, цены и статусы лягут в общий файл отметок, а контактные лица и комментарии — в зашифрованные заметки.`)}</p>
    ${!file ? html`<label class="btn" style="width:max-content"><${Icon} n="download" s=${15} />Выбрать файл
        <input type="file" accept=".json,application/json" hidden onChange=${pick} /></label>`
      : html`<div class="notice">Файл «${file.name}»: клиентов ${file.clients.length}${hasPrivate ? `, с личными данными ${file.clients.filter(isPriv).length}` : ''}.</div>
        ${needKey ? html`<div class="notice">${nb('В файле есть контактные лица и комментарии. Их нужно сразу зашифровать, поэтому сначала создай или введи ключ заметок:')}</div><${KeyForm} mode=${s.notes?.state === 'nokey' ? 'create' : 'unlock'} compact />`
          : html`<div class="row wrap"><button class="btn primary" disabled=${!!busy} onClick=${go}>${busy ? 'Загружаю…' : 'Загрузить в базу'}</button>
            <button class="btn ghost" onClick=${() => setFile(null)}>Отмена</button></div>`}
        ${busy ? html`<div class="muted" style="font-size:12.5px">${busy}</div>` : null}`}
    ${res ? html`<div class="notice good">${nb(`Готово: новых ${res.added}, обновлено ${res.updated}, зашифрованных заметок ${res.notes}.`)} ${res.skippedNotes ? `Без заметок: ${res.skippedNotes}.` : ''} ${nb('Файл с компьютера теперь можно удалить.')}</div>` : null}
  </div>`;
}
