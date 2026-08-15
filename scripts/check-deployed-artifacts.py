#!/usr/bin/env python3
import argparse
import hashlib
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit


CURL_MARKER = "__PORTFOLIO_ARTIFACT_CHECK__"


@dataclass(frozen=True)
class Artifact:
    path: str
    content_type: str


@dataclass(frozen=True)
class HttpResponse:
    status: int
    effective_url: str
    redirect_url: str
    content_type: str
    body: bytes


ARTIFACTS = (
    Artifact("portfolio.json", "application/json"),
    Artifact("ai-summary.txt", "text/plain"),
    Artifact("llms.txt", "text/plain"),
    Artifact("sitemap.xml", "application/xml"),
    Artifact("robots.txt", "text/plain"),
    Artifact("manifest.json", "application/json"),
    Artifact("waffyAhmedResume.pdf", "application/pdf"),
    Artifact("resume-preview.png", "image/png"),
    Artifact("og-image-v2.png", "image/png"),
)


def normalize_site_url(raw_url):
    parsed = urlsplit(raw_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("--site-url must be an absolute HTTP or HTTPS URL.")
    if parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
        raise ValueError("--site-url must contain only the site origin.")
    return f"{parsed.scheme}://{parsed.netloc}"


def fetch(url, timeout, retries, retry_delay):
    result = subprocess.run(
        [
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
            "0",
            "--header",
            "Accept-Encoding: identity",
            "--user-agent",
            "waffy.dev-production-artifact-check/1.0",
            "--write-out",
            (
                f"\n{CURL_MARKER}%{{http_code}}\t%{{url_effective}}\t"
                "%{redirect_url}\t%{content_type}"
            ),
            url,
        ],
        check=False,
        capture_output=True,
    )

    if result.returncode != 0:
        detail = result.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"Could not fetch {url}: {detail}")

    marker = f"\n{CURL_MARKER}".encode()
    if marker not in result.stdout:
        raise RuntimeError(f"Could not parse curl response for {url}.")

    body, metadata = result.stdout.rsplit(marker, 1)
    fields = metadata.decode("utf-8", errors="replace").split("\t")
    if len(fields) != 4:
        raise RuntimeError(f"Could not parse curl metadata for {url}.")

    raw_status, effective_url, redirect_url, content_type = fields
    return HttpResponse(
        status=int(raw_status),
        effective_url=effective_url,
        redirect_url=redirect_url,
        content_type=content_type,
        body=body,
    )


def normalize_content_type(value):
    return value.split(";", 1)[0].strip().lower()


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def validate_artifact_response(artifact, expected_body, response, request_url):
    failures = []

    if response.status != 200:
        detail = (
            f"; redirect target {response.redirect_url!r}"
            if response.redirect_url
            else ""
        )
        failures.append(
            f"{artifact.path}: expected HTTP 200, got {response.status}{detail}."
        )
        return failures

    if response.effective_url != request_url:
        failures.append(
            f"{artifact.path}: redirected to {response.effective_url!r}; "
            f"expected a direct response from {request_url!r}."
        )

    actual_content_type = normalize_content_type(response.content_type)
    if actual_content_type != artifact.content_type:
        failures.append(
            f"{artifact.path}: expected Content-Type {artifact.content_type!r}, "
            f"got {response.content_type or '<missing>'!r}."
        )

    if response.body != expected_body:
        failures.append(
            f"{artifact.path}: deployed bytes differ "
            f"(expected {len(expected_body)} bytes, sha256 {sha256(expected_body)}; "
            f"got {len(response.body)} bytes, sha256 {sha256(response.body)})."
        )

    return failures


def check_artifacts(repo_root, origin, args):
    public_root = repo_root / "main" / "public"
    failures = []

    for artifact in ARTIFACTS:
        local_path = public_root / artifact.path
        if not local_path.is_file():
            failures.append(f"{artifact.path}: missing local source {local_path}.")
            continue

        request_url = f"{origin}/{artifact.path}"
        try:
            response = fetch(
                request_url,
                args.timeout,
                args.retries,
                args.retry_delay,
            )
        except RuntimeError as error:
            failures.append(f"{artifact.path}: {error}")
            continue

        failures.extend(
            validate_artifact_response(
                artifact,
                local_path.read_bytes(),
                response,
                request_url,
            )
        )

    return failures


def main():
    parser = argparse.ArgumentParser(
        description="Compare deployed public artifacts byte-for-byte with the repository."
    )
    parser.add_argument(
        "--repo",
        default=".",
        help="Repository root containing main/public.",
    )
    parser.add_argument(
        "--site-url",
        default="https://waffy.dev/",
        help="Deployed site origin to check.",
    )
    parser.add_argument("--timeout", type=int, default=30)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--retry-delay", type=int, default=5)
    args = parser.parse_args()

    if args.timeout <= 0 or args.retries < 0 or args.retry_delay < 0:
        parser.error("timeout must be positive; retries and retry-delay cannot be negative.")

    try:
        origin = normalize_site_url(args.site_url)
    except ValueError as error:
        parser.error(str(error))

    failures = check_artifacts(Path(args.repo).resolve(), origin, args)
    if failures:
        print("Deployed artifact validation failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    print(
        f"Validated {len(ARTIFACTS)} deployed artifacts against repository bytes."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
