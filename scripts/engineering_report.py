"""Collect private GitHub repository activity and publish a local report."""

import argparse
from collections import defaultdict
import ctypes
from datetime import UTC, datetime, timedelta
import errno
import fcntl
from http.client import IncompleteRead
import json
import os
from pathlib import Path
import re
import shutil
import ssl
import stat
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from engineering_metrics import build_report, render_markdown, timestamp


API = "https://api.github.com"
DEFAULT_REPO = "waffy1901/personalWebsite"
ROOT = Path(__file__).resolve().parents[1]
CACHE_VERSION = 1
REPO_NAME = re.compile(r"[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+")
SHA = re.compile(r"[0-9a-f]{40}")
NEXT_LINK = re.compile(r'<([^>]+)>\s*;\s*rel="next"')


class Unavailable(Exception):
    """A source could not be read or reconciled."""


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def forbidden_detail(error):
    limit = 4096
    try:
        body = error.read(limit)
    except IncompleteRead as truncated:
        return truncated.partial.decode(errors="replace"), True
    except OSError:
        return "", True
    # A bounded read can return early at EOF without raising IncompleteRead.
    try:
        length = int(error.headers.get("Content-Length", "0"))
    except ValueError:
        length = 0
    interrupted = not error.headers.get("Transfer-Encoding") and len(body) < min(length, limit)
    return body.decode(errors="replace"), interrupted


def read_token():
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        return token.strip()
    try:
        result = subprocess.run(
            ["gh", "auth", "token", "--hostname", "github.com"],
            check=True, capture_output=True, text=True, timeout=10,
        )
        if result.stdout.strip():
            return result.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        pass
    raise Unavailable("Set GH_TOKEN or GITHUB_TOKEN, or authenticate gh for github.com.")


class GitHub:
    def __init__(self, repo, token, max_wait=60, opener=None, sleep=time.sleep, now=time.time):
        self.base = f"{API}/repos/{repo}"
        self.token = token
        self.max_wait = max_wait
        self.waited = 0
        self.blocked_reason = None
        self.open = opener or build_opener(NoRedirect()).open
        self.sleep = sleep
        self.now = now

    def retry_delay(self, status, headers, detail, attempt):
        if status in (403, 429):
            try:
                if headers.get("Retry-After") is not None:
                    return max(1, int(headers["Retry-After"]))
                if headers.get("X-RateLimit-Remaining") == "0":
                    return max(1, int(headers["X-RateLimit-Reset"]) - self.now() + 1)
            except (ValueError, KeyError):
                return 60 * 2 ** attempt
            if status == 429 or "rate limit" in detail.lower():
                return 60 * 2 ** attempt
        if 500 <= status <= 599:
            return 2 ** attempt
        return None

    def get(self, url):
        if self.blocked_reason:
            raise Unavailable(self.blocked_reason)
        target = urlsplit(url)
        if (target.scheme, target.netloc) != ("https", "api.github.com"):
            raise Unavailable("GitHub pagination left the API origin")
        request = Request(url, headers={
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "personalWebsite-engineering-report",
        })
        for attempt in range(3):
            try:
                with self.open(request, timeout=30) as response:
                    return json.load(response), response.headers.get("Link", "")
            except HTTPError as error:
                with error:
                    detail, interrupted = forbidden_detail(error) if error.code == 403 else ("", False)
                delay = self.retry_delay(error.code, error.headers, detail, attempt)
                throttled = delay is not None and error.code in (403, 429)
                reason = f"GitHub HTTP {error.code}"
                if delay is None and interrupted:
                    delay = 2 ** attempt
                    reason += " response body interrupted"
                if delay is None:
                    if error.code == 401:
                        self.blocked_reason = reason
                    raise Unavailable(reason) from None
                if attempt == 2 or self.waited + delay > self.max_wait:
                    reason += ", retry budget exhausted"
                    if throttled:
                        self.blocked_reason = reason
                    raise Unavailable(reason) from None
                self.waited += delay
                self.sleep(delay)
            except (URLError, OSError, IncompleteRead) as error:
                if isinstance(getattr(error, "reason", error), ssl.SSLCertVerificationError):
                    self.blocked_reason = "GitHub TLS certificate verification failed"
                    raise Unavailable(self.blocked_reason) from None
                delay = 2 ** attempt
                if attempt == 2 or self.waited + delay > self.max_wait:
                    self.blocked_reason = "GitHub connection failed, retry budget exhausted"
                    raise Unavailable(self.blocked_reason) from None
                self.waited += delay
                self.sleep(delay)
            except ValueError:
                raise Unavailable("Invalid GitHub JSON response") from None

    def object(self, endpoint):
        data, _ = self.get(f"{self.base}{endpoint}")
        if not isinstance(data, dict):
            raise Unavailable("Unexpected GitHub object response")
        return data

    def pages(self, endpoint, **params):
        url = f"{self.base}{endpoint}?{urlencode({'per_page': 100, **params})}"
        seen = set()
        while url:
            if url in seen:
                raise Unavailable("GitHub pagination repeated a page")
            seen.add(url)
            data, links = self.get(url)
            yield data
            link = NEXT_LINK.search(links)
            url = link[1] if link else None

    def rows(self, endpoint, **params):
        for page in self.pages(endpoint, **params):
            if not isinstance(page, list):
                raise Unavailable("Unexpected GitHub inventory response")
            yield from page


