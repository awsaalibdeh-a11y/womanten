"use strict";
const $ = id => document.getElementById(id);
const FOCUS = { confidence: "💪 Confidence", fitness: "🏃 Fitness", social: "🗣️ Social skills", mindset: "🧠 Mindset" };
const MOODS = ["😞", "😕", "😐", "🙂", "😄"];
const QUICK = [["Walk", 10, "A 10 minute walk"], ["Stretch", 5, "5 minute stretch"], ["Dance", 8, "Dance to 2 songs"], ["Yoga", 10, "10 minute yoga"]];
const STARTERS = ["I feel nervous about something", "How do I make friends?", "Help me feel more confident", "I had a bad day"];
const SLOTS = [["morning", "🌅 Morning"], ["afternoon", "☀️ Afternoon"], ["evening", "🌙 Evening"]];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ---------- storage: everything personal stays in this browser ---------- */
const KEY = "womanten.v1";
let S = load();
function fresh() { return { name: "", focus: [], week: [], done: {}, habits: [], workouts: [], checks: {}, chat: [], pid: rid(), challenges: [], bonus: 0 }; }
function load() { try { return Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { return fresh(); } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode: still works for this visit */ } }
function rid() { const a = new Uint8Array(10); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = Math.random() * 256); return [...a].map(b => (b % 36).toString(36)).join(""); }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dstr = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const today = () => dstr(new Date());
const dayName = () => DAYS[(new Date().getDay() + 6) % 7];
function toast(t) { const el = $("toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2200); }
async function api(path, body) {
  const r = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "Something went wrong"); return d;
}

/* ---------- what counts for the streak and points ---------- */
function doneToday(date) { return (S.done[date] || []).length; }
function activeDays() {
  const set = new Set(Object.keys(S.done).filter(d => S.done[d].length));
  S.habits.forEach(h => h.days.forEach(d => set.add(d)));
  S.workouts.forEach(w => set.add(w.date));
  Object.keys(S.checks).forEach(d => { if (S.checks[d].mood != null) set.add(d); });
  return set;
}
function streak() {
  const set = activeDays(); let n = 0; const d = new Date();
  if (!set.has(dstr(d))) d.setDate(d.getDate() - 1);          // today is not over yet, so yesterday still counts
  while (set.has(dstr(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function points() {
  const tasks = Object.values(S.done).reduce((a, l) => a + l.length, 0);
  const habits = S.habits.reduce((a, h) => a + h.days.length, 0);
  const mins = S.workouts.reduce((a, w) => a + w.min, 0);
  return tasks * 10 + habits * 5 + Math.floor(mins / 5) + S.bonus;
}

/* ---------- Today ---------- */
function renderTop() {
  $("streak").textContent = "🔥 " + streak(); $("points").textContent = "⭐ " + points();
  const h = new Date().getHours();
  $("hello").textContent = (h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening") + (S.name ? ", " + S.name : "");
  const todayTasks = todaysTasks(); const done = (S.done[today()] || []).length;
  const total = Math.max(1, todayTasks.length + S.habits.length);
  const habitsDone = S.habits.filter(x => x.days.includes(today())).length;
  const frac = Math.min(1, (done + habitsDone) / total);
  $("barfill").style.width = Math.round(frac * 100) + "%";
  $("barlabel").textContent = (done + habitsDone) + " of " + (todayTasks.length + S.habits.length) + " done today";
}
function todaysTasks() { const w = S.week.find(x => x.day === dayName()); return w ? SLOTS.map(([k]) => ({ key: k, text: w[k] })) : []; }
function renderSlots() {
  const t = todaysTasks(), done = S.done[today()] || [];
  $("slots").innerHTML = t.length ? SLOTS.map(([k, label], i) => {
    const on = done.includes(k);
    return `<div class="slot ${on ? "done" : ""}"><div class="when">${label}</div><div class="what">${esc(t[i].text)}</div><button class="tick ${on ? "on" : ""}" data-slot="${k}" aria-label="Mark done">✓</button></div>`;
  }).join("") : `<p class="muted">No plan yet. Tap <b>Build my week</b> and I will make one for you.</p>`;
  $("weekList").innerHTML = S.week.map(w => `<div class="weekrow"><b>${w.day}</b><div>🌅 ${esc(w.morning)}</div><div>☀️ ${esc(w.afternoon)}</div><div>🌙 ${esc(w.evening)}</div></div>`).join("");
}
$("slots").addEventListener("click", e => {
  const b = e.target.closest("[data-slot]"); if (!b) return; const d = today(); const l = S.done[d] = S.done[d] || [];
  const i = l.indexOf(b.dataset.slot); if (i >= 0) l.splice(i, 1); else { l.push(b.dataset.slot); toast("+10 points"); }
  save(); renderAll();
});
$("buildWeek").onclick = async () => {
  const b = $("buildWeek"); b.disabled = true; b.textContent = "Building…";
  try { const d = await api("/api/plan", { name: S.name, focus: S.focus }); S.week = d.week; S.done = {}; save(); toast(d.ai ? "Your week is ready" : "Your week is ready (starter plan)"); }
  catch (e) { toast(e.message); }
  b.disabled = false; b.textContent = "Build my week"; renderAll();
};

/* habits */
function last7() { const out = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); out.push(dstr(d)); } return out; }
function hStreak(h) { let n = 0; const d = new Date(); if (!h.days.includes(dstr(d))) d.setDate(d.getDate() - 1); while (h.days.includes(dstr(d))) { n++; d.setDate(d.getDate() - 1); } return n; }
function renderHabits() {
  const t = today();
  $("habits").innerHTML = S.habits.length ? S.habits.map(h => `<div class="habit"><button class="tick ${h.days.includes(t) ? "on" : ""}" data-h="${h.id}" aria-label="Check in">✓</button>
    <div class="nm">${esc(h.name)}<small>${hStreak(h)} day streak</small><div class="dots">${last7().map(d => `<span class="${h.days.includes(d) ? "on" : ""}"></span>`).join("")}</div></div><button class="x" data-del="${h.id}" aria-label="Remove">×</button></div>`).join("")
    : `<p class="muted">Add something small you want to do every day, like reading for 10 minutes.</p>`;
}
$("habits").addEventListener("click", e => {
  const c = e.target.closest("[data-h]"), x = e.target.closest("[data-del]");
  if (c) { const h = S.habits.find(z => z.id === c.dataset.h), t = today(); const i = h.days.indexOf(t); if (i >= 0) h.days.splice(i, 1); else { h.days.push(t); toast("+5 points"); } save(); renderAll(); }
  if (x && confirm("Remove this habit?")) { S.habits = S.habits.filter(z => z.id !== x.dataset.del); save(); renderAll(); }
});
$("addHabit").onclick = () => { const n = (prompt("What habit do you want to build?") || "").trim().slice(0, 40); if (!n) return; S.habits.push({ id: rid(), name: n, days: [] }); save(); renderAll(); };

/* movement */
function weekStart() { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dstr(d); }
function logWorkout(type, min) { min = Math.round(+min); if (!min || min < 1 || min > 300) { toast("Enter minutes from 1 to 300"); return; } S.workouts.push({ date: today(), type, min }); save(); toast("Logged " + min + " min of " + type.toLowerCase()); renderAll(); }
function renderMove() {
  $("quick").innerHTML = QUICK.map(([t, m, l]) => `<button data-q="${t}|${m}">${esc(l)}</button>`).join("");
  const ws = weekStart(); const mins = S.workouts.filter(w => w.date >= ws).reduce((a, w) => a + w.min, 0);
  $("wsum").textContent = mins ? "This week: " + mins + " minutes of moving. Nice." : "Nothing logged this week yet. Even 5 minutes counts.";
}
$("quick").addEventListener("click", e => { const b = e.target.closest("[data-q]"); if (b) { const [t, m] = b.dataset.q.split("|"); logWorkout(t, m); } });
$("wlog").onclick = () => { logWorkout($("wtype").value, $("wmin").value); $("wmin").value = ""; };

/* check-in */
function chk() { return S.checks[today()] = S.checks[today()] || { mood: null, water: 0, sleep: 0 }; }
function renderCheck() {
  const c = S.checks[today()] || { mood: null, water: 0, sleep: 0 };
  $("moods").innerHTML = MOODS.map((m, i) => `<button class="${c.mood === i ? "on" : ""}" data-m="${i}" aria-label="Mood ${i + 1} of 5">${m}</button>`).join("");
  $("water").textContent = c.water; $("sleep").textContent = c.sleep;
}
$("moods").addEventListener("click", e => { const b = e.target.closest("[data-m]"); if (b) { chk().mood = +b.dataset.m; save(); renderAll(); } });
const bump = (k, d, max) => () => { const c = chk(); c[k] = Math.max(0, Math.min(max, c[k] + d)); save(); renderAll(); };
$("wPlus").onclick = bump("water", 1, 20); $("wMinus").onclick = bump("water", -1, 20); $("sPlus").onclick = bump("sleep", 1, 14); $("sMinus").onclick = bump("sleep", -1, 14);

/* weekly review */
function renderReview() {
  const ws = weekStart(); const dates = Object.keys(S.done).filter(d => d >= ws);
  const tasks = dates.reduce((a, d) => a + S.done[d].length, 0);
  const mins = S.workouts.filter(w => w.date >= ws).reduce((a, w) => a + w.min, 0);
  const moods = Object.entries(S.checks).filter(([d, c]) => d >= ws && c.mood != null).map(([, c]) => c.mood);
  const avg = moods.length ? MOODS[Math.round(moods.reduce((a, b) => a + b, 0) / moods.length)] : "–";
  $("review").innerHTML = `<div class="review"><div><b>${tasks}</b><span>plan steps</span></div><div><b>${mins}</b><span>minutes moved</span></div><div><b>${avg}</b><span>average mood</span></div></div>`;
}

/* focus time, with a gate for leaving early */
let focus = null, tick = null;
const fmt = s => String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
let fdur = 20;
$("fdur").innerHTML = [10, 20, 30, 45].map(m => `<button data-d="${m}" class="${m === fdur ? "on" : ""}">${m} min</button>`).join("");
$("fdur").addEventListener("click", e => { const b = e.target.closest("[data-d]"); if (!b) return; fdur = +b.dataset.d; [...$("fdur").children].forEach(x => x.classList.toggle("on", x === b)); });
$("fstart").onclick = () => { focus = { end: Date.now() + fdur * 60000, min: fdur }; $("focusIdle").hidden = true; $("focusRun").hidden = false; run(); tick = setInterval(run, 500); };
function run() { if (!focus) return; const left = Math.ceil((focus.end - Date.now()) / 1000); if (left <= 0) return finish(true); $("fclock").textContent = fmt(left); document.title = fmt(left) + " · Womanten"; }
function finish(ok) {
  clearInterval(tick); document.title = "Womanten"; $("focusRun").hidden = true; $("focusGate").hidden = true; $("focusIdle").hidden = false;
  if (ok && focus) { S.bonus += focus.min; S.workouts.push({ date: today(), type: "Focus", min: 0 }); save(); toast("Focus complete! +" + focus.min + " points"); renderAll(); } else if (!ok) toast("Focus ended early. That is okay, try again later.");
  focus = null;
}
$("fend").onclick = () => { $("focusRun").hidden = true; $("focusGate").hidden = false; $("gArea").innerHTML = ""; };
$("gStay").onclick = () => { $("focusGate").hidden = true; $("focusRun").hidden = false; };
$("gPush").onclick = () => {
  let n = 0; $("gArea").innerHTML = `<div class="big" id="pn">0 / 10</div><p class="muted tiny">Do a push-up, then tap the button each time.</p><button id="pc">I did one</button>`;
  $("pc").onclick = () => { n++; $("pn").textContent = n + " / 10"; if (n >= 10) finish(false); };
};
$("gBreath").onclick = () => {
  let t = 60; $("gArea").innerHTML = `<div class="big" id="bw">Breathe in…</div><p class="muted" id="bt">60 seconds left</p>`;
  const id = setInterval(() => { t--; $("bw").textContent = (t % 10 < 4) ? "Breathe in…" : "Breathe out slowly…"; $("bt").textContent = t + " seconds left"; if (t <= 0) { clearInterval(id); finish(false); } }, 1000);
};

/* ---------- Coach ---------- */
function renderChat() {
  const log = S.chat.length ? S.chat : [{ role: "bot", text: "Hi" + (S.name ? " " + S.name : "") + "! I am your coach. Tell me what is on your mind, big or small." }];
  $("chat").innerHTML = log.map(m => `<div class="msg ${m.role === "user" ? "me" : "bot"}">${esc(m.text)}</div>`).join("");
  $("chat").scrollTop = $("chat").scrollHeight;
  $("starters").innerHTML = S.chat.length ? "" : STARTERS.map(s => `<button data-s="${esc(s)}">${esc(s)}</button>`).join("");
  $("aiTag").textContent = window.WM.ai ? "AI coach" : "Starter coach";
}
async function send(text) {
  text = text.trim().slice(0, 500); if (!text) return;
  S.chat.push({ role: "user", text }); S.chat = S.chat.slice(-30); save(); renderChat();
  const wait = document.createElement("div"); wait.className = "msg bot"; wait.textContent = "…"; $("chat").appendChild(wait); $("chat").scrollTop = 1e6;
  try {
    const d = await api("/api/coach", { name: S.name, focus: S.focus, messages: S.chat.map(m => ({ role: m.role === "user" ? "user" : "assistant", text: m.text })) });
    S.chat.push({ role: "bot", text: d.reply });
  } catch (e) { S.chat.push({ role: "bot", text: e.message + " Try again in a moment." }); }
  S.chat = S.chat.slice(-30); save(); renderChat();
}
$("chatForm").addEventListener("submit", e => { e.preventDefault(); const t = $("chatIn").value; $("chatIn").value = ""; send(t); });
$("starters").addEventListener("click", e => { const b = e.target.closest("[data-s]"); if (b) send(b.dataset.s); });

/* ---------- challenges ---------- */
const cache = {};
async function refreshChallenges() {
  for (const code of S.challenges) { try { cache[code] = await api("/api/challenge/" + code); } catch (e) { cache[code] = null; } }
  renderChallenges();
}
function renderChallenges() {
  $("challenges").innerHTML = S.challenges.length ? S.challenges.map(code => {
    const v = cache[code]; if (!v) return `<div class="ch"><span class="code">${esc(code)}</span><div class="t">Loading…</div></div>`;
    const me = v.people.find(p => p.pid === S.pid), did = me && me.days.includes(v.today);
    return `<div class="ch"><span class="code">${esc(v.code)}</span><div class="t">${esc(v.title)}</div>
      <div class="muted tiny">${v.over ? "Finished" : "Day " + (v.today + 1) + " of " + v.days} · share the code ${esc(v.code)} with friends</div>
      <div class="lb">${v.people.map(p => `<div><span>${esc(p.name)}${p.pid === S.pid ? " (you)" : ""}</span><i>${p.done} / ${v.days} days</i></div>`).join("")}</div>
      ${v.over ? "" : `<div class="row2"><button ${did ? "disabled" : ""} data-ci="${esc(v.code)}">${did ? "Done for today ✓" : "I did it today"}</button></div>`}</div>`;
  }).join("") : `<p class="muted tiny" style="margin-top:12px">Start one and send the 6-letter code to your friends, or type a code you were given.</p>`;
}
$("challenges").addEventListener("click", async e => {
  const b = e.target.closest("[data-ci]"); if (!b) return;
  try { cache[b.dataset.ci] = await api("/api/challenge/" + b.dataset.ci + "/checkin", { pid: S.pid }); S.bonus += 5; save(); toast("+5 points"); renderChallenges(); renderTop(); } catch (er) { toast(er.message); }
});
$("chMake").onclick = async () => {
  const title = $("chTitle").value.trim(); if (!title) return toast("Name your challenge first");
  if (!S.name) return toast("Add your name first");
  try { const v = await api("/api/challenge", { title, days: $("chDays").value, name: S.name, pid: S.pid }); S.challenges.push(v.code); cache[v.code] = v; save(); $("chTitle").value = ""; renderChallenges(); toast("Started. Share code " + v.code); } catch (e) { toast(e.message); }
};
$("chJoin").onclick = async () => {
  const code = $("chCode").value.trim().toUpperCase(); if (code.length !== 6) return toast("Codes have 6 letters or numbers");
  if (!S.name) return toast("Add your name first");
  try { const v = await api("/api/challenge/" + code + "/join", { name: S.name, pid: S.pid }); if (!S.challenges.includes(v.code)) S.challenges.push(v.code); cache[v.code] = v; save(); $("chCode").value = ""; renderChallenges(); toast("You joined " + v.title); } catch (e) { toast(e.message); }
};

/* ---------- tabs, onboarding, boot ---------- */
document.querySelector(".tabs").addEventListener("click", e => {
  const b = e.target.closest("[data-tab]"); if (!b) return;
  document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("on", x === b));
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.id === "tab-" + b.dataset.tab));
  try { localStorage.setItem("womanten.tab", b.dataset.tab); } catch (er) { /* fine */ }
  if (b.dataset.tab === "coach") refreshChallenges();
  scrollTo(0, 0);
});
function renderAll() { renderTop(); renderSlots(); renderHabits(); renderMove(); renderCheck(); renderReview(); }
function onboard() {
  const picked = new Set(); $("sheet").hidden = false;
  $("obFocus").innerHTML = Object.entries(FOCUS).map(([k, l]) => `<button data-f="${k}">${l}</button>`).join("");
  $("obFocus").onclick = e => { const b = e.target.closest("[data-f]"); if (!b) return; const k = b.dataset.f; picked.has(k) ? picked.delete(k) : picked.add(k); b.classList.toggle("on", picked.has(k)); };
  $("obGo").onclick = async () => {
    const n = $("obName").value.trim().slice(0, 24); if (!n) return toast("Tell me your name first");
    S.name = n; S.focus = picked.size ? [...picked] : Object.keys(FOCUS); save(); $("sheet").hidden = true; renderAll(); renderChat();
    $("buildWeek").click();
  };
}
renderAll(); renderChat(); renderChallenges();
if (!S.name) onboard();
