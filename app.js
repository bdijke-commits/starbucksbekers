// Mijn Bekerkast — app-logica
import { firebaseConfig, OWNER_EMAIL } from './config.js';

const $ = id => document.getElementById(id);
const DEMO = !firebaseConfig.apiKey || firebaseConfig.apiKey.includes('VUL-IN');
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

/* ================= gegevens laden ================= */
const D = await fetch('data.json').then(r => r.json());
const ITEMS = D.items, SER = D.series, TYPL = ['Mok', 'Ornament', 'Mini'];
const byId = new Map(ITEMS.map(i => [i.id, i]));
for (const i of ITEMS) i.q = (i.t + ' ' + i.l + ' ' + i.g + ' ' + i.th.join(' ') + ' ' + i.sub + ' ' + (i.ic ? i.ic.join(' ') : '')).toLowerCase();
const ICOL = { 'Red': '#C2312A', 'Dark Blue': '#22407C', 'Dark Brown': '#5A3926', 'Dark Green': '#23603A', 'Light Blue': '#3F9BCF', 'Blue': '#2B68B3', 'Light Green': '#6FAE3C', 'Orange': '#E07226', 'Brown': '#8A5A3B', 'Purple': '#6C3C8E', 'Yellow': '#D9A611', 'Plum': '#7A2C55' };
const CNL = { 'Red': 'rood', 'Dark Blue': 'donkerblauw', 'Dark Brown': 'donkerbruin', 'Dark Green': 'donkergroen', 'Light Blue': 'lichtblauw', 'Blue': 'blauw', 'Light Green': 'lichtgroen', 'Orange': 'oranje', 'Brown': 'bruin', 'Purple': 'paars', 'Yellow': 'geel', 'Plum': 'pruim' };

/* ================= toestand ================= */
let items = {};       // id -> {s:'h'|'w', f:true}
let notes = {};       // id -> tekst (alleen eigenaar)
let comments = [];    // [{id, mug, naam, tekst, uid, t:Date|null}]
let isOwner = false, myUid = null, docExists = true;
const photoCache = new Map(); // id -> dataURL
const st = id => (items[id] && items[id].s) || '';
const hasOwn = id => !!(items[id] && items[id].f);

/* ================= opslag: Firebase of demo ================= */
let api;
if (DEMO) api = demoBackend(); else api = await firebaseBackend();

function demoBackend() {
  $('demoBanner').hidden = false;
  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } };
  const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { } };
  const L = { state: [], notes: [], comments: [], auth: [] };
  const emit = (k, v) => L[k].forEach(f => f(v, true));
  let owner = get('bk-demo-owner', false);
  return {
    onState(cb) { L.state.push(cb); const v = get('bk-demo-items', null); cb(v || {}, v !== null) },
    onNotes(cb) { L.notes.push(cb); cb(get('bk-demo-notes', {})) },
    onComments(cb) { L.comments.push(cb); cb(get('bk-demo-comments', []).map(c => ({ ...c, t: new Date(c.t) }))) },
    onAuth(cb) { L.auth.push(cb); cb({ owner, uid: 'demo' }) },
    async setItem(id, v) { const a = get('bk-demo-items', {}); if (v) a[id] = v; else delete a[id]; put('bk-demo-items', a); emit('state', a) },
    async setItems(obj) { const a = { ...get('bk-demo-items', {}), ...obj }; put('bk-demo-items', a); emit('state', a) },
    async setNote(id, t) { const a = get('bk-demo-notes', {}); if (t) a[id] = t; else delete a[id]; put('bk-demo-notes', a); emit('notes', a) },
    async setNotes(obj) { const a = { ...get('bk-demo-notes', {}), ...obj }; put('bk-demo-notes', a); emit('notes', a) },
    async getPhoto(id) { return get('bk-demo-foto-' + id, null) },
    async setPhoto(id, url) { put('bk-demo-foto-' + id, url) },
    async delPhoto(id) { try { localStorage.removeItem('bk-demo-foto-' + id) } catch { } },
    async addComment(c) { const a = get('bk-demo-comments', []); a.unshift({ ...c, id: String(Date.now()), uid: 'demo', t: Date.now() }); put('bk-demo-comments', a); emit('comments', a.map(x => ({ ...x, t: new Date(x.t) }))) },
    async delComment(cid) { const a = get('bk-demo-comments', []).filter(x => x.id !== cid); put('bk-demo-comments', a); emit('comments', a.map(x => ({ ...x, t: new Date(x.t) }))) },
    async login() { owner = true; put('bk-demo-owner', true); emit('auth', { owner, uid: 'demo' }) },
    async logout() { owner = false; put('bk-demo-owner', false); emit('auth', { owner, uid: 'demo' }) },
  };
}

