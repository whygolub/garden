// Каталог услуг с ценами, подбор услуг под лида, перенос базы и текст для Claude.
import { FLAGS, PRIO, LEAD_ST, stOf, mainFlag, mapLinks, fmtDay } from './util.js';

// low / mid: [от, до] в рублях. ok: good — сверено с рынком, weak — мало источников, no — не сверено.
export const SERVICES = [
  { id: 'landing', name: 'Лендинг с нуля', low: [10000, 20000], mid: [25000, 45000], ok: 'good', days: '5–10',
    who: 'Нет сайта или только соцсети',
    what: 'Одна страница: услуги и цены «от», фото, отзывы с карт, контакты, кнопки записи',
    phrase: 'простой сайт с услугами, ценами и записью' },
  { id: 'multipage', name: 'Многостраничный сайт-витрина', low: [30000, 50000], mid: [70000, 130000], ok: 'good', days: '14–30',
    who: 'Много услуг или товаров, нужен каталог без корзины',
    what: '5–10 страниц: каталог, услуги, о компании, контакты, формы заявок',
    phrase: 'сайт-витрину с каталогом' },
  { id: 'redesign', name: 'Редизайн / переделка', low: [8000, 45000], mid: [20000, 110000], ok: 'good', days: '5–20',
    who: 'Устаревший дизайн, неудобно с телефона. Цена зависит от объёма: от лендинга до многостраничника',
    what: 'Новый дизайн на старом содержании, адаптив, починка форм и ссылок',
    phrase: 'обновлённый сайт, удобный с телефона' },
  { id: 'migrate', name: 'Перенос с конструктора', low: [35000, 60000], mid: [80000, 150000], ok: 'good', days: '14–30',
    who: 'Сайт на Tilda или Wix упёрся в ограничения',
    what: 'Свой код и домен, тот же или новый дизайн, перенос содержимого',
    phrase: 'свой сайт вместо конструктора' },
  { id: 'fixes', name: 'Доработки и правки', low: [5000, 15000], mid: [15000, 35000], ok: 'good', days: '1–5',
    who: 'Сайт есть, но битые ссылки, не работают формы, нужен новый блок',
    what: 'Точечные задачи на рабочем сайте',
    phrase: 'починить ошибки на сайте' },
  { id: 'card', name: 'Оформление карточки на картах', low: [3000, 5000], mid: [7000, 10000], ok: 'good', days: '1–3',
    who: 'На Яндекс.Картах и в 2ГИС нет услуг, цен, меню или карточка не подтверждена',
    what: 'Услуги и прайс текстом, фото, описание, кнопки связи, помощь с подтверждением',
    phrase: 'оформление карточки на Яндекс.Картах и в 2ГИС' },
  { id: 'cardCare', name: 'Ведение карточки', unit: '/мес', low: [5000, 8000], mid: [10000, 15000], ok: 'good',
    who: 'Часто меняются цены, меню, акции; много отзывов без ответов',
    what: 'Обновление прайса и фото, ответы на отзывы, акции' },
  { id: 'bot', name: 'Бот записи или заявок (ВК / Telegram / MAX)', low: [7000, 15000], mid: [20000, 45000], ok: 'good', days: '5–10',
    who: 'Запись по телефону и в личке, много переписки, неявки',
    what: 'Выбор услуги, мастера и времени, напоминания, заявки в Google-таблицу',
    phrase: 'бота для онлайн-записи' },
  { id: 'bot2', name: 'Бот на вторую площадку', low: [9000, 9000], ok: 'weak', prefix: '+',
    who: 'Клиенты пишут и в ВК, и в мессенджере', what: 'Тот же бот ещё в одном мессенджере' },
  { id: 'botCare', name: 'Сервер и поддержка бота', unit: '/мес', low: [1500, 4000], ok: 'good',
    who: 'Любой бот: ему нужен сервер', what: 'Хостинг, мелкие правки, мониторинг' },
  { id: 'miniapp', name: 'Мини-приложение (меню, каталог, запись)', low: [15000, 30000], mid: [40000, 80000], ok: 'weak', days: '10–20',
    who: 'Доставка, предзаказ, каталог внутри ВК, Telegram или MAX',
    what: 'Веб-страница внутри мессенджера; тот же код можно отдать как сайт',
    phrase: 'мини-приложение с меню и заказом прямо в мессенджере' },
  { id: 'menu', name: 'Дизайн меню', low: [5000, 10000], ok: 'good', days: '3–7',
    who: 'Кафе, рестораны, бары, кофейни, пекарни, доставка',
    what: 'Меню на 4–6 страниц в одном стиле: файлы для печати и картинки для карточки на картах. Одна страница — 1 000–2 000 ₽, 8+ страниц с барной картой и обработкой фото — 10 000–15 000 ₽',
    phrase: 'аккуратное меню для печати и для карточки на картах' },
  { id: 'price', name: 'Дизайн прайс-листа', unit: '/стр', low: [1000, 2500], ok: 'weak', days: '1–3',
    who: 'Салоны, барбершопы, ногти, груминг, автосервисы, химчистки',
    what: 'Прайс в фирменном стиле: на стойку, для печати и в фото карточки. Цена по аналогии с меню (Kwork: «меню или прайс-лист» 2 500 ₽ за страницу)',
    phrase: 'красивый прайс-лист для печати и карточки на картах' },
  { id: 'menuUpdate', name: 'Обновление цен в меню или прайсе', unit: '/стр', low: [300, 500], ok: 'no',
    who: 'Тем, кому уже сделала меню', what: 'Правка цен и позиций; удобно продавать абонементом' },
  { id: 'qrmenu', name: 'QR-меню на столах', ok: 'no',
    who: 'Кафе, бары, кофейни', what: 'Страница меню по QR-коду + табличка на стол; тот же дизайн, что и печатное меню' },
  { id: 'cert', name: 'Дизайн подарочного сертификата', ok: 'no',
    who: 'Салоны, SPA, барбершопы, тату, фитнес, кафе. Сезон: ноябрь–декабрь и перед 8 марта',
    what: 'Сертификат для печати и электронный, страница «купить сертификат» (на Kwork есть от 500 ₽, это самое дно)' },
  { id: 'vk', name: 'Оформление группы ВК', ok: 'no',
    who: 'Кто живёт только в ВК: обложка, аватар, меню, товары-услуги, виджеты',
    what: 'Приводит группу в порядок; хорошо в паре с ботом записи в ВК' },
  { id: 'reviews', name: 'Табличка «Оставьте отзыв» с QR', ok: 'no',
    who: 'Все, у кого мало отзывов при хорошем сервисе',
    what: 'Табличка на стойку или стол, QR ведёт сразу на отзыв в карточке. Без фильтрации плохих отзывов: площадки это запрещают' },
  { id: 'quiz', name: 'Квиз или форма «опишите ситуацию»', ok: 'no',
    who: 'Юристы, ремонт, услуги с расчётом цены', what: 'Несколько вопросов вместо звонка, заявка приходит в мессенджер' },
  { id: 'figma', name: 'Вёрстка по макету Figma', ok: 'no', who: 'Дизайнеры и студии с готовым макетом', what: 'Адаптивная вёрстка' },
  { id: 'adaptive', name: 'Адаптив под мобильные', ok: 'no', who: 'Сайт ломается на телефоне', what: 'Мобильная версия существующего сайта' },
  { id: 'speed', name: 'Ускорение / оптимизация', ok: 'no', who: 'Сайт долго грузится', what: 'Сжатие картинок, кэш, чистка кода' },
  { id: 'support', name: 'Поддержка сайта', ok: 'no', unit: '/мес', who: 'После сдачи проекта', what: 'Правки, обновления, резервные копии' },
];
export const SVC = Object.fromEntries(SERVICES.map((s) => [s.id, s]));

