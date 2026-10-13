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
function fresh() { return { name: "", focus: [], week: [], done: {}, habits: [], workouts: [], checks: {}, chat: [], pid: rid(), challenges: [], bonus: 0, todos: [], journal: [], workout: null, food: null, shop: {}, cycle: [], woDone: {}, braveDone: {}, routinesDone: [], study: [], goals: [], wins: [], conf: [], capsules: [], mealsDone: {} }; }
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
  S.todos.forEach(t => { if (t.done) set.add(t.date); });
  S.journal.forEach(j => set.add(j.date));
  Object.keys(S.woDone || {}).forEach(d => set.add(d));
  Object.keys(S.braveDone || {}).forEach(d => set.add(d));
  (S.routinesDone || []).forEach(r => set.add(r.date));
  (S.study || []).forEach(x => set.add(x.date));
  (S.wins || []).forEach(w => set.add(w.date));
  Object.keys(S.mealsDone || {}).forEach(d => { if ((S.mealsDone[d] || []).length) set.add(d); });
  (S.conf || []).forEach(c => set.add(c.date));
  Object.keys(S.checks).forEach(d => { if (S.checks[d].mood != null) set.add(d); });
  return set;
}
const streakInfo = { skips: 0 };
function streak() {
  const set = activeDays(); let n = 0, skips = 0; const d = new Date();
  if (!set.has(dstr(d))) d.setDate(d.getDate() - 1);
  for (;;) {
    if (set.has(dstr(d))) { n++; d.setDate(d.getDate() - 1); continue; }
    const prev = new Date(d); prev.setDate(prev.getDate() - 1);
    if (n > 0 && skips < Math.floor(n / 7) + 1 && set.has(dstr(prev))) { skips++; d.setDate(d.getDate() - 1); continue; }      // a freeze: one missed day is forgiven
    break;
  }
  streakInfo.skips = skips; return n;
}
function points() {
  const tasks = Object.values(S.done).reduce((a, l) => a + l.length, 0);
  const habits = S.habits.reduce((a, h) => a + h.days.length, 0);
  const mins = S.workouts.reduce((a, w) => a + w.min, 0);
  const todos = S.todos.filter(t => t.done).length;
  return tasks * 10 + Object.keys(S.woDone || {}).length * 15 + habits * 5 + todos * 5 + S.journal.length * 3 + Object.keys(S.braveDone || {}).length * 2 + (S.routinesDone || []).length + Object.values(S.mealsDone || {}).reduce((a, l) => a + l.length, 0) * 2 + (S.conf || []).length * 3 + Math.floor((S.wins || []).length / 2) + Math.floor((S.study || []).reduce((a, x) => a + x.min, 0) / 5) + Math.floor(mins / 5) + S.bonus;
}

/* ---------- Today ---------- */
function renderTop() {
  $("streak").textContent = "🔥 " + streak(); $("streak").title = streakInfo.skips ? "Days in a row (a streak freeze saved " + streakInfo.skips + " missed day" + (streakInfo.skips > 1 ? "s" : "") + ")" : "Days in a row"; $("points").textContent = "⭐ " + points();
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
  $("waterBar").style.width = Math.min(100, c.water / 8 * 100) + "%"; $("sleepBar").style.width = Math.min(100, c.sleep / 8 * 100) + "%";
  $("waterGoal").textContent = c.water >= 8 ? "Goal reached: 8 glasses. Well done!" : "Goal: 8 glasses a day (" + (8 - c.water) + " to go)";
  $("sleepGoal").textContent = !c.sleep ? "Goal: 8 hours a night" : c.sleep >= 8 ? "Great sleep: " + c.sleep + " hours" : c.sleep >= 6 ? c.sleep + " hours. A bit more rest would help" : c.sleep + " hours. Try to wind down earlier tonight";
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
$("fstart").onclick = () => { if (NATIVE_FOCUS() && !window.WomantenNative.startFocus(fdur)) { toast("Turn the lock on first, then start focus"); return; } focus = { end: Date.now() + fdur * 60000, min: fdur }; $("focusIdle").hidden = true; $("focusRun").hidden = false; run(); tick = setInterval(run, 500); };
function NATIVE_FOCUS() { return !!(window.WomantenNative && window.WomantenNative.startFocus); }
function run() { if (!focus) return; const left = Math.ceil((focus.end - Date.now()) / 1000);
  if (NATIVE_FOCUS() && window.WomantenNative.focusLeft() <= 0 && Date.now() < focus.end - 4000) return finish(false); if (left <= 0) return finish(true); $("fclock").textContent = fmt(left); document.title = fmt(left) + " · Womanten"; }
function finish(ok) {
  clearInterval(tick); document.title = "Womanten"; $("focusRun").hidden = true; $("focusGate").hidden = true; $("focusIdle").hidden = false;
  if (ok && focus) { S.bonus += focus.min; S.workouts.push({ date: today(), type: "Focus", min: 0 }); save(); toast("Focus complete! +" + focus.min + " points"); renderAll(); } else if (!ok) toast("Focus ended early. That is okay, try again later.");
  focus = null;
}
$("fend").onclick = () => { if (NATIVE_FOCUS()) { window.WomantenNative.openPushups(); return; } $("focusRun").hidden = true; $("focusGate").hidden = false; $("gArea").innerHTML = ""; };
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

/* ---------- to-do ---------- */
function renderTodos() {
  const t = today(); const list = S.todos.filter(x => x.date === t || !x.done);
  $("todos").innerHTML = list.length ? list.map(x => `<div class="todo ${x.done ? "done" : ""}"><button class="tick ${x.done ? "on" : ""}" data-td="${x.id}" aria-label="Done">✓</button><span>${esc(x.text)}</span><button class="x" data-tdel="${x.id}" aria-label="Remove">×</button></div>`).join("") : `<p class="muted tiny">Nothing yet. Add one thing you want to finish today.</p>`;
}
$("todos").addEventListener("click", e => {
  const c = e.target.closest("[data-td]"), x = e.target.closest("[data-tdel]");
  if (c) { const it = S.todos.find(z => z.id === c.dataset.td); it.done = !it.done; if (it.done) { it.date = today(); toast("+5 points"); } save(); renderAll(); }
  if (x) { S.todos = S.todos.filter(z => z.id !== x.dataset.tdel); save(); renderAll(); }
});
$("todoForm").addEventListener("submit", e => { e.preventDefault(); const v = $("todoIn").value.trim().slice(0, 80); if (!v) return; S.todos.push({ id: rid(), text: v, done: false, date: today() }); $("todoIn").value = ""; save(); renderAll(); });

/* ---------- journal ---------- */
const PROMPTS = ["What is one thing that went well today?", "What did you do today that took courage, even a little?", "Who made your day better, and how?", "What are you proud of this week?", "What is worrying you, and what is one small thing you can do about it?", "Write about a moment you felt calm.", "What would you say to a friend who felt like you do today?"];
function renderJournal() {
  $("jPrompt").textContent = "Today's question: " + PROMPTS[new Date().getDate() % PROMPTS.length];
  $("jList").innerHTML = S.journal.slice(-5).reverse().map(j => `<div class="entry"><small>${esc(j.date)}</small>${esc(j.text)}</div>`).join("");
}
$("jSave").onclick = () => { const v = $("jText").value.trim().slice(0, 600); if (!v) return toast("Write something first"); S.journal.push({ date: today(), text: v }); $("jText").value = ""; save(); toast("Saved. +3 points"); renderAll(); };

/* ---------- breathing ---------- */
let bTimer = null;
$("bGo").onclick = () => {
  if (bTimer) { clearInterval(bTimer); bTimer = null; $("circle").classList.remove("big"); $("bLabel").textContent = "Ready when you are"; $("bGo").textContent = "Start breathing"; return; }
  $("bGo").textContent = "Stop"; let step = 0, rounds = 0; const phases = [["Breathe in…", true], ["Hold…", true], ["Breathe out…", false], ["Hold…", false]];
  const tickB = () => { const [txt, big] = phases[step % 4]; $("bLabel").textContent = txt; $("circle").classList.toggle("big", big); step++; if (step % 4 === 0 && ++rounds >= 4) { clearInterval(bTimer); bTimer = null; $("bLabel").textContent = "Well done. Notice how you feel."; $("bGo").textContent = "Start breathing"; $("circle").classList.remove("big"); S.bonus += 3; save(); renderTop(); } };
  tickB(); bTimer = setInterval(tickB, 4000);
};

/* ---------- backup ---------- */
$("bkSave").onclick = () => { if (window.WomantenNative) { window.WomantenNative.saveFile("womanten-backup-" + today() + ".json", JSON.stringify(S)); return; } const b = new Blob([JSON.stringify(S)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "womanten-backup-" + today() + ".json"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
$("bkLoad").onclick = () => $("bkFile").click();
$("bkFile").onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); if (typeof d !== "object" || !d.name) throw 0; S = Object.assign(fresh(), d); save(); renderAll(); renderChat(); toast("Backup restored"); } catch (er) { toast("That file is not a Womanten backup"); } }; r.readAsText(f); };
$("bkReset").onclick = () => { if (confirm("Erase all your Womanten data on this device? This cannot be undone.")) { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } location.reload(); } };

