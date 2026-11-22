const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let token = localStorage.getItem("ts_token"), me = null, tenders = [], registering = true, history = [];

async function api(path, opts = {}) {
  opts.headers = { ...(opts.headers || {}), ...(token ? { Authorization: "Bearer " + token } : {}) };
  if (opts.body && !(opts.body instanceof FormData)) { opts.headers["Content-Type"] = "application/json"; opts.body = JSON.stringify(opts.body); }
  const r = await fetch("/api" + path, opts);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.detail || r.statusText);
  return d;
}

const PROFILE_FIELDS = `
  <input name="name" placeholder="Company name" required class="full">
  <input name="gstin" placeholder="GSTIN"><input name="udyam" placeholder="Udyam / NSIC number">
  <input name="state" placeholder="State"><input name="city" placeholder="City">
  <select name="size"><option value="micro">Micro enterprise</option><option value="small">Small enterprise</option><option value="medium">Medium enterprise</option><option value="large">Large</option></select>
  <input name="turnover_cr" type="number" step="0.01" min="0" placeholder="Annual turnover (₹ Crore)">
  <input name="years" type="number" min="0" placeholder="Years in business">
  <input name="certifications" placeholder="Certifications (ISO 9001, BIS, NABL...)">
  <textarea name="products" class="full" rows="2" placeholder="What do you manufacture / produce? (e.g. LED lights, copper cables, PVC pipes)"></textarea>
  <textarea name="services" class="full" rows="2" placeholder="Services / facilities you provide (e.g. housekeeping, installation, AMC, transport)"></textarea>
  <label class="chk"><input type="checkbox" name="women_owned"> Women-owned</label>
  <label class="chk"><input type="checkbox" name="startup"> DPIIT-recognised startup</label>`;

function formData(form) {
  const o = {};
  new FormData(form).forEach((v, k) => o[k] = v);
  form.querySelectorAll("input[type=checkbox]").forEach(c => o[c.name] = c.checked);
  ["turnover_cr", "years"].forEach(k => o[k] = Number(o[k] || 0));
  return o;
}
function fill(form, d) {
  for (const [k, v] of Object.entries(d)) {
    const el = form.elements[k]; if (!el) continue;
    if (el.type === "checkbox") el.checked = !!v; else el.value = v ?? "";
  }
}

function setAuthMode() {
  $("#authTitle").textContent = registering ? "Register your company" : "Log in";
  $("#regFields").innerHTML = registering ? PROFILE_FIELDS : "";
  $("#toggleAuth").textContent = registering ? "Already registered? Log in" : "New here? Register";
}
$("#toggleAuth").onclick = e => { e.preventDefault(); registering = !registering; setAuthMode(); };
$("#authForm").onsubmit = async e => {
  e.preventDefault(); $("#authErr").textContent = "";
  const d = formData(e.target);
  try {
    const r = await api(registering ? "/register" : "/login", { method: "POST", body: d });
    token = r.token; localStorage.setItem("ts_token", token); await boot();
  } catch (err) { $("#authErr").textContent = err.message; }
};
$("#logout").onclick = () => { localStorage.removeItem("ts_token"); location.reload(); };

document.querySelectorAll("nav [data-tab]").forEach(b => b.onclick = () => showTab(b.dataset.tab));
function showTab(t) {
  document.querySelectorAll(".tab").forEach(x => x.hidden = x.id !== "tab-" + t);
  document.querySelectorAll("nav [data-tab]").forEach(x => x.classList.toggle("on", x.dataset.tab === t));
  if (t === "schemes") loadSchemes();
}

async function boot() {
  try { me = await api("/me"); } catch { $("#auth").hidden = false; setAuthMode(); return; }
  $("#auth").hidden = true; $("#nav").hidden = false;
  $("#profileForm").innerHTML = PROFILE_FIELDS + '<button class="primary full">Save profile</button>';
  fill($("#profileForm"), me);
  $("#cats").innerHTML = "Your tender categories: " + me.categories.map(c => `<span class="pill">${esc(c)}</span>`).join("");
  const langs = await api("/langs");
  $("#lang").innerHTML = Object.entries(langs).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  showTab("tenders"); loadTenders();
}

$("#profileForm").onsubmit = async e => {
  e.preventDefault();
  try { me = await api("/me", { method: "PUT", body: formData(e.target) }); $("#profMsg").textContent = "Saved. Categories: " + me.categories.join(", ");
    $("#cats").innerHTML = "Your tender categories: " + me.categories.map(c => `<span class="pill">${esc(c)}</span>`).join(""); }
  catch (err) { $("#profMsg").textContent = err.message; }
};

