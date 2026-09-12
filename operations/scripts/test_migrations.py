"""Exercise actual migration/retention SQL with SQLite FK enforcement and disk reopen.

This is not a Cloudflare D1 runtime or remote migration test.
"""
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
DAY = 86400000


def migrate(db):
    db.execute("CREATE TABLE IF NOT EXISTS test_migrations (name TEXT PRIMARY KEY, digest TEXT NOT NULL)")
    for path in sorted((ROOT / "migrations").glob("*.sql")):
        sql = path.read_text()
        digest = hashlib.sha256(sql.encode()).hexdigest()
        existing = db.execute("SELECT digest FROM test_migrations WHERE name = ?", (path.name,)).fetchone()
        if existing:
            if existing[0] != digest:
                raise ValueError("Previously applied migration changed")
            continue
        db.executescript(sql)
        db.execute("INSERT INTO test_migrations VALUES (?, ?)", (path.name, digest))
        db.commit()


def retention_statements():
    return json.loads(subprocess.check_output([
        'node', '--input-type=module', '-e',
        "import {retentionStatements} from './src/retention.mjs'; console.log(JSON.stringify(retentionStatements(400*86400000)))",
    ], cwd=ROOT, text=True))


class MigrationsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "operations.sqlite"
        self.db = sqlite3.connect(self.path)
        self.db.execute("PRAGMA foreign_keys = ON")
        migrate(self.db)
        self.db.execute("INSERT INTO services VALUES ('portfolio', 'Portfolio', 0)")
        self.db.execute("INSERT INTO service_configs (service_id, version, target_key, created_at_ms) VALUES ('portfolio', 1, 'portfolio', 0)")
        self.db.execute("INSERT INTO monitoring_periods VALUES ('initial', 'portfolio', 1, 0, NULL)")

    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def observation(self, slot=0, outcome="success", status=200, run_id="run-1"):
        self.db.execute("INSERT INTO collector_runs VALUES (?, 'portfolio', 1, ?, ?, ?, 'completed', NULL)", (run_id, slot, slot, slot + 100))
        self.db.execute("INSERT INTO observations VALUES ('portfolio', ?, 1, ?, ?, ?, ?, 100)", (slot, run_id, slot + 100, outcome, status))

    def rejects(self, sql, bindings=()):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(sql, bindings)

    def test_fresh_schema_replay_and_disk_persistence(self):
        self.observation()
        self.db.commit()
        self.db.close()
        self.db = sqlite3.connect(self.path)
        self.db.execute("PRAGMA foreign_keys = ON")
        migrate(self.db)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM observations").fetchone()[0], 1)
        self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(), [])
        self.assertEqual(self.db.execute("PRAGMA integrity_check").fetchone()[0], "ok")

    def test_no_observations_are_seeded_by_migration(self):
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM observations").fetchone()[0], 0)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM public_summaries").fetchone()[0], 0)

    def test_state_checkpoint_is_private_durable_and_period_scoped(self):
        self.db.execute("INSERT INTO service_state_checkpoints VALUES ('portfolio', 0, 300000, 1, 2, 0, 300100)")
        self.rejects("UPDATE service_state_checkpoints SET active_period_start_ms = 1")
        self.rejects("UPDATE service_state_checkpoints SET established_down = 0")
        self.rejects("UPDATE service_state_checkpoints SET recovery_streak = 1")
        self.rejects("UPDATE service_state_checkpoints SET failure_streak = 3")
        self.db.commit()
        self.db.close()
        self.db = sqlite3.connect(self.path)
        self.db.execute("PRAGMA foreign_keys = ON")
        self.assertEqual(self.db.execute("SELECT established_down, failure_streak FROM service_state_checkpoints").fetchone(), (1, 2))

    def test_primary_slot_unique_and_confirmation_does_not_replace_failure(self):
        self.observation(outcome="http_error", status=503)
        self.rejects("INSERT INTO observations SELECT * FROM observations")
        self.db.execute("INSERT INTO confirmation_observations VALUES ('portfolio', 0, 200, 'success', 200, 80)")
        self.rejects("INSERT INTO confirmation_observations SELECT * FROM confirmation_observations")
        self.rejects("UPDATE observations SET outcome = 'success', http_status = 200")
        self.assertEqual(self.db.execute("SELECT outcome FROM observations").fetchone()[0], "http_error")

    def test_foreign_keys_configurations_and_enabled_intervals(self):
        self.rejects("INSERT INTO services VALUES ('arbitrary-target', 'Bad', 0)")
        self.rejects("UPDATE service_configs SET slow_ms = 1000")
        self.rejects("INSERT INTO monitoring_periods VALUES ('overlap', 'portfolio', 1, 1, 300000)")
        self.db.execute("UPDATE monitoring_periods SET ends_at_ms = 300000")
        self.db.execute("INSERT INTO collector_runs VALUES ('disabled', 'portfolio', 1, 300000, 300000, 300100, 'completed', NULL)")
        self.rejects("INSERT INTO observations VALUES ('portfolio', 300000, 1, 'disabled', 300100, 'success', 200, 100)")
        self.rejects("INSERT INTO collector_runs VALUES ('bad-slot', 'portfolio', 1, 1, 1, 2, 'completed', NULL)")
        self.rejects("INSERT INTO observations VALUES ('portfolio', 0, 1, 'missing', 100, 'success', 200, 100)")

    def test_outcome_and_collector_error_constraints(self):
        self.db.execute("INSERT INTO collector_runs VALUES ('failed', 'portfolio', 1, 0, 0, 100, 'failed', 'storage')")
        self.rejects("INSERT INTO observations VALUES ('portfolio', 0, 1, 'failed', 100, 'success', NULL, 100)")
        self.rejects("INSERT INTO observations VALUES ('portfolio', 0, 1, 'failed', 100, 'success', 503, 100)")
        self.rejects("INSERT INTO observations VALUES ('portfolio', 0, 1, 'failed', 100, 'collector_error', NULL, 100)")
        self.rejects("INSERT INTO collector_runs VALUES ('incomplete', 'portfolio', 1, 0, 0, NULL, 'completed', NULL)")

    def test_ready_unpublished_and_rollback_history(self):
        for deploy_id, state, time in [('old', 'ready', 1), ('attempt', 'pending', 2), ('new', 'ready', 3)]:
            self.db.execute("INSERT INTO deployments VALUES (?, 'portfolio', 'netlify', ?, ?, ?, ?, NULL, NULL)", (deploy_id, 'a' * 40, state, time, time))
        self.rejects("INSERT INTO deployment_publications VALUES ('invalid', 'portfolio', 'attempt', 4)")
        for publication, deploy_id, time in [('p1', 'old', 5), ('p2', 'new', 6), ('rollback', 'old', 7)]:
            self.db.execute("INSERT INTO deployment_publications VALUES (?, 'portfolio', ?, ?)", (publication, deploy_id, time))
        self.assertEqual(self.db.execute("SELECT deployment_id FROM deployment_publications ORDER BY verified_at_ms DESC LIMIT 1").fetchone()[0], 'old')
        self.rejects("UPDATE deployments SET commit_sha = ? WHERE id = 'old'", ('b' * 40,))
        self.rejects("UPDATE deployment_publications SET deployment_id = 'new' WHERE id = 'rollback'")

    def test_retention_deletes_children_in_bounds_and_preserves_current_publication(self):
        self.observation(outcome="http_error", status=500)
        self.db.execute("INSERT INTO confirmation_observations VALUES ('portfolio', 0, 200, 'success', 200, 90)")
        self.db.execute("INSERT INTO deployments VALUES ('live', 'portfolio', 'netlify', ?, 'ready', 0, 0, NULL, NULL)", ('a' * 40,))
        self.db.execute("INSERT INTO deployment_publications VALUES ('current', 'portfolio', 'live', 0)")
        for i in range(125):
            self.db.execute("INSERT INTO owner_audit_events VALUES (?, 'owner', 'incident_update', 'incident', 0, 'request')", (str(i),))
        self.db.execute("INSERT INTO incidents VALUES ('open', 'portfolio', 'Unresolved', 'investigating', 0, NULL, 1)")
        self.db.execute("INSERT INTO incidents VALUES ('closed', 'portfolio', 'Resolved', 'resolved', 0, 1, 1)")
        self.db.execute("INSERT INTO incident_updates VALUES ('update', 'closed', 'Done', 1)")
        for statement in retention_statements():
            cursor = self.db.execute(statement['sql'], statement['bindings'])
            self.assertLessEqual(cursor.rowcount, 100)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM observations").fetchone()[0], 0)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM collector_runs").fetchone()[0], 0)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM owner_audit_events").fetchone()[0], 25)
        self.assertEqual(self.db.execute("SELECT id FROM incidents").fetchall(), [('open',)])
        self.assertEqual(self.db.execute("SELECT id FROM deployments").fetchall(), [('live',)])
        self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_cleanup_resumes_child_backlog_without_losing_checkpoint_or_current_pointer(self):
        for i in range(125):
            self.observation(slot=i * 300000, outcome='timeout', status=None, run_id=f'run-{i}')
            self.db.execute("INSERT INTO confirmation_observations VALUES ('portfolio', ?, ?, 'success', 200, 80)", (i * 300000, i * 300000 + 200))
        self.db.execute("INSERT INTO service_state_checkpoints VALUES ('portfolio', 0, 37200000, 1, 2, 0, 37200100)")
        for i in range(3):
            self.db.execute("INSERT INTO deployments VALUES (?, 'portfolio', 'netlify', ?, 'ready', 0, 0, NULL, NULL)", (f'd-{i}', 'a' * 40))
            self.db.execute("INSERT INTO deployment_publications VALUES (?, 'portfolio', ?, ?)", (f'p-{i}', f'd-{i}', i))
        self.db.execute("INSERT INTO provider_sync_state VALUES ('portfolio', 'p-0', 3, 3, NULL)")
        for statement in retention_statements():
            self.db.execute(statement['sql'], statement['bindings'])
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM observations").fetchone()[0], 25)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM confirmation_observations").fetchone()[0], 25)
        for statement in retention_statements():
            self.db.execute(statement['sql'], statement['bindings'])
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM observations").fetchone()[0], 0)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM collector_runs").fetchone()[0], 0)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM service_state_checkpoints").fetchone()[0], 1)
        self.assertEqual(self.db.execute("SELECT current_publication_id FROM provider_sync_state").fetchone()[0], 'p-0')
        self.assertEqual(self.db.execute("SELECT id FROM deployments ORDER BY id").fetchall(), [('d-0',), ('d-2',)])
        self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_scratch_database_is_separate(self):
        with sqlite3.connect(':memory:') as scratch:
            scratch.executescript((ROOT / 'prototype/0001_scratch.sql').read_text())
            self.assertEqual(scratch.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall(), [('prototype_samples',)])


if __name__ == '__main__':
    unittest.main()
