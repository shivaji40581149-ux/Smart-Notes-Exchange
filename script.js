/* Smart Notes Exchange — data is saved in the browser (localStorage) */
const SUBJECTS = ["Mathematics","Physics","Chemistry","Biology","Computer Science","Data Structures","Algorithms","Operating Systems","DBMS","Computer Networks","Software Engineering","Electronics","Mechanics","Thermodynamics","Economics","Accounting","Management","English","History","Psychology","Statistics"];
const DEPTS = ["Computer Science","Electronics","Mechanical","Civil","Electrical","Commerce","Arts","Science"];
const SEMS = [1,2,3,4,5,6,7,8];
const MAX_MB = 10;

const DB = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
};
/* Files are stored in IndexedDB (large), note details in localStorage (small) */
const IDB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open("sne_files", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("files");
      r.onsuccess = () => res(this.db = r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction("files", mode), req = fn(t.objectStore("files"));
      t.oncomplete = () => res(req.result);
      t.onerror = t.onabort = () => rej(t.error);
    });
  },
  put(id, blob) { return this.tx("readwrite", s => s.put(blob, id)); },
  get(id) { return this.tx("readonly", s => s.get(id)); },
  del(id) { return this.tx("readwrite", s => s.delete(id)); }
};
let users = DB.get("sne_users", []);
let notes = DB.get("sne_notes", []);
let me = DB.get("sne_me", null);           // logged-in email
if (me && !users.some(u => u.email === me)) { me = null; DB.set("sne_me", null); }  // stale session fix
let filt = { q: "", subject: "", sem: "", dept: "", sort: "" };

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const user = () => users.find(u => u.email === me);
const hash = s => { let h = 5381; for (const c of s) h = (h * 33) ^ c.charCodeAt(0); return String(h >>> 0); };
const opts = (arr, sel, ph) => (ph ? `<option value="">${ph}</option>` : "") + arr.map(v => `<option ${String(v) === String(sel) ? "selected" : ""}>${v}</option>`).join("");
const avg = n => { const r = Object.values(n.ratings || {}); return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0; };
const stars = v => `<span class="stars">${"★".repeat(Math.round(v))}<span class="off">${"★".repeat(5 - Math.round(v))}</span></span>`;
const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.ceil(b / 1024) + " KB";

function toast(msg, err) {
  const t = $("#toast"); t.textContent = msg; t.className = "toast show" + (err ? " err" : "");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.className = "toast", 2800);
}
const go = h => { location.hash = h; };
const save = () => DB.set("sne_notes", notes);

/* ---------- nav ---------- */
function renderNav() {
  const u = user();
  $("#nav").innerHTML = `<div class="wrap">
    <a class="brand" href="#/"><span class="logo"></span>Smart Notes Exchange</a>
    <nav class="nav-mid"><a href="#/browse">&#128269; Browse</a></nav>
    <div class="nav-r">${u
      ? `<a class="lnk" href="#/upload">Upload</a><a class="lnk" href="#/my">My Notes</a><span class="lnk" style="color:#64748b">Hi, ${esc(u.name.split(" ")[0])}</span><button class="btn sm out" onclick="signout()">Sign Out</button>`
      : `<a class="lnk" href="#/signin">Sign In</a><a class="btn sm" href="#/signup">Sign Up</a>`}</div></div>`;
}

/* ---------- views ---------- */
function noteCard(n) {
  const a = avg(n), c = Object.keys(n.ratings || {}).length;
  return `<a class="card note" href="#/note/${n.id}">
    <div><span class="tag">${esc(n.subject)}</span><span class="tag g">Sem ${esc(n.sem)}</span></div>
    <h3>${esc(n.title)}</h3>
    <p style="color:var(--mute);font-size:.95rem">${esc((n.desc || "").slice(0, 90)) || "No description"}</p>
    <div>${stars(a)} <small style="color:var(--mute)">${c ? a.toFixed(1) + " (" + c + ")" : "No ratings"}</small></div>
    <div class="meta">${esc(n.dept)} &bull; by ${esc(n.by)} &bull; ${new Date(n.date).toLocaleDateString()}</div></a>`;
}