/* ---------- the Android app: real app locks and reminders ---------- */
const NATIVE = window.WomantenNative || null;
if (NATIVE_FOCUS()) $("focusNote").textContent = "Real focus: your locked apps are blocked until the timer ends. To leave early you have to earn it with 10 reps on camera.";
function renderLock() {
  if (!NATIVE) return; $("lockWeb").hidden = true; $("lockApp").hidden = false;
  try { const i = JSON.parse(NATIVE.lockInfo()); $("lockScrolls").textContent = i.enabled ? (i.scrolls > 0 ? i.scrolls + " " + (i.currency || "scrolls") + " left" : "Locked: do " + (i.exercise || "push-ups").toLowerCase()) : "Locks are off"; $("lockSub").textContent = i.enabled ? "Locked: " + (i.apps.length ? i.apps.join(", ") : "no apps chosen yet") + ". Each " + (i.unit || "push-up") + " earns " + i.perPushup + " " + (i.currency || "scrolls") + "." : "Turn the locks on to start. Each push-up earns scrolls on the apps you choose."; } catch (e) { /* older app */ }
}
$("lockOpen").onclick = () => NATIVE && NATIVE.openLock();
$("lockPush").onclick = () => NATIVE && NATIVE.openPushups();
if (NATIVE) { renderLock(); setInterval(renderLock, 3000); document.addEventListener("visibilitychange", renderLock); }

