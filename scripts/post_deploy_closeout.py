#!/usr/bin/env python3
"""Bounded post-deploy issue closeout. Stdlib only; contracts are data, never code."""
import argparse
import base64
import copy
from datetime import datetime, timezone, timedelta
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler

sys.dont_write_bytecode = True
from check_netlify_published_deploy import classify_site  # noqa: E402

# Share provider URL/identity validation with the existing read-only evidence skill.
_spec = importlib.util.spec_from_file_location(
    "portfolio_deployment_evidence",
    Path(__file__).resolve().parents[1] / ".codex/skills/portfolio-deployment-verifier/scripts/verify_deployment_evidence.py")
_deployment_evidence = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_deployment_evidence)

REPO = "waffy1901/personalWebsite"
PROJECT_URL = "https://github.com/users/waffy1901/projects/2"
UPSTREAM = ".github/workflows/release-on-deploy.yml"
UPSTREAM_HASH = "0a0c22bae41f851ddcd83d887b7bd76e825bf7aa613c84d8da3e188b25353fe6"
BOT_ID = 41898282  # GitHub's github-actions[bot], not a contract-supplied identity.
SHA = re.compile(r"[0-9a-f]{40}")
TASK = re.compile(r"^(\s*(?:[-*+] |[0-9]+[.)] )\[)([ xX])(\].*)$")
CATALOG = {
    "source.merged_pr": ("Source", None, None),
    "checks.lint": ("Local checks", "Verify app", "Lint"),
    "checks.test": ("Local checks", "Verify app", "Test"),
    "checks.build": ("Local checks", "Verify app", "Build"),
    "checks.csp": ("Local checks", "Create release", "Verify CSP JSON-LD hash"),
    "http.immutable": ("Production HTTP", "Create release", "Validate immutable deployment"),
    "http.routes": ("Production HTTP", "Create release", "Validate deployed routes"),
    "http.headers": ("Production HTTP", "Create release", "Validate deployed security headers"),
    "http.artifacts": ("Production HTTP", "Create release", "Validate deployed artifacts"),
    "http.legacy_redirect": ("Production HTTP", "Create release", "Validate legacy Netlify domain redirect"),
}
REQUIRED_STEPS = {
    "Verify app": ["Lint", "Test", "Build"],
    "Resolve Netlify production deploy": ["Resolve Netlify production deploy"],
    "Create release": ["Verify CSP JSON-LD hash", "Validate immutable deployment",
                       "Validate deployed routes", "Validate deployed security headers",
                       "Validate deployed artifacts", "Validate legacy Netlify domain redirect",
                       "Recheck published deployment before release", "Create GitHub release"],
}


class Pending(Exception):
    """Missing evidence, changed state, or unsupported schema: do not infer success."""


def require(condition, message):
    if not condition:
        raise Pending(message)


def digest(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def fingerprint(snapshot):
    return digest(canonical(snapshot))


def strict_json(text):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, "duplicate JSON key")
            result[key] = value
        return result
    return json.loads(text, object_pairs_hook=pairs,
                      parse_constant=lambda _: (_ for _ in ()).throw(Pending("invalid JSON number")))


def instant(value):
    require(isinstance(value, str), "missing evidence timestamp")
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(result.tzinfo is not None, "timestamp needs timezone")
    return result


def unique(items, key, description):
    values = [i[key] for i in items]
    require(len(values) == len(set(values)), f"duplicate {description}")
    return items


def validate_contract(contract, body=None, number=None):
    require(isinstance(contract, dict) and set(contract) == {
        "version", "issue", "body_sha256", "evidence_needed", "requirements", "context_lines"
    }, "contract keys must match version 1 schema")
    require(type(contract["version"]) is int and contract["version"] == 1, "unsupported contract version")
    require(type(contract["issue"]) is int and contract["issue"] > 0, "invalid issue number")
    require(number is None or contract["issue"] == number, "contract filename/issue mismatch")
    require(isinstance(contract["body_sha256"], str) and
            re.fullmatch(r"[0-9a-f]{64}", contract["body_sha256"]), "invalid issue fingerprint")
    needed = contract["evidence_needed"]
    require(isinstance(needed, list) and needed and all(isinstance(v, str) for v in needed)
            and len(needed) == len(set(needed)), "invalid evidence_needed")
    require(set(needed) <= {v[0] for v in CATALOG.values()},
            "Browser/External account or unknown evidence requires manual closeout")
    requirements, contexts = contract["requirements"], contract["context_lines"]
    require(isinstance(requirements, list) and requirements, "requirements must be nonempty")
    require(isinstance(contexts, list) and all(type(n) is int and n > 0 for n in contexts), "invalid context lines")
    lines, classes = list(contexts), set()
    for requirement in requirements:
        require(isinstance(requirement, dict) and set(requirement) == {"line", "text", "evidence"}, "invalid requirement keys")
        require(type(requirement["line"]) is int and requirement["line"] > 0, "invalid requirement line")
        require(isinstance(requirement["text"], str) and requirement["text"].strip()
                and "\n" not in requirement["text"] and "\r" not in requirement["text"], "requirement text must be one exact line")
        evidence = requirement["evidence"]
        require(isinstance(evidence, list) and evidence and all(isinstance(e, str) and e in CATALOG for e in evidence)
                and len(set(evidence)) == len(evidence), "unsupported or duplicate evidence ID")
        lines.append(requirement["line"])
        classes.update(CATALOG[e][0] for e in evidence)
    require(len(lines) == len(set(lines)), "overlapping contract lines")
    require(set(needed) == classes, "declared evidence classes must equal mapped classes")
    if body is not None:
        require(digest(body) == contract["body_sha256"], "issue body/criteria changed after contract review")
        body_lines = body.splitlines()
        require(set(lines) == {i for i, line in enumerate(body_lines, 1) if line.strip()},
                "every nonblank issue line must be mapped as requirement or context")
        for requirement in requirements:
            require(body_lines[requirement["line"] - 1] == requirement["text"], "requirement text differs from issue")
        require(not any(TASK.match(body_lines[n - 1]) for n in contexts), "task criterion cannot be context")
        # Ambiguous task syntax is not silently treated as prose/context.
        for line in body_lines:
            require(not re.search(r"\[[ xX]\]", line) or TASK.match(line), "unsupported task-list syntax")
    return contract


