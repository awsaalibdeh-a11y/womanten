"""AI workout plans and food plans. Both fall back to a built-in plan if the AI is off or slow.
Safety rules baked in: no calorie counts, no weight-loss or fat-loss advice, no restrictive diets, no body-shape goals.
Plans are about energy, strength, mood and health, and they assume the reader could be a teenager."""

import json
import random
import re

DAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")

PLAN_RULES = (
    "You write friendly, practical plans. Hard rules: never give calorie counts or calorie targets, never mention losing weight or fat, never suggest "
    "skipping meals, fasting, cutting food groups or 'clean eating', and never comment on anyone's body or looks. Plans are about energy, strength, mood, "
    "sleep and enjoying food. Assume the reader may be a teenager: keep exercise moderate and sensible, include rest, and say to stop if something hurts. "
    "If they mention a medical condition, injury or allergy, tell them to check with a doctor or parent and keep the plan gentle. Reply with JSON only."
)

LEVELS = ("beginner", "some", "regular")
PLACES = ("home", "gym", "outdoors")
EQUIP = ("none", "bands", "dumbbells")
GOALS = ("strength", "energy", "flexibility", "stamina")
DIETS = ("everything", "vegetarian", "vegan", "halal", "pescatarian")


def clean(text, n):
    return re.sub(r"\s+", " ", str(text or "")).strip()[:n]


def pick(value, allowed, default):
    return value if value in allowed else default


def workout_inputs(d):
    try:
        days = int(d.get("days"))
    except (TypeError, ValueError):
        days = 3
    try:
        minutes = int(d.get("minutes"))
    except (TypeError, ValueError):
        minutes = 30
    return {
        "level": pick(d.get("level"), LEVELS, "beginner"), "days": min(6, max(2, days)), "minutes": min(60, max(10, minutes)),
        "place": pick(d.get("place"), PLACES, "home"), "equipment": pick(d.get("equipment"), EQUIP, "none"),
        "goal": pick(d.get("goal"), GOALS, "energy"), "notes": clean(d.get("notes"), 120),
    }


def food_inputs(d):
    return {
        "diet": pick(d.get("diet"), DIETS, "everything"), "allergies": clean(d.get("allergies"), 100), "dislikes": clean(d.get("dislikes"), 100),
        "budget": pick(d.get("budget"), ("low", "medium"), "medium"), "cooking": pick(d.get("cooking"), ("quick", "normal"), "quick"),
    }


# ---------------------------------------------------------------- workout
def workout_prompt(x):
    return (f"Make a 7-day workout plan (Mon to Sun) for a {x['level']} who can train {x['days']} days a week, about {x['minutes']} minutes a session, "
            f"at {x['place']} with {x['equipment']} equipment, goal: {x['goal']}. Limits or injuries: {x['notes'] or 'none'}. "
            'JSON: {"days":[{"day":"Mon","title":"short title","rest":false,"warmup":"one line","exercises":[{"name":"...","detail":"3 x 12 or 30 seconds","tip":"one short form tip"}],"cooldown":"one line"}]}. '
            f"Exactly 7 items. Exactly {x['days']} training days spread out, the other days rest days (rest:true, exercises:[], a gentle suggestion in warmup like a walk). "
            "4 to 6 exercises per training day. Only use the equipment they have.")


def clean_workout(raw, x):
    days = (json.loads(raw) or {}).get("days") or []
    out = []
    for i, d in enumerate(days[:7]):
        rest = bool(d.get("rest"))
        ex = [{"name": clean(e.get("name"), 60), "detail": clean(e.get("detail"), 40), "tip": clean(e.get("tip"), 120)} for e in (d.get("exercises") or [])[:8] if isinstance(e, dict) and clean(e.get("name"), 60)]
        out.append({"day": DAYS[i], "title": clean(d.get("title"), 50) or ("Rest" if rest else "Workout"), "rest": rest or not ex,
                    "warmup": clean(d.get("warmup"), 140), "exercises": [] if rest else ex, "cooldown": clean(d.get("cooldown"), 140)})
    if len(out) != 7 or sum(1 for d in out if not d["rest"]) < 1:
        raise ValueError("bad plan")
    return out