function vHome() {
  const recent = [...notes].sort((a, b) => b.date - a.date).slice(0, 6);
  return `<section class="hero"><div class="wrap">
    <span class="pill">&#127891; Built by students, for students</span>
    <h1>Share knowledge.<br>Ace your exams.</h1>
    <p class="sub">Smart Notes Exchange is a community platform where students upload, discover, and rate academic notes — organized by subject and semester.</p>
    <div class="cta-row"><a class="btn white" href="#/browse">&#128269; Browse Notes</a><a class="btn ghost" href="#/${me ? "upload" : "signup"}">${me ? "Upload Notes" : "Join Free"} &rarr;</a></div>
    <div class="stats"><div><b>${notes.length}+</b><span>Notes Available</span></div><div><b>${SUBJECTS.length}+</b><span>Subjects</span></div><div><b>Free</b><span>Always</span></div></div>
  </div></section>
  <section class="sec"><div class="wrap center"><h2>Everything you need to succeed</h2><p class="lead">A complete platform for discovering, sharing, and reviewing academic notes.</p>
    <div class="features">
      ${[["Upload Notes","Share your study material with fellow students in seconds.","#3b82f6","&#8679;","#/upload","Upload now"],["Search &amp; Filter","Find notes by subject, semester, or department instantly.","#06b6d4","&#128269;","#/browse/search","Start searching"],["Rate &amp; Review","Help others find the best notes through community ratings.","#f59e0b","&#9734;","#/browse/top","See top rated"],["Excel Together","Build a shared knowledge base that lifts everyone up.","#10b981","&#127891;","#/community","See contributors"]]
        .map(f => `<a class="card feat" href="${f[4]}"><div class="ico" style="background:${f[2]}">${f[3]}</div><h3>${f[0]}</h3><p>${f[1]}</p><span class="go">${f[5]} &rarr;</span></a>`).join("")}
    </div></div></section>
  <section style="padding-bottom:80px"><div class="wrap">
    <div class="sec-head"><div><h2 style="font-size:2.2rem;font-weight:800">Recently added notes</h2><p class="lead">Fresh study material from the community</p></div><a href="#/browse">View all &rarr;</a></div>
    ${recent.length ? `<div class="grid">${recent.map(noteCard).join("")}</div>` : `<div class="card empty"><i>&#128196;</i>No notes have been uploaded yet. Be the first to share!</div>`}
  </div></section>
  <section style="padding-bottom:80px"><div class="wrap"><div class="banner"><h2>Ready to start sharing?</h2><p>Join Smart Notes Exchange today and gain access to notes across every subject and semester — completely free.</p>
    <a class="btn white" href="#/${me ? "upload" : "signup"}">${me ? "Upload your notes" : "Create your free account"} &rarr;</a></div></div></section>`;
}

function vBrowse() {
  return `<div class="page"><div class="wrap"><h1>Browse Notes</h1><p class="lead">Search by title or filter by subject, semester and department.</p>
    <div class="filters">
      <input id="fq" placeholder="Search notes..." value="${esc(filt.q)}" oninput="setF('q',this.value)">
      <select onchange="setF('subject',this.value)">${opts(SUBJECTS, filt.subject, "All subjects")}</select>
      <select onchange="setF('sem',this.value)">${opts(SEMS, filt.sem, "All semesters")}</select>
      <select onchange="setF('dept',this.value)">${opts(DEPTS, filt.dept, "All departments")}</select>
      <select onchange="setF('sort',this.value)"><option value="">Newest first</option><option value="top" ${filt.sort === "top" ? "selected" : ""}>Top rated</option></select>
      <button class="btn out" onclick="resetF()">Reset</button></div>
    <div id="results"></div></div></div>`;
}
function results() {
  const q = filt.q.toLowerCase();
  const list = notes.filter(n => (!q || (n.title + n.desc + n.subject + n.by).toLowerCase().includes(q)) &&
    (!filt.subject || n.subject === filt.subject) && (!filt.sem || String(n.sem) === filt.sem) && (!filt.dept || n.dept === filt.dept))
    .sort(filt.sort === "top" ? (a, b) => avg(b) - avg(a) || Object.keys(b.ratings || {}).length - Object.keys(a.ratings || {}).length : (a, b) => b.date - a.date);
  $("#results").innerHTML = list.length ? `<div class="grid">${list.map(noteCard).join("")}</div>`
    : `<div class="card empty"><i>&#128196;</i>No notes match your search. Try different filters.</div>`;
}
function setF(k, v) { filt[k] = v; results(); }
function resetF() { filt = { q: "", subject: "", sem: "", dept: "", sort: "" }; route(); }

