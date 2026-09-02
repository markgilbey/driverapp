/* ============================================================
   Driver App — CO₂ Route Operations
   Mobile-first PWA MVP
   ============================================================ */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };

/* ---------- formatting ---------- */
const nf = n => Math.round(n).toLocaleString('en-US');
const money = n => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
const clock = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h + ':' + String(m).padStart(2, '0'); };
const hhmm = d => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/* ============================================================ DATA */
const stopSeed = (id, seq, cust, addr, city, expected, pay, win, lat, lng, note) =>
  ({ id, seq, cust, addr, city, expected, pay, win, lat, lng, note, status: 'pending', lbs: 0, cash: 0, notes: '', at: null });

/* A driver runs exactly one route per day. This is it — there is no
   collection to pick from, only today's assignment and the history behind it. */
const TODAY = {
  id: 'RT-4471', name: 'Riverside · Midtown loop', day: 'Mon 25 Aug', start: '06:40',
  window: '07:00–14:00', status: 'ready', truck: 'TRK-001',
  stops: [
    stopSeed('a1', 1, 'Hopwright Brewing', '1412 R St', 'Sacramento, CA 95811', 600, 'Invoice', '07:00–09:00', 38.5701, -121.4790, 'Dock in rear alley. Ring bell twice.'),
    stopSeed('a2', 2, 'El Farolito Taqueria', '2210 J St', 'Sacramento, CA 95816', 300, 'Cash', '08:00–10:30', 38.5760, -121.4700, ''),
    stopSeed('a3', 3, 'Riverside Sports Bar', '890 Front St', 'Sacramento, CA 95814', 400, 'Card on file', '09:00–12:00', 38.5820, -121.5040, 'Basement tank — bring the 25 ft hose.'),
    stopSeed('a4', 4, "Mahoney's Public House", '1201 Alhambra Blvd', 'Sacramento, CA 95816', 400, 'Cash', '10:00–12:30', 38.5705, -121.4630, 'Tight alley — back in from Alhambra only.'),
    stopSeed('a5', 5, 'Cinema Grill 12', '55 Capitol Mall', 'Sacramento, CA 95814', 500, 'Invoice', '11:00–14:00', 38.5790, -121.5010, '')
  ]
};
const PAST = [
  { id: 'RT-4468', name: 'Riverside · Midtown loop', day: 'Fri 22 Aug', stops: 6, lbs: 3100, cash: 480, miles: 61.4, time: '6:12' },
  { id: 'RT-4463', name: 'Southport · Restaurants', day: 'Thu 21 Aug', stops: 5, lbs: 2450, cash: 215, miles: 48.9, time: '5:38' },
  { id: 'RT-4459', name: 'Northline · Beverage accounts', day: 'Wed 20 Aug', stops: 7, lbs: 3980, cash: 640, miles: 77.2, time: '7:05' }
];
const CHECKS = ['Tires, brakes & lights', 'Hoses, fittings & valves', 'CO₂ leak check (sniffer)', 'PPE: gloves, goggles, monitor'];

/* ============================================================ ACCOUNT
   MVP note: the account lives in memory. In production this is a token
   from the auth service — never the password — held in secure storage. */
const USER = {
  first: 'Marcus', last: 'Ellery', id: 'EMP-2264',
  email: 'm.ellery@coldstream.co', phone: '(916) 555-0142',
  depot: 'Depot 7 · Riverside', role: 'CO₂ Delivery Driver', since: 'Mar 2021',
  cdl: 'Class B · Hazmat (H)', cdlExp: 'Mar 14, 2027', medExp: 'Nov 02, 2026',
  truck: 'TRK-001', pw: 'driver123', pwChanged: '4 months ago',
  prefs: { alerts: false, aloud: false, awake: false }
};
const initials = () => (USER.first[0] || '') + (USER.last[0] || '');
const fullName = () => `${USER.first} ${USER.last}`.trim();

/* ============================================================ STATE */
const S = {
  authed: false, onShift: false,
  screen: 'login', tab: 'route',
  route: null, truck: 'TRK-001', fuel: 88,
  co2Start: 4200, co2Now: 4200,
  drive: { state: 'idle', prog: 0, follow: true, legFrom: null, checks: {} },
  sos: false, geoFar: false, voiceMode: 'chat', voiceText: '',
  paused: false, routeDone: false, shiftSec: 0, breakSec: 0, breakReason: '', miles: 0, doneOpen: false,
  problems: [], msgs: [], unread: 0,
  activeStop: null, pickedIssue: null,
  geo: { lat: null, lng: null, acc: null, speed: 0, ok: false },
  tts: false, hands: false, recording: false
};

/* ============================================================ TOAST */
let toastT;
function toast(msg, warn) {
  const t = $('#toast');
  t.className = 'toast on' + (warn ? ' warn' : '');
  t.innerHTML = `<svg viewBox="0 0 24 24"><path d="${warn ? 'M12 2 1 21h22L12 2zm1 14h-2v2h2v-2zm0-7h-2v5h2V9z' : 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z'}"/></svg><span>${msg}</span>`;
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3400);
}

/* ============================================================ SHEETS */
let openSheet = null;
function sheet(id) {
  if (openSheet) openSheet.classList.remove('on');
  openSheet = $(id); openSheet.classList.add('on'); $('#scrim').classList.add('on');
  setTimeout(() => { const f = openSheet.querySelector('input,select,textarea,button'); if (f && window.innerWidth > 520) f.focus(); }, 320);
}
function closeSheet() {
  if (openSheet) openSheet.classList.remove('on');
  openSheet = null; $('#scrim').classList.remove('on');
}
$('#scrim').onclick = closeSheet;
document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

/* ============================================================ SCREENS */
function show(name) {
  S.screen = name;
  $$('.screen').forEach(s => s.classList.remove('on'));
  $('#s-' + name).classList.add('on');
  window.scrollTo(0, 0);
}

/* ============================================================ 1a. MY ROUTE
   A driver runs one route per day, so this screen is today's assignment
   plus the history behind it — not a list to choose from. */
function renderRoutes() {
  const r = TODAY, st = r.stops;
  const done = st.filter(x => x.status === 'done').length;
  const settled = st.filter(x => x.status === 'done' || x.status === 'skipped').length;
  const pct = Math.round(settled / st.length * 100);
  const planned = st.reduce((a2, x) => a2 + x.expected, 0);
  const delivered = st.reduce((a2, x) => a2 + x.lbs, 0);
  const pill = S.routeDone
    ? '<span class="pill pill-green"><i class="dot"></i>Completed</span>'
    : S.onShift
      ? '<span class="pill pill-cyan"><i class="dot"></i>In progress</span>'
      : '<span class="pill pill-blue">Ready to start</span>';

  $('#today-card').innerHTML = `
    <div class="card" style="padding:16px">
      <div class="route-top"><span class="route-code">${r.id}</span>${pill}</div>
      <div class="route-name">${r.name}</div>
      <div class="route-meta"><span>${r.day} · ${r.start} start</span><span>${S.onShift ? S.truck : r.truck}</span></div>
      <div class="now-facts">
        <div><div class="k">Stops</div><div class="v">${done}/${st.length}</div></div>
        <div><div class="k">${S.onShift ? 'Delivered' : 'Planned'}</div><div class="v">${nf(S.onShift ? delivered : planned)} lb</div></div>
        <div><div class="k">Window</div><div class="v" style="font-size:15px">${r.window}</div></div>
      </div>
      <div class="mini-bar${S.routeDone ? ' done' : ''}" style="margin-top:13px"><i style="width:${pct}%"></i></div>
      <button class="btn ${S.routeDone ? 'btn-ghost' : S.onShift ? 'btn-cyan' : 'btn-primary'} btn-xl" id="today-go" style="margin-top:15px">
        ${S.routeDone
          ? 'Review the summary'
          : S.onShift
            ? '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Resume route'
            : '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 10.6V6h-2v7.4l5.2 3.1 1-1.7-4.2-2.2z"/></svg>Start pre-trip inspection'}
      </button>
    </div>`;
  $('#today-go').onclick = () => S.routeDone ? openWrap() : S.onShift ? enterActive('route') : startInspection();

  /* the manifest: every stop on today's run, in order */
  $('#man-label').textContent = `Manifest · ${st.length} stops · ${nf(planned)} lb`;
  $('#manifest').innerHTML = st.map(x => {
    const cls = x.status === 'done' ? 'done' : x.status === 'current' ? 'current' : x.status === 'skipped' ? 'skipped' : '';
    const val = x.status === 'done' ? `${nf(x.lbs)} lb` : x.status === 'skipped' ? 'Skipped' : `${x.expected} lb`;
    return `<div class="unrow${x.status === 'done' ? ' is-done' : ''}">
      <span class="n ${cls}">${x.status === 'done' ? '✓' : x.seq}</span>
      <span class="tx"><b>${x.cust}</b><small>${x.addr} · ${x.win} · ${x.pay}</small></span>
      <span class="v${x.status === 'done' ? ' g' : ''}">${val}</span>
    </div>`;
  }).join('');

  const past = $('#routes-past'); past.innerHTML = '';
  PAST.forEach(r2 => {
    const b2 = el('button', 'route-item');
    b2.innerHTML = `
      <div class="route-top"><span class="route-code">${r2.id}</span><span class="pill pill-green"><i class="dot"></i>Completed</span></div>
      <div class="route-name">${r2.name}</div>
      <div class="route-meta">
        <span><b>${r2.stops}/${r2.stops}</b> stops</span>
        <span><b>${nf(r2.lbs)}</b> lb</span>
        <span><b>${money(r2.cash)}</b></span>
        <span>${r2.day}</span>
      </div>`;
    b2.onclick = () => {
      $('#past-title').textContent = r2.id;
      $('#past-sub').textContent = `${r2.name} · ${r2.day}`;
      $('#past-body').innerHTML = `
        <div class="metrics">
          <div class="metric"><div class="k">Driving time</div><div class="v">${r2.time}</div></div>
          <div class="metric"><div class="k">Mileage</div><div class="v">${r2.miles}<span class="u">mi</span></div></div>
          <div class="metric green"><div class="k">Money collected</div><div class="v">${money(r2.cash)}</div></div>
          <div class="metric blue"><div class="k">CO₂ delivered</div><div class="v">${nf(r2.lbs)}<span class="u">lb</span></div></div>
        </div>
        <p class="hint" style="margin-top:14px">Submitted to dispatch ${r2.day} · reviewed and closed.</p>`;
      sheet('#sheet-past');
    };
    past.appendChild(b2);
  });
}

function startInspection() {
  S.route = TODAY;
  $('#inspect-route').textContent = `${TODAY.id} · ${TODAY.stops.length} stops · ${nf(TODAY.stops.reduce((a, x) => a + x.expected, 0))} lb`;
  show('inspect');
}

/* demo helper: drop into the middle of a running route */
$('#btn-demo').onclick = () => {
  S.route = TODAY; S.routeDone = false;
  TODAY.stops.forEach(s => { s.status = 'pending'; s.lbs = 0; s.cash = 0; s.at = null; });
  const t = TODAY.stops;
  t[0].status = 'done'; t[0].lbs = 600; t[0].cash = 0; t[0].at = new Date(Date.now() - 78 * 60000);
  t[1].status = 'done'; t[1].lbs = 300; t[1].cash = 46.5; t[1].at = new Date(Date.now() - 34 * 60000);
  S.truck = TODAY.truck; S.co2Start = 4200; S.co2Now = 3300;
  S.shiftSec = 5680; S.breakSec = 620; S.miles = 18.7;
  advance(); startShift(true);
};

/* ============================================================ 1b. INSPECTION */
function renderChecklist() {
  const c = $('#checklist'); c.innerHTML = '';
  CHECKS.forEach((t, i) => {
    const l = el('label', 'check');
    l.innerHTML = `<input type="checkbox" data-chk><i class="box"><svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg></i><span>${t}</span>`;
    c.appendChild(l);
  });
  c.addEventListener('change', () => {
    const all = $$('[data-chk]').every(i => i.checked);
    $('#btn-clockin').disabled = !all;
  });
}
$('#back-routes').onclick = () => show('routes');
$('#btn-clockin').onclick = () => {
  S.route = TODAY;
  S.truck = $('#f-truck').value;
  S.fuel = +$('#f-fuel').value || 0;
  S.co2Start = S.co2Now = +$('#f-co2').value || 0;
  S.shiftSec = 0; S.breakSec = 0; S.miles = 0;
  advance(); startShift(false);
  askNotifications();
};

