"""Womanten: a confidence and habits coach. Your plan, habits and check-ins stay in your own browser.
The server does three things: asks the AI coach, builds a weekly plan, and runs friend challenges (the only shared data)."""

import contextlib
import json
import os
import random
import re
import secrets
import sqlite3
import threading
import time

import requests
from flask import Flask, jsonify, render_template, request, send_from_directory

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import plans  # noqa: E402

app = Flask(__name__)
import hubguard  # noqa: E402  (the owner's universal switches, kept in Cramly)
hubguard.install(app, "womanten")

MODEL = os.environ.get("OPENAI_MODEL", "gpt-5-mini")
EFFORT = os.environ.get("OPENAI_REASONING_EFFORT", "minimal")
OPENAI_URL = "https://api.openai.com/v1/chat/completions"
DB_PATH = os.environ.get("WOMANTEN_DB", os.path.join(os.path.dirname(os.path.abspath(__file__)), "womanten.db"))
FOCUS = ("confidence", "fitness", "social", "mindset")

COACH_RULES = (
    "You are Womanten's coach: warm, direct and practical, like a wise older sister. You help with confidence, social skills, mindset, "
    "habits and gentle everyday movement. Rules you never break: never rate, compare or criticise anyone's looks or body; never give "
    "weight-loss, calorie, fasting or dieting advice (if it comes up, say a doctor or parent is the right person); keep exercise advice "
    "general and gentle. If someone mentions self-harm, abuse, an eating disorder or feeling unsafe, respond with care and encourage them to "
    "tell a trusted adult and to contact local emergency services or a helpline. Answer in under 110 words and end with one small, concrete "
    "next step they can do today."
)

LIBRARY = {
    "confidence": [
        ("Stand tall for one minute and say one thing you are proud of out loud.", "Write down one thing you handled well today."),
        ("Do one small thing that feels a bit scary, like asking a question in class.", "List 3 wins from this week, however small."),
        ("Say 'no, thank you' once without explaining or apologising.", "Say 'I did my best today' to yourself in the mirror."),
    ],
    "fitness": [
        ("A 10-minute walk, outside if you can.", "Stretch your back and shoulders for 5 minutes."),
        ("10 squats and 10 wall push-ups, slow and steady.", "A gentle 5-minute stretch before bed."),
        ("Dance to two songs you love.", "Drink a glass of water and note how your body feels."),
    ],
    "social": [
        ("Start one conversation with a real question, not just hi.", "Text someone you like and tell them one thing you appreciate."),
        ("Give one genuine compliment about something they did, not how they look.", "Reflect: what made the conversation go well?"),
        ("Make eye contact and smile at three people today.", "Plan one thing to do with a friend this week."),
    ],
    "mindset": [
        ("Write one worry and one thing you can actually do about it.", "Write down 3 things you are grateful for."),
        ("When a harsh thought shows up, answer it like you would a friend.", "Take 5 slow breaths: in for 4, out for 6."),
        ("Do 5 minutes of something just because you enjoy it.", "Put your phone away 30 minutes before sleep."),
    ],
}
DAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")

# ---------------------------------------------------------------- limits
_lock = threading.Lock()
_hits = {}
_day = {"date": "", "n": 0}
DAILY = int(os.environ.get("AI_DAILY_LIMIT", "500"))


def limited(kind, per_hour):
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "?").split(",")[0].strip()
    now = time.time()
    with _lock:
        bucket = [t for t in _hits.get((kind, ip), []) if now - t < 3600]
        if len(bucket) >= per_hour:
            _hits[(kind, ip)] = bucket
            return True
        bucket.append(now)
        _hits[(kind, ip)] = bucket
        if kind in ("coach", "plan"):
            today = time.strftime("%Y-%m-%d")
            if _day["date"] != today:
                _day.update(date=today, n=0)
            _day["n"] += 1
            if _day["n"] > DAILY:
                return True
    return False


def err(msg, code=400):
    return jsonify(error=msg), code


def clean(text, n):
    return re.sub(r"\s+", " ", str(text or "")).strip()[:n]


# ---------------------------------------------------------------- AI
def ai_on():
    return bool(os.environ.get("OPENAI_API_KEY"))


def ask(messages, want_json=False, max_tokens=700):
    body = {"model": MODEL, "messages": messages, "reasoning_effort": EFFORT, "max_completion_tokens": max_tokens}
    if want_json:
        body["response_format"] = {"type": "json_object"}
    r = requests.post(OPENAI_URL, json=body, headers={"Authorization": "Bearer " + os.environ["OPENAI_API_KEY"]}, timeout=45)
    if r.status_code >= 400:
        raise RuntimeError(f"OpenAI {r.status_code}")
    return r.json()["choices"][0]["message"]["content"] or ""


