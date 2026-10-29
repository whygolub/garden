// Статистика: KPI, активность, воронка, разрезы по нишам и регионам.
import { html, useMemo } from './lib.js';
import { useStore } from './store.js';
import { FLAGS, FLAG_ORDER, PRIO, WORK, lastDays, dayKey, fmtDay, fmtNum, sourceKey, SOURCE_COLORS, nb } from './util.js';
import { allLeads } from './base.js';
import { showTip, hideTip, esc, Empty } from './ui.js';

const DAY = 864e5;

function VBars({ days, series, unit = '' }) {
  const totals = days.map((_, i) => series.reduce((s, x) => s + x.values[i], 0));
  const max = Math.max(1, ...totals);
  const step = Math.ceil(days.length / 8);
  return html`<div>
    ${series.length > 1 ? html`<div class="legend">${series.map((x) => html`<span><i style=${{ background: x.color }}></i>${x.label}</span>`)}</div>` : null}
    <div class="vbars" role="img" aria-label="Столбчатая диаграмма по дням">
      ${days.map((d, i) => html`<div class="vbar" key=${d}
          onMouseMove=${(e) => showTip(e, `<div class="muted">${fmtDay(d)}</div>` + series.map((x) => `<div>${series.length > 1 ? esc(x.label) + ': ' : ''}<b>${x.values[i]}</b>${unit}</div>`).join(''))}
          onMouseLeave=${hideTip}>
        ${series.map((x, si) => x.values[i] ? html`<div class="vseg" style=${{ height: `${(x.values[i] / max) * 100}%`, background: x.color, marginBottom: si === 0 ? 0 : undefined }}></div>` : null)}
      </div>`)}
    </div>
    <div class="vaxis">${days.map((d, i) => html`<span>${i % step === 0 || i === days.length - 1 ? fmtDay(d).replace(/\s.*/, '') : ''}</span>`)}</div>
  </div>`;
}

function HBars({ rows, legend, total = true }) {
  const max = Math.max(1, ...rows.map((r) => r.segs.reduce((s, x) => s + x.v, 0)));
  return html`<div>
    ${legend ? html`<div class="legend">${legend.map((x) => html`<span><i style=${{ background: x.color }}></i>${x.label}</span>`)}</div>` : null}
    <div class="hbars">${rows.map((r) => {
      const sum = r.segs.reduce((s, x) => s + x.v, 0);
      return html`<div class="hrow" key=${r.label}
          onMouseMove=${(e) => showTip(e, `<div>${esc(r.label)}</div>` + r.segs.map((x) => `<div class="muted">${esc(x.label)}: <b style="color:var(--text)">${fmtNum(x.v)}</b></div>`).join(''))}
          onMouseLeave=${hideTip}>
        <span class="lbl" title=${r.label}>${r.label}</span>
        <div class="htrack">${r.segs.map((x) => x.v ? html`<div class="hseg" style=${{ width: `${(x.v / max) * 100}%`, background: x.color }}></div>` : null)}</div>
        <span class="val">${total ? fmtNum(sum) : ''}</span>
      </div>`;
    })}</div>
  </div>`;
}

function Kpi({ label, value, unit, note, accent }) {
  return html`<div class="kpi ${accent ? 'accent' : ''}"><div class="kpi-label">${label}</div>
    <div class="kpi-val">${value}${unit ? html`<small>${unit}</small>` : null}</div>${note ? html`<div class="kpi-note">${note}</div>` : null}</div>`;
}