/* ============================================================ SHIFT */
let tick;
function startShift(resume) {
  S.onShift = true;
  resetLeg();
  show('active'); setTab('map');
  renderAll();
  clearInterval(tick);
  tick = setInterval(() => {
    if (!S.onShift) return;
    S.shiftSec++;
    if (S.paused) {
      S.breakSec++;
      const bc = $('#break-clock'); if (bc) bc.textContent = clock(S.breakSec);
      return;
    }
    if (S.shiftSec % 3 === 0 && !S.geo.ok) S.miles += 0.011;   // fallback odometer
    if (S.shiftSec % 5 === 0) updateHeader();
  }, 1000);
  startGeo();
  if (resume) {
    pushMsg('them', 'Morning Marcus — El Farolito signed off. Three stops left, you\'re about 12 minutes ahead.');
  } else {
    pushMsg('them', `You're clocked in on ${S.truck}. Hopwright Brewing is expecting you first — the dock is in the rear alley.`);
  }
  setTimeout(() => { if (S.onShift) dispatcherPing(); }, 42000);
}

function advance() {
  const st = S.route.stops;
  st.forEach(s => { if (s.status === 'current') s.status = 'pending'; });
  const next = st.find(s => s.status === 'pending');
  if (next) next.status = 'current';
  S.activeStop = next || null;
}

/* ============================================================ RENDER */
function renderAll() { updateHeader(); renderStops(); renderProblems(); renderChat(); renderDrive(); renderMap(); }

function updateHeader() {
  if (!S.route) {
    $('#active-sub').textContent = `Off shift · ${USER.depot}`;
    $('#topbar-active').querySelector('.gauge').style.display = 'none';
    return;
  }
  const st = S.route.stops, done = st.filter(s => s.status === 'done').length;
  const delivered = st.reduce((a, s) => a + s.lbs, 0);
  $('#active-sub').textContent = `${S.route.id} · ${S.truck} · On shift ${clock(S.shiftSec)}`;
  $('#g-lbs').textContent = nf(S.co2Now);
  $('#g-stops').textContent = `${done}/${st.length}`;
  $('#g-delivered').textContent = `${nf(delivered)} lb delivered`;

  const T = 26, ticks = $('#ticks');
  if (ticks.children.length !== T) { ticks.innerHTML = ''; for (let i = 0; i < T; i++) ticks.appendChild(el('i', 'tick')); }
  const fullN = S.co2Start ? Math.round(S.co2Now / S.co2Start * T) : 0;
  const spentN = S.co2Start ? Math.round(delivered / S.co2Start * T) : 0;
  [...ticks.children].forEach((t, i) => {
    t.className = 'tick' + (i < fullN ? ' full' : (i < fullN + spentN ? ' spent' : ''));
  });
  ticks.setAttribute('aria-label', `${nf(S.co2Now)} pounds CO2 remaining of ${nf(S.co2Start)}`);
  renderBanners();
}

function renderBanners() {
  const w = $('#banners');
  w.innerHTML = (w.dataset.alert || '');
}

function renderStops() {
  if (!S.route) return;
  const st = S.route.stops;
  const settled = st.filter(s => s.status === 'done' || s.status === 'skipped');
  const cur = st.find(s => s.status === 'current');
  const pending = st.filter(s => s.status === 'pending');

  /* ---- paused takeover ---- */
  $('#pause-card').innerHTML = S.paused ? `
    <div class="pausecard">
      <div class="k">Route paused · ${S.breakReason}</div>
      <div class="v" id="break-clock">${clock(S.breakSec)}</div>
      <p>Dispatch can see you're stopped. Your driving hours aren't counting.</p>
      <button class="btn btn-amber btn-xl" id="btn-resume">
        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Resume route</button>
    </div>` : '';
  if (S.paused) $('#btn-resume').onclick = resumeRoute;
  $('#break-label').textContent = S.paused ? 'Resume route' : 'Pause route';

  /* ---- settled stops collapse to a single line ---- */
  const ds = $('#done-strip');
  if (!settled.length) ds.innerHTML = '';
  else {
    const dn = settled.filter(s => s.status === 'done');
    const sk = settled.filter(s => s.status === 'skipped');
    const lbs = dn.reduce((a, s) => a + s.lbs, 0), cash = dn.reduce((a, s) => a + s.cash, 0);
    ds.innerHTML = `
      <button class="donestrip${S.doneOpen ? ' open' : ''}" id="done-toggle" aria-expanded="${S.doneOpen}">
        <span class="ic"><svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg></span>
        <span class="tx">
          <b>${dn.length} delivered${sk.length ? ` · ${sk.length} skipped` : ''}</b>
          <small>${nf(lbs)} lb${cash ? ' · ' + money(cash) + ' collected' : ''}</small>
        </span>
        <span class="chev"></span>
      </button>
      ${S.doneOpen ? `<div class="donelist">${settled.map(s => `
        <div class="drow">
          <span class="n${s.status === 'skipped' ? ' sk' : ''}">${s.status === 'skipped' ? '!' : s.seq}</span>
          <span class="nm">${s.cust}</span>
          ${s.status === 'skipped'
            ? '<span class="v" style="color:var(--amber)">Skipped</span>'
            : `<span class="v g">${nf(s.lbs)} lb</span>${s.cash ? `<span class="v">${money(s.cash)}</span>` : ''}`}
          <span class="t">${s.at ? hhmm(s.at) : '—'}</span>
        </div>`).join('')}</div>` : ''}`;
    $('#done-toggle').onclick = () => { S.doneOpen = !S.doneOpen; renderStops(); };
  }

  /* ---- the stop that matters ---- */
  const cw = $('#current-wrap');
  if (cur) {
    const dist = S.geo.lat != null ? haversine(S.geo, cur).toFixed(1) + ' mi' : '—';
    cw.innerHTML = `
      <div class="now">
        <div class="now-head">
          <span class="pill pill-cyan"><i class="dot"></i>Stop ${cur.seq} of ${S.route.stops.length}</span>
          <span class="eta">Window ${cur.win}</span>
        </div>
        <h2>${cur.cust}</h2>
        <p class="addr">${cur.addr}<br>${cur.city}</p>
        <div class="now-facts">
          <div><div class="k">Expected</div><div class="v">${cur.expected} lb</div></div>
          <div><div class="k">Payment</div><div class="v" style="font-size:15px">${cur.pay}</div></div>
          <div><div class="k">Distance</div><div class="v">${dist}</div></div>
        </div>
        ${cur.note ? `<div class="stop-note">📍 ${cur.note}</div>` : ''}
        <div class="btn-row">
          <button class="btn btn-ghost" data-nav>
            <svg viewBox="0 0 24 24"><path d="m21 3-8 18-2.5-7.5L3 11z"/></svg>Navigate</button>
          <button class="btn btn-cyan" data-deliver="${cur.id}" style="flex:1.35">
            <svg viewBox="0 0 24 24"><path d="M19 7h-3V5.5A2.5 2.5 0 0 0 13.5 3h-3A2.5 2.5 0 0 0 8 5.5V7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zm-9-1.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V7h-4V5.5zM13 15h-2v2H9v-2H7v-2h2v-2h2v2h2v2z"/></svg>
            Record delivery</button>
        </div>
      </div>
      <button class="btn btn-danger" id="btn-problem" style="margin-bottom:4px">
        <svg viewBox="0 0 24 24"><path d="M12 2 1 21h22L12 2zm1 14h-2v2h2v-2zm0-7h-2v5h2V9z"/></svg>
        Report problem</button>`;
    $('#btn-problem').onclick = openProblem;
  } else {
    cw.innerHTML = `<div class="card" style="padding:22px;text-align:center">
      <b style="font-size:17px;display:block;margin-bottom:5px">Every stop is closed out</b>
      <p style="margin:0;font-size:14px;color:var(--slate);line-height:1.5">Finish the route to send your sheet to dispatch.</p></div>`;
  }

  /* ---- what's left, one line each ---- */
  const nw = $('#next-wrap');
  nw.innerHTML = !pending.length ? '' : `
    <div class="sect"><span class="eyebrow">Up next · ${pending.length} left</span><hr></div>
    <div class="upnext">${pending.map(s => `
      <div class="unrow">
        <span class="n">${s.seq}</span>
        <span class="tx"><b>${s.cust}</b><small>${s.addr} · ${s.win}</small></span>
        <span class="v">${s.expected} lb</span>
      </div>`).join('')}</div>`;

  const left = st.some(s => s.status === 'current' || s.status === 'pending');
  $('#finish-wrap').innerHTML = left ? '' :
    `<button class="btn btn-green btn-xl" id="btn-finish" style="margin-top:18px">
      <svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>Finish route</button>`;
  if (!left) $('#btn-finish').onclick = openWrap;
}
document.addEventListener('click', e => {
  const d = e.target.closest('[data-deliver]');
  if (d) { openDelivery(S.route.stops.find(s => s.id === d.dataset.deliver)); return; }
  if (e.target.closest('[data-nav]')) { setTab('map'); if (S.drive.state === 'idle' && !S.paused) startDrive(); }
});

/* ============================================================ 3. RECORD DELIVERY */
function openDelivery(stop) {
  if (!stop) return;
  S.activeStop = stop;
  $('#dlv-cust').textContent = stop.cust;
  $('#dlv-addr').textContent = `${stop.addr}, ${stop.city}`;
  $('#dlv-tags').innerHTML =
    `<span class="pill ${stop.pay === 'Cash' ? 'pill-amber' : 'pill-blue'}">${stop.pay}</span>
     <span class="pill pill-grey">Stop ${stop.seq} of ${S.route.stops.length}</span>
     <span class="pill pill-grey">Window ${stop.win}</span>`;
  $('#d-lbs').value = '';
  $('#d-lbs').placeholder = 'Meter reading';
  lbsHint();
  $('#d-notes').value = '';
  const cash = stop.pay === 'Cash';
  $('#d-cash-field').classList.toggle('locked', !cash);
  $('#d-cash').value = cash ? '' : '0';
  $('#d-cash').disabled = !cash;
  $('#d-cashnote').textContent = cash
    ? 'Cash on delivery — collect before you leave the site.'
    : `Billed to the account (${stop.pay}). No money changes hands here.`;
  sheet('#sheet-deliver');
}

/* Scheduled volume is a planning figure — it drifts with the time of day and
   what the customer actually burned through. Only the meter is truth. */
function lbsHint() {
  const stop = S.activeStop; if (!stop) return;
  const el2 = $('#d-expect'), v = parseFloat($('#d-lbs').value);
  const base = `Enter actual meter amount (Scheduled: ${nf(stop.expected)} lb)`;
  if (!v || v <= 0) { el2.textContent = base; el2.classList.remove('warn'); return; }
  const diff = Math.round(v - stop.expected);
  if (Math.abs(diff) < Math.max(25, stop.expected * 0.12)) {
    el2.textContent = `${base} · tank has ${nf(S.co2Now)} lb`;
    el2.classList.remove('warn');
  } else {
    el2.textContent = `${nf(Math.abs(diff))} lb ${diff > 0 ? 'over' : 'under'} schedule — dispatch sees the variance. (Scheduled: ${nf(stop.expected)} lb)`;
    el2.classList.add('warn');
  }
}
$('#d-lbs').addEventListener('input', lbsHint);

$('#btn-save-delivery').onclick = () => {
  const s = S.activeStop; if (!s) return;
  const lbs = +$('#d-lbs').value || 0;
  const cash = +$('#d-cash').value || 0;
  if (!lbs || lbs <= 0) { toast('Enter the actual meter amount to save this stop.', true); $('#d-lbs').focus(); return; }
  if (lbs > S.co2Now) { toast(`Only ${nf(S.co2Now)} lb left on the truck.`, true); return; }
  s.lbs = lbs; s.cash = cash; s.notes = $('#d-notes').value.trim(); s.status = 'done'; s.at = new Date();
  S.co2Now = Math.max(0, S.co2Now - lbs);
  advance(); resetLeg(); closeSheet(); renderAll();
  toast(`${s.cust} delivered — ${nf(lbs)} lb${cash ? ', ' + money(cash) + ' collected' : ''}.`);
  if (S.activeStop) setTimeout(() => {
    pushMsg('them', `Logged ${nf(lbs)} lb at ${s.cust}. Next up: ${S.activeStop.cust}.`, true);
  }, 2600);
};

/* ============================================================ 4. PROBLEMS
   Full screen, not a sheet: there are 18 things that can go wrong on a
   CO₂ route and a driver shouldn't scroll a peephole to find theirs. */
