#!/usr/bin/env python3
import copy
import unittest
from verify_closeout_readback import verify


def fixture():
    issue = {"url": "https://github.com/waffy1901/personalWebsite/issues/123", "number": 123,
             "state": "CLOSED", "stateReason": "COMPLETED", "assignees": ["waffy1901"]}
    fields = {"Status": "Done", "Priority": "Next", "Severity": "Low", "Area": "Governance",
              "Evidence needed": ["Source", "Local checks"], "Custom context": None}
    expected = {"mutation_completed_at": "2026-10-07T14:00:00Z", "issue": issue,
                "project": {"url": "https://github.com/users/waffy1901/projects/2",
                            "item_id": "PVTI_123", "fields": fields}}
    snapshot = {"captured_at": "2026-10-07T14:00:01Z", "issue": copy.deepcopy(issue),
                "complete": {"assignees": True, "items": True, "fields": True},
                "project": {"url": expected["project"]["url"], "items": [
                    {"id": "PVTI_123", "issue_url": issue["url"], "fields": copy.deepcopy(fields)}]}}
    return snapshot, expected


class CloseoutTests(unittest.TestCase):
    def test_complete_exact_readback(self):
        snapshot, expected = fixture()
        self.assertTrue(verify(snapshot, expected)["verified"])

    def test_multiselect_order_is_not_a_difference(self):
        snapshot, expected = fixture()
        snapshot["project"]["items"][0]["fields"]["Evidence needed"].reverse()
        self.assertTrue(verify(snapshot, expected)["verified"])

    def test_every_relevant_field_must_persist(self):
        for field in ("Status", "Priority", "Severity", "Area", "Evidence needed", "Custom context"):
            snapshot, expected = fixture()
            del snapshot["project"]["items"][0]["fields"][field]
            self.assertFalse(verify(snapshot, expected)["verified"], field)

    def test_issue_assignment_and_reason_are_checked(self):
        for key, value in (("state", "OPEN"), ("stateReason", "NOT_PLANNED"), ("assignees", [])):
            snapshot, expected = fixture()
            snapshot["issue"][key] = value
            self.assertFalse(verify(snapshot, expected)["verified"])

    def test_membership_missing_duplicate_or_replaced_fails(self):
        for case in ("missing", "duplicate", "replaced"):
            snapshot, expected = fixture()
            if case == "missing":
                snapshot["project"]["items"] = []
            elif case == "duplicate":
                snapshot["project"]["items"] *= 2
            else:
                snapshot["project"]["items"][0]["id"] = "PVTI_other"
            self.assertFalse(verify(snapshot, expected)["verified"])

    def test_partial_pages_cannot_verify(self):
        for connection in ("assignees", "items", "fields"):
            snapshot, expected = fixture()
            snapshot["complete"][connection] = False
            with self.assertRaises(ValueError):
                verify(snapshot, expected)

    def test_malformed_completeness_cannot_verify(self):
        for value in (None, [], True, "complete"):
            snapshot, expected = fixture()
            snapshot["complete"] = value
            with self.assertRaises(ValueError):
                verify(snapshot, expected)

    def test_stale_read_cannot_verify(self):
        snapshot, expected = fixture()
        snapshot["captured_at"] = expected["mutation_completed_at"]
        with self.assertRaises(ValueError):
            verify(snapshot, expected)

    def test_expectation_cannot_omit_fields_or_use_other_project(self):
        for case in ("missing field", "other project", "open issue", "duplicate option"):
            snapshot, expected = fixture()
            if case == "missing field":
                del expected["project"]["fields"]["Priority"]
            elif case == "other project":
                expected["project"]["url"] = "https://github.com/users/waffy1901/projects/3"
            elif case == "open issue":
                expected["issue"]["state"] = "OPEN"
            else:
                expected["project"]["fields"]["Evidence needed"] *= 2
            with self.assertRaises(ValueError):
                verify(snapshot, expected)


if __name__ == "__main__":
    unittest.main()
