// Карточка лида в стиле «Разведки»: навигация, действия, каналы, кто решает, дожим, касания, черновик.
import { html, useState, useMemo, useEffect, useRef } from './lib.js';
import { Icon } from './icons.js';
import { useStore, set, setItem, getItem, templates, toast } from './store.js';
import { FLAGS, PRIO, LEAD_ST, stOf, renderTemplate, copy, urlOf, mapLinks, nb, ago, fmtDay, fmtNum, plural } from './util.js';
import { LeadBadge } from './ui.js';
import { NotesBox, KeyForm } from './notesui.js';
import { PriceHints, BriefButton, BaseForm } from './baseui.js';
import { allLeads } from './base.js';
import { PRIO_LETTER } from './services.js';
import { loadNote, saveNote } from './notes.js';
import {
  STOP_REASONS, STATUS_KEYS, markStatus, addTouch, touchesOf, touchCount, channels, whoLinks, openChannel, stopLead,
  bestTemplate, navTo, today, addDays, isDue,
} from './leadwork.js';

const close = () => set({ open: null });
const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

// поле, которое само сохраняется в отметки лида
function Field({ id, k, label, ph, area, type = 'text', rows = 2, inputRef }) {
  const [v, setV] = useState(getItem('leads', id)[k] ?? '');
  useEffect(() => {
    if (String(v) === String(getItem('leads', id)[k] ?? '')) return;
    const t = setTimeout(() => setItem('leads', id, { [k]: type === 'number' ? (v === '' ? undefined : Number(v)) : v }), 600);
    return () => clearTimeout(t);
  }, [v]);
  const props = { id: `lf-${k}`, class: area ? 'textarea' : 'input', placeholder: ph, value: v, onInput: (e) => setV(e.target.value), ref: inputRef };
  return html`<div class="field">${label ? html`<label for=${`lf-${k}`}>${label}</label>` : null}
    ${area ? html`<textarea ...${props} rows=${rows}></textarea>` : html`<input ...${props} type=${type} />`}</div>`;
}

function Tags({ id, inputRef }) {
  const tags = getItem('leads', id).tags || [];
  const [v, setV] = useState('');
  const add = () => {
    const t = v.trim().replace(/,$/, '');
    if (t && !tags.includes(t)) setItem('leads', id, { tags: [...tags, t] });
    setV('');
  };
  return html`<div class="tags">
    ${tags.map((t) => html`<span class="tag">${t}<button aria-label="Убрать метку" onClick=${() => setItem('leads', id, { tags: tags.filter((x) => x !== t) })}><${Icon} n="x" s=${12} /></button></span>`)}
    <input ref=${inputRef} class="tag-input" placeholder="+ метка" value=${v} onInput=${(e) => setV(e.target.value)}
      onKeyDown=${(e) => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), add())} onBlur=${add} />
  </div>`;
}

// «Кто решает» — личные данные, поэтому только в зашифрованном виде
function WhoBox({ l }) {
  const s = useStore();
  const st = s.notes?.state;
  const [d, setD] = useState(null);
  const timer = useRef();
  useEffect(() => {
    if (st !== 'ready') return;
    loadNote('who', l.id).then((n) => { try { setD({ name: '', role: '', contact: '', ...JSON.parse(n.text || '{}') }); } catch (e) { setD({ name: '', role: '', contact: n.text }); } })
      .catch(() => setD({ name: '', role: '', contact: '' }));
  }, [st, l.id]);
  const up = (k) => (e) => {
    const n = { ...d, [k]: e.target.value };
    setD(n);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const empty = !n.name && !n.role && !n.contact;
      saveNote('who', l.id, { text: empty ? '' : JSON.stringify(n), files: [] }).catch(() => toast('Не сохранилось'));
    }, 700);
  };
  return html`<div class="who">
    <div class="who-links">${whoLinks(l).map((w) => html`<a class="chip" href=${w.href} target="_blank" rel="noopener" title=${w.hint}>${w.label}</a>`)}</div>
    ${st === 'ready' && d ? html`<div class="who-grid">
        <div class="field"><label for="who-n">Имя</label><input id="who-n" class="input" placeholder="Олег" value=${d.name} onInput=${up('name')} /></div>
        <div class="field"><label for="who-r">Роль</label><input id="who-r" class="input" placeholder="владелец, управляющий…" value=${d.role} onInput=${up('role')} /></div>
        <div class="field wide"><label for="who-c">Личный контакт</label><input id="who-c" class="input" placeholder="+7 900 000-00-00 или @ник" value=${d.contact} onInput=${up('contact')} /></div>
        <div class="muted wide row" style="font-size:11.5px;gap:5px"><${Icon} n="lock" s=${11} />${nb('Хранится зашифрованным, как заметки')}</div>
      </div>`
      : st === 'nokey' ? html`<${KeyForm} mode="create" compact />`
      : st === 'locked' ? html`<${KeyForm} mode="unlock" compact />`
      : html`<div class="skel" style="height:60px"></div>`}
  </div>`;
}

