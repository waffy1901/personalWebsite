# Private engineering activity report

The report measures repository activity, CI/CD, and security alerts for `waffy1901/personalWebsite`. It uses GitHub's read-only REST API and Python 3.11+ with the standard library on macOS or Linux. Counts and elapsed times describe repository-wide activity and delivery cadence.

## Run locally

```sh
npm run engineering:report -- --backfill
npm run engineering:report
npm run test:engineering:report
```

The first run fills the cache automatically. Use `--backfill` to refresh historical details after changing an exclusion or checking a GitHub history correction. Incremental runs re-list the current inventories and reuse unchanged commit, PR, and issue details. Deployment statuses are read again because new statuses can appear independently of the deployment record. Deleted records and rewritten default-branch history can change earlier totals. Repeat collection deduplicates records by source ID.

The collector uses `GH_TOKEN`, then `GITHUB_TOKEN`, then the active `gh auth token --hostname github.com` session. A fine-grained credential for all sources needs repository read access to Contents, Pull requests, Issues, Actions, Deployments, Code scanning alerts, Dependabot alerts, and Metadata. The collector follows GitHub pagination links on `https://api.github.com` and rejects redirects. The default `--max-requests 4000` budget includes every GET attempt, including retries. Each request gets at most three attempts and the total retry sleep budget defaults to 60 seconds (`--max-wait`). If GitHub requests a longer wait, rerun after the limit resets. For a Python installation with a missing certificate bundle, set `SSL_CERT_FILE` to a trusted system CA bundle, such as `/etc/ssl/cert.pem` where available.

Reports go to `~/.local/state/personalwebsite-engineering/current/report.json` and `report.md`. Use `--output-dir` for a different private directory outside Git worktrees. Use a trusted local path on a volume that enforces file ownership and permissions, and use a separate directory per repository if overriding `--repo`. The directory and files are owner-only. On macOS, the collector refuses ACLs on private output paths, including inherited entries. A lock serializes writes, cache replacement is atomic, and `current` switches the report pair together. Resolve `current` once before reading both files in an automated consumer. Older snapshot directories remain in the private output directory and can be removed when they are no longer needed. Keep the cache and reports local. The cache contains normalized counts, timestamps, record identifiers and revision keys. It omits credentials, names, titles, messages, patches, raw API responses and filenames.

For collection runs, exit code `0` means a report was published with complete GitHub coverage of the configured sources. Exit code `3` means a report was published with incomplete GitHub coverage. Exit code `1` means the run failed without publishing a report. Exit code `2` means invalid command usage or invalid AI usage input and leaves `current` untouched. Reports without AI usage use schema version 2. An opted-in report uses schema version 3 and adds `ai_usage` alongside the same GitHub metrics. The Markdown report compares lifetime, previous month, and current month to date, and shows the eight most recent UTC weeks. [Report JSON Schema](engineering-report.schema.json)

## Import AI usage locally

Pass an explicitly prepared, provider-neutral version 1 snapshot to include AI usage in a private report. The collector rejects this flag in GitHub Actions. Use a trusted local path outside Git worktrees and a regular file with mode `0600`, no macOS ACL, and a single filesystem link. The file itself cannot be a symlink. The limit is 1 MiB of UTF-8 JSON. Invalid imports stop before token lookup, GitHub collection, or any output change.

```sh
npm run engineering:report -- --ai-usage-file "$HOME/.local/state/ai-usage.json"
```

This synthetic snapshot includes an account-wide observation and an independently measured repository observation.

```json
{
  "schema_version": 1,
  "records": [
    {
      "source": "example-usage-export",
      "provider": "example-provider",
      "model": "example-model",
      "scope": "account",
      "start": "2026-09-01",
      "end": "2026-10-01",
      "metrics": {"input_tokens": 1000, "output_tokens": 200}
    },
    {
      "source": "example-repo-totals",
      "provider": "example-provider",
      "scope": "repository",
      "repository": "waffy1901/personalWebsite",
      "start": "2026-09-01",
      "end": "2026-09-02",
      "metrics": {"sessions": 2, "tool_calls": 0}
    }
  ]
}
```

