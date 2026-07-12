#!/usr/bin/env python3
import importlib.util
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


sys.dont_write_bytecode = True

REPO_ROOT = Path(__file__).resolve().parents[1]
CHECKER_PATH = REPO_ROOT / "scripts" / "check-deployed-routes.py"
MODULE_NAME = "deployed_routes_checker"
SPEC = importlib.util.spec_from_file_location(MODULE_NAME, CHECKER_PATH)
CHECKER = importlib.util.module_from_spec(SPEC)
sys.modules[MODULE_NAME] = CHECKER
SPEC.loader.exec_module(CHECKER)


EXPECTED = CHECKER.RouteMetadataExpectation(
    path="/projects",
    title="Projects | Waffy Ahmed",
    description="Selected software projects.",
    canonical_url="https://waffy.dev/projects",
    image_url="https://waffy.dev/og-image-v2.png",
)

EXPECTED_VALUES = {
    "title": EXPECTED.title,
    "description": EXPECTED.description,
    "canonical": EXPECTED.canonical_url,
    "robots": "index, follow",
    "og:url": EXPECTED.canonical_url,
    "og:title": EXPECTED.title,
    "og:description": EXPECTED.description,
    "og:image": EXPECTED.image_url,
    "og:image:secure_url": EXPECTED.image_url,
    "twitter:title": EXPECTED.title,
    "twitter:description": EXPECTED.description,
    "twitter:image": EXPECTED.image_url,
}


def render_tag(label, value):
    if label == "title":
        return f"<title>{value}</title>"
    if label == "canonical":
        return f'<link rel="canonical" href="{value}">'
    if label.startswith("og:"):
        return f'<meta property="{label}" content="{value}">'
    return f'<meta name="{label}" content="{value}">'


def shell_html(*, overrides=None, omitted=(), duplicated=()):
    overrides = overrides or {}
    omitted = set(omitted)
    duplicated = set(duplicated)
    tags = []

    for label, expected_value in EXPECTED_VALUES.items():
        if label in omitted:
            continue
        tag = render_tag(label, overrides.get(label, expected_value))
        tags.append(tag)
        if label in duplicated:
            tags.append(tag)

    return "<html><head>" + "".join(tags) + "</head><body></body></html>"


class DeployedRoutesTest(unittest.TestCase):
    def validate(self, html, request_url="https://preview.example/projects/"):
        failures = []
        CHECKER.validate_shell_metadata(
            request_url,
            CHECKER.parse_metadata(html),
            EXPECTED,
            failures,
        )
        return failures

    def test_exact_route_metadata_passes_for_preview_origin(self):
        self.assertEqual(self.validate(shell_html()), [])

    def test_every_exact_field_rejects_wrong_missing_and_duplicate_values(self):
        for label in EXPECTED_VALUES:
            cases = {
                "wrong": shell_html(overrides={label: "wrong-but-nonempty"}),
                "missing": shell_html(omitted={label}),
                "duplicate": shell_html(duplicated={label}),
            }

            for case_name, html in cases.items():
                with self.subTest(field=label, case=case_name):
                    failures = self.validate(html)
                    self.assertEqual(len(failures), 1)
                    self.assertIn(f" {label} mismatch:", failures[0])

    def test_check_shell_rejects_wrong_nonempty_title(self):
        response = CHECKER.CurlResponse(
            status=200,
            effective_url="https://preview.example/projects/",
            redirect_url="",
            body=shell_html(overrides={"title": "Home | Waffy Ahmed"}),
        )
        args = types.SimpleNamespace(timeout=10, retries=0, retry_delay=0)
        failures = []

        with patch.object(CHECKER, "fetch", return_value=response):
            CHECKER.check_shell(
                "https://preview.example",
                "/projects/",
                EXPECTED,
                args,
                failures,
            )

        self.assertEqual(len(failures), 1)
        self.assertIn(" title mismatch:", failures[0])

    def test_source_metadata_inventory_matches_canonical_rewrites(self):
        canonical_routes, _ = CHECKER.load_redirect_rules(REPO_ROOT)
        route_metadata = CHECKER.load_route_metadata(REPO_ROOT)

        self.assertEqual(
            CHECKER.validate_route_inventory(canonical_routes, route_metadata),
            [],
        )
        self.assertEqual(
            route_metadata["/projects"].canonical_url,
            "https://waffy.dev/projects",
        )


if __name__ == "__main__":
    unittest.main()