MOVES = {
    "strength": [("Bodyweight squats", "3 x 12", "Knees follow your toes, chest up."), ("Wall or knee push-ups", "3 x 8", "Keep your body in a straight line."), ("Glute bridges", "3 x 12", "Squeeze at the top for a second."),
                 ("Plank", "3 x 20 seconds", "Do not let your hips sag."), ("Reverse lunges", "2 x 8 each leg", "Take a big step back and go slowly.")],
    "energy": [("March in place", "2 minutes", "Swing your arms and breathe easily."), ("Jumping jacks", "3 x 20 seconds", "Land softly."), ("Bodyweight squats", "2 x 10", "Stand tall at the top."),
               ("Skater steps", "2 x 30 seconds", "Side to side, light on your feet."), ("Dance to a song you love", "3 minutes", "Just move and enjoy it.")],
    "flexibility": [("Cat and cow", "10 slow breaths", "Move with your breathing."), ("Child's pose", "30 seconds", "Relax your shoulders."), ("Hamstring stretch", "30 seconds each leg", "Reach, do not bounce."),
                    ("Hip opener lunge", "30 seconds each side", "Keep your front knee over your ankle."), ("Seated spinal twist", "20 seconds each side", "Sit tall and turn gently.")],
    "stamina": [("Brisk walk or easy jog", "10 minutes", "You should still be able to talk."), ("High knees", "3 x 20 seconds", "Quick but controlled."), ("Step-ups on a stair", "3 x 12", "Push through your whole foot."),
                ("Mountain climbers", "3 x 20 seconds", "Slow it down if your form slips."), ("Easy walk to cool down", "5 minutes", "Let your heart rate settle.")],
}


def fallback_workout(x):
    gaps = {2: (1, 4), 3: (0, 2, 4), 4: (0, 1, 3, 4), 5: (0, 1, 2, 4, 5), 6: (0, 1, 2, 3, 4, 5)}[x["days"]]
    moves = MOVES[x["goal"]]
    out = []
    for i, day in enumerate(DAYS):
        if i in gaps:
            ex = [{"name": n, "detail": dt, "tip": t} for n, dt, t in random.sample(moves, 4 if x["minutes"] <= 30 else 5)]
            out.append({"day": day, "title": x["goal"].capitalize() + " session", "rest": False, "warmup": "3 minutes of easy marching and arm circles.", "exercises": ex, "cooldown": "Stretch your legs and shoulders for 3 minutes."})
        else:
            out.append({"day": day, "title": "Rest and recover", "rest": True, "warmup": "A gentle 10 minute walk if you feel like it.", "exercises": [], "cooldown": ""})
    return out


# ---------------------------------------------------------------- food
def food_prompt(x):
    return (f"Make a 7-day balanced eating plan (Mon to Sun) for someone who eats: {x['diet']}. Allergies (never include these): {x['allergies'] or 'none'}. Dislikes: {x['dislikes'] or 'none'}. "
            f"Budget: {x['budget']}. Cooking time: {x['cooking']}. "
            'JSON: {"days":[{"day":"Mon","breakfast":"...","lunch":"...","dinner":"...","snack":"..."}],"shopping":["item", ...],"tips":["tip", ...]}. '
            "Exactly 7 days. Each meal is one short line with real food, simple to make, a mix of protein, whole grains or starch, and vegetables or fruit, and a different dish most days. "
            "shopping: 18 to 28 items for the week, grouped in the order of a supermarket. tips: 3 short tips about enjoying food, drinking water and regular meals.")


def clean_food(raw, x):
    d = json.loads(raw) or {}
    out = []
    for i, day in enumerate((d.get("days") or [])[:7]):
        out.append({"day": DAYS[i], **{k: clean(day.get(k), 120) for k in ("breakfast", "lunch", "dinner", "snack")}})
    if len(out) != 7 or not all(m["breakfast"] and m["lunch"] and m["dinner"] for m in out):
        raise ValueError("bad plan")
    shop = [clean(s, 40) for s in (d.get("shopping") or [])[:40] if clean(s, 40)]
    tips = [clean(t, 140) for t in (d.get("tips") or [])[:5] if clean(t, 140)]
    return {"days": out, "shopping": shop, "tips": tips}