- `source` is an operator-chosen label for the export or record. `provider` and optional `model` are stable identifiers. Use 1-64 ASCII letters, digits, periods, underscores, or hyphens, starting with a letter or digit. Omit `model` or use `null` for a source-reported provider-level series. Use consistent labels over time and keep the source reference and measurement method in private records you control.
- Each observation contains source-reported additive totals for the full UTC dates in `[start, end)`. Include one or more of `input_tokens`, `output_tokens`, `total_tokens`, `sessions`, `tool_calls`, and `duration_seconds`. Values are integers from 0 through 1,000,000,000,000, with duration measured in seconds. Omit metrics the source did not measure. The importer keeps measured zeroes and leaves omitted metrics unavailable. Use interval totals, converting cumulative counters to interval totals only when both boundaries and the calculation are supported by the source.
- `scope` is `account` for account-wide usage. Set `scope` to `repository` only when the source explicitly identifies this repository and include `repository` with the exact `--repo` spelling. Account usage has no repository or work-item field. A repository observation may include `work_item` with `url` set to `https://github.com/<owner>/<repo>/issues/<number>` or `https://github.com/<owner>/<repo>/pull/<number>` and `origin` set to `source_recorded`. Use it only when the source records the link or you have a contemporaneous private mapping that demonstrates it. Keep the supporting record privately. The collector confirms the item exists with the specified type before the report cutoff using the normal GitHub inventory. It relies on your attestation for the usage link. An unavailable or unresolved item excludes the observation and increments the exclusion count.
- Supply only sanitized aggregates and the allowlisted fields above. Keep transcripts, prompts, credentials, proprietary work data, private conversations, account IDs, and source paths out of the snapshot, including from labels. Duplicate keys and additional fields are rejected. The importer reads only the supplied file and uses the existing GitHub collection to check work items and retrieve delivery counts. Imported observations are retained in the private report pair. They stay out of the GitHub cache and are never sent to GitHub or an AI provider.
- Each account, repository-wide, and individual work-item series is independent, as are provider-level and model-level series. A series may include successive observations from different sources, with comparable definitions and non-overlapping intervals. The importer rejects overlapping intervals within the same series even when source labels differ. Usage can appear in multiple separate series if the source supplies those views. The report does not add those series together or estimate the repository share of an account total.
- Daily, Monday-based weekly, and calendar-monthly rollups include observations wholly contained in the corresponding UTC window. An interval crossing a boundary can appear at a coarser resolution. The importer excludes intervals ending after the cutoff and never prorates an interval. Lifetime means the imported observed span for the series. `covered_days` and `record_count` show the amount of each window represented. A metric is N/A if an included observation omits it. An empty import also shows N/A. The JSON retains the accepted observations with their source labels and dates.
- A fully covered calendar month for a repository-wide series can show the repository's merged PR count for the exact same month when GitHub PR coverage is complete. Each count describes its own measured population. The comparison provides descriptive context for the report owner. It cannot establish causal impact or measure individual productivity.

## Weekly workflow

The Engineering report workflow runs on Wednesdays at 09:43 UTC. Use **Run workflow** on the default branch for an on-demand backfill. Each run reads visible history from a fresh runner directory with an 800-request cap and a 20-minute job timeout. The job uses the repository-scoped read-only `GITHUB_TOKEN`. It sets `--skip-dependabot` because the Dependabot permission is unsupported by the pinned workflow linter. Dependabot is marked `not_collected` in that run and is available in the local report with the permissions above.

The workflow logs a collection status and removes its scratch files at exit. Report files and the cache stay off public Actions artifacts and caches. To keep the Markdown and JSON, run the collector locally. If a workflow fails, use the local report's coverage reasons to distinguish a request budget, missing access, and unavailable source records. [GitHub artifact access](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts)

## Metric definitions

