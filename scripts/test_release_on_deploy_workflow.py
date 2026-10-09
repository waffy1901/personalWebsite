#!/usr/bin/env python3
"""Execute the real automatic-release shell with synthetic, offline providers."""
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
from test_netlify_published_deploy import (  # noqa: E402
    COMMIT, DEPLOY, OTHER, SITE, URL, deployment, site,
)
from check_netlify_deploy_state import NO_CONTENT_CHANGE_ERROR_MESSAGE  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW = ROOT / '.github/workflows/release-on-deploy.yml'
TOKEN = 'synthetic-token-do-not-disclose'
SITE_ENDPOINT = f'https://api.netlify.com/api/v1/sites/{SITE}'
LIST_ENDPOINT = SITE_ENDPOINT + '/deploys?production=true&per_page=100'
DEPLOY_ENDPOINT = f'https://api.netlify.com/api/v1/deploys/{DEPLOY}'


def extract(step, key='run'):
    lines = WORKFLOW.read_text().splitlines()
    start = lines.index(f'      - name: {step}')
    for index in range(start + 1, len(lines)):
        if lines[index].startswith('      - name: '):
            break
        if lines[index].strip() == f'{key}: |':
            indent = len(lines[index]) - len(lines[index].lstrip())
            block = []
            for line in lines[index + 1:]:
                if line and len(line) - len(line.lstrip()) <= indent:
                    break
                block.append(line)
            return textwrap.dedent('\n'.join(block)) + '\n'
    raise AssertionError(f'Missing literal {key} for {step}')


RESOLVER = extract('Resolve Netlify production deploy')
GUARD = extract('Recheck published deployment before release')
RELEASE = extract('Create GitHub release', 'script')

# Fake curl refuses all unknown URLs, enforces API timeouts, and repeats the
# last scripted response. No request can fall through to a real provider.
FAKE_CURL = r'''
import json, os, pathlib, sys
args = sys.argv[1:]
assert args[args.index('--connect-timeout') + 1] == '5'
assert args[args.index('--max-time') + 1] == '15'
url = args[-1]
root = pathlib.Path(os.environ['FIXTURE_ROOT'])
with (root / 'requests').open('a') as log:
    log.write(url + '\n')
responses = json.loads((root / 'responses.json').read_text())
assert url in responses, 'Unexpected URL'
counts_file = root / 'counts.json'
counts = json.loads(counts_file.read_text()) if counts_file.exists() else {}
index = counts.get(url, 0)
counts[url] = index + 1
counts_file.write_text(json.dumps(counts))
sequence = responses[url]
response = sequence[min(index, len(sequence) - 1)]
if isinstance(response, dict) and '_curl_exit' in response:
    sys.exit(response['_curl_exit'])
if isinstance(response, dict) and '_raw' in response:
    sys.stdout.write(response['_raw'])
else:
    json.dump(response, sys.stdout)
'''


