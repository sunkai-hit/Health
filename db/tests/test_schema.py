"""Synthetic-only schema tests; no access to production or patient records."""
import sqlite3
import unittest
from pathlib import Path

SQL = (Path(__file__).resolve().parents[1] / "migrations" / "0001_initial.sql").read_text(encoding="utf-8")
NOW = "2026-11-17T00:00:00Z"

def new_db():
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript(SQL)
    return db

class SchemaSmokeTests(unittest.TestCase):
    def setUp(self):
        self.db = new_db()
        self.addCleanup(self.db.close)

    def seed_owner_and_event(self):
        self.db.execute(
            "INSERT INTO user_accounts(id, auth_subject, created_at, updated_at) VALUES(?,?,?,?)",
            ("u-demo","test|synthetic",NOW,NOW))
        self.db.execute(
            "INSERT INTO health_profiles(id,owner_user_id,created_at,updated_at) VALUES(?,?,?,?)",
            ("p-demo","u-demo",NOW,NOW))
        self.db.execute(
            "INSERT INTO health_events(id,profile_id,title_ciphertext,created_at,updated_at) VALUES(?,?,?,?,?)",
            ("e-demo","p-demo",b"ciphertext-placeholder",NOW,NOW))

    def test_all_core_tables_present(self):
        actual = {row[0] for row in self.db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        required = {
            "user_accounts","health_profiles","consent_records","health_events","event_entries","body_marks",
            "encounters","clinician_orders","prescription_items","medication_uses","treatments_performed",
            "attachments","report_snapshots","record_revisions","audit_events"
        }
        self.assertTrue(required.issubset(actual), sorted(required - actual))

    def test_migration_can_be_rerun(self):
        self.db.executescript(SQL)
        self.assertTrue(self.db.execute("SELECT name FROM sqlite_master WHERE name='health_events'").fetchone())

    def test_event_cannot_reference_missing_profile(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "INSERT INTO health_events(id,profile_id,title_ciphertext,created_at,updated_at) VALUES(?,?,?,?,?)",
                ("e-bad","p-missing",b"ciphertext-placeholder",NOW,NOW))

    def test_order_items_and_real_medication_are_different_facts(self):
        self.seed_owner_and_event()
        self.db.execute(
            """INSERT INTO clinician_orders
            (id,event_id,order_type,issued_at,original_text_ciphertext,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?)""",
            ("o-demo","e-demo","prescription",NOW,b"encrypted-demo",NOW,NOW))
        self.db.execute(
            """INSERT INTO prescription_items(id,order_id,item_position,item_ciphertext,created_at,updated_at)
            VALUES(?,?,?,?,?,?)""",
            ("i-demo","o-demo",0,b"encrypted-item",NOW,NOW))
        count = self.db.execute("SELECT COUNT(*) FROM medication_uses").fetchone()[0]
        self.assertEqual(count, 0, "a prescription must never create actual medication facts")
        self.db.execute(
            """INSERT INTO medication_uses
            (id,event_id,instruction_id,prescription_item_id,usage_status,use_ciphertext,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?)""",
            ("m-demo","e-demo","o-demo","i-demo","actual",b"encrypted-use",NOW,NOW))
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM medication_uses").fetchone()[0], 1)

    def test_impossible_medication_status_is_rejected(self):
        self.seed_owner_and_event()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO medication_uses
                (id,event_id,usage_status,use_ciphertext,created_at,updated_at)
                VALUES(?,?,?,?,?,?)""",
                ("m-bad","e-demo","automatically_completed",b"encrypted",NOW,NOW))

    def test_revisions_preserve_original_order(self):
        self.seed_owner_and_event()
        self.db.execute(
            """INSERT INTO clinician_orders(id,event_id,order_type,original_text_ciphertext,created_at,updated_at)
            VALUES(?,?,?,?,?,?)""",
            ("old","e-demo","prescription",b"old-original",NOW,NOW))
        self.db.execute(
            """INSERT INTO clinician_orders(id,event_id,order_type,supersedes_order_id,original_text_ciphertext,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?)""",
            ("new","e-demo","prescription","old",b"new-original",NOW,NOW))
        self.assertEqual(
            self.db.execute("SELECT original_text_ciphertext FROM clinician_orders WHERE id='old'").fetchone()[0],
            b"old-original")
        self.assertEqual(
            self.db.execute("SELECT supersedes_order_id FROM clinician_orders WHERE id='new'").fetchone()[0],
            "old")

    def test_rejects_self_replacement(self):
        self.seed_owner_and_event()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO clinician_orders(id,event_id,order_type,supersedes_order_id,created_at,updated_at)
                VALUES(?,?,?,?,?,?)""",
                ("self","e-demo","prescription","self",NOW,NOW))

    def test_attachment_must_reference_valid_owner_and_event(self):
        self.seed_owner_and_event()
        self.db.execute(
            """INSERT INTO attachments(id,event_id,owner_user_id,object_key,content_type,byte_size,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?)""",
            ("a-demo","e-demo","u-demo","synthetic-uuid-object","application/pdf",0,NOW,NOW))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO attachments(id,event_id,owner_user_id,object_key,content_type,byte_size,created_at,updated_at)
                VALUES(?,?,?,?,?,?,?,?)""",
                ("a-bad","e-demo","u-demo","bad-negative-size","image/png",-2,NOW,NOW))

if __name__ == "__main__":
    unittest.main()