def completed_body(body):
    return "".join(re.sub(r"^(\s*(?:[-*+] |[0-9]+[.)] )\[)[ xX](\])", r"\1x\2", line)
                   for line in body.splitlines(keepends=True))


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise Pending("API redirect rejected")


class API:
    """Fixed-origin HTTP API client; no commands or arbitrary contract URLs."""
    def __init__(self, github_token, project_token, netlify_token, site_id):
        require(all((github_token, project_token, netlify_token, site_id)),
                "GITHUB_TOKEN, CLOSEOUT_PROJECT_TOKEN, NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID are required")
        require(re.fullmatch(r"[A-Za-z0-9_-]+", site_id), "invalid Netlify site ID")
        self.tokens = {"repo": github_token, "project": project_token, "netlify": netlify_token}
        self.site_id = site_id
        self.opener = build_opener(NoRedirect)

    def request(self, method, path, body=None, credential="repo"):
        origin = "https://api.netlify.com" if credential == "netlify" else "https://api.github.com"
        require(path.startswith("/") and not path.startswith("//"), "unsafe API path")
        headers = {"Authorization": f"Bearer {self.tokens[credential]}", "Accept": "application/vnd.github+json",
                   "Content-Type": "application/json", "User-Agent": "portfolio-post-deploy-closeout",
                   "X-GitHub-Api-Version": "2026-03-10"}
        data = canonical(body).encode() if body is not None else None
        try:
            with self.opener.open(Request(origin + path, data=data, headers=headers, method=method), timeout=30) as response:
                raw = response.read(8_000_001)
                require(len(raw) <= 8_000_000, "API response exceeds bounded size")
                return strict_json(raw.decode()), dict(response.headers)
        except HTTPError as error:
            # Never include request bodies, credentials, or response dumps in logs.
            raise Pending(f"API {method} failed with HTTP {error.code}") from None
        except (URLError, TimeoutError) as error:
            raise Pending(f"API {method} transport unavailable ({type(error).__name__})") from None

    def get(self, path):
        return self.request("GET", f"/repos/{REPO}/{path}")[0]

    def pages(self, path, key=None):
        path = f"/repos/{REPO}/{path}"
        separator = "&" if "?" in path else "?"
        next_path, seen, result, total = path + separator + "per_page=100", set(), [], None
        for _ in range(1000):
            require(next_path not in seen, "REST pagination repeated")
            seen.add(next_path)
            data, headers = self.request("GET", next_path)
            nodes = data.get(key) if key else data
            require(isinstance(nodes, list), "REST page is incomplete")
            if key:
                count = data.get("total_count")
                require(type(count) is int and count >= 0 and (total is None or total == count), "REST total count changed")
                total = count
            result.extend(nodes)
            links = headers.get("Link", headers.get("link", ""))
            match = re.search(r'<([^>]+)>;\s*rel="next"', links)
            if not match:
                require(total is None or total == len(result), "REST pagination count mismatch")
                return result
            parsed = urlsplit(match[1])
            require(parsed.scheme == "https" and parsed.netloc == "api.github.com" and
                    parsed.path == path.split("?", 1)[0] and not parsed.fragment, "unsafe REST pagination link")
            next_path = parsed.path + "?" + parsed.query
        raise Pending("REST pagination exceeded bound")

    def graphql(self, query, variables, credential="project"):
        data = self.request("POST", "/graphql", {"query": query, "variables": variables}, credential)[0]
        require(not data.get("errors") and isinstance(data.get("data"), dict), "GraphQL access/schema failure")
        return data["data"]

    def content(self, path, sha):
        data = self.get(f"contents/{quote(path, safe='/')}?ref={sha}")
        require(data.get("type") == "file" and data.get("encoding") == "base64", "contract/source is not a file")
        raw = base64.b64decode(data["content"].replace("\n", ""), validate=True)
        require(len(raw) <= 1_000_000, "source file too large")
        return raw.decode("utf-8")

    def site(self):
        return self.request("GET", f"/api/v1/sites/{self.site_id}", credential="netlify")[0]

    def issue(self, number):
        data = self.graphql('query($n:Int!){repository(owner:"waffy1901",name:"personalWebsite"){issue(number:$n){id number url body title state stateReason locked viewerCanUpdate milestone{id title} updatedAt}}}', {"n": number}, "repo")
        issue = data["repository"]["issue"]
        require(isinstance(issue, dict) and issue["url"] == f"https://github.com/{REPO}/issues/{number}", "issue identity unavailable")
        require(issue.pop("viewerCanUpdate") is True and not issue["locked"], "issue write access unavailable or locked")
        # node must be narrowed to Issue before selecting connections.
        for field, selection, value in (("assignees", "id login", "login"), ("labels", "id name", "name")):
            nodes = self.issue_connection(issue["id"], field, selection, "repo")
            unique(nodes, "id", field)
            issue[field] = sorted(n[value] for n in nodes)
        issue.pop("updatedAt")  # Comment creation changes timestamps, not the preserved issue contract.
        return issue

    def issue_connection(self, node_id, field, selection, credential="project"):
        return self.typed_connection(node_id, "Issue", field, selection, credential)

    def typed_connection(self, node_id, typename, field, selection, credential="project"):
        extra = ",includeArchived:true" if typename == "Issue" and field == "projectItems" else ""
        query = f'query($id:ID!,$cursor:String){{node(id:$id){{... on {typename}{{{field}(first:100,after:$cursor{extra}){{nodes{{{selection}}} pageInfo{{hasNextPage endCursor}}}}}}}}}}'
        return self.graphql_connection(query, {"id": node_id}, lambda data: data["node"][field], credential)

    def project_value_connection(self, item_id, definition, typename, field, selection):
        # Computed Project field values have no node ID. Fetch by the uniquely named
        # definition and check its identity on every page.
        query = f'''query($id:ID!,$name:String!,$cursor:String) {{
          node(id:$id) {{ ... on ProjectV2Item {{
            fieldValueByName(name:$name) {{ __typename ... on {typename} {{
              field {{ ... on ProjectV2FieldCommon {{ id }} }}
              {field}(first:100,after:$cursor) {{ nodes {{ {selection} }} pageInfo {{ hasNextPage endCursor }} }}
            }} }}
          }} }}
        }}'''

        def get_connection(data):
            value = data["node"]["fieldValueByName"]
            require(isinstance(value, dict) and value.get("__typename") == typename
                    and value.get("field") == {"id": definition["id"]}, "nested Project field identity changed")
            return value[field]

        return self.graphql_connection(query, {"id": item_id, "name": definition["name"]}, get_connection)

    def graphql_connection(self, query, variables, get_connection, credential="project"):
        result, cursor, seen = [], None, set()
        for _ in range(1000):
            data = self.graphql(query, {**variables, "cursor": cursor}, credential)
            connection = get_connection(data)
            require(isinstance(connection.get("nodes"), list) and all(isinstance(n, dict) for n in connection["nodes"]), "inaccessible connection")
            result.extend(connection["nodes"])
            page = connection["pageInfo"]
            require(type(page.get("hasNextPage")) is bool, "GraphQL pagination incomplete")
            if not page["hasNextPage"]:
                return result
            cursor = page.get("endCursor")
            require(isinstance(cursor, str) and cursor and cursor not in seen, "GraphQL pagination repeated or missing")
            seen.add(cursor)
        raise Pending("GraphQL pagination exceeded bound")

    def comments(self, number):
        comments = self.pages(f"issues/{number}/comments")
        return unique([self.comment_snapshot(c) for c in comments], "id", "comments")

    @staticmethod
    def comment_snapshot(comment):
        # REST's list and individual endpoints can return different author avatars.
        fields = ("id", "node_id", "body", "created_at", "updated_at", "issue_url", "html_url")
        return {**{field: comment[field] for field in fields},
                "user": {"id": (comment.get("user") or {}).get("id")}}

    def comment(self, comment_id):
        comment = self.get(f"issues/comments/{comment_id}")
        node_id = comment.get("node_id")
        require(comment.get("id") == comment_id and isinstance(node_id, str) and node_id,
                "closeout comment identity unavailable")
        # An edit can replace both the rendered evidence and the saved baseline.
        # GitHub's edit record detects this even if the body was later restored.
        result = self.graphql(
            "query($id:ID!){node(id:$id){... on IssueComment{id body lastEditedAt}}}",
            {"id": node_id}, "repo",
        )["node"]
        require(isinstance(result, dict) and result.get("id") == node_id
                and isinstance(comment.get("body"), str) and result.get("body") == comment["body"]
                and "lastEditedAt" in result and result["lastEditedAt"] is None,
                "closeout comment was edited or could not be independently verified")
        return self.comment_snapshot(comment)

    def post_comment(self, number, body):
        return self.request("POST", f"/repos/{REPO}/issues/{number}/comments", {"body": body})[0]

    def close_issue(self, number, body):
        self.request("PATCH", f"/repos/{REPO}/issues/{number}", {"body": body, "state": "closed", "state_reason": "completed"})

    def closed_by_bot(self, number, after):
        events = unique(self.pages(f"issues/{number}/events"), "id", "issue events")
        lifecycle = [e for e in events if e.get("event") in ("closed", "reopened")]
        if not lifecycle:
            return False
        event = max(lifecycle, key=lambda e: (instant(e["created_at"]), e["id"]))
        return event["event"] == "closed" and event.get("actor", {}).get("id") == BOT_ID and instant(event["created_at"]) >= instant(after)

    def set_done(self, project):
        self.graphql('mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){projectV2Item{id}}}',
                     {"p": project["id"], "i": project["item_id"], "f": project["status_field"], "o": project["done_option"]})

    def project(self, issue):
        data = self.graphql('query{user(login:"waffy1901"){projectV2(number:2){id url public viewerCanUpdate}}}', {})
        project = data["user"]["projectV2"]
        require(project and project["url"] == PROJECT_URL and project["viewerCanUpdate"] is True, "Project 2 write access unavailable")
        require(project.get("public") is True, "private Project is outside automated closeout")
        pid = project["id"]
        common = "id name dataType"
        definitions = self.typed_connection(pid, "ProjectV2", "fields", f'''__typename
          ... on ProjectV2Field {{{common}}}
          ... on ProjectV2SingleSelectField {{{common} options{{id name}}}}
          ... on ProjectV2MultiSelectField {{{common} multiSelectOptions{{id name}}}}
          ... on ProjectV2IterationField {{{common} configuration{{iterations{{id title startDate duration}} completedIterations{{id title startDate duration}}}}}}''')
        unique(definitions, "id", "project field IDs")
        unique(definitions, "name", "project field names")
        by_id = {field["id"]: field for field in definitions}
        supported = {"TITLE", "ASSIGNEES", "LABELS", "LINKED_PULL_REQUESTS", "MILESTONE", "REPOSITORY", "REVIEWERS",
                     "PARENT_ISSUE", "SUB_ISSUES_PROGRESS", "CREATED", "UPDATED", "CLOSED", "DATE", "TEXT", "NUMBER", "SINGLE_SELECT", "MULTI_SELECT", "ITERATION"}
        for field in definitions:
            require(field["dataType"] in supported, "unsupported Project field type: " + field["dataType"])
            for option_key in ("options", "multiSelectOptions"):
                if option_key in field:
                    unique(field[option_key], "id", "project option IDs")
                    unique(field[option_key], "name", "project option names")
        memberships = self.issue_connection(issue["id"], "projectItems", "id isArchived project{id url public} content{... on Issue{id url}}")
        unique(memberships, "id", "project memberships")
        require(all(m.get("project", {}).get("public") is True for m in memberships),
                "private/inaccessible Project membership is outside automated closeout")
        matches = [m for m in memberships if m["project"]["id"] == pid]
        require(len(matches) == 1, "expected exactly one existing Project 2 item")
        item = matches[0]
        require(not item["isArchived"] and item["content"] == {"id": issue["id"], "url": issue["url"]}, "Project item identity/archival mismatch")
        # Nested connections are fetched separately below so no inner 100-item truncation is hidden.
        field_ref = "field{... on ProjectV2FieldCommon{id}}"
        specs = {
            "Text": "text", "Date": "date", "Number": "number",
            "SingleSelect": "optionId name", "MultiSelect": "options{id name}",
            "Iteration": "iterationId title startDate duration", "Milestone": "milestone{id title}",
            "Repository": "repository{id nameWithOwner}",
            "Label": "", "User": "", "PullRequest": "", "Reviewer": "",
        }
        selection = "__typename " + " ".join(f"... on ProjectV2ItemField{kind}Value{{{field_ref} {fields}}}" for kind, fields in specs.items())
        values = self.typed_connection(item["id"], "ProjectV2Item", "fieldValues", selection)
        fields = {f["name"]: None for f in definitions}
        seen = set()
        nested = {
            "Label": ("labels", "id name"), "User": ("users", "id login"),
            "PullRequest": ("pullRequests", "id url state"),
            "Reviewer": ("reviewers", "__typename ... on Node{id}"),
        }
        for value in values:
            kind = value["__typename"].removeprefix("ProjectV2ItemField").removesuffix("Value")
            require(kind in specs, "unsupported populated Project field value type: " + value["__typename"])
            fid = value["field"]["id"]
            require(fid in by_id and fid not in seen, "unknown/duplicate Project field value")
            seen.add(fid)
            definition = by_id[fid]
            if kind in nested:
                connection, selection = nested[kind]
                nodes = self.project_value_connection(item["id"], definition, value["__typename"], connection, selection)
                unique(nodes, "id", "nested Project values")
                value[connection] = sorted(nodes, key=lambda n: n["id"])
            normalized = {k: v for k, v in value.items() if k not in ("field", "__typename")}
            if kind == "MultiSelect":
                require(isinstance(value["options"], list), "missing multi-select values")
                unique(value["options"], "id", "selected options")
                options = {o["id"]: o["name"] for o in definition["multiSelectOptions"]}
                require(all(options.get(o["id"]) == o["name"] for o in value["options"]), "multi-select option mismatch")
                normalized["options"] = sorted(value["options"], key=lambda o: o["id"])
            if kind == "SingleSelect":
                require({o["id"]: o["name"] for o in definition["options"]}.get(value["optionId"]) == value["name"], "single-select option mismatch")
            # Created is immutable. Updated and Closed are lifecycle values, not editable custom fields.
            if definition["name"] in ("Updated", "Closed") and definition["dataType"] in ("UPDATED", "CLOSED"):
                normalized = {"derived_lifecycle": True}
            fields[definition["name"]] = normalized
        for name in ("Updated", "Closed"):
            if any(f["name"] == name and f["dataType"] in ("UPDATED", "CLOSED") for f in definitions):
                fields[name] = {"derived_lifecycle": True}
        by_name = {f["name"]: f for f in definitions}
        for name in ("Status", "Priority", "Severity", "Area", "Evidence needed"):
            require(name in by_name and fields[name] is not None, f"required Project field missing: {name}")
        status = by_name["Status"]
        require(status["dataType"] == "SINGLE_SELECT", "Status is not single select")
        done = [o for o in status["options"] if o["name"] == "Done"]
        require(len(done) == 1, "Project Done option missing/ambiguous")
        require(by_name["Evidence needed"]["dataType"] == "MULTI_SELECT", "Evidence needed must be multi-select")
        return {"id": pid, "url": PROJECT_URL, "public": True, "item_id": item["id"],
                "memberships": sorted(memberships, key=lambda m: m["id"]),
                "definitions": sorted(definitions, key=lambda f: f["id"]), "fields": fields,
                "status_field": status["id"], "done_option": done[0]["id"]}