// названия услуг из старой таблицы → id
const SERVICE_NAMES = {
  'Лендинг с нуля': 'landing', 'Многостраничный сайт': 'multipage', 'Вёрстка по макету Figma': 'figma',
  'Редизайн / переделка': 'redesign', 'Адаптив под мобильные': 'adaptive', 'Доработки и правки': 'fixes',
  'Ускорение / оптимизация': 'speed', 'Перенос с конструктора': 'migrate', 'Поддержка': 'support',
  'Чат-бот (Telegram / ВК / MAX)': 'bot', 'Мини-приложение': 'miniapp', 'Оформление карточки на картах': 'card',
  'Дизайн меню': 'menu', 'Дизайн прайс-листа': 'price',
};
export const SERVICE_OPTIONS = Object.keys(SERVICE_NAMES);

export const OK_LABEL = { good: 'сверено', weak: 'мало данных', no: 'не сверено' };
export function fmtRange(r, unit = '', prefix = '') {
  if (!r) return '';
  const [a, b] = r;
  const k = (n) => (n >= 1000 ? `${String(n / 1000).replace('.', ',')}` : String(n));
  const big = a >= 1000;
  const body = a === b ? (big ? `${k(a)} тыс.` : `${a}`) : big ? `${k(a)}–${k(b)} тыс.` : `${a}–${b}`;
  return `${prefix}${body} ₽${unit}`;
}

