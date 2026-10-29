// Справочники, форматирование, шаблоны сообщений.

export const PRIO = {
  3: { label: 'Горячий', tone: 'hot', color: 'var(--hot)' },
  2: { label: 'Тёплый', tone: 'warm', color: 'var(--warm)' },
  1: { label: 'Слабый', tone: 'weak', color: 'var(--weak)' },
  0: { label: 'Сайт в порядке', tone: 'ok', color: 'var(--ok)' },
};

export const FLAGS = {
  no_site:     { label: 'Без сайта', tone: 'hot', phrase: 'у вас нет своего сайта', why: 'а сейчас почти все сначала ищут место в интернете и сравнивают' },
  social:      { label: 'Только соцсети', tone: 'hot', phrase: 'вместо сайта у вас ссылка на соцсети', why: 'а там сложно быстро найти цены и записаться' },
  template:    { label: 'Шаблон', tone: 'warm', phrase: 'вместо сайта у вас шаблонная страничка', why: 'она выглядит как у всех и почти ничего не рассказывает о вас' },
  parked:      { label: 'Сайт-заглушка', tone: 'hot', phrase: 'ваш сайт сейчас не работает, открывается заглушка', why: 'и люди, которые переходят с карт, видят пустую страницу' },
  booking:     { label: 'Только запись', tone: 'warm', phrase: 'своего сайта нет, только страница онлайн-записи', why: 'а показать работы, цены и рассказать о себе там негде' },
  down:        { label: 'Сайт не открылся', tone: 'warm', phrase: 'ваш сайт у меня не открылся', why: 'и люди с карт могут просто уйти к другим' },
  no_mobile:   { label: 'Нет мобильной', tone: 'warm', phrase: 'ваш сайт неудобно открывать с телефона', why: 'а большинство открывает сайты именно с телефона' },
  no_menu:     { label: 'Нет меню', tone: 'warm', phrase: 'на сайте нет меню', why: 'а его ищут в первую очередь, когда выбирают, куда пойти' },
  menu_file:   { label: 'Меню файлом', tone: 'weak', phrase: 'меню на сайте открывается файлом, с телефона его неудобно смотреть' },
  old:         { label: 'Старый сайт', tone: 'weak', phrase: 'сайт давно не обновлялся', why: 'и по нему сложно понять, какие у вас сейчас услуги и цены' },
  slow:        { label: 'Медленный', tone: 'weak', phrase: 'сайт долго загружается', why: 'а многие закрывают страницу, не дождавшись' },
  no_https:    { label: 'Без https', tone: 'weak', phrase: 'сайт открывается без защищённого соединения', why: 'и браузер может показывать посетителям предупреждение «небезопасно»' },
  no_contacts: { label: 'Нет контактов', tone: 'weak', phrase: '' },
  autopage:    { label: 'Автостраница с карт', tone: 'hot', phrase: 'вместо сайта у вас автоматическая страница с карт', why: 'она выглядит одинаково у всех и почти ничего не рассказывает о вас' },
  builder:     { label: 'На конструкторе', tone: 'weak', phrase: 'сайт сделан на конструкторе и упирается в его ограничения', why: 'из-за этого сложно добавить нужное, а сайт работает медленнее' },
  mockup:      { label: 'Есть макет', tone: 'weak', phrase: 'макет сайта есть, а вёрстки пока нет' },
};
export const FLAG_ORDER = Object.keys(FLAGS);

export const LEAD_ST = [
  { k: 'new', label: 'Не трогала', color: 'var(--text-3)' },
  { k: 'todo', label: 'Хочу написать', color: 'var(--info)' },
  { k: 'sent', label: 'Написала', color: 'var(--warm)' },
  { k: 'noreply', label: 'Нет ответа', color: '#c98a5a' },
  { k: 'replied', label: 'Ответили', color: 'var(--accent)' },
  { k: 'call', label: 'Обсуждаем', color: '#e08bb0' },
  { k: 'kp', label: 'Отправила КП', color: '#8f9cf5' },
  { k: 'think', label: 'Думает', color: '#d6b25e' },
  { k: 'client', label: 'В работе', color: 'var(--ok)' },
  { k: 'done', label: 'Сдан / оплачен', color: '#2f8f4a' },
  { k: 'paused', label: 'Отложено', color: 'var(--weak)' },
  { k: 'lost', label: 'Отказ', color: 'var(--hot)' },
  { k: 'ignore', label: 'Игнор', color: '#8b8796' },
  { k: 'skip', label: 'Не подходит', color: 'var(--border-2)' },
  { k: 'block', label: 'Блок', color: '#7a2e2e' },
];
// в работе = пока идёт общение; клиенты = в работе и сданные
export const WORK = ['todo', 'sent', 'noreply', 'replied', 'call', 'kp', 'think'];
export const CLIENTS = ['client', 'done'];
export const CLOSED = ['done', 'lost', 'skip', 'ignore', 'block'];
export const ORDER_ST = [
  { k: 'new', label: 'Новый', color: 'var(--text-3)' },
  { k: 'fav', label: 'Интересно', color: 'var(--accent)' },
  { k: 'applied', label: 'Откликнулась', color: 'var(--warm)' },
  { k: 'won', label: 'Взяла', color: 'var(--ok)' },
  { k: 'skip', label: 'Скрыт', color: 'var(--border-2)' },
];
export const VAC_ST = [
  { k: 'new', label: 'Новая', color: 'var(--text-3)' },
  { k: 'fav', label: 'Интересно', color: 'var(--accent)' },
  { k: 'applied', label: 'Откликнулась', color: 'var(--warm)' },
  { k: 'interview', label: 'Собес', color: '#e08bb0' },
  { k: 'offer', label: 'Оффер', color: 'var(--ok)' },
  { k: 'rejected', label: 'Отказ', color: 'var(--hot)' },
  { k: 'skip', label: 'Скрыта', color: 'var(--border-2)' },
];
export const stOf = (list, k) => list.find((s) => s.k === k) || list[0];

