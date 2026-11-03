// Detailed canonical evidence; excluded from initial route summaries.
export const hackathonPrototypeNotes = {
  techStack: "Jira, AI-assisted engineering, Docker, Google Artifact Registry, GKE, cdk8s, Grafana, Slack",
  ownership: {
    waffy: "Owned DevOps/infrastructure and end-to-end deployment validation for the demonstrated promotion path; configured a Slack webhook to trigger cdk8s PR reviews and validations.",
    teammate: "Focused on the AI portion of the two-person prototype.",
  },
  demonstrated: [
    "Promoted a source-code PR through dev, qp, and qa to a draft production PR in cdk8s.",
    "Checked Grafana health and verified that pods were running the expected version.",
    "Configured a Slack webhook to trigger cdk8s PR reviews and validations.",
  ],
  intendedFlow: [
    { title: "Jira story", detail: "Start the wider workflow with one skill call and a story's requirements." },
    { title: "Preflight and discovery", detail: "Discover repository context and prerequisites before proposing work." },
    { title: "Repository analysis and planning", detail: "Turn the story and code context into an implementation plan." },
    { title: "Implementation and source PR", detail: "Prepare changes for review before the delivery path." },
    { title: "Draft production PR", detail: "Prepare a reviewable production proposal; human review remains required before production merge and rollout." },
    { title: "Docker build", detail: "Build a container image for the proposed change." },
    { title: "Google Artifact Registry publication", detail: "Publish the built image to Google Artifact Registry." },
    { title: "GKE delivery validation", detail: "Validate workload health and the expected pod version on GKE." },
  ],
  decisions: [
    "Used cdk8s PRs to make environment changes reviewable and preserve a human handoff before production.",
    "Paired Grafana health signals with expected pod-version checks to validate both service health and the deployed version.",
    "Used a Slack webhook to trigger cdk8s PR reviews and validations within the delivery workflow.",
  ],
  limitations: [
    "This was an October 28-29, 2026 hackathon prototype, not a production delivery platform.",
    "The complete Jira-to-implementation orchestration and Docker/Google Artifact Registry automation are intended scope; end-to-end completion of those steps is unestablished.",
    "The demonstrated result ends at a draft production PR, with no claim of autonomous production merge or rollout.",
    "Public notes are sanitized; employer code, repository links, internal URLs, and screenshots are not published.",
  ],
  bullets: [],
}