async function firebaseBackend() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  let db;
  try { db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }) }
  catch { db = F.getFirestore(app) }
  const kast = F.doc(db, 'kast', 'main'), notDoc = F.doc(db, 'kast', 'notities');
  const ownerOf = u => !!(u && !u.isAnonymous && u.email && u.email.toLowerCase() === OWNER_EMAIL.toLowerCase());
  let unNotes = null, notesCb = () => { };
  return {
    onState(cb) {
      F.onSnapshot(kast, s => cb((s.data() || {}).items || {}, s.exists() || s.metadata.fromCache),
        () => setSync('', 'Collectie kon niet geladen worden. Controleer de Firestore-regels.'));
    },
    onNotes(cb) { notesCb = cb },
    onComments(cb) {
      const q = F.query(F.collection(db, 'reacties'), F.orderBy('t', 'desc'), F.limit(1000));
      F.onSnapshot(q, s => cb(s.docs.map(d => { const x = d.data(); return { id: d.id, ...x, t: x.t ? x.t.toDate() : null } })), () => { });
    },
    onAuth(cb) {
      A.onAuthStateChanged(auth, u => {
        const own = ownerOf(u);
        if (unNotes) { unNotes(); unNotes = null }
        if (own) unNotes = F.onSnapshot(notDoc, s => notesCb((s.data() || {}).n || {}), () => { });
        else notesCb({});
        cb({ owner: own, uid: u ? u.uid : null });
      });
    },
    // vervangt het hele item (zodat een weggehaalde foto-vlag ook echt verdwijnt)
    async setItem(id, v) {
      try { await F.updateDoc(kast, new F.FieldPath('items', String(id)), v || F.deleteField()) }
      catch (e) { if (e.code === 'not-found') await F.setDoc(kast, { items: { [id]: v || {} } }, { merge: true }); else throw e }
    },
    setItems: obj => F.setDoc(kast, { items: obj }, { merge: true }),
    setNote: (id, t) => F.setDoc(notDoc, { n: { [id]: t || F.deleteField() } }, { merge: true }),
    setNotes: obj => F.setDoc(notDoc, { n: obj }, { merge: true }),
    async getPhoto(id) { const s = await F.getDoc(F.doc(db, 'fotos', String(id))); return s.exists() ? s.data().img : null },
    setPhoto: (id, url) => F.setDoc(F.doc(db, 'fotos', String(id)), { img: url }),
    delPhoto: id => F.deleteDoc(F.doc(db, 'fotos', String(id))),
    async addComment(c) {
      if (!auth.currentUser) await A.signInAnonymously(auth);
      await F.addDoc(F.collection(db, 'reacties'), { mug: c.mug, naam: c.naam, tekst: c.tekst, uid: auth.currentUser.uid, t: F.serverTimestamp() });
    },
    delComment: cid => F.deleteDoc(F.doc(db, 'reacties', cid)),
    login: (e, p) => A.signInWithEmailAndPassword(auth, e, p),
    logout: () => A.signOut(auth),
  };
}

/* ================= koppelen ================= */
function setSync(kind, txt) { $('syncDot').className = 'dot ' + (kind || ''); $('syncTxt').textContent = txt }
setSync('', DEMO ? 'Demo-modus' : 'Verbinden…');

