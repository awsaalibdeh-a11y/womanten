// Run with: node tests/counters.test.js   (the same cases the Android app is tested with)
const assert = require("assert");
const C = require("../static/counters.js");
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

function run(counter, angles, step = 250) { let now = 0, reps = 0; angles.forEach(a => { if (counter.update(a, now)) reps++; now += step; }); return reps; }
const pushup = [170, 160, 130, 95, 85, 100, 140, 165, 172];
const squat = [172, 165, 140, 105, 95, 120, 150, 168, 172];

t("one full push-up is one rep", () => assert.strictEqual(run(new C.RepCounter(), pushup), 1));
t("three push-ups are three", () => assert.strictEqual(run(new C.RepCounter(), [].concat(pushup, pushup, pushup)), 3));
t("a half push-up does not count", () => assert.strictEqual(run(new C.RepCounter(), [170, 150, 125, 130, 160, 170]), 0));
t("standing still is zero", () => assert.strictEqual(run(new C.RepCounter(), Array(30).fill(168)), 0));
t("starting at the bottom does not count", () => assert.strictEqual(run(new C.RepCounter(), [90, 92, 88, 90]), 0));
t("jitter at the top does not count", () => assert.strictEqual(run(new C.RepCounter(), [170, 150, 172, 148, 171, 155, 170]), 0));
t("a very fast wobble is at most one", () => assert.ok(run(new C.RepCounter(), [170, 90, 170, 90, 170], 100) <= 1));
t("NaN is ignored", () => assert.strictEqual(new C.RepCounter().update(NaN, 0), false));
t("squats count from the knee angle", () => assert.strictEqual(run(new C.RepCounter(160, 115), [].concat(squat, squat, squat)), 3));
t("a shallow squat does not count", () => assert.strictEqual(run(new C.RepCounter(160, 115), [172, 150, 130, 128, 150, 172]), 0));
t("angle maths", () => { assert.ok(Math.abs(C.angle(0, 0, 1, 0, 2, 0) - 180) < 0.01); assert.ok(Math.abs(C.angle(0, 1, 0, 0, 1, 0) - 90) < 0.01); assert.ok(isNaN(C.angle(1, 1, 1, 1, 2, 2))); });

const open = () => C.classifyJack(200, 200, 100, 100, 300, 400, 150, 550);
const closed = () => C.classifyJack(200, 200, 320, 320, 300, 400, 340, 360);
t("jack pose classification", () => { assert.strictEqual(open(), true); assert.strictEqual(closed(), false); assert.strictEqual(C.classifyJack(200, 200, 100, 320, 300, 400, 340, 360), null); assert.strictEqual(C.classifyJack(200, 200, 100, 100, 300, 300.5, 0, 10), null); });
t("jumping jacks count on return", () => { const c = new C.JackCounter(); let now = 0, n = 0; for (let i = 0; i < 4; i++) [closed(), open(), open(), closed()].forEach(s => { if (c.update(s, now)) n++; now += 300; }); assert.strictEqual(n, 4); });
t("standing still does not count jacks", () => { const c = new C.JackCounter(); for (let i = 0; i < 20; i++) c.update(closed(), i * 300); assert.strictEqual(c.reps, 0); });
t("plank pays every ten seconds", () => { const p = new C.PlankTimer(); let paid = 0; for (let i = 0; i < 130; i++) if (p.update(170, i * 250)) paid++; assert.strictEqual(paid, 3); });
t("a sagging plank stops the clock", () => { const p = new C.PlankTimer(); let now = 0; for (let i = 0; i < 42; i++) { p.update(170, now); now += 250; } const held = p.heldMs; for (let i = 0; i < 40; i++) { p.update(140, now); now += 250; } assert.strictEqual(p.heldMs, held); assert.ok(p.chunks >= 1); });

// a full session from fake MediaPipe landmarks: an elbow bending and straightening
function pose(elbowDeg) {
  const lm = []; for (let i = 0; i < 33; i++) lm.push({ x: 0.5, y: 0.5, visibility: 1 });
  const r = elbowDeg * Math.PI / 180;                       // shoulder at (0.3,0.5), elbow at (0.5,0.5), wrist rotated by the elbow angle
  lm[11] = { x: 0.3, y: 0.5, visibility: 1 }; lm[13] = { x: 0.5, y: 0.5, visibility: 1 }; lm[15] = { x: 0.5 + 0.2 * Math.cos(Math.PI - r), y: 0.5 - 0.2 * Math.sin(Math.PI - r), visibility: 1 };
  lm[12] = lm[11]; lm[14] = lm[13]; lm[16] = lm[15];
  return lm;
}
t("a session counts push-ups from landmarks", () => { const s = new C.Session("pushup"); let now = 0; for (let k = 0; k < 3; k++) pushup.forEach(a => { s.feed(pose(a), 640, 480, now); now += 250; }); assert.strictEqual(s.reps, 3); });
t("a session with hidden arms asks you to move back", () => { const s = new C.Session("pushup"); const lm = pose(170); lm[13].visibility = 0.1; lm[14].visibility = 0.1; const r = s.feed(lm, 640, 480, 0); assert.strictEqual(r.rep, false); assert.ok(/cannot see/.test(r.msg)); });
console.log("\n" + n + " passed");