/* ---------- workout and food plans, made by the AI (or a built-in plan if the AI is off) ---------- */
const FORMS = {
  workout: { title: "Your workout plan", path: "/api/workout", note: "Gentle and sensible. Stop if anything hurts, and check with a doctor or parent if you have an injury or health condition.", fields: [
    ["level", "How experienced are you?", [["beginner", "Just starting"], ["some", "I move a bit"], ["regular", "I train regularly"]]],
    ["days", "Days a week", [["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"]]],
    ["minutes", "Time per workout", [["15", "15 minutes"], ["30", "30 minutes"], ["45", "45 minutes"], ["60", "1 hour"]]],
    ["place", "Where?", [["home", "At home"], ["gym", "At a gym"], ["outdoors", "Outside"]]],
    ["equipment", "Equipment", [["none", "None"], ["bands", "Resistance bands"], ["dumbbells", "Dumbbells"]]],
    ["goal", "What do you want from it?", [["energy", "More energy"], ["strength", "Get stronger"], ["stamina", "More stamina"], ["flexibility", "Flexibility"]]],
    ["notes", "Injuries or things to avoid (optional)", null]] },
  food: { title: "Your food plan", path: "/api/food", note: "A balanced plan to enjoy, with no calorie counting. For medical or allergy needs, talk to a doctor or parent.", fields: [
    ["diet", "How do you eat?", [["everything", "Everything"], ["vegetarian", "Vegetarian"], ["vegan", "Vegan"], ["halal", "Halal"], ["pescatarian", "Fish but no meat"]]],
    ["allergies", "Allergies, never include (optional)", null],
    ["dislikes", "Foods you do not like (optional)", null],
    ["budget", "Budget", [["low", "Keep it cheap"], ["medium", "Normal"]]],
    ["cooking", "Cooking time", [["quick", "Quick and easy"], ["normal", "I like cooking"]]]] },
};
function openForm(kind) {
  const f = FORMS[kind], last = (S[kind] && S[kind].inputs) || {};
  $("pformBox").innerHTML = `<h2>${f.title}</h2><p class="muted tiny">${f.note}</p>` + f.fields.map(([k, label, opts]) => opts
    ? `<label class="l" for="pf-${k}">${label}</label><select id="pf-${k}">${opts.map(([v, t]) => `<option value="${v}" ${String(last[k] || "") === v ? "selected" : ""}>${t}</option>`).join("")}</select>`
    : `<label class="l" for="pf-${k}">${label}</label><input id="pf-${k}" maxlength="120" value="${esc(last[k] || "")}">`).join("")
    + `<div class="row2"><button id="pfGo">Make my plan</button><button class="ghost" id="pfCancel">Cancel</button></div><p class="muted tiny" id="pfWait"></p>`;
  $("pform").hidden = false;
  $("pfCancel").onclick = () => { $("pform").hidden = true; };
  $("pfGo").onclick = async () => {
    const body = {}; f.fields.forEach(([k]) => body[k] = $("pf-" + k).value);
    $("pfGo").disabled = true; $("pfWait").textContent = "Building your plan. This can take up to a minute…";
    try { const d = await api(f.path, body); S[kind] = kind === "workout" ? { plan: d.plan, inputs: d.inputs, ai: d.ai } : { plan: d.plan, inputs: d.inputs, ai: d.ai }; if (kind === "food") S.shop = {}; save(); $("pform").hidden = true; toast(d.ai ? "Your plan is ready" : "Your plan is ready (starter plan)"); renderAll(); }
    catch (e) { $("pfWait").textContent = e.message; $("pfGo").disabled = false; }
  };
}
$("woMake").onclick = () => openForm("workout"); $("fdMake").onclick = () => openForm("food");
function todayRow(plan) { return plan.find(d => d.day === dayName()); }
function renderWorkout() {
  const w = S.workout;
  $("woMake").textContent = w ? "Change plan" : "Make my plan";
  if (!w) { $("woBody").innerHTML = `<p class="muted">Tell me how much time you have and where you train, and the AI will build your week. Gentle, and no weight-loss talk.</p>`; return; }
  const t = todayRow(w.plan), done = (S.woDone || {})[today()];
  const day = d => d.rest ? `<div class="day"><h3>${d.day}: ${esc(d.title)}</h3><p class="muted tiny">${esc(d.warmup)}</p></div>`
    : `<div class="day"><h3>${d.day}: ${esc(d.title)}</h3><p class="muted tiny">Warm up: ${esc(d.warmup)}</p>${d.exercises.map(e => `<div class="ex"><div>${esc(e.name)}${e.tip ? `<small>${esc(e.tip)}</small>` : ""}</div><div class="d">${esc(e.detail)}</div></div>`).join("")}<p class="muted tiny">Cool down: ${esc(d.cooldown)}</p></div>`;
  $("woBody").innerHTML = `<p class="hint">Today, ${esc(t.day)}</p>${day(t)}` + (t.rest ? "" : `<div class="row2"><button id="woDone" ${done ? "disabled" : ""}>${done ? "Workout done ✓" : "I did this workout (+15)"}</button></div>`)
    + `<details><summary>See the whole week</summary>${w.plan.map(day).join("")}</details><p class="note">${w.ai ? "Made by AI for you." : "A starter plan."} Stop if anything hurts.</p>`;
  const b = $("woDone"); if (b) b.onclick = () => { S.woDone = S.woDone || {}; S.woDone[today()] = 1; S.workouts.push({ date: today(), type: "Workout", min: +(w.inputs.minutes || 30) }); save(); toast("Workout done! +15 points"); renderAll(); };
}
function renderFood() {
  const f = S.food;
  $("fdMake").textContent = f ? "Change plan" : "Make my plan";
  if (!f) { $("fdBody").innerHTML = `<p class="muted">Tell me how you eat and what you do not like, and the AI will plan a week of balanced meals and a shopping list. No calorie counting, ever.</p>`; return; }
  const t = todayRow(f.plan.days), eaten = S.mealsDone[today()] || [], meals = (d, tick) => [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snack", "Snack"]].filter(([k]) => d[k]).map(([k, l]) => `<div class="meal"><b>${l}</b><span>${esc(d[k])}</span>${tick ? `<button class="tick ${eaten.includes(k) ? "on" : ""}" data-meal="${k}" aria-label="I had this">✓</button>` : ""}</div>`).join("");
  const shop = f.plan.shopping.map((it, i) => `<label><input type="checkbox" data-shop="${i}" ${S.shop[i] ? "checked" : ""}><span class="${S.shop[i] ? "got" : ""}">${esc(it)}</span></label>`).join("");
  $("fdBody").innerHTML = `<p class="hint">Today, ${esc(t.day)}. Tap the tick when you have eaten a meal (+2).</p>${meals(t, true)}`
    + `<details><summary>See the whole week</summary>${f.plan.days.map(d => `<div class="day"><h3>${d.day}</h3>${meals(d, false)}</div>`).join("")}</details>`
    + `<details><summary>Shopping list (${f.plan.shopping.filter((_, i) => !S.shop[i]).length} to get)</summary><div class="shop">${shop}</div></details>`
    + (f.plan.tips.length ? `<details><summary>Tips</summary>${f.plan.tips.map(x => `<p class="muted tiny" style="margin-top:6px">• ${esc(x)}</p>`).join("")}</details>` : "")
    + `<p class="note">${f.ai ? "Made by AI for you." : "A starter plan."} Balanced eating, not a diet.</p>`;
}
$("fdBody").addEventListener("click", e => { const b = e.target.closest("[data-meal]"); if (!b) return; const l = S.mealsDone[today()] = S.mealsDone[today()] || []; const i = l.indexOf(b.dataset.meal); if (i >= 0) l.splice(i, 1); else { l.push(b.dataset.meal); toast("+2 points"); } save(); renderAll(); });
$("fdBody").addEventListener("change", e => { const c = e.target.closest("[data-shop]"); if (!c) return; S.shop[c.dataset.shop] = c.checked; save(); renderFood(); });

/* ---------- private cycle tracker ---------- */
function renderCycle() {
  const starts = [...S.cycle].sort(), last = starts[starts.length - 1];
  if (!last) { $("cycBody").innerHTML = `<p class="muted tiny">Tap the button on the day your period starts. After two or three entries I can estimate the next one.</p>`; return; }
  const day = d => Math.round((new Date(today()) - new Date(d)) / 86400000);
  const gaps = starts.slice(1).map((d, i) => day(starts[i]) - day(d)).filter(g => g >= 15 && g <= 60), avg = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 28;
  const next = new Date(last); next.setDate(next.getDate() + avg); const left = Math.round((next - new Date(today())) / 86400000);
  $("cycBody").innerHTML = `<div class="cyc"><div><b>${day(last) + 1}</b><span>cycle day</span></div><div><b>${avg}</b><span>day cycle${gaps.length ? "" : " (guess)"}</span></div><div><b>${left >= 0 ? left : "late"}</b><span>${left >= 0 ? "days to next" : "by " + -left + " days"}</span></div></div><p class="note">Next period is around ${dstr(next)}. Cycles vary, so this is only an estimate.</p>`;
}
$("cycStart").onclick = () => { if (!S.cycle.includes(today())) S.cycle.push(today()); save(); renderCycle(); toast("Saved"); };
$("cycUndo").onclick = () => { S.cycle.sort(); S.cycle.pop(); save(); renderCycle(); };

/* ---------- levels and badges ---------- */
const LEVEL_NAMES = ["Seed", "Sprout", "Bloom", "Brave", "Bold", "Radiant", "Fearless", "Unstoppable", "Legend"];
const BADGES = [
  ["🌱", "First step", () => Object.values(S.done).some(l => l.length) || S.habits.some(h => h.days.length) || S.todos.some(t => t.done)],
  ["🔥", "3 day streak", () => streak() >= 3], ["⚡", "7 day streak", () => streak() >= 7], ["👑", "30 day streak", () => streak() >= 30],
  ["🏃", "Moved 100 minutes", () => S.workouts.reduce((a, w) => a + w.min, 0) >= 100], ["💪", "10 workouts", () => S.workouts.length >= 10],
  ["📓", "5 journal entries", () => S.journal.length >= 5], ["💧", "Hydrated: 8 glasses", () => Object.values(S.checks).some(c => c.water >= 8)],
  ["😴", "Well rested: 8 hours", () => Object.values(S.checks).some(c => c.sleep >= 8)], ["🗓️", "Built a plan", () => S.week.length === 7],
  ["🏋️", "AI workout plan", () => !!S.workout], ["🥗", "AI food plan", () => !!S.food], ["🤝", "Joined a challenge", () => S.challenges.length > 0],
  ["🎯", "50 points", () => points() >= 50], ["🦁", "10 brave dares", () => Object.keys(S.braveDone).length >= 10], ["🏆", "5 wins", () => S.wins.length >= 5], ["🧘", "3 routines", () => S.routinesDone.length >= 3], ["📚", "100 minutes studied", () => S.study.reduce((a, x) => a + x.min, 0) >= 100], ["🚀", "500 points", () => points() >= 500],
];
function renderLevel() {
  const pts = points(), lv = Math.floor(Math.sqrt(pts / 25)) + 1, base = 25 * (lv - 1) ** 2, next = 25 * lv ** 2;
  $("lvTitle").textContent = "Level " + lv + " · " + LEVEL_NAMES[Math.min(lv - 1, LEVEL_NAMES.length - 1)];
  $("lvNext").textContent = (next - pts) + " points to level " + (lv + 1);
  $("lvFill").style.width = Math.round((pts - base) / (next - base) * 100) + "%";
  $("badges").innerHTML = BADGES.map(([e, t, f]) => `<div class="badge ${f() ? "" : "off"}" title="${esc(t)}${f() ? "" : " (locked)"}" aria-label="${esc(t)}">${e}</div>`).join("");
}

/* ---------- insights: 14 day charts, patterns, AI weekly review ---------- */
function lastDays(n) { const out = []; for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); out.push(dstr(d)); } return out; }
function dayStats(d) { const c = S.checks[d] || {}; return { d, mood: c.mood == null ? null : c.mood, sleep: c.sleep || 0, water: c.water || 0, min: S.workouts.filter(w => w.date === d).reduce((a, w) => a + w.min, 0), tasks: (S.done[d] || []).length, habits: S.habits.filter(h => h.days.includes(d)).length }; }
function chart(title, vals, max, goal, unit) {
  const w = 280, h = 56, bw = w / vals.length;
  const bars = vals.map((v, i) => { const bh = Math.max(2, Math.round(v / max * (h - 4))); return `<rect class="${v ? "" : "z"}" x="${i * bw + 2}" y="${h - bh}" width="${bw - 4}" height="${bh}" rx="3"></rect>`; }).join("");
  const gl = goal ? `<line class="goal" x1="0" x2="${w}" y1="${h - goal / max * (h - 4)}" y2="${h - goal / max * (h - 4)}"></line>` : "";
  const total = vals.reduce((a, b) => a + b, 0), days = vals.filter(Boolean).length;
  return `<div class="chart"><div class="lab"><span>${title}</span><span>${days ? "avg " + (total / days).toFixed(unit === "min" ? 0 : 1) + " " + unit + " on " + days + " days" : "no data yet"}</span></div><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${gl}${bars}</svg></div>`;
}
function avg(a) { return a.reduce((x, y) => x + y, 0) / a.length; }
function renderInsights() {
  const st = lastDays(14).map(dayStats);
  $("charts").innerHTML = chart("😴 Sleep (hours)", st.map(x => x.sleep), 10, 8, "h") + chart("💧 Water (glasses)", st.map(x => x.water), 10, 8, "glasses") + chart("🏃 Movement", st.map(x => x.min), Math.max(30, ...st.map(x => x.min)), 0, "min")
    + chart("🙂 Mood (1 to 5)", st.map(x => x.mood == null ? 0 : x.mood + 1), 5, 0, "");
  const pats = [], withMood = st.filter(x => x.mood != null);
  const cmp = (label, a, b, an, bn) => { if (a.length >= 2 && b.length >= 2) { const x = avg(a.map(v => v.mood)), y = avg(b.map(v => v.mood)); if (Math.abs(x - y) >= 0.4) pats.push(`${label}: your mood averages ${MOODS[Math.round(x)]} ${an} versus ${MOODS[Math.round(y)]} ${bn}.`); } };
  cmp("😴 Sleep", withMood.filter(x => x.sleep >= 7), withMood.filter(x => x.sleep > 0 && x.sleep < 7), "after 7+ hours", "after less");
  cmp("🏃 Movement", withMood.filter(x => x.min > 0), withMood.filter(x => x.min === 0), "on days you move", "on days you do not");
  cmp("💧 Water", withMood.filter(x => x.water >= 6), withMood.filter(x => x.water < 6), "with 6+ glasses", "with fewer");
  $("patterns").innerHTML = pats.length ? pats.map(t => `<div class="pat">${esc(t)}</div>`).join("") : `<div class="pat muted">Keep logging your mood, sleep and movement for a week and I will show you what lifts your mood.</div>`;
}
$("revGo").onclick = async () => {
  const b = $("revGo"); b.disabled = true; b.textContent = "Reading your week…";
  try {
    const d = await api("/api/review", { name: S.name, focus: S.focus, streak: streak(), days: lastDays(14).map(dayStats).filter(x => x.mood != null || x.sleep || x.water || x.min || x.tasks || x.habits) });
    const r = d.review; $("revOut").innerHTML = `<div class="rev"><p>${esc(r.summary)}</p><h3>Wins</h3><ul>${r.wins.map(x => `<li>${esc(x)}</li>`).join("")}</ul><h3>Try next week</h3><ul>${r.try.map(x => `<li>${esc(x)}</li>`).join("")}</ul><p class="note">${d.ai ? "Written by AI from your numbers." : "A quick review from your numbers."}</p></div>`;
  } catch (e) { toast(e.message); }
  b.disabled = false; b.textContent = "Get my AI weekly review";
};

