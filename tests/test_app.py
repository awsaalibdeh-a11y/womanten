import os
import tempfile
import unittest

os.environ["HUB_DISABLED"] = "1"
os.environ.pop("OPENAI_API_KEY", None)
os.environ["WOMANTEN_DB"] = os.path.join(tempfile.mkdtemp(), "t.db")

import app as womanten  # noqa: E402

womanten.load_dotenv = None


class Basics(unittest.TestCase):
    def setUp(self):
        os.environ.pop("OPENAI_API_KEY", None)
        womanten._hits.clear()
        self.c = womanten.app.test_client()

    def test_landing_and_app_are_separate_pages(self):
        land = self.c.get("/").get_data(as_text=True)
        self.assertIn("Confidence,", land); self.assertNotIn('id="slots"', land)
        app_html = self.c.get("/app").get_data(as_text=True)
        self.assertIn('id="slots"', app_html)

    def test_the_android_app_is_sent_to_the_app_screen(self):
        r = self.c.get("/", headers={"User-Agent": "Mozilla/5.0 (Linux; Android 14) WomantenApp"})
        self.assertEqual(r.status_code, 302); self.assertTrue(r.headers["Location"].endswith("/app"))

    def test_camera_page_exists_and_the_camera_is_allowed(self):
        r = self.c.get("/reps")
        self.assertEqual(r.status_code, 200)
        self.assertIn("counters.js", r.get_data(as_text=True))
        self.assertIn("camera=(self)", r.headers["Permissions-Policy"])
        self.assertIn("microphone=()", r.headers["Permissions-Policy"])

    def test_windows_version_endpoint(self):
        d = self.c.get("/api/windows/version").get_json()
        self.assertGreaterEqual(d["build"], 1); self.assertEqual(d["url"], "/download/windows")

    def test_manifest_starts_at_the_app(self):
        self.assertEqual(self.c.get("/manifest.webmanifest").get_json()["start_url"], "/app")

    def test_pages(self):
        self.assertEqual(self.c.get("/").status_code, 200)
        self.assertTrue(self.c.get("/health").get_json()["ok"])

    def test_plan_fallback_has_seven_days(self):
        d = self.c.post("/api/plan", json={"name": "Aws", "focus": ["social", "mindset"]}).get_json()
        self.assertEqual(len(d["week"]), 7)
        self.assertEqual([w["day"] for w in d["week"]], list(womanten.DAYS))
        self.assertTrue(all(w["morning"] and w["afternoon"] and w["evening"] for w in d["week"]))
        self.assertFalse(d["ai"])

    def test_plan_ignores_unknown_focus(self):
        d = self.c.post("/api/plan", json={"focus": ["<script>", "diet"]}).get_json()
        self.assertEqual(len(d["week"]), 7)

    def test_coach_needs_a_message(self):
        self.assertEqual(self.c.post("/api/coach", json={"messages": []}).status_code, 400)

    def test_coach_fallback_replies_and_is_safe_on_crisis(self):
        r = self.c.post("/api/coach", json={"messages": [{"role": "user", "text": "I feel unsafe at home"}]}).get_json()
        self.assertIn("trusted adult", r["reply"])
        r = self.c.post("/api/coach", json={"messages": [{"role": "user", "text": "I am so nervous"}]}).get_json()
        self.assertIn("Next step", r["reply"])

    def test_coach_rules_forbid_looks_and_diets(self):
        self.assertIn("never rate", womanten.COACH_RULES)
        self.assertIn("calorie", womanten.COACH_RULES)

    def test_coach_limit(self):
        for _ in range(60):
            self.c.post("/api/coach", json={"messages": [{"role": "user", "text": "hi"}]})
        self.assertEqual(self.c.post("/api/coach", json={"messages": [{"role": "user", "text": "hi"}]}).status_code, 429)


