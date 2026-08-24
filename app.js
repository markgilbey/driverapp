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

const ROUTES = [
  {
    id: 'RT-4471', name: 'Riverside · Midtown loop', day: 'Today · 06:40 start', status: 'progress', truck: 'TRK-001',
    stops: [
      stopSeed('a1', 1, 'Hopwright Brewing', '1412 R St', 'Sacramento, CA 95811', 600, 'Invoice', '07:00–09:00', 38.5701, -121.4790, 'Dock in rear alley. Ring bell twice.'),
      stopSeed('a2', 2, 'El Farolito Taqueria', '2210 J St', 'Sacramento, CA 95816', 300, 'Cash', '08:00–10:30', 38.5760, -121.4700, ''),
      stopSeed('a3', 3, 'Riverside Sports Bar', '890 Front St', 'Sacramento, CA 95814', 400, 'Card on file', '09:00–12:00', 38.5820, -121.5040, 'Basement tank — bring the 25 ft hose.'),
      stopSeed('a4', 4, 'Cinema Grill 12', '55 Capitol Mall', 'Sacramento, CA 95814', 500, 'Invoice', '10:00–13:00', 38.5790, -121.5010, '')
    ]
  },
  {
    id: 'RT-4472', name: 'Northline · Beverage accounts', day: 'Today · 07:15 start', status: 'ready', truck: 'TRK-001',
    stops: [
      stopSeed('b1', 1, 'Northline Beverage Depot', '3300 Arden Way', 'Sacramento, CA 95825', 800, 'Invoice', '07:30–09:00', 38.6010, -121.4180, 'Gate code 4471. Ask for Dee at receiving.'),
      stopSeed('b2', 2, 'Two Rivers Cider Co.', '4311 Attie Ct', 'Sacramento, CA 95822', 600, 'Invoice', '08:00–10:00', 38.5250, -121.4930, ''),
      stopSeed('b3', 3, 'Mahoney\'s Public House', '1201 Alhambra Blvd', 'Sacramento, CA 95816', 400, 'Cash', '09:30–11:30', 38.5705, -121.4630, 'Tight alley — back in from Alhambra only.'),
      stopSeed('b4', 4, 'Sunrise Wing House', '6210 Sunrise Blvd', 'Citrus Heights, CA 95610', 300, 'Cash', '10:30–13:00', 38.6890, -121.2740, ''),
      stopSeed('b5', 5, 'Delta Fountain Supply', '780 Riverside Blvd', 'Sacramento, CA 95818', 900, 'Card on file', '11:30–15:00', 38.5480, -121.5060, 'Two tanks. Check both fittings for frost.')
    ]
  }
];
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
  paused: false, shiftSec: 0, miles: 0,
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