def trusted_run(api, event, now):
    require(event.get("action") == "completed" and event.get("repository", {}).get("full_name") == REPO,
            "not the repository's completed workflow_run event")
    original = event["workflow_run"]
    run_id, attempt = original.get("id"), original.get("run_attempt")
    require(type(run_id) is int and run_id > 0 and type(attempt) is int and attempt > 0, "invalid run/attempt")
    run = api.get(f"actions/runs/{run_id}")
    keys = ("id", "run_attempt", "head_sha", "head_branch", "event", "path", "workflow_id", "name", "status", "conclusion", "html_url")
    require(all(run.get(k) == original.get(k) for k in keys), "upstream run/event identity changed")
    require(run.get("repository", {}).get("full_name") == REPO and
            run.get("head_repository", {}).get("full_name") == REPO and
            run.get("path") == UPSTREAM and run.get("name") == "Create deployment release" and
            run.get("event") == "push" and run.get("head_branch") == "main" and
            run.get("status") == "completed" and run.get("conclusion") == "success" and
            isinstance(run.get("head_sha"), str) and SHA.fullmatch(run["head_sha"]) and
            run.get("html_url") == f"https://github.com/{REPO}/actions/runs/{run_id}", "untrusted upstream run")
    age = now - instant(run["updated_at"])
    require(timedelta(0) <= age <= timedelta(hours=24), "upstream completion is stale or in the future")
    exact = api.get(f"actions/runs/{run_id}/attempts/{attempt}")
    require(all(exact.get(k) == run.get(k) for k in keys), "exact attempt differs from current run")
    require(digest(api.content(UPSTREAM, run["head_sha"])) == UPSTREAM_HASH, "upstream workflow changed; review evidence catalog before closing")
    jobs = unique(api.pages(f"actions/runs/{run_id}/attempts/{attempt}/jobs", "jobs"), "id", "job IDs")
    steps = {}
    for name, required in REQUIRED_STEPS.items():
        matching = [j for j in jobs if j.get("name") == name]
        require(len(matching) == 1, f"missing/ambiguous upstream job: {name}")
        job = matching[0]
        require(job.get("run_id") == run_id and job.get("head_sha") == run["head_sha"] and
                job.get("status") == "completed" and job.get("conclusion") == "success", f"upstream job did not succeed: {name}")
        require(instant(job["started_at"]) >= instant(exact["run_started_at"]), "job belongs to an older attempt")
        for label in required:
            matches = [s for s in job["steps"] if s.get("name") == label]
            require(len(matches) == 1 and matches[0].get("status") == "completed" and
                    matches[0].get("conclusion") == "success", f"required step missing/skipped/failed: {label}")
            step = matches[0]
            require(instant(job["started_at"]) <= instant(step["started_at"]) <= instant(step["completed_at"]) <= instant(job["completed_at"]), "step timestamps contradict job")
            steps[(name, label)] = {**step, "job_id": job["id"]}
    return run, steps