const IC = {
  truck: 'M18.9 6a1.5 1.5 0 0 0-1.4-1H6.5a1.5 1.5 0 0 0-1.4 1L3 12v8a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h12v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-8l-2.1-6zM6.5 16A1.5 1.5 0 1 1 8 14.5 1.5 1.5 0 0 1 6.5 16zm11 0a1.5 1.5 0 1 1 1.5-1.5 1.5 1.5 0 0 1-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z',
  warn: 'M12 2 1 21h22L12 2zm1 14h-2v2h2v-2zm0-7h-2v5h2V9z',
  road: 'M11 2h2v4h-2V2zm0 7h2v6h-2V9zm0 9h2v4h-2v-4zM4 2h2v20H4V2zm14 0h2v20h-2V2z',
  weather: 'M6 19a5 5 0 0 1-.6-9.96A6 6 0 0 1 17.6 8.5 4.5 4.5 0 0 1 17.5 19H6zm3 2 1.5-2.5L12 21l-1.5 2.5L9 21z',
  door: 'M4 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H4V2zm10 9a1.2 1.2 0 1 0 1.2 1.2A1.2 1.2 0 0 0 14 11zM20 4h1v16h-1V4z',
  user: 'M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z',
  money: 'M12 1v3.2C8.7 4.7 6 7.5 6 11a6 6 0 0 0 12 0h-2a4 4 0 1 1-4-4v3l4-4-4-4zm-1 13h2v8h-2v-8z',
  tank: 'M9 2h6a1 1 0 0 1 1 1v1.4a5 5 0 0 1 3 4.6v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9a5 5 0 0 1 3-4.6V3a1 1 0 0 1 1-1zm-1 8v9a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-9H8z',
  tool: 'M22 19l-8.4-8.4a5 5 0 0 0-6.6-6.2l3.3 3.3-2.8 2.8-3.3-3.3a5 5 0 0 0 6.2 6.6L19 22l3-3z',
  leak: 'M12 2s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11zm0 15a4 4 0 0 0 4-4h-2a2 2 0 0 1-2 2v2z',
  med: 'M10 2h4v6h6v4h-6v10h-4V12H4V8h6V2z',
  shield: 'M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z'
};
const RED = 'var(--red)', AMB = '#B07A00', CYN = 'var(--cyan)', BLU = 'var(--blue)';
const ISSUE_GROUPS = [
  { g: 'Road & vehicle', items: [
    { k: 'traffic',    t: 'Traffic delay',            d: 'Congestion, an incident ahead, or a slow load', c: RED, ic: IC.truck,   f: 'delay',    sev: 'delay' },
    { k: 'breakdown',  t: 'Vehicle breakdown',        d: 'The truck won\'t run or isn\'t safe to drive',  c: RED, ic: IC.truck,   f: 'delay',    sev: 'urgent' },
    { k: 'collision',  t: 'Accident or collision',    d: 'Any contact, however minor',                    c: RED, ic: IC.warn,    f: 'delay',    sev: 'urgent' },
    { k: 'roadclosed', t: 'Road closed or detour',    d: 'Your route is blocked and you\'re going around', c: AMB, ic: IC.road,   f: 'delay',    sev: 'delay' },
    { k: 'weather',    t: 'Weather hazard',           d: 'Ice, flooding, wind, or poor visibility',       c: AMB, ic: IC.weather, f: 'delay',    sev: 'delay' } ] },
  { g: 'Site & customer', items: [
    { k: 'closed',     t: 'Site closed',              d: 'Nobody there during the delivery window',       c: AMB, ic: IC.door,    f: 'skip',     sev: 'delay' },
    { k: 'declined',   t: 'Customer declined delivery', d: 'They turned the drop away today',             c: AMB, ic: IC.door,    f: 'skip',     sev: 'delay' },
    { k: 'access',     t: 'Can\'t access the site',   d: 'Locked gate, blocked dock, nowhere to park',    c: AMB, ic: IC.door,    f: 'skip',     sev: 'delay' },
    { k: 'nosign',     t: 'Nobody available to sign', d: 'Waiting on staff to accept the delivery',       c: CYN, ic: IC.user,    f: 'stop',     sev: 'info' },
    { k: 'payment',    t: 'Payment problem',          d: 'Customer can\'t or won\'t pay on delivery',     c: CYN, ic: IC.money,   f: 'money',    sev: 'delay' } ] },
  { g: 'Product & equipment', items: [
    { k: 'tankprob',   t: 'Customer tank problem',    d: 'Frozen, leaking, damaged, or out of test date', c: CYN, ic: IC.tank,    f: 'stop',     sev: 'delay' },
    { k: 'fitting',    t: 'Fitting or hose mismatch', d: 'The connection on site doesn\'t match the truck', c: CYN, ic: IC.tool,  f: 'stop',     sev: 'delay' },
    { k: 'short',      t: 'Not enough product to fill', d: 'The truck can\'t cover what\'s left',         c: CYN, ic: IC.tank,    f: 'short',    sev: 'delay' },
    { k: 'capacity',   t: 'Extra tank capacity left', d: 'Room on board for another drop today',          c: BLU, ic: IC.tank,    f: 'capacity', sev: 'info' },
    { k: 'gear',       t: 'Missing or damaged gear',  d: 'Hose, regulator, scale, or PPE',                c: CYN, ic: IC.tool,    f: 'stop',     sev: 'delay' } ] },
  { g: 'Safety', items: [
    { k: 'leak',       t: 'CO₂ leak or release',      d: 'Product escaping on the truck or on site',      c: RED, ic: IC.leak,    f: 'none',     sev: 'urgent' },
    { k: 'injury',     t: 'Injury or medical',        d: 'You or anyone on site is hurt',                 c: RED, ic: IC.med,     f: 'none',     sev: 'urgent' },
    { k: 'unsafe',     t: 'Unsafe conditions on site', d: 'Poor ventilation, a hazard, or a hostile person', c: RED, ic: IC.shield, f: 'stop',   sev: 'urgent' } ] }
];
const ALL_ISSUES = ISSUE_GROUPS.flatMap(g => g.items);
const SEVS = [{ k: 'info', l: 'FYI' }, { k: 'delay', l: 'Delay' }, { k: 'urgent', l: 'Urgent' }];

function openProblem() {
  S.probReturn = S.screen === 'home' ? 'home' : 'active';
  S.pickedIssue = null; S.sev = 'delay'; S.photo = null;
  show('problem'); renderProblemPicker();
}
$('#prob-back').onclick = () => {
  if (S.pickedIssue) { S.pickedIssue = null; renderProblemPicker(); return; }
  S.probReturn === 'home' ? goHome() : enterActive(S.tab === 'problems' ? 'problems' : 'route');
};
$('#btn-problem-2').onclick = openProblem;

function renderProblemPicker() {
  $('#prob-h').textContent = S.sos ? 'Emergency' : 'Report a Problem';
  $('#prob-s').textContent = S.sos ? 'Call first if anyone is in danger' : 'Dispatch sees this the moment you send it';
  $('#prob-foot').hidden = true;
  const groups = S.sos ? ISSUE_GROUPS.slice().sort((a, b) => (b.g === 'Safety') - (a.g === 'Safety')) : ISSUE_GROUPS;
  $('#prob-pane').innerHTML = (S.sos ? `<div class="callout" style="margin-bottom:4px">
      <span>Dispatch is standing by on (916) 555-0100.</span><a href="tel:+19165550100">Call now</a></div>` : '')
    + groups.map(g => `
    <div class="igroup"><span class="eyebrow">${g.g}</span></div>
    <div class="ilist">${g.items.map(i => `
      <button class="irow" data-issue="${i.k}">
        <span class="ic" style="background:${i.c}"><svg viewBox="0 0 24 24"><path d="${i.ic}"/></svg></span>
        <span class="tx"><b>${i.t}</b><small>${i.d}</small></span>
        <span class="chev"></span>
      </button>`).join('')}</div>`).join('')
    + `<p class="hint" style="margin-top:20px">For a leak, an injury, or anything on fire, call dispatch on (916) 555-0100 first and file this afterwards.</p>`;
  $$('#prob-pane [data-issue]').forEach(b => b.onclick = () => pickIssue(ALL_ISSUES.find(i => i.k === b.dataset.issue)));
  S.sos = false;
  $('#prob-pane').parentElement.scrollTop = 0;
}

function pickIssue(i) {
  S.pickedIssue = i; S.sev = i.sev;
  const open = S.route ? S.route.stops.filter(s => s.status === 'current' || s.status === 'pending') : [];
  const cur = S.activeStop;
  let extra = '';
  if (i.f === 'delay') extra = `
    <label class="field big"><span>How far behind</span>
      <input id="p-delay" type="number" inputmode="numeric" value="25" min="0"><i class="unit">MIN</i></label>`;
  if (i.f === 'capacity') extra = `
    <label class="field big"><span>Capacity free after the route</span>
      <input id="p-cap" type="number" inputmode="numeric" value="${Math.max(0, S.co2Now - open.reduce((a, s) => a + s.expected, 0))}" min="0"><i class="unit">LBS</i></label>
    <p class="hint">Dispatch can slot an extra account onto your run with this.</p>`;
  if (i.f === 'short') extra = `
    <label class="field big"><span>Short by</span>
      <input id="p-short" type="number" inputmode="numeric" value="${Math.max(0, open.reduce((a, s) => a + s.expected, 0) - S.co2Now)}" min="0"><i class="unit">LBS</i></label>`;
  if (i.f === 'money') extra = `
    <label class="field big"><span>Amount outstanding</span>
      <div class="inline"><i class="pre">$</i><input id="p-owed" type="number" inputmode="decimal" value="${cur ? cur.expected * 0.155 : 0}" min="0" step="0.01"></div></label>`;

  $('#prob-h').textContent = i.t;
  $('#prob-s').textContent = 'Add what dispatch needs, then send';
  $('#prob-foot').hidden = false;
  $('#prob-pane').innerHTML = `
    <div class="picked">
      <span class="ic" style="background:${i.c}"><svg viewBox="0 0 24 24"><path d="${i.ic}"/></svg></span>
      <span><b>${i.t}</b><small>${i.d}</small></span>
      <button class="change" id="p-change">Change</button>
    </div>
    <div class="sect" style="margin-top:4px"><span class="eyebrow">How urgent</span><hr></div>
    <div class="seg" id="p-sev">${SEVS.map(v => `<button data-sev="${v.k}" class="${v.k === S.sev ? 'on' : ''}">${v.l}</button>`).join('')}</div>
    <p class="hint" id="p-sevhint"></p>
    <div id="p-urgent"></div>
    ${open.length ? `
      <div class="sect"><span class="eyebrow">Which stop</span><hr></div>
      <label class="field sel"><span>Affected stop</span>
        <select id="p-stop">
          ${open.map(s => `<option value="${s.id}"${cur && s.id === cur.id ? ' selected' : ''}>${s.seq}. ${s.cust}</option>`).join('')}
          <option value="">Not about a specific stop</option>
        </select></label>` : ''}
    <div class="sect"><span class="eyebrow">Details</span><hr></div>
    ${extra}
    <label class="field"><span>Note to dispatch <i style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</i></span>
      <textarea id="p-note" rows="3" placeholder="What's happening?"></textarea></label>
    <button class="photo" id="p-photo">
      <span class="ic"><svg viewBox="0 0 24 24"><path d="M9 3 7.2 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3H9zm3 5a6 6 0 1 1-6 6 6 6 0 0 1 6-6zm0 2a4 4 0 1 0 4 4 4 4 0 0 0-4-4z"/></svg></span>
      <span><b>Add a photo</b><small>Damage, a blocked dock, a fitting</small></span>
    </button>
    <input type="file" id="p-file" accept="image/*" capture="environment" hidden>
    ${i.f === 'skip' ? '<p class="hint">Sending this marks the stop skipped and moves you to the next one.</p>' : ''}`;

  $('#p-change').onclick = () => { S.pickedIssue = null; renderProblemPicker(); };
  $$('#p-sev button').forEach(b => b.onclick = () => {
    S.sev = b.dataset.sev;
    $$('#p-sev button').forEach(x => x.classList.toggle('on', x.dataset.sev === S.sev));
    sevHint();
  });
  $('#p-photo').onclick = () => $('#p-file').click();
  $('#p-file').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    S.photo = URL.createObjectURL(f);
    $('#p-photo').innerHTML = `<img src="${S.photo}" alt=""><span><b>Photo attached</b><small>${f.name.slice(0, 26)}</small></span>`;
  };
  sevHint();
  $('#prob-pane').parentElement.scrollTop = 0;
}
function sevHint() {
  const h = { info: 'Logged for the record. No response needed.', delay: 'Dispatch reworks the rest of your route.', urgent: 'Dispatch is alerted immediately and will call you.' }[S.sev];
  $('#p-sevhint').textContent = h;
  $('#p-urgent').innerHTML = S.sev === 'urgent'
    ? `<div class="callout"><span>If anyone is in danger, call before you type.</span>
       <a href="tel:+19165550100">Call</a></div>` : '';
}