/* ============================================================ 1a. ROUTES */
function renderRoutes() {
  const today = $('#routes-today'); today.innerHTML = '';
  ROUTES.forEach(r => {
    const done = r.stops.filter(s => s.status === 'done').length;
    const pct = Math.round(done / r.stops.length * 100);
    const lbs = r.stops.reduce((a, s) => a + s.expected, 0);
    const pill = r.status === 'progress'
      ? '<span class="pill pill-cyan"><i class="dot"></i>In progress</span>'
      : '<span class="pill pill-blue">Ready</span>';
    const b = el('button', 'route-item');
    b.innerHTML = `
      <div class="route-top"><span class="route-code">${r.id}</span>${pill}</div>
      <div class="route-name">${r.name}</div>
      <div class="route-meta">
        <span><b>${done}/${r.stops.length}</b> stops</span>
        <span><b>${nf(lbs)}</b> lb planned</span>
        <span>${r.day}</span>
      </div>
      <div class="mini-bar"><i style="width:${pct}%"></i></div>`;
    b.onclick = () => selectRoute(r);
    today.appendChild(b);
  });

  const past = $('#routes-past'); past.innerHTML = '';
  PAST.forEach(r => {
    const b = el('button', 'route-item');
    b.innerHTML = `
      <div class="route-top"><span class="route-code">${r.id}</span><span class="pill pill-green"><i class="dot"></i>Completed</span></div>
      <div class="route-name">${r.name}</div>
      <div class="route-meta">
        <span><b>${r.stops}/${r.stops}</b> stops</span>
        <span><b>${nf(r.lbs)}</b> lb</span>
        <span><b>${money(r.cash)}</b></span>
        <span>${r.day}</span>
      </div>
      <div class="mini-bar done"><i style="width:100%"></i></div>`;
    b.onclick = () => {
      $('#past-title').textContent = r.id;
      $('#past-sub').textContent = `${r.name} · ${r.day}`;
      $('#past-body').innerHTML = `
        <div class="metrics">
          <div class="metric"><div class="k">Driving time</div><div class="v">${r.time}</div></div>
          <div class="metric"><div class="k">Mileage</div><div class="v">${r.miles}<span class="u">mi</span></div></div>
          <div class="metric green"><div class="k">Money collected</div><div class="v">${money(r.cash)}</div></div>
          <div class="metric blue"><div class="k">CO₂ delivered</div><div class="v">${nf(r.lbs)}<span class="u">lb</span></div></div>
        </div>
        <p class="hint" style="margin-top:14px">Submitted to dispatch ${r.day} · reviewed and closed.</p>`;
      sheet('#sheet-past');
    };
    past.appendChild(b);
  });
}

function selectRoute(r) {
  S.route = r;
  if (r.status === 'progress') {           // resume mid-shift
    r.stops[0].status = 'done';
    r.stops[0].lbs = 600; r.stops[0].cash = 0;
    r.stops[0].at = new Date(Date.now() - 52 * 60000);
    S.co2Start = 4200; S.co2Now = 3600; S.shiftSec = 4520; S.miles = 12.4;
    S.truck = r.truck;
    advance(); startShift(true);
  } else {
    $('#inspect-route').textContent = `${r.id} · ${r.name.split(' · ')[0]} · ${r.stops.length} stops`;
    show('inspect');
  }
}

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
  S.truck = $('#f-truck').value;
  S.fuel = +$('#f-fuel').value || 0;
  S.co2Start = S.co2Now = +$('#f-co2').value || 0;
  S.shiftSec = 0; S.miles = 0;
  advance(); startShift(false);
  askNotifications();
};