/* ---------- daily affirmation ---------- */
const AFFIRM = ["You are allowed to take up space.", "Small steps still count.", "You can do hard things, one minute at a time.", "Being kind to yourself is a skill, and you are practising it.", "You do not need to be perfect to be worth it.",
  "Your voice matters.", "Rest is part of progress.", "You have handled hard days before.", "Nervous and brave can happen at the same time.", "Today you get to try again.", "Progress, not perfect.", "You are more than your worst thought.", "It is okay to ask for help.", "You are growing, even when it does not feel like it."];
$("affirm").textContent = "✨ " + AFFIRM[(new Date().getDate() + new Date().getMonth()) % AFFIRM.length];

/* ---------- mood tags ---------- */
const TAGS = ["School", "Friends", "Family", "Sleep", "Body", "Stress", "Other"];
function renderTags() {
  const c = S.checks[today()]; $("moodTags").className = "pills moodtags"; if (!c || c.mood == null) { $("moodTags").innerHTML = ""; return; }
  $("moodTags").innerHTML = `<span class="hint" style="width:100%;margin:0">What is it about? (optional)</span>` + TAGS.map(t => `<button data-tag="${t}" class="${(c.tags || []).includes(t) ? "on" : ""}">${t}</button>`).join("");
}
$("moodTags").addEventListener("click", e => { const b = e.target.closest("[data-tag]"); if (!b) return; const c = chk(); c.tags = c.tags || []; const i = c.tags.indexOf(b.dataset.tag); if (i >= 0) c.tags.splice(i, 1); else c.tags.push(b.dataset.tag); save(); renderTags(); renderInsights(); });