function connect() {
api.onAuth(a => {
  isOwner = a.owner; myUid = a.uid;
  document.body.classList.toggle('owner', isOwner);
  $('loginBtn').textContent = isOwner ? 'Uitloggen' : 'Inloggen';
  $('lede').textContent = isOwner
    ? 'Je bent ingelogd. Vink aan wat in je kast staat en zet op je verlanglijst wat je nog zoekt.'
    : 'Alle Starbucks-stadsmokken en ornamenten. Kijk wat er in de kast staat en wat er nog gezocht wordt, en laat een reactie achter bij een beker.';
  showMigrate(); renderAll();
});
api.onState((it, exists) => {
  items = it; docExists = exists;
  setSync('ok', DEMO ? 'Demo-modus · alleen in deze browser' : (navigator.onLine ? 'Bijgewerkt' : 'Offline · laatst bekende stand'));
  showMigrate(); renderAll();
});
api.onNotes(n => { notes = n; if (dlgId != null) fillDialog(dlgId, false) });
api.onComments(c => { comments = c; renderTotals(); refreshCommentBadges(); if (dlgId != null) renderComments(dlgId) });
}
window.addEventListener('online', () => setSync('ok', 'Bijgewerkt'));
window.addEventListener('offline', () => setSync('', 'Offline · laatst bekende stand'));

function showMigrate() { $('migrate').hidden = !(isOwner && !docExists) }
$('migrateBtn').addEventListener('click', async () => {
  $('migrateBtn').disabled = true;
  try {
    const s = await fetch('startcollectie.json').then(r => r.json());
    const obj = {}; for (const k in s.status) obj[k] = { s: s.status[k] };
    await api.setItems(obj); await api.setNotes(s.notities || {});
    $('migrate').hidden = true;
  } catch (e) { $('migrateBtn').disabled = false; setSync('', 'Overzetten mislukt: ' + (e.code || e.message)) }
});

/* ================= inloggen ================= */
$('loginBtn').addEventListener('click', async () => {
  if (isOwner) { await api.logout(); return }
  $('lMsg').textContent = ''; $('loginDlg').showModal();
});
$('loginCancel').addEventListener('click', () => $('loginDlg').close());
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault(); $('lMsg').textContent = 'Bezig…';
  try {
    await api.login($('lEmail').value.trim(), $('lPass').value);
    if (!DEMO && $('lEmail').value.trim().toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
      $('lMsg').textContent = 'Dit account mag de bekerkast niet bewerken.'; await api.logout(); return;
    }
    $('lPass').value = ''; $('loginDlg').close();
  } catch (err) {
    $('lMsg').textContent = /invalid|wrong|user-not-found|credential/.test(err.code || '') ? 'E-mailadres of wachtwoord klopt niet.' : 'Inloggen lukte niet (' + (err.code || 'onbekende fout') + ').';
  }
});

/* ================= foto's ================= */
function photo(el, i) {
  el.classList.remove('none', 'icon', 'mini', 'own'); el.innerHTML = ''; el.style.cssText = '';
  if (hasOwn(i.id)) {
    el.classList.add('own');
    const c = photoCache.get(i.id);
    if (c) el.style.backgroundImage = `url("${c}")`;
    else api.getPhoto(i.id).then(u => { if (u) { photoCache.set(i.id, u); if (hasOwn(i.id)) el.style.backgroundImage = `url("${u}")` } }).catch(() => { });
    return;
  }
  if (!i.p && i.ic) {
    el.classList.add('icon'); if (i.k === 2) el.classList.add('mini');
    el.style.setProperty('--ic', ICOL[i.ic[0]] || '#5D6F68');
    el.innerHTML = `<span class="mug"><span class="band"></span><span class="city">${esc(i.n)}</span>${i.ic[1] ? `<span class="lm">${esc(i.ic[1])}</span>` : ''}<span class="band b2"></span></span>`; return;
  }
  if (!i.p) { el.classList.add('none'); el.innerHTML = '<span>Geen foto</span>'; return }
  const [s, j] = i.p, rows = D.rows[s], col = j % 10, row = Math.floor(j / 10);
  el.style.backgroundImage = `url(s-${s}.webp)`;
  el.style.backgroundSize = `1000% ${rows * 100}%`;
  el.style.backgroundPosition = `${col / 9 * 100}% ${rows > 1 ? row / (rows - 1) * 100 : 0}%`;
}

