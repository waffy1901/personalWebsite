import React from "react";
import { StackChips, StatusBadge } from "./MissionControl.jsx";
import { trackEvent } from "../utils/analytics";

export default function HackathonPrototype({ project }) {
  return (
    <article id={project.id} aria-labelledby={`${project.id}-heading`} className="mc-panel min-w-0 scroll-mt-56 p-5 [overflow-wrap:anywhere] sm:p-7">
      <StatusBadge tone="orange">{project.status}</StatusBadge>
      <p className="mt-4 text-sm font-bold text-slate-600">{project.timeframe} | Two-person team</p>
      <h2 id={`${project.id}-heading`} className="mt-3 text-3xl font-black text-[#0B1220]">{project.title}</h2>
      <p className="mt-4 leading-relaxed text-slate-600">{project.summary}</p>
      <p className="mt-4 font-bold leading-relaxed text-slate-800">{project.outcome}</p>
      <p className="mt-4 border-l-4 border-[#F96302] pl-4 leading-relaxed text-slate-700">{project.reviewBoundary}</p>
      <StackChips items={project.techStack.split(",").map((item) => item.trim())} className="mt-5" />
      <details className="mt-6 border-t border-slate-200 pt-5" onToggle={(event) => {
        if (event.currentTarget.open) trackEvent("project_details_open", {
          placement: "project_card",
          project_id: project.id,
          project_title: project.title,
        });
      }}>
        <summary className="cursor-pointer rounded-sm font-black text-[#1D4ED8] underline underline-offset-4 focus:outline-hidden focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2">Delivery flow, ownership, and limitations</summary>
        <div className="mt-6 space-y-6 text-sm leading-relaxed text-slate-600">
          <section aria-labelledby={`${project.id}-ownership`}>
            <h3 id={`${project.id}-ownership`} className="text-lg font-black text-slate-800">Ownership</h3>
            <p className="mt-2"><strong>Waffy:</strong> {project.ownership.waffy}</p>
            <p className="mt-2"><strong>Teammate:</strong> {project.ownership.teammate}</p>
          </section>
          <section aria-labelledby={`${project.id}-demonstrated`}>
            <h3 id={`${project.id}-demonstrated`} className="text-lg font-black text-slate-800">Demonstrated delivery path</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5">{project.demonstrated.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section aria-labelledby={`${project.id}-flow`}>
            <h3 id={`${project.id}-flow`} className="text-lg font-black text-slate-800">Intended single-call workflow</h3>
            <p className="mt-2">This sanitized flow describes the wider design. The demonstrated portion starts at the source-code PR and ends at the draft production PR; full Jira orchestration and build/publication automation remain unestablished.</p>
            <ol className="mt-4 list-decimal space-y-3 pl-6">{project.intendedFlow.map((step) => <li key={step.title}><strong className="text-slate-800">{step.title}:</strong> {step.detail}</li>)}</ol>
          </section>
          <section aria-labelledby={`${project.id}-decisions`}>
            <h3 id={`${project.id}-decisions`} className="text-lg font-black text-slate-800">Technical decisions</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5">{project.decisions.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
          <section aria-labelledby={`${project.id}-limitations`}>
            <h3 id={`${project.id}-limitations`} className="text-lg font-black text-slate-800">Limitations</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5">{project.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        </div>
      </details>
    </article>
  );
}
