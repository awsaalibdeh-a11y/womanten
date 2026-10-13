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
