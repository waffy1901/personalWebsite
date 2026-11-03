// Detailed canonical evidence; excluded from initial route summaries.
export const hackathonPrototypeNotes = {
  techStack: "Python, GitHub Actions, Jira, AI-assisted engineering, Docker, Google Artifact Registry, GKE, cdk8s, Grafana, Slack",
  ownership: {
    waffy: "Created the repository and built the deployment workstream: Python poller, persistent run-record contract, merged-source-PR handoff, deployment skill, and Slack notifications. Ran the live promotion and reviewed 17 PRs across collaborating workstreams.",
    teammate: "Owned the feature/AI workstream and reviewed the deployment contracts and implementation.",
  },
  demonstrated: [
    "Promoted one merged source PR through dev, qp, and qa to a draft production cdk8s PR in 112 minutes.",
    "Verified Grafana rollout health by region and the expected image version on running GKE pods.",
    "Persisted each step on a protected run-record branch and sent Slack approval requests and status updates.",
    "Proved deploy-key write access with a live push probe before external writes; 110 unit tests passed on Python 3.12 and 3.14 at the validated snapshot.",
  ],
  intendedFlow: [
    { title: "Jira story", detail: "Start the wider workflow with one skill call and a story's requirements." },
    { title: "Preflight and discovery", detail: "Discover repository context and prerequisites before proposing work." },
    { title: "Repository analysis and planning", detail: "Turn the story and code context into an implementation plan." },
    { title: "Implementation and source PR", detail: "Merge source changes with at least two human approvals before deployment intake." },
    { title: "Docker build", detail: "A person dispatches the build; the poller discovers its run and reads the image tag." },
    { title: "Google Artifact Registry publication", detail: "The build publishes its container image to Google Artifact Registry." },
    { title: "GKE delivery validation", detail: "Promote through dev, qp, and qa with configured reviews and regional health/version checks." },
    { title: "Draft production PR", detail: "Open an image-tag proposal for an app owner to review before production merge and rollout." },
  ],
  decisions: [
    "Used a scheduled state machine, one run-record writer, and persisted steps to avoid depending on an open agent session.",
    "Checked source approvals on the merged head and limited cdk8s changes to the service's image tag.",
    "Required an explicit live flag and a non-dry run before writes; the poller never approves, merges, or marks PRs ready.",
    "Separated application-code push-back from cdk8s configuration fixes, which require a new reviewable PR.",
  ],
  limitations: [
    "This October 27-29, 2026 hackathon prototype demonstrated one GKE service, ending at a draft production PR closed unmerged, with no production rollout.",
    "Build dispatch and four polls were manual. Full Jira-to-implementation orchestration and unattended completion were not demonstrated.",
    "Run records were persisted, but recovery across an agent-session restart was not tested; one session drove the live run.",
    "Dev lacked code-owner review; qp and qa received human code-owner approval. Dev Slack approval messages still needed correction.",
    "Public notes are sanitized; employer code, repository links, internal URLs, and screenshots are not published.",
  ],
  bullets: [],
}
