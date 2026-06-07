import React from "react"
import { Link } from "react-router-dom"
import { FaArrowRight, FaChartLine } from "react-icons/fa"
import { caseStudies, caseStudiesPage } from "../data/caseStudies"
import { trackEvent } from "../utils/analytics"

const logoFrameClassByTheme = {
  "home-depot": "border-orange-500 bg-[#F96302]",
  cdc: "border-gray-200 bg-white",
}

function CaseStudies() {
  return (
    <main className="min-h-screen bg-blue-100 px-4 py-8 font-cambria">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] md:items-end">
          <div className="relative pl-5">
            <span className="absolute left-0 top-1 h-[calc(100%-0.5rem)] w-1 rounded bg-blue-800" />
            <p className="mb-2 text-sm font-bold uppercase tracking-wide text-blue-800">
              Case Studies
            </p>
            <h1 className="max-w-4xl text-4xl font-bold leading-tight text-gray-900 sm:text-5xl">
              {caseStudiesPage.title}
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-gray-700">
              {caseStudiesPage.description}
            </p>
          </div>

          <div className="grid gap-3">
            {caseStudiesPage.stats.map((stat) => (
              <div
                key={stat.id}
                className="rounded-lg border border-blue-200 bg-white/70 px-4 py-3 shadow-sm"
              >
                <p className="text-2xl font-bold text-blue-900">{stat.value}</p>
                <p className="text-sm leading-snug text-gray-700">{stat.label}</p>
              </div>
            ))}
          </div>
        </header>

        <section className="grid gap-5 md:grid-cols-3" aria-label="Case studies">
          {caseStudies.map((caseStudy) => (
            <article
              key={caseStudy.slug}
              className="flex min-h-[26rem] flex-col rounded-lg border border-blue-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                    {caseStudy.category}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {caseStudy.organization} {"\u00b7"} {caseStudy.timeframe}
                  </p>
                </div>
                <span
                  className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded border p-1 ${logoFrameClassByTheme[caseStudy.logoTheme]}`}
                >
                  <img
                    src={caseStudy.logo}
                    alt=""
                    aria-hidden="true"
                    className="max-h-full max-w-full object-contain"
                  />
                </span>
              </div>

              <h2 className="text-xl font-bold leading-snug text-gray-900">
                {caseStudy.title}
              </h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-700">
                {caseStudy.summary}
              </p>

              <div className="mt-4 grid gap-2">
                {caseStudy.metrics.slice(0, 2).map((metric) => (
                  <div
                    key={metric.label}
                    className="flex items-center gap-3 rounded border border-gray-200 bg-blue-50 px-3 py-2"
                  >
                    <FaChartLine className="text-blue-700" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {metric.value} {metric.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                to={`/case-studies/${caseStudy.slug}`}
                onClick={() =>
                  trackEvent("case_study_card_click", {
                    case_study_slug: caseStudy.slug,
                    case_study_title: caseStudy.title,
                    placement: "case_studies_grid",
                  })
                }
                className="mt-5 inline-flex w-fit items-center rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:ring-offset-2"
              >
                Read case study
                <FaArrowRight className="ml-2" aria-hidden="true" />
              </Link>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}

export default CaseStudies