/* ================= filters ================= */
const F = { q: '', status: 'all', type: 'all', series: null, land: '', thema: '', sort: 'az' };
const PAGE = 96; let shown = PAGE, list = [];
const lands = [...new Set(ITEMS.map(i => i.l).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nl'));
$('land').insertAdjacentHTML('beforeend', lands.map(l => `<option>${l}</option>`).join('') + '<option value="__none">Zonder land (thema/cruise)</option>');
const themas = [...new Set(ITEMS.flatMap(i => i.th))].sort((a, b) => a.localeCompare(b, 'nl'));
$('thema').insertAdjacentHTML('beforeend', themas.map(t => `<option>${t}</option>`).join(''));
function seg(id, key) {
  $(id).addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; setSeg(id, key, b.dataset.v);
  });
}
function setSeg(id, key, v) { F[key] = v;[...$(id).children].forEach(x => x.setAttribute('aria-pressed', x.dataset.v === v)); shown = PAGE; renderList() }
seg('segStatus', 'status'); seg('segType', 'type');
let qt; $('q').addEventListener('input', e => { clearTimeout(qt); qt = setTimeout(() => { F.q = e.target.value.trim().toLowerCase(); shown = PAGE; renderList() }, 120) });
$('land').addEventListener('change', e => { F.land = e.target.value; shown = PAGE; renderList() });
$('thema').addEventListener('change', e => { F.thema = e.target.value; shown = PAGE; renderList() });
$('sort').addEventListener('change', e => { F.sort = e.target.value; shown = PAGE; renderList() });
$('tReact').addEventListener('click', () => setSeg('segStatus', 'status', 'r'));

const commentCount = () => { const m = new Map(); for (const c of comments) m.set(c.mug, (m.get(c.mug) || 0) + 1); return m };
function filtered() {
  const words = F.q ? F.q.split(/\s+/) : [], cc = commentCount();
  const r = ITEMS.filter(i => {
    if (F.series !== null && i.s !== F.series) return false;
    if (F.type !== 'all' && i.k !== +F.type) return false;
    if (F.land) { if (F.land === '__none') { if (i.l) return false } else if (i.l !== F.land) return false }
    if (F.thema && !i.th.includes(F.thema)) return false;
    const s = st(i.id);
    if (F.status === 'h' && s !== 'h') return false;
    if (F.status === 'w' && s !== 'w') return false;
    if (F.status === 'm' && s === 'h') return false;
    if (F.status === 'r' && !cc.get(i.id)) return false;
    for (const w of words) if (!i.q.includes(w)) return false;
    return true;
  });
  const az = (a, b) => a.n.localeCompare(b.n, 'nl');
  if (F.sort === 'az') r.sort(az);
  else if (F.sort === 'land') r.sort((a, b) => (a.l || '~').localeCompare(b.l || '~', 'nl') || az(a, b));
  else r.sort((a, b) => a.s - b.s || a.k - b.k || az(a, b));
  return r;
}

