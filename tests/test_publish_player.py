#!/usr/bin/env python3
"""Unit tests for tools/publish_player.py (gate, clip limits, idempotent JSON, SQL)."""
import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("publish_player", ROOT / "tools" / "publish_player.py")
pp = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(pp)


def _write_input(folder: Path, slug: str, meta: dict, clips: int = 1, cover: bool = True):
    d = folder / slug
    d.mkdir(parents=True)
    (d / "clips").mkdir()
    (d / "player.json").write_text(json.dumps(meta), encoding="utf-8")
    if cover:
        # 1x1 PNG
        (d / "cover.png").write_bytes(
            bytes.fromhex(
                "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
                "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
            )
        )
    for i in range(1, clips + 1):
        (d / "clips" / f"clip{i}.mp4").write_bytes(b"fake-mp4-" + str(i).encode())
    return d


def _meta(**kw):
    base = {
        "name": "Test Player",
        "gradYear": 2030,
        "position": "C/3B",
        "height": "5'6",
        "weight": "150 lbs",
        "school": "Test High School",
        "location": "Test, IL",
        "team": "Travel Team",
        "title": "TEST PLAYER IS A STUD",
        "package": "basic",
        "report": "A short approved write-up.",
    }
    base.update(kw)
    return base


class GateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: shutil.rmtree(self.tmp, ignore_errors=True))

    def test_valid_basic(self):
        _write_input(self.tmp, "test-player", _meta(), clips=3)
        self.assertEqual(pp.validate_slugs(["test-player"], self.tmp), [])

    def test_basic_rejects_four_clips(self):
        _write_input(self.tmp, "test-player", _meta(package="basic"), clips=4)
        problems = pp.validate_slugs(["test-player"], self.tmp)
        self.assertTrue(any("at most 3" in p for p in problems), problems)

    def test_pro_allows_eight_rejects_nine(self):
        _write_input(self.tmp, "pro-player", _meta(package="Pro $49"), clips=8)
        self.assertEqual(pp.validate_slugs(["pro-player"], self.tmp), [])
        shutil.rmtree(self.tmp / "pro-player")
        _write_input(self.tmp, "pro-player", _meta(package="pro"), clips=9)
        problems = pp.validate_slugs(["pro-player"], self.tmp)
        self.assertTrue(any("at most 8" in p for p in problems), problems)

    def test_elite_unlimited(self):
        _write_input(self.tmp, "elite-player", _meta(package="elite"), clips=12)
        self.assertEqual(pp.validate_slugs(["elite-player"], self.tmp), [])

    def test_missing_required_and_cover(self):
        _write_input(self.tmp, "bad-player", {"name": "X", "package": "basic"}, clips=0, cover=False)
        problems = pp.validate_slugs(["bad-player"], self.tmp)
        joined = " ".join(problems)
        self.assertIn("missing required field", joined)
        self.assertIn("cover", joined)

    def test_rejects_phone_and_email(self):
        _write_input(self.tmp, "kid-player", _meta(phone="555-0100", contactEmail="a@b.c"), clips=1)
        problems = pp.validate_slugs(["kid-player"], self.tmp)
        self.assertTrue(any("phone" in p for p in problems), problems)
        self.assertTrue(any("contactEmail" in p or "email" in p.lower() for p in problems), problems)

    def test_bad_slug(self):
        problems = pp.validate_slugs(["Colin Lopez"], self.tmp)
        self.assertTrue(any("slug must be" in p for p in problems), problems)

    def test_normalizes_height_weight_package(self):
        _write_input(self.tmp, "norm-player", _meta(height="5’6", weight="150lbs", package="BASIC"), clips=1)
        src = pp.load_input("norm-player", self.tmp)
        self.assertEqual(src["meta"]["height"], "5'6\"")
        self.assertEqual(src["meta"]["weight"], "150 lb")
        self.assertEqual(src["meta"]["package"], "basic")


class JsonAndSqlTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(lambda: shutil.rmtree(self.tmp, ignore_errors=True))
        _write_input(self.tmp, "colin-lopez", _meta(
            name="Colin Lopez", title="COLIN LOPEZ IS A STUD", package="basic",
            school="Lemont High School", location="Lemont, Illinois", team="Bolingbrook Rampage",
            report="Colin Lopez is a hard-working 2030 prospect."
        ), clips=3)

    def test_upsert_is_idempotent(self):
        path = self.tmp / "players.json"
        path.write_text("[]\n", encoding="utf-8")
        e = pp.build_entry("colin-lopez", pp.load_input("colin-lopez", self.tmp))
        pp.upsert_players_json([e], path)
        pp.upsert_players_json([e], path)
        data = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["slug"], "colin-lopez")
        self.assertEqual(len(data[0]["videos"]), 3)
        self.assertEqual(data[0]["coverImage"], "images/players/colin-lopez.jpg")

    def test_upsert_moves_to_front_and_keeps_others(self):
        path = self.tmp / "players.json"
        path.write_text(json.dumps([
            {"slug": "noah-baskin", "name": "Noah Baskin", "active": True, "postUrl": "https://instagram.com/p/old", "featuredRank": None, "showOnHome": True, "coverImage": "images/players/noah-baskin.jpg"},
            {"slug": "colin-lopez", "name": "Old Colin", "active": True, "postUrl": "", "showOnHome": True, "coverImage": "images/players/colin-lopez.jpg"},
        ]), encoding="utf-8")
        e = pp.build_entry("colin-lopez", pp.load_input("colin-lopez", self.tmp))
        out = pp.upsert_players_json([e], path)
        self.assertEqual([p["slug"] for p in out], ["colin-lopez", "noah-baskin"])
        self.assertEqual(out[0]["name"], "Colin Lopez")
        self.assertEqual(out[1]["postUrl"], "https://instagram.com/p/old")

    def test_sql_is_keyed_on_slug_and_idempotent(self):
        e = pp.build_entry("colin-lopez", pp.load_input("colin-lopez", self.tmp))
        sql = pp.emit_sql([e])
        self.assertIn("WHERE slug = $psr$colin-lopez$psr$", sql)
        self.assertIn("WHERE NOT EXISTS (SELECT 1 FROM public.players WHERE slug = $psr$colin-lopez$psr$)", sql)
        self.assertIn("DELETE FROM public.player_videos", sql)
        self.assertIn("colin-lopez/clip1.mp4", sql)
        self.assertIn("COLIN LOPEZ IS A STUD", sql)
        self.assertNotIn("service_role", sql)
        # Applying the statement twice is safe: UPDATE-or-INSERT then replace file videos.
        self.assertIn("BEGIN;", sql)
        self.assertIn("COMMIT;", sql)

    def test_coach_report_is_factual_when_omitted(self):
        e = pp.build_entry("colin-lopez", pp.load_input("colin-lopez", self.tmp))
        self.assertTrue(e["coachReport"].startswith("Profile:"))
        self.assertIn("Lemont High School", e["coachReport"])
        self.assertNotIn("upside", e["coachReport"])
        self.assertNotIn(".444", e["coachReport"])

    def test_share_slugs_prefers_incoming(self):
        players = [
            {"slug": "colin-lopez", "active": True, "showOnHome": True, "coverImage": "x"},
            {"slug": "noah-baskin", "active": True, "showOnHome": True, "coverImage": "x"},
            {"slug": "eduardo-vazquez", "active": True, "showOnHome": True, "coverImage": "x"},
        ]
        self.assertEqual(
            pp.share_slugs(players, ["colin-lopez", "noah-baskin"]),
            ["colin-lopez", "noah-baskin", "eduardo-vazquez"],
        )


if __name__ == "__main__":
    unittest.main()
