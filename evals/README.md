# Portfolio coding-agent evaluations

This harness compares how reliably coding agents complete work on this
repository. The initial comparison assigns GPT-6.1 Sol Max and GPT-6.2 Sol Max
the same six tasks three times each. Operators record every assigned run,
including timeouts and unavailable sessions.

**Comparison status:** zero of 36 official runs. The validation machine has
no Docker engine, and a segregated Codex Max tool route has yet to be verified
for both models. The benchmark is awaiting independent isolation signoff and
freeze. No model recommendation is available.

## Run the public example

Use Python 3.11 or later and a Git clone containing the commit pinned in
[the suite manifest](suite.json). The public E00 task counts completed entries
in a sample ledger. Its input and grader are available for inspection. It
exercises the same import, blind review and reporting code as the core tasks.
From the repository root, with `PORTFOLIO_EVALS_PACK` unset, run:

```sh
python3 -B -m unittest discover -s evals -p test_demo.py -v
mkdir -p evals/results/demo
python3 -B evals/run.py environment > evals/results/demo/conditions.json
python3 -B evals/run.py plan ledger --seed 353 --environment evals/results/demo/conditions.json
python3 -B evals/run.py prepare ledger r001
python3 -B evals/score.py report ledger
```

The last command prints the local directory containing `report.md`,
`report.json` and `runs.csv`. A new example has six missing rows and the
label **NON-COMPARATIVE PREVIEW**. The public test also imports a synthetic
completed run and its blind review, then checks all three report formats.
Use a new campaign name to repeat the example.

## Core task catalog

| ID | Task | Minutes |
| --- | --- | ---: |
| E03 | Update canonical portfolio content and synchronize its generated representations. | 20 |
| E05 | Diagnose a failed CI run from the supplied evidence. | 12 |
| E07 | Repair a bundle-budget checker while preserving its thresholds. | 30 |
| E08 | Review a proposed change and report actionable, evidence-backed findings. | 16 |
| E11 | Investigate a discrepancy between canonical source and discovery artifacts. | 15 |
| E12 | Assess an operational claim with incomplete evidence. | 12 |

The operator keeps the six versioned prompts, fixture inputs, graders,
calibration controls and reviewer guidance in a separate private pack.
The public manifest pins the whole pack with one SHA-256 commitment. Obtain
the matching pack privately from its owner and keep it outside all worktrees.
Select it explicitly for every core command:

```sh
export PORTFOLIO_EVALS_PACK=/absolute/operator-only/core-pack
python3 -B evals/run.py fingerprint
```

The command checks the pack against the public commitment. Keep the digest
of the **combined** harness and pack for independent review. Core results
are written next to the pack in `core-pack-results/` when the pack is named
`core-pack`. Use operator-only storage for both directories. A campaign,
report or transcript can contain private assertions and answers.

## Validate and freeze a core campaign

1. GPT-6.2 Astra Max coordinated the harness and scoring. A second Astra Max
   implementation session built the edit tasks and isolated grading path.
   A bounded Sol session built read-only fixtures. A separate, non-builder
   validator evaluates task realism, held-out integrity, isolation, shortcut
   controls and fixed scoring. An independent human adjudicates contestant work.
2. Run the operator's calibration tests with the pinned Node version from
   `netlify.toml`. They exercise correct, broken and no-op controls. To check
   grading of returned code, provision a trusted Linux Node 22.22.3 image on
   the local Unix-socket Docker engine. Set `EVALS_NODE_IMAGE` to its immutable
   local `sha256:...` image ID and run `python3 -B evals/run.py calibrate`
   with the pack selected. The grader runs
   a bounded, unprivileged, offline container with a read-only root. Keep the
   Docker socket on the operator side.
3. Save `run.py environment` to a private `conditions.json`. Record the
   actual guest hardware, OS, tools, dependencies, permissions, isolation,
   network policy, immutable grading image ID and any token or dollar budget.
   For each model, export a credential-free record of the effective provider,
   model, effort, guest selection and tool-bridge configuration. Record the
   SHA-256 of its exact bytes. Store a private `routes.json` object mapping
   each model ID to that 64-character lowercase digest.
4. Have the independent validator run the following command using the
   conditions and route records they actually inspected. The output is the
   `setup` for their attestation. They verify each route reaches only its
   disposable guest and check the model settings, time limits, tool and
   network restrictions and separation from other sessions.

```sh
python3 -B evals/run.py validation-setup --environment /private/path/conditions.json --routes /private/path/routes.json
```