/* ================= tekenen ================= */
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) }
function metaLine(i) { return [SER[i.s] + (i.k ? ' ' + TYPL[i.k].toLowerCase() : ''), i.l].filter(Boolean).join(' · ') }
const badgeTxt = s => s === 'h' ? 'In de kast' : 'Gezocht';
function cardHTML(i, cc) {
  const s = st(i.id), n = cc.get(i.id) || 0;
  return `<article class="card ${s}" data-id="${i.id}">
    <button class="ph" aria-label="Details ${esc(i.t)}"></button>
    ${s ? `<span class="badge">${badgeTxt(s)}</span>` : ''}
    ${n ? `<span class="rc">${n} ${n === 1 ? 'reactie' : 'reacties'}</span>` : ''}
    <div class="body"><div class="nm">${esc(i.n)}</div><div class="meta">${esc(metaLine(i))}</div></div>
    <div class="acts own-only"><button class="bh" aria-pressed="${s === 'h'}">${s === 'h' ? '✓ Heb ik' : 'Heb ik'}</button><button class="bw" aria-pressed="${s === 'w'}">${s === 'w' ? '★ Wil ik' : '☆ Wil ik'}</button></div>
  </article>`;
}
function renderList() {
  list = filtered(); const cc = commentCount();
  const g = $('grid'), part = list.slice(0, shown);
  g.innerHTML = part.length ? part.map(i => cardHTML(i, cc)).join('') : '<p class="empty">Geen bekers gevonden met deze filters.</p>';
  g.querySelectorAll('.card').forEach(c => photo(c.querySelector('.ph'), byId.get(+c.dataset.id)));
  $('moreBtn').hidden = list.length <= shown;
  $('moreBtn').textContent = `Toon meer (${list.length - shown} over)`;
  $('count').textContent = `${list.length.toLocaleString('nl-NL')} bekers`;
}
function renderTotals() {
  let h = 0, w = 0; const per = SER.map(() => ({ t: 0, h: 0, w: 0 }));
  for (const i of ITEMS) { const s = st(i.id), p = per[i.s]; p.t++; if (s === 'h') { h++; p.h++ } else if (s === 'w') { w++; p.w++ } }
  $('tHave').innerHTML = `${h.toLocaleString('nl-NL')}<small>/ ${ITEMS.length.toLocaleString('nl-NL')}</small>`;
  $('tWant').textContent = w.toLocaleString('nl-NL');
  $('tMiss').textContent = (ITEMS.length - h).toLocaleString('nl-NL');
  $('tReactN').textContent = comments.length.toLocaleString('nl-NL');
  $('series').innerHTML = SER.map((n, k) => {
    const p = per[k]; return `<button class="ser" data-s="${k}" aria-pressed="${F.series === k}">
    <b>${n}</b><span class="bar"><i style="width:${p.h / p.t * 100}%"></i><i class="w" style="width:${p.w / p.t * 100}%"></i></span>
    <span class="num">${p.h} / ${p.t} in kast${p.w ? ` · ${p.w} gezocht` : ''}</span></button>`
  }).join('');
}
$('series').addEventListener('click', e => { const b = e.target.closest('.ser'); if (!b) return; const k = +b.dataset.s; F.series = F.series === k ? null : k; shown = PAGE; renderTotals(); renderList() });
function renderAll() {
  renderTotals();
  const g = $('grid'), part = list.slice(0, shown);
  if (F.status === 'all' && g.children.length === part.length && part.length) g.querySelectorAll('.card').forEach(updateCard);
  else renderList();
  if (dlgId != null) fillDialog(dlgId, false);
}
function updateCard(c) {
  const i = byId.get(+c.dataset.id), s = st(i.id);
  c.className = 'card ' + s;
  let b = c.querySelector('.badge');
  if (s) { if (!b) { b = document.createElement('span'); b.className = 'badge'; c.querySelector('.ph').after(b) } b.textContent = badgeTxt(s) } else if (b) b.remove();
  const bh = c.querySelector('.bh'), bw = c.querySelector('.bw');
  bh.setAttribute('aria-pressed', s === 'h'); bh.textContent = s === 'h' ? '✓ Heb ik' : 'Heb ik';
  bw.setAttribute('aria-pressed', s === 'w'); bw.textContent = s === 'w' ? '★ Wil ik' : '☆ Wil ik';
  photo(c.querySelector('.ph'), i);
}
function refreshCommentBadges() {
  const cc = commentCount();
  $('grid').querySelectorAll('.card').forEach(c => {
    const n = cc.get(+c.dataset.id) || 0; let r = c.querySelector('.rc');
    if (n) { if (!r) { r = document.createElement('span'); r.className = 'rc'; c.querySelector('.ph').after(r) } r.textContent = `${n} ${n === 1 ? 'reactie' : 'reacties'}` } else if (r) r.remove();
  });
  if (F.status === 'r') renderList();
}

