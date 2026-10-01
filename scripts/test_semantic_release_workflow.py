#!/usr/bin/env python3
import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


sys.dont_write_bytecode = True

REPO_ROOT = Path(__file__).resolve().parents[1]
WORKFLOW_PATH = REPO_ROOT / ".github" / "workflows" / "semantic-release.yml"
EXPECTED_COMMIT = "a" * 40
OTHER_COMMIT = "b" * 40
SYNTHETIC_TOKEN = "synthetic-netlify-token"


def extract_literal_block(step_name, key):
    lines = WORKFLOW_PATH.read_text(encoding="utf-8").splitlines()
    marker = f"      - name: {step_name}"
    try:
        step_start = lines.index(marker)
    except ValueError as error:
        raise AssertionError(f"Missing workflow step: {step_name}") from error

    step_end = len(lines)
    for index in range(step_start + 1, len(lines)):
        if lines[index].startswith("      - name: "):
            step_end = index
            break

    key_suffix = f"{key}: |"
    for index in range(step_start + 1, step_end):
        stripped = lines[index].lstrip()
        if stripped == key_suffix:
            indentation = len(lines[index]) - len(stripped)
            block = []
            for candidate in lines[index + 1 : step_end]:
                if candidate and len(candidate) - len(candidate.lstrip()) <= indentation:
                    break
                block.append(candidate)
            return textwrap.dedent("\n".join(block)).rstrip() + "\n"

    raise AssertionError(f"Missing {key}: | in workflow step: {step_name}")


NETLIFY_LOOKUP = extract_literal_block(
    "Verify current Netlify production deploy", "run"
)
PROVENANCE_SCRIPT = extract_literal_block(
    "Require matching deployment provenance release", "script"
)


def published_deploy(
    *,
    commit_ref=EXPECTED_COMMIT,
    state="ready",
    deploy_id="deploy_123-abc",
    deploy_url="https://published.example.netlify.app",
):
    return {
        "id": deploy_id,
        "state": state,
        "commit_ref": commit_ref,
        "deploy_ssl_url": deploy_url,
        "context": "production",
        "skipped": None,
        "published_at": "2026-10-01T22:42:22.850Z",
    }


