import { currentEmployment } from "./siteIdentity.js"

export const currentRoleSummary = `${currentEmployment.currentTitle} at ${currentEmployment.organization}, focused on secure CI/CD modernization, production order reconciliation on GKE and Cloud Spanner, and technical leadership in AI-assisted payment triage.`

export const currentRoleHighlights = [
  "Led security and CI/CD modernization across 15 booking services through framework upgrades, container hardening, and release-pipeline recovery.",
  "Productionized daily order reconciliation on GKE and Cloud Spanner using Kubernetes CronJobs, Workload Identity, and least-privilege IAM.",
  "Led 4 engineers from design through stakeholder validation and handoff of an AI-assisted payment triage agent spanning 7 applications.",
]
