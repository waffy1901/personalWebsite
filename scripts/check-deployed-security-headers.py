#!/usr/bin/env python3
import argparse
import re
import subprocess
import sys
import tomllib
from pathlib import Path


# Keep this baseline independent from netlify.toml. The config defines the
# intended deployment, while these requirements prevent both from drifting to
# a weakened policy together.
REQUIRED_HEADER_VALUES = {
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
}

REQUIRED_HEADER_FRAGMENTS = {
    "permissions-policy": (
        "camera=()",
        "microphone=()",
        "geolocation=()",
        "payment=()",
        "usb=()",
    ),
}

REQUIRED_CSP_DIRECTIVES = {
    "default-src": ("'self'",),
    "base-uri": ("'self'",),
    "object-src": ("'none'",),
    "frame-ancestors": ("'none'",),
    "script-src": ("'self'", "https://www.googletagmanager.com"),
    "connect-src": (
        "'self'",
        "https://formspree.io",
        "https://www.google-analytics.com",
        "https://*.google-analytics.com",
        "https://analytics.google.com",
        "https://*.analytics.google.com",
    ),
    "img-src": (
        "'self'",
        "data:",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
        "https://*.google-analytics.com",
    ),
    "style-src": ("'self'", "'unsafe-inline'"),
    "font-src": ("'self'", "data:"),
    "form-action": ("'self'", "https://formspree.io"),
    "frame-src": ("'none'",),
    "upgrade-insecure-requests": (),
}


def load_expected_headers(repo_root):
    netlify_toml = repo_root / "netlify.toml"
    config = tomllib.loads(netlify_toml.read_text(encoding="utf-8"))
    header_blocks = config.get("headers", [])

    for block in header_blocks:
        if block.get("for") == "/*":
            values = block.get("values", {})
            if not values:
                raise ValueError("netlify.toml has an empty [[headers]] block for /*")
            return values

    raise ValueError("netlify.toml is missing the global [[headers]] block for /*")