/* ================= bewerken ================= */
async function toggle(id, to) {
  if (!isOwner) return;
  const cur = items[id] || {}, s = cur.s === to ? '' : to;
  const v = { ...cur, s }; if (!v.s) delete v.s;
  const keep = v.s || v.f;
  items = { ...items }; if (keep) items[id] = v; else delete items[id];
  renderTotals(); const c = $('grid').querySelector(`.card[data-id="${id}"]`); if (c) updateCard(c); if (dlgId === id) fillDialog(id, false);
  try { await api.setItem(id, keep ? v : null) } catch (e) { setSync('', 'Opslaan mislukt (' + (e.code || e.message) + ')') }
}
$('grid').addEventListener('click', e => {
  const c = e.target.closest('.card'); if (!c) return; const id = +c.dataset.id;
  if (e.target.closest('.bh')) toggle(id, 'h');
  else if (e.target.closest('.bw')) toggle(id, 'w');
  else if (e.target.closest('.ph')) openDialog(id);
});
$('moreBtn').addEventListener('click', () => { shown += PAGE * 2; renderList() });

/* ================= detailvenster ================= */
let dlgId = null;
function fillDialog(id, full) {
  const i = byId.get(id), s = st(id);
  if (full) {
    $('dlTitle').textContent = i.t;
    $('dlTags').innerHTML = [SER[i.s], TYPL[i.k], i.sub, i.l, ...i.th].filter(Boolean).map(t => `<span class="tag">${esc(t)}</span>`).join('');
    $('dlLink').href = 'https://starbucks-mugs.com/mug/' + i.u + '/';
    const ic = i.ic; $('dlIcon').hidden = !ic;
    if (ic) $('dlIcon').innerHTML = [ic[0] ? `Themakleur <b>${esc(CNL[ic[0]] || ic[0].toLowerCase())}</b>` : '', ic[1] ? `voorkant <b>${esc(ic[1])}</b>` : '', ic[2] ? `achterkant <b>${esc(ic[2])}</b>` : '', ic[3] ? `<b>${esc(ic[3])}</b>` : ''].filter(Boolean).join(' · ');
    $('dlNote').value = notes[id] || ''; $('dlFotoMsg').textContent = ''; $('rMsg').textContent = '';
    renderComments(id);
  } else if (document.activeElement !== $('dlNote')) $('dlNote').value = notes[id] || '';
  photo($('dlPh'), i);
  $('dlSrc').hidden = !(i.e && !hasOwn(id));
  $('dlStatus').className = 'statusline ' + s;
  $('dlStatus').textContent = s === 'h' ? '✓ Staat in de kast' : s === 'w' ? '★ Staat op de verlanglijst' : 'Nog niet in de kast';
  $('dlHave').setAttribute('aria-pressed', s === 'h'); $('dlHave').textContent = s === 'h' ? '✓ Heb ik' : 'Heb ik';
  $('dlWant').setAttribute('aria-pressed', s === 'w'); $('dlWant').textContent = s === 'w' ? '★ Wil ik' : '☆ Wil ik';
  $('dlFotoDel').hidden = !hasOwn(id); $('dlFileLbl').textContent = hasOwn(id) ? 'Andere foto kiezen' : 'Eigen foto toevoegen';
}
function openDialog(id) { dlgId = id; fillDialog(id, true); $('dlg').showModal() }
$('dlClose').addEventListener('click', () => $('dlg').close());
$('dlg').addEventListener('click', e => { if (e.target === $('dlg')) $('dlg').close() });
$('dlg').addEventListener('close', () => { commitNote(); dlgId = null });
$('dlHave').addEventListener('click', () => toggle(dlgId, 'h'));
$('dlWant').addEventListener('click', () => toggle(dlgId, 'w'));
let nt; $('dlNote').addEventListener('input', () => { clearTimeout(nt); nt = setTimeout(commitNote, 800) });
function commitNote() {
  if (dlgId == null || !isOwner) return; clearTimeout(nt);
  const v = $('dlNote').value.trim(); if (v === (notes[dlgId] || '')) return;
  notes = { ...notes, [dlgId]: v }; api.setNote(dlgId, v).catch(e => setSync('', 'Notitie opslaan mislukt'));
}