| Metric | Population, timing and calculation |
| --- | --- |
| Commits and active days | Distinct commit SHAs reachable from the default branch tip captured during the run, including merges and commits by automation. Bucket by Git committer timestamp. An active day is a UTC date with at least one such commit. |
| Source churn and files changed | Sum additions, deletions and file touches for reachable non-merge commits in each window. A file touch is one changed-file row per commit, so a file changed in several commits counts several times. A rename is one file touch. GitHub's commit statistics supply raw additions and deletions. File rows supply eligible totals after exclusions. Binary files can contribute touches even when GitHub reports zero changed lines. |
| PR activity and throughput | Repository PRs by distinct number across base branches and author types, including drafts. Opened uses creation time and merged uses merge time. Closed-unmerged uses the current closed state with no merge timestamp and buckets by the recorded close time. Transient closes followed by reopen are not a separate PR metric. Throughput is the number merged in each window. |
| PR time to merge | Elapsed wall-clock seconds from PR creation through merge. Denominator is all PRs that merged in the window, regardless of creation date. Draft time, weekends and any period when the PR was closed are included. |
| Merged PR size | GitHub PR-detail additions plus deletions for each PR that merged in the window. Size uses the full reported PR diff, including generated/vendor files, and is separate from eligible source churn. The distribution includes median, p90 and counts for 0-49, 50-199, 200-499 and 500+ changed lines. |
| Issue activity and completion | Issues by distinct number, excluding pull requests returned by the issues endpoint. Opened uses original creation time. Closed and reopened count separate GitHub transitions, deduplicated by event ID and bucketed by event time. The same issue can contribute several closures. |
| Outstanding issue backlog | Number of issues open immediately before the window's exclusive end. Derive from issues created before that time plus reopens minus closures. An issue closed exactly at the boundary contributes to the next window. |
| Issue resolution time | Wall-clock seconds from original opening or most recent reopen to its next close. Denominator is closure episodes in the window. This includes closures regardless of GitHub's close reason. |
| Actions runs and check outcomes | Distinct run IDs by original creation time, grouped by workflow ID, including CI, CodeQL, and other checks run as workflows. Reruns contribute the latest observed attempt. Completed runs group by GitHub conclusion, and unfinished runs have a separate count. Check status is reported at the workflow level. |
| Actions duration | Approximate elapsed seconds from the latest attempt's `run_started_at` to the completed run record's `updated_at`. The clock starts when the latest attempt begins executing. The sample size includes completed records with usable timestamps, including failed and cancelled runs. |
| Published and deploy provenance releases | Count non-draft GitHub releases by ID and publication timestamp. On this portfolio, matching `deploy-YYYYMMDDTHHMMSSZ-<7 hex characters>` releases form a subset that follows the pipeline's production publish convention. Count these releases at GitHub publication time. |
| GitHub deployments | Count GitHub deployment IDs by creation time. Group by the latest visible status, ordered by its creation time and ID. An empty status list counts as unreported. Missing status access leaves the state breakdown unavailable. |
| Code scanning and Dependabot | Count distinct alerts within each source, by creation time for openings and recorded closure time for current resolutions. Code scanning uses the rule's security severity or rule severity. Dependabot uses vulnerability or advisory severity. Resolution reasons distinguish fixed, dismissed, and auto-dismissed. |
| Median and p90 | Median averages the two central observations for even sample sizes. p90 is nearest rank, the observation at position `ceil(0.90 * n)` in ascending order. Distributions carry `n`, flag samples of 1-4, and have null percentiles for `n=0`. |

Eligible churn excludes `package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock` and `bun.lockb` by basename. It excludes files under `node_modules`, `vendor`, `dist`, `build` and `coverage` directories. Repository-specific generated outputs under `main/public/` are `ai-summary.txt`, `llms.txt`, `portfolio.json`, `sitemap.xml`, `waffyAhmedResume.pdf` and paths beginning `resume-preview`. When a file is renamed, either path can make it ineligible. Generated sections within maintained files count with the containing file.

## Timing and coverage