class Plans(unittest.TestCase):
    def setUp(self):
        os.environ.pop("OPENAI_API_KEY", None)
        womanten._hits.clear()
        self.c = womanten.app.test_client()

    def test_workout_has_seven_days_and_the_right_number_of_training_days(self):
        d = self.c.post("/api/workout", json={"days": 4, "goal": "strength", "minutes": 30}).get_json()
        self.assertEqual(len(d["plan"]), 7)
        self.assertEqual(sum(1 for x in d["plan"] if not x["rest"]), 4)
        self.assertTrue(all(x["exercises"] for x in d["plan"] if not x["rest"]))

    def test_workout_inputs_are_clamped_and_cleaned(self):
        x = womanten.plans.workout_inputs({"days": 99, "minutes": 1, "level": "<b>", "notes": "x" * 500})
        self.assertEqual((x["days"], x["minutes"], x["level"]), (6, 10, "beginner"))
        self.assertEqual(len(x["notes"]), 120)

    def test_food_plan_is_balanced_and_has_a_shopping_list(self):
        d = self.c.post("/api/food", json={"diet": "everything"}).get_json()
        self.assertEqual(len(d["plan"]["days"]), 7)
        self.assertTrue(d["plan"]["shopping"] and d["plan"]["tips"])

    def test_vegetarian_plan_has_no_meat(self):
        d = self.c.post("/api/food", json={"diet": "vegetarian"}).get_json()
        text = " ".join(m for day in d["plan"]["days"] for m in day.values()).lower()
        for w in ("chicken", "beef", "tuna", "fish"):
            self.assertNotIn(w, text)

    def test_vegan_plan_has_no_animal_products(self):
        d = self.c.post("/api/food", json={"diet": "vegan"}).get_json()
        text = " ".join(m for day in d["plan"]["days"] for m in day.values()).lower()
        for w in ("chicken", "beef", "tuna", "egg", "cheese", "yoghurt", "milk"):
            self.assertNotIn(w, text)

    def test_allergies_are_respected_in_the_fallback(self):
        d = self.c.post("/api/food", json={"diet": "everything", "allergies": "nuts, eggs"}).get_json()
        text = " ".join(m for day in d["plan"]["days"] for m in day.values()).lower()
        self.assertNotIn("nuts", text)
        self.assertNotIn("eggs", text)

    def test_rules_forbid_calories_and_weight_loss(self):
        for w in ("calorie", "losing weight", "fasting"):
            self.assertIn(w, womanten.plans.PLAN_RULES)

    def test_no_calorie_or_weight_loss_talk_in_the_builtin_plans(self):
        text = str(womanten.plans.MEALS).lower() + str(womanten.plans.MOVES).lower()
        for w in ("calorie", "lose weight", "fat burn", "slim", "diet"):
            self.assertNotIn(w, text)

    def test_bad_ai_output_falls_back(self):
        with self.assertRaises(Exception):
            womanten.plans.clean_food('{"days":[]}', {})
        with self.assertRaises(Exception):
            womanten.plans.clean_workout('{"days":[{"day":"Mon"}]}', {})


class Review(unittest.TestCase):
    def setUp(self):
        os.environ.pop("OPENAI_API_KEY", None)
        womanten._hits.clear()
        self.c = womanten.app.test_client()

    def test_empty_review_is_encouraging(self):
        r = self.c.post("/api/review", json={"days": []}).get_json()["review"]
        self.assertTrue(r["summary"] and r["wins"] and r["try"])

    def test_review_uses_the_numbers(self):
        days = [{"d": f"2026-10-0{i}", "mood": 3, "sleep": 5, "water": 2, "min": 0, "tasks": 1, "habits": 1} for i in range(1, 6)]
        r = self.c.post("/api/review", json={"days": days, "streak": 5}).get_json()["review"]
        self.assertIn("5 day streak", " ".join(r["wins"]))
        self.assertIn("sleep", " ".join(r["try"]).lower())

    def test_review_cleans_junk_input(self):
        r = self.c.post("/api/review", json={"days": ["x", {"d": "<script>" * 9, "mood": 99, "sleep": "abc", "water": -4}] * 30, "streak": "NaN"})
        self.assertEqual(r.status_code, 200)

    def test_review_has_no_weight_or_calorie_talk(self):
        text = str(womanten.plans.fallback_review([{"d": "x", "mood": 1, "sleep": 4, "water": 1, "min": 0, "tasks": 0, "habits": 0}] * 7, 0)).lower()
        for w in ("calorie", "weight", "diet", "look"):
            self.assertNotIn(w, text)

    def test_bad_ai_review_is_rejected(self):
        with self.assertRaises(Exception):
            womanten.plans.clean_review('{"summary":"","wins":[],"try":[]}')


