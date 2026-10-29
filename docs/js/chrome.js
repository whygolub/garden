// Оформление: фоны окна, цвет акцента, тема; панель клавиш.
import { html, useState } from './lib.js';
import { Icon } from './icons.js';
import { set } from './store.js';
import { lsGet, lsSet, getTheme, setTheme, nb } from './util.js';
import { STOP_REASONS } from './leadwork.js';

export const BACKS = [
  { v: 'dots', l: 'Точки', d: 'Дуга из точек внизу окна' },
  { v: 'threads', l: 'Нити', d: 'Пучок тонких линий' },
  { v: 'glow', l: 'Сияние', d: 'Мягкие пятна цвета, плывут' },
  { v: 'grid', l: 'Сетка', d: 'Клетка, тающая к краям' },
  { v: 'none', l: 'Без фона', d: 'Ничего не рисуется' },
];
export const ACCENTS = [
  { v: 'lavender', l: 'Лаванда', c: '#b4a2ee' }, { v: 'rose', l: 'Роза', c: '#ee86a6' }, { v: 'mint', l: 'Мята', c: '#6fd3b0' },
  { v: 'sky', l: 'Небо', c: '#7fb6f5' }, { v: 'peach', l: 'Персик', c: '#f2a477' }, { v: 'lemon', l: 'Лимон', c: '#e6cf6a' },
];

export function applyLook() {
  const r = document.documentElement;
  const a = lsGet('ulov.accent', 'lavender'), b = lsGet('ulov.bg', 'dots');
  if (a === 'lavender') delete r.dataset.accent; else r.dataset.accent = a;
  r.dataset.bg = b;
}

export function BgLayer() {
  return html`<div class="bgfx" aria-hidden="true"><i></i><i></i><i></i></div>`;
}

export function GraphicsPanel() {
  const [bg, setBg] = useState(lsGet('ulov.bg', 'dots'));
  const [ac, setAc] = useState(lsGet('ulov.accent', 'lavender'));
  const [th, setTh] = useState(getTheme());
  const pickBg = (v) => { lsSet('ulov.bg', v); setBg(v); applyLook(); };
  const pickAc = (v) => { lsSet('ulov.accent', v); setAc(v); applyLook(); window.dispatchEvent(new Event('themechange')); };
  return html`<div class="ppanel">
    <div class="pp-title">Фон окна</div>
    <div class="bg-list">${BACKS.map((x) => html`<button class="bg-opt ${bg === x.v ? 'on' : ''}" onClick=${() => pickBg(x.v)}>
        <span class="bg-prev" data-prev=${x.v}></span><span><b>${x.l}</b><small>${x.d}</small></span></button>`)}</div>
    <div class="pp-title">Цвет</div>
    <div class="swatches">${ACCENTS.map((x) => html`<button class="sw ${ac === x.v ? 'on' : ''}" style=${{ background: x.c }} title=${x.l} aria-label=${x.l} onClick=${() => pickAc(x.v)}></button>`)}</div>
    <div class="pp-title">Тема</div>
    <div class="seg" style="width:100%">${[['system', 'Система'], ['light', 'День'], ['dark', 'Ночь']].map(([v, l]) => html`
      <button class=${th === v ? 'on' : ''} style="flex:1;justify-content:center" onClick=${() => { setTheme(v); setTh(v); }}>${l}</button>`)}</div>
    <div class="muted" style="font-size:11.5px;margin-top:10px">${nb('Запоминается на этом устройстве.')}</div>
  </div>`;
}

const K = ({ k }) => html`<kbd>${k}</kbd>`;
export function KeysPanel() {
  const rows = (list) => list.map(([k, t]) => html`<div class="krow"><span class="kk">${[].concat(k).map((x) => html`<${K} k=${x} />`)}</span><span>${t}</span></div>`);
  return html`<div class="ppanel">
    <p class="dim" style="font-size:12.5px;margin:0 0 6px">${nb('Работают в открытой карточке лида. Раскладка не важна: русская тоже подойдёт.')}</p>
    <div class="pp-title">Листание</div>
    ${rows([[['A', '←'], 'Предыдущий лид'], [['D', '→'], 'Следующий лид'], ['Esc', 'Закрыть карточку']])}
    <div class="pp-title">Статус</div>
    ${rows([['1', 'Хочу написать (к отправке)'], ['2', 'Написала — дожим через 3 дня'], ['3', 'Ответили — шаг на сегодня'], ['4', 'В работе (клиент)'], ['`', 'Вернуть в новые']])}
    <div class="pp-title">Действия</div>
    ${rows([['S', 'В стоп, потом причина цифрой'], ['T', 'Метка'], ['C', 'Скопировать черновик']])}
    <div class="pp-title">Написать</div>
    ${rows([['Q', 'ВКонтакте'], ['W', 'Telegram (или по номеру)'], ['E', 'Instagram'], ['R', 'Позвонить']])}
    <div class="pp-title">Причины стопа</div>
    ${rows(STOP_REASONS.map((r, i) => [String(i + 1), r]))}
  </div>`;
}