/* ---------- brave dare ---------- */
const DARES = ["Say hi first to someone you do not usually talk to.", "Ask a question in class or at work, even a small one.", "Give someone a genuine compliment about something they did.", "Wear something you love, even if nobody else notices.", "Say 'no, thank you' to something you do not want, without over-explaining.",
  "Share an opinion in a group chat or a conversation.", "Make eye contact and smile at three people today.", "Ask for help with something instead of struggling alone.", "Introduce yourself to someone new.", "Text a friend you have not talked to in a while.", "Order for yourself, out loud, with a clear voice.", "Say one thing you are proud of to someone.",
  "Disagree politely about something small.", "Try one new thing today, however tiny.", "Stand up straight and speak a little slower in your next conversation.", "Thank someone properly and say why.", "Invite someone to do something with you.", "Do something you enjoy in public, without hiding it.",
  "Tell someone how you really feel about a small thing.", "Ask a teacher or boss a question you were afraid to ask.", "Leave a comment or answer a question where you would normally just watch.", "Take a different route or try a new place today.", "Ask someone about their day and really listen.", "Say 'I do not know yet, let me find out' instead of guessing.",
  "Apologise for something small, or forgive something small.", "Recommend something you love to someone.", "Speak up the first time you have an idea in a group.", "Say yes to a small invitation.", "Do the thing you have been putting off for 5 minutes.", "Write down three brave things you did this month."];
let dareShift = 0;
function todaysDare() { const i = (new Date().getDate() + new Date().getMonth() * 3 + dareShift) % DARES.length; return [i, DARES[i]]; }
function renderDare() {
  const [i, text] = todaysDare(), done = S.braveDone[today()] !== undefined, total = Object.keys(S.braveDone).length;
  $("dareBody").innerHTML = `<div class="inner"><div class="dare">${esc(text)}</div><div class="pills"><button id="dareDone" ${done ? "disabled" : ""}>${done ? "Done today ✓" : "I did it (+2)"}</button><button class="ghost" id="dareSwap">Another dare</button></div><p class="prog">Dares completed: ${total} of 30 for the 30-day Brave Challenge ${total >= 30 ? "🏅" : ""}</p></div>`;
  $("dareDone").onclick = () => { S.braveDone[today()] = i; save(); toast("Brave! +2 points"); renderAll(); };
  $("dareSwap").onclick = () => { dareShift++; renderDare(); };
}

