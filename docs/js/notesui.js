// Интерфейс зашифрованных заметок: ключ, редактор, вложения.
import { html, useState, useEffect, useRef } from './lib.js';
import { Icon } from './icons.js';
import { useStore, getItem, setItem, toast } from './store.js';
import { loadNote, saveNote, attachFile, openFile, removeFile, createKey, unlock, forgetKey, MAX_FILE } from './notes.js';
import { nb, download } from './util.js';

const size = (n) => n < 1024 ? `${n} Б` : n < 1048576 ? `${Math.round(n / 1024)} КБ` : `${(n / 1048576).toFixed(1)} МБ`;

export function KeyForm({ mode, compact }) {
  const [a, setA] = useState(''), [b, setB] = useState(''), [keep, setKeep] = useState(true);
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const create = mode === 'create';
  const go = async () => {
    setErr('');
    if (create && a.length < 8) return setErr('Минимум 8 символов.');
    if (create && a !== b) return setErr('Ключи не совпадают.');
    setBusy(true);
    try { create ? await createKey(a, keep) : await unlock(a, keep); toast(create ? 'Ключ создан' : 'Заметки открыты'); }
    catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };
  return html`<div style="display:grid;gap:12px">
    ${!compact ? html`<p class="dim" style="margin:0;font-size:13px;line-height:1.55">${nb(create
      ? 'Придумай ключ для заметок и файлов. Ими шифруется всё прямо в браузере: без ключа их не прочитает никто, даже GitHub. Если ключ забыть, заметки не восстановить, поэтому запиши его в менеджер паролей.'
      : 'Заметки зашифрованы. Введи ключ, чтобы открыть их на этом устройстве.')}</p>` : null}
    <div class="field"><label for=${'k1' + mode}>${create ? 'Новый ключ' : 'Ключ заметок'}</label>
      <input id=${'k1' + mode} class="input" type="password" autocomplete=${create ? 'new-password' : 'current-password'} value=${a}
        onInput=${(e) => setA(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && !create && go()} /></div>
    ${create ? html`<div class="field"><label for="k2">Повтори ключ</label>
      <input id="k2" class="input" type="password" autocomplete="new-password" value=${b} onInput=${(e) => setB(e.target.value)}
        onKeyDown=${(e) => e.key === 'Enter' && go()} /></div>` : null}
    <label class="row dim" style="font-size:12.5px;cursor:pointer"><input type="checkbox" checked=${keep} onChange=${(e) => setKeep(e.target.checked)} />
      Запомнить на этом устройстве</label>
    ${err ? html`<div class="field"><span class="error">${err}</span></div>` : null}
    <div><button class="btn primary" disabled=${busy || !a} onClick=${go}>${busy ? 'Секунду…' : create ? 'Создать ключ' : 'Открыть'}</button></div>
  </div>`;
}

export function NotesBox({ kind, id }) {
  const s = useStore();
  const st = s.notes?.state || 'checking';
  if (st === 'checking') return html`<div class="muted" style="font-size:13px">Проверяю ключ…</div>`;
  if (st === 'error') return html`<div class="notice err">${s.notes.error}</div>`;
  if (st === 'nokey') return html`<${KeyForm} mode="create" />`;
  if (st === 'locked') return html`<${KeyForm} mode="unlock" />`;
  return html`<${NoteEditor} kind=${kind} id=${id} key=${kind + id} />`;
}

