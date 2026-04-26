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
      className={`
        relative min-h-[190px] cursor-default overflow-visible rounded-xl outline-none
        transition-all duration-500 ease-out
        focus-visible:ring-2 focus-visible:ring-blue-600
        focus-visible:ring-offset-2 focus-visible:ring-offset-blue-300
        ${isHovered ? "z-20" : "z-0"}
      `}
    >
      <div
        className={`
          relative min-h-[190px] p-6 border backdrop-blur-md
          transition-all duration-500 ease-out
          ${isHovered
            ? "rounded-t-xl rounded-b-none bg-white/60 border-white/80 shadow-lg md:-translate-y-1"
            : "rounded-xl bg-white/30 border-white/40 shadow-sm"
          }
        `}
      >
        {/* Icon + Title */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl flex-shrink-0">{icon}</span>
          <h3 className="text-lg font-bold text-gray-800 leading-tight">
            {title}
          </h3>
        </div>

        {/* Summary line — always visible */}
        <p className="text-sm text-gray-600 leading-relaxed">
          {summary}
        </p>

        {/* Subtle hover indicator */}
        <div
          className={`
            absolute bottom-3 right-4 text-xs text-gray-400
            transition-opacity duration-300
            ${isHovered ? "opacity-0" : "opacity-100"}
          `}
        >
          Hover for details
        </div>
      </div>

      {/* Detail bullets — revealed on hover without changing desktop grid row height */}
      <div
        className={`
          relative z-30 w-full overflow-hidden rounded-b-xl border-x border-b
          border-white/80 bg-white shadow-xl backdrop-blur-md
          transition-all duration-500 ease-out
          md:absolute md:left-0 md:right-0 md:top-[calc(100%-1px)]
          ${isHovered
            ? "max-h-[520px] opacity-100 translate-y-0 pointer-events-auto"
            : "max-h-0 opacity-0 -translate-y-2 pointer-events-none"
          }
        `}
      >
        <div className="mx-6 border-t border-gray-300/50 py-4">
          <ul className="space-y-2">
            {details.map((detail, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-gray-700"
                style={{
                  transitionDelay: `${i * 60}ms`,
                  opacity: isHovered ? 1 : 0,
                  transform: isHovered ? "translateY(0)" : "translateY(8px)",
                  transition: "opacity 400ms ease, transform 400ms ease",
                }}
              >
                <span className="text-gray-400 mt-0.5 flex-shrink-0">▸</span>
                <span className="leading-relaxed">{detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
};

export default OwnershipCard;