export const SOURCE_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];
export function sourceKey(src) {
  if (!src) return 'Другое';
  if (src.startsWith('TG')) return 'Telegram';
  return src;
}

// Висячие предлоги и союзы: склеиваем со следующим словом неразрывным пробелом.
const SHORT = /(^|[\s(«"])(в|во|с|со|к|ко|о|об|у|и|а|я|на|не|ни|по|за|из|от|до|для|без|или|но|что|как|при|про|же|ли)\s+/giu;
export function nb(text) {
  if (!text) return text;
  return String(text).replace(SHORT, (m, pre, w) => `${pre}${w} `).replace(SHORT, (m, pre, w) => `${pre}${w} `);
}

const nf = new Intl.NumberFormat('ru-RU');
export const fmtNum = (n) => nf.format(n || 0);
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export function parseDate(s) {
  if (!s) return null;
  const d = new Date(s.length === 10 ? s + 'T12:00:00' : s);
  return isNaN(d) ? null : d;
}
export function dayKey(d) {
  const x = d instanceof Date ? d : parseDate(d);
  if (!x) return '';
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
export function fmtDay(d) {
  const x = d instanceof Date ? d : parseDate(d);
  return x ? `${x.getDate()} ${MONTHS[x.getMonth()]}` : '';
}
export function ago(s) {
  const d = parseDate(s);
  if (!d) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (diff < 60) return 'только что';
  if (diff < 3600) { const m = Math.floor(diff / 60); return `${m} ${plural(m, 'минуту', 'минуты', 'минут')} назад`; }
  if (dayKey(d) === dayKey(new Date())) return `сегодня в ${hm}`;
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (dayKey(d) === dayKey(y)) return `вчера в ${hm}`;
  return `${fmtDay(d)}, ${hm}`;
}
export function lastDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); out.push(dayKey(d)); }
  return out;
}

export const phoneHref = (p) => 'tel:' + String(p).replace(/[^\d+]/g, '');
export function waHref(p, text = '') {
  let d = String(p).replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('8')) d = '7' + d.slice(1);
  if (d.length === 10) d = '7' + d;
  return `https://wa.me/${d}${text ? '?text=' + encodeURIComponent(text) : ''}`;
}
export function urlOf(v) {
  if (!v) return '';
  if (v.startsWith('@')) return 'https://t.me/' + v.slice(1);
  return /^https?:\/\//i.test(v) ? v : 'https://' + v;
}
export function tgHref(v) {
  if (!v) return '';
  if (/t\.me|telegram/.test(v)) return urlOf(v);
  return 'https://t.me/' + v.replace(/^@/, '');
}
export function mapLinks(l) {
  const name = encodeURIComponent(l.name || '');
  if (l.lat && l.lon) {
    return {
      ya: `https://yandex.ru/maps/?ll=${l.lon},${l.lat}&z=18&text=${name}`,
      gis: `https://2gis.ru/search/${name}?m=${l.lon}%2C${l.lat}%2F18`,
    };
  }
  const where = encodeURIComponent([l.name, l.city || l.region, l.addr].filter(Boolean).join(', '));
  return { ya: `https://yandex.ru/maps/?text=${where}`, gis: `https://2gis.ru/search/${name}` };
}

export function mainFlag(l) {
  return (l.flags || []).find((f) => f !== 'no_contacts') || (l.flags || [])[0] || null;
}

// ---------- шаблоны ----------
export const VARS = ['{название}', '{ниша}', '{город}', '{адрес}', '{проблема}', '{почему}', '{предложение}', '{деталь}', '{демо}'];

