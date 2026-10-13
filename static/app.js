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
function fresh() { return { name: "", focus: [], week: [], done: {}, habits: [], workouts: [], checks: {}, chat: [], pid: rid(), challenges: [], bonus: 0, todos: [], journal: [], workout: null, food: null, shop: {}, cycle: [], woDone: {}, braveDone: {}, routinesDone: [], study: [], goals: [], wins: [], conf: [], capsules: [], mealsDone: {}, lessons: {}, accent: "coral", resets: [] }; }
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
  Object.values(S.lessons || {}).forEach(d => set.add(d));
  (S.resets || []).forEach(r => set.add(r));
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
  return tasks * 10 + Object.keys(S.woDone || {}).length * 15 + habits * 5 + todos * 5 + S.journal.length * 3 + Object.keys(S.braveDone || {}).length * 2 + (S.routinesDone || []).length + Object.values(S.mealsDone || {}).reduce((a, l) => a + l.length, 0) * 2 + (S.conf || []).length * 3 + Object.keys(S.lessons || {}).length * 5 + (S.resets || []).length * 3 + Math.floor((S.wins || []).length / 2) + Math.floor((S.study || []).reduce((a, x) => a + x.min, 0) / 5) + Math.floor(mins / 5) + S.bonus;
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
    <div class="nm">${esc(h.name)}<small>${hStreak(h)} day streak · best ${hBest(h)} · ${hRate(h)}% of the last 30 days</small><div class="dots">${last7().map(d => `<span class="${h.days.includes(d) ? "on" : ""}"></span>`).join("")}</div></div><button class="x" data-del="${h.id}" aria-label="Remove">×</button></div>`).join("")
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
  try { const i = JSON.parse(NATIVE.lockInfo()); $("lockScrolls").textContent = i.enabled ? (i.scrolls > 0 ? i.scrolls + " " + (i.currency || "scrolls") + " left" : "Locked: do " + (i.exercise || "push-ups").toLowerCase()) : "Locks are off"; $("lockSub").textContent = (i.enabled ? "Locked: " + (i.apps.length ? i.apps.join(", ") : "no apps chosen yet") + ". Each " + (i.unit || "push-up") + " earns " + i.perPushup + " " + (i.currency || "scrolls") + "." : "Turn the locks on to start. Each rep earns " + (i.currency || "scrolls") + " on the apps you choose.") + (i.repsToday != null && i.enabled ? "  Today: " + i.repsToday + " reps, " + (i.usedToday || 0) + " " + (i.currency || "scrolls") + " used." : ""); } catch (e) { /* older app */ }
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
  const t = todayRow(f.plan.days), eaten = S.mealsDone[today()] || [], meals = (d, tick) => [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snack", "Snack"]].filter(([k]) => d[k]).map(([k, l]) => `<div class="meal"><b>${l}</b><span>${esc(d[k])}</span>${tick ? `<button class="rb" data-recipe="${k}" aria-label="How to make it" title="How to make it">📖</button><button class="tick ${eaten.includes(k) ? "on" : ""}" data-meal="${k}" aria-label="I had this">✓</button>` : ""}</div>`).join("");
  const shop = f.plan.shopping.map((it, i) => `<label><input type="checkbox" data-shop="${i}" ${S.shop[i] ? "checked" : ""}><span class="${S.shop[i] ? "got" : ""}">${esc(it)}</span></label>`).join("");
  $("fdBody").innerHTML = `<p class="hint">Today, ${esc(t.day)}. Tap the tick when you have eaten a meal (+2).</p>${meals(t, true)}`
    + `<details><summary>See the whole week</summary>${f.plan.days.map(d => `<div class="day"><h3>${d.day}</h3>${meals(d, false)}</div>`).join("")}</details>`
    + `<details><summary>Shopping list (${f.plan.shopping.filter((_, i) => !S.shop[i]).length} to get)</summary><div class="shop">${shop}</div><form class="send" id="shopForm" style="margin-top:8px"><input id="shopIn" maxlength="40" placeholder="Add an item" autocomplete="off"><button>Add</button></form><div class="pills"><button class="ghost" data-clear="1">Clear ticked items</button></div></details>`
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
  ["🎯", "50 points", () => points() >= 50], ["🎓", "5 lessons learned", () => Object.keys(S.lessons || {}).length >= 5], ["♻️", "Weekly reset", () => (S.resets || []).length >= 1], ["🦁", "10 brave dares", () => Object.keys(S.braveDone).length >= 10], ["🏆", "5 wins", () => S.wins.length >= 5], ["🧘", "3 routines", () => S.routinesDone.length >= 3], ["📚", "100 minutes studied", () => S.study.reduce((a, x) => a + x.min, 0) >= 100], ["🚀", "500 points", () => points() >= 500],
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

/* ================= round 4: lessons, workout player, recipes, heatmap, privacy, sounds, themes and more ================= */

/* ---------- accent colours (no blue) ---------- */
const ACCENTS = { coral: ["#e8998d", "#6e3b34"], peach: ["#efb48a", "#6b4a30"], sage: ["#9fcf9f", "#35523a"], lilac: ["#c5a3e8", "#4d3a6b"], gold: ["#e3c36a", "#5e5028"], rose: ["#e68fb2", "#6b3450"] };
function applyAccent() { const a = ACCENTS[S.accent] || ACCENTS.coral; document.documentElement.style.setProperty("--rose", a[0]); document.documentElement.style.setProperty("--rose2", a[1]); }
function renderLook() {
  $("lookBody").innerHTML = `<div class="inner"><p class="hint">Pick the colour you like.</p><div class="swatches">${Object.entries(ACCENTS).map(([k, c]) => `<button class="sw ${S.accent === k ? "on" : ""}" data-ac="${k}" style="background:${c[0]}" aria-label="${k}" title="${k}"></button>`).join("")}</div></div>`;
}
$("lookBody").addEventListener("click", e => { const b = e.target.closest("[data-ac]"); if (!b) return; S.accent = b.dataset.ac; save(); applyAccent(); renderLook(); });
applyAccent();

/* ---------- activity heatmap and best streak ---------- */
function dayScore(d) {
  const c = S.checks[d] || {};
  return (S.done[d] || []).length + S.habits.filter(h => h.days.includes(d)).length + S.workouts.filter(w => w.date === d).length + (c.mood != null ? 1 : 0) + S.wins.filter(w => w.date === d).length
    + S.journal.filter(j => j.date === d).length + S.todos.filter(t => t.done && t.date === d).length + (S.braveDone[d] !== undefined ? 1 : 0) + S.routinesDone.filter(r => r.date === d).length
    + S.study.filter(x => x.date === d).length + (S.mealsDone[d] || []).length + (S.woDone[d] ? 1 : 0);
}
function bestStreak() { const set = activeDays(), days = [...set].sort(); let best = 0, run = 0, prev = null; days.forEach(d => { if (prev) { const gap = Math.round((new Date(d) - new Date(prev)) / 86400000); run = gap === 1 ? run + 1 : 1; } else run = 1; best = Math.max(best, run); prev = d; }); return best; }
function renderHeat() {
  const cell = 14, gap = 3, weeks = 12, w = weeks * (cell + gap), h = 7 * (cell + gap);
  const end = new Date(); const dow = (end.getDay() + 6) % 7; let rects = "", active = 0;
  for (let wk = 0; wk < weeks; wk++) for (let dy = 0; dy < 7; dy++) {
    const d = new Date(end); d.setDate(end.getDate() - dow - (weeks - 1 - wk) * 7 + dy); if (d > end) continue;
    const sc = dayScore(dstr(d)); if (sc) active++;
    rects += `<rect class="${sc >= 4 ? "l3" : sc >= 2 ? "l2" : sc >= 1 ? "l1" : ""}" x="${wk * (cell + gap)}" y="${dy * (cell + gap)}" width="${cell}" height="${cell}" rx="3"><title>${dstr(d)}: ${sc} things</title></rect>`;
  }
  $("heat").innerHTML = `<svg class="heat" viewBox="0 0 ${w} ${h}" role="img" aria-label="Activity over the last 12 weeks">${rects}</svg><p class="prog">Active on ${active} ${active === 1 ? "day" : "days"} in the last 12 weeks · best streak ever: ${bestStreak()} ${bestStreak() === 1 ? "day" : "days"}</p>`;
}

/* ---------- habit stats ---------- */
function hBest(h) { const days = [...h.days].sort(); let best = 0, run = 0, prev = null; days.forEach(d => { run = prev && Math.round((new Date(d) - new Date(prev)) / 86400000) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; }); return best; }
function hRate(h) { const set = new Set(lastDays(30)); return Math.round(h.days.filter(d => set.has(d)).length / 30 * 100); }

/* ---------- on this day ---------- */
function renderMemory() {
  const offs = [[7, "a week ago"], [30, "a month ago"], [90, "3 months ago"], [180, "6 months ago"], [365, "a year ago"]];
  for (const [n, label] of offs) {
    const d = new Date(); d.setDate(d.getDate() - n); const k = dstr(d), items = S.journal.filter(j => j.date === k).map(j => "wrote: " + j.text).concat(S.wins.filter(w => w.date === k).map(w => "were proud that you " + w.text.replace(/^i am proud that i\s*/i, "")));
    if (items.length) { $("memory").textContent = "🕰️ " + label[0].toUpperCase() + label.slice(1) + " you " + items[0].slice(0, 140); return; }
  }
  $("memory").textContent = "";
}

/* ---------- confidence lessons ---------- */
const LESSONS = [
  { id: "skill", icon: "🌱", t: "Confidence is a skill", p: ["Confidence is not a feeling you wait for. It is what you build by doing small things that feel a bit scary and noticing that you survived them.", "Each time you act while nervous, your brain updates its guess about what is safe. That is why small steps work better than big leaps."], tryIt: "Do one tiny scary thing today, like asking a question out loud." },
  { id: "body", icon: "🧍", t: "Body language that helps", p: ["Stand or sit with your shoulders back and your chin level. Take up the space you need. Slow your movements and your speech by a little.", "Your body and mind talk to each other. Standing tall for a minute can make you feel steadier, and it also changes how others read you."], tryIt: "Before your next conversation, relax your shoulders and take one slow breath out." },
  { id: "smalltalk", icon: "💬", t: "Starting a conversation", p: ["You do not need a clever line. Ask a simple open question about something you share: the class, the weather, the food, the game.", "Then listen to the answer and ask one follow-up. People remember feeling listened to far more than they remember what you said."], tryIt: "Ask one person an open question today, and one follow-up." },
  { id: "nerves", icon: "🌬️", t: "Handling nerves", p: ["Nerves and excitement feel almost the same in the body: a fast heart, quick breath. You can tell yourself 'I am excited' instead of 'I am scared'.", "Breathe out longer than you breathe in, for example in for 4 and out for 6. It slows your heart rate within a minute."], tryIt: "Try three slow breaths, in for 4 and out for 6, before something that makes you nervous." },
  { id: "no", icon: "🛑", t: "Saying no kindly", p: ["A good no is short and warm: 'Thanks for asking, but I cannot do that.' You do not need a long excuse. Explaining a lot makes it easier for people to argue.", "Saying no to something protects your yes for the things you care about."], tryIt: "Practise saying 'No, thank you' out loud once, calmly." },
  { id: "kind", icon: "🤍", t: "Being kind to yourself", p: ["Most of us speak to ourselves in a way we would never speak to a friend. Self-kindness is not weakness. People who are kinder to themselves try again faster after a mistake.", "When you notice a harsh thought, ask: what would I say to a friend who felt this way?"], tryIt: "Write down one harsh thought and answer it the way you would answer a friend." },
  { id: "speak", icon: "🙋", t: "Speaking up in a group", p: ["Plan one sentence before you talk. Speak a little slower than feels natural and look at one friendly face. You can start with 'I think...' or 'One idea is...'.", "The first time is the hardest. After that it gets easier, because you have proof that nothing terrible happens."], tryIt: "Share one thought in your next group conversation, even a short one." },
  { id: "criticism", icon: "📝", t: "Handling criticism", p: ["Pause before you answer. Ask yourself: is any of this useful? Take the useful part and leave the rest. Feedback is about what you did, not about who you are.", "If it is unkind or unfair, you can say 'I will think about that' and move on."], tryIt: "Next time you get feedback, say 'Thank you, I will think about it' before reacting." },
  { id: "rejection", icon: "🧱", t: "Dealing with rejection", p: ["Everyone gets turned down, including people who seem very confident. A no usually says more about timing and fit than about your worth.", "Let yourself feel it, then ask what you can learn, and do one small thing to move forward."], tryIt: "Think of a past no that turned out fine, and write down what it taught you." },
  { id: "boundaries", icon: "🧭", t: "Setting boundaries with friends", p: ["A boundary is telling people what you are okay with. Say it calmly and early: 'I am not comfortable with that' or 'I need some time to myself tonight'.", "Good friends respect boundaries. If someone keeps ignoring them, that tells you something important."], tryIt: "Name one thing you need more of or less of from a friend, and think how you would say it kindly." },
];
let lessonOpen = null;
function renderLessons() {
  if (lessonOpen) return openLesson(lessonOpen);
  const done = Object.keys(S.lessons || {}).length;
  $("lessonBody").innerHTML = `<div class="inner"><p class="hint">Ten short lessons, about 2 minutes each. ${done} of ${LESSONS.length} learned.</p>${LESSONS.map(l => `<div class="lesson" data-ls="${l.id}"><span style="font-size:22px">${l.icon}</span><div class="t">${esc(l.t)}<small>${S.lessons[l.id] ? "Learned ✓" : "About 2 minutes"}</small></div><span class="muted">›</span></div>`).join("")}</div>`;
}
function openLesson(id) {
  const l = LESSONS.find(x => x.id === id); lessonOpen = id; const done = !!S.lessons[id];
  $("lessonBody").innerHTML = `<div class="inner lbody"><button class="ghost" id="lsBack">‹ All lessons</button><h3 style="margin-top:12px">${l.icon} ${esc(l.t)}</h3>${l.p.map(x => `<p>${esc(x)}</p>`).join("")}<div class="try"><b>Try it:</b> ${esc(l.tryIt)}</div><div class="pills"><button id="lsDone" ${done ? "disabled" : ""}>${done ? "Learned ✓" : "I learned this (+5)"}</button></div></div>`;
  $("lsBack").onclick = () => { lessonOpen = null; renderLessons(); };
  $("lsDone").onclick = () => { S.lessons[id] = today(); lessonOpen = null; save(); toast("Nice! +5 points"); renderAll(); };
}
$("lessonBody").addEventListener("click", e => { const r = e.target.closest("[data-ls]"); if (r) openLesson(r.dataset.ls); });

/* ---------- weekly reset wizard ---------- */
const RESET_Q = ["What went well this week?", "What was hard, and what did it teach you?", "What is one thing you want to do differently next week?", "Your top 3 intentions for next week (one per line)"];
function renderReset() {
  const when = (S.resets || []).slice(-1)[0];
  $("resetBody").innerHTML = `<div class="inner"><p class="hint">A 3 minute look back and a look ahead. Best on a Sunday.${when ? " Last reset: " + esc(when) + "." : ""}</p><div class="pills"><button id="rsGo">Start my weekly reset</button></div></div>`;
  $("rsGo").onclick = () => runReset();
}
function runReset() {
  const ans = []; let i = 0;
  const show = () => {
    $("pformBox").innerHTML = `<h2>Weekly reset</h2><p class="muted tiny">Question ${i + 1} of ${RESET_Q.length}</p><label class="l" for="rsA">${RESET_Q[i]}</label><textarea id="rsA" maxlength="400" placeholder="Write a few words"></textarea><div class="row2"><button id="rsNext">${i === RESET_Q.length - 1 ? "Finish" : "Next"}</button><button class="ghost" id="rsX">Cancel</button></div>`; $("pform").hidden = false; $("rsA").focus();
    $("rsX").onclick = () => { $("pform").hidden = true; };
    $("rsNext").onclick = () => { ans[i] = $("rsA").value.trim(); i++; if (i < RESET_Q.length) return show();
      S.journal.push({ date: today(), text: ("Weekly reset. Went well: " + (ans[0] || "-") + " | Hard: " + (ans[1] || "-") + " | Different: " + (ans[2] || "-")).slice(0, 600) });
      (ans[3] || "").split(/\n+/).map(x => x.trim()).filter(Boolean).slice(0, 3).forEach(t => S.todos.push({ id: rid(), text: t.slice(0, 80), done: false, date: today() }));
      S.resets.push(today()); save(); $("pform").hidden = true; toast("Reset done. Your intentions are in your to-do list."); renderAll(); };
  };
  show();
}

/* ---------- guided workout player ---------- */
function parseDetail(d) {
  const t = String(d || ""); let sets = 1, secs = 0, reps = 0, m;
  if ((m = t.match(/(\d+)\s*x\s*(\d+)\s*(seconds?|secs?)/i))) { sets = +m[1]; secs = +m[2]; }
  else if ((m = t.match(/(\d+)\s*x\s*(\d+)/i))) { sets = +m[1]; reps = +m[2]; }
  else if ((m = t.match(/(\d+)\s*(minutes?|mins?)/i))) secs = +m[1] * 60;
  else if ((m = t.match(/(\d+)\s*(seconds?|secs?)/i))) secs = +m[1];
  return { sets: Math.min(sets, 6), secs, reps };
}
function startPlayer() {
  const w = S.workout; const day = w && todayRow(w.plan); if (!day || day.rest) return toast("Today is a rest day");
  const steps = []; day.exercises.forEach(e => { const p = parseDetail(e.detail); for (let n = 1; n <= p.sets; n++) { steps.push({ name: e.name, tip: e.tip, set: n, sets: p.sets, secs: p.secs, reps: p.reps, detail: e.detail }); if (n < p.sets) steps.push({ rest: true, secs: 20 }); } steps.push({ rest: true, secs: 25, last: true }); });
  steps.pop(); let i = 0, left = 0, t = null;
  const end = (done) => { clearInterval(t); $("pform").hidden = true; if (done) { S.woDone = S.woDone || {}; S.woDone[today()] = 1; S.workouts.push({ date: today(), type: "Workout", min: +(w.inputs.minutes || 30) }); save(); toast("Workout complete! +15 points"); renderAll(); } };
  const show = () => {
    clearInterval(t); const st = steps[i]; if (!st) return end(true);
    left = st.secs || 0;
    $("pformBox").innerHTML = `<div class="player"><p class="muted tiny">Step ${i + 1} of ${steps.length}</p>` + (st.rest ? `<div class="nm">Rest</div><p class="muted">Shake it out and breathe.</p>` : `<div class="nm">${esc(st.name)}</div><div class="set">Set ${st.set} of ${st.sets}${st.reps ? ": " + st.reps + " reps" : ""}${st.secs ? ": " + st.secs + " seconds" : ""}</div><p class="muted tiny">${esc(st.tip || "")}</p>`)
      + (st.secs ? `<div class="big" id="plClock">${fmt(left)}</div>` : "") + `<div class="row2" style="justify-content:center"><button id="plNext">${st.secs ? "Skip" : "Done"}</button><button class="ghost" id="plQuit">Stop</button></div></div>`;
    $("pform").hidden = false; $("plNext").onclick = () => { i++; show(); }; $("plQuit").onclick = () => end(false);
    if (st.secs) t = setInterval(() => { left--; const c = $("plClock"); if (c) c.textContent = fmt(Math.max(0, left)); if (left <= 0) { i++; show(); } }, 1000);
  };
  show();
}
const _renderWorkout = renderWorkout;
renderWorkout = function () {
  _renderWorkout();
  const w = S.workout, t = w && todayRow(w.plan);
  if (t && !t.rest && !$("woPlay")) { const row = document.querySelector("#woBody .row2"); const b = document.createElement("button"); b.id = "woPlay"; b.className = "ghost"; b.textContent = "▶ Guided workout"; b.onclick = startPlayer; if (row) row.appendChild(b); else $("woBody").insertBefore(b, $("woBody").firstChild.nextSibling); }
};

/* ---------- recipe helper, shopping list upgrades ---------- */
$("fdBody").addEventListener("click", async e => {
  const r = e.target.closest("[data-recipe]"), clr = e.target.closest("[data-clear]");
  if (clr) { const f = S.food, keep = f.plan.shopping.filter((_, i) => !S.shop[i]); f.plan.shopping = keep; S.shop = {}; save(); renderFood(); return; }
  if (!r) return;
  const meal = (todayRow(S.food.plan.days) || {})[r.dataset.recipe]; if (!meal) return;
  $("pformBox").innerHTML = `<h2>${esc(meal)}</h2><p class="muted">Writing a simple recipe…</p>`; $("pform").hidden = false;
  try {
    const d = await api("/api/recipe", { meal, diet: S.food.inputs.diet, allergies: S.food.inputs.allergies }), rc = d.recipe;
    $("pformBox").innerHTML = `<div class="recipe"><h2>${esc(rc.title)}</h2><p class="meta">${esc(rc.time)} · serves ${esc(rc.serves)}</p><h3>Ingredients</h3><ul>${rc.ingredients.map(x => `<li>${esc(x)}</li>`).join("")}</ul><h3>Steps</h3><ol style="margin-left:18px">${rc.steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol>${rc.tip ? `<p class="note">💡 ${esc(rc.tip)}</p>` : ""}<div class="row2"><button id="rcAdd">Add ingredients to my shopping list</button><button class="ghost" id="rcClose">Close</button></div></div>`;
    $("rcClose").onclick = () => { $("pform").hidden = true; };
    $("rcAdd").onclick = () => { const have = new Set(S.food.plan.shopping.map(x => x.toLowerCase())); rc.ingredients.forEach(x => { if (!have.has(x.toLowerCase())) S.food.plan.shopping.push(x.slice(0, 40)); }); save(); $("pform").hidden = true; toast("Added to your shopping list"); renderFood(); };
  } catch (er) { $("pformBox").innerHTML = `<h2>${esc(meal)}</h2><p class="muted">${esc(er.message)}</p><button class="ghost" id="rcClose">Close</button>`; $("rcClose").onclick = () => { $("pform").hidden = true; }; }
});
$("fdBody").addEventListener("submit", e => { if (e.target.id !== "shopForm") return; e.preventDefault(); const v = $("shopIn").value.trim().slice(0, 40); if (!v) return; S.food.plan.shopping.push(v); save(); renderFood(); });

/* ---------- breathing patterns ---------- */
const PATTERNS = { box: { rounds: 4, ph: [["Breathe in…", 4, 1], ["Hold…", 4, 1], ["Breathe out…", 4, 0], ["Hold…", 4, 0]] }, "478": { rounds: 4, ph: [["Breathe in…", 4, 1], ["Hold…", 7, 1], ["Breathe out slowly…", 8, 0]] }, calm: { rounds: 6, ph: [["Breathe in…", 5, 1], ["Breathe out…", 5, 0]] } };
let bT = null;
function stopBreath(msg) { clearTimeout(bT); bT = null; $("circle").classList.remove("big"); $("circle").style.transitionDuration = ""; $("bLabel").textContent = msg || "Ready when you are"; $("bGo").textContent = "Start breathing"; }
$("bGo").onclick = () => {
  if (bT) return stopBreath();
  const pat = PATTERNS[$("bPat").value] || PATTERNS.box; let step = 0, rounds = 0; $("bGo").textContent = "Stop";
  const next = () => { const [txt, secs, big] = pat.ph[step % pat.ph.length]; $("bLabel").textContent = txt; $("circle").style.transitionDuration = secs + "s"; $("circle").classList.toggle("big", !!big); if (navigator.vibrate) navigator.vibrate(20);
    step++; if (step % pat.ph.length === 0 && ++rounds >= pat.rounds) { bT = setTimeout(() => { stopBreath("Well done. Notice how you feel."); S.bonus += 3; save(); renderTop(); }, secs * 1000); return; }
    bT = setTimeout(next, secs * 1000); };
  next();
};

/* ---------- focus sounds (made in the browser, no files) ---------- */
const Sound = { ctx: null, src: null, gain: null, kind: "off" };
function soundBuffer(ctx, kind) {
  const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (kind === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w * 0.6; }
  return buf;
}
function setSound(kind) {
  if (Sound.src) { try { Sound.src.stop(); } catch (e) { /* already stopped */ } Sound.src = null; }
  Sound.kind = kind; if (kind === "off") return;
  try {
    Sound.ctx = Sound.ctx || new (window.AudioContext || window.webkitAudioContext)(); const ctx = Sound.ctx; if (ctx.state === "suspended") ctx.resume();
    const src = ctx.createBufferSource(); src.buffer = soundBuffer(ctx, kind === "brown" ? "brown" : "white"); src.loop = true;
    const gain = ctx.createGain(); gain.gain.value = +(($("sndVol") || {}).value || 0.5) * 0.4; Sound.gain = gain;
    let node = src;
    if (kind === "rain") { const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900; const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 7000; node.connect(hp); hp.connect(lp); node = lp; }
    if (kind === "fan") { const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 600; node.connect(lp); node = lp; }
    node.connect(gain); gain.connect(ctx.destination); src.start(); Sound.src = src;
  } catch (e) { toast("Sound is not available here"); }
}
function renderSound() {
  $("soundBody").innerHTML = `<div class="inner"><p class="hint">Steady background sound can help you concentrate. It is generated on your device. Turn it on, then start a study or focus session.</p><div class="pills">${[["off", "Off"], ["brown", "Brown noise"], ["rain", "Soft rain"], ["fan", "Fan"]].map(([k, l]) => `<button data-snd="${k}" class="${Sound.kind === k ? "on" : ""}">${l}</button>`).join("")}</div><label class="l" for="sndVol" style="font-size:13px">Volume</label><input type="range" id="sndVol" min="0.1" max="1" step="0.05" value="0.5"></div>`;
  $("sndVol").oninput = e => { if (Sound.gain) Sound.gain.gain.value = +e.target.value * 0.4; };
}
$("soundBody").addEventListener("click", e => { const b = e.target.closest("[data-snd]"); if (!b) return; setSound(b.dataset.snd); renderSound(); });

/* ---------- privacy lock (PIN) ---------- */
const PINKEY = "womanten.pin";
async function pinHash(pin, salt) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + ":" + pin)); return [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, "0")).join(""); }
function pinData() { try { return JSON.parse(localStorage.getItem(PINKEY) || "null"); } catch (e) { return null; } }
let pinFails = 0, pinWait = 0, hiddenAt = 0;
function showGate() { if (!pinData()) return; $("pinGate").hidden = false; $("pinIn").value = ""; $("pinMsg").textContent = "Enter your PIN to open."; setTimeout(() => $("pinIn").focus(), 50); }
$("pinGo").onclick = async () => {
  const p = pinData(); if (!p) { $("pinGate").hidden = true; return; }
  if (Date.now() < pinWait) return ($("pinMsg").textContent = "Too many tries. Wait a few seconds.");
  if ((await pinHash($("pinIn").value, p.salt)) === p.hash) { pinFails = 0; $("pinGate").hidden = true; } else { pinFails++; $("pinIn").value = ""; if (pinFails >= 5) { pinWait = Date.now() + 30000; pinFails = 0; $("pinMsg").textContent = "Too many tries. Wait 30 seconds."; } else $("pinMsg").textContent = "That is not it. Try again."; }
};
$("pinIn").addEventListener("keydown", e => { if (e.key === "Enter") $("pinGo").click(); });
$("pinForgot").onclick = () => { if (confirm("The only way in without your PIN is to erase everything in Womanten on this device. Erase it all and start fresh?")) { try { localStorage.removeItem(KEY); localStorage.removeItem(PINKEY); } catch (e) { /* ignore */ } location.reload(); } };
document.addEventListener("visibilitychange", () => { if (document.hidden) hiddenAt = Date.now(); else if (pinData() && hiddenAt && Date.now() - hiddenAt > 120000) showGate(); });
function renderPin() {
  const has = !!pinData();
  $("pinBody").innerHTML = `<div class="inner"><p class="hint">Hide Womanten behind a PIN, useful on a shared tablet or computer. It stops casual snooping. It is not encryption, so use the backup tools to keep your data safe.</p>`
    + (has ? `<p>🔐 A PIN is on.</p><input id="pOld" type="password" inputmode="numeric" maxlength="6" placeholder="Current PIN" style="margin-bottom:8px"><div class="pills"><button id="pRemove">Remove the PIN</button></div>`
      : `<input id="pNew" type="password" inputmode="numeric" maxlength="6" placeholder="New PIN (4 to 6 digits)" style="margin-bottom:8px"><input id="pNew2" type="password" inputmode="numeric" maxlength="6" placeholder="Type it again"><div class="pills"><button id="pSet">Turn on the PIN</button></div>`) + `</div>`;
  if (has) $("pRemove").onclick = async () => { const p = pinData(); if ((await pinHash($("pOld").value, p.salt)) !== p.hash) return toast("That is not your current PIN"); localStorage.removeItem(PINKEY); toast("PIN removed"); renderPin(); };
  else $("pSet").onclick = async () => { const a = $("pNew").value, b = $("pNew2").value; if (!/^\d{4,6}$/.test(a)) return toast("Use 4 to 6 digits"); if (a !== b) return toast("The two PINs do not match"); const salt = rid(); localStorage.setItem(PINKEY, JSON.stringify({ salt, hash: await pinHash(a, salt) })); toast("PIN is on"); renderPin(); };
}
showGate();

/* ---------- move to another device ---------- */
function b64u(bytes) { let s = ""; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function unb64u(t) { const s = atob(t.replace(/-/g, "+").replace(/_/g, "/")), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
async function makeCode() {
  const copy = Object.assign({}, S); const bytes = new TextEncoder().encode(JSON.stringify(copy));
  if (window.CompressionStream) { const cs = new CompressionStream("deflate-raw"), w = cs.writable.getWriter(); w.write(bytes); w.close(); return "WM1:" + b64u(new Uint8Array(await new Response(cs.readable).arrayBuffer())); }
  return "WM0:" + b64u(bytes);
}
async function readCode(code) {
  const c = code.trim(); let json;
  if (c.startsWith("WM1:")) { const ds = new DecompressionStream("deflate-raw"), w = ds.writable.getWriter(); w.write(unb64u(c.slice(4))); w.close(); json = new TextDecoder().decode(await new Response(ds.readable).arrayBuffer()); }
  else if (c.startsWith("WM0:")) json = new TextDecoder().decode(unb64u(c.slice(4))); else throw new Error("That is not a Womanten code.");
  const d = JSON.parse(json); if (typeof d !== "object" || !d.name) throw new Error("That code does not look right."); return d;
}
function renderTransfer() {
  $("moveBody").innerHTML = `<div class="inner"><p class="hint">Use Womanten on your phone and your computer? Make a code on one, paste it on the other. The code contains all your data, so treat it like a password and delete it after.</p><div class="pills"><button id="mvMake">Make my transfer code</button></div><textarea class="code" id="mvOut" readonly hidden></textarea><div class="pills"><button class="ghost" id="mvCopy" hidden>Copy the code</button></div>
    <label class="l" for="mvIn" style="font-size:13px">On the other device, paste a code here</label><textarea class="code" id="mvIn" placeholder="WM1:..."></textarea><div class="pills"><button class="ghost" id="mvLoad">Import (replaces this device's data)</button></div></div>`;
  $("mvMake").onclick = async () => { try { const c = await makeCode(); $("mvOut").value = c; $("mvOut").hidden = false; $("mvCopy").hidden = false; toast("Code ready (" + Math.round(c.length / 1024) + " KB)"); } catch (e) { toast("Could not make a code here"); } };
  $("mvCopy").onclick = async () => { try { await navigator.clipboard.writeText($("mvOut").value); toast("Copied"); } catch (e) { $("mvOut").select(); toast("Press copy on your keyboard"); } };
  $("mvLoad").onclick = async () => { try { const d = await readCode($("mvIn").value); if (!confirm("Replace everything in Womanten on this device with the data from the code?")) return; S = Object.assign(fresh(), d); save(); applyAccent(); renderAll(); renderChat(); toast("Moved! Welcome back, " + S.name); } catch (e) { toast(e.message || "That code did not work"); } };
}

/* ---------- feeling overwhelmed: 5-4-3-2-1 grounding ---------- */
const GROUND = [["5", "Look around and name 5 things you can see."], ["4", "Notice 4 things you can touch or feel, like your feet on the floor."], ["3", "Listen for 3 things you can hear."], ["2", "Find 2 things you can smell, or 2 things you like about yourself."], ["1", "Name 1 good thing, however small."]];
$("overBtn").onclick = () => {
  let i = 0;
  const show = () => {
    if (i >= GROUND.length) { $("pformBox").innerHTML = `<h2>You did it 🤍</h2><p class="muted">Now take three slow breaths: in for 4, out for 6. Your feelings are real, and they will pass.</p><p class="muted tiny">If this feels too big to handle alone, tell a trusted adult today. If you might be in danger, call your local emergency number. You can find a helpline at findahelpline.com.</p><div class="row2"><button id="ovWrite">Write how I feel</button><button class="ghost" id="ovDone">I feel calmer</button></div>`;
      $("ovDone").onclick = () => { $("pform").hidden = true; toast("Well done for taking a moment"); }; $("ovWrite").onclick = () => { $("pform").hidden = true; document.querySelector('[data-tab="today"]').click(); $("moreBox").open = true; $("jText").focus(); $("moreBox").scrollIntoView(); }; return; }
    const [n, t] = GROUND[i]; $("pformBox").innerHTML = `<h2>Let's slow down</h2><p class="muted tiny">Step ${i + 1} of ${GROUND.length}. Take your time.</p><div class="ground"><span class="n">${n}</span>${t}</div><div class="row2"><button id="ovNext">${i === GROUND.length - 1 ? "Finish" : "Next"}</button><button class="ghost" id="ovX">Close</button></div>`;
    $("ovNext").onclick = () => { i++; show(); }; $("ovX").onclick = () => { $("pform").hidden = true; };
  };
  $("pform").hidden = false; show();
};
function renderAll() { renderMemory(); renderHeat(); renderLessons(); renderReset(); renderSound(); renderLook(); renderPin(); renderTransfer(); renderSaver(); renderConf(); renderCapsules(); renderBed(); renderTags(); renderDare(); renderRoutines(); renderStudy(); renderGoals(); renderWins(); renderShare(); renderLevel(); renderInsights(); renderWorkout(); renderFood(); renderCycle(); renderTop(); renderSlots(); renderHabits(); renderMove(); renderCheck(); renderReview(); renderTodos(); renderJournal(); }
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
