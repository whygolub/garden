// Заметки и файлы: шифруются в браузере ключом, который знаешь только ты,
// и лежат отдельными файлами в приватном репозитории: notes/*.enc и files/*.bin.
// GitHub и кто угодно ещё видят только зашифрованные байты и случайные имена файлов.
import { S, set, gh, explain } from './store.js';
import { lsGet, lsSet } from './util.js';

const ITER = 310000;
const CHECK = 'ulov-notes-ok';
const KEY_PATH = 'notes/key.json';
export const MAX_FILE = 20 * 1024 * 1024;

const te = new TextEncoder(), td = new TextDecoder();
function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

const N = { meta: null, key: null, shas: new Map(), demo: null };
const repo = () => S.settings.dataRepo;
const lsKey = () => `ulov.notekey.${repo()}`;
const setState = (state, extra = {}) => set({ notes: { state, ...extra } });

// ---------- криптография ----------
async function derive(pass, salt) {
  const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base,
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
async function encrypt(bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, N.key, bytes));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv); out.set(ct, 12);
  return out;
}
async function decrypt(data, key = N.key) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.slice(0, 12) }, key, data.slice(12)));
}
async function keyOk(key) {
  try { return td.decode(await decrypt(fromB64(N.meta.check), key)) === CHECK; } catch (e) { return false; }
}

// ---------- файлы в репозитории ----------
const url = (path) => `/repos/${repo()}/contents/${path}`;
async function put(path, b64, sha, message) {
  const res = await gh(url(path), { method: 'PUT', body: { message, content: b64, ...(sha ? { sha } : {}) } });
  return res.content.sha;
}
async function meta(path) {
  try { return await gh(url(path)); } catch (e) { if (e.status === 404) return null; throw e; }
}
async function pathFor(kind, id) {
  const h = await crypto.subtle.digest('SHA-256', te.encode(`${N.meta.salt}|${kind}|${id}`));
  return `notes/${hex(h).slice(0, 40)}.enc`;
}

// ---------- ключ ----------
export async function initNotes() {
  if (S.mode === 'demo') {
    if (!N.demo) N.demo = await fetch('demo/notes.json', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({}));
    return setState('ready', { demo: true });
  }
  setState('checking');
  try {
    const m = await meta(KEY_PATH);
    if (!m) { N.meta = null; return setState('nokey'); }
    N.meta = JSON.parse(td.decode(fromB64(m.content)));
    const saved = lsGet(lsKey(), null);
    if (saved) {
      const key = await crypto.subtle.importKey('raw', fromB64(saved), 'AES-GCM', true, ['encrypt', 'decrypt']);
      if (await keyOk(key)) { N.key = key; return setState('ready'); }
      lsSet(lsKey(), null);
    }
    setState('locked');
  } catch (e) {
    setState('error', { error: explain(e) });
  }
}

async function remember(on) {
  lsSet(lsKey(), on ? toB64(new Uint8Array(await crypto.subtle.exportKey('raw', N.key))) : null);
}

export async function createKey(pass, keep = true) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await derive(pass, salt);
  N.key = key;
  N.meta = { v: 1, kdf: 'PBKDF2-SHA256', iterations: ITER, cipher: 'AES-256-GCM', salt: toB64(salt), check: '' };
  N.meta.check = toB64(await encrypt(te.encode(CHECK)));
  try {
    await put(KEY_PATH, toB64(te.encode(JSON.stringify(N.meta, null, 1))), null, 'notes: ключ');
  } catch (e) {
    N.key = null;
    if (e.status === 422) { await initNotes(); throw new Error('Ключ уже создан на другом устройстве. Введи его.'); }
    throw e;
  }
  await remember(keep);
  setState('ready');
}

export async function unlock(pass, keep = true) {
  const key = await derive(pass, fromB64(N.meta.salt));
  if (!(await keyOk(key))) throw new Error('Ключ не подходит.');
  N.key = key;
  await remember(keep);
  setState('ready');
}

export function forgetKey() {
  lsSet(lsKey(), null);
  N.key = null;
  setState(N.meta ? 'locked' : 'nokey');
}

// ---------- заметки ----------
const EMPTY = () => ({ text: '', files: [] });
const demoStore = () => ({ ...(N.demo || {}), ...lsGet('ulov.demo.notes', {}) });

export async function loadNote(kind, id) {
  if (S.notes?.demo) return { ...EMPTY(), ...(demoStore()[`${kind}:${id}`] || {}) };
  const path = await pathFor(kind, id);
  const m = await meta(path);
  if (!m) { N.shas.delete(path); return EMPTY(); }
  N.shas.set(path, m.sha);
  return { ...EMPTY(), ...JSON.parse(td.decode(await decrypt(fromB64(m.content)))) };
}

export async function saveNote(kind, id, data) {
  if (S.notes?.demo) {
    const all = lsGet('ulov.demo.notes', {});
    all[`${kind}:${id}`] = data;
    lsSet('ulov.demo.notes', all);
    return;
  }
  const path = await pathFor(kind, id);
  const empty = !data.text.trim() && !data.files.length;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (empty) {
        const sha = N.shas.get(path);
        if (sha) await gh(url(path), { method: 'DELETE', body: { message: 'notes: обновление', sha } });
        N.shas.delete(path);
        return;
      }
      const bytes = await encrypt(te.encode(JSON.stringify({ text: data.text, files: data.files, t: Date.now() })));
      N.shas.set(path, await put(path, toB64(bytes), N.shas.get(path), 'notes: обновление'));
      return;
    } catch (e) {
      if (attempt === 0 && (e.status === 409 || e.status === 422 || e.status === 404)) {
        const m = await meta(path);    // файл поменяли с другого устройства — берём свежую версию
        if (m) N.shas.set(path, m.sha); else N.shas.delete(path);
        continue;
      }
      throw e;
    }
  }
}

// ---------- вложения ----------
export async function attachFile(file) {
  if (S.notes?.demo) throw new Error('В демо-режиме файлы не сохраняются.');
  if (file.size > MAX_FILE) throw new Error('Файл больше 20 МБ.');
  const fid = hex(crypto.getRandomValues(new Uint8Array(16)));
  const bytes = await encrypt(new Uint8Array(await file.arrayBuffer()));
  await put(`files/${fid}.bin`, toB64(bytes), null, 'files: добавлен файл');
  return { fid, name: file.name, size: file.size, type: file.type || 'application/octet-stream', added: Date.now() };
}

export async function openFile(f) {
  const buf = await gh(url(`files/${f.fid}.bin`), { accept: 'application/vnd.github.raw+json', bin: true });
  const plain = await decrypt(new Uint8Array(buf));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([plain], { type: f.type }));
  a.download = f.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function removeFile(f) {
  if (S.notes?.demo) return;
  const m = await meta(`files/${f.fid}.bin`);
  if (m) await gh(url(`files/${f.fid}.bin`), { method: 'DELETE', body: { message: 'files: удалён файл', sha: m.sha } });
}