MEALS = {
    "breakfast": ["Oats with banana and a spoon of peanut butter", "Wholegrain toast with eggs and tomato", "Yoghurt with fruit and nuts", "Scrambled eggs with spinach on toast", "Smoothie with milk, fruit and oats"],
    "lunch": ["Chicken and veggie wrap with hummus", "Lentil soup with bread", "Tuna and sweetcorn sandwich with salad", "Rice with beans, peppers and cheese", "Pasta with tomato sauce and vegetables"],
    "dinner": ["Baked chicken, rice and roasted vegetables", "Chickpea and vegetable curry with rice", "Fish, potatoes and green beans", "Vegetable stir fry with eggs and noodles", "Beef or bean chilli with rice"],
    "snack": ["An apple and a handful of nuts", "Carrot sticks and hummus", "Yoghurt and fruit", "Cheese and crackers", "A banana"],
}
MEAT = ("chicken", "tuna", "beef", "fish")


def fallback_food(x):
    def ok(m):
        low = m.lower()
        if x["diet"] in ("vegetarian", "vegan") and any(w in low for w in MEAT + ("egg",) if x["diet"] == "vegan" or w != "egg"):
            return False
        if x["diet"] == "vegan" and any(w in low for w in ("cheese", "yoghurt", "milk", "egg")):
            return False
        if x["diet"] == "pescatarian" and any(w in low for w in ("chicken", "beef")):
            return False
        for bad in re.split(r"[,;/]| and ", (x["allergies"] + "," + x["dislikes"]).lower()):
            if len(bad.strip()) > 2 and bad.strip() in low:
                return False
        return True
    days = []
    for i, day in enumerate(DAYS):
        row = {"day": day}
        for k, opts in MEALS.items():
            good = [m for m in opts if ok(m)] or ["Something you enjoy that fits how you eat"]
            row[k] = good[i % len(good)]
        days.append(row)
    shop = ["Oats", "Wholegrain bread", "Rice", "Pasta", "Eggs", "Milk or plant milk", "Yoghurt", "Bananas", "Apples", "Tomatoes", "Carrots", "Spinach", "Peppers", "Onions", "Lentils or beans", "Chickpeas", "Hummus", "Nuts", "Cheese"]
    tips = ["Eat regular meals so your energy stays steady.", "Drink water through the day.", "Eating food you enjoy is part of being healthy."]
    return {"days": days, "shopping": shop, "tips": tips}


# ---------------------------------------------------------------- weekly review
def clean_days(raw):
    out = []
    for d in (raw or [])[-14:]:
        if not isinstance(d, dict):
            continue
        def num(k, hi):
            try:
                return max(0, min(hi, float(d.get(k) or 0)))
            except (TypeError, ValueError):
                return 0
        mood = d.get("mood")
        out.append({"d": clean(d.get("d"), 10), "mood": int(mood) if isinstance(mood, (int, float)) and 0 <= mood <= 4 else None,
                    "sleep": num("sleep", 14), "water": num("water", 20), "min": num("min", 600), "tasks": num("tasks", 3), "habits": num("habits", 30)})
    return out


def review_prompt(days, streak, name, focus):
    rows = "\n".join(f"{d['d']}: mood {d['mood'] if d['mood'] is not None else '-'}/4, sleep {d['sleep']:g} h, water {d['water']:g} glasses, moved {d['min']:g} min, plan steps {d['tasks']:g}, habits {d['habits']:g}" for d in days)
    return (f"{name or 'The user'} is working on: {', '.join(focus) or 'confidence and habits'}. Current streak: {streak} days. Their last days (mood 0 is lowest, 4 is highest):\n{rows}\n\n"
            'Write a short, kind weekly review. JSON: {"summary":"2 sentences about the real pattern you see in these numbers","wins":["2 or 3 specific wins, using the numbers"],"try":["2 small, concrete things to try next week"]}. '
            "Only mention patterns that are actually in the data. Never mention weight, calories, looks or dieting.")


def clean_review(raw):
    d = json.loads(raw) or {}
    summary = clean(d.get("summary"), 400)
    wins = [clean(w, 160) for w in (d.get("wins") or [])[:4] if clean(w, 160)]
    nxt = [clean(w, 160) for w in (d.get("try") or [])[:4] if clean(w, 160)]
    if not summary or not wins or not nxt:
        raise ValueError("bad review")
    return {"summary": summary, "wins": wins, "try": nxt}