def deployment(api, run, steps):
    releases = unique(api.pages("releases"), "id", "release IDs")
    step = steps[("Create release", "Create GitHub release")]
    matches = [r for r in releases if re.fullmatch(r"deploy-[0-9]{8}T[0-9]{6}Z-" + run["head_sha"][:7], r.get("tag_name", ""))
               and r.get("draft") is False and r.get("prerelease") is False
               and instant(step["started_at"]) <= instant(r["published_at"]) <= instant(step["completed_at"])]
    require(len(matches) == 1, "missing/ambiguous deployment release for this attempt")
    release = matches[0]
    tag = release["tag_name"]
    require(release["html_url"] == f"https://github.com/{REPO}/releases/tag/{tag}", "release URL mismatch")
    body = release["body"].splitlines()
    require(f"Automated release for deployment commit {run['head_sha']}." in body and
            "- Branch: main" in body and "- Site: https://waffy.dev" in body and
            f"- Workflow run: {run['html_url']}" in body, "release does not identify exact upstream run and commit")
    def line_value(prefix):
        matches = [line[len(prefix):] for line in body if line.startswith(prefix)]
        require(len(matches) == 1, "release deployment identity missing/ambiguous")
        return matches[0]
    deploy_id, deploy_url = line_value("- Netlify deploy ID: "), line_value("- Netlify deploy: ")
    obj = api.get(f"git/ref/tags/{quote(tag, safe='')}")["object"]
    seen = set()
    for _ in range(10):
        require(isinstance(obj.get("sha"), str) and SHA.fullmatch(obj["sha"]), "malformed tag target")
        if obj["type"] == "commit":
            break
        require(obj["type"] == "tag" and obj["sha"] not in seen, "unsupported/cyclic tag")
        seen.add(obj["sha"])
        obj = api.get(f"git/tags/{obj['sha']}")["object"]
    else:
        raise Pending("tag peeling exceeded bound")
    require(obj["sha"] == run["head_sha"], "tag does not resolve to upstream SHA")
    result = {"id": deploy_id, "url": deploy_url, "release_url": release["html_url"], "tag": tag,
              "sha": obj["sha"], "site_id": api.site_id, "published_at": release["published_at"]}
    check_pointer(api, result)
    return result


