import cdcLogo from "../images/cdcLogo.png"
import hdLogo from "../images/hdLogo.png"

export const caseStudiesPage = {
  title: "Selected engineering case studies",
  description:
    "Deeper writeups on reliability, deployment recovery, and data-system work, written around production constraints, technical choices, and measurable outcomes.",
  stats: [
    {
      id: "production-scale",
      value: "34.8M",
      label: "weekly requests after autoscaling validation",
    },
    {
      id: "legacy-services",
      value: "8",
      label: "legacy repositories recovered for credential rotation",
    },
    {
      id: "manual-hours",
      value: "5000+",
      label: "annual reconciliation hours saved",
    },
  ],
}

export const caseStudies = [
  {
    slug: "kubernetes-autoscaling",
    title: "Kubernetes Autoscaling for Transaction-Critical Services",
    organization: "The Home Depot",
    timeframe: "2025",
    category: "Platform Reliability",
    logo: hdLogo,
    logoTheme: "home-depot",
    summary:
      "Validated and deployed Horizontal Pod Autoscaling (HPA) for a high-throughput service previously capped at static capacity, improving latency, errors, throughput, and CPU efficiency under production traffic.",
    metrics: [
      {
        value: "40%",
        label: "lower mean latency",
        detail: "Mean latency moved from 121 ms to 72 ms after rollout.",
      },
      {
        value: "89%",
        label: "fewer errors",
        detail: "Error volume dropped while request volume increased.",
      },
      {
        value: "34.8M",
        label: "weekly requests",
        detail: "Throughput increased from 24.9M to 34.8M requests per week.",
      },
      {
        value: "26%",
        label: "lower average CPU",
        detail: "Average CPU usage fell while dynamic scaling expanded capacity.",
      },
    ],
    flow: [
      {
        title: "Baseline bottleneck",
        detail:
          "A core service was pinned to static pod capacity and needed room to absorb high-volume transaction traffic without overprovisioning.",
      },
      {
        title: "Autoscaling rollout",
        detail:
          "Autoscaling thresholds were deployed and validated with production observability, Kubernetes behavior checks, and staged comparison against the previous baseline.",
      },
      {
        title: "Measured recovery",
        detail:
          "Dynamic scaling between 50 and 100 pods improved responsiveness while reducing resource pressure and error rates.",
      },
    ],
    sections: [
      {
        heading: "Problem",
        paragraphs: [
          "The service supported transaction-critical traffic but was constrained by a static deployment shape. Capacity changes required manual attention, and the old ceiling made traffic growth harder to absorb cleanly.",
          "The goal was not only to add pods. The work needed to prove that autoscaling improved real service behavior without introducing instability during production load.",
        ],
      },
      {
        heading: "Approach",
        paragraphs: [
          "I deployed and validated Kubernetes Horizontal Pod Autoscaling for the service, compared baseline and post-rollout metrics, and watched latency, error rate, throughput, and CPU behavior together instead of treating any single graph as the truth.",
          "The rollout was validated around production health: scaling behavior, traffic shape, response times, and operational signals that would matter during an incident or demand spike.",
        ],
      },
      {
        heading: "Outcome",
        paragraphs: [
          "The service moved from a fixed 20-pod deployment to dynamic production scaling between 50 and 100 pods. Mean latency dropped from 121 ms to 72 ms, errors fell 89%, throughput rose from 24.9M to 34.8M weekly requests, and average CPU usage decreased 26%.",
        ],
      },
    ],
    stack: [
      "Kubernetes",
      "Horizontal Pod Autoscaling",
      "GCP",
      "Grafana",
      "Prometheus/PromQL",
      "k6",
      "Postman",
    ],
    links: [
      {
        label: "View related experience",
        to: "/experience",
      },
    ],
  },
  {
    slug: "legacy-deployment-recovery",
    title: "Legacy Deployment Recovery and Credential Rotation",
    organization: "The Home Depot",
    timeframe: "2026",
    category: "Deployment Automation",
    logo: hdLogo,
    logoTheme: "home-depot",
    summary:
      "Rebuilt deployment workflows for abandoned Java 1.8 Tomcat services so mission-critical repositories could support zero-downtime Cassandra credential rotation.",
    metrics: [
      {
        value: "8",
        label: "repositories recovered",
        detail: "Deployment paths were reconstructed across legacy services.",
      },
      {
        value: "0",
        label: "planned downtime",
        detail: "Credential rotation was enabled without taking services offline.",
      },
      {
        value: "Java 1.8",
        label: "legacy runtime",
        detail: "Old Tomcat services were brought back under operational control.",
      },
      {
        value: "CI/CD",
        label: "rebuilt path",
        detail: "Pipelines were repaired so changes could ship reproducibly.",
      },
    ],
    flow: [
      {
        title: "Ownership gap",
        detail:
          "Legacy services still supported critical transaction paths, but the deployment process had decayed and operational context was thin.",
      },
      {
        title: "Pipeline recovery",
        detail:
          "Build and deploy workflows were reconstructed by tracing how the services packaged, authenticated, and moved through shared environments.",
      },
      {
        title: "Rotation readiness",
        detail:
          "The repaired workflows made it possible to rotate Cassandra credentials safely across dependent repositories.",
      },
    ],
    sections: [
      {
        heading: "Problem",
        paragraphs: [
          "Several legacy Java 1.8 Tomcat services still supported mission-critical transaction systems, but their deployment paths were no longer healthy enough to safely support a coordinated Cassandra credential rotation.",
          "That created an operational risk: foundational services needed security maintenance, but the route to ship and validate those changes had to be rebuilt first.",
        ],
      },
      {
        heading: "Approach",
        paragraphs: [
          "I reconstructed the deployment workflows by reverse-reading repository behavior, CI/CD expectations, authentication failures, and environment assumptions. The work centered on restoring a reproducible release path rather than patching one-off failures.",
          "Once the services could build and deploy reliably again, the credential rotation work could proceed with staged validation instead of emergency manual intervention.",
        ],
      },
      {
        heading: "Outcome",
        paragraphs: [
          "The recovered workflows enabled zero-downtime Cassandra credential rotation across 8 repositories and removed a critical platform outage risk tied to unmanaged legacy services.",
        ],
      },
    ],
    stack: [
      "Java 1.8",
      "Tomcat",
      "Cassandra",
      "CI/CD",
      "Spinnaker",
      "Docker",
      "Artifactory",
    ],
    links: [
      {
        label: "View related experience",
        to: "/experience",
      },
    ],
  },
  {
    slug: "cdc-data-reconciliation",
    title: "CDC Data Reconciliation Platform",
    organization: "Centers for Disease Control and Prevention",
    timeframe: "2023-2024",
    category: "Full-Stack Data Systems",
    logo: cdcLogo,
    logoTheme: "cdc",
    summary:
      "Led a team of six building a full-stack reconciliation platform for infectious disease case-count discrepancies between state health departments and CDC datasets.",
    metrics: [
      {
        value: "5000+",
        label: "hours saved annually",
        detail: "Manual reconciliation work was converted into repeatable comparison workflows.",
      },
      {
        value: "50",
        label: "state health departments",
        detail: "The reconciliation workflow targeted nationwide public health reporting.",
      },
      {
        value: "25+",
        label: "stakeholders",
        detail: "Feedback came from CDC computer scientists and state representatives.",
      },
      {
        value: "6",
        label: "team members",
        detail: "I led the team while contributing across the stack.",
      },
    ],
    flow: [
      {
        title: "Data comparison",
        detail:
          "Python comparison workflows identified discrepancies between CDC and state-reported case counts.",
      },
      {
        title: "API and storage",
        detail:
          "FastAPI and SQLite exposed discrepancy statistics for the frontend reporting experience.",
      },
      {
        title: "Operational review",
        detail:
          "React visualizations helped stakeholders inspect discrepancy trends, filters, and disease-specific details.",
      },
    ],
    sections: [
      {
        heading: "Problem",
        paragraphs: [
          "Manual reconciliation of infectious disease case counts was expensive and repetitive, especially when comparing CDC data with reporting from all 50 state health departments.",
          "The team needed to make discrepancy discovery faster, clearer, and easier to review with public health stakeholders.",
        ],
      },
      {
        heading: "Approach",
        paragraphs: [
          "I led a six-person team while contributing as a full-stack developer. We built Python comparison workflows, a FastAPI endpoint for statistics backed by SQLite, and a React interface for discrepancy exploration.",
          "The UI emphasized disease-specific views, statistic-driven filtering, and demos that made stakeholder feedback concrete enough to turn into implementation changes.",
        ],
      },
      {
        heading: "Outcome",
        paragraphs: [
          "The project saved an estimated 5000+ hours of manual reconciliation annually and incorporated feedback from CDC computer scientists plus representatives from 25+ state health departments.",
        ],
      },
    ],
    stack: [
      "Python",
      "FastAPI",
      "SQLite",
      "React",
      "Tailwind CSS",
      "Data reconciliation",
      "Stakeholder demos",
    ],
    links: [
      {
        label: "View source",
        href: "https://github.com/waffy1901/CDC-Data-Reconciliation",
      },
      {
        label: "View projects",
        to: "/projects",
      },
    ],
  },
]

export const getCaseStudyBySlug = (slug) =>
  caseStudies.find((caseStudy) => caseStudy.slug === slug)