$('#btn-send-problem').onclick = () => {
  const i = S.pickedIssue; if (!i) return;
  const val = id => { const n = $('#' + id); return n ? n.value : ''; };
  const note = val('p-note').trim();
  const stopId = $('#p-stop') ? $('#p-stop').value : '';
  const stop = stopId && S.route ? S.route.stops.find(s => s.id === stopId) : null;
  let detail = '';
  if (i.f === 'delay') detail = `Running ${+val('p-delay') || 0} min behind.`;
  if (i.f === 'capacity') detail = `${nf(+val('p-cap') || 0)} lb of capacity free.`;
  if (i.f === 'short') detail = `Short ${nf(+val('p-short') || 0)} lb for the rest of the route.`;
  if (i.f === 'money') detail = `${money(+val('p-owed') || 0)} outstanding.`;
  if (stop) detail = `${stop.cust} — ` + (detail || '').toLowerCase();
  if (note) detail += (detail ? ' ' : '') + note;
  if (!detail) detail = 'No extra detail.';

  if (i.f === 'skip' && stop) {
    stop.status = 'skipped';
    stop.notes = note || i.t;
    if (stop.id === (S.activeStop || {}).id) advance();
  }
  S.problems.unshift({ k: i.k, t: i.t, c: i.c, ic: i.ic, sev: S.sev, photo: S.photo, detail, at: new Date() });
  S.pickedIssue = null; S.photo = null;
  enterActive('problems'); renderAll();
  toast('Sent to dispatch.');
  notify(S.sev === 'urgent' ? 'Urgent report sent' : 'Dispatch notified', i.t);

  setTimeout(() => {
    const R = {
      breakdown: 'Road service is rolling to you now. Sit tight — I\'m moving your last stops to Dane.',
      collision: 'Stay where you are. I\'ve got a supervisor heading out and I\'m logging the incident.',
      leak: 'Clear the area and stay upwind. Supervisor and safety are on the way.',
      injury: 'Helps on the way. Don\'t move the truck — I\'ll call you in thirty seconds.',
      unsafe: 'Leave the site. Don\'t finish that drop — I\'ll call the account.',
      closed: 'Got it, I\'ll reschedule them for Thursday. Roll to the next stop.',
      declined: 'Noted. I\'ll get sales to call them today.',
      access: 'I\'ll chase the gate code and put them back on for tomorrow.',
      payment: 'Leave it as invoice, I\'ll flag the account. Don\'t hold the product.',
      capacity: 'Nice — I\'m adding Delta Fountain Supply to your run. Details coming through.',
      short: 'Head back to the depot after the next drop and top up.',
      tankprob: 'Don\'t fill it. I\'m raising a service ticket for that tank.',
      fitting: 'Skip the fill, I\'ll get the right adapter on tomorrow\'s truck.',
      gear: 'Logged. Swap it at the depot tonight and I\'ll order a replacement.',
      nosign: 'Fine to leave it — I\'ll get an email confirmation from the manager.'
    }[i.k] || 'Copy. I pushed your remaining windows back and called ahead.';
    pushMsg('them', R, true);
    if (['traffic', 'roadclosed', 'weather', 'capacity'].includes(i.k)) {
      const moved = reoptimize();
      routeAlert(moved ? `Next stop changed to ${moved.cust}` : 'Route re-optimized around your report');
      if (moved) { showReopt(moved); renderAll(); }
    }
  }, 3000);
};

function renderProblems() {
  const w = $('#problems-list');
  const badge = $('#badge-prob');
  badge.hidden = !S.problems.length; badge.textContent = S.problems.length;
  if (!S.problems.length) {
    w.innerHTML = `<div class="empty">
      <svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
      <b>No problems reported</b><p>Traffic, a closed site, a bad fitting, spare capacity — log it here and dispatch reworks your route.</p></div>`;
    return;
  }
  w.innerHTML = '';
  S.problems.forEach(p => {
    const pill = { info: '<span class="pill pill-grey">FYI</span>', delay: '<span class="pill pill-amber">Delay</span>', urgent: '<span class="pill pill-red"><i class="dot"></i>Urgent</span>' }[p.sev] || '';
    w.appendChild(el('div', 'prob', `
      <div class="prob-ic" style="background:${p.c}"><svg viewBox="0 0 24 24"><path d="${p.ic}"/></svg></div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px"><b style="margin:0">${p.t}</b>${pill}</div>
        <p>${p.detail}</p>
        ${p.photo ? `<img src="${p.photo}" alt="" style="width:64px;height:64px;border-radius:10px;object-fit:cover;margin-top:8px">` : ''}
        <span class="t">${hhmm(p.at)} · Sent to dispatch</span></div>`));
  });
}

/* ============================================================ CHAT + SPEECH */
function pushMsg(who, text, alertToo) {
  S.msgs.push({ who, text, at: new Date() });
  renderChat();
  if (who === 'them') {
    if (S.tab !== 'chat') { S.unread++; updateBadge(); }
    if (S.tts) speak(text);
    if (alertToo) notify('Dispatch · Reina O.', text);
  }
}
function updateBadge() {
  const b = $('#badge-chat');
  b.hidden = !S.unread; b.textContent = S.unread;
  $$('[data-hbadge]').forEach(x => { x.hidden = !S.unread; x.textContent = S.unread; });
  if (S.screen === 'home') renderHome();
}
function renderChat() {
  const log = $('#chat-log'); log.innerHTML = '';
  S.msgs.forEach(m => {
    if (m.who === 'sys') { log.appendChild(el('div', 'msg sys', m.text)); return; }
    log.appendChild(el('div', 'msg ' + m.who, `
      <div class="who">${m.who === 'me' ? 'You' : 'Dispatch · Reina O.'}</div>
      <div>${m.text}</div><span class="t">${hhmm(m.at)}</span>`));
  });
  log.scrollTop = log.scrollHeight;
}
function sendChat() {
  const i = $('#chat-input'), v = i.value.trim(); if (!v) return;
  i.value = ''; i.style.height = 'auto';
  pushMsg('me', v);
  dispatcherReply(v);
}
function dispatcherReply(v) {
  setTimeout(() => {
    const r = /where|eta|how far|long/i.test(v) ? 'I can see you on the board — you\'re good on time.'
      : /help|stuck|problem|break|down/i.test(v) ? 'Tell me what you need. I can send road service or move the stop.'
      : /late|traffic|delay/i.test(v) ? 'No trouble, I\'ll call ahead and push your windows back.'
      : 'Copy that.';
    pushMsg('them', r, true);
  }, 2200);
}
$('#btn-send').onclick = sendChat;
$('#chat-input').addEventListener('input', e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 110) + 'px'; });
$('#chat-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });

/* ---- Web Speech: TTS ---- */
function speak(t) {
  if (!('speechSynthesis' in window)) return;
  try { const u = new SpeechSynthesisUtterance(t); u.rate = 1.02; u.pitch = 1; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {}
}
$('#tog-tts').onclick = e => {
  S.tts = !S.tts;
  e.currentTarget.classList.toggle('on', S.tts);
  e.currentTarget.setAttribute('aria-pressed', S.tts);
  if (!('speechSynthesis' in window)) { toast('This browser can\'t read messages aloud.', true); S.tts = false; e.currentTarget.classList.remove('on'); return; }
  toast(S.tts ? 'Dispatch messages will be read aloud.' : 'Read aloud off.');
  if (S.tts) speak('Read aloud is on.');
};

/* ---- Web Speech: STT ---- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
function makeRec() {
  if (!SR) return null;
  const r = new SR();
  r.lang = 'en-US'; r.interimResults = true; r.continuous = false;
  r.onstart = () => { S.recording = true; $('#btn-mic').classList.add('rec'); $('#act-mic').classList.add('rec'); };
  r.onend = () => {
    S.recording = false; $('#btn-mic').classList.remove('rec'); $('#act-mic').classList.remove('rec');
    if (S.voiceMode === 'drive') {
      S.voiceMode = 'chat';
      const t = S.voiceText.trim();
      if (t) { pushMsg('me', t); toast('Sent to dispatch.'); if (S.tts) speak('Message sent.'); dispatcherReply(t); }
      else toast('Didn\'t catch that.', true);
      return;
    }
    if (S.hands && $('#chat-input').value.trim()) sendChat();
    else if (S.hands) setTimeout(() => { try { r.start(); } catch (e) {} }, 700);
  };
  r.onerror = ev => {
    S.recording = false; S.voiceMode = 'chat';
    $('#btn-mic').classList.remove('rec'); $('#act-mic').classList.remove('rec');
    toast(ev.error === 'not-allowed' ? 'Microphone blocked. Allow mic access to dictate.' : 'Didn\'t catch that — try again.', true);
    S.hands = false; $('#tog-hands').classList.remove('on');
  };
  r.onresult = e => {
    let s = '';
    for (let i = e.resultIndex; i < e.results.length; i++) s += e.results[i][0].transcript;
    if (S.voiceMode === 'drive') { S.voiceText = s; return; }
    const inp = $('#chat-input');
    inp.value = s.trim();
    inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 110) + 'px';
  };
  return r;
}
$('#btn-mic').onclick = () => {
  if (!SR) { toast('Dictation isn\'t supported in this browser.', true); return; }
  rec = rec || makeRec();
  if (S.recording) { try { rec.stop(); } catch (e) {} return; }
  try { rec.start(); } catch (e) {}
};
$('#tog-hands').onclick = e => {
  if (!SR) { toast('Hands-free needs a browser with speech recognition.', true); return; }
  S.hands = !S.hands;
  e.currentTarget.classList.toggle('on', S.hands);
  e.currentTarget.setAttribute('aria-pressed', S.hands);
  if (S.hands) {
    S.tts = true; $('#tog-tts').classList.add('on');
    rec = rec || makeRec();
    try { rec.start(); } catch (err) {}
    toast('Hands-free on — speak, then pause to send.');
  } else {
    try { rec && rec.stop(); } catch (err) {}
    toast('Hands-free off.');
  }
};

/* ---- dispatcher-initiated events ---- */
function dispatcherPing() {
  const moved = reoptimize();
  if (!moved) return;
  pushMsg('them', `Heads up — ${moved.cust} called in low. I've moved them to the front of your run.`, true);
  routeAlert(`Next stop changed to ${moved.cust}`);
  showReopt(moved);
  renderAll();
}
function routeAlert(text) {
  const w = $('#banners');
  w.dataset.alert = `<div class="banner alert" id="alert-b">
    <span>⟳</span><span><b>${text}</b>Dispatch updated your route just now. Open Chat for details.</span>
    <button class="x" id="alert-x" aria-label="Dismiss">×</button></div>`;
  renderBanners();
  const x = $('#alert-x'); if (x) x.onclick = () => { w.dataset.alert = ''; renderBanners(); };
  notify('Route updated', text);
}

/* ============================================================ NOTIFICATIONS */
function askNotifications() { requestAlerts(false); }
$('#bell-routes').onclick = () => requestAlerts(true);
function notify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, tag: 'dispatch', badge: ICON, icon: ICON, vibrate: [80, 40, 80] };
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(r => r.showNotification(title, opts)).catch(() => new Notification(title, opts));
    } else new Notification(title, opts);
  } catch (e) { try { new Notification(title, opts); } catch (e2) {} }
}

/* ============================================================ GEOLOCATION + NAVIGATION
   The drive screen is the shift's home base: where am I, where next,
   how far, and the one control that matters right now. */
const DEPOTS = [
  { name: 'Depot 7 · Riverside', sub: 'Load out & return', lat: 38.5560, lng: -121.4930, home: true },
  { name: 'Northgate refill', sub: 'Top-up point', lat: 38.6290, lng: -121.4610 }
];
let watchId = null, lastFix = null, simTimer = null;
const R_EARTH = 3958.8, AVG_MPH = 24;

function haversine(a, b) {
  const rad = d => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(x));
}
const lerp = (a, b, t) => ({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });

function startGeo() {
  if (!('geolocation' in navigator)) { seedGeo(); return; }
  watchId = navigator.geolocation.watchPosition(pos => {
    const { latitude: lat, longitude: lng, accuracy: acc, speed } = pos.coords;
    /* Demo stops are in Sacramento. If the real fix is nowhere near the route,
       keep the simulated truck rather than reporting a 6,989-mile leg. */
    S.geoFar = haversine({ lat, lng }, DEPOTS[0]) > 60;
    if (S.geoFar) { S.geo.ok = false; if (S.geo.lat == null) seedGeo(); renderMap(); renderDrive(); return; }
    if (lastFix) { const d = haversine(lastFix, { lat, lng }); if (d < 2) S.miles += d; }
    lastFix = { lat, lng };
    S.geo = { lat, lng, acc, speed: speed ? speed * 2.23694 : 0, ok: true };
    if (S.drive.state === 'driving' && S.activeStop && !S.geoFar && haversine(S.geo, S.activeStop) < 0.12) arriveAtStop();
    renderMap(); renderDrive();
    if (S.screen === 'active' && S.tab === 'route') renderStops();
  }, () => { S.geo.ok = false; seedGeo(); },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 });
}
function seedGeo() {
  if (S.geo.lat == null) { S.geo.lat = DEPOTS[0].lat; S.geo.lng = DEPOTS[0].lng; }
  renderMap(); renderDrive();
}
const here = () => (S.geo.lat != null ? { lat: S.geo.lat, lng: S.geo.lng } : DEPOTS[0]);

/* ---------- the leg: current position → next delivery address ---------- */
function legDistance() {
  const s = S.activeStop; if (!s) return 0;
  return haversine(here(), s);
}
function etaMinutes(d) { return Math.max(1, Math.round(d / AVG_MPH * 60)); }

function startDrive() {
  if (!S.activeStop) return;
  if (S.paused) { resumeRoute(); return; }
  S.drive.state = 'driving';
  S.drive.legFrom = here();
  S.drive.prog = 0;
  renderMap(); renderDrive();
  toast(`Navigating to ${S.activeStop.cust}.`);
  runSim();
}
function stopDrive() {
  S.drive.state = 'idle';
  clearInterval(simTimer); simTimer = null;
  renderMap(); renderDrive();
  openBreak();
}
/* Without real movement there's nothing to navigate, so the truck advances
   along the leg on a timer. A live GPS fix takes over the moment one lands. */
function runSim() {
  clearInterval(simTimer);
  simTimer = setInterval(() => {
    if (S.drive.state !== 'driving' || S.paused) return;
    S.drive.prog = Math.min(1, S.drive.prog + 0.022);
    if (!S.geo.ok) {
      const p = lerp(S.drive.legFrom, S.activeStop, S.drive.prog);
      S.miles += haversine(here(), p);
      S.geo.lat = p.lat; S.geo.lng = p.lng; S.geo.speed = 27;
    }
    renderMap(); renderDrive();
    if (S.drive.prog >= 1) arriveAtStop();
  }, 620);
}
function arriveAtStop() {
  if (S.drive.state === 'arrived') return;
  clearInterval(simTimer); simTimer = null;
  S.drive.state = 'arrived';
  S.drive.checks = { parked: false, filled: false, paid: false };
  renderMap(); renderDrive();
  toast(`Arrived at ${S.activeStop.cust}.`);
  setTimeout(() => { const z = $('.drive-actions'); if (z) z.scrollTop = z.scrollHeight; }, 120);
  notify('Arrived', `${S.activeStop.cust} — confirm the delivery when you're done.`);
  if (S.tts) speak(`Arriving at ${S.activeStop.cust}.`);
}
function resetLeg() {
  S.drive.state = 'idle'; S.drive.prog = 0;
  clearInterval(simTimer); simTimer = null;
}

/* ---------- dispatch re-optimizes the route mid-drive ---------- */
function reoptimize() {
  const st = S.route.stops;
  const settled = st.filter(s => s.status === 'done' || s.status === 'skipped');
  const rest = st.filter(s => s.status === 'current' || s.status === 'pending');
  if (rest.length < 2) return null;
  const moved = rest.pop();
  rest.unshift(moved);
  rest.forEach(s => s.status = 'pending');
  rest[0].status = 'current';
  S.route.stops = settled.concat(rest);
  S.route.stops.forEach((s, k) => s.seq = k + 1);
  S.activeStop = rest[0];
  if (S.drive.state !== 'idle') { S.drive.legFrom = here(); S.drive.prog = 0; S.drive.state = 'driving'; runSim(); }
  return moved;
}
function showReopt(stop) {
  const r = $('#reopt');
  r.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/></svg>
    <div><b>Now heading to ${stop.cust}</b><small>Dispatch moved this stop up. Navigation is already updated.</small></div>
    <button class="x" id="reopt-x" aria-label="Dismiss">×</button>`;
  r.classList.add('on');
  $('#reopt-x').onclick = () => r.classList.remove('on');
  setTimeout(() => r.classList.remove('on'), 12000);
}

/* ---------- render: status bar, map, nav card, action zone ---------- */
function renderDrive() {
  if (!S.route) return;
  const st = S.route.stops, done = st.filter(s => s.status === 'done').length;
  $('#d-truck').textContent = S.truck;
  $('#d-tanklbs').textContent = nf(S.co2Now);
  $('#d-fuel').textContent = S.fuel + '%';
  $('#d-stop').textContent = `${Math.min(done + 1, st.length)} / ${st.length}`;
  const pctTank = S.co2Start ? Math.max(0, S.co2Now / S.co2Start * 100) : 0;
  const bar = $('#d-tank');
  bar.style.width = pctTank + '%';
  bar.classList.toggle('low', pctTank < 25);
  $('#act-badge').hidden = !S.unread;
  $('#act-badge').textContent = S.unread;

  /* nav card = the leg you're on */
  const cur = S.activeStop, nc = $('#navcard');
  if (!cur) {
    nc.innerHTML = `<div class="turn" style="background:var(--green)"><svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg></div>
      <div class="tx"><div class="k">Route complete</div><b>Return to ${DEPOTS[0].name}</b><small>Every stop is closed out</small></div>`;
  } else {
    const d = legDistance();
    nc.innerHTML = `
      <div class="turn"><svg viewBox="0 0 24 24"><path d="M21.7 11.3 12.7 2.3a1 1 0 0 0-1.4 0l-9 9a1 1 0 0 0 0 1.4l9 9a1 1 0 0 0 1.4 0l9-9a1 1 0 0 0 0-1.4zM13 14v-2.5h-3V15H8v-4.5a1 1 0 0 1 1-1h4V7l3.5 3.5L13 14z"/></svg></div>
      <div class="tx">
        <div class="k">${S.drive.state === 'arrived' ? 'Arrived at' : 'Next delivery'}</div>
        <b>${cur.cust}</b><small>${cur.addr}, ${cur.city.split(',')[0]}</small>
      </div>
      ${S.drive.state === 'arrived'
        ? '<div class="dist"><div class="v" style="font-size:15px;color:hsl(var(--success))">Here</div><span class="u">On site</span></div>'
        : `<div class="dist"><div class="v">${d.toFixed(1)}</div><span class="u">mi · ${etaMinutes(d)} min</span></div>`}`;
  }

  const chip = $('#mapchip');
  chip.classList.toggle('sim', !S.geo.ok);
  chip.innerHTML = `<i></i><span>${S.geoFar ? 'Demo route · GPS off area'
    : S.geo.ok ? 'Live GPS · ' + Math.round(S.geo.speed) + ' mph' : 'Simulated drive'}</span>`;

  /* the one big control */
  $('#tab-map').classList.toggle('arrived', S.drive.state === 'arrived');
  const cta = $('#drive-cta');
  if (!cur) {
    cta.innerHTML = `<button class="bigcta done" id="cta-main">
      <svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>Finish route</button>`;
    $('#cta-main').onclick = openWrap;
  } else if (S.paused) {
    cta.innerHTML = `<button class="bigcta stop" id="cta-main">
      <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Resume route</button>
      <div class="tinylink" style="color:#8A5C00">Paused · ${S.breakReason} · ${clock(S.breakSec)}</div>`;
    $('#cta-main').onclick = resumeRoute;
  } else if (S.drive.state === 'idle') {
    const first = !S.route.stops.some(s => s.status === 'done' || s.status === 'skipped');
    cta.innerHTML = `<button class="bigcta go" id="cta-main">
      <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>${first ? 'Start route' : 'Start next leg'}</button>`;
    $('#cta-main').onclick = startDrive;
  } else if (S.drive.state === 'driving') {
    cta.innerHTML = `<button class="bigcta stop" id="cta-main">
      <svg viewBox="0 0 24 24"><path d="M8 5h3v14H8zm5 0h3v14h-3z"/></svg>Stop route</button>
      <button class="tinylink" id="cta-arrived">I'm at the stop →</button>`;
    $('#cta-main').onclick = stopDrive;
    $('#cta-arrived').onclick = arriveAtStop;
  } else {
    const c = S.drive.checks, cash = cur.pay === 'Cash';
    const need = ['parked', 'filled'].concat(cash ? ['paid'] : []);
    const ready = need.every(k => c[k]);
    cta.innerHTML = `
      <div class="arrive">
        <div class="arrive-h">
          <svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5z"/></svg>
          At ${cur.cust}
        </div>
        <button class="ctog" data-check="parked">
          <span class="sw${c.parked ? ' on' : ''}"><i></i></span>
          <b>Truck parked &amp; chocked<small>Wheels chocked, hazards on</small></b>
        </button>
        <button class="ctog" data-check="filled">
          <span class="sw${c.filled ? ' on' : ''}"><i></i></span>
          <b>Tank filled &amp; hose stowed<small>Scheduled ${cur.expected} lb — read the meter</small></b>
        </button>
        ${cash ? `<button class="ctog" data-check="paid">
          <span class="sw${c.paid ? ' on' : ''}"><i></i></span>
          <b>Payment collected<small>Cash on delivery</small></b>
        </button>` : ''}
        <button class="bigcta done" id="cta-main" ${ready ? '' : 'disabled'}>
          <svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>Confirm delivery</button>
      </div>
      <button class="tinylink" id="cta-back">Not here yet — keep driving</button>`;
    $$('#drive-cta [data-check]').forEach(b => b.onclick = () => {
      S.drive.checks[b.dataset.check] = !S.drive.checks[b.dataset.check];
      renderDrive();
    });
    $('#cta-main').onclick = () => openDelivery(cur);
    $('#cta-back').onclick = () => { S.drive.state = 'driving'; S.drive.prog = 0.75; runSim(); renderDrive(); };
  }
}

function renderMap() {
  if (!S.route) return;
  const svg = $('#map-svg');
  const W = svg.clientWidth || 360, H = svg.clientHeight || 320;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const me = here(), cur = S.activeStop;
  const pts = S.route.stops.map(s => ({ lat: s.lat, lng: s.lng, s }));

  /* follow mode frames the leg you're driving; otherwise the whole day */
  let frame = pts.concat(DEPOTS, [me]);
  if (S.drive.follow && S.drive.state !== 'idle' && cur) frame = [me, cur, { lat: (me.lat + cur.lat) / 2, lng: (me.lng + cur.lng) / 2 }];
  const pad = S.drive.follow && S.drive.state !== 'idle' ? 0.006 : 0.018;
  const lats = frame.map(p => p.lat), lngs = frame.map(p => p.lng);
  const minLat = Math.min(...lats) - pad, maxLat = Math.max(...lats) + pad;
  const minLng = Math.min(...lngs) - pad, maxLng = Math.max(...lngs) + pad;
  const X = p => 14 + (p.lng - minLng) / (maxLng - minLng || 1) * (W - 28);
  const Y = p => H - 14 - (p.lat - minLat) / (maxLat - minLat || 1) * (H - 28);

  let g = `<defs>
    <pattern id="grid" width="34" height="34" patternUnits="userSpaceOnUse">
      <path d="M34 0H0v34" fill="none" stroke="#D2DDE5" stroke-width="1"/></pattern>
    <marker id="arw" markerWidth="7" markerHeight="7" refX="4" refY="3.5" orient="auto">
      <path d="M0 0 7 3.5 0 7z" fill="#fff"/></marker>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#grid)"/>`;

  /* the day's line, then the active leg on top of it */
  const remaining = S.route.stops.filter(s => s.status !== 'done' && s.status !== 'skipped');
  if (remaining.length > 1)
    g += `<polyline points="${remaining.map(p => `${X(p)},${Y(p)}`).join(' ')}" fill="none"
      stroke="#A9BCCA" stroke-width="3" stroke-dasharray="7 7" stroke-linecap="round"/>`;
  if (cur)
    g += `<line x1="${X(me)}" y1="${Y(me)}" x2="${X(cur)}" y2="${Y(cur)}" stroke="#0288D1" stroke-width="6"
      stroke-linecap="round" marker-end="url(#arw)" opacity=".92"/>`;

  /* depot pins */
  DEPOTS.forEach(d => {
    const x = X(d), y = Y(d);
    g += `<g transform="translate(${x} ${y})">
      <rect x="-12" y="-12" width="24" height="24" rx="6" transform="rotate(45)" fill="${d.home ? '#0A58CA' : '#5C6F80'}" stroke="#fff" stroke-width="3"/>
      <path d="M-6 -1 0 -6 6 -1v7h-4v-4h-4v4h-4z" fill="#fff"/></g>`;
  });

  /* stop pins */
  pts.forEach(p => {
    const c = p.s.status === 'done' ? '#2E7D32' : p.s.status === 'current' ? '#0288D1'
      : p.s.status === 'skipped' ? '#F9A825' : '#8A9AA8';
    const r = p.s.status === 'current' ? 15 : 12;
    if (p.s.status === 'current') g += `<circle cx="${X(p)}" cy="${Y(p)}" r="7" fill="#0288D1" class="ping"/>`;
    g += `<circle cx="${X(p)}" cy="${Y(p)}" r="${r}" fill="${c}" stroke="#fff" stroke-width="3"/>`;
    g += p.s.status === 'done'
      ? `<path d="M${X(p) - 5} ${Y(p)} l3.4 3.4 6.2-6.4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>`
      : `<text x="${X(p)}" y="${Y(p) + 5}" text-anchor="middle" font-family="Barlow Semi Condensed,sans-serif" font-size="14" font-weight="700" fill="#fff">${p.s.seq}</text>`;
  });

  /* the truck, pointed where it's going */
  const ang = cur ? Math.atan2(X(cur) - X(me), Y(me) - Y(cur)) * 180 / Math.PI : 0;
  g += `<circle cx="${X(me)}" cy="${Y(me)}" r="19" fill="#0D6EFD" opacity=".16"/>
    <g transform="translate(${X(me)} ${Y(me)}) rotate(${ang})">
      <circle r="11" fill="#0D6EFD" stroke="#fff" stroke-width="3"/>
      <path d="M0 -6 4 4 0 1.6 -4 4z" fill="#fff"/></g>`;
  svg.innerHTML = g;
}

