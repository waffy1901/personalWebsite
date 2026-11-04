import React from "react";
import { Link } from "react-router";
import { currentRoleCaseStudyLinks } from "../data/caseStudySeo.js";
import { createRouteIntentHandlers } from "../utils/routePrefetch.js";

export default function CurrentRoleCaseStudyLinks() {
  return (
    <nav aria-label="Recent SWE II case studies" className="mc-panel p-5">
      <h2 className="text-xl font-black text-[#0B1220]">Inside the recent work</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {currentRoleCaseStudyLinks.map((item) => {
          const to = `/case-studies/${item.slug}/`;
          return (
            <li key={item.slug} className="min-w-0">
              <Link to={to} {...createRouteIntentHandlers(to)} className="inline-block max-w-full rounded-sm font-bold text-[#1D4ED8] underline underline-offset-4 wrap-break-word focus:outline-hidden focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2">
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