- A period is `[start, end)` in UTC. Weeks start Monday, and months start on the first UTC day. The cutoff `as_of` is the collection start. `collected_at` is when API collection finished. Current windows end at the cutoff and are marked partial. Lifetime spans the UTC day of the earlier of repository creation or first observed activity through the cutoff. `history_available` identifies comparison windows reaching observed history. A zero represents a measured empty population. Null values and Markdown N/A represent unavailable data or undefined percentiles.
- GitHub returns the commits reachable from the pinned branch tip and the PRs, issues, and issue events still visible to the credential. Imported Git timestamps can precede repository creation. Deleted or transferred records, old commits no longer reachable, and history omitted by GitHub cannot be recovered by this backfill. PR and issue inventories are read during the run, so they can change while the cutoff is fixed. Same-second boundary updates may appear in the next run.
- Each issue timeline must alternate closures and reopens and agree with the current GitHub state. The latest close event must match the issue record's `closed_at` exactly or occur one second later. Rollups always use the event timestamp. An incomplete timeline makes affected issue transitions, resolution and backlog unavailable from that issue's creation forward. Opened issue counts still use the independent inventory. A changed issue revision triggers a fresh timeline read. Timelines fetched with an inventory update timestamp at or after the cutoff are not reused.
- Missing commit or PR details make churn or PR size unavailable in affected periods. Commit detail files are paginated and a listing at GitHub's 3,000-file cap is treated as unavailable. The remaining independent counts stay visible. Coverage lists completed and expected records for each source.
- Actions totals cover records still visible through GitHub's retention and access policies. The report records the oldest visible run and leaves windows ending before it or at its creation time unavailable. A successful empty inventory means zero visible runs. A changing or unreconciled total makes the inventory unavailable. Conclusions, deployment states, and alert states reflect the collection-time snapshot, so reruns and state changes can revise historical windows.
- GitHub deployment records and deploy provenance releases are separate populations. Provider-side attempts, failures, and deploys without a GitHub record or release are unavailable. [Deployment release policy](release-versioning.md)
- Alert openings use the visible inventory. Current resolutions use `fixed_at`, `dismissed_at`, or `auto_dismissed_at` as appropriate. Reopened alerts are open and earlier closures can be absent from a backfill. A closed alert without a usable timestamp leaves resolutions unavailable in affected windows and preserves the independent opening count.

## Source and cross-check procedure

- Compare the pinned commit inventory against GitHub's default-branch history, including duplicate SHA handling and the distinction between total and non-merge commits. [List commits](https://docs.github.com/en/rest/commits/commits#list-commits) and [Get a commit](https://docs.github.com/en/rest/commits/commits#get-a-commit)
- Compare the counts for PRs opened, merged, and closed unmerged with the repository PR inventory. For sampled PRs in the report, verify creation and merge timestamps and additions/deletions on the PR detail. [List pull requests](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests) and [Get a pull request](https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request)
- Compare issue totals and current backlog with the repository issue list after excluding PR rows. For sampled closure episodes, subtract the issue creation or previous reopen timestamp from the matching close event. [List repository issues](https://docs.github.com/en/rest/issues/issues#list-repository-issues) and [List issue events](https://docs.github.com/en/rest/issues/events#list-issue-events)
- Reconcile Actions totals with the unfiltered run inventory. On a sampled run, compare the latest attempt and conclusion, and subtract its start timestamp from the run record's update timestamp. [List workflow runs](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-repository) and [Actions retention](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)
- Compare published releases and the deploy release subset with GitHub. Compare deployment counts and any sampled statuses with their own inventory. [List releases](https://docs.github.com/en/rest/releases/releases#list-releases), [list deployments](https://docs.github.com/en/rest/deployments/deployments#list-deployments), and [list deployment statuses](https://docs.github.com/en/rest/deployments/statuses#list-deployment-statuses)
- Compare alert counts and a sampled alert's source, severity, state, and opening or resolution timestamp. [List Code scanning alerts](https://docs.github.com/en/rest/code-scanning/code-scanning#list-code-scanning-alerts-for-a-repository) and [list Dependabot alerts](https://docs.github.com/en/rest/dependabot/alerts#list-dependabot-alerts-for-a-repository)