def nonnegative(value):
    if type(value) is not int or value < 0:
        raise ValueError("Invalid GitHub count")
    return value


def required_timestamp(value):
    result = timestamp(value)
    if result is None:
        raise ValueError("Missing GitHub timestamp")
    return result


def commit_inventory(api, branch):
    head = api.object(f"/branches/{quote(branch, safe='')}")["commit"]["sha"]
    if not SHA.fullmatch(head):
        raise ValueError("Invalid default branch SHA")
    commits = {}
    for row in api.rows("/commits", sha=head):
        sha = row["sha"]
        if not SHA.fullmatch(sha):
            raise ValueError("Invalid commit SHA")
        commits[sha] = {
            "at": required_timestamp(row["commit"]["committer"]["date"]),
            "merge": len(row["parents"]) > 1,
        }
    if head not in commits:
        raise Unavailable("Default branch tip missing from commit inventory")
    return {"branch": branch, "sha": head, "commits": commits}


LOCKFILES = {
    "package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock",
    "bun.lock", "bun.lockb",
}
GENERATED = {
    "main/public/ai-summary.txt", "main/public/llms.txt", "main/public/portfolio.json",
    "main/public/sitemap.xml", "main/public/waffyAhmedResume.pdf",
}
GENERATED_DIRS = {"node_modules", "vendor", "dist", "build", "coverage"}


def excluded(path):
    parts = path.split("/")
    return (
        path in GENERATED or parts[-1] in LOCKFILES
        or bool(GENERATED_DIRS.intersection(parts[:-1]))
        or path.startswith("main/public/resume-preview")
    )


def read_churn(api, sha):
    raw = None
    files = {}
    for page in api.pages(f"/commits/{sha}"):
        if page["sha"] != sha:
            raise ValueError("Unexpected commit SHA")
        if raw is None:
            raw = {key: nonnegative(page["stats"][key]) for key in ("additions", "deletions")}
        for row in page["files"]:
            files[row["filename"]] = row
    if len(files) >= 3000:
        raise Unavailable("Commit file listing reached GitHub's 3000-file limit")
    if raw is None:
        raise Unavailable("GitHub omitted commit details")
    eligible = {key: 0 for key in raw}
    eligible_count = 0
    for path, row in files.items():
        if excluded(path) or excluded(row.get("previous_filename", path)):
            continue
        eligible_count += 1
        for key in eligible:
            eligible[key] += nonnegative(row[key])
    return {
        "raw": {**raw, "file_touches": len(files)},
        "eligible": {**eligible, "file_touches": eligible_count},
    }


def pull_inventory(api):
    pulls = {}
    for row in api.rows("/pulls", state="all", sort="created", direction="asc"):
        number = nonnegative(row["number"])
        state = row["state"]
        created = required_timestamp(row["created_at"])
        closed = required_timestamp(row["closed_at"]) if state == "closed" else None
        merged = timestamp(row["merged_at"])
        if state not in ("open", "closed") or (closed and closed < created) or (merged and not closed):
            raise ValueError("Invalid GitHub pull request state")
        if merged and merged < created:
            raise ValueError("Invalid GitHub pull request chronology")
        pulls[number] = {
            "created": created,
            "closed": closed,
            "merged": merged,
            "base": row["base"]["sha"],
            "head": row["head"]["sha"],
        }
    return pulls


def pull_size(api, number, pull):
    detail = api.object(f"/pulls/{number}")
    if (
        timestamp(detail["merged_at"]) != pull["merged"]
        or detail["head"]["sha"] != pull["head"]
        or detail["base"]["sha"] != pull["base"]
    ):
        raise Unavailable("Merged PR revision changed during collection")
    return nonnegative(detail["additions"]) + nonnegative(detail["deletions"])


def issue_inventory(api):
    issues = {}
    for row in api.rows("/issues", state="all", sort="created", direction="asc"):
        if "pull_request" in row:
            continue
        number = nonnegative(row["number"])
        issues[number] = {
            "created": required_timestamp(row["created_at"]),
            "closed": timestamp(row["closed_at"]),
            "updated": required_timestamp(row["updated_at"]),
            "state": row["state"],
        }
    return issues


