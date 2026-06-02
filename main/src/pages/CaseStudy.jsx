import React from "react"
import { Link, useParams } from "react-router-dom"
import { FaArrowLeft, FaArrowRight, FaExternalLinkAlt } from "react-icons/fa"
import { getCaseStudyBySlug } from "../data/caseStudies"
import NotFound from "./NotFound"

const logoFrameClassByTheme = {
  "home-depot": "border-orange-500 bg-[#F96302]",
  cdc: "border-gray-200 bg-white",
}

function CaseStudy() {
  const { slug } = useParams()
  const caseStudy = getCaseStudyBySlug(slug)

  if (!caseStudy) {
    return <NotFound />
  }

  return (
    <main className="min-h-screen bg-blue-100 px-4 py-6 font-cambria">
      <article className="mx-auto max-w-6xl">
        <Link
          to="/case-studies"
          className="mb-5 inline-flex items-center rounded px-1 py-1 text-sm font-bold text-blue-800 transition-colors hover:text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:ring-offset-2"
        >
          <FaArrowLeft className="mr-2" aria-hidden="true" />
          Case Studies
        </Link>

        <header className="rounded-lg border border-blue-200 bg-white p-5 shadow-sm md:p-7">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-blue-700">
                {caseStudy.category}
              </p>
              <h1 className="mt-2 max-w-4xl text-4xl font-bold leading-tight text-gray-900 sm:text-5xl">
                {caseStudy.title}
              </h1>
              <p className="mt-3 text-base font-bold text-gray-600">
                {caseStudy.organization} {"\u00b7"} {caseStudy.timeframe}
              </p>
              <p className="mt-5 max-w-3xl text-lg leading-relaxed text-gray-700">
                {caseStudy.summary}
              </p>
            </div>

            <span
              className={`flex h-24 w-24 flex-shrink-0 items-center justify-center rounded border p-2 ${logoFrameClassByTheme[caseStudy.logoTheme]}`}
            >
              <img
                src={caseStudy.logo}
                alt=""
                aria-hidden="true"
                className="max-h-full max-w-full object-contain"
              />
            </span>
          </div>
        </header>

        <section
          aria-labelledby="case-study-metrics"
          className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <h2 id="case-study-metrics" className="sr-only">
            Case study metrics
          </h2>
          {caseStudy.metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border border-blue-200 bg-white p-4 shadow-sm"
            >
              <p className="text-3xl font-bold text-blue-900">{metric.value}</p>
              <p className="mt-1 font-bold text-gray-800">{metric.label}</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {metric.detail}
              </p>
            </div>
          ))}
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-6">
            <section
              aria-labelledby="case-study-flow"
              className="rounded-lg border border-blue-200 bg-white p-5 shadow-sm"
            >
              <h2 id="case-study-flow" className="text-2xl font-bold text-gray-900">
                Engineering path
              </h2>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {caseStudy.flow.map((step, index) => (
                  <div
                    key={step.title}
                    className="rounded border border-gray-200 bg-blue-50 p-4"
                  >
                    <p className="text-sm font-bold uppercase tracking-wide text-blue-700">
                      Step {index + 1}
                    </p>
                    <h3 className="mt-2 text-lg font-bold text-gray-900">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-700">
                      {step.detail}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {caseStudy.sections.map((section) => (
              <section
                key={section.heading}
                className="rounded-lg border border-blue-200 bg-white p-5 shadow-sm"
              >
                <h2 className="text-2xl font-bold text-gray-900">
                  {section.heading}
                </h2>
                <div className="mt-3 space-y-3 text-base leading-relaxed text-gray-700">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="h-fit rounded-lg border border-blue-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">Stack</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {caseStudy.stack.map((tech) => (
                <span
                  key={tech}
                  className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-sm font-bold text-blue-900"
                >
                  {tech}
                </span>
              ))}
            </div>

            <h2 className="mt-6 text-xl font-bold text-gray-900">Related links</h2>
            <div className="mt-3 grid gap-2">
              {caseStudy.links.map((link) =>
                link.to ? (
                  <Link
                    key={link.label}
                    to={link.to}
                    className="inline-flex items-center rounded bg-blue-700 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-900 focus:ring-offset-2"
                  >
                    {link.label}
                    <FaArrowRight className="ml-2" aria-hidden="true" />
                  </Link>
                ) : (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded bg-slate-800 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
                  >
                    {link.label}
                    <FaExternalLinkAlt className="ml-2" aria-hidden="true" />
                  </a>
                )
              )}
            </div>
          </aside>
        </div>
      </article>
    </main>
  )
}

export default CaseStudy