def fallback_review(days, streak):
    if not days:
        return {"summary": "Log a few days and I will show you patterns in your mood, sleep and movement.", "wins": ["You opened Womanten. That is the first step."], "try": ["Tick one plan step today.", "Tap a mood face tonight."]}
    n = len(days)
    sleepy = [d["sleep"] for d in days if d["sleep"] > 0]
    avg_sleep = sum(sleepy) / len(sleepy) if sleepy else 0
    active = sum(1 for d in days if d["min"] > 0)
    moods = [d["mood"] for d in days if d["mood"] is not None]
    avg_water = sum(d["water"] for d in days) / n
    wins, nxt = [], []
    if streak >= 3:
        wins.append(f"You are on a {streak} day streak. Showing up is the hard part.")
    if active >= 3:
        wins.append(f"You moved on {active} of the last {n} days.")
    if avg_sleep >= 7:
        wins.append(f"You averaged {avg_sleep:.1f} hours of sleep. That really helps.")
    if avg_water >= 6:
        wins.append(f"You averaged {avg_water:.0f} glasses of water a day.")
    if not wins:
        wins.append("You are tracking your days, which is how habits start.")
    if sleepy and avg_sleep < 7:
        nxt.append(f"Your sleep averages {avg_sleep:.1f} hours. Try going to bed 30 minutes earlier on three nights.")
    if active < 3:
        nxt.append("Add a 10 minute walk on two more days.")
    if avg_water < 6:
        nxt.append("Keep a water bottle next to you and aim for 6 glasses.")
    if not nxt:
        nxt.append("Keep going, and try one thing that feels a little scary this week.")
    mood_txt = ""
    if moods:
        m = sum(moods) / len(moods)
        mood_txt = " Your mood has been " + ("mostly good." if m >= 2.7 else "up and down." if m >= 1.7 else "low lately, which is okay. Talk to someone you trust.")
    return {"summary": f"You logged {n} recent days.{mood_txt}", "wins": wins[:3], "try": nxt[:2]}


# ---------------------------------------------------------------- safety, reframing and conversation practice
CRISIS_WORDS = ("kill myself", "suicid", "end my life", "want to die", "hurt myself", "self harm", "self-harm", "cutting myself", "being abused", "he hits me", "she hits me", "starve myself", "unsafe at home", "i am unsafe")

SUPPORT_MESSAGE = ("I am really glad you told me, and I am taking it seriously. You deserve support right now, and you do not have to carry this alone. "
                   "Please tell a trusted adult today, like a parent, relative, teacher or school counselor. If you might be in danger or might hurt yourself, call your local emergency number right now. "
                   "You can also find a free helpline for your country at findahelpline.com. Next step: send one adult you trust the message 'I need to talk'.")


def is_crisis(text):
    t = (text or "").lower()
    return any(w in t for w in CRISIS_WORDS)


def reframe_prompt(thought, name):
    return (f"{name or 'Someone'} wrote this harsh thought about themselves: \"{thought}\". Help them see it more kindly and accurately, like a gentle CBT coach. "
            'JSON: {"reframe":"one kind, realistic sentence they could say instead","questions":["2 short questions that test whether the thought is really true"],"action":"one tiny action for today"}. '
            "Never agree that they look bad or are worthless. Never mention weight, calories or dieting.")


def clean_reframe(raw):
    d = json.loads(raw) or {}
    out = {"reframe": clean(d.get("reframe"), 260), "questions": [clean(q, 160) for q in (d.get("questions") or [])[:3] if clean(q, 160)], "action": clean(d.get("action"), 200)}
    if not out["reframe"] or not out["questions"] or not out["action"]:
        raise ValueError("bad reframe")
    return out


def fallback_reframe(thought):
    t = clean(thought, 120)
    return {"reframe": "That thought is a feeling, not a fact. A kinder and truer version: 'This is hard right now, and I am still learning and still worth good things.'",
            "questions": [f"What is the evidence for and against \"{t}\"?", "What would you say to a friend who thought this about themselves?"],
            "action": "Write down one thing you handled okay this week, however small."}