export function Stats() {
  const s = useStore();
  const leads = allLeads().filter((l) => s.crm.leads[l.id]?.s !== 'block');
  const st = (id) => s.crm.leads[id]?.s || 'new';

  const m = useMemo(() => {
    const now = Date.now();
    const d30 = lastDays(30), d14 = lastDays(14);
    const cnt = (arr, pred) => arr.reduce((n, x) => n + (pred(x) ? 1 : 0), 0);
    const statuses = {};
    for (const l of leads) { const k = st(l.id); statuses[k] = (statuses[k] || 0) + 1; }
    const sum = (...k) => k.reduce((n, x) => n + (statuses[x] || 0), 0);
    const reached = sum('sent', 'noreply', 'replied', 'call', 'kp', 'think', 'client', 'done', 'lost', 'paused', 'ignore');
    const replied = sum('replied', 'call', 'kp', 'think', 'client', 'done');
    const talks = sum('call', 'kp', 'think', 'client', 'done');
    const clients = sum('client', 'done');

    // активность из истории статусов
    const touch = { leads: Object.fromEntries(d30.map((d) => [d, 0])), other: Object.fromEntries(d30.map((d) => [d, 0])) };
    for (const x of s.crm.log) {
      const d = dayKey(new Date(x.t));
      if (!(d in touch.leads)) continue;
      if (x.k === 'leads' && x.s === 'sent') touch.leads[d]++;
      if (x.k !== 'leads' && x.s === 'applied') touch.other[d]++;
    }
    const sent7 = cnt(s.crm.log, (x) => x.k === 'leads' && x.s === 'sent' && now - x.t < 7 * DAY);

    // ниши и регионы
    const group = (key) => {
      const g = new Map();
      for (const l of leads) {
        const k = l[key] || '—';
        const r = g.get(k) || [0, 0, 0];
        r[l.prio === 3 ? 0 : l.prio === 2 ? 1 : 2]++;
        g.set(k, r);
      }
      return [...g].sort((a, b) => (b[1][0] + b[1][1]) - (a[1][0] + a[1][1]) || b[1][2] - a[1][2])
        .map(([label, v]) => ({ label, segs: [
          { v: v[0], color: 'var(--hot)', label: 'Горячие' }, { v: v[1], color: 'var(--warm)', label: 'Тёплые' },
          { v: v[2], color: 'var(--surface-3)', label: 'Остальные' }] }));
    };
    const flags = {};
    for (const l of leads) for (const f of l.flags || []) flags[f] = (flags[f] || 0) + 1;

    // заказы и вакансии по дням
    const orders = s.data.orders.items || [], vacs = s.data.vacancies.items || [];
    const srcNames = ['FL.ru', 'Хабр Фриланс', 'Kwork', 'Telegram'];
    const ordersBy = srcNames.map((name, i) => ({
      label: name, color: SOURCE_COLORS[i],
      values: d14.map((d) => cnt(orders, (o) => dayKey(o.date) === d && sourceKey(o.source) === name)),
    })).filter((x) => x.values.some(Boolean));
    const vacBy = [{ label: 'Вакансии', color: 'var(--series-1)', values: d14.map((d) => cnt(vacs, (v) => dayKey(v.date) === d)) }];
    const words = {};
    for (const o of orders) for (const h of o.hits || []) words[h] = (words[h] || 0) + 1;
    const roles = {};
    for (const v of vacs) for (const h of v.roles || []) roles[h] = (roles[h] || 0) + 1;

    return {
      d30, d14, statuses, reached, replied, talks, clients, sent7,
      touch: [
        { label: 'Написала лидам', color: 'var(--series-1)', values: d30.map((d) => touch.leads[d]) },
        { label: 'Отклики на заказы', color: 'var(--series-2)', values: d30.map((d) => touch.other[d]) },
      ],
      niches: group('niche'), regions: group('region'),
      flags: FLAG_ORDER.filter((f) => flags[f]).map((f) => ({ label: FLAGS[f].label, segs: [{ v: flags[f], color: 'var(--accent)', label: 'Лидов' }] }))
        .sort((a, b) => b.segs[0].v - a.segs[0].v),
      hot: cnt(leads, (l) => l.prio === 3),
      fresh: cnt(leads, (l) => l.new),
      ordersBy, vacBy,
      orders7: cnt(orders, (o) => now - Date.parse(o.date) < 7 * DAY),
      vacs7: cnt(vacs, (v) => now - Date.parse(v.date) < 7 * DAY),
      applied: cnt(Object.values(s.crm.orders), (x) => x.s === 'applied') + cnt(Object.values(s.crm.vacancies), (x) => ['applied', 'interview', 'offer', 'rejected'].includes(x.s)),
      interviews: cnt(Object.values(s.crm.vacancies), (x) => ['interview', 'offer'].includes(x.s)),
      words: Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 16),
      roles: Object.entries(roles).sort((a, b) => b[1] - a[1]).slice(0, 12),
    };
  }, [s.data, s.crm, leads]);

  if (!leads.length && !s.data.orders.items?.length && !s.data.vacancies.items?.length) {
    return html`<h1 class="page-title" style="margin-bottom:18px">Статистика</h1>
      <${Empty} kao="(￣ω￣;)" title="Считать пока нечего">Статистика появится, когда роботы соберут первые данные.</${Empty}>`;
  }
  const work = WORK.reduce((n, k) => n + (m.statuses[k] || 0), 0);
  const conv = m.reached ? Math.round((m.replied / m.reached) * 1000) / 10 : 0;
  const funnel = [
    { label: 'Написала', v: m.reached }, { label: 'Ответили', v: m.replied },
    { label: 'Обсуждаем', v: m.talks }, { label: 'Клиент', v: m.clients },
  ];
  const FUN = ['var(--fun-1)', 'var(--fun-2)', 'var(--fun-3)', 'var(--fun-4)'];

  return html`
    <div class="page-head"><div><h1 class="page-title">Статистика</h1>
      <div class="page-sub">По всем данным и твоим отметкам</div></div></div>
    <div class="bento">
      <div class="kpis">
        <${Kpi} label="Лидов в базе" value=${fmtNum(leads.length)} note=${m.fresh ? `+${fmtNum(m.fresh)} новых` : null} />
        <${Kpi} label="Горячих" value=${fmtNum(m.hot)} note=${leads.length ? `${Math.round((m.hot / leads.length) * 100)}% базы` : null} />
        <${Kpi} label="В работе" value=${fmtNum(work)} note=${`написала за неделю: ${m.sent7}`} />
        <${Kpi} label="Отвечают" value=${conv.toLocaleString('ru-RU')} unit="%" note=${`${m.replied} из ${m.reached}`} accent />
        <${Kpi} label="Клиентов" value=${fmtNum(m.clients)} />
        <${Kpi} label="Заказов за неделю" value=${fmtNum(m.orders7)} />
      </div>

      <div class="tile span-8">
        <h3>Моя активность</h3><div class="tile-sub">Касания за 30 дней: отметки «Написала» и «Откликнулась»</div>
        <${VBars} days=${m.d30} series=${m.touch} />
      </div>
      <div class="tile span-4">
        <h3>Воронка клиентов</h3><div class="tile-sub">${nb('Сколько лидов дошло до каждого шага')}</div>
        <div class="funnel hbars">${funnel.map((x, i) => html`<div class="hrow" key=${x.label}>
          <span class="lbl">${x.label}</span>
          <div class="htrack"><div class="hseg" style=${{ width: `${funnel[0].v ? (x.v / funnel[0].v) * 100 : 0}%`, background: FUN[i], borderRadius: '0 4px 4px 0' }}></div></div>
          <span class="val">${x.v}${i && funnel[i - 1].v ? html`<small>${Math.round((x.v / funnel[i - 1].v) * 100)}%</small>` : null}</span>
        </div>`)}</div>
        ${!m.reached ? html`<div class="notice" style="margin-top:14px">${nb('Отмечай «Написала» в карточках лидов, и здесь появится конверсия.')}</div>` : null}
      </div>

      <div class="tile span-7">
        <h3>Лиды по нишам</h3><div class="tile-sub">Сверху ниши, где больше всего горячих и тёплых</div>
        <${HBars} rows=${m.niches.slice(0, 14)} legend=${[{ label: 'Горячие', color: 'var(--hot)' }, { label: 'Тёплые', color: 'var(--warm)' }, { label: 'Остальные', color: 'var(--surface-3)' }]} />
      </div>
      <div class="tile span-5">
        <h3>Частые проблемы</h3><div class="tile-sub">${nb('С чем можно прийти к бизнесу')}</div>
        <${HBars} rows=${m.flags} />
        <h3 style="margin-top:22px">По регионам</h3><div class="tile-sub">Горячие, тёплые и остальные</div>
        <${HBars} rows=${m.regions} />
      </div>

      <div class="tile span-12">
        <h3>Заказы по дням</h3><div class="tile-sub">Подходящие заказы за 2 недели</div>
        ${m.ordersBy.length ? html`<${VBars} days=${m.d14} series=${m.ordersBy} />` : html`<div class="muted">Пока нет заказов.</div>`}
        ${m.words.length ? html`<h3 style="margin-top:20px">Чаще всего ищут</h3><div class="words" style="margin-top:10px">${m.words.map(([w, n]) => html`<span class="badge outline">${w} <span class="muted mono">${n}</span></span>`)}</div>` : null}
      </div>
    </div>
  `;
}