const FOOD = ['Кафе и кофейни', 'Рестораны', 'Бары и пабы', 'Фастфуд и стритфуд', 'Пекарни и кондитерские'];
const BOOKING = ['Барбершопы', 'Ногтевые студии', 'Салоны красоты', 'Груминг', 'Ветклиники', 'Стоматологии', 'Клиники', 'Автосервисы', 'Фитнес и студии', 'Тату-студии'];
const BEAUTY = ['Барбершопы', 'Ногтевые студии', 'Салоны красоты', 'Тату-студии', 'Фитнес и студии', 'Груминг'];
const PRICE_LIST = [...BEAUTY, 'Автосервисы', 'Химчистки и ателье'];

export function suggest(l) {
  const f = new Set(l.flags || []);
  const out = [];
  const add = (id) => { if (id && SVC[id] && !out.includes(id)) out.push(id); };
  if (l.serviceId) add(l.serviceId);
  const noSite = ['no_site', 'social', 'parked', 'autopage', 'booking'].some((x) => f.has(x));
  if (FOOD.includes(l.niche)) { add('menu'); if (noSite) add('landing'); add('card'); add('qrmenu'); add('miniapp'); }
  if (l.niche === 'Юристы и адвокаты' || l.niche === 'Нотариусы') { add(noSite ? 'landing' : 'redesign'); add('quiz'); add('card'); }
  if (noSite) add('landing');
  if (['old', 'no_mobile', 'slow', 'down'].some((x) => f.has(x))) add('redesign');
  if (f.has('builder')) add('migrate');
  if (BOOKING.includes(l.niche)) add('bot');
  if (PRICE_LIST.includes(l.niche)) add('price');
  if (BEAUTY.includes(l.niche)) add('cert');
  if (f.has('social')) add('vk');
  add('card');
  add('reviews');
  return out.slice(0, 5);
}

// ---------- база клиентов из старой таблицы ----------
const NICHE_RULES = [
  [/суши|ролл|фастфуд|шаверм|бургер|пицц/i, 'Фастфуд и стритфуд'],
  [/ресторан|бар\b|кафе-бар/i, 'Рестораны'],
  [/кафе|кофейн|столов|кулинар|чайн|чай\b|завтрак/i, 'Кафе и кофейни'],
  [/пекарн|кондитер|выпечк/i, 'Пекарни и кондитерские'],
  [/ногт|маникюр|nail/i, 'Ногтевые студии'],
  [/барбер/i, 'Барбершопы'],
  [/салон красоты|spa|хаммам|бров|стрижк|массаж/i, 'Салоны красоты'],
  [/груминг|зоосалон/i, 'Груминг'],
  [/ветерин/i, 'Ветклиники'],
  [/стоматолог/i, 'Стоматологии'],
  [/клиник|медцентр|медицин/i, 'Клиники'],
  [/автосалон|подержан|trade-in|выкуп/i, 'Автосалоны'],
  [/автосервис|автомойк|детейлинг|кардан|грузов|ducato|ремонт.*авто/i, 'Автосервисы'],
  [/фитнес|растяжк|йог|танц/i, 'Фитнес и студии'],
  [/тату/i, 'Тату-студии'],
  [/цвет|флор|букет/i, 'Цветочные'],
  [/юрид|юрист|адвокат/i, 'Юристы и адвокаты'],
  [/нотариус/i, 'Нотариусы'],
];
export const NICHES_ALL = [...new Set(NICHE_RULES.map((r) => r[1])), 'Химчистки и ателье', 'Другое'].sort((a, b) => a.localeCompare(b, 'ru'));
export const nicheOf = (text = '') => (NICHE_RULES.find(([re]) => re.test(text)) || [0, 'Другое'])[1];
export function regionOf(city = '') {
  if (/новгород|боровичи|старая русса|валдай|чудово|малая вишера/i.test(city)) return 'Новгородская область';
  if (/санкт-петербург|спб|петербург|шушары|пушкин|колпино|петергоф|кронштадт|сестрорецк/i.test(city)) return 'Санкт-Петербург';
  if (city) return 'Ленинградская область';
  return '';
}
export const SITE_STATES = ['Нет сайта', 'Только соцсети', 'Автостраница с карт', 'Устаревший дизайн', 'Нет адаптива', 'Медленный / баги', 'На конструкторе', 'Нормальный', 'Есть макет, нет вёрстки'];
const SITE_FLAG = {
  'Нет сайта': 'no_site', 'Только соцсети': 'social', 'Автостраница с карт': 'autopage', 'Устаревший дизайн': 'old',
  'Нет адаптива': 'no_mobile', 'Медленный / баги': 'slow', 'На конструкторе': 'builder', 'Есть макет, нет вёрстки': 'mockup',
};
export const STATUS_FROM_TABLE = {
  'Новый (не писала)': 'new', 'Написала': 'sent', 'Нет ответа': 'noreply', 'Ответил': 'replied', 'Обсуждаем': 'call',
  'Отправила КП': 'kp', 'Думает': 'think', 'В работе': 'client', 'Сдан / оплачен': 'done', 'Отказ': 'lost', 'Отложено': 'paused',
  'Игнор': 'ignore', 'Блок': 'block', 'Не подходит': 'skip',
};
const PRIO_FROM = { A: 3, B: 2, C: 1 };
export const PRIO_LETTER = { 3: 'A', 2: 'B', 1: 'C', 0: 'C' };

