import React, { useId, useState } from "react";
import { FaArrowLeft, FaCheck, FaClipboard, FaInfoCircle } from "react-icons/fa";

const ExperienceCard = ({ title, company, location, date, bullets, logo, color }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [copyStatus, setCopyStatus] = useState(null);
  const cardId = useId();
  const titleId = `${cardId}-title`;
  const detailsId = `${cardId}-details`;

  const handleCopy = async () => {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(bullets.join("\n"));
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    } finally {
      setTimeout(() => setCopyStatus(null), 1200);
    }
  };

  return (
    <article className="w-full min-h-[23rem] perspective">
      <div
        className={`relative min-h-[23rem] w-full transition-transform duration-500 transform-style-preserve-3d ${
          isFlipped ? "rotate-y-180" : ""
        }`}
      >
        {/* Front Side */}
        <div
          aria-hidden={isFlipped}
          className={`absolute inset-0 backface-hidden ${color} bg-opacity-90 rounded-lg shadow-md p-4 flex flex-col ${
            isFlipped ? "pointer-events-none" : ""
          }`}
        >
          <div className="flex flex-col flex-shrink-0">
            <div className="flex justify-between items-center mb-2">
              <h3 id={titleId} className="text-xl font-bold text-gray-800 max-w-[60%]">{title}</h3>
              <p className="text-lg text-gray-600">{date}</p>
            </div>
            <div className="flex justify-between items-center mb-2">
              <p className="text-lg text-gray-600">{company}</p>
              <p className="text-lg text-gray-600">{location}</p>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center py-4">
            <img
              src={logo}
              alt=""
              aria-hidden="true"
              className="max-h-36 max-w-[70%] object-contain"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsFlipped(true)}
            tabIndex={isFlipped ? -1 : 0}
            aria-label={`Show details for ${title} at ${company}`}
            aria-expanded={isFlipped}
            aria-controls={detailsId}
            className="mt-auto inline-flex w-full items-center justify-center rounded bg-white/85 px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 sm:w-fit sm:justify-start sm:py-2"
          >
            <FaInfoCircle className="mr-2" />
            Details
          </button>
        </div>

        {/* Back Side */}
        <div
          id={detailsId}
          role="region"
          aria-hidden={!isFlipped}
          aria-labelledby={`${detailsId}-heading`}
          className={`absolute inset-0 backface-hidden ${color} bg-opacity-85 rounded-lg shadow-md p-4 flex flex-col rotate-y-180 ${
            isFlipped ? "" : "pointer-events-none"
          }`}
        >
          
          {/* Copy Button Top-Right */}
          <div className="absolute top-4 right-4 z-10 flex flex-col items-center group">
            <button
              type="button"
              onClick={handleCopy}
              tabIndex={isFlipped ? 0 : -1}
              aria-label={`Copy ${title} details`}
              className="p-2 rounded-full bg-white shadow-md hover:shadow-lg hover:scale-110 transform transition-all duration-200 flex items-center justify-center"
            >
              <FaClipboard
                className={`h-5 w-5 transition-opacity duration-200 ${copyStatus === "success" ? "opacity-0" : "opacity-100"}`}
              />
              <FaCheck
                className={`absolute h-5 w-5 text-green-500 transition-opacity duration-200 ${copyStatus === "success" ? "opacity-100" : "opacity-0"}`}
              />
            </button>

            {/* Tooltip */}
            <span
              className={`mt-1 text-xs text-gray-700 bg-white/90 px-2 py-1 rounded shadow-sm transform transition-all duration-200
                ${copyStatus ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"} 
                group-hover:opacity-100 group-hover:translate-y-0`}
            >
              {copyStatus === "success" ? "Copied!" : copyStatus === "error" ? "Copy failed" : "Copy"}
            </span>
          </div>

          <h3 id={`${detailsId}-heading`} className="text-xl font-semibold mb-4 mt-1 pr-14">Experience Details</h3>

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

          <button
            type="button"
            onClick={() => setIsFlipped(false)}
            tabIndex={isFlipped ? 0 : -1}
            aria-label={`Hide details for ${title} at ${company}`}
            className="mt-3 inline-flex w-full items-center justify-center rounded bg-white/85 px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 sm:w-fit sm:justify-start sm:py-2"
          >
            <FaArrowLeft className="mr-2" />
            Back
          </button>
        </div>
      </div>
    </article>
  );
};

export default ExperienceCard;
