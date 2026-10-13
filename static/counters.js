/* Exercise counters: the same maths as the Android app (Exercises.kt / RepCounter.kt), so a rep counts the same everywhere.
   Plain script that also works in Node, so it can be unit tested (tests/counters.test.js). */
(function (root) {
  "use strict";

  /* Counts reps from a joint angle: one rep is a full trip from straight (UP) to bent (DOWN) and back. Light smoothing ignores jitter. */
  function RepCounter(upAbove, downBelow, minGapMs) {
    this.upAbove = upAbove == null ? 150 : upAbove; this.downBelow = downBelow == null ? 105 : downBelow; this.minGapMs = minGapMs == null ? 600 : minGapMs;
    this.reps = 0; this.phase = "unknown"; this.smooth = NaN; this.lastRepAt = -1e9;
  }
  RepCounter.prototype.update = function (angle, now) {
    if (typeof angle !== "number" || isNaN(angle)) return false;
    this.smooth = isNaN(this.smooth) ? angle : this.smooth * 0.4 + angle * 0.6;
    if (this.smooth >= this.upAbove) {
      const finished = this.phase === "down" && now - this.lastRepAt >= this.minGapMs;
      this.phase = "up";
      if (finished) { this.reps++; this.lastRepAt = now; return true; }
    } else if (this.smooth <= this.downBelow && this.phase === "up") this.phase = "down";
    return false;
  };

  /* The angle at b between the lines b-a and b-c, in degrees (0 to 180). */
  function angle(ax, ay, bx, by, cx, cy) {
    const v1x = ax - bx, v1y = ay - by, v2x = cx - bx, v2y = cy - by, n = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
    if (n === 0) return NaN;
    return Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / n))) * 180 / Math.PI;
  }

  /* Jumping jacks: arms up and feet wide is OPEN, arms down and feet together is CLOSED. One jack is open then closed. */
  function JackCounter(minGapMs) { this.minGapMs = minGapMs == null ? 450 : minGapMs; this.reps = 0; this.wasOpen = false; this.lastAt = -1e9; }
  JackCounter.prototype.update = function (state, now) {
    if (state === null || state === undefined) return false;
    if (state) { this.wasOpen = true; return false; }
    if (this.wasOpen && now - this.lastAt >= this.minGapMs) { this.wasOpen = false; this.reps++; this.lastAt = now; return true; }
    if (this.wasOpen) this.wasOpen = false;
    return false;
  };
  /* y grows downward, so "above the shoulder" is a smaller y. Returns true (open), false (closed) or null (in between). */
  function classifyJack(lsY, rsY, lwY, rwY, lsX, rsX, laX, raX) {
    const shoulderW = Math.abs(lsX - rsX);
    if (shoulderW < 1) return null;
    const feet = Math.abs(laX - raX) / shoulderW, sy = (lsY + rsY) / 2, up = lwY < sy && rwY < sy, down = lwY > sy && rwY > sy;
    if (up && feet >= 1.5) return true;
    if (down && feet <= 1.2) return false;
    return null;
  }

  /* Plank: counts seconds of holding a straight line (shoulder, hip, ankle) and pays one "rep" for every full 10 seconds. */
  function PlankTimer(straightAbove, chunkMs) { this.straightAbove = straightAbove == null ? 160 : straightAbove; this.chunkMs = chunkMs || 10000; this.heldMs = 0; this.chunks = 0; this.lastAt = -1; }
  PlankTimer.prototype.update = function (bodyAngle, now) {
    const dt = this.lastAt < 0 ? 0 : Math.max(0, Math.min(500, now - this.lastAt));
    this.lastAt = now;
    if (typeof bodyAngle !== "number" || isNaN(bodyAngle) || bodyAngle < this.straightAbove) return false;
    const before = Math.floor(this.heldMs / this.chunkMs);
    this.heldMs += dt;
    if (Math.floor(this.heldMs / this.chunkMs) > before) { this.chunks++; return true; }
    return false;
  };

  /* MediaPipe landmark numbers */
  const LM = { LS: 11, RS: 12, LE: 13, RE: 14, LW: 15, RW: 16, LH: 23, RH: 24, LK: 25, RK: 26, LA: 27, RA: 28 };
  const EXERCISES = {
    pushup: { label: "Push-ups", unit: "push-up", setup: "Prop the camera on the floor and get in a push-up position so your arms are in view. Go slowly." },
    squat: { label: "Squats", unit: "squat", setup: "Prop the camera at waist height and step back until your whole body is in view." },
    jack: { label: "Jumping jacks", unit: "jumping jack", setup: "Step back until your whole body and both arms are in view." },
    plank: { label: "Plank hold", unit: "10 seconds held", setup: "Put the camera on the floor, side on to you, and hold a straight plank." },
  };

  /* One exercise session. feed(landmarks, w, h, now) returns { rep: boolean, msg: string, held?: seconds } */
  function Session(kind) {
    this.kind = kind; this.reps = 0;
    this.rc = kind === "squat" ? new RepCounter(160, 115) : new RepCounter(150, 105);
    this.jack = new JackCounter(); this.plank = new PlankTimer();
  }
  function pt(lm, i, w, h) { const p = lm[i]; if (!p || (p.visibility != null && p.visibility < 0.5)) return null; return { x: p.x * w, y: p.y * h }; }
  function ang(lm, a, b, c, w, h) { const A = pt(lm, a, w, h), B = pt(lm, b, w, h), C = pt(lm, c, w, h); return A && B && C ? angle(A.x, A.y, B.x, B.y, C.x, C.y) : NaN; }
  function best(l, r) { const a = !isNaN(l), b = !isNaN(r); return a && b ? (l + r) / 2 : a ? l : r; }
  Session.prototype.feed = function (lm, w, h, now) {
    let rep = false, msg = "";
    if (this.kind === "pushup") {
      const a = best(ang(lm, LM.LS, LM.LE, LM.LW, w, h), ang(lm, LM.RS, LM.RE, LM.RW, w, h));
      if (isNaN(a)) return { rep: false, msg: "I cannot see your arms yet. Move back a little." };
      rep = this.rc.update(a, now); msg = this.rc.phase === "down" ? "Now push back up." : "Lower your chest toward the floor.";
    } else if (this.kind === "squat") {
      const a = best(ang(lm, LM.LH, LM.LK, LM.LA, w, h), ang(lm, LM.RH, LM.RK, LM.RA, w, h));
      if (isNaN(a)) return { rep: false, msg: "I cannot see your legs yet. Step back so your whole body is in view." };
      rep = this.rc.update(a, now); msg = this.rc.phase === "down" ? "Now stand tall." : "Sit back and down like a chair.";
    } else if (this.kind === "jack") {
      const ls = pt(lm, LM.LS, w, h), rs = pt(lm, LM.RS, w, h), lw = pt(lm, LM.LW, w, h), rw = pt(lm, LM.RW, w, h), la = pt(lm, LM.LA, w, h), ra = pt(lm, LM.RA, w, h);
      if (!ls || !rs || !lw || !rw || !la || !ra) return { rep: false, msg: "Step back so your whole body and both arms are in view." };
      rep = this.jack.update(classifyJack(ls.y, rs.y, lw.y, rw.y, ls.x, rs.x, la.x, ra.x), now); msg = "Arms up and feet apart, then back together.";
    } else {
      const a = best(ang(lm, LM.LS, LM.LH, LM.LA, w, h), ang(lm, LM.RS, LM.RH, LM.RA, w, h));
      if (isNaN(a)) return { rep: false, msg: "I cannot see your whole body line. Turn side on." };
      rep = this.plank.update(a, now); msg = a >= 160 ? "Hold it. Keep your body in one straight line." : "Lift or lower your hips to make a straight line.";
      return { rep, msg, held: Math.floor(this.plank.heldMs / 1000) };
    }
    if (rep) this.reps++;
    return { rep, msg };
  };

  const api = { RepCounter, JackCounter, PlankTimer, Session, angle, classifyJack, EXERCISES, LM };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.WMCounters = api;
})(typeof window !== "undefined" ? window : globalThis);