5. The validator records the exact benchmark `version` and combined `sha256`,
   `setup`, `reviewer`, `role` (`independent-validator`), `reviewed_at` and
   `evidence`. All five `checks` must pass: `task_realism`, `held_out_integrity`,
   `isolation`, `shortcut_controls` and `fixed_scoring`. A withheld isolation
   signoff can record `setup` as null. Archive the authenticated statement,
   pinned sources, environment and route records on the operator machine.

```sh
python3 -B evals/run.py freeze /private/path/validation.json
python3 -B evals/run.py plan sol-core --official --seed 353 --environment /private/path/conditions.json --routes /private/path/routes.json
python3 -B evals/run.py prepare sol-core r001
```

The plan interleaves the models and randomizes task order within each of
three repetitions. It binds each slot to the model, Max effort, base commit,
prompt, initial tree, time budget and operating conditions. Complete the
issued slot before preparing the next one. A frozen version and model roster
have one official schedule. A change to the environment or route map requires
fresh independent signoff. Additional approvals keep the same frozen benchmark
bytes and preserve earlier registrations. Official use requires a setup-bound
approval. Read older campaigns with their archived harness and pack.

The operator registry reserves the case-insensitive campaign name and, for an
official run, its model roster together. If registration stops before writing
`plan.json`, rerun the command with the original spelling to recover its
schedule and blind IDs. Include the `registrations/` directory in the private
campaign archive.

## Import a manual session

1. Copy only the contents of the slot's `candidate/` directory into a fresh,
   offline guest. Give both arms the same image, resources, tools and deadline.
   Keep host files, other chats, shared caches, credentials, external connectors,
   Git remotes and the grading service out of reach. Use synthetic fixtures for
   browser and provider work. Restrict the route to guest-only tools or use a
   tool-disabled provider session with a human relaying commands to that guest.
2. Before the model sees the task, return a copy of the initial guest tree
   and run `python3 -B evals/run.py packet-fingerprint /path/to/initial-export`.
   Record the measured hashes. Deliver the exact bytes of `TASK.md`. Capture
   the model, effort and provider from the actual session. Independently hash
   its effective route configuration into `route_sha256` and identify the
   receipt or export in `route_source`. Keep that record with the observation.
   A missing or different route digest makes the run ineligible for a decision.
   Log the commands, output and exit codes. Record an unavailable assignment
   when its exact route cannot be used.
3. Stop the guest on completion, deadline or prohibited action. Export the
   final text tree as data. Fill a copy of the slot's `evidence-template.json`
   with timestamps, complete sanitized messages and tool events, gate
   observations, isolation evidence and usage with its source. Use null for
   unavailable tokens and cost. Preserve failures, redactions and abandoned
   runs. A scored timeout requires prompt delivery and the full time allowance.
   Use `aborted` for an interrupted transport. Remove credentials and identifying
   banners before import. The importer also screens common credential patterns.
4. Import each finished assignment and keep its records operator-only.
   A completed run requires the stopped workspace, including new files. For
   an unavailable run, omit `--tree` and document the blocker in `notes`.

```sh
python3 -B evals/run.py import sol-core r001 /private/path/observation.json --tree /path/to/stopped-export
python3 -B evals/score.py blind sol-core
python3 -B evals/score.py review sol-core /private/path/completed-form.json
python3 -B evals/score.py report sol-core
```

Give the independent human only the opaque packet and matching blank form
in blind-ID order. Check free text and file metadata for identifying details
before handoff. The reviewer applies the fixed rubric, records the source for
each gate, and measures review and repair time separately. For a timeout the
reviewer receives the partial transcript, whether a final tree was observed,
any exported changes, and a gate-only form. A properly evidenced timeout
scores zero. Adjudication waits for resolved gate decisions
from both the operator and the blinded reviewer. Reports cover all
scheduled runs, per-task failures and reversals, measured usage, human time
and dispersion. Source and synthetic-local evidence have distinct labels from
browser, production and external-account verification. See the
[run schema](run.schema.json) and [scoring rubric](rubric.md).

To add a model, obtain signoff for the expanded route map, then repeat
`--model` with the baseline first at registration. Give
each contestant a fresh context. Builder familiarity is a limitation for a
future Astra comparison. To add a core task, version its private manifest and
inputs, supply calibrated assertions and blinded guidance, update the public
catalog and pack commitment, and obtain a new validation. Changes to a
prompt, fixture, grader, rubric or harness after observing any contestant
require a version bump and a full rerun of all candidates. The broader task
bank is tracked in [issue #353](https://github.com/waffy1901/personalWebsite/issues/353).
