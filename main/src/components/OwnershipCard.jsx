import React, { useState } from "react";

const OwnershipCard = ({ title, summary, icon, details }) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleBlur = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsHovered(false);
    }
  };

  return (
    <article
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={handleBlur}
      tabIndex={0}
      className={`relative min-h-[210px] rounded-lg outline-hidden transition-all duration-300 focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 ${
        isHovered ? "z-20" : "z-0"
      }`}
    >
      <div
        className={`relative min-h-[210px] rounded-lg border p-5 shadow-[0_18px_60px_rgba(0,0,0,0.18)] transition-all duration-300 ${
          isHovered
            ? "border-[#2563EB]/40 bg-white"
            : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#2563EB]/25 bg-[#2563EB]/10 text-2xl text-[#2563EB]">
            {icon}
          </span>
          <h3 className="text-lg font-black leading-tight text-[#0B1220]">{title}</h3>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600">{summary}</p>

        <div className="absolute bottom-4 left-5 right-5 h-px bg-slate-200" aria-hidden="true" />
      </div>

      <div
        className={`relative z-30 w-full overflow-hidden rounded-b-lg border-x border-b border-[#2563EB]/20 bg-white shadow-[0_24px_70px_rgba(11,18,32,0.16)] transition-all duration-300 md:absolute md:left-0 md:right-0 md:top-[calc(100%-1px)] ${
          isHovered
            ? "max-h-[560px] translate-y-0 opacity-100"
            : "max-h-0 -translate-y-2 opacity-0"
        }`}
      >
        <ul className="space-y-3 p-5">
          {details.map((detail, index) => (
            <li key={index} className="flex gap-3 text-sm leading-relaxed text-slate-700">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#20A875]" />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
};

export default OwnershipCard;