SCENARIOS = {
    "hangout": ("Asking a friend to hang out", "a classmate you would like to get to know better"),
    "class": ("Speaking up in class", "a friendly teacher listening to you share an idea"),
    "cafe": ("Ordering at a cafe", "a cheerful cafe worker"),
    "say-no": ("Saying no politely", "a friend who keeps asking you to do something you do not want to do"),
    "new": ("Meeting someone new", "a friendly person at a gathering, meeting you for the first time"),
    "help": ("Asking a teacher for help", "a kind teacher after class"),
}


def practice_prompt(scenario, name):
    title, role = SCENARIOS[scenario]
    return (f"This is a short practice conversation for building social confidence. Scenario: {title}. You play {role}. {name or 'The user'} is practising. "
            "Stay in character in 1 or 2 short sentences, friendly and realistic (not perfect, not mean). Then give one short coaching tip about what they just said "
            "(praise something specific, or suggest one small improvement). If there are no messages yet, start the scene with your opening line. "
            'Reply with JSON only: {"reply":"...","tip":"..."}. Never comment on looks or bodies.')


def clean_practice(raw):
    d = json.loads(raw) or {}
    out = {"reply": clean(d.get("reply"), 300), "tip": clean(d.get("tip"), 220)}
    if not out["reply"]:
        raise ValueError("bad reply")
    return out


FALLBACK_LINES = {
    "hangout": ["Hey! What's up?", "Oh, that sounds fun. When were you thinking?", "Sure, I would like that. See you then!"],
    "class": ["Go ahead, I am listening.", "That is an interesting point. Can you tell me more?", "Thank you for sharing that."],
    "cafe": ["Hi there! What can I get you?", "Sure. Anything else with that?", "Great, that will be ready in a few minutes."],
    "say-no": ["Come on, just this once?", "Really? Why not?", "Okay, fair enough. I get it."],
    "new": ["Hi, I do not think we have met. I am Sam.", "Nice to meet you! How do you know everyone here?", "That is cool. What do you like to do?"],
    "help": ["Of course. What do you need help with?", "I see. Which part is confusing?", "Let us go through it together."],
}
FALLBACK_TIPS = ["Good start. A friendly tone and a clear sentence go a long way.", "Try adding a question back so the conversation goes both ways.", "Nice. Eye contact and a calm voice make you sound confident."]


def fallback_practice(scenario, turns):
    lines = FALLBACK_LINES[scenario]
    return {"reply": lines[min(turns, len(lines) - 1)], "tip": FALLBACK_TIPS[min(turns, len(FALLBACK_TIPS) - 1)] if turns else ""}


# ---------------------------------------------------------------- recipe helper
def recipe_prompt(meal, diet, allergies):
    return (f'Give a simple recipe for this meal: "{meal}". The person eats: {diet}. Allergies (never include these): {allergies or "none"}. '
            'JSON: {"title":"short name","time":"like 15 minutes","serves":"1","ingredients":["amount and ingredient", ...],"steps":["short step", ...],"tip":"one helpful tip"}. '
            "5 to 10 ingredients, 3 to 7 steps, easy for a beginner, no special equipment. Never mention calories, weight or dieting.")


def clean_recipe(raw):
    d = json.loads(raw) or {}
    out = {"title": clean(d.get("title"), 80), "time": clean(d.get("time"), 30), "serves": clean(d.get("serves"), 20) or "1",
           "ingredients": [clean(i, 80) for i in (d.get("ingredients") or [])[:14] if clean(i, 80)],
           "steps": [clean(i, 200) for i in (d.get("steps") or [])[:10] if clean(i, 200)], "tip": clean(d.get("tip"), 200)}
    if not out["title"] or len(out["ingredients"]) < 2 or len(out["steps"]) < 2:
        raise ValueError("bad recipe")
    return out


def fallback_recipe(meal):
    m = clean(meal, 100) or "your meal"
    return {"title": m, "time": "15 to 20 minutes", "serves": "1", "ingredients": ["The foods named in the meal, in the amounts you like", "A little oil, salt and pepper or your favourite spices", "Water to drink with it"],
            "steps": ["Wash your hands and prepare the ingredients: wash, peel and chop what needs it.", "Cook the warm parts of the meal until they are hot all the way through, and put the cold parts together.", "Put it all on a plate, taste it and add seasoning.", "Sit down and enjoy it without rushing."],
            "tip": "Start the part that takes longest first, and tidy as you go."}
