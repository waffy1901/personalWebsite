import copy
import importlib.util
import sys
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("layout", Path(__file__).with_name("check-resume-layout.py"))
layout = importlib.util.module_from_spec(spec)
spec.loader.exec_module(layout)


class ResumeLayoutTests(unittest.TestCase):
    def setUp(self):
        self.lines = [
            {"text": "Led testing and validation", "baseline": 380, "x": 70.8, "right": 200},
            {"text": "using BigQuery and Postman.", "baseline": 392, "x": 70.8, "right": 200},
        ]

    def test_matching_lines(self):
        self.assertEqual(layout.compare_lines(self.lines, self.lines), [])

    def test_same_words_rewrapped_still_fail(self):
        rewrapped = copy.deepcopy(self.lines)
        rewrapped[0]["text"] += " using"
        rewrapped[1]["text"] = "BigQuery and Postman."
        self.assertTrue(layout.compare_lines(rewrapped, self.lines))

    def test_missing_line_and_changed_word_fail(self):
        self.assertTrue(layout.compare_lines(self.lines[:1], self.lines))
        changed = copy.deepcopy(self.lines)
        changed[0]["text"] = "Led testing"
        self.assertTrue(layout.compare_lines(changed, self.lines))

    def test_shifted_line_fails(self):
        changed = copy.deepcopy(self.lines)
        changed[0]["baseline"] += 2
        self.assertTrue(layout.compare_lines(changed, self.lines))
        changed = copy.deepcopy(self.lines)
        changed[1]["x"] += 2
        self.assertTrue(layout.compare_lines(changed, self.lines))


if __name__ == "__main__":
    unittest.main()
