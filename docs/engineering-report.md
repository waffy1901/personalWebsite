# Private engineering activity report

Phase 1 measures repository activity for `waffy1901/personalWebsite`. The collector uses GitHub's read-only REST API and Python 3.11+ with the standard library on macOS or Linux. It aggregates repository records across all contributors and automation. Counts and elapsed times describe activity and delivery cadence. They do not establish individual performance or business impact.

## Run locally

```sh
npm run engineering:report -- --backfill
npm run engineering:report
npm run test:engineering:report
```

The first run fills the cache automatically. Use `--backfill` to refresh all historical details, for example after changing an exclusion or checking a GitHub history correction. Incremental runs re-list the current inventories, then fetch details only for new or changed records. The collector removes records absent from a successfully re-listed inventory, so deleted records and rewritten default-branch history can change earlier totals. Repeat collection does not append duplicate events.

The collector uses `GH_TOKEN`, then `GITHUB_TOKEN`, then the active `gh auth token --hostname github.com` session. A fine-grained credential needs read access to the repository's Contents, Pull requests, Issues, and Metadata. The collector makes only HTTPS GET requests to `api.github.com`. It follows GitHub's pagination links on that origin and refuses HTTP redirects. It uses the server's rate-limit delay, a bounded fallback for secondary throttling, and at most three attempts per request. The total retry sleep budget defaults to 60 seconds and is configurable via `--max-wait`. If GitHub requests a longer wait, rerun after the limit resets. For a Python installation with a missing certificate bundle, set `SSL_CERT_FILE` to a trusted system CA bundle, such as `/etc/ssl/cert.pem` where available.

Reports go to `~/.local/state/personalwebsite-engineering/current/report.json` and `report.md`. Use `--output-dir` for a different private directory outside Git worktrees. Use a separate directory per repository if overriding `--repo`. The directory and files are owner-only. A lock serializes writes, cache replacement is atomic, and `current` switches the report pair together. Resolve `current` once before reading both files in an automated consumer. Older snapshot directories remain in the private output directory and can be removed when they are no longer needed. Keep the cache and reports local. The cache contains normalized counts, timestamps, record identifiers and revision keys. It omits credentials, names, titles, messages, patches, raw API responses and filenames.

Exit code `0` means the streams returned all expected records and `2` means the published report has incomplete coverage. Exit code `1` means no report was published by that invocation. The [JSON Schema v1](engineering-report.schema.json) describes the machine-readable report. The Markdown report compares lifetime, previous month and current month to date, and shows the eight most recent UTC weeks.

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
| Median and p90 | Median averages the two central observations for even sample sizes. p90 is nearest rank, the observation at position `ceil(0.90 * n)` in ascending order. Distributions carry `n`, flag samples of 1-4, and have null percentiles for `n=0`. |

Eligible churn excludes `package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock` and `bun.lockb` by basename. It excludes files under `node_modules`, `vendor`, `dist`, `build` and `coverage` directories. Repository-specific generated outputs under `main/public/` are `ai-summary.txt`, `llms.txt`, `portfolio.json`, `sitemap.xml`, `waffyAhmedResume.pdf` and paths beginning `resume-preview`. When a file is renamed, either path can make it ineligible. Generated sections within maintained files count with the containing file.

## Timing and coverage

- A period is `[start, end)` in UTC. Weeks start Monday, and months start on the first UTC day. The cutoff `as_of` is the collection start. `collected_at` is when API collection finished. Current windows end at the cutoff and are marked partial. Lifetime spans the UTC day of the earlier of repository creation or first observed activity through the cutoff. `history_available` identifies comparison windows reaching observed history. A zero represents a measured empty population. Null values and Markdown N/A represent unavailable data or undefined percentiles.
- GitHub returns the commits reachable from the pinned branch tip and the PRs, issues, and issue events still visible to the credential. Imported Git timestamps can precede repository creation. Deleted or transferred records, old commits no longer reachable, and history omitted by GitHub cannot be recovered by this backfill. PR and issue inventories are read during the run, so they can change while the cutoff is fixed. Same-second boundary updates may appear in the next run.
- Each issue timeline must alternate closures and reopens and agree with the current GitHub state. The latest close event must match the issue record's `closed_at` exactly or occur one second later. Rollups always use the event timestamp. An incomplete timeline makes affected issue transitions, resolution and backlog unavailable from that issue's creation forward. Opened issue counts still use the independent inventory. A changed issue revision triggers a fresh timeline read. Timelines fetched with an inventory update timestamp at or after the cutoff are not reused.
- Missing commit or PR details make churn or PR size unavailable in affected periods. Commit detail files are paginated and a listing at GitHub's 3,000-file cap is treated as unavailable. The remaining independent counts stay visible. Coverage lists completed and expected records for each source.

## Source and cross-check procedure

- Compare the pinned commit inventory against GitHub's default-branch history, including duplicate SHA handling and the distinction between total and non-merge commits. [List commits](https://docs.github.com/en/rest/commits/commits#list-commits) and [Get a commit](https://docs.github.com/en/rest/commits/commits#get-a-commit)
- Compare the counts for PRs opened, merged, and closed unmerged with the repository PR inventory. For sampled PRs in the report, verify creation and merge timestamps and additions/deletions on the PR detail. [List pull requests](https://docs.github.com/en/rest/pulls/pulls#list-pull-requests) and [Get a pull request](https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request)
- Compare issue totals and current backlog with the repository issue list after excluding PR rows. For sampled closure episodes, subtract the issue creation or previous reopen timestamp from the matching close event. [List repository issues](https://docs.github.com/en/rest/issues/issues#list-repository-issues) and [List issue events](https://docs.github.com/en/rest/issues/events#list-issue-events)
