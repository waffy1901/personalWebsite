#!/usr/bin/env python3
import copy
import unittest
from summarize_run_timing import summarize


def fixture():
    return ({"id": 42, "event": "schedule", "run_attempt": 1,
             "created_at": "2026-10-05T21:50:00Z", "run_started_at": "2026-10-05T21:50:04Z"},
            {"total_count": 1, "jobs": [{"id": 7, "run_id": 42, "run_attempt": 1,
             "created_at": "2026-10-05T21:50:01Z", "started_at": "2026-10-05T21:50:06Z",
             "completed_at": "2026-10-05T21:51:51Z", "steps": []}]})


class TimingTests(unittest.TestCase):
    def test_trigger_wait_and_execution_are_separate(self):
        run, jobs = fixture()
        result = summarize(run, jobs, "2026-10-05T14:37:00Z")
        self.assertEqual(result["trigger_to_creation_seconds"], 433 * 60)
        self.assertEqual(result["creation_to_run_start_seconds"], 4)
        self.assertEqual(result["jobs"][0]["creation_to_start_seconds"], 5)
        self.assertEqual(result["jobs"][0]["execution_seconds"], 105)

    def test_missing_job_creation_stays_unknown(self):
        run, jobs = fixture()
        del jobs["jobs"][0]["created_at"]
        result = summarize(run, jobs)
        self.assertIsNone(result["jobs"][0]["creation_to_start_seconds"])
        self.assertEqual(result["jobs"][0]["execution_seconds"], 105)

    def test_rerun_gap_is_not_called_queue_time(self):
        run, jobs = fixture()
        run["run_attempt"] = jobs["jobs"][0]["run_attempt"] = 2
        run["run_started_at"] = "2026-10-06T21:50:04Z"
        self.assertTrue(any("not rerun queue" in item for item in summarize(run, jobs)["unknowns"]))

    def test_nonscheduled_run_cannot_get_trigger_delay(self):
        run, jobs = fixture()
        run["event"] = "workflow_dispatch"
        result = summarize(run, jobs, "2026-10-05T14:37:00Z")
        self.assertIsNone(result["trigger_to_creation_seconds"])

    def test_invalid_and_inverted_times_stay_unknown(self):
        for value in ("invalid", "2026-10-05T20:00:00Z", "2026-10-05T22:00:00"):
            run, jobs = fixture()
            jobs["jobs"][0]["completed_at"] = value
            result = summarize(run, jobs)
            self.assertIsNone(result["jobs"][0]["execution_seconds"])
            self.assertTrue(result["unknowns"])

    def test_attempt_and_run_mismatch_are_rejected(self):
        for field, value in (("run_id", 99), ("run_attempt", 2)):
            run, jobs = fixture()
            jobs["jobs"][0][field] = value
            with self.assertRaises(ValueError):
                summarize(run, jobs)

    def test_pagination_cannot_silently_omit_jobs(self):
        run, jobs = fixture()
        jobs["total_count"] = 2
        with self.assertRaises(ValueError):
            summarize(run, jobs)
        second = copy.deepcopy(jobs["jobs"][0])
        second["id"] = 8
        result = summarize(run, [jobs, {"total_count": 2, "jobs": [second]}])
        self.assertEqual(len(result["jobs"]), 2)


if __name__ == "__main__":
    unittest.main()
