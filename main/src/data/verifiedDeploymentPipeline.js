import { verifiedDeploymentPipelineSummary } from "./recentCaseStudySummaries.js"

const repository = "https://github.com/waffy1901/personalWebsite"
const sourceRevision = "ccb414eeba0831ee17d9bad7aa78573899f58ad7"
const source = (label, path) => ({ label, href: `${repository}/blob/${sourceRevision}/${path}` })

export const verifiedDeploymentPipeline = {
  ...verifiedDeploymentPipelineSummary,
  sections: [
    {
      heading: "What a green build leaves unanswered",
      paragraphs: [
        "A successful Vite build tells me the portfolio compiles. To record a release, I also need to know which commit Netlify is serving and whether its routes, security headers, and public discovery files match that revision's contract. I built the pipeline around evidence I can inspect for a specific deployment.",
      ],
    },
    {
      heading: "Where each check runs",
      paragraphs: [
        "I use Netlify to build and serve the static site, including route-specific metadata shells. That removes the need to operate an application runtime and makes the provider's routing and publication semantics part of the design. GitHub Actions orchestrates verification and records the release after publication.",
        "Pull requests run app tests, bundle budgets, browser smoke, portfolio integrity, dependency audit, CodeQL, and workflow linting. The deployment-release workflow starts with read-only repository access and grants write access to the release job. Netlify credentials come from GitHub Secrets for the provider lookups.",
      ],
      sources: [
        source("Netlify build and headers", "netlify.toml"),
        source("Pull request CI", ".github/workflows/dev-ci.yml"),
        { label: "Passing PR CI run for the example deployment", href: `${repository}/actions/runs/45314562481` },
        source("Portfolio integrity", ".github/workflows/portfolio-integrity.yml"),
        source("Dependency audit job", ".github/workflows/npm-audit.yml"),
        source("Audit policy", "main/scripts/check-npm-audit.mjs"),
        source("CodeQL analysis", ".github/workflows/codeql.yml"),
        source("Workflow lint", ".github/workflows/workflow-lint.yml"),
        source("Deployment-release workflow", ".github/workflows/release-on-deploy.yml"),
      ],
    },
    {
      heading: "When Netlify skips or fails a deploy",
      paragraphs: [
        "The resolver selects a production attempt for the exact commit and follows its deploy ID. A skip signal for that attempt, including Netlify's exact no-content cancellation, ends the workflow successfully with no deployment release. A genuine terminal failure fails the resolver and blocks release creation. Offline fixtures exercise both branches of the workflow.",
      ],
      sources: [
        source("Deploy-state classifier", "scripts/check_netlify_deploy_state.py"),
        source("Skipped and failed deploy fixtures", "scripts/test_release_on_deploy_workflow.py#L163-L177"),
      ],
    },
    {
      heading: "When a ready build differs from production",
      paragraphs: [
        "The workflow requires Netlify's site-level published pointer to identify the same ready production deploy ID and full commit SHA. A valid but different pointer waits within a bounded polling window. Missing or malformed identity fails the job. One fixture holds the commit constant and changes the published deploy ID, causing the resolver to time out.",
        "After comparing routes, headers, and artifacts on the deploy permalink and the public domain, the release job reads the pointer again. If publication has moved, even to a replacement deploy of the same commit, the final guard blocks the release. The provider read and GitHub write are separate requests, so a publication change can still occur between them.",
      ],
      sources: [
        source("Published-deploy verifier", "scripts/check_netlify_published_deploy.py"),
        source("Same-commit mismatch fixture", "scripts/test_release_on_deploy_workflow.py#L131-L141"),
        source("Final publication guard fixture", "scripts/test_release_on_deploy_workflow.py#L218-L231"),
        source("HTTP route checker", "scripts/check-deployed-routes.py"),
        source("Security header checker", "scripts/check-deployed-security-headers.py"),
        source("Public artifact checker", "scripts/check-deployed-artifacts.py"),
      ],
    },
    {
      heading: "The release record and the evidence behind it",
      paragraphs: [
        "A timestamped deploy tag links a commit, a workflow run, and the immutable Netlify deployment URL. The repository keeps these GitHub records as historical entries by convention. The example release is editable, and another successful automatic attempt can write a new timestamped record. A separate workflow publishes curated SemVer milestones for the currently published commit after verifying its deployment record. It reuses an existing published milestone when the requested tag and commit already match.",
        "For commit ccb414e, the linked workflow run passed the HTTP checks on both URLs, rechecked the published deployment, and created the deployment release. The tag resolves to that commit. The run documents what passed for that deployment at the time of release.",
      ],
      sources: [
        { label: "Deployment release for ccb414e", href: `${repository}/releases/tag/deploy-20261124T025009Z-ccb414e` },
        { label: "Deploy permalink for ccb414e", href: "https://6b04fafa32e28115540ad222--waffy.netlify.app/" },
        { label: "Passing deployment-release run", href: `${repository}/actions/runs/45315046245` },
        { label: "Curated v0.4.1 milestone", href: `${repository}/releases/tag/v0.4.1` },
        source("Release versioning contract", "docs/release-versioning.md"),
        source("Semantic-release workflow", ".github/workflows/semantic-release.yml"),
      ],
    },
    {
      heading: "What the checks cover",
      paragraphs: [
        "Production health samples routes, headers, and public files daily. Uptime between runs, real-user latency, and provider security remain outside that evidence. The weekly route performance report runs Lighthouse against a local production build under controlled browser settings. Audit and CodeQL findings describe dependencies and source, while the HTTP checks observe selected responses from the public site.",
        "Operating the pipeline means rotating credentials, investigating failures, and keeping checks aligned with changes to routes and hosting rules. CI logs and artifacts can expire. I would retain a compact verification summary with each release so readers can still see which contracts passed alongside the commit and permalink.",
      ],
      sources: [
        source("Daily Production health workflow", ".github/workflows/deployed-security-headers.yml"),
        source("Weekly route performance workflow", ".github/workflows/route-performance-report.yml"),
      ],
    },
  ],
  causalDiagram: {
    afterSection: "What a green build leaves unanswered",
    title: "Deployment and verification flow",
    sequenceLabel: "Deployment verification sequence",
    description: "The release record follows publication and verification of the serving deployment.",
    steps: [
      { title: "Open a pull request", detail: "Propose and review a change to the portfolio." },
      { title: "Check the change", detail: "GitHub Actions checks the app, dependencies, workflows, and generated content before merge." },
      { title: "Publish on Netlify", detail: "On the successful delivery path, Netlify builds and publishes the static site from the merged main commit." },
      { title: "Verify what is serving", detail: "Match the published deploy ID and commit, then check routes, headers, and public files." },
      { title: "Record the deployment", detail: "Recheck the published pointer and write the deploy tag and GitHub release with the deploy permalink." },
    ],
    feedback: "On its own daily schedule, Production health resolves the latest published revision and compares the public domain with that revision's expected routes, headers, and artifacts.",
  },
  stack: ["GitHub Actions", "Netlify", "Vite", "CodeQL", "Python", "Playwright"],
  links: [{ label: "Portfolio repository", href: repository }],
}