def check_pointer(api, deploy):
    site = api.site()
    require(site.get("custom_domain") == "waffy.dev", "site custom domain mismatch")
    _deployment_evidence.published({"captured_at": datetime.now(timezone.utc).isoformat(), "site": site}, deploy["site_id"])
    result = classify_site(site, deploy["sha"], deploy["site_id"], deploy["id"])
    require(result["decision"] == "published" and result["deploy_url"] == deploy["url"], "exact deployment is no longer published")


def selected_contract(api, run):
    pulls = unique(api.pages(f"commits/{run['head_sha']}/pulls"), "number", "associated PRs")
    candidates = []
    for item in pulls:
        pr = api.get(f"pulls/{item['number']}")
        if pr.get("merged") is True and pr.get("merge_commit_sha") == run["head_sha"] and pr.get("base", {}).get("ref") == "main":
            require(pr.get("base", {}).get("repo", {}).get("full_name") == REPO and
                    pr.get("head", {}).get("repo", {}).get("full_name") == REPO, "foreign PR not eligible")
            candidates.append(pr)
    require(len(candidates) == 1, "no single exact merged PR for upstream SHA")
    pr = candidates[0]
    require(instant(pr["merged_at"]) <= instant(run["run_started_at"]), "PR merge postdates upstream run")
    files = unique(api.pages(f"pulls/{pr['number']}/files"), "filename", "PR files")
    require(type(pr.get("changed_files")) is int and len(files) == pr["changed_files"], "PR file pagination incomplete (including API file cap)")
    contracts = [f for f in files if f["filename"].startswith(".github/closeout/")]
    require(len(contracts) == 1, "missing/ambiguous changed issue contract; no retrospective sweep")
    file = contracts[0]
    match = re.fullmatch(r"\.github/closeout/issue-([1-9][0-9]*)\.json", file["filename"])
    require(match and file["status"] in ("added", "modified"), "contract must be one added/modified issue-N.json")
    contract = validate_contract(strict_json(api.content(file["filename"], run["head_sha"])), number=int(match[1]))
    require(pr.get("html_url") == f"https://github.com/{REPO}/pull/{pr['number']}", "PR URL mismatch")
    return pr, contract


