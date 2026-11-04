import { legacyCaseStudies } from "./legacyCaseStudies.js"
import { recentCaseStudies } from "./recentCaseStudies.js"

// Full canonical composition for build-time public artifacts and content checks.
// Browser entry points use caseStudyIndex.js to keep recent narratives deferred.
export { caseStudiesPage } from "./legacyCaseStudies.js"
export const caseStudies = [...legacyCaseStudies, ...recentCaseStudies]
export const getCaseStudyBySlug = (slug) =>
  caseStudies.find((caseStudy) => caseStudy.slug === slug)