/* ============================================================ SHIFT */
let tick;
function startShift(resume) {
  S.onShift = true;
  show('active'); setTab('route');
  renderAll();
  clearInterval(tick);
  tick = setInterval(() => {
    if (S.paused || !S.onShift) return;
    S.shiftSec++;
    if (S.shiftSec % 3 === 0 && !S.geo.ok) S.miles += 0.011;   // fallback odometer
    if (S.shiftSec % 5 === 0) updateHeader();
  }, 1000);
  startGeo();
  if (resume) {
    pushMsg('them', 'Morning Marcus — Hopwright signed for 600. Four stops left, you\'re about 12 minutes ahead.');
  } else {
    pushMsg('them', `You're clocked in on ${S.truck}. Northline Depot is expecting you first — gate code is 4471.`);
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
function renderAll() { updateHeader(); renderStops(); renderProblems(); renderChat(); renderMap(); }

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
  const paused = S.paused ? `<div class="banner paused"><span>⏸</span><span><b>Route paused</b>Shift timer stopped. Dispatch has been notified.</span></div>` : '';
  w.innerHTML = paused + (w.dataset.alert || '');
}

function renderStops() {
  if (!S.route) return;
  const wrap = $('#stops'); wrap.innerHTML = '';
  S.route.stops.forEach(s => {
    const d = el('div', 'stop ' + s.status);
    const node = s.status === 'done'
      ? `<div class="node"><svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg></div>`
      : `<div class="node">${s.seq}</div>`;
    let body = '';
    if (s.status === 'done') {
      body = `
        <div class="stop-head"><div class="cust">${s.cust}</div>
          <span class="pill pill-green"><i class="dot"></i>Delivered</span></div>
        <div class="addr">${s.addr}</div>
        <div class="readout">
          <div><div class="k">CO₂ delivered</div><div class="v green">${nf(s.lbs)} <span style="font-size:12px;color:var(--mute)">LB</span></div></div>
          <div><div class="k">${s.pay === 'Cash' ? 'Cash collected' : 'Payment'}</div>
               <div class="v">${s.cash > 0 ? money(s.cash) : `<span style="font-size:14px;color:var(--slate)">${s.pay}</span>`}</div></div>
        </div>
        ${s.notes ? `<div class="stop-note">${s.notes}</div>` : ''}
        <div class="stop-tags"><span class="pill pill-grey">${s.at ? hhmm(s.at) : ''}</span></div>`;
    } else if (s.status === 'skipped') {
      body = `
        <div class="stop-head"><div class="cust">${s.cust}</div>
          <span class="pill pill-amber"><i class="dot"></i>Skipped</span></div>
        <div class="addr">${s.addr}</div>
        <div class="stop-note">${s.notes || 'Site closed or delivery declined. Dispatch will reschedule.'}</div>`;
    } else if (s.status === 'current') {
      body = `
        <div class="stop-head">
          <div class="cust">${s.cust}</div>
          <span class="pill pill-cyan"><i class="dot"></i>Current stop</span>
        </div>
        <div class="addr">${s.addr}<br>${s.city}</div>
        <div class="stop-tags">
          <span class="pill pill-grey">Window ${s.win}</span>
          <span class="pill pill-grey">${s.expected} lb expected</span>
          <span class="pill ${s.pay === 'Cash' ? 'pill-amber' : 'pill-grey'}">${s.pay}</span>
        </div>
        ${s.note ? `<div class="stop-note">📍 ${s.note}</div>` : ''}
        <button class="btn btn-cyan" data-deliver="${s.id}">
          <svg viewBox="0 0 24 24"><path d="M19 7h-3V5.5A2.5 2.5 0 0 0 13.5 3h-3A2.5 2.5 0 0 0 8 5.5V7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zm-9-1.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V7h-4V5.5zM13 15h-2v2H9v-2H7v-2h2v-2h2v2h2v2z"/></svg>
          Record delivery
        </button>`;
    } else {
      body = `
        <div class="stop-head"><div class="cust">${s.cust}</div><span class="eta">${s.win.split('–')[0]}</span></div>
        <div class="addr">${s.addr} · ${s.expected} lb</div>`;
    }
    d.innerHTML = node + `<div class="stop-card">${body}</div>`;
    wrap.appendChild(d);
  });

  // finish CTA
  const left = S.route.stops.some(s => s.status === 'current' || s.status === 'pending');
  const fw = $('#finish-wrap');
  fw.innerHTML = left ? '' :
    `<button class="btn btn-green btn-xl" id="btn-finish" style="margin-top:18px">
      <svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>Finish route</button>`;
  if (!left) $('#btn-finish').onclick = openWrap;
  $('#btn-next').disabled = !S.activeStop;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-deliver]');
  if (b) openDelivery(S.route.stops.find(s => s.id === b.dataset.deliver));
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
  $('#d-lbs').value = stop.expected;
  $('#d-expect').textContent = `Expected ${stop.expected} lb · tank has ${nf(S.co2Now)} lb`;
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

$('#btn-save-delivery').onclick = () => {
  const s = S.activeStop; if (!s) return;
  const lbs = +$('#d-lbs').value || 0;
  const cash = +$('#d-cash').value || 0;
  if (lbs <= 0) { toast('Enter the pounds delivered to save this stop.', true); $('#d-lbs').focus(); return; }
  if (lbs > S.co2Now) { toast(`Only ${nf(S.co2Now)} lb left on the truck.`, true); return; }
  s.lbs = lbs; s.cash = cash; s.notes = $('#d-notes').value.trim(); s.status = 'done'; s.at = new Date();
  S.co2Now = Math.max(0, S.co2Now - lbs);
  advance(); closeSheet(); renderAll();
  toast(`${s.cust} delivered — ${nf(lbs)} lb${cash ? ', ' + money(cash) + ' collected' : ''}.`);
  if (S.activeStop) setTimeout(() => {
    pushMsg('them', `Logged ${nf(lbs)} lb at ${s.cust}. Next up: ${S.activeStop.cust}.`, true);
  }, 2600);
};

/* ============================================================ 4. PROBLEMS */
const ISSUES = [
  { k: 'traffic', t: 'Traffic or breakdown', d: 'You are delayed or the truck is down', c: 'var(--red)', ic: 'M18.9 6a1.5 1.5 0 0 0-1.4-1H6.5a1.5 1.5 0 0 0-1.4 1L3 12v8a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-1h12v1a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-8l-2.1-6zM6.5 16A1.5 1.5 0 1 1 8 14.5 1.5 1.5 0 0 1 6.5 16zm11 0a1.5 1.5 0 1 1 1.5-1.5 1.5 1.5 0 0 1-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z', f: 'delay' },
  { k: 'closed', t: 'Site closed or declined', d: 'Nobody on site, or they refused delivery', c: '#8A5C00', ic: 'M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z', f: 'skip' },
  { k: 'capacity', t: 'Extra tank capacity left', d: 'You have room for another drop today', c: 'var(--cyan)', ic: 'M9 2h6a1 1 0 0 1 1 1v1.4a5 5 0 0 1 3 4.6v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9a5 5 0 0 1 3-4.6V3a1 1 0 0 1 1-1zm-1 8v9a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-9H8z', f: 'capacity' }
];

function openProblem() {
  S.pickedIssue = null;
  $('#btn-send-problem').disabled = true;
  const b = $('#prob-body'); b.innerHTML = '';
  ISSUES.forEach(i => {
    const btn = el('button', 'issue');
    btn.dataset.issue = i.k;
    btn.innerHTML = `<div class="issue-ic" style="background:${i.c}"><svg viewBox="0 0 24 24"><path d="${i.ic}"/></svg></div>
                     <div><b>${i.t}</b><p>${i.d}</p></div>`;
    btn.onclick = () => pickIssue(i);
    b.appendChild(btn);
  });
  b.appendChild(el('div', '', '<div id="issue-detail"></div>'));
  sheet('#sheet-problem');
}
$('#btn-problem').onclick = openProblem;
$('#btn-problem-2').onclick = openProblem;

function pickIssue(i) {
  S.pickedIssue = i;
  $$('.issue').forEach(b => b.classList.toggle('sel', b.dataset.issue === i.k));
  $('#btn-send-problem').disabled = false;
  const cur = S.activeStop;
  let extra = '';
  if (i.f === 'delay') extra = `
    <label class="field big"><span>Delay estimate</span>
      <input id="p-delay" type="number" inputmode="numeric" value="25" min="0"><i class="unit">MIN</i></label>`;
  if (i.f === 'skip') extra = `
    <div class="field locked"><span>Stop affected</span>
      <div style="font-size:17px;font-weight:600;padding-top:2px">${cur ? cur.cust : 'No active stop'}</div></div>
    <p class="hint">Sending this marks the stop skipped and moves you to the next one.</p>`;
  if (i.f === 'capacity') extra = `
    <label class="field big"><span>Capacity remaining</span>
      <input id="p-cap" type="number" inputmode="numeric" value="${Math.max(0, S.co2Now - S.route.stops.filter(s => s.status !== 'done' && s.status !== 'skipped').reduce((a, s) => a + s.expected, 0))}" min="0"><i class="unit">LBS</i></label>
    <p class="hint">Dispatch can slot an extra account onto your route with this.</p>`;
  $('#issue-detail').innerHTML = `<div class="sect"><span class="eyebrow">Details</span><hr></div>${extra}
    <label class="field"><span>Note to dispatch <i style="text-transform:none;letter-spacing:0;font-weight:400">(optional)</i></span>
      <textarea id="p-note" rows="3" placeholder="What's happening?"></textarea></label>`;
  $('#issue-detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

$('#btn-send-problem').onclick = () => {
  const i = S.pickedIssue; if (!i) return;
  const note = ($('#p-note') || {}).value || '';
  let detail = note.trim();
  if (i.f === 'delay') { const m = +($('#p-delay') || {}).value || 0; detail = `Running ${m} min behind.` + (detail ? ' ' + detail : ''); }
  if (i.f === 'capacity') { const c = +($('#p-cap') || {}).value || 0; detail = `${nf(c)} lb of capacity free.` + (detail ? ' ' + detail : ''); }
  if (i.f === 'skip' && S.activeStop) {
    const s = S.activeStop;
    s.status = 'skipped'; s.notes = detail || 'Site closed on arrival.';
    detail = `${s.cust} — ` + (detail || 'site closed on arrival.');
    advance();
  }
  S.problems.unshift({ k: i.k, t: i.t, c: i.c, ic: i.ic, detail: detail || 'No extra detail.', at: new Date() });
  closeSheet(); renderAll();
  toast('Sent to dispatch.');
  notify('Dispatch notified', i.t);
  setTimeout(() => {
    let reply = 'Copy that — logged on my board.';
    if (i.f === 'delay') reply = 'Copy. I pushed your last two windows back 30 minutes and called ahead.';
    if (i.f === 'skip') reply = 'Got it, I\'ll reschedule them for Thursday. Roll to the next stop.';
    if (i.f === 'capacity') reply = 'Nice — adding Delta Fountain Supply to your route. Details coming through.';
    pushMsg('them', reply, true);
    if (i.f !== 'skip') routeAlert(i.f === 'capacity' ? 'Route updated — one stop added' : 'Route re-optimized around your delay');
  }, 3200);
};

function renderProblems() {
  const w = $('#problems-list');
  const badge = $('#badge-prob');
  badge.hidden = !S.problems.length; badge.textContent = S.problems.length;
  if (!S.problems.length) {
    w.innerHTML = `<div class="empty">
      <svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
      <b>No problems reported</b><p>Traffic, a closed site, or spare tank capacity — log it here and dispatch reworks your route.</p></div>`;
    return;
  }
  w.innerHTML = '';
  S.problems.forEach(p => {
    w.appendChild(el('div', 'prob', `
      <div class="prob-ic" style="background:${p.c}"><svg viewBox="0 0 24 24"><path d="${p.ic}"/></svg></div>
      <div style="flex:1"><b>${p.t}</b><p>${p.detail}</p>
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
  setTimeout(() => {
    const r = /where|eta|how far/i.test(v) ? 'I can see you on the board — you\'re good on time.'
      : /help|stuck|problem/i.test(v) ? 'Tell me what you need. I can send road service or move the stop.'
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
  r.onstart = () => { S.recording = true; $('#btn-mic').classList.add('rec'); };
  r.onend = () => {
    S.recording = false; $('#btn-mic').classList.remove('rec');
    if (S.hands && $('#chat-input').value.trim()) sendChat();
    else if (S.hands) setTimeout(() => { try { r.start(); } catch (e) {} }, 700);
  };
  r.onerror = ev => {
    S.recording = false; $('#btn-mic').classList.remove('rec');
    toast(ev.error === 'not-allowed' ? 'Microphone blocked. Allow mic access to dictate.' : 'Didn\'t catch that — try again.', true);
    S.hands = false; $('#tog-hands').classList.remove('on');
  };
  r.onresult = e => {
    let s = '';
    for (let i = e.resultIndex; i < e.results.length; i++) s += e.results[i][0].transcript;
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
  pushMsg('them', 'Heads up — accident on the 80 westbound. I re-sequenced your last two stops.', true);
  routeAlert('Route re-optimized — check your stop order');
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

/* ============================================================ GEOLOCATION */
let watchId = null, lastFix = null;
const R_EARTH = 3958.8;
function haversine(a, b) {
  const rad = d => d * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.sqrt(x));
}
function startGeo() {
  if (!('geolocation' in navigator)) { $('#gps-note').textContent = 'This device has no location services. Mileage is estimated.'; seedGeo(); return; }
  watchId = navigator.geolocation.watchPosition(pos => {
    const { latitude: lat, longitude: lng, accuracy: acc, speed } = pos.coords;
    if (lastFix) {
      const d = haversine(lastFix, { lat, lng });
      if (d < 2) S.miles += d;                        // ignore GPS jumps
    }
    lastFix = { lat, lng };
    S.geo = { lat, lng, acc, speed: speed ? speed * 2.23694 : 0, ok: true };
    renderMap();
  }, err => {
    S.geo.ok = false;
    $('#gps-note').textContent = err.code === 1
      ? 'Location is blocked. Allow it in your browser to track mileage and distance to the next stop.'
      : 'Waiting for a GPS fix — mileage is estimated until then.';
    seedGeo();
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 });
}
function seedGeo() {           // demo position so the map is never empty
  const s = S.route && S.route.stops[0];
  if (s && S.geo.lat == null) { S.geo.lat = s.lat - 0.012; S.geo.lng = s.lng - 0.014; }
  renderMap();
}

function renderMap() {
  if (!S.route) return;
  const svg = $('#map-svg'), pts = S.route.stops.map(s => ({ lat: s.lat, lng: s.lng, s }));
  const me = S.geo.lat != null ? { lat: S.geo.lat, lng: S.geo.lng } : null;
  const all = me ? pts.concat([me]) : pts;
  const lats = all.map(p => p.lat), lngs = all.map(p => p.lng);
  const pad = 0.02;
  const minLat = Math.min(...lats) - pad, maxLat = Math.max(...lats) + pad;
  const minLng = Math.min(...lngs) - pad, maxLng = Math.max(...lngs) + pad;
  const X = p => 26 + (p.lng - minLng) / (maxLng - minLng || 1) * 308;
  const Y = p => 300 - (p.lat - minLat) / (maxLat - minLat || 1) * 270;

  let g = '<defs><pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">'
    + '<path d="M30 0H0v30" fill="none" stroke="#D3DEE6" stroke-width="1"/></pattern></defs>'
    + '<rect width="360" height="330" fill="url(#grid)"/>';
  const path = pts.map(p => `${X(p)},${Y(p)}`).join(' ');
  g += `<polyline points="${path}" fill="none" stroke="#B9C9D6" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round"/>`;
  pts.forEach(p => {
    const c = p.s.status === 'done' ? '#2E7D32' : p.s.status === 'current' ? '#0288D1' : p.s.status === 'skipped' ? '#F9A825' : '#8A9AA8';
    const r = p.s.status === 'current' ? 15 : 12;
    if (p.s.status === 'current') g += `<circle cx="${X(p)}" cy="${Y(p)}" r="7" fill="#0288D1" class="ping"/>`;
    g += `<circle cx="${X(p)}" cy="${Y(p)}" r="${r}" fill="${c}" stroke="#fff" stroke-width="3"/>`
      + `<text x="${X(p)}" y="${Y(p) + 5}" text-anchor="middle" font-family="Barlow Semi Condensed,sans-serif" font-size="14" font-weight="700" fill="#fff">${p.s.seq}</text>`;
  });
  if (me) {
    g += `<circle cx="${X(me)}" cy="${Y(me)}" r="16" fill="#1976D2" opacity=".18"/>`
      + `<circle cx="${X(me)}" cy="${Y(me)}" r="8" fill="#1976D2" stroke="#fff" stroke-width="3"/>`;
  }
  svg.innerHTML = g;

  const cur = S.activeStop;
  $('#map-badge').textContent = S.geo.ok ? 'Live GPS' : (S.geo.lat != null ? 'Last known' : 'Locating…');
  $('#gps-lat').textContent = S.geo.lat != null ? S.geo.lat.toFixed(5) : '—';
  $('#gps-lng').textContent = S.geo.lng != null ? S.geo.lng.toFixed(5) : '—';
  $('#gps-speed').textContent = S.geo.ok ? Math.round(S.geo.speed) + ' mph' : '—';
  $('#gps-dist').textContent = (cur && S.geo.lat != null) ? haversine(S.geo, cur).toFixed(1) + ' mi' : '—';
}
$('#btn-recenter').onclick = () => { renderMap(); toast(S.geo.ok ? 'Centered on your live position.' : 'No GPS fix yet.', !S.geo.ok); };
$('#btn-navigate').onclick = launchNav;
$('#btn-next').onclick = launchNav;
function launchNav() {
  const s = S.activeStop;
  if (!s) { toast('No stop left to navigate to.', true); return; }
  const dest = encodeURIComponent(`${s.addr}, ${s.city}`);
  const from = S.geo.lat != null ? `&origin=${S.geo.lat},${S.geo.lng}` : '';
  toast(`Navigating to ${s.cust}.`);
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}${from}&travelmode=driving`, '_blank', 'noopener');
}

/* ============================================================ PAUSE */
$('#btn-pause').onclick = e => {
  S.paused = !S.paused;
  const b = e.currentTarget;
  b.classList.toggle('on', S.paused);
  b.setAttribute('aria-pressed', S.paused);
  b.setAttribute('aria-label', S.paused ? 'Resume route' : 'Pause route');
  $('#pause-ic').innerHTML = S.paused ? '<path d="M8 5v14l11-7z"/>' : '<path d="M8 5h3v14H8zm5 0h3v14h-3z"/>';
  renderBanners();
  toast(S.paused ? 'Route paused — timer stopped.' : 'Back on the clock.');
  if (S.paused) pushMsg('them', 'Route paused on my board. Ping me when you roll again.');
};

/* ============================================================ TABS */
function setTab(t) {
  if (!S.route && t !== 'chat') { toast('Start a route to use that.', true); goHome(); return; }
  S.tab = t;
  $('#tab-route').style.display = t === 'route' ? '' : 'none';
  $('#tab-map').style.display = t === 'map' ? '' : 'none';
  $('#tab-chat').style.display = t === 'chat' ? 'flex' : 'none';
  $('#tab-problems').style.display = t === 'problems' ? '' : 'none';
  $('#topbar-active').classList.toggle('plain', t !== 'route');
  $('#topbar-active').querySelector('.gauge').style.display = (t === 'route' && S.route) ? '' : 'none';
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  if (t === 'chat') { S.unread = 0; updateBadge(); renderChat(); }
  if (t === 'map') renderMap();
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
  $('#w-time').textContent = clock(S.shiftSec);
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
  notify('Shift submitted', 'Your route sheet is with dispatch. See you tomorrow.');
  toast('Clocked out — route sheet sent to dispatch.');
  setTimeout(() => {
    S.onShift = false; S.paused = false;
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
  { k: 'routes', l: 'Routes', d: 'M6.5 2a3.5 3.5 0 0 0-1 6.86V15a1 1 0 0 0 1 1H14a1.5 1.5 0 0 1 0 3H9.9a3.5 3.5 0 1 0 0 2H14a3.5 3.5 0 0 0 0-7H7.5V8.86A3.5 3.5 0 0 0 6.5 2zm11 8a3.5 3.5 0 0 0-3.5 3.5c0 2.4 3.5 6.5 3.5 6.5s3.5-4.1 3.5-6.5A3.5 3.5 0 0 0 17.5 10z' },
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
  if (S.onShift && S.route) {
    const st = S.route.stops, done = st.filter(s => s.status === 'done').length;
    const next = S.activeStop;
    hero.innerHTML = `<div class="hero">
      <div class="hero-top" style="flex:1">
        <div style="flex:1">
          <div class="k">On shift · ${S.truck}</div>
          <h2>${next ? next.cust : 'All stops complete'}</h2>
        </div>
        <span class="pill">${S.paused ? 'Paused' : 'Rolling'}</span>
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
          <h2>${ROUTES.filter(r => r.status !== 'done').length} routes waiting on you</h2>
        </div>
        <span class="pill">Off shift</span>
      </div>
      <div class="hero-line">
        <span><b>${ROUTES[1].stops.length}</b> stops on RT-4472</span>
        <span><b>${nf(ROUTES[1].stops.reduce((a, s) => a + s.expected, 0))}</b> lb planned</span>
      </div>
      <button class="btn btn-primary" id="home-start">
        <svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 10.6V6h-2v7.4l5.2 3.1 1-1.7-4.2-2.2z"/></svg>
        Start a route</button>
    </div>`;
    $('#home-start').onclick = () => { show('routes'); renderRoutes(); markHomeNav('routes'); };
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
    { k: 'routes', c: 'var(--blue)', b: 'My routes', s: 'Today and past runs', d: 'M6.5 2a3.5 3.5 0 0 0-1 6.86V15a1 1 0 0 0 1 1H14a1.5 1.5 0 0 1 0 3H9.9a3.5 3.5 0 1 0 0 2H14a3.5 3.5 0 0 0 0-7H7.5V8.86A3.5 3.5 0 0 0 6.5 2zm11 8a3.5 3.5 0 0 0-3.5 3.5c0 2.4 3.5 6.5 3.5 6.5s3.5-4.1 3.5-6.5A3.5 3.5 0 0 0 17.5 10z' },
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
  try { if (rec) rec.stop(); } catch (e) {}
  try { speechSynthesis.cancel(); } catch (e) {}
  setWake(false);
  Object.assign(S, {
    authed: false, onShift: false, route: null, activeStop: null, paused: false,
    shiftSec: 0, miles: 0, problems: [], msgs: [], unread: 0, tts: false, hands: false,
    geo: { lat: null, lng: null, acc: null, speed: 0, ok: false }
  });
  lastFix = null;
  USER.prefs.aloud = false; USER.prefs.awake = false;
  $('#tog-tts').classList.remove('on'); $('#tog-hands').classList.remove('on');
  ROUTES[1].stops.forEach(s => { s.status = 'pending'; s.lbs = 0; s.cash = 0; s.notes = ''; s.at = null; });
  ROUTES[0].stops.forEach(s => { s.status = 'pending'; s.lbs = 0; s.cash = 0; s.notes = ''; s.at = null; });
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
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="42" fill="#1976D2"/><path fill="#fff" d="M72 32h48a8 8 0 0 1 8 8v11a40 40 0 0 1 24 37v67a24 24 0 0 1-24 24H64a24 24 0 0 1-24-24V88a40 40 0 0 1 24-37V40a8 8 0 0 1 8-8zm-8 64v67a8 8 0 0 0 8 8h56a8 8 0 0 0 8-8V96H64z"/></svg>`);

(function manifest() {
  const m = {
    name: 'Driver App — CO₂ Route', short_name: 'Driver', start_url: '.', scope: '.',
    display: 'standalone', orientation: 'portrait', background_color: '#1976D2', theme_color: '#1976D2',
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
