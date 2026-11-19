"""Exercise the public example without a provider, Docker engine or operator pack."""

import csv
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import protocol
import run
import score


class PublicDemoTests(unittest.TestCase):
    def setUp(self):
        environment = patch.dict(os.environ)
        environment.start()
        self.addCleanup(environment.stop)
        os.environ.pop("PORTFOLIO_EVALS_PACK", None)
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        results = patch.object(protocol, "RESULTS", self.root / "results")
        results.start()
        self.addCleanup(results.stop)
        self.conditions = {**dict.fromkeys(protocol.ENV_FIELDS, "synthetic local demonstration"),
                           "image": None, "token_budget": None, "usd_budget": None}

    def first_slot(self):
        plan_path = run.plan_campaign("ledger", self.conditions, 353, protocol.DEFAULT_MODELS)
        plan = protocol.read_json(plan_path)
        slot = plan["slots"][0]
        issued = run.prepare("ledger", slot["id"])
        return plan, slot, issued

    def test_public_candidate_export(self):
        plan, slot, issued = self.first_slot()
        packet = issued / "candidate"
        self.assertEqual(set(plan["tasks"]), {"E00"})
        self.assertEqual(len(plan["slots"]), 6)
        self.assertEqual(set(protocol.inventory(packet)),
                         {"AGENTS.md", "docs/quality-and-verification-policy.md", "ledger.json", "TASK.md"})
        self.assertEqual(run.packet_fingerprint(packet),
                         {"initial_fixture": plan["tasks"]["E00"]["fixture"],
                          "initial_prompt": plan["tasks"]["E00"]["prompt"]})
        self.assertEqual(run.prepare("ledger", slot["id"]), issued)

    def test_import_blind_review_and_all_report_formats(self):
        plan, slot, issued = self.first_slot()
        packet = issued / "candidate"
        rows = json.loads((packet / "ledger.json").read_text())
        count = sum(row["status"] == "complete" for row in rows)
        response = {"summary": "I counted the entries marked complete.", "answer": {"completed": count}}
        evidence = {
            **run.evidence_template(), **run.packet_fingerprint(packet),
            "status": "completed", "model": slot["model"], "provider": plan["provider"], "effort": plan["effort"],
            "route_source": "synthetic test", "environment": self.conditions,
            "started": protocol.now(), "ended": protocol.now(),
            "events": [
                {"kind": "message", "role": "user", "text": (packet / "TASK.md").read_text()},
                {"kind": "tool", "name": "shell", "input": "cat ledger.json",
                 "output": (packet / "ledger.json").read_text(), "exit_code": 0},
                {"kind": "message", "role": "assistant", "text": json.dumps(response)},
            ],
            "gates": dict.fromkeys(protocol.GATES, "pass"), "gate_evidence": "Synthetic ledger read only.",
        }
        record = run.import_evidence("ledger", slot["id"], evidence, packet)
        self.assertEqual(protocol.read_json(record)["mismatches"], [])
        blind = score.blind("ledger")
        packet_text = (blind / (slot["blind"] + ".packet.json")).read_text()
        self.assertTrue(all(model not in packet_text for model in plan["models"]))
        form = protocol.read_json(blind / (slot["blind"] + ".form.json"))
        form.update(reviewer="demo-reader", quality=4, contract=4, verification=4,
                    review_minutes=1, fix_minutes=0, fixes={"minor": 0, "major": 0, "blocker": 0},
                    gates=dict.fromkeys(protocol.GATES, "pass"), rationale="The ledger supports the count.")
        score.accept_review("ledger", form)
        output = score.report("ledger")
        report = protocol.read_json(output / "report.json")
        with (output / "runs.csv").open(newline="") as stream:
            csv_rows = list(csv.DictReader(stream))
        self.assertEqual([r["slot"] for r in csv_rows], [r["slot"] for r in report["runs"]])
        self.assertEqual(len(csv_rows), 6)
        self.assertEqual(report["runs"][0]["raw_score"], 100)
        self.assertIsNone(report["runs"][0]["cost_usd"])
        self.assertTrue(all(r["status"] == "missing" for r in report["runs"][1:]))
        self.assertEqual(report["decision"]["status"], "NON-COMPARATIVE PREVIEW")
        self.assertIn("NON-COMPARATIVE PREVIEW", (output / "report.md").read_text())
        self.assertEqual(output, score.report("ledger"))

    def test_incorrect_and_empty_demo_answers(self):
        for answer in ({"completed": -1}, {"completed": True}, {}):
            with self.subTest(answer=answer):
                observed = {"events": [{"text": json.dumps({"summary": "Demo answer", "answer": answer})}]}
                checks, _, valid_format = score.objective("E00", {"observed": observed}, self.conditions)
                self.assertTrue(valid_format)
                self.assertFalse(all(checks.values()))

    def test_demo_cannot_enter_an_official_campaign(self):
        conditions = {**self.conditions, "image": "sha256:" + "a" * 64}
        with self.assertRaises(ValueError):
            run.plan_campaign("official-demo", conditions, 353, protocol.DEFAULT_MODELS, official=True)
        self.assertFalse((protocol.RESULTS / "campaigns/official-demo/plan.json").exists())

    def test_unrecognized_operator_pack_is_rejected_before_import(self):
        foreign_pack = self.root / "foreign"
        grading = foreign_pack / "private"
        grading.mkdir(parents=True)
        marker = self.root / "imported"
        (grading / "text_tasks.py").write_text("from pathlib import Path\nPath(" + repr(str(marker)) + ").touch()\n")
        (foreign_pack / "suite.json").write_text((protocol.HERE / "demo/suite.json").read_text())
        env = {**os.environ, "PORTFOLIO_EVALS_PACK": str(foreign_pack)}
        proc = subprocess.run([sys.executable, "-B", str(protocol.HERE / "run.py"), "fingerprint"],
                              env=env, capture_output=True, text=True, check=False)
        self.assertNotEqual(proc.returncode, 0)
        self.assertFalse(marker.exists())


if __name__ == "__main__":
    unittest.main()
