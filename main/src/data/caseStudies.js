import { caseStudies as caseStudyIndex } from "./caseStudyIndex.js"
import { recentCaseStudies } from "./recentCaseStudies.js"

// Full canonical composition for build-time public artifacts and content checks.
// Browser entry points use caseStudyIndex.js to keep recent narratives deferred.
export { caseStudiesPage } from "./caseStudyIndex.js"
export const caseStudies = caseStudyIndex.map((caseStudy) =>
  recentCaseStudies.find(({ slug }) => slug === caseStudy.slug) ?? caseStudy
)
export const getCaseStudyBySlug = (slug) =>
  caseStudies.find((caseStudy) => caseStudy.slug === slug)
