// Лиды из двух источников: роботы (карты) + своя база клиентов. Импорт старой таблицы.
import { S, commit } from './store.js';
import { baseToLead, regionOf, nicheOf, STATUS_FROM_TABLE } from './services.js';
import { loadNote, saveNote } from './notes.js';

const norm = (s = '') => s.toLowerCase().replace(/ё/g, 'е').replace(/[«»"'().,\-–—]/g, ' ').replace(/\s+/g, ' ').trim();

let cache = { leads: null, base: null, out: [] };
// все лиды: сначала своя база, потом найденные роботом; дубли робота (то же название и город) скрываем
export function allLeads() {
  const robot = S.data.leads.items || [];
  const base = S.crm.base || {};
  if (cache.leads === robot && cache.base === base) return cache.out;
  const mine = Object.entries(base).filter(([, b]) => !b.del).map(([id, b]) => baseToLead(id, b));
  const taken = new Set(mine.map((l) => `${norm(l.name)}|${norm(l.city)}`));
  const takenName = new Set(mine.map((l) => norm(l.name)));
  const rest = robot.filter((l) => !taken.has(`${norm(l.name)}|${norm(l.city)}`) && !(takenName.has(norm(l.name)) && !l.city));
  cache = { leads: robot, base, out: [...mine, ...rest] };
  return cache.out;
}

export function slugify(name) {
  const t = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya' };
  const s = name.toLowerCase().split('').map((c) => t[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return s || 'client';
}
export function newBaseId(name) {
  let id = 'base:' + slugify(name), n = 2;
  while (S.crm.base[id] && !S.crm.base[id].del) id = `base:${slugify(name)}-${n++}`;
  return id;
}

// поля, которые могут быть личными данными, в общий файл не кладём — только в зашифрованную заметку
const PRIVATE = ['person', 'comments'];
const toTs = (d) => (d && !isNaN(Date.parse(d)) ? Date.parse(d + 'T12:00:00') : null);

export async function importBase(json, onProgress = () => {}) {
  const list = Array.isArray(json) ? json : json.clients;
  if (!Array.isArray(list) || !list.length) throw new Error('В файле нет клиентов.');
  const notesReady = S.notes?.state === 'ready';
  let added = 0, updated = 0, notes = 0, skippedNotes = 0;
  const now = Date.now();

  for (const [i, d] of list.entries()) {
    if (!d.name) continue;
    onProgress(`${i + 1} из ${list.length}: ${d.name}`);
    const id = 'base:' + (d.id ? String(d.id).replace(/[^\w-]/g, '') : slugify(d.name));
    const { id: _id, person, comments, status, nextStep, nextDate, firstContact, lastContact, touches, deal, priceMin, priceMax, tags, ...pub } = d;
    pub.region = regionOf(pub.city);
    pub.category = nicheOf(`${pub.niche || ''} ${pub.name}`);
    if (S.crm.base[id] && !S.crm.base[id].del) updated++; else added++;
    S.crm.base = { ...S.crm.base, [id]: { ...pub, t: now } };

    const st = STATUS_FROM_TABLE[status] || 'new';
    const prev = S.crm.leads[id] || {};
    S.crm.leads = { ...S.crm.leads, [id]: {
      ...prev, s: st, t: now,
      ...(nextStep ? { next: nextStep } : {}), ...(nextDate ? { due: nextDate } : {}),
      ...(deal ? { deal } : {}), ...(touches ? { touches } : {}),
      ...(tags?.length ? { tags: [...new Set([...(prev.tags || []), ...tags])] } : {}),
    } };
    // повторный импорт со сменой статуса — тоже в историю
    if (prev.s && prev.s !== st) S.crm.log.push({ t: now, k: 'leads', id, s: st, from: prev.s });
    // история, чтобы статистика видела прошлые касания
    const t1 = toTs(firstContact), t2 = toTs(lastContact);
    if (st !== 'new' && !S.crm.log.some((x) => x.id === id)) {
      if (t1) S.crm.log.push({ t: t1, k: 'leads', id, s: 'sent', from: 'new' });
      if (st !== 'sent') S.crm.log.push({ t: t2 || t1 || now, k: 'leads', id, s: st, from: t1 ? 'sent' : 'new' });
    }

    // у частных лиц (мастер, эксперт) контакт — это личные данные: тоже только в заметку
    let privContact = '';
    if (/частн/i.test(pub.type || '') && pub.contact) { privContact = pub.contact; delete pub.contact; S.crm.base[id] = { ...pub, t: now }; }
    const priv = [person && `Контактное лицо: ${person}`, privContact && `Контакты: ${privContact}`, comments && `Комментарии из таблицы: ${comments}`].filter(Boolean).join('\n\n');
    if (priv) {
      if (!notesReady) { skippedNotes++; continue; }
      const n = await loadNote('leads', id);
      if (!n.text.includes(priv)) {
        // при повторном импорте заменяем прошлые абзацы из таблицы, свои записи не трогаем
        const own = n.text.split(/\n{2,}/).filter((p) => !/^(Контактное лицо|Контакты|Комментарии из таблицы):/.test(p.trim())).join('\n\n').trim();
        await saveNote('leads', id, { ...n, text: own ? `${own}\n\n${priv}` : priv });
        notes++;
      }
      S.crm.leads[id] = { ...S.crm.leads[id], n: 1 };
    }
  }
  S.crm.log.sort((a, b) => a.t - b.t);
  commit();
  return { added, updated, notes, skippedNotes };
}
