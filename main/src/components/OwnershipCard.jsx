import React, { useState } from "react";

const OwnershipCard = ({ title, summary, icon, details }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative rounded-xl p-6 cursor-default
        border transition-all duration-500 ease-out
        backdrop-blur-md
        ${isHovered
          ? "bg-white/60 border-white/80 shadow-lg -translate-y-1"
          : "bg-white/30 border-white/40 shadow-sm"
        }
      `}
      style={{ minHeight: isHovered ? "auto" : "160px" }}
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

      {/* Detail bullets — revealed on hover */}
      <div
        className={`
          overflow-hidden transition-all duration-500 ease-out
          ${isHovered ? "max-h-[500px] opacity-100 mt-4" : "max-h-0 opacity-0 mt-0"}
        `}
      >
        <div className="border-t border-gray-300/50 pt-3">
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
  );
};

export default OwnershipCard;