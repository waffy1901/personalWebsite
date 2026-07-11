#!/usr/bin/env python3
import argparse
import shlex
import subprocess
import sys
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit


CURL_MARKER = "__PORTFOLIO_ROUTE_CHECK__"
UNKNOWN_ROUTE = "/__portfolio-route-smoke-missing__"


@dataclass(frozen=True)
class RedirectRule:
    source: str
    destination: str
    status: int


@dataclass(frozen=True)
class CurlResponse:
    status: int
    effective_url: str
    redirect_url: str
    body: str


class MetadataParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.canonicals = []
        self.og_urls = []
        self.robots = []
        self.title_parts = []
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "link" and attributes.get("rel") == "canonical":
            self.canonicals.append(attributes.get("href", ""))
        elif tag == "meta" and attributes.get("property") == "og:url":
            self.og_urls.append(attributes.get("content", ""))
        elif tag == "meta" and attributes.get("name") == "robots":
            self.robots.append(attributes.get("content", ""))
        elif tag == "title":
            self.in_title = True

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title_parts.append(data)

    @property
    def title(self):
        return "".join(self.title_parts).strip()


def load_redirect_rules(repo_root):
    redirects_path = repo_root / "main" / "public" / "_redirects"
    canonical_routes = []
    local_redirects = []

    for line_number, raw_line in enumerate(
        redirects_path.read_text(encoding="utf-8").splitlines(), start=1
    ):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        parts = shlex.split(line)
        if len(parts) < 3:
            raise ValueError(
                f"{redirects_path}:{line_number} must include source, destination, and status."
            )

        source, destination, raw_status = parts[:3]
        try:
            status = int(raw_status.rstrip("!"))
        except ValueError as error:
            raise ValueError(
                f"{redirects_path}:{line_number} has invalid status {raw_status!r}."
            ) from error

        if (
            status == 200
            and source.startswith("/")
            and "*" not in source
            and destination == f"{source}/index.html"
        ):
            canonical_routes.append(source)
        elif (
            status == 301
            and source.startswith("/")
            and destination.startswith("/")
            and "*" not in source
        ):
            local_redirects.append(RedirectRule(source, destination, status))

    if not canonical_routes:
        raise ValueError(f"{redirects_path} does not define canonical route rewrites.")

    return sorted(set(canonical_routes)), local_redirects


