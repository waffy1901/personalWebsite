export const bookingSecurityImpact = {
  value: "66",
  label: "unique critical/high CVE IDs removed from production workloads",
  detail: "Owner-reported across about 15 booking services in 2026. I remediated 10 directly and assisted with five.",
}

export const orderReconciliationImpact = {
  value: "~2,200",
  label: "backlog items reprocessed",
  detail: "Normal processing cleared the backlog after the October 2026 production order-reconciliation queue fix.",
}

export const paymentTriageImpact = {
  value: "7",
  label: "payment applications in AI-assisted triage",
  detail: "I led a four-person team through validation and 2026 handoff. The receiving team actively uses the tool.",
}

export const autoscalingLatencyImpact = {
  value: "40%",
  label: "lower mean latency",
  detail: "Mean latency fell from 121 ms to 72 ms after a 2025 Kubernetes HPA rollout for one service.",
}