/* eigen foto: verkleinen tot max 700px JPEG en opslaan */
function shrink(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const m = 700, sc = Math.min(1, m / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg', .8));
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('read')) }; im.src = url;
  });
}
$('dlFile').addEventListener('change', async e => {
  const file = e.target.files && e.target.files[0]; e.target.value = ''; if (!file || dlgId == null || !isOwner) return;
  const id = dlgId; $('dlFotoMsg').textContent = 'Foto opslaan…';
  try {
    const url = await shrink(file);
    await api.setPhoto(id, url); photoCache.set(id, url);
    await api.setItem(id, { ...(items[id] || {}), f: true });
    items = { ...items, [id]: { ...(items[id] || {}), f: true } };
    refreshItem(id); $('dlFotoMsg').textContent = 'Foto opgeslagen.';
  } catch (err) { $('dlFotoMsg').textContent = 'Opslaan lukte niet. Probeer een JPG- of PNG-foto.' }
});
$('dlFotoDel').addEventListener('click', async () => {
  if (dlgId == null || !isOwner) return; const id = dlgId;
  const v = { ...(items[id] || {}) }; delete v.f;
  items = { ...items }; if (v.s) items[id] = v; else delete items[id];
  photoCache.delete(id); refreshItem(id); $('dlFotoMsg').textContent = 'Eigen foto weggehaald.';
  try { await api.setItem(id, v.s ? v : null); await api.delPhoto(id) } catch { }
});
function refreshItem(id) { const c = $('grid').querySelector(`.card[data-id="${id}"]`); if (c) updateCard(c); if (dlgId === id) fillDialog(id, false) }

/* ================= reacties ================= */
const fmt = d => d ? d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : 'zojuist';
function renderComments(id) {
  const cs = comments.filter(c => c.mug === id).slice().reverse();
  $('rList').innerHTML = cs.length ? cs.map(c => `<li><div class="rk"><span><b>${esc(c.naam)}</b> · ${fmt(c.t)}</span>${(isOwner || (myUid && c.uid === myUid)) ? `<button class="del" data-c="${esc(c.id)}">Verwijderen</button>` : ''}</div>${esc(c.tekst)}</li>`).join('')
    : '<li class="leeg">Nog geen reacties. Laat als eerste iets achter.</li>';
}
$('rList').addEventListener('click', async e => {
  const b = e.target.closest('.del'); if (!b) return;
  b.disabled = true; try { await api.delComment(b.dataset.c) } catch { b.disabled = false; $('rMsg').textContent = 'Verwijderen lukte niet.' }
});
try { $('rNaam').value = localStorage.getItem('bk-naam') || '' } catch { }
$('rForm').addEventListener('submit', async e => {
  e.preventDefault(); if (dlgId == null) return;
  const naam = $('rNaam').value.trim().slice(0, 40), tekst = $('rTekst').value.trim().slice(0, 600);
  if (!naam || !tekst) return;
  try { localStorage.setItem('bk-naam', naam) } catch { }
  $('rSend').disabled = true; $('rMsg').textContent = 'Plaatsen…';
  try { await api.addComment({ mug: dlgId, naam, tekst }); $('rTekst').value = ''; $('rMsg').textContent = 'Geplaatst.' }
  catch (err) { $('rMsg').textContent = 'Plaatsen lukte niet (' + (err.code || 'geen verbinding') + ').' }
  finally { $('rSend').disabled = false }
});

renderTotals(); renderList(); connect();