function Draft({ l, c, copyRef }) {
  const list = useMemo(() => {
    const all = templates();
    return [...all.filter((t) => t.niches?.includes(l.niche)), ...all.filter((t) => !t.niches?.length), ...all.filter((t) => t.niches?.length && !t.niches.includes(l.niche))];
  }, [l.niche]);
  const [v, setV] = useState(c.draft || '');
  useEffect(() => {
    if (v === (getItem('leads', l.id).draft || '')) return;
    const t = setTimeout(() => setItem('leads', l.id, { draft: v }), 600);
    return () => clearTimeout(t);
  }, [v]);
  const fill = (tid) => {
    const t = list.find((x) => x.id === tid) || bestTemplate(l);
    if (t) setV(renderTemplate(t.text, l, getItem('leads', l.id)));
  };
  const doCopy = () => { if (!v) fill(); copy(v || renderTemplate(bestTemplate(l)?.text || '', l, c)).then(() => toast('Черновик скопирован')); };
  copyRef.current = doCopy;
  return html`<div class="composer">
    <div class="row wrap" style="gap:8px">
      <select class="select grow" aria-label="Шаблон" onChange=${(e) => e.target.value && fill(e.target.value)}>
        <option value="">Составить по шаблону…</option>
        ${list.map((t) => html`<option value=${t.id}>${t.name}${t.niches?.includes(l.niche) ? ' · для этой ниши' : ''}</option>`)}
      </select>
      <button class="btn" onClick=${doCopy}><${Icon} n="copy" s=${15} />Скопировать <kbd>C</kbd></button>
    </div>
    <textarea class="textarea" rows="8" placeholder=${nb('Выбери шаблон или напиши сама. Черновик сохраняется и попадёт в экспорт для Claude.')} value=${v} onInput=${(e) => setV(e.target.value)}></textarea>
  </div>`;
}

