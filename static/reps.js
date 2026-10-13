/* Camera exercise page. Pose detection runs in the browser (MediaPipe), the video never leaves this window.
   Inside the Windows app each rep is also sent to the app, which turns reps into unlocked time. */
const C = window.WMCounters;
const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
const host = window.chrome && window.chrome.webview ? window.chrome.webview : null;           // set inside the Windows app
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const LIB = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
const MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let kind = C.EXERCISES[q.get("ex")] ? q.get("ex") : "pushup", session = new C.Session(kind), landmarker = null, stream = null, running = false, lastVideoTime = -1, earnedHere = 0;

function renderPicker() {
  $("picker").innerHTML = Object.entries(C.EXERCISES).map(([k, e]) => `<button data-k="${k}" class="${k === kind ? "on" : ""}">${e.label}</button>`).join("");
  $("status").textContent = C.EXERCISES[kind].setup;
  $("count").textContent = "0"; $("reward").textContent = "";
}
$("picker").addEventListener("click", e => { const b = e.target.closest("[data-k]"); if (!b || running && false) return; kind = b.dataset.k; session = new C.Session(kind); earnedHere = 0; renderPicker(); });
if (host) { $("back").textContent = "Done, back to Womanten"; $("intro").textContent = "Each rep you do earns time on your locked apps. The video is analysed in this window and never saved or sent anywhere."; }
else $("note").textContent = "On the website, each rep earns you 1 point in Womanten. In the Windows app, reps unlock your locked apps.";

/* what a rep is worth */
function reward(n) {
  if (host) { host.postMessage({ type: "rep", exercise: kind, n }); return; }
  try {                                           // on the website: points in the same private store the app uses
    const raw = localStorage.getItem("womanten.v1"); if (!raw) return; const s = JSON.parse(raw);
    s.bonus = (s.bonus || 0) + n; localStorage.setItem("womanten.v1", JSON.stringify(s)); earnedHere += n; $("reward").textContent = "+" + earnedHere + " points so far";
  } catch (e) { /* storage blocked: the count still works */ }
}

async function loadModel() {
  $("status").textContent = "Loading the pose model (about 6 MB, only the first time)…";
  const { FilesetResolver, PoseLandmarker } = await import(LIB);
  const vision = await FilesetResolver.forVisionTasks(WASM);
  for (const delegate of ["GPU", "CPU"]) {
    try { return await PoseLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: "VIDEO", numPoses: 1 }); }
    catch (e) { if (delegate === "CPU") throw e; }
  }
}

const BONES = [[11, 13], [13, 15], [12, 14], [14, 16], [11, 12], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
function draw(lm, w, h) {
  const cv = $("cv"); cv.width = w; cv.height = h; const g = cv.getContext("2d"); g.clearRect(0, 0, w, h);
  if (!lm) return; g.strokeStyle = "#e8998d"; g.lineWidth = 4; g.fillStyle = "#fff";
  BONES.forEach(([a, b]) => { const p = lm[a], r = lm[b]; if (p && r && p.visibility > 0.5 && r.visibility > 0.5) { g.beginPath(); g.moveTo(p.x * w, p.y * h); g.lineTo(r.x * w, r.y * h); g.stroke(); } });
  lm.forEach(p => { if (p.visibility > 0.5) { g.beginPath(); g.arc(p.x * w, p.y * h, 4, 0, 7); g.fill(); } });
}

function loop() {
  if (!running) return;
  const v = $("vid");
  if (v.readyState >= 2 && v.currentTime !== lastVideoTime) {
    lastVideoTime = v.currentTime;
    const res = landmarker.detectForVideo(v, performance.now()), lm = res.landmarks && res.landmarks[0], w = v.videoWidth, h = v.videoHeight;
    draw(lm, w, h);
    if (!lm) $("status").textContent = "I cannot see you. Step back so your body is in view.";
    else {
      const r = session.feed(lm, w, h, performance.now());
      $("status").textContent = r.msg;
      $("count").textContent = kind === "plank" ? (r.held || 0) + "s" : session.reps;
      if (r.rep) { reward(1); if (navigator.vibrate) navigator.vibrate(30); }
    }
  }
  requestAnimationFrame(loop);
}

async function start() {
  $("go").disabled = true; $("go").textContent = "Starting…";
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    const v = $("vid"); v.srcObject = stream; await v.play(); $("ph").hidden = true;
    if (!landmarker) landmarker = await loadModel();
    running = true; $("go").hidden = true; $("stop").hidden = false; $("status").textContent = C.EXERCISES[kind].setup; requestAnimationFrame(loop);
  } catch (e) {
    $("status").textContent = /Permission|NotAllowed|denied/i.test(String(e)) ? "I need camera permission to count your reps. Allow the camera and try again." : /NotFound|Devices/i.test(String(e)) ? "I could not find a camera on this device." : "I could not start: " + (e.message || e) + ". Check your connection and try again.";
    $("go").disabled = false; $("go").textContent = "Start camera"; stop(false);
  }
}
function stop(reset = true) {
  running = false; if (stream) stream.getTracks().forEach(t => t.stop()); stream = null;
  $("go").hidden = false; $("go").disabled = false; $("go").textContent = "Start camera"; $("stop").hidden = true; $("ph").hidden = false;
  if (reset) $("status").textContent = "Stopped. Well done!";
}
$("go").onclick = start; $("stop").onclick = () => stop();
addEventListener("pagehide", () => stop(false));
renderPicker();