def normalize_site_url(raw_url):
    parsed = urlsplit(raw_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("--site-url must be an absolute HTTP or HTTPS URL.")
    if parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
        raise ValueError("--site-url must contain only the site origin.")
    return f"{parsed.scheme}://{parsed.netloc}"


def site_url(origin, path):
    return f"{origin}{path}"


def fetch(url, timeout, retries, retry_delay, *, follow=False, head=False):
    command = [
        "curl",
        "--silent",
        "--show-error",
        "--path-as-is",
        "--retry",
        str(retries),
        "--retry-delay",
        str(retry_delay),
        "--connect-timeout",
        "10",
        "--max-time",
        str(timeout),
        "--max-redirs",
        "10",
    ]
    if follow:
        command.append("--location")
    if head:
        command.append("--head")

    command.extend(
        [
            "--write-out",
            f"\n{CURL_MARKER}%{{http_code}}\t%{{url_effective}}\t%{{redirect_url}}",
            url,
        ]
    )
    result = subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        raise RuntimeError(f"Could not fetch {url}: {result.stderr.strip()}")

    marker = f"\n{CURL_MARKER}"
    if marker not in result.stdout:
        raise RuntimeError(f"Could not parse curl response for {url}.")

    body, metadata = result.stdout.rsplit(marker, 1)
    fields = metadata.split("\t")
    if len(fields) != 3:
        raise RuntimeError(f"Could not parse curl metadata for {url}.")

    raw_status, effective_url, redirect_url = fields
    return CurlResponse(int(raw_status), effective_url, redirect_url, body)


def parse_metadata(html):
    parser = MetadataParser()
    parser.feed(html)
    return parser


def check_shell(
    origin,
    request_path,
    canonical_path,
    args,
    failures,
    *,
    expected_effective_path=None,
):
    request_url = site_url(origin, request_path)
    expected_canonical = site_url(origin, canonical_path)
    expected_effective = site_url(
        origin, expected_effective_path or request_path
    )

    try:
        response = fetch(
            request_url,
            args.timeout,
            args.retries,
            args.retry_delay,
            follow=True,
        )
    except RuntimeError as error:
        failures.append(str(error))
        return

    if response.status != 200:
        failures.append(f"Expected HTTP 200 from {request_url}, got {response.status}.")
        return
    if response.effective_url != expected_effective:
        failures.append(
            f"{request_url} final URL mismatch: expected {expected_effective!r}, "
            f"got {response.effective_url!r}."
        )

    metadata = parse_metadata(response.body)
    if metadata.canonicals != [expected_canonical]:
        failures.append(
            f"{request_url} canonical mismatch: expected {expected_canonical!r}, "
            f"got {metadata.canonicals or '<missing>'!r}."
        )
    if metadata.og_urls != [expected_canonical]:
        failures.append(
            f"{request_url} og:url mismatch: expected {expected_canonical!r}, "
            f"got {metadata.og_urls or '<missing>'!r}."
        )
    if not metadata.title:
        failures.append(f"{request_url} is missing an initial HTML title.")
    if any("noindex" in value.lower() for value in metadata.robots):
        failures.append(f"{request_url} unexpectedly has a noindex robots directive.")


def check_canonical_route(origin, route, args, failures):
    slashless_url = site_url(origin, route)
    trailing_path = f"{route}/"
    expected_redirect = site_url(origin, trailing_path)

    try:
        response = fetch(
            slashless_url,
            args.timeout,
            args.retries,
            args.retry_delay,
            head=True,
        )
    except RuntimeError as error:
        failures.append(str(error))
        return

    if response.status != 301:
        failures.append(f"Expected HTTP 301 from {slashless_url}, got {response.status}.")
    if response.redirect_url != expected_redirect:
        failures.append(
            f"{slashless_url} redirect mismatch: expected {expected_redirect!r}, "
            f"got {response.redirect_url or '<missing>'!r}."
        )

    check_shell(origin, trailing_path, route, args, failures)


def check_legacy_redirect(origin, rule, canonical_routes, args, failures):
    source_url = site_url(origin, rule.source)
    expected_redirect = site_url(origin, rule.destination)
    served_route = f"{rule.destination}/"
    accepted_redirects = {expected_redirect, site_url(origin, served_route)}

    try:
        response = fetch(
            source_url,
            args.timeout,
            args.retries,
            args.retry_delay,
            head=True,
        )
    except RuntimeError as error:
        failures.append(str(error))
        return

    if response.status != rule.status:
        failures.append(
            f"Expected HTTP {rule.status} from {source_url}, got {response.status}."
        )
    if response.redirect_url not in accepted_redirects:
        failures.append(
            f"{source_url} redirect mismatch: expected one of "
            f"{sorted(accepted_redirects)!r}, "
            f"got {response.redirect_url or '<missing>'!r}."
        )

    if rule.destination in canonical_routes:
        check_shell(
            origin,
            rule.source,
            rule.destination,
            args,
            failures,
            expected_effective_path=served_route,
        )


def check_unknown_route(origin, args, failures):
    unknown_url = site_url(origin, UNKNOWN_ROUTE)

    try:
        response = fetch(
            unknown_url,
            args.timeout,
            args.retries,
            args.retry_delay,
        )
    except RuntimeError as error:
        failures.append(str(error))
        return

    if response.status != 404:
        failures.append(f"Expected HTTP 404 from {unknown_url}, got {response.status}.")
        return

    metadata = parse_metadata(response.body)
    robots = ",".join(metadata.robots).lower()
    if "noindex" not in robots or "nofollow" not in robots:
        failures.append(
            f"{unknown_url} must include noindex and nofollow robots directives."
        )
    if "page not found" not in metadata.title.lower():
        failures.append(
            f"{unknown_url} must serve the dedicated 404 shell; got title {metadata.title!r}."
        )


def main():
    parser = argparse.ArgumentParser(
        description="Validate deployed portfolio routes against main/public/_redirects."
    )
    parser.add_argument(
        "--repo",
        default=".",
        help="Repository root containing main/public/_redirects.",
    )
    parser.add_argument(
        "--site-url",
        default="https://waffy.dev",
        help="Deployed site origin to check.",
    )
    parser.add_argument("--timeout", type=int, default=30)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--retry-delay", type=int, default=5)
    args = parser.parse_args()

    repo_root = Path(args.repo).resolve()
    try:
        origin = normalize_site_url(args.site_url)
        canonical_routes, local_redirects = load_redirect_rules(repo_root)
    except (OSError, ValueError) as error:
        print(error, file=sys.stderr)
        return 1

    failures = []
    check_shell(origin, "/", "/", args, failures)

    for route in canonical_routes:
        check_canonical_route(origin, route, args, failures)

    canonical_route_set = set(canonical_routes)
    app_redirects = [
        rule for rule in local_redirects if rule.destination in canonical_route_set
    ]
    for rule in app_redirects:
        check_legacy_redirect(
            origin, rule, canonical_route_set, args, failures
        )

    check_unknown_route(origin, args, failures)

    if failures:
        print("Deployed route validation failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    print(
        "Deployed routes are healthy: "
        f"home, {len(canonical_routes)} canonical routes, "
        f"{len(app_redirects)} legacy app redirects, and the unknown-route 404."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