class Support(unittest.TestCase):
    def setUp(self):
        os.environ.pop("OPENAI_API_KEY", None)
        womanten._hits.clear()
        self.c = womanten.app.test_client()

    def test_crisis_words_get_the_support_message_everywhere(self):
        r = self.c.post("/api/coach", json={"messages": [{"role": "user", "text": "i want to die"}]}).get_json()
        self.assertTrue(r["support"]); self.assertIn("trusted adult", r["reply"]); self.assertIn("findahelpline.com", r["reply"])
        r = self.c.post("/api/reframe", json={"thought": "I want to kill myself"}).get_json()
        self.assertIn("trusted adult", r["support"])
        r = self.c.post("/api/practice", json={"scenario": "class", "messages": [{"role": "user", "text": "I hurt myself"}]}).get_json()
        self.assertIn("trusted adult", r["support"])

    def test_reframe_needs_a_thought_and_returns_all_parts(self):
        self.assertEqual(self.c.post("/api/reframe", json={"thought": ""}).status_code, 400)
        r = self.c.post("/api/reframe", json={"thought": "Nobody likes me"}).get_json()["reframe"]
        self.assertTrue(r["reframe"] and r["questions"] and r["action"])

    def test_practice_opens_and_continues_for_every_scenario(self):
        for sc in womanten.plans.SCENARIOS:
            first = self.c.post("/api/practice", json={"scenario": sc, "messages": []}).get_json()
            self.assertTrue(first["reply"])
            self.assertEqual(first["tip"], "")
            nxt = self.c.post("/api/practice", json={"scenario": sc, "messages": [{"role": "bot", "text": first["reply"]}, {"role": "user", "text": "Hi, I wanted to ask you something"}]}).get_json()
            self.assertTrue(nxt["reply"] and nxt["tip"])

    def test_unknown_scenario_is_safe(self):
        self.assertEqual(self.c.post("/api/practice", json={"scenario": "<x>", "messages": []}).status_code, 200)

    def test_crisis_detector_does_not_fire_on_normal_talk(self):
        for ok in ("I am nervous about my exam", "I want to kill it in my presentation", "I like cutting vegetables"):
            self.assertFalse(womanten.plans.is_crisis(ok), ok)

    def test_bad_ai_output_is_rejected(self):
        for fn, raw in ((womanten.plans.clean_reframe, '{"reframe":""}'), (womanten.plans.clean_practice, '{"reply":""}')):
            with self.assertRaises(Exception):
                fn(raw)


class Recipe(unittest.TestCase):
    def setUp(self):
        os.environ.pop("OPENAI_API_KEY", None)
        womanten._hits.clear()
        self.c = womanten.app.test_client()

    def test_recipe_has_ingredients_and_steps(self):
        r = self.c.post("/api/recipe", json={"meal": "Lentil and tomato stew with brown rice", "diet": "vegan"}).get_json()["recipe"]
        self.assertTrue(r["title"] and len(r["ingredients"]) >= 2 and len(r["steps"]) >= 2)

    def test_recipe_needs_a_meal(self):
        self.assertEqual(self.c.post("/api/recipe", json={"meal": ""}).status_code, 400)

    def test_bad_ai_recipe_is_rejected(self):
        with self.assertRaises(Exception):
            womanten.plans.clean_recipe('{"title":"x","ingredients":["a"],"steps":["b"]}')

    def test_recipe_text_has_no_diet_talk(self):
        text = str(womanten.plans.fallback_recipe("Oats")).lower()
        for w in ("calorie", "weight", "diet"):
            self.assertNotIn(w, text)


class Challenges(unittest.TestCase):
    def setUp(self):
        womanten._hits.clear()
        self.c = womanten.app.test_client()
        self.a, self.b = "aaaaaaaa11", "bbbbbbbb22"

    def make(self):
        return self.c.post("/api/challenge", json={"title": "Walk 10 min", "days": 7, "name": "Aws", "pid": self.a}).get_json()

    def test_create_join_checkin_leaderboard(self):
        v = self.make()
        code = v["code"]
        self.assertEqual(len(code), 6)
        j = self.c.post(f"/api/challenge/{code}/join", json={"name": "Mum", "pid": self.b}).get_json()
        self.assertEqual(len(j["people"]), 2)
        self.c.post(f"/api/challenge/{code}/checkin", json={"pid": self.a})
        self.c.post(f"/api/challenge/{code}/checkin", json={"pid": self.a})          # same day twice counts once
        v = self.c.get(f"/api/challenge/{code.lower()}").get_json()
        self.assertEqual(v["people"][0]["name"], "Aws")
        self.assertEqual(v["people"][0]["done"], 1)

    def test_must_join_before_checkin(self):
        code = self.make()["code"]
        self.assertEqual(self.c.post(f"/api/challenge/{code}/checkin", json={"pid": "zzzzzzzz99"}).status_code, 404)

    def test_bad_input(self):
        self.assertEqual(self.c.post("/api/challenge", json={"title": "", "name": "A", "pid": self.a}).status_code, 400)
        self.assertEqual(self.c.post("/api/challenge", json={"title": "x", "name": "A", "pid": "short"}).status_code, 400)
        self.assertEqual(self.c.get("/api/challenge/NOPE00").status_code, 404)

    def test_days_are_clamped(self):
        v = self.c.post("/api/challenge", json={"title": "x", "days": 9999, "name": "A", "pid": self.a}).get_json()
        self.assertEqual(v["days"], 30)

    def test_full_at_twelve(self):
        code = self.make()["code"]
        for i in range(11):
            self.c.post(f"/api/challenge/{code}/join", json={"name": f"P{i}", "pid": f"pppppppp{i:02d}"})
        r = self.c.post(f"/api/challenge/{code}/join", json={"name": "Late", "pid": "llllllll99"})
        self.assertEqual(r.status_code, 400)


if __name__ == "__main__":
    unittest.main()