export function LeadPanel({ id }) {
  const s = useStore();
  const [editing, setEditing] = useState(false);
  const [stopMenu, setStopMenu] = useState(false);
  const [hist, setHist] = useState('');
  const tagRef = useRef(), demoRef = useRef(), copyRef = useRef(() => {});
  const l = useMemo(() => allLeads().find((x) => x.id === id), [s.data.leads, s.crm.base, id]);
  const c = s.crm.leads[id] || {};
  const st = c.s || 'new';
  const ids = s.nav || [];
  const pos = ids.indexOf(id);
  const ch = l ? channels(l) : [];

  const doStop = (reason) => { setStopMenu(false); stopLead(id, reason); if (pos >= 0 && pos < ids.length - 1) navTo(1); else close(); };

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e) || editing) return;
      if (stopMenu) {
        const n = Number(e.key);
        if (n >= 1 && n <= STOP_REASONS.length) { e.preventDefault(); doStop(STOP_REASONS[n - 1]); }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setStopMenu(false); }
        return;
      }
      const code = e.code;
      const k = code === 'Backquote' ? '`' : code.startsWith('Digit') ? code.slice(5) : null;
      if (k && STATUS_KEYS[k]) { e.preventDefault(); markStatus(id, STATUS_KEYS[k]); toast(stOf(LEAD_ST, STATUS_KEYS[k]).label); return; }
      const map = {
        KeyA: () => navTo(-1), ArrowLeft: () => navTo(-1), KeyD: () => navTo(1), ArrowRight: () => navTo(1),
        KeyS: () => setStopMenu(true), KeyT: () => tagRef.current?.focus(), KeyC: () => copyRef.current(),
        KeyQ: () => openChannel(l, ch[0]), KeyW: () => openChannel(l, ch[1]), KeyE: () => openChannel(l, ch[2]), KeyR: () => openChannel(l, ch[3]),
      };
      if (map[code]) { e.preventDefault(); map[code](); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [id, stopMenu, editing, l]);

  if (!l) return html`<div class="empty"><div class="kao">(・_・;)</div><b>Лид не найден</b><button class="btn" onClick=${close}>Закрыть</button></div>`;
  if (editing) {
    return html`<div class="drawer-head"><div class="grow"><h2 class="drawer-title">${l.name}</h2><div class="page-sub">Редактирование</div></div>
      <button class="btn icon ghost" aria-label="Закрыть" onClick=${close}><${Icon} n="x" /></button></div>
      <${BaseForm} id=${id} onDone=${() => setEditing(false)} />`;
  }

  const m = mapLinks(l);
  const flags = (l.flags || []).filter((f) => f !== 'no_contacts');
  const touches = touchesOf(id);
  const tc = touchCount(id);
  const siteShort = (l.site || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

  return html`
    <div class="lp-top">
      <button class="btn icon sm" aria-label="Предыдущий" disabled=${pos <= 0} onClick=${() => navTo(-1)}><${Icon} n="chev-l" s=${16} /></button>
      <span class="mono muted" style="font-size:12px">${pos >= 0 ? `${pos + 1} / ${ids.length}` : ''}</span>
      <button class="btn icon sm" aria-label="Следующий" disabled=${pos < 0 || pos >= ids.length - 1} onClick=${() => navTo(1)}><${Icon} n="chev-r" s=${16} /></button>
      <span class="grow"></span>
      ${l.base ? html`<button class="btn sm ghost" onClick=${() => setEditing(true)}>Редактировать</button>` : null}
      <button class="btn icon sm" aria-label="Закрыть" onClick=${close}><${Icon} n="x" s=${16} /></button>
    </div>

    <div class="row wrap" style="gap:6px;margin:14px 0 8px">
      <${LeadBadge} l=${l} />
      <span class="badge ${PRIO[l.prio].tone}">${PRIO[l.prio].label} · ${PRIO_LETTER[l.prio]}</span>
      ${l.base ? html`<span class="badge accent">моя база</span>` : null}
      ${l.new ? html`<span class="badge new">новое</span>` : null}
      ${st !== 'new' ? html`<span class="pill"><span class="dot" style=${{ background: stOf(LEAD_ST, st).color }}></span>${stOf(LEAD_ST, st).label}</span>` : null}
    </div>
    <h2 class="drawer-title">${l.name}</h2>
    <div class="lp-meta"><${Icon} n="pin" s=${14} /><span>${[l.city || l.region, l.addr].filter(Boolean).join(', ') || 'Адреса нет'} · ${l.nicheText || l.niche}</span></div>
    ${l.site ? html`<div class="lp-meta"><${Icon} n="globe" s=${14} /><a href=${urlOf(l.site)} target="_blank" rel="noopener">${siteShort}</a>${flags.includes('social') || flags.includes('template') ? html`<span class="muted">· вместо сайта</span>` : null}</div>` : null}

    <div class="lp-actions">
      <button class="btn act-go" onClick=${() => { markStatus(id, 'todo'); toast('В работе: «Хочу написать»'); }}><${Icon} n="plus" s=${16} />В работу <kbd>1</kbd></button>
      <button class="btn" onClick=${() => { tagRef.current?.focus(); tagRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }}><${Icon} n="tag" s=${16} />Метка <kbd>T</kbd></button>
      <button class="btn" onClick=${() => (c.demo ? window.open(urlOf(c.demo), '_blank', 'noopener') : (demoRef.current?.focus(), demoRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })))}><${Icon} n="screen" s=${16} />Демо</button>
      <button class="btn act-stop" onClick=${() => setStopMenu(!stopMenu)}><${Icon} n="ban" s=${16} />В стоп <kbd>S</kbd></button>
    </div>
    ${stopMenu ? html`<div class="stop-menu">
      <div class="sec-title">Почему в стоп? <span class="muted" style="text-transform:none;letter-spacing:0">цифра 1–${STOP_REASONS.length}</span></div>
      ${STOP_REASONS.map((r, i) => html`<button class="stop-item" onClick=${() => doStop(r)}><kbd>${i + 1}</kbd>${r}</button>`)}
      <div class="muted" style="font-size:11.5px">${nb('Карточка пропадёт из списков, робот больше не возьмёт её с карт.')}</div>
    </div>` : null}

    <div class="lp-stats">
      <div><div class="lp-num">${c.rating ? String(c.rating).replace('.', ',') : '—'}</div><div class="muted">рейтинг</div></div>
      <div><div class="lp-num">${c.reviews ? fmtNum(c.reviews) : '—'}</div><div class="muted">отзывов</div></div>
      <div><div class="lp-num">${tc || '—'}</div><div class="muted">${tc ? plural(tc, 'касание', 'касания', 'касаний') : 'касаний не было'}</div></div>
    </div>

    <div class="drawer-sec">
      <div class="row"><div class="sec-title grow">Написать</div>
        <button class="link-btn" onClick=${() => { markStatus(id, 'sent'); addTouch(id, 'Написала сама'); toast('Отмечено: написала. Напомню дожать через 3 дня'); }}>Написала сама…</button></div>
      <div class="channels">${ch.map((x) => html`<button class="ch ${x.cls} ${x.href ? '' : 'off'}" onClick=${() => openChannel(l, x)}>
          <${Icon} n=${{ vk: 'vk', tg: 'tg', insta: 'insta', phone: 'phone' }[x.k]} s=${18} />
          <span class="grow"><b>${x.label}</b><small>${x.sub}</small></span><kbd>${x.key}</kbd></button>`)}</div>
      <div class="muted" style="font-size:11.5px">${nb('Кнопка открывает чат и копирует черновик, его останется только вставить.')}</div>
    </div>

    <div class="drawer-sec">
      <div class="sec-title">Кто решает</div>
      <${WhoBox} l=${l} />
    </div>

    <div class="drawer-sec">
      <div class="sec-title">Ответ заведения</div>
      <button class="btn wide-btn" onClick=${() => { markStatus(id, 'replied'); addTouch(id, 'Ответили'); toast('Отмечено: ответили. Шаг на сегодня'); }}><${Icon} n="chat" s=${16} />Отметить: ответили <kbd>3</kbd></button>
    </div>

    <div class="drawer-sec">
      <div class="sec-title">Работа с лидом</div>
      <${Field} id=${id} k="next" label="Следующий шаг" ph="Например: дожать в Telegram, позвонить" key=${'n' + (c.next || '')} />
      <div class="two">
        <${Field} id=${id} k="channel" label="Канал" ph="ВК, звонок…" />
        <div class="field"><label for="lf-due">Дожать</label>
          <input id="lf-due" class="input" type="date" value=${c.due || ''} onChange=${(e) => setItem('leads', id, { due: e.target.value, nofollow: false })} /></div>
      </div>
      <div class="row wrap" style="gap:6px"><span class="muted" style="font-size:12px">Напомнить через</span>
        ${[1, 3, 5, 7, 14].map((d) => html`<button class="chip" onClick=${() => { setItem('leads', id, { due: addDays(d), nofollow: false }); toast(`Напомню ${fmtDay(addDays(d))}`); }}>${d} дн</button>`)}
        <button class="chip" onClick=${() => setItem('leads', id, { due: '' })}>убрать</button>
        <button class="chip ${c.nofollow ? 'on' : ''}" onClick=${() => setItem('leads', id, { nofollow: !c.nofollow, due: c.nofollow ? c.due : '' })}>не дожимать</button>
      </div>
      ${isDue(c) ? html`<div class="notice">${c.due < today() ? 'Пора было дожать ' + fmtDay(c.due) : 'Дожать сегодня'}${c.next ? ': ' + c.next : ''}</div>` : null}
      <${Field} id=${id} k="detail" label="Деталь для персонализации" ph="Факт, который ты проверила сама: фирменное блюдо, концепция, свежий отзыв. Уйдёт в черновик как {деталь}" area rows=${2} />
      <${Field} id=${id} k="demo" label="Ссылка на демо" ph="https://… — макет для них, подставится как {демо}" type="url" inputRef=${demoRef} />
      <div class="two">
        <${Field} id=${id} k="rating" label="Рейтинг на картах" ph="4,8" type="number" />
        <${Field} id=${id} k="reviews" label="Отзывов" ph="128" type="number" />
      </div>
    </div>

    <div class="drawer-sec">
      <div class="sec-title">История касаний</div>
      ${touches.length ? html`<div class="timeline">${touches.slice(0, 12).map((t) => html`<div><span class="muted">${ago(new Date(t.t).toISOString())}</span><span>${t.text}${t.channel ? html` <span class="muted">· ${t.channel}</span>` : null}</span></div>`)}</div>`
        : html`<div class="muted" style="font-size:12.5px">${nb('Пока пусто. Смены статуса записываются сами, остальное добавь вручную.')}</div>`}
      <div class="row" style="gap:8px">
        <input class="input grow" placeholder="Что было: позвонила, отправила макет…" value=${hist} onInput=${(e) => setHist(e.target.value)}
          onKeyDown=${(e) => e.key === 'Enter' && hist.trim() && (addTouch(id, hist.trim(), c.channel || ''), setHist(''))} />
        <button class="btn" disabled=${!hist.trim()} onClick=${() => { addTouch(id, hist.trim(), c.channel || ''); setHist(''); }}>Добавить</button>
      </div>
    </div>

    <div class="drawer-sec">
      <div class="sec-title">Статус</div>
      <div class="status-grid">
        ${LEAD_ST.filter((x) => x.k !== 'block').map((x) => {
          const key = Object.entries(STATUS_KEYS).find(([, v]) => v === x.k)?.[0];
          return html`<button class=${st === x.k ? 'on' : ''} onClick=${() => markStatus(id, x.k)}>
            <span class="dot" style=${{ background: x.color }}></span>${x.label}${key ? html`<kbd>${key}</kbd>` : null}</button>`;
        })}
      </div>
    </div>

    <div class="drawer-sec">
      <div class="sec-title">Черновик сообщения</div>
      <${Draft} l=${l} c=${c} copyRef=${copyRef} key=${id} />
      <${BriefButton} kind="leads" item=${l} small />
    </div>

    <div class="drawer-sec">
      <div class="sec-title">Что предложить</div>
      ${l.base && (l.service || l.offer) ? html`<div class="offer">${l.service ? html`<b>${l.service}.</b> ` : null}${nb(l.offer)}</div>` : !l.base ? html`<div class="offer">${nb(l.offer)}</div>` : null}
      ${l.extra ? html`<div class="dim" style="font-size:13px">+ ${nb(l.extra)}</div>` : null}
      ${flags.length ? html`<div class="row wrap">${flags.map((f) => html`<span class="badge ${FLAGS[f].tone}">${FLAGS[f].label}</span>`)}</div>` : null}
      ${l.problems ? html`<div class="dim" style="font-size:13px">${nb(l.problems)}</div>` : null}
      ${l.menu_note ? html`<div class="dim" style="font-size:13px">Меню: ${nb(l.menu_note)}</div>` : null}
      <${PriceHints} l=${l} />
    </div>

    <div class="drawer-sec">
      <div class="sec-title">Контакты и карты</div>
      <dl class="kv">
        ${l.phone ? html`<dt>Телефон</dt><dd>${l.phone}</dd>` : null}
        ${l.contact && l.contact !== l.phone ? html`<dt>Контакт</dt><dd>${l.contact}</dd>` : null}
        ${l.email ? html`<dt>Почта</dt><dd><a href=${'mailto:' + l.email}>${l.email}</a></dd>` : null}
        ${l.hours ? html`<dt>Часы</dt><dd class="mono" style="font-size:12px">${l.hours}</dd>` : null}
        <dt>На картах</dt><dd>${l.mapUrl ? html`<a href=${l.mapUrl} target="_blank" rel="noopener">Карточка</a> · ` : null}<a href=${m.ya} target="_blank" rel="noopener">Яндекс.Карты</a> · <a href=${m.gis} target="_blank" rel="noopener">2ГИС</a></dd>
        ${l.first_seen ? html`<dt>${l.base ? 'В базе с' : 'Найден'}</dt><dd>${fmtDay(l.first_seen)}</dd>` : null}
      </dl>
    </div>

    <div class="drawer-sec">
      <div class="sec-title">Метки</div>
      <${Tags} id=${id} inputRef=${tagRef} />
    </div>

    <div class="drawer-sec">
      <div class="sec-title row">Заметки и файлы <${Icon} n="lock" s=${12} /></div>
      <${NotesBox} kind="leads" id=${id} />
    </div>
  `;
}
