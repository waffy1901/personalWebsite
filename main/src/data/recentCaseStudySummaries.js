import {
  orderReconciliationSeo,
  bookingSecuritySeo,
  paymentTriageSeo,
  jfrogOidcSeo,
} from "./caseStudySeo.js"
import hdLogo from "../images/hdLogo.png"
import hdLogoWebp from "../images/hdLogo.webp"

// Shared card metadata; detailed narratives load only on a new detail route.
export const recentCaseStudySummaries = [
  {
    ...orderReconciliationSeo,
    timeframe: "May - October 2026",
    category: "Production Data Workflows",
    metrics: [
      { value: "7/week", label: "reported scheduled executions", detail: "Owner-reported daily cadence; not an observed run-success rate." },
      { value: "~120 h/year", label: "owner-estimated recurring toil saved", detail: "Annual estimate; the per-run timing and annualization calculation remain unvalidated." },
      { value: "~2,200", label: "backlog items reprocessed", detail: "Normal processing resumed after items were released from initial and maxed_out states." },
    ],
  },
  {
    ...bookingSecuritySeo,
    timeframe: "September - October 2026",
    category: "Security and Delivery Recovery",
    metrics: [
      { value: "66", label: "unique critical/high CVE IDs removed from release builds", detail: "Reported release-build scope; does not prove all running production images were remediated." },
      { value: "10 + 5", label: "services directly remediated + assisted", detail: "Approximately 15 booking services in the September-October effort." },
      { value: "100%", label: "owner-reported final build-gate pass", detail: "Across approximately 15 services; initial reported figure was 33%. Build-attempt denominator and exact observation dates are unavailable." },
      { value: "16", label: "code/SAST findings addressed", detail: "Includes four critical findings. PR scanning was added across seven applications." },
    ],
  },
  {
    ...paymentTriageSeo,
    timeframe: "August - October 2026",
    category: "Technical Leadership and AI",
    metrics: [
      { value: "7", label: "applications in triage scope", detail: "Payment investigation context; not seven autonomous remediation deployments." },
      { value: "4 people", label: "total team, including me", detail: "Three other engineers contributed; I implemented a little over half of the tool." },
      { value: "Active use", label: "by the receiving team", detail: "Owner-confirmed operational ownership and use after knowledge transfer and handoff; no measured accuracy or productivity uplift." },
    ],
  },
  {
    ...jfrogOidcSeo,
    timeframe: "October 2026",
    category: "CI Trust and Authentication",
    metrics: [
      { value: "2 teams", label: "adoption scope", detail: "Owner-reported October 2026 JFrog authentication work." },
      { value: "~20", label: "repositories in scope", detail: "Maven and Docker CI authentication moved away from shared credentials." },
      { value: "1,100+", label: "reported scanning findings resolved", detail: "Findings tied to plaintext token output in CI logs across approximately 20 repositories; not a count of distinct credentials." },
    ],
  },
].map((item) => ({ ...item, organization: "The Home Depot", logo: hdLogo, logoWebp: hdLogoWebp, logoTheme: "home-depot", narrativeDeferred: true }))