function splitSocial(s = '') {
  const out = {};
  for (const part of s.split(/[\s,;]+/)) {
    if (/vk\.(com|ru)/i.test(part)) out.vk ||= part;
    else if (/t\.me|telegram/i.test(part)) out.tg ||= part;
    else if (/instagram/i.test(part)) out.insta ||= part;
    else if (/^https?:\/\//i.test(part)) out.other ||= part;
  }
  return out;
}
function firstPhone(s = '') {
  const m = s.match(/\+?[78][\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/);
  return m ? m[0].trim() : '';
}

// запись базы (как в crm.base) → лид в формате приложения
export function baseToLead(id, b) {
  const soc = splitSocial(b.social);
  const flags = [];
  if (SITE_FLAG[b.siteState]) flags.push(SITE_FLAG[b.siteState]);
  const serviceId = SERVICE_NAMES[b.service] || null;
  return {
    id, base: true, name: b.name || 'Без названия', niche: b.category || nicheOf(`${b.niche} ${b.name}`), nicheText: b.niche || '',
    region: b.region || regionOf(b.city), city: b.city || '', addr: b.addr || '',
    phone: b.phone || firstPhone(b.contact), contact: b.contact || '', email: '',
    site: b.site || soc.other || '', site_kind: b.site ? 'site' : soc.vk || soc.tg ? 'social' : '',
    vk: soc.vk || '', tg: soc.tg || '', insta: soc.insta || '', mapUrl: b.mapUrl || '',
    prio: PRIO_FROM[b.priority] ?? 2, flags, problems: b.problems || '', service: b.service || '', serviceId,
    offer: b.offer || '', offerPhrase: SVC[serviceId]?.phrase, extra: b.extra || '', siteState: b.siteState || '',
    own: (b.lowMin || b.midMin) ? { low: [b.lowMin, b.lowMax || b.lowMin], mid: b.midMin ? [b.midMin, b.midMax || b.midMin] : null } : null,
    type: b.type || '', channel: b.channel || '', first_seen: b.createdAt || '', new: false,
  };
}

// ---------- текст для Claude ----------
export function leadBrief(l, c = {}, note = '') {
  const m = mapLinks(l);
  const lines = [];
  const push = (k, v) => v && lines.push(`${k}: ${v}`);
  lines.push(`Организация: ${l.name}`);
  push('Ниша', l.nicheText && l.nicheText !== l.niche ? `${l.nicheText} (${l.niche})` : l.niche);
  push('Где', [l.city || l.region, l.addr].filter(Boolean).join(', '));
  push('Телефон', l.phone || (l.contact && !l.contact.includes('@') ? l.contact : ''));
  push('Сайт', l.site);
  push('ВКонтакте', l.vk); push('Telegram', l.tg); push('Instagram', l.insta);
  push('Канал связи', l.channel);
  lines.push(`Карты: ${l.mapUrl || m.ya}${l.mapUrl ? '' : ` · 2ГИС: ${m.gis}`}`);
  lines.push(`Откуда: ${l.base ? 'моя база клиентов' : `нашёл робот по OpenStreetMap${l.first_seen ? `, ${fmtDay(l.first_seen)}` : ''}`}`);
  push('Приоритет', `${PRIO[l.prio]?.label || ''} (${PRIO_LETTER[l.prio]})`);
  const flags = (l.flags || []).filter((f) => f !== 'no_contacts').map((f) => FLAGS[f]?.label).filter(Boolean);
  push('Что видно сразу', flags.join(', '));
  push('Проблемы и наблюдения', l.problems);
  if (l.menu_note) push('Меню', l.menu_note);
  push('Мой оффер', [l.service, l.offer].filter(Boolean).join(': '));
  push('Доп. предложение', l.extra);
  const sv = suggest(l).map((id) => SVC[id]).map((s) => `${s.name}${s.low ? ` — низ ${fmtRange(s.low, s.unit, s.prefix)}${s.mid ? `, мидл ${fmtRange(s.mid, s.unit)}` : ''}` : ' — цену не сверяли'}`);
  if (sv.length) lines.push(`Подсказки по услугам:\n${sv.map((x) => `  • ${x}`).join('\n')}`);
  if (l.own) push('Моя оценка', `низ ${fmtRange(l.own.low)}${l.own.mid ? `, мидл ${fmtRange(l.own.mid)}` : ''}`);
  push('Статус', stOf(LEAD_ST, c.s).label);
  push('Следующий шаг', [c.next, c.due && fmtDay(c.due)].filter(Boolean).join(' — '));
  push('Метки', (c.tags || []).join(', '));
  if (note) lines.push(`Заметка: ${note}`);
  return `${lines.join('\n')}\n\n---\nМой комментарий: `;
}

export function postBrief(kind, p, c = {}, list, note = '') {
  const head = kind === 'vacancies'
    ? [`Вакансия из чата «${p.chat}», ${fmtDay(p.date)}`, p.url && `Ссылка: ${p.url}`]
    : [`Заказ с ${p.source}, ${fmtDay(p.date)}`, `Название: ${p.title}`, p.price && `Бюджет: ${p.price}`, p.url && `Ссылка: ${p.url}`];
  return [...head.filter(Boolean), `Мой статус: ${stOf(list, c.s).label}`, note ? `Заметка: ${note}` : null, '', 'Текст:', p.text, '', '---', 'Мой комментарий: ']
    .filter((x) => x !== false && x !== undefined && x !== null).join('\n');
}

// ---------- идеи: что ещё предлагать разным нишам ----------
export const IDEAS = [
  { title: 'Кафе, рестораны, бары, пекарни', ids: ['menu', 'card', 'qrmenu', 'menuUpdate', 'miniapp', 'cert', 'reviews'],
    hook: 'Начинать с меню: это дёшево, понятно и сразу видно результат. Дальше тот же дизайн превращается в QR-меню, страницу на сайте и мини-приложение предзаказа.' },
  { title: 'Салоны, барбершопы, ногти, груминг, тату, фитнес', ids: ['bot', 'price', 'cert', 'vk', 'card', 'reviews'],
    hook: 'Главная боль — запись в личке и неявки. Бот записи плюс красивый прайс на стойку и в карточку. К праздникам — сертификаты.' },
  { title: 'Автосервисы, мойки, детейлинг', ids: ['card', 'price', 'bot', 'landing', 'reviews'],
    hook: 'Часто отличный рейтинг, но на картах ни услуг, ни цен. Дешёвый вход — карточка с прайсом, потом бот записи на ремонт в ВК.' },
  { title: 'Клиники, стоматологии, ветеринарки', ids: ['landing', 'bot', 'card', 'price'],
    hook: 'Сайт с врачами и прайсом, бот записи и напоминаний (о прививках для ветклиник).' },
  { title: 'Юристы и нотариусы', ids: ['landing', 'quiz', 'card'],
    hook: 'Понятный список услуг, ответы на частые вопросы и форма «опишите ситуацию». Без громких обещаний: у адвокатов реклама ограничена.' },
  { title: 'Магазины, цветы, подарки', ids: ['multipage', 'miniapp', 'vk', 'card'],
    hook: 'Каталог-витрина без корзины или мини-приложение в ВК, заказ уходит в личку.' },
];