def issue_events(api, number, issue):
    events = {}
    for row in api.rows(f"/issues/{number}/events"):
        if row["event"] in ("closed", "reopened"):
            events[nonnegative(row["id"])] = [required_timestamp(row["created_at"]), row["event"]]
    ordered = [[event_id, *events[event_id]] for event_id in sorted(
        events, key=lambda event_id: (events[event_id][0], event_id)
    )]
    state = "open"
    last_close = None
    for _, at, event in ordered:
        if at < issue["created"] or (event == "closed") != (state == "open"):
            raise Unavailable("Issue timeline has inconsistent transitions")
        state = "closed" if event == "closed" else "open"
        if state == "closed":
            last_close = at
    if state != issue["state"]:
        raise Unavailable("Issue timeline does not match inventory state")
    if state == "closed":
        inventory_close = required_timestamp(issue["closed"])
        skew = datetime.fromisoformat(last_close) - datetime.fromisoformat(inventory_close)
        # GitHub can emit the close event one second after setting the issue's closed_at.
        if skew not in (timedelta(0), timedelta(seconds=1)):
            raise Unavailable("Issue timeline does not match inventory close timestamp")
    return ordered


def collect(api, cache, as_of):
    coverage = {}
    repository_created_at = None

    def read_commits(api):
        nonlocal repository_created_at
        metadata = api.object("")
        repository_created_at = required_timestamp(metadata["created_at"])
        return commit_inventory(api, metadata["default_branch"])

    def inventory(name, load):
        try:
            rows = load(api)
        except (Unavailable, KeyError, ValueError, TypeError) as error:
            coverage[name] = {"status": "unavailable", "expected": None, "collected": 0,
                              "reason": str(error) if isinstance(error, Unavailable) else "Invalid GitHub data"}
            return None
        count = len(rows["commits"] if name == "commits" else rows)
        coverage[name] = {"status": "complete", "expected": count, "collected": count, "reason": None}
        return rows

    def details(name, keys, revision, read):
        if keys is None:
            coverage[name] = {"status": "unavailable", "expected": None, "collected": 0,
                              "reason": "Inventory unavailable"}
            return None
        previous = cache.get(name, {})
        current = {}
        reasons = defaultdict(int)
        forbidden = False
        for key in keys:
            cached = previous.get(str(key))
            signature = revision(key)
            if signature is not None and cached is not None and cached["revision"] == signature:
                current[str(key)] = cached
                continue
            if forbidden:
                reasons["GitHub HTTP 403"] += 1
                continue
            try:
                value = read(key)
                current[str(key)] = {"revision": signature, "value": value}
            except (Unavailable, KeyError, ValueError, TypeError) as error:
                reason = str(error) if isinstance(error, Unavailable) else "Invalid GitHub data"
                reasons[reason] += 1
                forbidden = reason == "GitHub HTTP 403"
        cache[name] = current
        coverage[name] = {
            "status": "complete" if len(current) == len(keys) else "partial" if current else "unavailable",
            "expected": len(keys),
            "collected": len(current),
            "reason": "; ".join(f"{reason} ({count})" for reason, count in sorted(reasons.items())) or None,
        }
        return {key: current[str(key)]["value"] for key in keys if str(key) in current}

    commits = inventory("commits", read_commits)
    pulls = inventory("pull_requests", pull_inventory)
    issues = inventory("issues", issue_inventory)
    churn = details(
        "commit_churn",
        None if commits is None else [
            sha for sha, commit in commits["commits"].items()
            if not commit["merge"] and commit["at"] < as_of
        ],
        lambda sha: sha,
        lambda sha: read_churn(api, sha),
    )
    sizes = details(
        "merged_pr_size",
        None if pulls is None else [
            number for number, pull in pulls.items() if pull["merged"] and pull["merged"] < as_of
        ],
        lambda number: [pulls[number][key] for key in ("merged", "base", "head")],
        lambda number: pull_size(api, number, pulls[number]),
    )
    events = details(
        "issue_lifecycle",
        None if issues is None else [number for number, issue in issues.items() if issue["created"] < as_of],
        lambda number: issues[number] if issues[number]["updated"] < as_of else None,
        lambda number: issue_events(api, number, issues[number]),
    )
    return repository_created_at, commits, pulls, issues, churn, sizes, events, coverage