class ReleaseWorkflowTest(unittest.TestCase):
    def run_shell(self, script, responses, overrides=None):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            fake_bin = root / 'bin'
            fake_bin.mkdir()
            (root / 'responses.json').write_text(json.dumps(responses))
            (root / 'output').write_text('')
            (root / 'requests').write_text('')
            (root / 'sleeps').write_text('')
            curl = fake_bin / 'curl'
            curl.write_text(f'#!{sys.executable}\n' + FAKE_CURL)
            curl.chmod(0o755)
            sleep = fake_bin / 'sleep'
            sleep.write_text('#!/bin/sh\n[ "$1" = 20 ] || exit 2\nprintf "20\\n" >> "$FIXTURE_ROOT/sleeps"\n')
            sleep.chmod(0o755)
            environment = {**os.environ, 'PATH': f'{fake_bin}{os.pathsep}{os.environ["PATH"]}',
                           'FIXTURE_ROOT': str(root), 'GITHUB_OUTPUT': str(root / 'output'),
                           'PYTHONDONTWRITEBYTECODE': '1', 'EXPECTED_COMMIT': COMMIT,
                           'NETLIFY_SITE_ID': SITE, 'NETLIFY_AUTH_TOKEN': TOKEN,
                           'NETLIFY_DEPLOY_ID': DEPLOY, 'NETLIFY_DEPLOY_URL': URL,
                           **(overrides or {})}
            result = subprocess.run(['bash', '-e', '-o', 'pipefail', '-c', script],
                                    cwd=ROOT, env=environment, capture_output=True,
                                    text=True, check=False, timeout=90)
            self.assertNotIn(TOKEN, result.stdout + result.stderr)
            self.assertNotIn('private-response-marker', result.stdout + result.stderr)
            return (result, (root / 'output').read_text(),
                    (root / 'requests').read_text().splitlines(),
                    (root / 'sleeps').read_text().splitlines())

    def resolve(self, published=None, attempts=None, selected=None, overrides=None):
        return self.run_shell(RESOLVER, {
            LIST_ENDPOINT: attempts if attempts is not None else [[deployment()]],
            DEPLOY_ENDPOINT: selected if selected is not None else [deployment()],
            SITE_ENDPOINT: published if published is not None else [site()],
        }, overrides)

    def guard(self, response=None, overrides=None):
        return self.run_shell(GUARD, {SITE_ENDPOINT: [site() if response is None else response]}, overrides)

    def assert_failed_without_outputs(self, result):
        process, output, _, _ = result
        self.assertNotEqual(process.returncode, 0, process.stdout + process.stderr)
        self.assertEqual(output, '')

    def test_exact_published_target_succeeds_with_immutable_outputs(self):
        process, output, requests, sleeps = self.resolve()
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertEqual(output, f'deployed=true\ndeploy_url={URL}\ndeploy_id={DEPLOY}\n')
        self.assertEqual(requests, [LIST_ENDPOINT, SITE_ENDPOINT])
        self.assertEqual(sleeps, [])

    def test_ready_target_alone_times_out_for_different_id_even_same_sha(self):
        for fields in ({'id': OTHER}, {'id': OTHER, 'commit_ref': 'b' * 40}):
            with self.subTest(fields=fields):
                result = self.resolve(published=[site(published_deploy=deployment(**fields))])
                self.assert_failed_without_outputs(result)
                self.assertIn('Timed out', result[0].stdout)
                self.assertEqual(result[2].count(LIST_ENDPOINT), 1)
                self.assertEqual(result[2].count(DEPLOY_ENDPOINT), 44)
                self.assertEqual(result[2].count(SITE_ENDPOINT), 45)
                self.assertEqual(len(result[3]), 44)

    def test_delayed_publication_retains_selected_id_over_newer_skipped_attempt(self):
        process, output, requests, sleeps = self.resolve(
            attempts=[[deployment()], [deployment(id=OTHER, skipped=True)]],
            published=[site(published_deploy=deployment(id=OTHER)), site()])
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertIn(f'deploy_id={DEPLOY}', output)
        self.assertEqual(requests, [LIST_ENDPOINT, SITE_ENDPOINT, DEPLOY_ENDPOINT, SITE_ENDPOINT])
        self.assertEqual(sleeps, ['20'])

    def test_building_target_retained_until_ready_and_published(self):
        process, output, requests, _ = self.resolve(attempts=[[deployment(state='building')]])
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertIn('deployed=true', output)
        self.assertEqual(requests, [LIST_ENDPOINT, DEPLOY_ENDPOINT, SITE_ENDPOINT])

    def test_target_behind_newer_unrelated_skip_is_selected(self):
        process, output, _, _ = self.resolve(attempts=[[
            deployment(id=OTHER, commit_ref='b' * 40, skipped=True), deployment()]])
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertIn(f'deploy_id={DEPLOY}', output)

    def test_exact_skipped_and_no_content_signals_exit_without_release(self):
        for attempt in (deployment(skipped=True), deployment(state='error', skipped=None,
                        error_message=NO_CONTENT_CHANGE_ERROR_MESSAGE)):
            process, output, requests, sleeps = self.resolve(attempts=[[attempt]])
            self.assertEqual(process.returncode, 0, process.stderr)
            self.assertEqual(output, 'deployed=false\ndeploy_url=\ndeploy_id=\n')
            self.assertEqual(requests, [LIST_ENDPOINT])
            self.assertEqual(sleeps, [])

    def test_genuine_failure_is_not_skip(self):
        for attempt in (deployment(state='error', error_message='Build command failed'),
                        deployment(state='rejected'), deployment(state='error',
                        error_message=NO_CONTENT_CHANGE_ERROR_MESSAGE + ' ')):
            self.assert_failed_without_outputs(self.resolve(attempts=[[attempt]]))

    def test_wrong_site_and_malformed_attempt_fail_closed(self):
        for field, value in (('site_id', 'wrong-site'), ('id', None), ('state', None),
                             ('commit_ref', 'A' * 40), ('context', 'deploy-preview'),
                             ('id', 'x\ndeployed=true')):
            self.assert_failed_without_outputs(self.resolve(attempts=[[deployment(**{field: value})]]))
        for raw in ('', '{', '{"private":"private-response-marker"', '[NaN]',
                    '[{"id":"a","id":"b"}]'):
            self.assert_failed_without_outputs(self.resolve(attempts=[{'_raw': raw}]))

    def test_missing_malformed_and_wrong_site_pointer_fail_both_gates(self):
        invalid = [site(id='wrong-site'), site(name=None), site(name='x\ndeployed=true'),
                   site(published_deploy=None), {}, {'_raw': ''}, {'_raw': '{'},
                   {'_raw': '{"id":1,"id":2}'}, {'_raw': '{"id":NaN}'}]
        for field, value in (('site_id', 'wrong-site'), ('id', None), ('commit_ref', None),
                             ('state', None), ('state', 'error'), ('skipped', True),
                             ('context', None), ('id', 'a\ndeployed=true')):
            invalid.append(site(published_deploy=deployment(**{field: value})))
        for response in invalid:
            with self.subTest(response=response):
                self.assert_failed_without_outputs(self.resolve(published=[response]))
                self.assert_failed_without_outputs(self.guard(response))

    def test_selected_endpoint_cannot_substitute_identity(self):
        for selected in (deployment(id=OTHER), deployment(commit_ref='b' * 40),
                         deployment(site_id='wrong-site'), []):
            self.assert_failed_without_outputs(self.resolve(
                attempts=[[deployment(state='building')]], selected=[selected]))

    def test_api_errors_are_bounded_and_never_emit_success(self):
        for code in (22, 28):
            for response in (
                self.resolve(attempts=[{'_curl_exit': code}]),
                self.resolve(published=[{'_curl_exit': code}]),
                self.guard({'_curl_exit': code}),
            ):
                self.assert_failed_without_outputs(response)
                self.assertLessEqual(len(response[2]), 2)
                self.assertEqual(response[3], [])
        self.assertIn('    timeout-minutes: 40', WORKFLOW.read_text().split('  release:')[0])

    def test_final_guard_requires_same_identity_and_url_without_waiting(self):
        process, _, requests, sleeps = self.guard()
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertEqual(requests, [SITE_ENDPOINT])
        self.assertEqual(sleeps, [])
        for published in (deployment(id=OTHER), deployment(id=OTHER, commit_ref='b' * 40),
                          deployment(id='c' * 24, commit_ref='c' * 40)):
            result = self.guard(site(published_deploy=published))
            self.assert_failed_without_outputs(result)
            self.assertEqual(result[2], [SITE_ENDPOINT])
            self.assertEqual(result[3], [])
        self.assert_failed_without_outputs(self.guard(site(name='renamed-site')))
        self.assert_failed_without_outputs(self.guard(overrides={'NETLIFY_DEPLOY_URL': 'https://main--portfolio.netlify.app'}))

    def test_workflow_wires_http_checks_guard_and_fixture_lanes(self):
        source = WORKFLOW.read_text()
        steps = [line.strip()[8:] for line in source.splitlines() if line.startswith('      - name: ')]
        self.assertEqual(steps[steps.index('Create GitHub release') - 1],
                         'Recheck published deployment before release')
        checks = extract('Validate immutable deployment')
        for checker in ('routes', 'security-headers', 'artifacts'):
            self.assertIn(f'python3 scripts/check-deployed-{checker}.py --repo "$GITHUB_WORKSPACE" --site-url "$SITE_URL"', checks)
        for step in ('Validate deployed routes', 'Validate deployed security headers',
                     'Validate deployed artifacts', 'Validate legacy Netlify domain redirect'):
            self.assertIn(step, steps)
        for workflow in (source, (ROOT / '.github/workflows/workflow-lint.yml').read_text()):
            for fixture in ('netlify_deploy_state', 'netlify_published_deploy', 'release_on_deploy_workflow'):
                self.assertIn(f'python3 scripts/test_{fixture}.py', workflow)
        self.assertIn('deploy_id: ${{ steps.resolve.outputs.deploy_id }}', source)
        for variable, output in (('NETLIFY_DEPLOY_URL', 'deploy_url'), ('NETLIFY_DEPLOY_ID', 'deploy_id')):
            self.assertEqual(source.count(f'{variable}: ${{{{ needs.resolve_deploy.outputs.{output} }}}}'), 2)

    def test_actual_release_script_records_id_and_immutable_url(self):
        harness = r'''
const fs = require('node:fs');
const source = fs.readFileSync(0, 'utf8');
const context = { sha: process.env.EXPECTED_COMMIT, ref: 'refs/heads/main',
  serverUrl: 'https://github.example', repo: {owner: 'owner', repo: 'repo'}, runId: 42 };
const github = {rest: {repos: {createRelease: async (args) => process.stdout.write(JSON.stringify(args))}}};
new Function('github', 'context', `return (async () => {${source}})();`)(github, context)
  .catch((error) => {console.error(error); process.exitCode = 1;});
'''
        result = subprocess.run(['node', '-e', harness], input=RELEASE, capture_output=True,
                                text=True, check=False, env={**os.environ, 'EXPECTED_COMMIT': COMMIT,
                                'NETLIFY_DEPLOY_ID': DEPLOY, 'NETLIFY_DEPLOY_URL': URL})
        self.assertEqual(result.returncode, 0, result.stderr)
        release = json.loads(result.stdout)
        self.assertEqual(release['target_commitish'], COMMIT)
        self.assertIn(f'- Netlify deploy: {URL}', release['body'])
        self.assertIn(f'- Netlify deploy ID: {DEPLOY}', release['body'])
        self.assertFalse(release['draft'])
        self.assertEqual(release['make_latest'], 'false')

    def test_identical_nine_public_artifacts_do_not_establish_frontend_identity(self):
        path = ROOT / 'scripts/check-deployed-artifacts.py'
        spec = importlib.util.spec_from_file_location('artifact_counterexample', path)
        artifacts = importlib.util.module_from_spec(spec)
        sys.modules[spec.name] = artifacts
        spec.loader.exec_module(artifacts)
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / 'target'
            serving = Path(temporary) / 'serving'
            target.mkdir()
            serving.mkdir()
            for artifact in artifacts.ARTIFACTS:
                body = (ROOT / 'main/public' / artifact.path).read_bytes()
                (target / artifact.path).write_bytes(body)
                (serving / artifact.path).write_bytes(body)
            for name, wanted, actual in (('app.js', b'console.log("target")', b'console.log("other")'),
                                         ('app.css', b'body{color:blue}', b'body{color:red}')):
                (target / name).write_bytes(wanted)
                (serving / name).write_bytes(actual)
                self.assertNotEqual((target / name).read_bytes(), (serving / name).read_bytes())
            compared = []
            for artifact in artifacts.ARTIFACTS:
                request = f'https://waffy.dev/{artifact.path}'
                response = artifacts.HttpResponse(200, request, '', artifact.content_type,
                                                   (serving / artifact.path).read_bytes())
                self.assertEqual(artifacts.validate_artifact_response(
                    artifact, (target / artifact.path).read_bytes(), response, request), [])
                compared.append(artifact.path)
            self.assertEqual(len(compared), 9)
        published_other = site(published_deploy=deployment(id=OTHER, commit_ref='b' * 40))
        self.assert_failed_without_outputs(self.resolve(published=[published_other]))
        self.assert_failed_without_outputs(self.guard(published_other))


if __name__ == '__main__':
    unittest.main()