def fetch_headers(site_url, timeout, retries, retry_delay):
    result = subprocess.run(
        [
            "curl",
            "--silent",
            "--show-error",
            "--location",
            "--head",
            "--retry",
            str(retries),
            "--retry-delay",
            str(retry_delay),
            "--connect-timeout",
            "10",
            "--max-time",
            str(timeout),
            "--dump-header",
            "-",
            "--output",
            "/dev/null",
            "--write-out",
            "\n__HTTP_STATUS__:%{http_code}\n",
            site_url,
        ],
        check=False,
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        raise RuntimeError(f"Could not fetch {site_url}: {result.stderr.strip()}")

    output = result.stdout.replace("\r\n", "\n").replace("\r", "\n")
    status_match = re.search(r"\n__HTTP_STATUS__:(\d{3})\n?$", output)
    if not status_match:
        raise RuntimeError("Could not determine HTTP status from curl output.")

    status_code = status_match.group(1)
    header_output = output[: status_match.start()]
    if status_code != "200":
        raise RuntimeError(
            f"Expected HTTP 200 from {site_url}, got {status_code}.\n{header_output.strip()}"
        )

    header_blocks = [block for block in header_output.split("\n\n") if block.strip()]
    if not header_blocks:
        raise RuntimeError("Could not parse response headers from curl output.")

    headers = {}
    for line in header_blocks[-1].splitlines()[1:]:
        if ":" not in line:
            continue
        name, value = line.split(":", 1)
        headers.setdefault(name.lower(), []).append(value.strip())

    return headers


def get_header_values(headers, name):
    return headers.get(name.lower(), [])


def parse_csp_directives(policy):
    directives = {}
    duplicate_directives = set()
    for declaration in policy.split(";"):
        parts = declaration.strip().split()
        if parts:
            directive_name = parts[0].lower()
            if directive_name in directives:
                duplicate_directives.add(directive_name)
                continue
            directives[directive_name] = parts[1:]
    return directives, duplicate_directives


def is_sha256_token(token):
    return token.startswith("'sha256-") and token.endswith("'")


def validate_minimum_policy(headers):
    normalized_headers = {name.lower(): value for name, value in headers.items()}
    failures = []

    for header_name, required_value in REQUIRED_HEADER_VALUES.items():
        actual_value = normalized_headers.get(header_name)
        if actual_value != required_value:
            failures.append(
                f"{header_name} must be {required_value!r}; got {actual_value or '<missing>'!r}."
            )

    for header_name, required_fragments in REQUIRED_HEADER_FRAGMENTS.items():
        actual_value = normalized_headers.get(header_name)
        if actual_value is None:
            failures.append(f"Missing required {header_name} header.")
            continue

        for fragment in required_fragments:
            if fragment not in actual_value:
                failures.append(f"{header_name} is missing required fragment {fragment!r}.")

    csp = normalized_headers.get("content-security-policy")
    if csp is None:
        failures.append("Missing required content-security-policy header.")
        return failures

    csp_directives, duplicate_directives = parse_csp_directives(csp)
    for directive_name in sorted(duplicate_directives):
        failures.append(
            f"Content-Security-Policy contains duplicate {directive_name} directives."
        )

    unexpected_directives = sorted(
        set(csp_directives).difference(REQUIRED_CSP_DIRECTIVES)
    )
    for directive_name in unexpected_directives:
        failures.append(
            f"Content-Security-Policy contains unexpected directive {directive_name}."
        )

    for directive_name, required_tokens in REQUIRED_CSP_DIRECTIVES.items():
        actual_tokens = csp_directives.get(directive_name)
        if actual_tokens is None:
            failures.append(f"Content-Security-Policy is missing {directive_name}.")
            continue

        for token in required_tokens:
            if token not in actual_tokens:
                failures.append(
                    f"Content-Security-Policy {directive_name} is missing required token {token!r}."
                )

        unexpected_tokens = [
            token
            for token in actual_tokens
            if token not in required_tokens
            and not (directive_name == "script-src" and is_sha256_token(token))
        ]
        for token in unexpected_tokens:
            failures.append(
                f"Content-Security-Policy {directive_name} contains unexpected token {token!r}."
            )

    script_tokens = csp_directives.get("script-src", [])
    if not any(is_sha256_token(token) for token in script_tokens):
        failures.append("Content-Security-Policy script-src is missing an inline SHA-256 hash.")

    return failures


def main():
    parser = argparse.ArgumentParser(
        description="Compare deployed security headers against netlify.toml."
    )
    parser.add_argument(
        "--repo",
        default=".",
        help="Repository root containing netlify.toml.",
    )
    parser.add_argument(
        "--site-url",
        default="https://waffy.dev/",
        help="Deployed site URL to check.",
    )
    parser.add_argument("--timeout", type=int, default=30)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--retry-delay", type=int, default=5)
    args = parser.parse_args()

    repo_root = Path(args.repo).resolve()
    expected_headers = load_expected_headers(repo_root)
    policy_failures = validate_minimum_policy(expected_headers)
    if policy_failures:
        print(
            "netlify.toml security policy does not meet the required baseline.",
            file=sys.stderr,
        )
        for failure in policy_failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    actual_headers = fetch_headers(args.site_url, args.timeout, args.retries, args.retry_delay)

    failures = []
    for header_name, expected_value in expected_headers.items():
        actual_values = get_header_values(actual_headers, header_name)
        if actual_values != [expected_value]:
            failures.append((header_name, expected_value, actual_values))

    if failures:
        print("Production security headers do not match netlify.toml.", file=sys.stderr)
        for header_name, expected_value, actual_values in failures:
            print(f"\nUnexpected {header_name} header.", file=sys.stderr)
            print(f"Expected: {expected_value}", file=sys.stderr)
            if not actual_values:
                print("Actual:   <missing>", file=sys.stderr)
            else:
                print(f"Actual ({len(actual_values)} value(s)):", file=sys.stderr)
                for actual_value in actual_values:
                    print(f"- {actual_value}", file=sys.stderr)
        return 1

    checked = ", ".join(expected_headers.keys())
    print(f"Production security headers match netlify.toml: {checked}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
