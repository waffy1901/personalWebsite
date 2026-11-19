"""Exercise the public example without a provider, Docker engine or operator pack."""

import csv
import json
import os
import subprocess
import sys
import tempfile
import unittest
from datetime import timedelta
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


class OfficialSetupTests(unittest.TestCase):
    """Use the public fixture and a temporary registry to exercise official gating."""

    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory()))
        demo = protocol.selected_pack()
        self.enterContext(patch.object(protocol, "selected_pack", return_value=demo))
        self.enterContext(patch.object(protocol, "DISTRIBUTION", "core"))
        self.enterContext(patch.object(protocol, "RESULTS", self.root / "results"))
        self.env = {**dict.fromkeys(protocol.ENV_FIELDS, "synthetic isolated guest"),
                    "image": "sha256:" + "a" * 64, "token_budget": None, "usd_budget": None}
        self.routes = {model: protocol.digest(("demo-route-" + model).encode()) for model in protocol.DEFAULT_MODELS}
        snap = protocol.fingerprint()
        self.att = {"version": snap["version"], "sha256": snap["sha256"], "role": "independent-validator",
                    "reviewer": "demo-validator", "reviewed_at": protocol.now(),
                    "checks": dict.fromkeys(protocol.VALIDATION, True), "evidence": "Synthetic test setup.",
                    "setup": protocol.operating_setup(self.env, self.routes)}

    def freeze(self, att):
        validation = self.root / "validation.json"
        validation.write_text(json.dumps(att))
        return run.freeze(validation)

    def plan(self, env, routes, campaign="comparison", models=None):
        return run.plan_campaign(campaign, env, 353, models or protocol.DEFAULT_MODELS, official=True, routes=routes)

    def test_validation_setup_cli_and_unbound_signoffs(self):
        env_file, routes_file = self.root / "conditions.json", self.root / "routes.json"
        env_file.write_text(json.dumps(self.env))
        routes_file.write_text(json.dumps(self.routes))
        command = [sys.executable, "-B", str(protocol.HERE / "run.py"), "validation-setup",
                   "--environment", str(env_file), "--routes", str(routes_file)]
        self.assertEqual(json.loads(subprocess.check_output(command)), self.att["setup"])
        legacy = {k: v for k, v in self.att.items() if k != "setup"}
        shared_receipt = dict.fromkeys(self.routes, "c" * 64)
        for invalid in (legacy, {**self.att, "setup": None},
                        {**self.att, "setup": {**self.att["setup"], "routes": shared_receipt}},
                        {**self.att, "setup": {**self.att["setup"], "effort": "unverified"}}):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                self.freeze(invalid)
        self.assertFalse((protocol.RESULTS / "freezes").exists())

    def test_registration_requires_the_exact_environment_and_model_routes(self):
        approval = self.freeze(self.att)
        self.assertEqual(self.freeze(self.att), approval)
        first, second = protocol.DEFAULT_MODELS
        for field, value in {"image": "sha256:" + "b" * 64, "isolation": "another guest",
                             "tool_permissions": "different tools", "network_policy": "another policy",
                             "token_budget": 100}.items():
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, "signoff"):
                self.plan({**self.env, field: value}, self.routes)
        for routes, models in ((None, [first, second]), ({first: self.routes[first]}, [first, second]),
                               ({first: self.routes[second], second: self.routes[first]}, [first, second]),
                               ({**self.routes, "other-model": "c" * 64}, [first, second, "other-model"]),
                               (self.routes, [first, "other-model"])):
            with self.subTest(routes=routes, models=models), self.assertRaises(ValueError):
                self.plan(self.env, routes, models=models)
        self.assertFalse((protocol.RESULTS / "registrations").exists())
        self.assertFalse((protocol.RESULTS / "campaigns").exists())
        self.plan(dict(reversed(self.env.items())), dict(reversed(self.routes.items())))
        _, plan = protocol.load_plan("comparison")
        self.assertEqual(plan["freeze"], protocol.digest(protocol.canonical(protocol.read_json(approval))))
        self.assertEqual(plan["routes"], self.routes)

    def test_new_approvals_preserve_the_frozen_benchmark_and_registered_roster(self):
        initial = self.freeze(self.att)
        plan_file = self.plan(self.env, self.routes)
        other = {**self.env, "isolation": "second approved guest"}
        additional = self.freeze({**self.att, "setup": protocol.operating_setup(other, self.routes)})
        self.assertNotEqual(initial, additional)
        self.assertEqual(protocol.read_json(initial)["validation"], self.att)
        plan = protocol.read_json(plan_file)
        plan_file.write_text(json.dumps({**plan, "environment": other}))
        with self.assertRaisesRegex(ValueError, "freeze mismatch"):
            protocol.load_plan("comparison")
        plan_file.unlink()  # Reproduce an interruption between registration and plan publication.
        with self.assertRaisesRegex(ValueError, "already has an official campaign"):
            self.plan(other, self.routes)
        self.assertEqual(protocol.read_json(self.plan(self.env, self.routes)), plan)
        expanded = {**self.routes, "another-model": protocol.digest(b"another-demo-route")}
        self.freeze({**self.att, "setup": protocol.operating_setup(self.env, expanded)})
        self.plan(self.env, expanded, "expanded", list(expanded))
        self.assertEqual(protocol.load_plan("expanded")[1]["models"], list(expanded))

    def test_only_the_observed_approved_route_can_score(self):
        self.env["usd_budget"] = 10
        self.att["setup"] = protocol.operating_setup(self.env, self.routes)
        self.freeze(self.att)
        plan = protocol.read_json(self.plan(self.env, self.routes))
        cases = {"different": ["route_sha256"], "missing": ["route_sha256"],
                 "different_environment_digest": ["environment"], "matching": []}
        for slot, (case, expected_mismatches) in zip(plan["slots"], cases.items()):
            issued = run.prepare("comparison", slot["id"])
            started = protocol.read_json(issued / "issued.json")["issued"]
            ended = (protocol.moment(started) + timedelta(minutes=plan["tasks"][slot["task"]]["minutes"])).isoformat()
            guest = issued / "candidate"
            evidence = {**run.evidence_template(), **run.packet_fingerprint(guest),
                        "status": "timeout", "model": slot["model"], "provider": plan["provider"], "effort": plan["effort"],
                        "route_source": "synthetic session receipt", "environment": self.env, "started": started, "ended": ended,
                        "usage": {"tokens": None, "cost_usd": 0, "source": "synthetic observation"},
                        "events": [{"kind": "message", "role": "user", "text": (guest / "TASK.md").read_text()}],
                        "notes": "Synthetic full-budget timeout.", "gates": dict.fromkeys(protocol.GATES, "pass"),
                        "gate_evidence": "Synthetic isolated observation."}
            evidence["route_sha256"] = self.routes[slot["model"]]
            if case == "different":
                evidence["route_sha256"] = "f" * 64
            elif case == "missing":
                del evidence["route_sha256"]
            elif case == "different_environment_digest":
                evidence["environment"] = {**self.env, "usd_budget": 10.0}
            with self.subTest(case=case), patch.object(protocol, "now", return_value=ended):
                record = protocol.read_json(run.import_evidence("comparison", slot["id"], evidence))
                self.assertEqual(record["requested_route_sha256"], self.routes[slot["model"]])
                self.assertEqual(record["mismatches"], expected_mismatches)
                row = score.score_slot(issued.parent, plan, slot)
                self.assertEqual(row["decision_score"], 0 if case == "matching" else None)


if __name__ == "__main__":
    unittest.main()
