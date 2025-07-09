import React, { useState } from "react";
const ExperienceCard = ({ title, company, location, date, bullets, logo, color}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  return (
    <div className="w-full h-[40vh] perspective">
      <div
        className={`relative w-full h-full transition-transform duration-500 transform-style-preserve-3d cursor-pointer ${
          isFlipped ? "rotate-y-180" : ""
        }`}
        onClick={handleFlip}
      >
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
              style={{
                backgroundImage: `url(${logo})`,
              }}
            ></div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Click to see details
          </p>
        </div>

        <div className={`absolute w-full h-full backface-hidden ${color} bg-opacity-85 rounded-lg shadow-md p-4 flex flex-col rotate-y-180`}>
          <h3 className="text-xl font-semibold mb-4">Experience Details</h3>
          <div className="flex-1 overflow-y-auto pr-2">
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
};
export default ExperienceCard;