function vCommunity() {
  const m = {};
  notes.forEach(n => {
    const o = m[n.owner] ||= { name: n.by, notes: 0, cnt: 0, sum: 0 };
    const r = Object.values(n.ratings || {});
    o.notes++; o.cnt += r.length; o.sum += r.reduce((a, b) => a + b, 0);
  });
  const list = Object.values(m).sort((a, b) => b.notes - a.notes || b.sum - a.sum);
  return `<div class="page"><div class="wrap"><div class="sec-head"><div><h1>Excel Together</h1><p class="lead">${notes.length} note${notes.length === 1 ? "" : "s"} shared by ${list.length} student${list.length === 1 ? "" : "s"}.</p></div>
    <a class="btn" href="#/${me ? "upload" : "signup"}">${me ? "Share a note" : "Join to contribute"}</a></div>
    ${list.length ? `<div class="grid">${list.map((o, i) => `<div class="card note"><h3>${["&#129351;", "&#129352;", "&#129353;"][i] || "#" + (i + 1)} ${esc(o.name)}</h3>
      <div>${stars(o.cnt ? o.sum / o.cnt : 0)} <small style="color:var(--mute)">${o.cnt ? (o.sum / o.cnt).toFixed(1) + " (" + o.cnt + ")" : "No ratings yet"}</small></div>
      <div class="meta">${o.notes} note${o.notes === 1 ? "" : "s"} shared</div></div>`).join("")}</div>`
    : `<div class="card empty"><i>&#127891;</i>No contributors yet. Upload the first note!</div>`}</div></div>`;
}

function vUpload() {
  if (!me) { toast("Sign in to upload notes", true); go("#/signin"); return ""; }
  return `<div class="card form"><h1>Upload Notes</h1><p class="lead">PDF, Word, PowerPoint, image or text — up to ${MAX_MB} MB.</p>
    <form onsubmit="upload(event)">
      <label>Title</label><input name="title" required maxlength="80" placeholder="e.g. Unit 3 — Normalization">
      <label>Subject</label><select name="subject" required>${opts(SUBJECTS, "", "Select subject")}</select>
      <div class="row2"><div><label>Semester</label><select name="sem" required>${opts(SEMS, "", "Select")}</select></div>
      <div><label>Department</label><select name="dept" required>${opts(DEPTS, "", "Select")}</select></div></div>
      <label>Description (optional)</label><textarea name="desc" rows="3" maxlength="300"></textarea>
      <label>File</label><input type="file" name="file" required accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg">
      <button class="btn" id="ubtn">Upload note</button></form></div>`;
}
async function upload(e) {
  e.preventDefault();
  const f = e.target.elements, file = f.file.files[0];
  if (!file) return toast("Choose a file to upload", true);
  if (file.size > MAX_MB * 1048576) return toast(`File is larger than ${MAX_MB} MB. Choose a smaller file.`, true);
  const btn = $("#ubtn"); btn.disabled = true;
  const n = { id: Date.now().toString(36), title: f.title.value.trim(), subject: f.subject.value, sem: f.sem.value, dept: f.dept.value,
    desc: f.desc.value.trim(), by: user().name, owner: me, date: Date.now(), fileName: file.name, fileType: file.type, size: file.size, ratings: {} };
  try { await IDB.put(n.id, file); }
  catch { btn.disabled = false; return toast("Could not store the file. Check browser storage settings.", true); }
  notes.push(n);
  if (!save()) { notes.pop(); IDB.del(n.id).catch(() => {}); btn.disabled = false; return toast("Browser storage is full. Delete old notes and try again.", true); }
  toast("Note uploaded"); go("#/note/" + n.id);
}

