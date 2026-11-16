export const kubernetesAutoscalingSeo = {
  slug: "kubernetes-autoscaling",
  title: "Kubernetes Autoscaling for Transaction-Critical Services",
  featured: true,
  summary:
    "Validated and deployed Horizontal Pod Autoscaling (HPA) for a high-throughput service previously capped at static capacity, improving latency, errors, throughput, and CPU efficiency under production traffic.",
}

export const legacyDeploymentRecoverySeo = {
  slug: "legacy-deployment-recovery",
  title: "Legacy Deployment Recovery and Credential Rotation",
  summary:
    "Rebuilt deployment workflows for abandoned Java 1.8 Tomcat services so mission-critical repositories could support zero-downtime Cassandra credential rotation.",
}

export const cdcDataReconciliationSeo = {
  slug: "cdc-data-reconciliation",
  title: "CDC Data Reconciliation Platform",
  summary:
    "Led a team of six building a full-stack reconciliation platform for infectious disease case-count discrepancies between state health departments and CDC datasets.",
}

export const orderReconciliationSeo = {
  slug: "production-order-reconciliation",
  title: "Production Order Reconciliation on GKE and Spanner",
  summary:
    "Moved an internal daily order-reconciliation workflow from developer-run scripts to GKE, adapted it to Cloud Spanner, and followed through on production sequencing and queue failures.",
}

export const bookingSecuritySeo = {
  slug: "booking-security-cicd-recovery",
  title: "Booking Security and CI/CD Recovery",
  featured: true,
  summary:
    "Modernized release builds across approximately 15 booking services, directly remediating 10 and assisting with five, while restoring delivery paths blocked for roughly 11 months.",
}

export const paymentTriageSeo = {
  slug: "ai-assisted-payment-triage",
  title: "Evidence-Grounded AI-Assisted Payment Triage",
  summary:
    "Led a four-person team across seven applications, implemented a little over half of the tool, and handed evidence-grounded payment triage to its receiving team for active use.",
}

export const jfrogOidcSeo = {
  slug: "jfrog-oidc-adoption",
  title: "JFrog OIDC and CI Credential Lifecycle",
  summary:
    "Drove a move from shared Maven and Docker credentials to short-lived, job-scoped authentication across two teams and approximately 20 repositories.",
}

// Lead with recent security and delivery ownership, paired with measured production
// reliability. Follow with current production and CI work, then earlier evidence.
export const caseStudySeoItems = [
  bookingSecuritySeo,
  kubernetesAutoscalingSeo,
  orderReconciliationSeo,
  jfrogOidcSeo,
  paymentTriageSeo,
  legacyDeploymentRecoverySeo,
  cdcDataReconciliationSeo,
]

const currentRoleLinkLabels = {
  [bookingSecuritySeo.slug]: "Booking security and release recovery",
  [orderReconciliationSeo.slug]: "Order reconciliation: GKE and Spanner",
  [jfrogOidcSeo.slug]: "JFrog OIDC and CI credentials",
  [paymentTriageSeo.slug]: "AI-assisted payment triage",
}

// Home and Experience follow library order using lightweight link metadata.
export const currentRoleCaseStudyLinks = caseStudySeoItems
  .filter(({ slug }) => Object.hasOwn(currentRoleLinkLabels, slug))
  .map((item) => ({ ...item, label: currentRoleLinkLabels[item.slug] }))
