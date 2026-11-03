import { hackathonPrototypeIdentity as hackathonPrototype } from "./hackathonPrototypeIdentity.js"

// Shared by the Experience page and generated discovery; no app/image imports.
export const currentRoleEvidence = {
  id: "recent-engineering-work",
  heading: "Recent engineering work and technical guidance",
  timeframe: "July - October 2026",
  introduction:
    "Selected Software Engineer II work beyond the role highlights: application recovery, operational aftercare, infrastructure guidance, engineering visibility, and a separate hackathon prototype.",
  evidenceNote:
    "PR review volume describes activity; it does not measure review quality.",
  groups: [
    {
      id: "hackathon-prototyping",
      title: "Hackathon prototyping",
      entries: [
        {
          id: "jira-to-gke-prototype-reference",
          title: hackathonPrototype.title,
          summary: `${hackathonPrototype.timeframe}. Built the deployment factory's Python poller, persistent run records, approval checks, and Slack notifications. A 112-minute live run reached a draft production PR after dev, qp, and qa; no production rollout.`,
          href: hackathonPrototype.path,
          linkLabel: "Explore the delivery prototype",
        },
      ],
    },
    {
      id: "production-recovery",
      title: "Production recovery",
      entries: [
        {
          id: "certificate-response",
          title: "Emergency certificate response",
          summary:
            "Coordinated application rebuilds and redeployments within an emergency certificate response: 24 BookIt production apps in approximately 1 hour within a 3-hour window, validating container images and running workloads.",
        },
        {
          id: "cluster-networking-recovery",
          title: "Post-rebuild service networking",
          summary:
            "Traced approximately 1-second service failures after a cluster rebuild to stale node-level routing in internal NodePort communication. Migrated that communication to ClusterIP; the observed recovery signals were the end of 1-second Linkerd timeouts and upstream internal HTTP timeouts. This removed the stale-node dependency in this incident.",
        },
      ],
    },
    {
      id: "operational-aftercare",
      title: "Credentials and operational aftercare",
      entries: [
        {
          id: "production-account-rotations",
          title: "Production service-account rotations",
          summary:
            "Carried out CyberArk and Google Secret Manager updates with rolling restarts, accounted for an overlooked PCF dependency, validated new keys, and retired superseded keys across production service-account rotations.",
        },
        {
          id: "order-reconciliation-aftercare",
          title: "Order-reconciliation aftercare",
          summary:
            "Addressed a September sequencing race and an October queue bug affecting batches of more than 100 items in the production order-reconciliation workflow. Normal processing reprocessed the approximately 2,200-item backlog once items were released from initial and maxed_out states.",
        },
        {
          id: "ongoing-operational-support",
          title: "Ongoing operational support",
          summary:
            "Supported Astra token revocation, an identity incident, Cassandra reconnect and Booking Feeder work, third-region operations, rolling-restart runbooks, and PCF certificate and Conjur maintenance.",
        },
      ],
    },
    {
      id: "infrastructure-guidance",
      title: "Infrastructure and technical guidance",
      entries: [
        {
          id: "capture-infrastructure-contact",
          title: "Capture infrastructure contact",
          summary:
            "Served as Capture's primary infrastructure contact across GKE, Terraform, cdk8s, CI/CD, identity, deployments, and incident support.",
        },
        {
          id: "cross-team-reviews",
          title: "Cross-team PR review and knowledge transfer",
          summary:
            "Reviewed 201 unique pull requests in October 2026 across about four teams. Paired that review work with documented knowledge transfer on GKE, infrastructure as code, authentication, secrets, production validation, and container securityContext configuration.",
        },
      ],
    },
    {
      id: "engineering-visibility",
      title: "Engineering visibility",
      entries: [
        {
          id: "scheduled-engineering-dashboards",
          title: "Scheduled engineering dashboards",
          summary:
            "Built scheduled dashboards across Capture, Interrupt, BookIt, Search, and PTM. The dashboards were used as the source of truth for Q3 story points and engineers' PR review metrics at the Q4 kickoff all-hands. Those team metrics are separate from the personal October review count.",
        },
      ],
    },
  ],
}