function vMy() {
  if (!me) { go("#/signin"); return ""; }
  const mine = notes.filter(n => n.owner === me).sort((a, b) => b.date - a.date);
  return `<div class="page"><div class="wrap"><div class="sec-head"><div><h1>My Notes</h1><p class="lead">${mine.length} note${mine.length === 1 ? "" : "s"} uploaded by you</p></div><a class="btn" href="#/upload">Upload note</a></div>
    ${mine.length ? `<div class="grid">${mine.map(noteCard).join("")}</div>` : `<div class="card empty"><i>&#128196;</i>You haven't uploaded any notes yet.</div>`}</div></div>`;
}

function vNote(id) {
  const n = notes.find(x => x.id === id);
  if (!n) return `<div class="page"><div class="wrap card empty">This note doesn't exist or was deleted. <br><br><a class="btn" href="#/browse">Browse notes</a></div></div>`;
  const mine = me && n.ratings[me] || 0, a = avg(n), c = Object.keys(n.ratings).length;
  setTimeout(() => attachFile(n), 0);
  return `<div class="page"><div class="wrap"><a href="#/browse" style="color:var(--blue);font-weight:600">&larr; Back to notes</a>
    <div class="detail"><div><h1 style="margin-top:14px">${esc(n.title)}</h1>
      <div style="margin:10px 0"><span class="tag">${esc(n.subject)}</span><span class="tag g">Sem ${esc(n.sem)}</span><span class="tag">${esc(n.dept)}</span></div>
      <p style="margin-bottom:20px">${esc(n.desc) || '<span style="color:var(--mute)">No description.</span>'}</p><div id="prev"></div></div>
      <aside class="card" style="align-self:start"><p>${stars(a)} <b>${c ? a.toFixed(1) : "—"}</b> <small style="color:var(--mute)">(${c} rating${c === 1 ? "" : "s"})</small></p>
        <p class="meta" style="margin-top:10px">Uploaded by ${esc(n.by)}<br>${new Date(n.date).toLocaleDateString()} &bull; ${esc(n.fileName)} &bull; ${fmtSize(n.size)}</p>
        <div class="act"><a class="btn" id="dl" href="#/note/${n.id}" download="${esc(n.fileName)}">Download</a>
        ${me === n.owner ? `<button class="btn danger" onclick="del('${n.id}')">Delete</button>` : ""}</div>
        <hr style="margin:22px 0;border:0;border-top:1px solid var(--line)"><b>${me ? "Your rating" : "Sign in to rate"}</b>
        <div class="rate">${[1, 2, 3, 4, 5].map(i => `<button class="star ${i <= mine ? "on" : ""}" aria-label="${i} stars" onclick="rate('${n.id}',${i})">★</button>`).join("")}</div></aside></div></div></div>`;
}
let curUrl = null;
async function attachFile(n) {
  const box = $("#prev"); if (!box) return;
  try {
    let blob = await IDB.get(n.id);
    if (!blob && n.data) blob = await (await fetch(n.data)).blob();   // notes saved by the old version
    if (!$("#prev")) return;                                           // user already left this page
    if (!blob) { box.innerHTML = `<div class="card empty">The file for this note was not found on this device.</div>`; return; }
    if (curUrl) URL.revokeObjectURL(curUrl);
    const url = curUrl = URL.createObjectURL(blob), t = n.fileType || blob.type || "";
    const dl = $("#dl"); if (dl) dl.href = url;
    if (t === "application/pdf") box.innerHTML = `<iframe class="preview" src="${url}" title="Preview"></iframe>`;
    else if (t.startsWith("image/")) box.innerHTML = `<img class="preview" src="${url}" alt="${esc(n.title)}">`;
    else if (t.startsWith("text/")) box.innerHTML = `<pre class="card" style="white-space:pre-wrap;max-height:520px;overflow:auto">${esc(await blob.text())}</pre>`;
    else box.innerHTML = `<div class="card empty">Preview isn't available for this file type. Use Download to open it.</div>`;
  } catch { box.innerHTML = ""; }
}
function rate(id, v) {
  if (!me) { toast("Sign in to rate notes", true); return go("#/signin"); }
  const n = notes.find(x => x.id === id);
  if (n.owner === me) return toast("You can't rate your own note", true);
  n.ratings[me] = v;
  if (!save()) { delete n.ratings[me]; return toast("Browser storage is full.", true); }
  const y = window.scrollY; route(); window.scrollTo(0, y); toast("Rating saved");
}
function del(id) {
  if (!confirm("Delete this note permanently?")) return;
  notes = notes.filter(n => n.id !== id); save(); IDB.del(id).catch(() => {}); toast("Note deleted"); go("#/my");
}

