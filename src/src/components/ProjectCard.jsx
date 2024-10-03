import React, { useState } from "react";
import { FaGithub } from "react-icons/fa";

function ProjectCard({ title, techStack, bullets, github, logo }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div className="w-full h-[80vh] perspective">
      <div
        className={`relative w-full h-full transition-transform duration-500 transform-style-preserve-3d cursor-pointer ${
          isFlipped ? "rotate-y-180" : ""
        }`}
        onClick={handleFlip}
      >
        <div className="absolute w-full h-full backface-hidden bg-[#FFD700] bg-opacity-60 rounded-lg shadow-md p-6 flex flex-col">
          <a
            href={github}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2 right-2 flex items-center text-gray-600 hover:text-gray-800 z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <FaGithub className="mr-1" />
            <span>Source Code</span>
          </a>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex-shrink-0">
              <div className="flex items-center mb-4">
                <h2 className="text-2xl font-bold mr-2 mt-4">{title}</h2>
              </div>
              <p className="text-gray-600 font-bold mb-4">{techStack}</p>
            </div>
            <div className="flex-grow relative">
              <div
                className="absolute inset-0 bg-no-repeat bg-center bg-contain pointer-events-none"
                style={{
                  backgroundImage: `url(${logo})`,
                }}
              ></div>
            </div>
          </div>
          <p className="relative z-10 text-sm text-gray-500 mt-2">
            Click to see details
          </p>
        </div>

        <div className="absolute w-full h-full backface-hidden bg-[#FFD700] bg-opacity-60 rounded-lg shadow-md p-6 flex flex-col rotate-y-180">
          <h3 className="text-xl font-semibold mb-4">Project Details</h3>
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
          <p className="text-sm text-gray-500 mt-4">Click to flip back</p>
        </div>
      </div>
    </div>
  );
}
export default ProjectCard;