def evidence_map(contract, run, steps, pr):
    result = {}
    for evidence in sorted({e for r in contract["requirements"] for e in r["evidence"]}):
        kind, job, step = CATALOG[evidence]
        if job is None:
            result[evidence] = {"class": kind, "url": pr["html_url"], "result": "Merged source change; criterion mapping reviewed in PR"}
        else:
            data = steps[(job, step)]
            result[evidence] = {"class": kind, "url": f"{run['html_url']}/job/{data['job_id']}",
                                "result": step + ": success", "completed_at": data["completed_at"]}
    return result


def done_project(project):
    result = copy.deepcopy(project)
    result["fields"]["Status"] = {"optionId": project["done_option"], "name": "Done"}
    return result


def final_issue(issue):
    return {**issue, "body": completed_body(issue["body"]), "state": "CLOSED", "stateReason": "COMPLETED"}


def make_comment(marker, payload):
    # Persist fingerprints for retries while keeping the full Project snapshot in memory.
    encoded = base64.b64encode(canonical(payload).encode()).decode()
    rows = []
    for requirement in payload["contract"]["requirements"]:
        text = requirement["text"].replace("|", "\\|")
        delimiter = "`" * (1 + max(map(len, re.findall(r"`+", text)), default=0))
        evidence = "; ".join(f"`{e}`: {payload['evidence'][e]['result']} ([evidence]({payload['evidence'][e]['url']}))" for e in requirement["evidence"])
        rows.append(f"| Line {requirement['line']} {delimiter} {text} {delimiter} | {evidence} |")
    deploy, run = payload["deployment"], payload["run"]
    body = f'''{marker}
Closeout evidence - {run['updated_at']}

Implementation: {payload['pr_url']}, merge commit `{run['head_sha']}`.
Upstream: {run['html_url']}/attempts/{run['run_attempt']} (exact completed attempt).
Deployment: [{deploy['tag']}]({deploy['release_url']}), resolved tag `{deploy['sha']}`,
Netlify site `{deploy['site_id']}`, deployment `{deploy['id']}`.
Immutable target: {deploy['url']}; production target: https://waffy.dev.
Published pointer rechecked immediately before closeout writes.

| Required criterion | Verified evidence |
| --- | --- |
{chr(10).join(rows)}

Evidence classes: {', '.join(payload['contract']['evidence_needed'])}.
All required upstream lint/test/build and release HTTP/CSP steps succeeded; the release
was published within this attempt's release step. HTTP evidence is dated to that run.
Browser and External account criteria are unsupported by this automation and are not
required by this issue's reviewed map and Project Evidence needed. Advisory browser
smoke does not establish arbitrary UI behavior, Safari/iOS, analytics receipt, or real
form delivery. No application JavaScript, browser, or contact form was exercised here.
Source mapping is a human-reviewed interpretation of the merged diff, not a semantic
proof from green CI. Residual required evidence gaps: none in the reviewed contract.

This comment records intended closure. Completion is established only by the closeout
workflow's independent readback; a partial API failure can leave this issue open.
<!-- closeout-baseline:{encoded} -->'''
    require(len(body) <= 60000, "durable closeout comment exceeds safe size")
    return body