/* ---------- auth ---------- */
function authForm(signup) {
  return `<div class="card form"><h1>${signup ? "Create your account" : "Welcome back"}</h1><p class="lead">${signup ? "Join for free and start sharing." : "Sign in to upload and rate notes."}</p>
    <form onsubmit="${signup ? "signup" : "signin"}(event)">
      ${signup ? `<label>Full name</label><input name="name" required minlength="2" autocomplete="name">` : ""}
      <label>Email</label><input type="email" name="email" required autocomplete="email">
      <label>Password</label><input type="password" name="pass" required minlength="6" autocomplete="${signup ? "new-password" : "current-password"}">
      <button class="btn">${signup ? "Create account" : "Sign in"}</button></form>
    <p class="alt">${signup ? 'Already have an account? <a href="#/signin">Sign in</a>' : 'New here? <a href="#/signup">Create an account</a>'}</p></div>`;
}
function signup(e) {
  e.preventDefault(); const f = e.target, email = f.email.value.trim().toLowerCase();
  if (users.some(u => u.email === email)) return toast("This email is already registered. Sign in instead.", true);
  users.push({ name: f.name.value.trim(), email, pass: hash(f.pass.value) });
  DB.set("sne_users", users); login(email, "Account created");
}
function signin(e) {
  e.preventDefault();
  const f = e.target.elements, email = f.email.value.trim().toLowerCase(), pass = f.pass.value;
  let u = users.find(x => x.email === email);
  if (!u) {   // new email: account is created automatically, so any email + password works
    const nm = email.split("@")[0].replace(/[._-]+/g, " ").trim() || "Student";
    users.push({ name: nm.charAt(0).toUpperCase() + nm.slice(1), email, pass: hash(pass) });
    DB.set("sne_users", users);
    return login(email, "Signed in");
  }
  if (u.pass !== hash(pass)) return toast("Email or password is incorrect.", true);
  login(email, "Signed in");
}
function login(email, msg) { me = email; DB.set("sne_me", me); toast(msg); go("#/"); }
function signout() { me = null; DB.set("sne_me", null); toast("Signed out"); go("#/"); route(); }

/* ---------- router ---------- */
function route() {
  const [, page, arg] = (location.hash || "#/").slice(1).split("/");
  const app = $("#app");
  const views = {
    "": vHome, community: vCommunity, browse: vBrowse, upload: vUpload, my: vMy, note: () => vNote(arg),
    signin: () => authForm(false), signup: () => authForm(true)
  };
  if (page === "browse" && arg === "top") filt.sort = "top";
  renderNav();
  app.innerHTML = (views[page || ""] || vHome)();
  if (page === "browse") { results(); if (arg === "search") $("#fq").focus(); }
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
route();