/* ---------- guided routines ---------- */
const ROUTINES = [
  { id: "morning", icon: "🌅", name: "Morning reset (3 min)", steps: [["Stand tall and stretch your arms high above your head.", 25], ["Roll your shoulders back 5 times, slowly.", 20], ["Reach for your toes gently, then roll slowly back up.", 30], ["Drink a glass of water.", 30], ["Name one thing you are looking forward to today.", 25]] },
  { id: "desk", icon: "💺", name: "Desk reset (3 min)", steps: [["Sit tall. Roll your neck slowly left and right.", 25], ["Stretch your arms overhead and lean to each side.", 30], ["Shake out your hands and wrists.", 20], ["Stand up and take 10 slow steps or squats.", 40], ["Look at something far away for 20 seconds.", 20]] },
  { id: "calm", icon: "🌬️", name: "5 minute calm", steps: [["Sit comfortably. Close your eyes if you like.", 15], ["Breathe in for 4 and out for 6. Repeat.", 60], ["Notice 5 things you can hear.", 40], ["Relax your shoulders and your jaw.", 30], ["Think of one kind thing about yourself.", 30]] },
  { id: "night", icon: "🌙", name: "Bedtime wind-down (4 min)", steps: [["Put your phone down, away from your bed.", 20], ["Slowly stretch your back and legs.", 60], ["Write or think of 3 good things from today.", 60], ["Breathe slowly: in for 4, out for 6.", 60], ["Tell yourself: I did enough today.", 20]] },
];
let rout = null;
function renderRoutines() {
  if (rout) return;
  $("routBody").innerHTML = `<div class="inner"><p class="hint">Pick one and just follow along.</p><div class="pills">${ROUTINES.map(r => `<button data-r="${r.id}">${r.icon} ${r.name}</button>`).join("")}</div><p class="prog">Routines done: ${S.routinesDone.length}</p></div>`;
}
function routStep() {
  const r = rout; if (!r) return; const st = r.def.steps[r.i];
  $("routBody").innerHTML = `<div class="inner step"><div class="prog">Step ${r.i + 1} of ${r.def.steps.length}</div><div class="txt">${esc(st[0])}</div><div class="big" id="routClock">${fmt(r.left)}</div><div class="pills" style="justify-content:center"><button id="routNext">Next step</button><button class="ghost" id="routStop">Stop</button></div></div>`;
  $("routNext").onclick = () => routAdvance(); $("routStop").onclick = () => { clearInterval(r.t); rout = null; renderRoutines(); };
}
function routAdvance() {
  const r = rout; r.i++; if (r.i >= r.def.steps.length) { clearInterval(r.t); rout = null; S.routinesDone.push({ date: today(), id: r.def.id }); save(); toast("Routine complete! +1 point"); renderAll(); return; }
  r.left = r.def.steps[r.i][1]; routStep();
}
$("routBody").addEventListener("click", e => {
  const b = e.target.closest("[data-r]"); if (!b || rout) return; const def = ROUTINES.find(x => x.id === b.dataset.r);
  rout = { def, i: 0, left: def.steps[0][1], t: setInterval(() => { rout.left--; const c = $("routClock"); if (c) c.textContent = fmt(Math.max(0, rout.left)); if (rout.left <= 0) routAdvance(); }, 1000) }; routStep();
});

/* ---------- study timer: 25 minutes on, 5 off ---------- */
let study = null;
function renderStudy() {
  const todayMin = S.study.filter(x => x.date === today()).reduce((a, x) => a + x.min, 0);
  if (!study) { $("studyBody").innerHTML = `<div class="inner"><p class="hint">Work for 25 minutes, then rest for 5. Short rests help you remember more.</p><div class="pills"><button id="stGo">Start a 25 minute session</button></div><p class="prog">Studied today: ${todayMin} minutes</p></div>`; $("stGo").onclick = () => startStudy("work"); return; }
  $("studyBody").innerHTML = `<div class="inner step"><div class="prog">${study.phase === "work" ? "Focus: one thing only" : "Break: stretch, water, look away"}</div><div class="big" id="stClock">${fmt(Math.max(0, Math.ceil((study.end - Date.now()) / 1000)))}</div><div class="pills" style="justify-content:center"><button class="ghost" id="stStop">Stop</button></div></div>`;
  $("stStop").onclick = () => { clearInterval(study.t); study = null; renderStudy(); };
}
function startStudy(phase) {
  const mins = phase === "work" ? 25 : 5; if (study) clearInterval(study.t);
  study = { phase, end: Date.now() + mins * 60000, t: setInterval(() => { const left = Math.ceil((study.end - Date.now()) / 1000); const c = $("stClock"); if (c) c.textContent = fmt(Math.max(0, left)); if (left <= 0) { clearInterval(study.t); if (study.phase === "work") { S.study.push({ date: today(), min: 25 }); save(); toast("Session done! Take a 5 minute break."); renderAll(); startStudy("break"); } else { study = null; renderStudy(); toast("Break over. Ready for another?"); } } }, 500) };
  renderStudy();
}

/* ---------- weekly goals ---------- */
const GOALTYPES = { min: ["Move minutes", 150], steps: ["Plan steps done", 14], journal: ["Journal entries", 3], water: ["Days with 6+ glasses of water", 5], habits: ["Habit check-ins", 10], study: ["Study minutes", 150] };
function goalProgress(g) {
  const ws = weekStart(), ds = lastDays(7).filter(d => d >= ws);
  if (g.type === "min") return S.workouts.filter(w => w.date >= ws).reduce((a, w) => a + w.min, 0);
  if (g.type === "steps") return Object.entries(S.done).filter(([d]) => d >= ws).reduce((a, [, l]) => a + l.length, 0);
  if (g.type === "journal") return S.journal.filter(j => j.date >= ws).length;
  if (g.type === "water") return ds.filter(d => (S.checks[d] || {}).water >= 6).length;
  if (g.type === "habits") return S.habits.reduce((a, h) => a + h.days.filter(d => d >= ws).length, 0);
  if (g.type === "study") return S.study.filter(x => x.date >= ws).reduce((a, x) => a + x.min, 0);
  return 0;
}
function renderGoals() {
  $("goalBody").innerHTML = `<div class="inner">${S.goals.length ? S.goals.map((g, i) => { const v = goalProgress(g), pct = Math.min(100, Math.round(v / g.target * 100)); return `<div class="goal"><div class="gt"><span>${esc(GOALTYPES[g.type][0])}: ${v} / ${g.target} ${pct >= 100 ? "✅" : ""}</span><button class="x" data-gdel="${i}" aria-label="Remove goal">×</button></div><div class="mbar"><i style="width:${pct}%"></i></div></div>`; }).join("") : `<p class="hint">Set a goal for this week and watch it fill up on its own.</p>`}
    <div class="row2"><select id="gType">${Object.entries(GOALTYPES).map(([k, [l]]) => `<option value="${k}">${l}</option>`).join("")}</select><input id="gTarget" type="number" min="1" max="999" inputmode="numeric" placeholder="target"><button id="gAdd">Add goal</button></div></div>`;
  const sel = $("gType"), tg = $("gTarget"); const sync = () => { tg.value = GOALTYPES[sel.value][1]; }; sel.onchange = sync; sync();
  $("gAdd").onclick = () => { const t = Math.round(+tg.value); if (!t || t < 1) return toast("Enter a target"); S.goals.push({ type: sel.value, target: t }); save(); renderGoals(); toast("Goal added"); };
}
$("goalBody").addEventListener("click", e => { const x = e.target.closest("[data-gdel]"); if (x) { S.goals.splice(+x.dataset.gdel, 1); save(); renderGoals(); } });