def fallback_coach(text):
    t = text.lower()
    if any(w in t for w in ("hurt myself", "kill myself", "suicide", "self harm", "self-harm", "abuse", "unsafe")):
        return ("I am really glad you told me. You deserve support right now. Please tell a trusted adult today, and if you might be in danger, "
                "contact your local emergency number or a helpline. Next step: send one adult you trust the message 'I need to talk'.")
    if any(w in t for w in ("nervous", "anxious", "scared", "afraid", "shy")):
        return "Feeling nervous means it matters to you. Try a slow breath out for longer than the breath in, three times. Next step: do the smallest version of the scary thing for two minutes."
    if any(w in t for w in ("friend", "lonely", "talk to", "social")):
        return "Connection grows from small, real moments. Ask one curious question and then listen to the answer. Next step: message someone you like and ask about their week."
    if any(w in t for w in ("confidence", "confident", "insecure", "not good enough")):
        return "Confidence is built by doing, not by waiting to feel ready. Pick one thing slightly outside your comfort zone and do it badly on purpose. Next step: write down what you will try today."
    return "Thank you for telling me. Let us make it small: what is one thing within your control about this? Next step: write it down and do the first two minutes of it today."


# ---------------------------------------------------------------- challenges (the only shared data)
@contextlib.contextmanager
def db():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init_db():
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS challenges (code TEXT PRIMARY KEY, title TEXT, days INTEGER, created REAL);
        CREATE TABLE IF NOT EXISTS members (code TEXT, pid TEXT, name TEXT, PRIMARY KEY (code, pid));
        CREATE TABLE IF NOT EXISTS checkins (code TEXT, pid TEXT, day INTEGER, PRIMARY KEY (code, pid, day));
        """)


init_db()


def day_index(created):
    return int((time.time() - created) // 86400)


def view(code):
    with db() as c:
        ch = c.execute("SELECT * FROM challenges WHERE code=?", (code,)).fetchone()
        if not ch:
            return None
        people = []
        for m in c.execute("SELECT * FROM members WHERE code=?", (code,)).fetchall():
            days = [r["day"] for r in c.execute("SELECT day FROM checkins WHERE code=? AND pid=?", (code, m["pid"])).fetchall()]
            people.append({"pid": m["pid"], "name": m["name"], "done": len(days), "days": sorted(days)})
    people.sort(key=lambda p: (-p["done"], p["name"].lower()))
    today = day_index(ch["created"])
    return {"code": ch["code"], "title": ch["title"], "days": ch["days"], "today": today, "over": today >= ch["days"], "people": people}


def pid_ok(pid):
    return bool(re.fullmatch(r"[a-z0-9]{8,32}", str(pid or "")))


# ---------------------------------------------------------------- routes
@app.get("/")
def home():
    return render_template("index.html", ai=ai_on())


@app.get("/manifest.webmanifest")
def manifest():
    return jsonify(name="Womanten", short_name="Womanten", start_url="/", display="standalone", background_color="#0a0a0a", theme_color="#0a0a0a",
                   description="A confidence and habits coach.", icons=[{"src": "/static/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any"}])


@app.get("/sw.js")
def sw():
    return app.response_class("self.addEventListener('install',e=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',()=>{});",
                              mimetype="application/javascript")


@app.get("/download")
def download():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
    if not os.path.exists(os.path.join(path, "womanten.apk")):
        return err("The Android app is not uploaded yet.", 404)
    return send_from_directory(path, "womanten.apk", as_attachment=True, mimetype="application/vnd.android.package-archive")


@app.get("/health")
def health():
    return jsonify(ok=True, ai=ai_on())


@app.post("/api/coach")
def coach():
    if limited("coach", 60):
        return err("The coach is resting for a bit. Try again soon.", 429)
    d = request.get_json(silent=True) or {}
    msgs = [{"role": "user" if m.get("role") == "user" else "assistant", "content": clean(m.get("text"), 600)}
            for m in (d.get("messages") or [])[-10:] if isinstance(m, dict) and clean(m.get("text"), 600)]
    if not msgs or msgs[-1]["role"] != "user":
        return err("Say something first.")
    name = clean(d.get("name"), 30) or "friend"
    focus = [f for f in (d.get("focus") or []) if f in FOCUS]
    if plans.is_crisis(msgs[-1]["content"]):
        return jsonify(reply=plans.SUPPORT_MESSAGE, ai=False, support=True)
    if not ai_on():
        return jsonify(reply=fallback_coach(msgs[-1]["content"]), ai=False)
    system = COACH_RULES + f" The person's name is {name}." + (f" They want to work on: {', '.join(focus)}." if focus else "")
    try:
        reply = clean(ask([{"role": "system", "content": system}] + msgs, max_tokens=500), 900)
    except Exception:
        return jsonify(reply=fallback_coach(msgs[-1]["content"]), ai=False)
    return jsonify(reply=reply or fallback_coach(msgs[-1]["content"]), ai=True)


def library_week(focus):
    areas = [f for f in focus if f in FOCUS] or list(FOCUS)
    week = []
    for i, day in enumerate(DAYS):
        a = areas[i % len(areas)]
        am, pm = random.choice(LIBRARY[a])
        b = areas[(i + 1) % len(areas)]
        mid, _ = random.choice(LIBRARY[b])
        week.append({"day": day, "morning": am, "afternoon": mid, "evening": pm})
    return week


@app.post("/api/plan")
def plan():
    if limited("plan", 20):
        return err("Too many plans for now. Try again later.", 429)
    d = request.get_json(silent=True) or {}
    focus = [f for f in (d.get("focus") or []) if f in FOCUS]
    name = clean(d.get("name"), 30) or "friend"
    if ai_on():
        prompt = (f"Make a 7-day confidence plan for {name}, focusing on: {', '.join(focus) or 'all four areas'}. "
                  'Reply with JSON only: {"days":[{"day":"Mon","morning":"...","afternoon":"...","evening":"..."}, ... 7 items Mon to Sun]}. '
                  "Each task is one short, doable action (under 90 characters), kind and concrete, no looks or weight advice, "
                  "morning = start the day, afternoon = a small brave or social step, evening = reflect or wind down.")
        try:
            raw = ask([{"role": "system", "content": COACH_RULES}, {"role": "user", "content": prompt}], want_json=True, max_tokens=1600)
            days = json.loads(raw).get("days") or []
            week = [{"day": DAYS[i], **{k: clean(x.get(k), 120) for k in ("morning", "afternoon", "evening")}} for i, x in enumerate(days[:7]) if isinstance(x, dict)]
            if len(week) == 7 and all(w["morning"] and w["afternoon"] and w["evening"] for w in week):
                return jsonify(week=week, ai=True)
        except Exception:
            pass
    return jsonify(week=library_week(focus), ai=False)


def ai_plan(prompt, clean_fn, inputs, fallback_fn, key):
    """Ask the AI for a plan; if it is off, slow or sends something unusable, give the built-in plan instead."""
    if ai_on():
        try:
            raw = ask([{"role": "system", "content": plans.PLAN_RULES}, {"role": "user", "content": prompt(inputs)}], want_json=True, max_tokens=3500)
            return jsonify({key: clean_fn(raw, inputs), "ai": True, "inputs": inputs})
        except Exception:
            pass
    return jsonify({key: fallback_fn(inputs), "ai": False, "inputs": inputs})


@app.post("/api/workout")
def workout_plan():
    if limited("plan", 20):
        return err("Too many plans for now. Try again later.", 429)
    x = plans.workout_inputs(request.get_json(silent=True) or {})
    return ai_plan(plans.workout_prompt, plans.clean_workout, x, plans.fallback_workout, "plan")


@app.post("/api/food")
def food_plan():
    if limited("plan", 20):
        return err("Too many plans for now. Try again later.", 429)
    x = plans.food_inputs(request.get_json(silent=True) or {})
    return ai_plan(plans.food_prompt, plans.clean_food, x, plans.fallback_food, "plan")


@app.post("/api/review")
def review():
    if limited("plan", 20):
        return err("Too many reviews for now. Try again later.", 429)
    d = request.get_json(silent=True) or {}
    days = plans.clean_days(d.get("days"))
    try:
        streak = max(0, min(999, int(d.get("streak") or 0)))
    except (TypeError, ValueError):
        streak = 0
    name, focus = clean(d.get("name"), 30), [f for f in (d.get("focus") or []) if f in FOCUS]
    if ai_on() and days:
        try:
            raw = ask([{"role": "system", "content": plans.PLAN_RULES}, {"role": "user", "content": plans.review_prompt(days, streak, name, focus)}], want_json=True, max_tokens=900)
            return jsonify(review=plans.clean_review(raw), ai=True)
        except Exception:
            pass
    return jsonify(review=plans.fallback_review(days, streak), ai=False)


@app.post("/api/reframe")
def reframe():
    if limited("plan", 20):
        return err("Too many for now. Try again later.", 429)
    d = request.get_json(silent=True) or {}
    thought = clean(d.get("thought"), 300)
    if not thought:
        return err("Write the thought first.")
    if plans.is_crisis(thought):
        return jsonify(support=plans.SUPPORT_MESSAGE, ai=False)
    if ai_on():
        try:
            raw = ask([{"role": "system", "content": plans.PLAN_RULES}, {"role": "user", "content": plans.reframe_prompt(thought, clean(d.get("name"), 30))}], want_json=True, max_tokens=700)
            return jsonify(reframe=plans.clean_reframe(raw), ai=True)
        except Exception:
            pass
    return jsonify(reframe=plans.fallback_reframe(thought), ai=False)


@app.post("/api/practice")
def practice():
    if limited("coach", 80):
        return err("Take a short break and try again soon.", 429)
    d = request.get_json(silent=True) or {}
    scenario = d.get("scenario") if d.get("scenario") in plans.SCENARIOS else "hangout"
    msgs = [{"role": "user" if m.get("role") == "user" else "assistant", "content": clean(m.get("text"), 400)}
            for m in (d.get("messages") or [])[-12:] if isinstance(m, dict) and clean(m.get("text"), 400)]
    if msgs and plans.is_crisis(msgs[-1]["content"]):
        return jsonify(support=plans.SUPPORT_MESSAGE, ai=False)
    turns = sum(1 for m in msgs if m["role"] == "user")
    if ai_on():
        try:
            raw = ask([{"role": "system", "content": plans.practice_prompt(scenario, clean(d.get("name"), 30))}] + (msgs or [{"role": "user", "content": "(Start the scene.)"}]), want_json=True, max_tokens=500)
            out = plans.clean_practice(raw)
            if not turns:
                out["tip"] = ""                       # nothing has been said yet, so there is nothing to coach
            return jsonify({**out, "ai": True})
        except Exception:
            pass
    return jsonify({**plans.fallback_practice(scenario, turns), "ai": False})


@app.post("/api/challenge")
def challenge_new():
    if limited("challenge", 20):
        return err("Slow down a little.", 429)
    d = request.get_json(silent=True) or {}
    title, name, pid = clean(d.get("title"), 60), clean(d.get("name"), 24), d.get("pid")
    days = d.get("days")
    if not title or not name or not pid_ok(pid):
        return err("Give the challenge a title and your name.")
    days = min(30, max(3, int(days))) if str(days).isdigit() else 7
    code = "".join(random.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(6))
    with db() as c:
        c.execute("INSERT INTO challenges VALUES (?,?,?,?)", (code, title, days, time.time()))
        c.execute("INSERT INTO members VALUES (?,?,?)", (code, pid, name))
    return jsonify(view(code))


@app.post("/api/challenge/<code>/join")
def challenge_join(code):
    d = request.get_json(silent=True) or {}
    name, pid = clean(d.get("name"), 24), d.get("pid")
    code = code.upper()
    if not name or not pid_ok(pid):
        return err("Add your name first.")
    v = view(code)
    if not v:
        return err("No challenge has that code.", 404)
    if len(v["people"]) >= 12 and not any(p["pid"] == pid for p in v["people"]):
        return err("That challenge is full (12 people).")
    with db() as c:
        c.execute("INSERT OR REPLACE INTO members VALUES (?,?,?)", (code, pid, name))
    return jsonify(view(code))


@app.post("/api/challenge/<code>/checkin")
def challenge_checkin(code):
    d = request.get_json(silent=True) or {}
    pid, code = d.get("pid"), code.upper()
    v = view(code)
    if not v or not pid_ok(pid) or not any(p["pid"] == pid for p in v["people"]):
        return err("Join the challenge first.", 404)
    if v["over"]:
        return err("This challenge has finished.")
    with db() as c:
        c.execute("INSERT OR IGNORE INTO checkins VALUES (?,?,?)", (code, pid, v["today"]))
    return jsonify(view(code))


@app.get("/api/challenge/<code>")
def challenge_get(code):
    v = view(code.upper())
    return jsonify(v) if v else err("No challenge has that code.", 404)


@app.after_request
def headers(resp):
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Referrer-Policy"] = "same-origin"
    resp.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return resp


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5165)))
