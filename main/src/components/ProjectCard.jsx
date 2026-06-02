import React, { useId, useState } from "react";
import { FaArrowLeft, FaGithub, FaInfoCircle } from "react-icons/fa";

function ProjectCard({ title, techStack, bullets, github, logo }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const cardId = useId();
  const titleId = `${cardId}-title`;
  const detailsId = `${cardId}-details`;
  const cardTransform = isFlipped ? "rotateY(180deg)" : "rotateY(0deg)";
  const faceStyle = {
    WebkitBackfaceVisibility: "hidden",
    backfaceVisibility: "hidden",
  };

  return (
    <article className="w-full min-h-[27rem] perspective">
      <div
        className="relative min-h-[27rem] w-full transform-style-preserve-3d transition-transform duration-500 will-change-transform"
        style={{
          WebkitTransform: cardTransform,
          WebkitTransformStyle: "preserve-3d",
          transform: cardTransform,
          transformStyle: "preserve-3d",
        }}
      >
        <div
          aria-hidden={isFlipped}
          className={`absolute inset-0 flex flex-col overflow-hidden rounded-lg bg-[#FFD700] bg-opacity-60 p-6 shadow-md backface-hidden ${
            isFlipped ? "pointer-events-none" : ""
          }`}
          style={faceStyle}
        >
          <a
            href={github}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={isFlipped ? -1 : 0}
            className="absolute top-2 right-2 flex items-center text-gray-600 hover:text-gray-800 z-20"
          >
            <FaGithub className="mr-1" />
            <span>Source Code</span>
          </a>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex-shrink-0">
              <div className="flex items-center mb-4">
                <h2 id={titleId} className="text-2xl font-bold mr-2 mt-4">{title}</h2>
              </div>
              <p className="text-gray-600 font-bold mb-4">{techStack}</p>
            </div>
            <div className="flex flex-1 items-center justify-center py-5">
              <img
                src={logo}
                alt=""
                aria-hidden="true"
                className="max-h-40 max-w-[78%] object-contain"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsFlipped(true)}
            tabIndex={isFlipped ? -1 : 0}
            aria-label={`Show details for ${title}`}
            aria-expanded={isFlipped}
            aria-controls={detailsId}
            className="relative z-10 mt-auto inline-flex w-full items-center justify-center rounded bg-white/85 px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 sm:w-fit sm:justify-start sm:py-2"
          >
            <FaInfoCircle className="mr-2" />
            Details
          </button>
        </div>

        <div
          id={detailsId}
          role="region"
          aria-hidden={!isFlipped}
          aria-labelledby={`${detailsId}-heading`}
          className={`absolute inset-0 flex flex-col overflow-hidden rounded-lg bg-[#FFD700] bg-opacity-60 p-6 shadow-md backface-hidden rotate-y-180 ${
            isFlipped ? "" : "pointer-events-none"
          }`}
          style={{
            ...faceStyle,
            WebkitTransform: "rotateY(180deg)",
            transform: "rotateY(180deg)",
          }}
        >
          <h3 id={`${detailsId}-heading`} className="text-xl font-semibold mb-4">Project Details</h3>
          <div className="flex-grow max-h-full overflow-y-auto pr-2">
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
            aria-label={`Hide details for ${title}`}
            className="mt-4 inline-flex w-full items-center justify-center rounded bg-white/85 px-4 py-3 text-sm font-bold text-gray-700 shadow-sm transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 sm:w-fit sm:justify-start sm:py-2"
          >
            <FaArrowLeft className="mr-2" />
            Back
          </button>
        </div>
      </div>
    </article>
  );
}
export default ProjectCard;
