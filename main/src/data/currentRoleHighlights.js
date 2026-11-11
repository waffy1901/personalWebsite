import { currentEmployment, professionalIdentity } from "./siteIdentity.js"

export const currentRoleSummary = `${currentEmployment.currentTitle} at ${currentEmployment.organization}, focused on ${professionalIdentity.focus} through secure CI/CD modernization, production order reconciliation on GKE and Cloud Spanner, and technical leadership in AI-assisted payment triage.`

export const currentRoleHighlights = [
  "Led security and CI/CD modernization across 15 booking services through framework upgrades, container hardening, and release-pipeline recovery.",
  "Productionized daily order reconciliation on GKE and Cloud Spanner using Kubernetes CronJobs, Workload Identity, and least-privilege IAM.",
  "Led a four-person team, including myself, through validation and handoff of AI-assisted payment triage across 7 applications; implemented a little over half of the tool.",
]
