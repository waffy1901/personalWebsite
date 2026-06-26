# Netlify Token Rotation

The repository secret `NETLIFY_AUTH_TOKEN` is used by the deployment release workflow to read back Netlify production deploy status before publishing a GitHub release. Netlify personal access tokens can expire, so the repo tracks the token expiration date separately and reminds before release automation breaks.

## Required GitHub Settings

Keep these repository settings configured:

```text
Secret:   NETLIFY_AUTH_TOKEN
Variable: NETLIFY_AUTH_TOKEN_EXPIRES_AT
```

Set `NETLIFY_AUTH_TOKEN_EXPIRES_AT` to a `YYYY-MM-DD` date. For the token created on June 26, 2026, use:

```text
2027-06-26
```

Do not store the token value in variables, docs, issues, pull requests, or logs.

## Reminder Workflow

`.github/workflows/netlify-token-rotation-reminder.yml` runs every Monday at 14:00 UTC and can also be run manually from GitHub Actions.

The workflow:

- reads `NETLIFY_AUTH_TOKEN_EXPIRES_AT` from repository variables
- calculates days remaining dynamically
- opens or updates one tracking issue when the token is inside the warning window
- closes the tracking issue after the token has been rotated and the expiration variable points outside the warning window
- never reads or prints the token value

Default warning thresholds are 60, 30, 14, 7, and 0 days before expiration. Because the workflow runs weekly, the issue opens when the token is at or inside the widest configured warning window.

## Manual Test

Use GitHub Actions -> Netlify token rotation reminder -> Run workflow.

Useful manual inputs:

```text
force_issue: true
expiration_date: 2027-06-26
warning_days: 60,30,14,7,0
```

`force_issue` creates or updates the reminder issue even when the token is not near expiration. Use it sparingly, then close the generated reminder issue if it was only a test.

## Rotation Checklist

When rotating the token:

1. Create a new Netlify personal access token.
2. Update the repository secret `NETLIFY_AUTH_TOKEN`.
3. Update the repository variable `NETLIFY_AUTH_TOKEN_EXPIRES_AT` to the new expiration date.
4. Manually run the reminder workflow to confirm the metadata is valid.
5. Confirm the next deployment release workflow can read Netlify deploy status.

`NETLIFY_SITE_ID` identifies the Netlify site and does not need the same annual rotation treatment.
