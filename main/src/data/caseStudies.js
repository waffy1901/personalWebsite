import cdcLogo from "../images/cdcLogo.png"
import cdcLogoWebp from "../images/cdcLogo.webp"
import hdLogo from "../images/hdLogo.png"
import hdLogoWebp from "../images/hdLogo.webp"
import {
  cdcDataReconciliationSeo,
  kubernetesAutoscalingSeo,
  legacyDeploymentRecoverySeo,
} from "./caseStudySeo.js"

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
    ...kubernetesAutoscalingSeo,
    organization: "The Home Depot",
    timeframe: "2025",
    category: "Platform Reliability",
    logo: hdLogo,
    logoWebp: hdLogoWebp,
    logoTheme: "home-depot",
    metrics: [
      {
        value: "40%",
        label: "lower mean latency",
        detail: "Mean latency moved from 121 ms to 72 ms after rollout.",
      },
      {
        value: "89%",
        label: "fewer errors",
        detail: "Reported 89% reduction; error count versus rate remains unconfirmed.",
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
          "Equal minimum and maximum replica counts kept the service at fixed capacity, leaving no room for HPA to respond to demand.",
      },
      {
        title: "Autoscaling rollout",
        detail:
          "After urgent direction from a reliability engineering director, I tested over a weekend, then deployed and validated HPA using CPU first and memory later.",
      },
      {
        title: "Production comparison",
        detail:
          "Grafana averages over approximately 30-day baseline and comparison periods showed improved service behavior with a 50-100 pod range; exact dates are unconfirmed.",
      },
    ],
    sections: [
      {
        heading: "Problem",
        paragraphs: [
          "The service supported transaction-critical traffic with a fixed 20-pod deployment. HPA had not actually been enabled: its minimum and maximum replica counts were equal, so it could not change capacity in response to demand.",
          "The failure mode was capacity exhaustion. When demand exceeded what those replicas could serve, the fixed ceiling prevented HPA from adding capacity; latency and errors were the service signals to examine alongside resource pressure.",
        ],
      },
      {
        heading: "Ownership and validation",
        paragraphs: [
          "A reliability engineering director asked for HPA to be enabled urgently. I tested over a weekend and concluded from those tests that enabling HPA could have avoided an outage. That is a test-informed counterfactual, not proof that a production outage was prevented.",
          "I deployed and validated the change, using CPU as the initial scaling signal and adding memory later. I compared the baseline with subsequent production observations in Grafana, looking at latency, errors, request throughput, and average CPU together.",
        ],
      },
      {
        heading: "Decision and tradeoff",
        paragraphs: [
          "Keeping equal replica bounds makes capacity predictable, but leaves demand spikes dependent on manual capacity changes. Allowing HPA to vary replicas gives the service room to respond to resource pressure, at the cost of a larger and changing resource footprint. The production range moved to 50-100 pods rather than the previous fixed 20.",
          "This was a bounded capacity decision: even dynamic scaling cannot add replicas beyond its maximum. Demand that exceeds the capacity available at that bound can still exhaust the service. Scaling adds headroom; it does not guarantee that every bottleneck or outage cause is removed.",
        ],
      },
      {
        heading: "Outcome",
        paragraphs: [
          "After rollout, mean latency moved from 121 ms to 72 ms (reported as 40% lower), weekly requests increased from 24.9M to 34.8M, and average CPU usage decreased 26%. The existing result also reports 89% fewer errors, but whether that measure is an error count or a normalized rate remains unconfirmed.",
          "These are observed baseline-versus-comparison results alongside the capacity change. Request volume also changed, so the comparison does not isolate HPA as the sole cause of every improvement.",
        ],
      },
      {
        heading: "Evidence and limits",
        paragraphs: [
          "The measurements came from Grafana. I recall averages over approximately 30-day baseline and comparison periods; exact dates and the error measure's denominator are not confirmed. The weekly request figures describe throughput and should not be treated as those periods' total request counts.",
          "I do not have confirmed stabilization settings, rollback checks, or team handoff details to share. This account therefore supports the testing, deployment, and observed comparison, but does not establish a complete recovery procedure or independently verified outage prevention.",
        ],
      },
      {
        heading: "Lesson",
        paragraphs: [
          "The first check is whether autoscaling has room to act: a configured HPA with equal bounds still leaves the service at fixed capacity. The next check is service behavior across multiple signals and changing traffic, with measurement limits stated alongside the results.",
        ],
      },
    ],
    causalDiagram: {
      afterSection: "Decision and tradeoff",
      title: "How bounded autoscaling changes capacity",
      description:
        "Workload demand creates resource pressure. CPU, with memory added later, informs HPA's replica decision within minimum and maximum bounds. The resulting service capacity affects latency, errors, and throughput, which I compared in Grafana.",
      steps: [
        {
          title: "Workload demand",
          detail: "Transaction requests place demand on the available service capacity.",
          relationship: "Demand creates resource pressure",
        },
        {
          title: "Resource signals",
          detail: "CPU was the initial scaling signal; memory was added later.",
          relationship: "Resource signals inform the replica decision",
        },
        {
          title: "HPA decision within bounds",
          detail: "Equal bounds prevent capacity changes. A 50-100 range permits replica changes within that limit.",
          relationship: "Replica bounds constrain capacity changes",
        },
        {
          title: "Service replicas",
          detail: "The number of replicas determines the capacity available to serve demand.",
          relationship: "Available capacity affects service behavior",
        },
        {
          title: "Observed service behavior",
          detail: "Grafana provided the latency, error, throughput, and CPU observations used for comparison.",
        },
      ],
      feedback:
        "As replica capacity changes, the resource pressure from ongoing demand can change too, informing subsequent scaling decisions. Grafana is the observation tool in this account; this diagram does not identify the HPA metrics source or ingestion path.",
    },
    configurationExample: {
      afterSection: "Decision and tradeoff",
      title: "Replica bounds illustration",
      description:
        "Sanitized, incomplete illustration using the already-public fixed capacity and later range. These bounds alone are not a deployable HPA manifest; metric targets and other configuration are omitted.",
      examples: [
        {
          title: "Before: fixed capacity",
          code: "minReplicas: 20\nmaxReplicas: 20",
        },
        {
          title: "After: room to scale",
          code: "minReplicas: 50\nmaxReplicas: 100",
        },
      ],
    },
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
        to: "/experience/",
      },
    ],
  },
  {
    ...legacyDeploymentRecoverySeo,
    organization: "The Home Depot",
    timeframe: "2026",
    category: "Deployment Automation",
    logo: hdLogo,
    logoWebp: hdLogoWebp,
    logoTheme: "home-depot",
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
        to: "/experience/",
      },
    ],
  },
  {
    ...cdcDataReconciliationSeo,
    organization: "Centers for Disease Control and Prevention",
    timeframe: "2023-2024",
    category: "Full-Stack Data Systems",
    logo: cdcLogo,
    logoWebp: cdcLogoWebp,
    logoTheme: "cdc",
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
        to: "/projects/",
      },
    ],
  },
]

export const getCaseStudyBySlug = (slug) =>
  caseStudies.find((caseStudy) => caseStudy.slug === slug)
