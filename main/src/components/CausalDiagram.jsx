import React, { useId } from "react";
import { FaArrowDown } from "react-icons/fa";

export default function CausalDiagram({ diagram }) {
  const headingId = useId();

  return (
    <figure aria-labelledby={headingId} className="mc-panel min-w-0 px-[12px] py-5 sm:p-5">
      <figcaption>
        <h2 id={headingId} className="text-2xl font-black text-[#0B1220]">
          {diagram.title}
        </h2>
        <p className="mt-4 text-base leading-relaxed text-slate-700">
          {diagram.description}
        </p>
      </figcaption>
      <ol aria-label="Autoscaling causal sequence" className="mt-5 space-y-4">
        {diagram.steps.map((step, index) => (
          <li key={step.title} className="min-w-0">
            <div className="rounded-lg border border-slate-200 bg-[#E8EDF2] px-[12px] py-4 sm:p-4">
              <p aria-hidden="true" className="text-xs font-black text-[#1D4ED8]">
                {index + 1}
              </p>
              <h3 className="mt-2 text-lg font-black text-[#0B1220]">
                {step.title}
              </h3>
              <p className="mt-2 text-base leading-relaxed text-slate-700">
                {step.detail}
              </p>
            </div>
            {step.relationship && (
              <p className="px-[8px] pt-3 text-sm font-bold leading-relaxed text-[#1D4ED8] sm:px-3">
                <FaArrowDown aria-hidden="true" className="mr-2 inline" />
                {step.relationship}: {step.title} to {diagram.steps[index + 1].title}.
              </p>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-5 text-base leading-relaxed text-slate-700">
        {diagram.feedback}
      </p>
    </figure>
  );
}