$('#mt-follow').onclick = e => {
  S.drive.follow = !S.drive.follow;
  e.currentTarget.classList.toggle('on', S.drive.follow);
  e.currentTarget.setAttribute('aria-pressed', S.drive.follow);
  renderMap();
  toast(S.drive.follow ? 'Following your position.' : 'Showing the whole route.');
};
$('#mt-turn').onclick = () => { toast('Opening your maps app for turn-by-turn.'); launchNav(); };
function launchNav() {
  const s = S.activeStop;
  if (!s) { toast('No stop left to navigate to.', true); return; }
  const dest = encodeURIComponent(`${s.addr}, ${s.city}`);
  const from = S.geo.lat != null ? `&origin=${S.geo.lat},${S.geo.lng}` : '';
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}${from}&travelmode=driving`, '_blank', 'noopener');
}

/* ---------- action zone ---------- */
$('#act-chat').onclick = () => setTab('chat');
$('#act-sos').onclick = () => { S.sos = true; openProblem(); };
$('#act-mic').onclick = () => {
  if (!SR) { toast('Dictation isn\'t supported in this browser.', true); return; }
  rec = rec || makeRec();
  if (S.recording) { try { rec.stop(); } catch (e) {} return; }
  S.voiceMode = 'drive'; S.voiceText = '';
  try { rec.start(); toast('Listening — speak your message to dispatch.'); } catch (e) {}
};

/* ============================================================ PAUSE & RESUME
   A paused route is a logged break with a reason, not just a stopped clock. */
const BREAKS = [
  { k: 'Lunch', d: 'M8 2v9a3 3 0 0 0 6 0V2h-2v7h-1V2h-1v7H9V2H8zm9 0c-1.7 0-3 2.7-3 6v14h2v-8h1c1.1 0 2-.9 2-2V2h-2z' },
  { k: 'Rest break', d: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 10.6V6h-2v7.4l5.2 3.1 1-1.7-4.2-2.2z' },
  { k: 'Fuel stop', d: 'M18 10h-1V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14h13v-8h1v5a2 2 0 0 0 4 0V13l-4-3zM15 10H6V6h9v4z' },
  { k: 'Restroom', d: 'M7 2a2 2 0 1 1-2 2 2 2 0 0 1 2-2zm10 0a2 2 0 1 1-2 2 2 2 0 0 1 2-2zM5 8h4l2 7H9v7H5v-7H3l2-7zm10 0h4l2 7h-2v7h-4v-7h-2l2-7z' },
  { k: 'Reloading at depot', d: 'M9 2h6a1 1 0 0 1 1 1v1.4a5 5 0 0 1 3 4.6v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9a5 5 0 0 1 3-4.6V3a1 1 0 0 1 1-1z' },
  { k: 'Waiting on the customer', d: 'M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z' },
  { k: 'Other', d: 'M12 2 1 21h22L12 2zm1 14h-2v2h2v-2zm0-7h-2v5h2V9z' }
];
function openBreak() {
  $('#brk-body').innerHTML = `<div class="ilist">${BREAKS.map(b => `
    <button class="irow" data-break="${b.k}">
      <span class="ic" style="background:var(--amber)"><svg viewBox="0 0 24 24" style="fill:#3A2600"><path d="${b.d}"/></svg></span>
      <span class="tx"><b>${b.k}</b></span><span class="chev"></span>
    </button>`).join('')}</div>`;
  $$('#brk-body [data-break]').forEach(b => b.onclick = () => pauseRoute(b.dataset.break));
  sheet('#sheet-break');
}
function pauseRoute(reason) {
  S.paused = true; S.breakReason = reason;
  if (S.drive.state === 'driving') S.drive.state = 'idle';
  clearInterval(simTimer); simTimer = null;
  closeSheet(); setPauseUI(); renderStops(); renderDrive();
  toast(`Route paused — ${reason.toLowerCase()}.`);
  pushMsg('them', `Paused on my board (${reason.toLowerCase()}). Ping me when you roll again.`);
}
function resumeRoute() {
  S.paused = false;
  setPauseUI(); renderStops(); renderDrive();
  toast('Back on the clock.');
}
function setPauseUI() {
  const b = $('#btn-pause');
  b.classList.toggle('on', S.paused);
  b.setAttribute('aria-pressed', S.paused);
  b.setAttribute('aria-label', S.paused ? 'Resume route' : 'Pause route');
  $('#pause-ic').innerHTML = S.paused ? '<path d="M8 5v14l11-7z"/>' : '<path d="M8 5h3v14H8zm5 0h3v14h-3z"/>';
  renderBanners();
}
$('#btn-pause').onclick = () => S.paused ? resumeRoute() : openBreak();
$('#btn-break').onclick = () => S.paused ? resumeRoute() : openBreak();

/* ============================================================ TABS */
function setTab(t) {
  if (!S.route && t !== 'chat') { toast('Start a route to use that.', true); goHome(); return; }
  S.tab = t;
  $('#tab-route').style.display = t === 'route' ? '' : 'none';
  $('#tab-map').style.display = t === 'map' ? 'flex' : 'none';
  $('#tab-chat').style.display = t === 'chat' ? 'flex' : 'none';
  $('#tab-problems').style.display = t === 'problems' ? '' : 'none';
  $('#topbar-active').classList.toggle('plain', t !== 'route');
  $('#topbar-active').querySelector('.gauge').style.display = (t === 'route' && S.route) ? '' : 'none';
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  if (t === 'chat') { S.unread = 0; updateBadge(); renderChat(); }
  if (t === 'map') { renderDrive(); requestAnimationFrame(renderMap); }
}
$$('#nav button').forEach(b => b.onclick = () => setTab(b.dataset.tab));

/* ============================================================ 5. WRAP-UP */
function openWrap() {
  const st = S.route.stops;
  const done = st.filter(s => s.status === 'done');
  const lbs = done.reduce((a, s) => a + s.lbs, 0);
  const cash = done.reduce((a, s) => a + s.cash, 0);
  $('#wrap-sub').textContent = `${S.route.id} · ${S.truck} · ${S.route.name}`;
  $('#w-co2').textContent = nf(lbs);
  $('#w-stops').textContent = done.length;
  $('#w-time').textContent = clock(Math.max(0, S.shiftSec - S.breakSec));
  $('#w-break').textContent = clock(S.breakSec);
  $('#w-miles').innerHTML = S.miles.toFixed(1) + '<span class="u">mi</span>';
  $('#w-cash').textContent = money(cash);
  $('#w-left').innerHTML = nf(S.co2Now) + '<span class="u">lb</span>';
  $('#w-probs').textContent = S.problems.length;
  const log = $('#wrap-log'); log.innerHTML = '';
  st.forEach(s => {
    const ok = s.status === 'done';
    log.appendChild(el('div', 'prob', `
      <div class="prob-ic" style="background:${ok ? 'var(--green)' : 'var(--amber)'}">
        <svg viewBox="0 0 24 24"><path d="${ok ? 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z' : 'M12 2 1 21h22L12 2zm1 14h-2v2h2v-2zm0-7h-2v5h2V9z'}"/></svg></div>
      <div style="flex:1"><b>${s.seq}. ${s.cust}</b>
        <p>${ok ? `${nf(s.lbs)} lb · ${s.cash > 0 ? money(s.cash) + ' cash' : s.pay}` : 'Skipped — dispatch will reschedule'}</p>
        <span class="t">${s.at ? hhmm(s.at) : '—'}</span></div>`));
  });
  show('wrap');
}
$('#btn-back-route').onclick = () => show('active');
$('#btn-clockout').onclick = () => {
  clearInterval(tick);
  if (watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
  clearInterval(simTimer); simTimer = null;
  notify('Shift submitted', 'Your route sheet is with dispatch. See you tomorrow.');
  toast('Clocked out — route sheet sent to dispatch.');
  setTimeout(() => {
    S.onShift = false; S.paused = false; S.routeDone = true;
    goHome();
  }, 1400);
};

/* ============================================================ 0a. SIGN IN */
function fieldErr(host, msg) {
  $(host).innerHTML = msg
    ? `<div class="errmsg"><svg viewBox="0 0 24 24" width="17" height="17" style="fill:currentColor;flex:none"><path d="M12 2 1 21h22L12 2zm1 14h-2v2h2v-2zm0-7h-2v5h2V9z"/></svg><span>${msg}</span></div>`
    : '';
}
function revealBtn(btn, inputId) {
  const i = $('#' + inputId);
  const show = i.type === 'password';
  i.type = show ? 'text' : 'password';
  btn.textContent = show ? 'Hide' : 'Show';
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
}
$('#l-rev').onclick = e => revealBtn(e.currentTarget, 'l-pass');
document.addEventListener('click', e => {
  const b = e.target.closest('[data-rev]');
  if (b) revealBtn(b, b.dataset.rev);
});

function doLogin() {
  const u = $('#l-user').value.trim(), p = $('#l-pass').value;
  $('#l-user').closest('.field').classList.remove('err');
  $('#l-pass').closest('.field').classList.remove('err');
  if (!u) { fieldErr('#l-err', 'Enter your employee ID or email.'); $('#l-user').closest('.field').classList.add('err'); $('#l-user').focus(); return; }
  if (p.length < 4) { fieldErr('#l-err', 'Your password is at least 4 characters.'); $('#l-pass').closest('.field').classList.add('err'); $('#l-pass').focus(); return; }
  fieldErr('#l-err', '');
  const btn = $('#btn-login');
  btn.disabled = true; btn.innerHTML = 'Signing in…';
  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M11 7 9.6 8.4 12.2 11H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9-4h-8v2h8v14h-8v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/></svg>Sign in';
    if (u.includes('@') && u !== USER.email) USER.email = u;
    S.authed = true;
    $('#l-pass').value = '';
    goHome();
    toast(`Signed in as ${USER.id}.`);
  }, 650);
}
$('#btn-login').onclick = doLogin;
$('#l-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
$('#btn-forgot').onclick = () =>
  toast('Password resets go through your dispatcher — call Depot 7 on (916) 555-0100.', true);

/* ============================================================ 0b. HOME NAV */
const HNAV = [
  { k: 'home', l: 'Home', d: 'M12 3 2 12h3v8h6v-5h2v5h6v-8h3L12 3z' },
  { k: 'routes', l: 'My Route', d: 'M6.5 2a3.5 3.5 0 0 0-1 6.86V15a1 1 0 0 0 1 1H14a1.5 1.5 0 0 1 0 3H9.9a3.5 3.5 0 1 0 0 2H14a3.5 3.5 0 0 0 0-7H7.5V8.86A3.5 3.5 0 0 0 6.5 2zm11 8a3.5 3.5 0 0 0-3.5 3.5c0 2.4 3.5 6.5 3.5 6.5s3.5-4.1 3.5-6.5A3.5 3.5 0 0 0 17.5 10z' },
  { k: 'chat', l: 'Chat', d: 'M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM7 9h10v2H7V9zm7 5H7v-2h7v2zm3-6H7V6h10v2z' },
  { k: 'profile', l: 'Profile', d: 'M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z' }
];
function buildHomeNav() {
  $$('[data-homenav]').forEach(slot => {
    slot.innerHTML = `<nav class="nav" aria-label="Main">` + HNAV.map(n =>
      `<button data-hkey="${n.k}"><svg viewBox="0 0 24 24"><path d="${n.d}"/></svg><span>${n.l}</span>${n.k === 'chat' ? '<i class="badge" data-hbadge hidden>0</i>' : ''}</button>`
    ).join('') + `</nav>`;
    slot.querySelectorAll('[data-hkey]').forEach(b => b.onclick = () => homeNavGo(b.dataset.hkey));
  });
}
function homeNavGo(k) {
  if (k === 'home') goHome();
  if (k === 'routes') { show('routes'); renderRoutes(); markHomeNav('routes'); }
  if (k === 'chat') enterActive('chat');
  if (k === 'profile') openProfile();
}
function markHomeNav(k) {
  $$('[data-homenav]').forEach(s => s.querySelectorAll('[data-hkey]').forEach(b => b.classList.toggle('on', b.dataset.hkey === k)));
  $$('[data-hbadge]').forEach(b => { b.hidden = !S.unread; b.textContent = S.unread; });
}

/* ============================================================ 0c. HOME */
function goHome() {
  show('home'); renderHome(); markHomeNav('home');
}
function renderHome() {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  $('#home-greet').textContent = `${part}, ${USER.first}`;
  $('#home-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + USER.depot;
  $('#home-avatar').textContent = initials();
  $('#greet').textContent = `${fullName()} · ${USER.depot}`;

  /* hero: the shift, or the invitation to start one */
  const hero = $('#home-hero');
  if (S.routeDone && S.route) {
    const dn = S.route.stops.filter(s => s.status === 'done');
    hero.innerHTML = `<div class="hero off">
      <div class="hero-top">
        <div style="flex:1"><div class="k">Shift complete</div><h2>${S.route.id} submitted</h2></div>
        <span class="pill pill-green"><i class="dot"></i>Clocked out</span>
      </div>
      <div class="hero-line">
        <span><b>${dn.length}/${S.route.stops.length}</b> stops</span>
        <span><b>${nf(dn.reduce((a, s) => a + s.lbs, 0))}</b> lb delivered</span>
        <span><b>${clock(Math.max(0, S.shiftSec - S.breakSec))}</b> driving</span>
      </div>
      <button class="btn btn-ghost" id="home-resume" style="margin-top:13px">Review the summary</button>
    </div>`;
    $('#home-resume').onclick = openWrap;
  } else if (S.onShift && S.route) {
    const st = S.route.stops, done = st.filter(s => s.status === 'done').length;
    const next = S.activeStop;
    hero.innerHTML = `<div class="hero">
      <div class="hero-top" style="flex:1">
        <div style="flex:1">
          <div class="k">On shift · ${S.truck}</div>
          <h2>${next ? next.cust : 'All stops complete'}</h2>
        </div>
        <span class="pill">${S.paused ? 'Paused · ' + S.breakReason : 'Rolling'}</span>
      </div>
      <div class="ticks" id="home-ticks"></div>
      <div class="hero-line">
        <span><b>${done}/${st.length}</b> stops</span>
        <span><b>${nf(S.co2Now)}</b> lb on truck</span>
        <span><b>${clock(S.shiftSec)}</b> on shift</span>
      </div>
      <button class="btn btn-white" id="home-resume">
        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>${next ? 'Resume route' : 'Finish route'}</button>
    </div>`;
    const t = $('#home-ticks'), T = 26;
    for (let i = 0; i < T; i++) t.appendChild(el('i', 'tick'));
    const fullN = S.co2Start ? Math.round(S.co2Now / S.co2Start * T) : 0;
    [...t.children].forEach((n, i) => { n.className = 'tick' + (i < fullN ? ' full' : ''); });
    $('#home-resume').onclick = () => next ? enterActive('route') : (show('active'), openWrap());
  } else {
    hero.innerHTML = `<div class="hero off">
      <div class="hero-top">
        <div style="flex:1">
          <div class="k">Not clocked in</div>
          <h2>${TODAY.id} · ${TODAY.name.split(' · ')[1]}</h2>
        </div>
        <span class="pill">Off shift</span>
      </div>
      <div class="hero-line">
        <span><b>${TODAY.stops.length}</b> stops</span>
        <span><b>${nf(TODAY.stops.reduce((a, s) => a + s.expected, 0))}</b> lb planned</span>
        <span>${TODAY.window}</span>
      </div>
      <button class="btn btn-primary" id="home-start">
        <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 10.6V6h-2v7.4l5.2 3.1 1-1.7-4.2-2.2z"/></svg>
        Start today's route</button>
    </div>`;
    $('#home-start').onclick = startInspection;
  }

  /* today's numbers */
  const st = S.route ? S.route.stops.filter(s => s.status === 'done') : [];
  const lbs = st.reduce((a, s) => a + s.lbs, 0), cash = st.reduce((a, s) => a + s.cash, 0);
  $('#home-strip').innerHTML = `
    <div><div class="k">Stops</div><div class="v">${st.length}</div></div>
    <div><div class="k">CO₂</div><div class="v">${nf(lbs)}</div></div>
    <div><div class="k">Collected</div><div class="v">${money(cash)}</div></div>
    <div><div class="k">Miles</div><div class="v">${S.miles.toFixed(1)}</div></div>`;

  /* quick actions */
  const tiles = [
    { k: 'routes', c: 'var(--blue)', b: 'My route', s: "Today's manifest", d: 'M6.5 2a3.5 3.5 0 0 0-1 6.86V15a1 1 0 0 0 1 1H14a1.5 1.5 0 0 1 0 3H9.9a3.5 3.5 0 1 0 0 2H14a3.5 3.5 0 0 0 0-7H7.5V8.86A3.5 3.5 0 0 0 6.5 2zm11 8a3.5 3.5 0 0 0-3.5 3.5c0 2.4 3.5 6.5 3.5 6.5s3.5-4.1 3.5-6.5A3.5 3.5 0 0 0 17.5 10z' },
    { k: 'chat', c: 'var(--cyan)', b: 'Message dispatch', s: 'Reina O. is on shift', n: S.unread, d: 'M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM7 9h10v2H7V9zm7 5H7v-2h7v2zm3-6H7V6h10v2z' },
    { k: 'problem', c: 'var(--red)', b: 'Report problem', s: S.onShift ? 'Traffic, closure, capacity' : 'Available on shift', dim: !S.onShift, d: 'M12 2 1 21h22L12 2zm1 14h-2v2h2v-2zm0-7h-2v5h2V9z' },
    { k: 'profile', c: 'var(--slate)', b: 'Profile', s: 'Details, password, sign out', d: 'M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z' }
  ];
  const q = $('#home-quick'); q.innerHTML = '';
  tiles.forEach(t => {
    const b = el('button', 'tile' + (t.dim ? ' dim' : ''));
    b.innerHTML = `${t.n ? `<i class="n">${t.n}</i>` : ''}
      <div class="ic" style="background:${t.c}"><svg viewBox="0 0 24 24"><path d="${t.d}"/></svg></div>
      <b>${t.b}</b><small>${t.s}</small>`;
    b.onclick = () => {
      if (t.k === 'routes') { show('routes'); renderRoutes(); markHomeNav('routes'); }
      if (t.k === 'chat') enterActive('chat');
      if (t.k === 'profile') openProfile();
      if (t.k === 'problem') {
        if (!S.onShift) { toast('Clock in on a route first — dispatch needs to know where you are.', true); return; }
        enterActive('route'); openProblem();
      }
    };
    q.appendChild(b);
  });

  /* latest dispatch message */
  const last = [...S.msgs].reverse().find(m => m.who === 'them');
  $('#home-msg').innerHTML = last
    ? `<button class="row" id="home-msg-go">
         <div class="ic" style="background:var(--cyan-tint);color:var(--cyan)"><svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg></div>
         <div class="tx"><b>Reina O. · Dispatch</b><small>${last.text}</small></div><i class="chev"></i></button>`
    : `<div class="empty"><svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>
         <b>No messages yet</b><p>Dispatch will reach you here once your shift starts.</p></div>`;
  if ($('#home-msg-go')) $('#home-msg-go').onclick = () => enterActive('chat');

  /* rolling 7 days from the completed-route log */
  const w = PAST.reduce((a, r) => ({ lbs: a.lbs + r.lbs, cash: a.cash + r.cash, miles: a.miles + r.miles, stops: a.stops + r.stops }), { lbs: 0, cash: 0, miles: 0, stops: 0 });
  $('#home-week').innerHTML = `
    <div class="row"><div class="ic"><svg viewBox="0 0 24 24"><path d="M9 2h6a1 1 0 0 1 1 1v1.4a5 5 0 0 1 3 4.6v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9a5 5 0 0 1 3-4.6V3a1 1 0 0 1 1-1zm-1 8v9a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-9H8z"/></svg></div>
      <div class="tx"><b>${nf(w.lbs)} lb delivered</b><small>${PAST.length} routes · ${w.stops} stops</small></div></div>
    <div class="row"><div class="ic" style="background:var(--green-tint);color:var(--green)"><svg viewBox="0 0 24 24"><path d="M12 1v3.2C8.7 4.7 6 7.5 6 11a6 6 0 0 0 12 0h-2a4 4 0 1 1-4-4v3l4-4-4-4z"/></svg></div>
      <div class="tx"><b>${money(w.cash)} collected</b><small>${w.miles.toFixed(1)} miles driven</small></div></div>`;
}

/* enter the on-shift shell (chat is reachable off shift too) */
function enterActive(tab) {
  show('active'); setTab(tab || 'route');
  if (S.route) renderAll(); else { updateHeader(); renderChat(); }
}
$('#active-home').onclick = goHome;
$('#routes-home').onclick = goHome;
$('#home-avatar').onclick = openProfile;
$('#bell-home').onclick = () => requestAlerts(true);

/* ============================================================ 6. PROFILE */
function openProfile() { show('profile'); renderProfile(); markHomeNav('profile'); }
$('#prof-back').onclick = goHome;

function renderProfile() {
  $('#prof-initials').textContent = initials();
  $('#prof-name').textContent = fullName();
  $('#prof-role').textContent = `${USER.role} · since ${USER.since}`;
  $('#prof-sub').textContent = `${USER.id} · ${USER.depot.split(' · ')[0]}`;
  $('#prof-status').innerHTML = S.onShift
    ? `<span class="pill pill-cyan"><i class="dot"></i>On shift · ${S.route ? S.route.id : ''}</span>`
    : `<span class="pill pill-grey">Off shift</span>`;
  $('#p-first').value = USER.first; $('#p-last').value = USER.last;
  $('#p-phone').value = USER.phone; $('#p-email').value = USER.email;

  $('#prof-work').innerHTML = `
    <div class="row"><div class="ic"><svg viewBox="0 0 24 24"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"/></svg></div>
      <div class="tx"><b>Employee ID</b><small>Set by your depot</small></div><span class="val">${USER.id}</span></div>
    <div class="row"><div class="ic"><svg viewBox="0 0 24 24"><path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4z"/></svg></div>
      <div class="tx"><b>CDL &amp; endorsement</b><small>${USER.cdl} · expires ${USER.cdlExp}</small></div></div>
    <div class="row"><div class="ic"><svg viewBox="0 0 24 24"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-8 14H7v-2h4v2zm6-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg></div>
      <div class="tx"><b>Medical card</b><small>Expires ${USER.medExp}</small></div></div>
    <div class="row"><div class="ic"><svg viewBox="0 0 24 24"><path d="M18.9 6a1.5 1.5 0 0 0-1.4-1H6.5a1.5 1.5 0 0 0-1.4 1L3 12v8a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h12v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-8l-2.1-6z"/></svg></div>
      <div class="tx"><b>Default truck</b><small>${S.onShift ? 'Locked while you\'re on shift' : 'Pre-selected at clock-in'}</small></div>
      <span class="val">${S.onShift ? S.truck : USER.truck}</span></div>`;

  const P = USER.prefs;
  $('#prof-prefs').innerHTML = `
    ${prefRow('alerts', 'Dispatch alerts', 'Push when your route changes', P.alerts, 'M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm7-6v-5a7 7 0 0 0-5.5-6.83V3a1.5 1.5 0 0 0-3 0v1.17A7 7 0 0 0 5 11v5l-1.6 1.6a1 1 0 0 0 .7 1.7h15.8a1 1 0 0 0 .7-1.7L19 16z')}
    ${prefRow('aloud', 'Read messages aloud', 'Dispatch speaks while you drive', P.aloud, 'M4 9v6h4l5 5V4L8 9H4zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z')}
    ${prefRow('awake', 'Keep screen awake', 'Stops the display sleeping on route', P.awake, 'M12 6a6 6 0 1 0 6 6 6 6 0 0 0-6-6zm0-4v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4')}`;
  $$('#prof-prefs [data-pref]').forEach(r => r.onclick = () => togglePref(r.dataset.pref));

  $('#prof-sec').innerHTML = `
    <button class="row" id="row-pw">
      <div class="ic"><svg viewBox="0 0 24 24"><path d="M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9V6zm3 12a2 2 0 1 1 2-2 2 2 0 0 1-2 2z"/></svg></div>
      <div class="tx"><b>Change password</b><small>Last changed ${USER.pwChanged}</small></div><i class="chev"></i></button>
    <button class="row danger" id="row-out">
      <div class="ic"><svg viewBox="0 0 24 24"><path d="M10 17v-2H3v-2h7V7l5 5-5 5zm2-14h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7v-2h7V5h-7V3z"/></svg></div>
      <div class="tx"><b>Sign out</b><small>${S.onShift ? 'You\'re still clocked in' : 'Ends this session'}</small></div><i class="chev"></i></button>`;
  $('#row-pw').onclick = openPassword;
  $('#row-out').onclick = openSignout;
  $('#prof-cache').textContent = navigator.serviceWorker && navigator.serviceWorker.controller
    ? 'Offline cache active' : 'Offline cache unavailable in preview';
}
function prefRow(k, title, sub, on, d) {
  return `<button class="row" data-pref="${k}" role="switch" aria-checked="${on}">
    <div class="ic"><svg viewBox="0 0 24 24"><path d="${d}"/></svg></div>
    <div class="tx"><b>${title}</b><small>${sub}</small></div>
    <span class="sw${on ? ' on' : ''}"><i></i></span></button>`;
}

async function togglePref(k) {
  const P = USER.prefs;
  if (k === 'alerts') {
    if (!P.alerts) { const ok = await requestAlerts(false); P.alerts = ok; if (!ok) { renderProfile(); return; } }
    else P.alerts = false;
    toast(P.alerts ? 'Dispatch alerts on.' : 'Dispatch alerts off.');
  }
  if (k === 'aloud') {
    if (!('speechSynthesis' in window)) { toast('This browser can\'t read messages aloud.', true); return; }
    P.aloud = !P.aloud; S.tts = P.aloud;
    $('#tog-tts').classList.toggle('on', S.tts);
    $('#tog-tts').setAttribute('aria-pressed', S.tts);
    toast(P.aloud ? 'Dispatch messages will be read aloud.' : 'Read aloud off.');
  }
  if (k === 'awake') {
    const ok = await setWake(!P.awake);
    P.awake = ok;
    toast(ok ? 'Screen stays awake while the app is open.' : 'This browser can\'t hold the screen awake.', !ok);
  }
  renderProfile();
}

/* Screen Wake Lock — genuinely useful in a mounted cab */
let wakeLock = null;
async function setWake(on) {
  if (!('wakeLock' in navigator)) return false;
  try {
    if (on) { wakeLock = await navigator.wakeLock.request('screen'); return true; }
    if (wakeLock) { await wakeLock.release(); wakeLock = null; }
    return false;
  } catch (e) { return false; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && USER.prefs.awake && !wakeLock) setWake(true);
});

/* save personal details */
$('#btn-save-profile').onclick = () => {
  const f = $('#p-first').value.trim(), l = $('#p-last').value.trim();
  const ph = $('#p-phone').value.trim(), em = $('#p-email').value.trim();
  $$('#s-profile .field').forEach(x => x.classList.remove('err'));
  if (!f || !l) { fieldErr('#p-perr', 'Your name can\'t be blank.'); $('#p-first').closest('.field').classList.add('err'); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { fieldErr('#p-perr', 'That email address isn\'t valid.'); $('#p-email').closest('.field').classList.add('err'); return; }
  if (ph.replace(/\D/g, '').length < 10) { fieldErr('#p-perr', 'Enter a 10-digit mobile number.'); $('#p-phone').closest('.field').classList.add('err'); return; }
  fieldErr('#p-perr', '');
  Object.assign(USER, { first: f, last: l, phone: ph, email: em });
  renderProfile();
  toast('Profile updated.');
};

/* ============================================================ CHANGE PASSWORD */
const PW_REQS = [
  { t: 'At least 8 characters', f: v => v.length >= 8 },
  { t: 'A number', f: v => /\d/.test(v) },
  { t: 'A letter', f: v => /[a-zA-Z]/.test(v) },
  { t: 'Different from your current one', f: v => v.length > 0 && v !== USER.pw }
];
function openPassword() {
  ['pw-cur', 'pw-new', 'pw-conf'].forEach(id => { $('#' + id).value = ''; $('#' + id).type = 'password'; });
  $$('#sheet-password .rev').forEach(b => b.textContent = 'Show');
  $$('#sheet-password .field').forEach(f => f.classList.remove('err'));
  fieldErr('#pw-err', '');
  scorePassword();
  sheet('#sheet-password');
}
function scorePassword() {
  const v = $('#pw-new').value;
  const pass = PW_REQS.map(r => r.f(v));
  $('#pw-reqs').innerHTML = PW_REQS.map((r, i) =>
    `<div class="req${pass[i] ? ' ok' : ''}"><i><svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg></i>${r.t}</div>`).join('');
  let n = pass.filter(Boolean).length;
  if (v.length >= 12) n++;
  if (/[^a-zA-Z0-9]/.test(v)) n++;
  const pct = v ? Math.min(100, n / 6 * 100) : 0;
  const lvl = pct >= 84 ? ['Strong', 'var(--green)'] : pct >= 50 ? ['Fair', 'var(--amber)'] : ['Weak', 'var(--red)'];
  $('#pw-meter').style.width = pct + '%';
  $('#pw-meter').style.background = v ? lvl[1] : 'transparent';
  $('#pw-strength').textContent = v ? lvl[0] : 'Strength';
  $('#pw-strength').style.color = v ? lvl[1] : 'var(--mute)';
  return pass.every(Boolean);
}
$('#pw-new').addEventListener('input', scorePassword);

$('#btn-save-pw').onclick = () => {
  const cur = $('#pw-cur').value, nw = $('#pw-new').value, cf = $('#pw-conf').value;
  $$('#sheet-password .field').forEach(f => f.classList.remove('err'));
  if (cur !== USER.pw) {
    fieldErr('#pw-err', 'That\'s not your current password. Demo password is “driver123”.');
    $('#pw-cur').closest('.field').classList.add('err'); return;
  }
  if (!scorePassword()) {
    fieldErr('#pw-err', 'Your new password doesn\'t meet all the requirements yet.');
    $('#pw-new').closest('.field').classList.add('err'); return;
  }
  if (nw !== cf) {
    fieldErr('#pw-err', 'The two new passwords don\'t match.');
    $('#pw-conf').closest('.field').classList.add('err'); return;
  }
  USER.pw = nw; USER.pwChanged = 'just now';
  closeSheet(); renderProfile();
  toast('Password updated. Other devices signed out.');
  notify('Password changed', 'Your Driver App password was updated just now.');
};

/* ============================================================ SIGN OUT */
function openSignout() {
  $('#so-sub').textContent = S.onShift
    ? 'Your shift keeps running on dispatch\'s board.'
    : 'You\'ll need your password to get back in.';
  $('#so-body').innerHTML = (S.onShift ? `
    <div class="banner paused" style="margin-bottom:14px">
      <span>⏱</span><span><b>You're still clocked in</b>
      ${S.route.id} has ${S.route.stops.filter(s => s.status === 'current' || s.status === 'pending').length} stops left.
      Finish the route and clock out first if your shift is over.</span></div>` : '') + `
    <div class="row" style="background:var(--panel);border-radius:var(--r-lg);border:1px solid var(--line)">
      <div class="ic">${initials()}</div>
      <div class="tx"><b>${fullName()}</b><small>${USER.id} · ${USER.email}</small></div></div>
    <p class="hint" style="margin-top:14px">Anything not yet sent to dispatch stays queued on this device until you sign back in.</p>`;
  const ic = $('#so-body .ic');
  if (ic) { ic.style.font = '700 15px var(--display)'; ic.style.letterSpacing = '.04em'; }
  sheet('#sheet-signout');
}
$('#btn-do-signout').onclick = () => {
  clearInterval(tick);
  if (watchId != null && navigator.geolocation) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  clearInterval(simTimer); simTimer = null; resetLeg();
  try { if (rec) rec.stop(); } catch (e) {}
  try { speechSynthesis.cancel(); } catch (e) {}
  setWake(false);
  Object.assign(S, {
    authed: false, onShift: false, route: null, activeStop: null, paused: false,
    shiftSec: 0, breakSec: 0, breakReason: '', miles: 0, doneOpen: false, routeDone: false,
    problems: [], msgs: [], unread: 0, tts: false, hands: false,
    geo: { lat: null, lng: null, acc: null, speed: 0, ok: false }
  });
  lastFix = null;
  USER.prefs.aloud = false; USER.prefs.awake = false;
  $('#tog-tts').classList.remove('on'); $('#tog-hands').classList.remove('on');
  TODAY.stops.forEach(s => { s.status = 'pending'; s.lbs = 0; s.cash = 0; s.notes = ''; s.at = null; });
  TODAY.status = 'ready';
  $('#banners').dataset.alert = '';
  $$('[data-chk]').forEach(i => i.checked = false);
  $('#btn-clockin').disabled = true;
  closeSheet();
  $('#l-pass').value = '';
  fieldErr('#l-err', '');
  show('login');
  toast('Signed out.');
};

/* shared alert-permission request */
function requestAlerts(loud) {
  return new Promise(res => {
    if (!('Notification' in window)) { toast('This browser doesn\'t support alerts.', true); return res(false); }
    if (Notification.permission === 'granted') {
      USER.prefs.alerts = true;
      if (loud) { notify('Dispatch alerts are on', 'You\'ll get a push when your route changes.'); toast('Alerts already on.'); }
      return res(true);
    }
    if (Notification.permission === 'denied') {
      toast('Alerts are blocked — turn them on in your browser settings.', true); return res(false);
    }
    Notification.requestPermission().then(p => {
      const ok = p === 'granted';
      USER.prefs.alerts = ok;
      $('#bell-home').classList.toggle('on', ok);
      $('#bell-routes').classList.toggle('on', ok);
      if (loud) toast(ok ? 'Dispatch alerts on.' : 'Alerts blocked — turn them on in browser settings.', !ok);
      res(ok);
    }).catch(() => res(false));
  });
}

/* ============================================================ PWA */
const ICON = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="42" fill="#0D6EFD"/><path fill="#fff" d="M72 32h48a8 8 0 0 1 8 8v11a40 40 0 0 1 24 37v67a24 24 0 0 1-24 24H64a24 24 0 0 1-24-24V88a40 40 0 0 1 24-37V40a8 8 0 0 1 8-8zm-8 64v67a8 8 0 0 0 8 8h56a8 8 0 0 0 8-8V96H64z"/></svg>`);

(function manifest() {
  const m = {
    name: 'Driver App — CO₂ Route', short_name: 'Driver', start_url: '.', scope: '.',
    display: 'standalone', orientation: 'portrait', background_color: '#0D6EFD', theme_color: '#0D6EFD',
    description: 'Route, deliveries and dispatch comms for CO₂ delivery drivers.',
    icons: [{ src: ICON, sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' }]
  };
  try {
    const link = document.querySelector('link[rel=manifest]');
    const inline = () => { link.href = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/manifest+json' })); };
    fetch(link.href, { method: 'HEAD' }).then(r => { if (!r.ok) inline(); }).catch(inline);
  } catch (e) {}
})();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {/* preview sandbox: offline cache unavailable */ });
  });
}

/* ============================================================ BOOT */
renderRoutes();
renderChecklist();
buildHomeNav();
show('login');
setTimeout(() => $('#splash').classList.add('off'), 900);
})();