class SemanticReleaseWorkflowTest(unittest.TestCase):
    def run_netlify_lookup(self, response):
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            fixture_path = directory / "site-response.json"
            output_path = directory / "github-output"
            curl_url_path = directory / "curl-url"
            fake_bin = directory / "bin"
            fake_bin.mkdir()
            fake_curl = fake_bin / "curl"
            fake_curl.write_text(
                "#!/bin/sh\n"
                "for argument in \"$@\"; do\n"
                "  case \"$argument\" in\n"
                "    https://*) printf '%s\\n' \"$argument\" > \"$FAKE_CURL_URL\" ;;\n"
                "  esac\n"
                "done\n"
                "exec /bin/cat \"$FAKE_CURL_RESPONSE\"\n",
                encoding="utf-8",
            )
            fake_curl.chmod(0o755)

            if isinstance(response, bytes):
                fixture_path.write_bytes(response)
            elif isinstance(response, str):
                fixture_path.write_text(response, encoding="utf-8")
            else:
                fixture_path.write_text(json.dumps(response), encoding="utf-8")
            output_path.write_text("", encoding="utf-8")

            environment = os.environ.copy()
            environment.update(
                {
                    "PATH": f"{fake_bin}{os.pathsep}{environment['PATH']}",
                    "FAKE_CURL_URL": str(curl_url_path),
                    "FAKE_CURL_RESPONSE": str(fixture_path),
                    "GITHUB_OUTPUT": str(output_path),
                    "NETLIFY_AUTH_TOKEN": SYNTHETIC_TOKEN,
                    "NETLIFY_SITE_ID": "synthetic-site-id",
                    "TARGET_COMMIT": EXPECTED_COMMIT,
                }
            )
            result = subprocess.run(
                ["bash", "-c", NETLIFY_LOOKUP],
                cwd=REPO_ROOT,
                env=environment,
                check=False,
                capture_output=True,
                text=True,
            )
            return (
                result,
                output_path.read_text(encoding="utf-8"),
                curl_url_path.read_text(encoding="utf-8"),
            )

    def assert_lookup_rejected(self, response, message):
        result, output, _ = self.run_netlify_lookup(response)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(message, result.stderr)
        self.assertEqual(output, "")
        self.assertNotIn("do-not-disclose", result.stderr)
        self.assertNotIn(SYNTHETIC_TOKEN, result.stdout + result.stderr)

    def run_provenance_guard(self, releases):
        node_harness = r"""
const fs = require('node:fs');
const source = fs.readFileSync(process.env.PROVENANCE_SCRIPT_PATH, 'utf8');
const releases = JSON.parse(fs.readFileSync(process.env.RELEASE_FIXTURE_PATH, 'utf8'));
const outputs = {};
const failures = [];
const github = {
  paginate: async () => releases,
  rest: { repos: { listReleases: () => {} } },
};
const context = { repo: { owner: 'example', repo: 'portfolio' } };
const core = {
  setFailed: (message) => failures.push(message),
  setOutput: (name, value) => { outputs[name] = value; },
};
const execute = new Function(
  'github',
  'context',
  'core',
  `return (async () => {\n${source}\n})();`,
);
execute(github, context, core)
  .then(() => process.stdout.write(JSON.stringify({ outputs, failures })))
  .catch((error) => {
    process.stderr.write(error && error.stack ? error.stack : String(error));
    process.exitCode = 1;
  });
"""
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            script_path = directory / "provenance-script.js"
            fixture_path = directory / "releases.json"
            script_path.write_text(PROVENANCE_SCRIPT, encoding="utf-8")
            fixture_path.write_text(json.dumps(releases), encoding="utf-8")
            environment = os.environ.copy()
            environment.update(
                {
                    "PROVENANCE_SCRIPT_PATH": str(script_path),
                    "RELEASE_FIXTURE_PATH": str(fixture_path),
                    "TARGET_COMMIT": EXPECTED_COMMIT,
                }
            )
            result = subprocess.run(
                ["node", "-e", node_harness],
                cwd=REPO_ROOT,
                env=environment,
                check=False,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)

    def test_published_deploy_is_resolved_from_site_and_emitted(self):
        result, output, curl_url = self.run_netlify_lookup(
            {"published_deploy": published_deploy()}
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            output,
            "id=deploy_123-abc\nurl=https://published.example.netlify.app\n",
        )
        self.assertIn(
            "https://api.netlify.com/api/v1/sites/synthetic-site-id\n",
            curl_url,
        )
        self.assertNotIn("/deploys?", curl_url)
        self.assertNotIn(SYNTHETIC_TOKEN, result.stdout + result.stderr)

    def test_newer_attempts_and_unpublished_ready_deploys_are_ignored(self):
        decoys = (
            published_deploy(commit_ref=OTHER_COMMIT, state="building"),
            published_deploy(commit_ref=OTHER_COMMIT, state="error"),
            {
                **published_deploy(commit_ref=OTHER_COMMIT, state="ready"),
                "skipped": True,
            },
            published_deploy(commit_ref=OTHER_COMMIT, state="ready"),
        )

        for decoy in decoys:
            with self.subTest(decoy=decoy):
                result, output, _ = self.run_netlify_lookup(
                    {
                        "published_deploy": published_deploy(),
                        "latest_deploy": decoy,
                        "deploys": [decoy],
                    }
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("id=deploy_123-abc\n", output)

    def test_published_deploy_for_different_commit_fails_closed(self):
        self.assert_lookup_rejected(
            {
                "published_deploy": published_deploy(commit_ref=OTHER_COMMIT),
                "marker": "do-not-disclose",
            },
            "commit_ref does not match target_commit",
        )

    def test_unpublished_ready_target_cannot_replace_published_pointer(self):
        for published, message in (
            (published_deploy(commit_ref=OTHER_COMMIT), "commit_ref does not match target_commit"),
            (None, "published_deploy must be an object"),
        ):
            with self.subTest(published=published):
                self.assert_lookup_rejected(
                    {
                        "published_deploy": published,
                        "latest_deploy": published_deploy(),
                        "deploys": [published_deploy()],
                    },
                    message,
                )

    def test_empty_and_malformed_site_responses_fail_closed(self):
        for response in (
            "",
            '{"marker":"do-not-disclose"',
            b'{"published_deploy":{"state":"rea\x00dy"}}',
            b'{"published_deploy":"\xff"}',
        ):
            with self.subTest(response=response):
                self.assert_lookup_rejected(
                    response,
                    "site response is not valid JSON",
                )
        self.assert_lookup_rejected(
            '{"published_deploy":{},"published_deploy":{}}',
            "duplicate object member",
        )
        self.assert_lookup_rejected(
            '{"published_deploy":NaN}',
            "invalid JSON constant",
        )

    def test_missing_null_and_malformed_published_deploy_fail_closed(self):
        for published in (None, [], "ready", 1):
            with self.subTest(published=published):
                self.assert_lookup_rejected(
                    {
                        "published_deploy": published,
                        "marker": "do-not-disclose",
                    },
                    "published_deploy must be an object",
                )
        self.assert_lookup_rejected(
            {"marker": "do-not-disclose"},
            "published_deploy must be an object",
        )

    def test_malformed_published_fields_and_output_injection_fail_closed(self):
        cases = (
            ({**published_deploy(), "state": "building"}, "is not ready"),
            ({**published_deploy(), "state": None}, "is not ready"),
            ({**published_deploy(), "commit_ref": "A" * 40}, "lowercase 40-character SHA"),
            ({**published_deploy(), "commit_ref": f"{'a' * 39}\n"}, "lowercase 40-character SHA"),
            ({**published_deploy(), "id": ""}, "id is missing or unsafe"),
            ({**published_deploy(), "id": "deploy\nurl=https://evil.invalid"}, "id is missing or unsafe"),
            ({**published_deploy(), "deploy_ssl_url": "http://example.invalid"}, "must be HTTPS"),
            ({**published_deploy(), "deploy_ssl_url": "https://user:pass@example.invalid"}, "without credentials"),
            ({**published_deploy(), "deploy_ssl_url": "https://example.invalid\nurl=https://evil.invalid"}, "whitespace or control characters"),
            ({**published_deploy(), "deploy_ssl_url": "https://example.invalid/\x07evil"}, "whitespace or control characters"),
            ({**published_deploy(), "deploy_ssl_url": "https://example.invalid/path with-space"}, "whitespace or control characters"),
            ({**published_deploy(), "deploy_ssl_url": "https://example.invalid:invalid"}, "URL is malformed"),
            ({**published_deploy(), "deploy_ssl_url": "https://example.invalid\\@evil.invalid"}, "URL is malformed"),
            ({**published_deploy(), "deploy_ssl_url": "https://[invalid"}, "URL is malformed"),
            ({**published_deploy(), "deploy_ssl_url": []}, "HTTPS URL is missing"),
        )

        for deploy, message in cases:
            with self.subTest(message=message):
                self.assert_lookup_rejected(
                    {
                        "published_deploy": deploy,
                        "marker": "do-not-disclose",
                    },
                    message,
                )

    def test_ssl_url_is_accepted_when_deploy_ssl_url_is_absent(self):
        deploy = published_deploy()
        del deploy["deploy_ssl_url"]
        deploy["ssl_url"] = "https://fallback.example.netlify.app"

        result, output, _ = self.run_netlify_lookup({"published_deploy": deploy})

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("url=https://fallback.example.netlify.app\n", output)

    def test_matching_published_deployment_provenance_is_emitted(self):
        result = self.run_provenance_guard(
            [
                {
                    "draft": False,
                    "tag_name": "deploy-20261001T000000Z-aaaaaaa",
                    "target_commitish": EXPECTED_COMMIT,
                    "html_url": "https://github.example/releases/deploy",
                }
            ]
        )

        self.assertEqual(result["failures"], [])
        self.assertEqual(
            result["outputs"],
            {
                "tag": "deploy-20261001T000000Z-aaaaaaa",
                "url": "https://github.example/releases/deploy",
            },
        )

    def test_missing_nonmatching_and_draft_provenance_block_publication(self):
        cases = (
            [],
            [
                {
                    "draft": False,
                    "tag_name": "deploy-20261001T000000Z-bbbbbbb",
                    "target_commitish": OTHER_COMMIT,
                    "html_url": "https://github.example/releases/other",
                }
            ],
            [
                {
                    "draft": True,
                    "tag_name": "deploy-20261001T000000Z-aaaaaaa",
                    "target_commitish": EXPECTED_COMMIT,
                    "html_url": "https://github.example/releases/draft",
                }
            ],
        )

        for releases in cases:
            with self.subTest(releases=releases):
                result = self.run_provenance_guard(releases)
                self.assertEqual(result["outputs"], {})
                self.assertEqual(len(result["failures"]), 1)
                self.assertIn("No published deploy-* release targets", result["failures"][0])


if __name__ == "__main__":
    unittest.main()
