import { caseStudySeoItems } from "./caseStudySeo.js"
import { legacyCaseStudies } from "./legacyCaseStudies.js"
import { recentCaseStudySummaries } from "./recentCaseStudySummaries.js"

const caseStudiesBySlug = new Map(
  [...legacyCaseStudies, ...recentCaseStudySummaries].map((caseStudy) => [caseStudy.slug, caseStudy])
)

export { caseStudiesPage } from "./legacyCaseStudies.js"
export const getCaseStudyBySlug = (slug) => caseStudiesBySlug.get(slug)
export const caseStudies = caseStudySeoItems.map(({ slug }) => getCaseStudyBySlug(slug))
