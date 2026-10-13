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