def require_private(path, kind, fd=None):
    info = path.lstat() if fd is None else os.fstat(fd)
    if not kind(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise Unavailable(f"Expected owner-only access to {path}")
    if sys.platform != "darwin":
        return
    if fd is not None:
        require_no_macos_acl(path, fd)
        return
    opened = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        require_private(path, kind, opened)
    finally:
        os.close(opened)


def require_no_macos_acl(path, fd):
    # Darwin's ACLs can grant access beyond mode bits, including by inheritance.
    libc = ctypes.CDLL("/usr/lib/libSystem.B.dylib", use_errno=True)
    libc.acl_get_fd.argtypes = [ctypes.c_int]
    libc.acl_get_fd.restype = ctypes.c_void_p
    libc.acl_free.argtypes = [ctypes.c_void_p]
    libc.acl_free.restype = ctypes.c_int
    ctypes.set_errno(0)
    acl = libc.acl_get_fd(fd)
    if acl is not None:
        libc.acl_free(acl)
        raise Unavailable(f"Expected owner-only access without a macOS ACL to {path}")
    # With an open descriptor, Darwin uses ENOENT to report an absent ACL.
    if ctypes.get_errno() != errno.ENOENT:
        raise Unavailable(f"Could not verify macOS ACL for {path}")


def prepare_output(path):
    # Resolve for the checkout check and use the resolved path for all writes.
    path = path.expanduser().resolve()
    if path == ROOT or ROOT in path.parents or any((p / ".git").exists() for p in (path, *path.parents)):
        raise Unavailable("Use a private output directory outside Git worktrees.")
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    require_private(path, stat.S_ISDIR)
    return path


def write_file(path, contents):
    with path.open("x", encoding="utf-8") as stream:
        require_private(path, stat.S_ISREG, stream.fileno())
        stream.write(contents)


def load_cache(directory, repo, backfill):
    path = directory / "cache.json"
    if backfill or not path.exists():
        return {}
    require_private(path, stat.S_ISREG)
    with path.open(encoding="utf-8") as stream:
        cache = json.load(stream)
    if cache.get("version") != CACHE_VERSION or cache.get("repository") != repo:
        return {}
    return cache["data"]


def publish(directory, repo, cache, report):
    # Readers can resolve current once to consume a matching pair.
    require_private(directory, stat.S_ISDIR)
    snapshot = Path(tempfile.mkdtemp(prefix="snapshot-", dir=directory))
    cache_temp = snapshot / "cache.json"
    link_temp = directory / f".{snapshot.name}-current"
    try:
        require_private(snapshot, stat.S_ISDIR)
        write_file(snapshot / "report.json", json.dumps(report, indent=2) + "\n")
        write_file(snapshot / "report.md", render_markdown(report))
        write_file(cache_temp, json.dumps({"version": CACHE_VERSION, "repository": repo, "data": cache}) + "\n")
        link_temp.symlink_to(snapshot.name, target_is_directory=True)
        os.replace(cache_temp, directory / "cache.json")
        os.replace(link_temp, directory / "current")
    except Exception:
        link_temp.unlink(missing_ok=True)
        shutil.rmtree(snapshot)
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=DEFAULT_REPO, help="GitHub owner/name")
    parser.add_argument("--output-dir", type=Path, default=Path.home() / ".local/state/personalwebsite-engineering")
    parser.add_argument("--backfill", action="store_true", help="Re-read all details from GitHub")
    parser.add_argument("--max-wait", type=int, default=60, help="Total retry sleep budget in seconds")
    args = parser.parse_args()
    if not REPO_NAME.fullmatch(args.repo) or args.repo.split("/")[1] in (".", ".."):
        parser.error("--repo must be a GitHub owner/name")
    if args.max_wait < 0:
        parser.error("--max-wait must be nonnegative")
    os.umask(0o077)
    try:
        api = GitHub(args.repo, read_token(), args.max_wait)
        directory = prepare_output(args.output_dir)
        lock_path = directory / ".lock"
        lock_fd = os.open(lock_path, os.O_CREAT | os.O_WRONLY | os.O_NOFOLLOW, 0o600)
        with os.fdopen(lock_fd, "w") as lock:
            require_private(lock_path, stat.S_ISREG, lock.fileno())
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise Unavailable("Another collection is using this directory.") from None
            cache = load_cache(directory, args.repo, args.backfill)
            as_of = timestamp(datetime.now(UTC).isoformat(timespec="seconds"))
            data = collect(api, cache, as_of)
            collected_at = timestamp(datetime.now(UTC).isoformat(timespec="seconds"))
            report = build_report(args.repo, as_of, *data, collected_at=collected_at)
            publish(directory, args.repo, cache, report)
        print(f"Report published locally to {directory / 'current'}")
        incomplete = [name for name, item in data[-1].items() if item["status"] != "complete"]
        if incomplete:
            print(f"Incomplete GitHub coverage: {', '.join(incomplete)}", file=sys.stderr)
            return 3
    except (Unavailable, OSError, ValueError, KeyError, TypeError) as error:
        print(f"Engineering report failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
