import { legacyCaseStudies } from "./legacyCaseStudies.js"
import { recentCaseStudySummaries } from "./recentCaseStudySummaries.js"

export { caseStudiesPage } from "./legacyCaseStudies.js"
export const caseStudies = [...legacyCaseStudies, ...recentCaseStudySummaries]
export const getCaseStudyBySlug = (slug) =>
  caseStudies.find((caseStudy) => caseStudy.slug === slug)