async function loadTenders() {
  tenders = await api("/tenders");
  const cats = [...new Set(tenders.map(t => t.category))];
  $("#fCat").innerHTML = '<option value="">All categories</option>' + cats.map(c => `<option>${esc(c)}</option>`).join("");
  renderTenders();
}
function renderTenders() {
  const k = $("#fKind").value, c = $("#fCat").value;
  const list = tenders.filter(t => (!k || t.kind === k) && (!c || t.category === c));
  $("#tenderList").innerHTML = list.map(t => `
    <div class="tender"><h3>${esc(t.title)}</h3>
      <span class="pill">${esc(t.kind)}</span><span class="pill">${esc(t.category)}</span>
      ${t.org ? `<span class="pill">${esc(t.org)}</span>` : ""}
      ${t.analysis ? `<span class="pill ${t.analysis.verdict === "Well aligned" ? "green" : t.analysis.verdict === "Not aligned" ? "red" : "amber"}">${esc(t.analysis.verdict)}</span>` : ""}
      <p class="muted">${esc(t.snippet)}</p>
      <div class="row"><button class="primary" onclick="openTender(${t.id})">Open workspace</button>
      ${t.link.startsWith("http") ? `<a href="${esc(t.link)}" target="_blank" rel="noopener"><button>Source ↗</button></a>` : ""}</div></div>`).join("")
    || '<p class="muted">No tenders yet. Click "Find tenders".</p>';
}
$("#fKind").onchange = $("#fCat").onchange = renderTenders;

$("#searchBtn").onclick = async () => {
  $("#msg").textContent = "Searching government and private portals across India…";
  try { const r = await api("/tenders/search", { method: "POST" }); $("#msg").textContent = `Found ${r.found} results, ${r.new} new.`; loadTenders(); }
  catch (err) { $("#msg").textContent = err.message; }
};
$("#addManual").onclick = async () => {
  const title = prompt("Tender title"); if (!title) return;
  const link = prompt("Tender link (optional)") || "";
  await api("/tenders", { method: "POST", body: { title, link } }); loadTenders();
};

window.openTender = async id => {
  const t = tenders.find(x => x.id === id);
  const body = $("#modalBody");
  body.innerHTML = `<h2>${esc(t.title)}</h2><div id="mAnalysis"></div><div id="mIntel" class="sec"></div><div id="mReady" class="sec"></div><div id="mFill" class="sec"></div>`;
  modal.showModal();
  renderAnalysis(t); renderIntel(t); loadReadiness(id); renderFill(id);
};

function renderAnalysis(t) {
  const a = t.analysis;
  $("#mAnalysis").innerHTML = `<h3>1. Tender PDF analysis</h3>
    <input type="file" id="pdf" accept="application/pdf"> <button id="pdfBtn">Analyze PDF</button><p id="pdfMsg" class="muted"></p>
    ${a ? analysisHtml(a) : '<p class="muted">Upload the tender PDF to check eligibility against your profile.</p>'}`;
  $("#pdfBtn").onclick = async () => {
    const f = $("#pdf").files[0]; if (!f) return;
    const fd = new FormData(); fd.append("file", f); $("#pdfMsg").textContent = "Reading…";
    try { t.analysis = await api(`/tenders/${t.id}/analyze`, { method: "POST", body: fd }); renderAnalysis(t); loadReadiness(t.id); renderTenders(); }
    catch (err) { $("#pdfMsg").textContent = err.message; }
  };
}
const analysisHtml = a => `<h4 class="${a.verdict === "Well aligned" ? "green" : a.verdict === "Not aligned" ? "red" : "amber"}">${esc(a.verdict)} · scope match ${a.scope_match_pct}%</h4>
  <ul>${a.flags.map(f => `<li class="${f.level}">${esc(f.msg)}</li>`).join("")}</ul>
  <details><summary>Extracted terms</summary><pre>${esc(JSON.stringify(a.terms, null, 2))}</pre></details>`;