def execute(api, event, now=None, report=None):
    now = now or datetime.now(timezone.utc)
    report = report if report is not None else {}
    report.update(status="pending", writes_attempted=[])
    run, steps = trusted_run(api, event, now)
    pr, contract = selected_contract(api, run)
    number = contract["issue"]
    report.update(issue=f"https://github.com/{REPO}/issues/{number}", upstream=run["html_url"], attempt=run["run_attempt"])
    deploy = deployment(api, run, steps)
    current_issue = api.issue(number)
    require(current_issue["number"] == number, "issue number changed")
    current_project = api.project(current_issue)
    comments = api.comments(number)
    marker = f"<!-- portfolio-auto-closeout:v1:{number}:{run['head_sha']}:{run['id']}:{run['run_attempt']} -->"
    marked = [c for c in comments if "<!-- portfolio-auto-closeout:" in c.get("body", "")]
    matching = [c for c in marked if c["body"].startswith(marker + "\n")]
    require(len(matching) <= 1, "duplicate own closeout comments")
    require(len(marked) == len(matching), "different closeout marker exists; manual reconciliation required")
    comment = matching[0] if matching else None
    evidence = evidence_map(contract, run, steps, pr)
    identity = {k: run[k] for k in ("id", "run_attempt", "head_sha", "html_url", "updated_at")}
    payload = {"contract": contract, "run": identity, "deployment": deploy, "evidence": evidence,
               "pr_url": pr["html_url"]}
    if comment:
        require(comment.get("user", {}).get("id") == BOT_ID, "closeout marker was not written by github-actions[bot]")
        encoded = re.findall(r"<!-- closeout-baseline:([A-Za-z0-9+/=]+) -->", comment["body"])
        require(len(encoded) == 1, "own baseline missing/ambiguous")
        saved = strict_json(base64.b64decode(encoded[0], validate=True).decode())
        require(isinstance(saved, dict), "invalid saved baseline")
        expected = saved.pop("expected", None)
        require(saved == payload, "saved baseline belongs to different evidence")
        require(isinstance(expected, dict) and set(expected) == {"issue_open", "issue_closed", "project_before", "project_done"}
                and all(isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) for value in expected.values()),
                "invalid saved snapshot fingerprints")
    else:
        require(current_issue["state"] == "OPEN", "issue already closed; never reclose manually closed work")
        validate_contract(contract, current_issue["body"], number)
        needed = current_project["fields"]["Evidence needed"]
        require(isinstance(needed, dict) and set(needed) == {"options"} and
                sorted(o["name"] for o in needed["options"]) == sorted(contract["evidence_needed"]),
                "Project Evidence needed differs from the contract")
        expected = {"issue_open": fingerprint(current_issue), "issue_closed": fingerprint(final_issue(current_issue)),
                    "project_before": fingerprint(current_project), "project_done": fingerprint(done_project(current_project))}
    text = make_comment(marker, {**payload, "expected": expected})
    if comment:
        require(comment["body"] == text, "own comment differs from saved intended evidence")

    def snapshot_check(allow_closed):
        # Each write is preceded by fresh provenance, issue, comments and project reads.
        latest = api.get(f"actions/runs/{run['id']}")
        require(all(latest.get(k) == run.get(k) for k in ("id", "head_sha", "run_attempt", "status", "conclusion")), "upstream attempt changed before write")
        observed_issue = api.issue(number)
        observed_project = api.project(observed_issue)
        observed_comments = api.comments(number)
        if comment:
            require(observed_comments == comments, "issue comments changed during closeout")
            exact_comment = api.comment(comment["id"])
            require(exact_comment.get("body") == text and exact_comment.get("user", {}).get("id") == BOT_ID,
                    "independent comment readback mismatch")
        else:
            require(observed_comments == comments, "issue comments changed before evidence write")
        issue_hash = fingerprint(observed_issue)
        issue_closed = allow_closed and issue_hash == expected["issue_closed"]
        require(issue_hash == expected["issue_open"] or issue_closed, "issue body/metadata/state changed during closeout")
        project_hash = fingerprint(observed_project)
        project_done = project_hash == expected["project_done"]
        require(project_hash == expected["project_before"] or (issue_closed and project_done),
                "Project membership/schema/metadata changed during closeout")
        if issue_closed:
            require(comment and api.closed_by_bot(number, comment["created_at"]), "issue was closed by someone else; no further writes")
        # Read the production pointer last, directly before a possible mutation.
        check_pointer(api, deploy)
        return observed_issue, observed_project, project_done

    snapshot_check(bool(comment))
    if not comment:
        report["writes_attempted"].append("evidence comment")
        created = api.post_comment(number, text)
        comment = api.comment(created["id"])
        require(comment.get("body") == text and comment.get("user", {}).get("id") == BOT_ID, "evidence comment readback mismatch; closure stopped")
        fresh_comments = api.comments(number)
        require(fresh_comments == comments + [comment], "comments changed after evidence write")
        comments = fresh_comments
    observed_issue, _, _ = snapshot_check(True)
    if observed_issue["state"] == "OPEN":
        report["writes_attempted"].append("issue body and completed closure")
        api.close_issue(number, completed_body(observed_issue["body"]))
    observed_issue, observed_project, project_done = snapshot_check(True)
    require(observed_issue["state"] == "CLOSED", "issue closure readback mismatch")
    if not project_done:
        report["writes_attempted"].append("Project 2 Status Done")
        api.set_done(observed_project)
    observed_issue, observed_project, project_done = snapshot_check(True)
    require(observed_issue["state"] == "CLOSED" and project_done, "final independent issue/Project readback mismatch")
    report.update(status="verified", comment=comment["html_url"], deployment=deploy,
                  preserved_fields=sorted(observed_project["fields"]), requirements=len(contract["requirements"]),
                  note="Closed COMPLETED; existing Project 2 item Done; exact comment/body/metadata and all supported fields independently verified.")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--event", type=Path)
    parser.add_argument("--report", type=Path, default=Path("closeout-report.json"))
    parser.add_argument("--validate-contracts", type=Path)
    args = parser.parse_args()
    if args.validate_contracts:
        try:
            files = sorted(args.validate_contracts.glob("issue-*.json"))
            for file in files:
                match = re.fullmatch(r"issue-([1-9][0-9]*)\.json", file.name)
                require(match, "invalid contract filename")
                validate_contract(strict_json(file.read_text()), number=int(match[1]))
            print(f"Validated {len(files)} closeout contract(s); no provider reads or writes.")
            return 0
        except (Pending, ValueError, KeyError, TypeError, OSError) as error:
            print(f"Invalid contract: {error}")
            return 1
    report = {"status": "pending", "writes_attempted": []}
    try:
        require(os.environ.get("GITHUB_EVENT_NAME") == "workflow_run" and os.environ.get("GITHUB_REPOSITORY") == REPO,
                "mutation mode is only the trusted repository workflow_run path")
        require(args.event is not None, "event file required")
        event = strict_json(args.event.read_text())
        api = API(os.environ.get("GITHUB_TOKEN"), os.environ.get("CLOSEOUT_PROJECT_TOKEN"),
                  os.environ.get("NETLIFY_AUTH_TOKEN"), os.environ.get("NETLIFY_SITE_ID"))
        execute(api, event, report=report)
    except (Pending, ValueError, KeyError, TypeError, AttributeError, OSError) as error:
        report["status"] = "partial" if report["writes_attempted"] else "pending"
        report["reason"] = str(error) if isinstance(error, Pending) else f"Malformed or unavailable evidence ({type(error).__name__}); no further writes"
    args.report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    summary = "Post-deploy closeout: " + report["status"] + ". " + report.get("reason", report.get("note", ""))
    print(summary)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as stream:
            stream.write(summary + "\n")
    return 1 if report["status"] == "partial" else 0


if __name__ == "__main__":
    raise SystemExit(main())