export function renderTemplate(text, lead, c = {}) {
  const f = mainFlag(lead);
  const hasF = f && FLAGS[f]?.phrase;
  const problem = hasF ? FLAGS[f].phrase : 'вас пока сложно найти в интернете';
  const why = hasF ? FLAGS[f].why || '' : 'а сейчас почти все выбирают через поиск и карты';
  const src = lead.offerPhrase || lead.offer;
  const offer = src ? src.charAt(0).toLowerCase() + src.slice(1) : 'сайт и бота для записи';
  const map = {
    '{название}': lead.name || '', '{ниша}': (lead.niche || '').toLowerCase(), '{город}': lead.city || lead.region || '',
    '{адрес}': lead.addr || '', '{проблема}': problem, '{почему}': why, '{предложение}': offer.replace(/\s\+\s/g, ' и '),
    '{деталь}': c.detail || '', '{демо}': c.demo || '',
  };
  return text.replace(/\{[^}]+\}/g, (m) => (m in map ? map[m] : m)).replace(/, \./g, '.').replace(/,[ \t]*\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// v2: единый заход — кто я, их проблема, что предлагаю, лёгкий вопрос
export const DEFAULT_TEMPLATES = [
  {
    id: 'tpl-site', name: 'Сайт с ведением (основной)', niches: [], v: 2,
    text: 'здравствуйте! меня зовут Людмила, я программист. сейчас собираю портфолио из реальных проектов, поэтому беру их по цене ниже рыночной\n\nобратила внимание, что {проблема}, {почему}\n\nмогу сделать для вас сайт, а дальше вести его и заниматься продвижением. хотели бы увидеть, как это может выглядеть?',
  },
  {
    id: 'tpl-menu', name: 'Дизайн меню для кафе', niches: ['Кафе и кофейни', 'Рестораны', 'Бары и пабы', 'Фастфуд и стритфуд', 'Пекарни и кондитерские'], v: 2,
    text: 'здравствуйте! меня зовут Людмила, я программист. сейчас собираю портфолио из реальных проектов, поэтому беру их по цене ниже рыночной\n\nобратила внимание, что {проблема}, {почему}\n\nмогу сделать для вас меню в едином стиле: для печати, для карточки на картах и страничкой по QR-коду на столах. а если нужно, и сайт с продвижением. хотели бы увидеть, как это может выглядеть?',
  },
  {
    id: 'tpl-booking', name: 'Запись онлайн (салоны, клиники, сервисы)', niches: ['Барбершопы', 'Ногтевые студии', 'Салоны красоты', 'Груминг', 'Тату-студии', 'Фитнес и студии', 'Ветклиники', 'Стоматологии', 'Клиники', 'Автосервисы'], v: 2,
    text: 'здравствуйте! меня зовут Людмила, я программист. сейчас собираю портфолио из реальных проектов, поэтому беру их по цене ниже рыночной\n\nобратила внимание, что {проблема}, {почему}\n\nмогу сделать для вас сайт с ценами и онлайн-записью, бот сам напомнит клиенту о визите. а дальше вести сайт и заниматься продвижением. хотели бы увидеть, как это может выглядеть?',
  },
  {
    id: 'tpl-law', name: 'Юристам и нотариусам', niches: ['Юристы и адвокаты', 'Нотариусы'], v: 2,
    text: 'здравствуйте! меня зовут Людмила, я программист. сейчас собираю портфолио из реальных проектов, поэтому беру их по цене ниже рыночной\n\nобратила внимание, что {проблема}, {почему}\n\nмогу сделать для вас сайт с услугами, ответами на частые вопросы и записью на консультацию, а дальше вести его и заниматься продвижением. хотели бы увидеть, как это может выглядеть?',
  },
  {
    id: 'tpl-short', name: 'Коротко', niches: [], v: 2,
    text: 'здравствуйте! меня зовут Людмила, я программист. обратила внимание, что {проблема}. могу сделать для вас сайт и заниматься его продвижением, сейчас по цене ниже рыночной. хотели бы увидеть, как это может выглядеть?',
  },
];

export function copy(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  return Promise.resolve(fallbackCopy(text));
}
function fallbackCopy(text) {
  const t = document.createElement('textarea');
  t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
  document.body.appendChild(t); t.select();
  try { document.execCommand('copy'); } catch (e) { /* ничего */ }
  t.remove();
}

export function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// тема: system | light | dark
export const getTheme = () => lsGet('ulov.theme', 'system');
export function setTheme(t) {
  const r = document.documentElement;
  if (t === 'light' || t === 'dark') r.dataset.theme = t; else delete r.dataset.theme;
  lsSet('ulov.theme', t);
  window.dispatchEvent(new Event('themechange'));
}
export const isLight = () => (document.documentElement.dataset.theme
  ? document.documentElement.dataset.theme === 'light' : matchMedia('(prefers-color-scheme: light)').matches);

export function lsGet(k, def) {
  try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
}
export function lsSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватный режим */ }
}
