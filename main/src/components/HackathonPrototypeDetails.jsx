import React from "react";
import { StackChips } from "./MissionControl.jsx";
import { hackathonPrototypeIdentity } from "../data/hackathonPrototypeIdentity.js";
import { hackathonPrototypeNotes } from "../data/hackathonPrototypeNotes.js";

const project = { ...hackathonPrototypeIdentity, ...hackathonPrototypeNotes };

export default function HackathonPrototypeDetails() {
  return (
    <div className="mt-6 space-y-6 text-sm leading-relaxed text-slate-600">
      <StackChips items={project.techStack.split(",").map((item) => item.trim())} />
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
        <p className="mt-2">This is the wider design. The demonstrated delivery path starts at a merged source PR and ends at a draft production PR; build dispatch was manual, and full Jira-to-implementation orchestration remains unestablished.</p>
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
  );
}