function NoteEditor({ kind, id }) {
  const s = useStore();
  const [note, setNote] = useState(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const latest = useRef(null), pending = useRef(false), timer = useRef();
  const fileIn = useRef(), txtIn = useRef();

  useEffect(() => {
    let alive = true;
    loadNote(kind, id).then((n) => { if (alive) { setNote(n); latest.current = n; } })
      .catch(() => alive && setStatus('Не получилось расшифровать заметку'));
    return () => {
      alive = false;
      clearTimeout(timer.current);
      if (pending.current && latest.current) persist(latest.current);   // закрыли карточку до сохранения
    };
  }, []);

  async function persist(n) {
    pending.current = false;
    try {
      await saveNote(kind, id, n);
      const has = n.text.trim() || n.files.length ? 1 : 0;
      if ((getItem(kind, id).n || 0) !== has) setItem(kind, id, { n: has });
      setStatus(s.notes?.demo ? 'Сохранено в браузере' : 'Зашифровано и сохранено');
    } catch (e) {
      setStatus('Не сохранилось, попробую ещё раз');
      pending.current = true;
      timer.current = setTimeout(() => persist(latest.current), 8000);
    }
  }
  const update = (n, now = false) => {
    setNote(n); latest.current = n; pending.current = true;
    setStatus('Сохраняю…');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(latest.current), now ? 0 : 900);
  };

  if (!note) return html`<div class="skel" style="height:86px"></div>${status ? html`<div class="notice err">${status}</div>` : null}`;

  const importTxt = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (f.size > 1024 * 1024) return toast('Текстовый файл больше 1 МБ');
    const t = (await f.text()).trim();
    update({ ...note, text: note.text.trim() ? `${note.text.trim()}\n\n${t}` : t }, true);
    toast('Текст добавлен в заметку');
  };
  const attach = async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    let n = latest.current;
    for (const f of files) {
      try {
        if (f.size > MAX_FILE) { toast(`«${f.name}» больше 20 МБ`); continue; }
        setStatus(`Шифрую и загружаю «${f.name}»…`);
        const m = await attachFile(f);
        n = { ...n, files: [...n.files, m] };
        update(n, true);
      } catch (err) { toast(err.message || 'Файл не загрузился'); setStatus(''); }
    }
    setBusy(false);
  };
  const del = async (f) => {
    if (!confirm(`Удалить «${f.name}»?`)) return;
    try { await removeFile(f); } catch (e) { /* файл мог быть удалён раньше */ }
    update({ ...latest.current, files: latest.current.files.filter((x) => x.fid !== f.fid) }, true);
  };
  const open = async (f) => {
    setStatus(`Расшифровываю «${f.name}»…`);
    try { await openFile(f); setStatus(''); } catch (e) { setStatus('Не получилось открыть файл'); }
  };

  return html`<div style="display:grid;gap:10px">
    <textarea class="textarea" rows="4" placeholder=${nb('Что важно не забыть: с кем говорила, о чём договорились, когда перезвонить')}
      value=${note.text} onInput=${(e) => update({ ...note, text: e.target.value })}></textarea>
    ${note.files.length ? html`<div class="files">${note.files.map((f) => html`<div class="file" key=${f.fid}>
        <${Icon} n="note" s=${15} /><span class="grow file-name" title=${f.name}>${f.name}</span><span class="muted mono" style="font-size:11.5px">${size(f.size)}</span>
        <button class="btn sm ghost icon" title="Скачать" aria-label="Скачать" onClick=${() => open(f)}><${Icon} n="download" s=${14} /></button>
        <button class="btn sm ghost icon" title="Удалить" aria-label="Удалить" onClick=${() => del(f)}><${Icon} n="trash" s=${14} /></button>
      </div>`)}</div>` : null}
    <div class="row wrap">
      <button class="btn sm" disabled=${busy} onClick=${() => fileIn.current.click()}><${Icon} n="plus" s=${14} />Прикрепить файл</button>
      <button class="btn sm ghost" onClick=${() => txtIn.current.click()}>Текст из .txt</button>
      ${note.text.trim() ? html`<button class="btn sm ghost" onClick=${() => download('заметка.txt', note.text, 'text/plain;charset=utf-8')}>Скачать .txt</button>` : null}
    </div>
    ${status ? html`<div class="muted row" style="font-size:12px;gap:6px"><${Icon} n="lock" s=${12} />${status}</div>` : null}
    <input type="file" ref=${fileIn} multiple hidden onChange=${attach} />
    <input type="file" ref=${txtIn} accept=".txt,.md,text/plain,text/markdown" hidden onChange=${importTxt} />
  </div>`;
}

export function NotesPanel() {
  const s = useStore();
  const st = s.notes?.state || 'checking';
  return html`<div class="panel">
    <h3>Заметки и файлы</h3>
    ${s.notes?.demo ? html`<p>${nb('В демо-режиме заметки хранятся только в этом браузере и не шифруются.')}</p>`
      : st === 'ready' ? html`
        <p>${nb('Ключ открыт на этом устройстве. Заметки и файлы шифруются в браузере (AES-256) и лежат в приватном репозитории под случайными именами: ни GitHub, ни кто-то ещё не увидит ни текст, ни к какому лиду он относится.')}</p>
        <div><button class="btn ghost sm" onClick=${() => { forgetKey(); toast('Ключ забыт на этом устройстве'); }}>Забыть ключ на этом устройстве</button></div>`
      : st === 'nokey' ? html`<${KeyForm} mode="create" />`
      : st === 'locked' ? html`<${KeyForm} mode="unlock" />`
      : st === 'error' ? html`<div class="notice err">${s.notes.error}</div>`
      : html`<p>Проверяю…</p>`}
  </div>`;
}
