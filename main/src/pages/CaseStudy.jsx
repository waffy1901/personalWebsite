import React, { lazy } from "react";
import { useParams } from "react-router";
import { getCaseStudyBySlug } from "../data/caseStudyIndex.js";
import CaseStudyContent from "../components/CaseStudyContent.jsx";
import NotFound from "./NotFound.jsx";

// The existing route Suspense and error boundary also cover the narrative fetch.
const RecentCaseStudy = lazy(() => import("../data/recentCaseStudies.js").then(
  ({ recentCaseStudies }) => ({
    default: function RecentCaseStudyContent({ slug }) {
      const caseStudy = recentCaseStudies.find((item) => item.slug === slug);
      return caseStudy ? <CaseStudyContent caseStudy={caseStudy} /> : <NotFound />;
    },
  })
));

export default function CaseStudy() {
  const { slug } = useParams();
  const caseStudy = getCaseStudyBySlug(slug);
  if (!caseStudy) return <NotFound />;
  return caseStudy.narrativeDeferred
    ? <RecentCaseStudy slug={slug} />
    : <CaseStudyContent caseStudy={caseStudy} />;
}
