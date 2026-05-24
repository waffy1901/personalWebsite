import React, { useState } from "react";

const ExperienceCard = ({ title, company, location, date, bullets, logo, color }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleFlip = () => setIsFlipped(!isFlipped);
  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleFlip();
    }
  };

  const handleCopy = (e) => {
    e.stopPropagation(); // prevent flip
    navigator.clipboard.writeText(bullets.join("\n"));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 800); // quick fade-out
  };

  return (
    <div className="w-full h-[40vh] perspective">
      <div
        className={`relative w-full h-full transition-transform duration-500 transform-style-preserve-3d cursor-pointer ${
          isFlipped ? "rotate-y-180" : ""
        }`}
        onClick={handleFlip}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-pressed={isFlipped}
        aria-label={`${isFlipped ? "Hide" : "Show"} details for ${title} at ${company}`}
      >
        {/* Front Side */}
        <div className={`absolute w-full h-full backface-hidden ${color} bg-opacity-90 rounded-lg shadow-md p-4 flex flex-col`}>
          <div className="flex flex-col flex-shrink-0">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-bold text-gray-800 max-w-[60%]">{title}</h3>
              <p className="text-lg text-gray-600">{date}</p>
            </div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-lg text-gray-600">{company}</p>
              <p className="text-lg text-gray-600">{location}</p>
            </div>
          </div>
          <div className="flex-grow relative mt-2">
            <div
              className="absolute inset-0 bg-no-repeat bg-center bg-contain"
              style={{ backgroundImage: `url(${logo})` }}
            ></div>
          </div>
          <p className="text-sm text-gray-500 mt-2">Click to see details</p>
        </div>

        {/* Back Side */}
        <div className={`absolute w-full h-full backface-hidden ${color} bg-opacity-85 rounded-lg shadow-md p-4 flex flex-col rotate-y-180 relative`}>
          
          {/* Copy Button Top-Right */}
          <div className="absolute top-4 right-4 z-10 flex flex-col items-center group">
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy experience bullets"
              className="p-2 rounded-full bg-white shadow-md hover:shadow-lg hover:scale-110 transform transition-all duration-200 flex items-center justify-center"
            >
              {/* Clipboard Icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 transition-opacity duration-200 ${copySuccess ? "opacity-0" : "opacity-100"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 4H7a2 2 0 01-2-2V7a2 2 0 012-2h3.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H17a2 2 0 012 2v11a2 2 0 01-2 2z" />
              </svg>

              {/* Checkmark Icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 absolute inset-0 text-green-400 transition-opacity duration-200 ${copySuccess ? "opacity-100" : "opacity-0"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>

            {/* Tooltip */}
            <span
              className={`mt-1 text-xs text-gray-700 bg-white/90 px-2 py-1 rounded shadow-sm transform transition-all duration-200
                ${copySuccess ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"} 
                group-hover:opacity-100 group-hover:translate-y-0`}
            >
              {copySuccess ? "Copied!" : "Copy Bullets"}
            </span>
          </div>

          <h3 className="text-xl font-semibold mb-4 mt-1">Experience Details</h3>

          {/* Scrollable bullets area */}
          <div className="flex-1 overflow-y-auto pr-2 pt-2">
            <ul className="list-none pl-0 space-y-2">
              {bullets.map((bullet, index) => (
                <li key={index} className="text-gray-700 flex">
                  <span className="mr-2 flex-shrink-0">•</span>
                  <span className="flex-1">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-gray-500 mt-2">Click to flip back</p>
        </div>
      </div>
    </div>
  );
};

export default ExperienceCard;
