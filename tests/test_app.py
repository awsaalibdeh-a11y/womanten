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