/* ---------- wins wall ---------- */
function renderWins() {
  $("winBody").innerHTML = `<div class="inner"><p class="hint">Write down anything you are proud of, even tiny things. Read them on hard days.</p><form class="send" id="winForm"><input id="winIn" maxlength="120" placeholder="I am proud that I…" autocomplete="off"><button>Add</button></form>
    ${S.wins.slice(-8).reverse().map(w => `<div class="win">🏆 ${esc(w.text)} <small>· ${esc(w.date)}</small></div>`).join("")}<div class="pills"><button class="ghost" id="winRemember">Remind me of a win</button></div><p class="hint" id="winRem"></p><p class="prog">${S.wins.length} wins so far</p></div>`;
  $("winForm").onsubmit = e => { e.preventDefault(); const v = $("winIn").value.trim().slice(0, 120); if (!v) return; S.wins.push({ date: today(), text: v }); save(); toast("Win saved 🏆"); renderAll(); };
}

/* ---------- share my week ---------- */
function weekText() {
  const ws = weekStart(), mins = S.workouts.filter(w => w.date >= ws).reduce((a, w) => a + w.min, 0), steps = Object.entries(S.done).filter(([d]) => d >= ws).reduce((a, [, l]) => a + l.length, 0);
  const lv = Math.floor(Math.sqrt(points() / 25)) + 1;
  return `My Womanten week 🌱\n🔥 ${streak()} day streak · Level ${lv} ${LEVEL_NAMES[Math.min(lv - 1, LEVEL_NAMES.length - 1)]}\n🏃 ${mins} minutes moved · ✅ ${steps} plan steps\n🏆 ${S.wins.length} wins · 🎯 ${Object.keys(S.braveDone).length} brave dares`;
}
function renderShare() {
  $("shareBody").innerHTML = `<div class="inner"><div class="sharebox" id="shareTxt">${esc(weekText())}</div><div class="pills"><button id="shareGo">Share or copy</button></div></div>`;
  $("shareGo").onclick = async () => { const t = weekText(); try { if (navigator.share) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); toast("Copied"); } } catch (e) { toast("Could not share"); } };
}

/* ---------- habit templates ---------- */
const HABIT_IDEAS = ["Drink 8 glasses of water", "Read for 10 minutes", "Walk for 10 minutes", "Stretch for 5 minutes", "Write one line in my journal", "Phone down 30 minutes before bed", "No scrolling for the first 30 minutes of the day", "Say one kind thing to someone", "Tidy my space for 5 minutes", "Practice a hobby for 15 minutes",
  "Eat a fruit or vegetable with every meal", "Be in bed by 10:30", "Write 3 things I am grateful for", "Breathe slowly for 2 minutes", "Study for 25 minutes", "Message a friend", "10 minutes of sunlight", "Plan tomorrow before bed", "Wake up at the same time", "Smile at someone"];
$("addHabit").onclick = () => {
  $("pformBox").innerHTML = `<h2>Add a habit</h2><p class="muted tiny">Pick one, or write your own.</p><div class="pills">${HABIT_IDEAS.map((h, i) => `<button data-hi="${i}">${esc(h)}</button>`).join("")}</div>
    <label class="l" for="hCustom">Or your own</label><input id="hCustom" maxlength="40" placeholder="My own habit"><div class="row2"><button id="hAdd">Add my own</button><button class="ghost" id="hCancel">Close</button></div>`;
  $("pform").hidden = false;
  const add = n => { n = n.trim().slice(0, 40); if (!n) return; if (S.habits.some(h => h.name === n)) return toast("You already have that habit"); S.habits.push({ id: rid(), name: n, days: [] }); save(); renderAll(); toast("Habit added"); };
  $("pformBox").onclick = e => { const b = e.target.closest("[data-hi]"); if (b) { add(HABIT_IDEAS[+b.dataset.hi]); $("pform").hidden = true; } };
  $("hAdd").onclick = () => { add($("hCustom").value); $("pform").hidden = true; }; $("hCancel").onclick = () => { $("pform").hidden = true; };
};

/* ---------- AI: practice a conversation ---------- */
let prMsgs = [], prScene = "hangout";
function renderPractice() {
  $("prChat").innerHTML = prMsgs.map(m => m.role === "tip" ? `<div class="pcard tip">💡 ${esc(m.text)}</div>` : `<div class="msg ${m.role === "user" ? "me" : "bot"}">${esc(m.text)}</div>`).join("");
  $("prChat").scrollTop = 1e6; $("prForm").hidden = !prMsgs.length;
}
async function prTurn() {
  const wait = document.createElement("div"); wait.className = "msg bot"; wait.textContent = "…"; $("prChat").appendChild(wait);
  try {
    const d = await api("/api/practice", { scenario: prScene, name: S.name, messages: prMsgs.filter(m => m.role !== "tip").map(m => ({ role: m.role === "user" ? "user" : "assistant", text: m.text })) });
    if (d.support) prMsgs.push({ role: "bot", text: d.support }); else { prMsgs.push({ role: "bot", text: d.reply }); if (d.tip) prMsgs.push({ role: "tip", text: d.tip }); }
  } catch (e) { prMsgs.push({ role: "bot", text: e.message }); }
  renderPractice();
}
$("prStart").onclick = () => { prScene = $("prScene").value; prMsgs = []; $("prChat").innerHTML = ""; $("prForm").hidden = false; prTurn(); };
$("prForm").addEventListener("submit", e => { e.preventDefault(); const v = $("prIn").value.trim().slice(0, 300); if (!v) return; $("prIn").value = ""; prMsgs.push({ role: "user", text: v }); renderPractice(); prTurn(); S.bonus += 0; });