function renderIntel(t) {
  const i = t.intel;
  $("#mIntel").innerHTML = `<h3>2. Buyer risk & competitors</h3><button id="intelBtn">Run risk analysis</button><p id="intelMsg" class="muted"></p>${i ? intelHtml(i) : ""}`;
  $("#intelBtn").onclick = async () => {
    $("#intelMsg").textContent = "Searching public sources…";
    try { t.intel = await api(`/tenders/${t.id}/intel`, { method: "POST" }); renderIntel(t); }
    catch (err) { $("#intelMsg").textContent = err.message; }
  };
}
const intelHtml = i => `<h4>Risk: <span class="${i.risk_level === "High" ? "red" : i.risk_level === "Medium" ? "amber" : "green"}">${esc(i.risk_level)}</span> (score ${i.risk_score}) · ${esc(i.subject)}</h4>
  ${i.flags.length ? "<b>Signals</b><ul>" + i.flags.map(f => `<li>${esc(f.signal)}: ${esc(f.text)} <a href="${esc(f.source)}" target="_blank" rel="noopener">src</a></li>`).join("") + "</ul>" : ""}
  <b>Likely competitors</b> ${i.competitors.map(c => `<span class="pill">${esc(c.name)} ×${c.mentions}</span>`).join("") || '<span class="muted">none found</span>'}
  ${i.past_offers.length ? "<br><b>Past offer / value mentions</b><ul>" + i.past_offers.map(o => `<li>${esc(o.amount)} — ${esc(o.context)}</li>`).join("") + "</ul>" : ""}
  <p class="muted">${esc(i.note)}</p>`;

async function loadReadiness(id) {
  const r = await api(`/tenders/${id}/readiness`);
  $("#mReady").innerHTML = `<h3>3. Bid readiness</h3>
    <div class="score ${r.score >= 80 ? "green" : r.score >= 50 ? "amber" : "red"}">${r.score}/100 <small>${esc(r.grade)}</small></div>
    <p class="muted">Documents ${r.breakdown.documents}/50 · Profile ${r.breakdown.profile}/20 · Alignment ${r.breakdown.alignment}/20 · Timing ${r.breakdown.timing}/10${r.days_left != null ? ` · ${r.days_left} days left` : ""}</p>
    ${r.items.map(i => `<label class="chk"><input type="checkbox" data-k="${i.key}" ${r.checked[i.key] ? "checked" : ""}> ${esc(i.label)}</label>`).join("")}`;
  $("#mReady").querySelectorAll("input").forEach(c => c.onchange = async () => {
    const items = {}; $("#mReady").querySelectorAll("input").forEach(x => items[x.dataset.k] = x.checked);
    await api(`/tenders/${id}/readiness`, { method: "PUT", body: { items } }); loadReadiness(id);
  });
}

async function renderFill(id) {
  $("#mFill").innerHTML = `<h3>4. Assisted form filling</h3><button id="fillBtn">Generate fill pack</button><div id="fillOut"></div>`;
  $("#fillBtn").onclick = async () => {
    const p = await api(`/tenders/${id}/fillpack`);
    $("#fillOut").innerHTML = `<table>${Object.entries(p.fields).map(([k, v]) => `<tr><td class="muted">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
      <ol>${p.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>`;
  };
}

async function loadSchemes() {
  const s = await api("/schemes");
  $("#schemeList").innerHTML = s.map(x => `<div class="scheme ${x.applicable ? "" : "na"}"><b>${esc(x.name)}</b>
    <span class="pill ${x.applicable ? "green" : ""}">${x.applicable ? "likely applies" : "check eligibility"}</span>
    <p>${esc(x.desc)}</p><a href="${esc(x.url)}" target="_blank" rel="noopener">Official site ↗</a></div>`).join("")
    + '<p class="muted">Summaries are general. Limits and eligibility change; confirm on the official portal.</p>';
}

$("#chatForm").onsubmit = async e => {
  e.preventDefault();
  const q = $("#chatQ").value; $("#chatQ").value = "";
  const log = $("#chatLog");
  log.innerHTML += `<div class="msg u">${esc(q)}</div>`;
  try {
    const r = await api("/chat", { method: "POST", body: { question: q, lang: $("#lang").value, history } });
    history.push({ role: "user", content: q }, { role: "assistant", content: r.answer });
    log.innerHTML += `<div class="msg b">${esc(r.answer)}<br><small class="muted">Sources: ${esc(r.sources.join(", "))}</small></div>`;
  } catch (err) { log.innerHTML += `<div class="msg b err">${esc(err.message)}</div>`; }
  log.scrollTop = log.scrollHeight;
};

boot();
