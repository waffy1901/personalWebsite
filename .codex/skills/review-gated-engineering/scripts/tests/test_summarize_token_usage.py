import argparse
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / "summarize_token_usage.py"
SPEC = importlib.util.spec_from_file_location("summarize_token_usage", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


def write_session(directory, name, records):
    path = directory / name
    path.write_text("\n".join(json.dumps(record) for record in records) + "\n", encoding="utf-8")
    return path


def token(timestamp, input_tokens, cached, cache_write, output, reasoning, reported_total=None):
    return {
        "type": "event_msg",
        "timestamp": timestamp,
        "payload": {
            "type": "token_count",
            "info": {"last_token_usage": {
                "input_tokens": input_tokens,
                "cached_input_tokens": cached,
                "cache_write_input_tokens": cache_write,
                "output_tokens": output,
                "reasoning_output_tokens": reasoning,
                "total_tokens": input_tokens + output if reported_total is None else reported_total,
            }},
        },
    }


class SummarizeTokenUsageTests(unittest.TestCase):
    def test_selects_linked_sessions_and_keeps_subsets_out_of_total(self):
        with tempfile.TemporaryDirectory() as temporary:
            sessions = Path(temporary)
            write_session(sessions, "root.jsonl", [
                {"type": "session_meta", "payload": {"id": "root", "session_id": "root", "timestamp": "2026-08-24T00:30:57Z"}},
                {"type": "turn_context", "payload": {"model": "gpt-5.6-terra", "effort": "high"}},
                {"type": "response_item", "payload": {"content": "private prompt must not appear"}},
                token("2026-08-24T00:30:00Z", 999, 0, 0, 1, 0),
                token("2026-08-24T00:31:00Z", 100, 20, 5, 50, 30),
            ])
            write_session(sessions, "child.jsonl", [
                {"type": "session_meta", "payload": {"id": "child", "session_id": "root", "timestamp": "2026-08-24T00:31:00Z", "source": {"subagent": {"thread_spawn": {"parent_thread_id": "root", "agent_path": "/root/implementer"}}}}},
                {"type": "turn_context", "payload": {"model": "gpt-5.6-sol", "effort": "high"}},
                token("2026-08-24T00:31:01Z", 40, 10, 0, 20, 5),
            ])
            write_session(sessions, "guardian.jsonl", [
                {"type": "session_meta", "payload": {"id": "guardian", "session_id": "root", "timestamp": "2026-08-24T00:31:02Z", "source": {"subagent": {"other": "guardian"}}}},
                {"type": "turn_context", "payload": {"model": "codex-auto-review", "effort": "low"}},
            ])
            write_session(sessions, "unrelated.jsonl", [
                {"type": "session_meta", "payload": {"id": "other", "session_id": "root", "timestamp": "2026-08-24T00:31:00Z", "source": {"subagent": {"other": "other"}}}},
                token("2026-08-24T00:31:01Z", 999, 0, 0, 1, 0),
            ])
            report = MODULE.collect(argparse.Namespace(
                root_session_id="root", since="2026-08-24T00:30:57Z", sessions_dir=str(sessions),
                phase="handoff", requested_model="gpt-5.6-terra", requested_effort="high",
                session_labels=["child=review|reviewer|gpt-5.6-sol|high", "guardian=review|guardian|unavailable|unavailable"],
            ))
            self.assertEqual(report["coverage"]["selected_session_count"], 3)
            self.assertEqual(len(report["groups"]), 3)
            root = next(row for row in report["groups"] if row["session"] == "root")
            self.assertEqual(root["role"], "coordinator")
            self.assertEqual(root["uncached_input"], 75)
            self.assertEqual(root["total"], 150)
            self.assertEqual(root["reasoning_output"], 30)
            self.assertFalse(report["aggregate"]["metrics"]["total"]["complete"])
            self.assertEqual(report["aggregate"]["metrics"]["total"]["observed_subtotal"], 210)
            child = next(row for row in report["groups"] if row["session"] == "child")
            self.assertEqual(child["phase"], "review")
            self.assertEqual(child["requested_model"], "gpt-5.6-sol")
            guardian = next(row for row in report["groups"] if row["session"] == "guardian")
            self.assertIsNone(guardian["response_count"])
            self.assertIsNone(guardian["total"])
            rendered = MODULE.markdown(report)
            self.assertNotIn("private prompt", rendered)
            metadata = MODULE.metadata_from(sessions / "root.jsonl")
            self.assertNotIn("content", metadata)

    def test_marks_incomplete_usage_unavailable_instead_of_zero(self):
        with tempfile.TemporaryDirectory() as temporary:
            sessions = Path(temporary)
            write_session(sessions, "root.jsonl", [
                {"type": "session_meta", "payload": {"id": "root", "session_id": "root", "timestamp": "2026-08-24T00:30:57Z"}},
                {"type": "event_msg", "timestamp": "2026-08-24T00:31:00Z", "payload": {"type": "token_count", "info": {"last_token_usage": {"input_tokens": 10}}}},
            ])
            report = MODULE.collect(argparse.Namespace(
                root_session_id="root", since="2026-08-24T00:30:57Z", sessions_dir=str(sessions),
                phase="handoff", requested_model="unavailable", requested_effort="unavailable",
                session_labels=[],
            ))
            row = report["groups"][0]
            self.assertEqual(row["response_count"], 1)
            self.assertEqual(row["input"], 10)
            self.assertIsNone(row["cached_input"])
            self.assertIsNone(row["total"])
            self.assertTrue(any("incomplete token telemetry" in warning for warning in report["warnings"]))
            self.assertFalse(report["aggregate"]["metrics"]["total"]["complete"])

    def test_marks_inconsistent_reported_totals_and_reasoning_unavailable(self):
        with tempfile.TemporaryDirectory() as temporary:
            sessions = Path(temporary)
            write_session(sessions, "root.jsonl", [
                {"type": "session_meta", "payload": {"id": "root", "session_id": "root", "timestamp": "2026-08-24T00:30:57Z", "base_instructions": "private"}},
                {"type": "event_msg", "timestamp": "2026-08-24T00:31:00Z", "payload": {"type": "token_count", "info": {"last_token_usage": {
                    "input_tokens": 10, "cached_input_tokens": 0, "cache_write_input_tokens": 0,
                    "output_tokens": 5, "reasoning_output_tokens": 6, "total_tokens": 12,
                }}}},
            ])
            report = MODULE.collect(argparse.Namespace(
                root_session_id="root", since="2026-08-24T00:30:57Z", sessions_dir=str(sessions),
                phase="handoff", requested_model="unavailable", requested_effort="unavailable", session_labels=[],
            ))
            row = report["groups"][0]
            self.assertIsNone(row["reasoning_output"])
            self.assertIsNone(row["total"])
            self.assertTrue(any("inconsistent total_tokens" in warning for warning in report["warnings"]))
            self.assertTrue(any("reasoning output exceeds" in warning for warning in report["warnings"]))
            self.assertNotIn("base_instructions", MODULE.metadata_from(sessions / "root.jsonl"))

    def test_ignores_repeated_post_compaction_zero_component_baselines(self):
        with tempfile.TemporaryDirectory() as temporary:
            sessions = Path(temporary)
            write_session(sessions, "root.jsonl", [
                {"type": "session_meta", "payload": {"id": "root", "session_id": "root", "timestamp": "2026-08-24T00:30:57Z"}},
                {"type": "compacted", "payload": {}},
                token("2026-08-24T00:31:00Z", 0, 0, 0, 0, 0, reported_total=99),
                {"type": "turn_context", "payload": {"model": "gpt-5.6-terra", "effort": "high"}},
                token("2026-08-24T00:31:01Z", 0, 0, 0, 0, 0, reported_total=99),
                token("2026-08-24T00:31:02Z", 10, 2, 0, 5, 1),
            ])
            report = MODULE.collect(argparse.Namespace(
                root_session_id="root", since="2026-08-24T00:30:57Z", sessions_dir=str(sessions),
                phase="handoff", requested_model="unavailable", requested_effort="unavailable", session_labels=[],
            ))
            row = report["groups"][0]
            self.assertEqual(row["response_count"], 1)
            self.assertEqual(row["total"], 15)
            self.assertTrue(any("ignored 2 post-compaction" in warning for warning in report["warnings"]))
            self.assertFalse(any("inconsistent total_tokens" in warning for warning in report["warnings"]))


if __name__ == "__main__":
    unittest.main()