/* ---------- AI: reframe a harsh thought ---------- */
$("rfGo").onclick = async () => {
  const t = $("rfIn").value.trim(); if (!t) return toast("Write the thought first");
  const b = $("rfGo"); b.disabled = true; b.textContent = "Thinking…";
  try {
    const d = await api("/api/reframe", { thought: t, name: S.name });
    if (d.support) $("rfOut").innerHTML = `<div class="rev"><p>${esc(d.support)}</p></div>`;
    else { const r = d.reframe; $("rfOut").innerHTML = `<div class="rev"><h3>A kinder, truer way to say it</h3><p>${esc(r.reframe)}</p><h3>Ask yourself</h3><ul>${r.questions.map(q => `<li>${esc(q)}</li>`).join("")}</ul><h3>One tiny step today</h3><p>${esc(r.action)}</p></div>`; S.bonus += 2; save(); renderTop(); }
  } catch (e) { toast(e.message); }
  b.disabled = false; b.textContent = "Help me reframe it";
};

/* ---------- confidence check-in: the number this whole app is about ---------- */
function renderConf() {
  const wk = weekStart(), thisWeek = S.conf.find(c => c.week === wk), first = S.conf[0], last = S.conf[S.conf.length - 1];
  const series = S.conf.slice(-12), w = 280, h = 56, bw = w / Math.max(series.length, 1);
  const bars = series.map((c, i) => { const bh = Math.max(2, Math.round(c.v / 10 * (h - 4))); return `<rect x="${i * bw + 2}" y="${h - bh}" width="${Math.max(4, bw - 4)}" height="${bh}" rx="3"></rect>`; }).join("");
  $("confBody").innerHTML = `<div class="inner conf"><p class="hint">How confident do you feel this week, from 1 (not at all) to 10 (very)? Check in once a week and watch it grow.</p>
    <div class="big" id="confVal">${thisWeek ? thisWeek.v : 5}</div><input type="range" id="confRange" min="1" max="10" value="${thisWeek ? thisWeek.v : 5}"><div class="pills" style="justify-content:center"><button id="confSave">${thisWeek ? "Update this week" : "Save this week"}</button></div>
    ${series.length ? `<div class="chart"><div class="lab"><span>Your confidence over time</span><span>${series.length > 1 ? (last.v - first.v >= 0 ? "+" : "") + (last.v - first.v) + " since you started" : "first check-in"}</span></div><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${bars}</svg></div>` : ""}</div>`;
  $("confRange").oninput = e => { $("confVal").textContent = e.target.value; };
  $("confSave").onclick = () => { const v = +$("confRange").value; const ex = S.conf.find(c => c.week === wk); if (ex) { ex.v = v; ex.date = today(); } else { S.conf.push({ week: wk, date: today(), v }); toast("Saved. +3 points"); } save(); renderAll(); };
}

/* ---------- letter to future me ---------- */
function renderCapsules() {
  const t = today(), list = S.capsules.slice().sort((a, b) => a.open.localeCompare(b.open));
  $("capBody").innerHTML = `<div class="inner"><p class="hint">Write a note to yourself. It stays locked until the day you choose, then you can open it.</p><textarea id="capText" maxlength="500" placeholder="Dear future me…"></textarea>
    <div class="row2"><select id="capWhen"><option value="7">Open in 1 week</option><option value="30" selected>Open in 1 month</option><option value="90">Open in 3 months</option><option value="180">Open in 6 months</option></select><button id="capSave">Seal it</button></div>
    ${list.map((c, i) => c.open <= t ? `<div class="cap"><small>Written ${esc(c.written)}, opened ${esc(c.open)}</small>${esc(c.text)}</div>` : `<div class="cap"><small>🔒 Locked until ${esc(c.open)} (written ${esc(c.written)})</small></div>`).join("")}</div>`;
  $("capSave").onclick = () => { const v = $("capText").value.trim().slice(0, 500); if (!v) return toast("Write something first"); const d = new Date(); d.setDate(d.getDate() + +$("capWhen").value); S.capsules.push({ written: today(), open: dstr(d), text: v }); save(); toast("Sealed until " + dstr(d)); renderCapsules(); };
}

/* ---------- bedtime calculator ---------- */
function renderBed() {
  const wake = (S.wake || "07:00"), [h, m] = wake.split(":").map(Number);
  const at = hrs => { const t = (h * 60 + m - hrs * 60 + 1440 * 2) % 1440; return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"); };
  $("bedBody").innerHTML = `<div class="inner"><p class="hint">Teenagers need about 8 to 10 hours of sleep. Tell me when you wake up.</p><div class="row2"><label class="l" for="wakeAt" style="align-self:center">I wake up at</label><input type="time" id="wakeAt" value="${wake}"></div>
    <div class="cyc" style="margin-top:12px"><div><b>${at(10)}</b><span>for 10 hours</span></div><div><b>${at(9)}</b><span>for 9 hours</span></div><div><b>${at(8)}</b><span>for 8 hours</span></div></div><p class="note">Start winding down 30 minutes before. Phone down, lights low.</p></div>`;
  $("wakeAt").onchange = e => { S.wake = e.target.value || "07:00"; save(); renderBed(); };
}

/* ---------- remember a win, and the streak saver ---------- */
$("winBody").addEventListener("click", e => { if (!e.target.closest("#winRemember")) return; if (!S.wins.length) return toast("Add a win first"); const w = S.wins[Math.floor(Math.random() * S.wins.length)]; $("winRem").textContent = "🏆 Remember: " + w.text + " (" + w.date + ")"; });
function renderSaver() {
  const n = streak(), s = $("saver"), doneToday = activeDays().has(today());
  if (n > 0 && !doneToday) { s.hidden = false; s.innerHTML = `🔥 Keep your <b>${n} day streak</b> alive: do one small thing today. Tick a plan step, log a win, or take a 2 minute breath.`; } else s.hidden = true;
}
function renderAll() { renderSaver(); renderConf(); renderCapsules(); renderBed(); renderTags(); renderDare(); renderRoutines(); renderStudy(); renderGoals(); renderWins(); renderShare(); renderLevel(); renderInsights(); renderWorkout(); renderFood(); renderCycle(); renderTop(); renderSlots(); renderHabits(); renderMove(); renderCheck(); renderReview(); renderTodos(); renderJournal(); }
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
