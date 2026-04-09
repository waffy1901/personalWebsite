import React, { useState } from "react";

const OwnershipCard = ({ title, items, color }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      className={`${color} rounded-lg shadow-md p-6 cursor-pointer transition-all duration-300 hover:scale-[1.01]`}
    >
      <h3 className="text-2xl font-bold mb-3 text-gray-800">
        {title}
      </h3>

      <ul className="space-y-3 text-gray-700">
        {(expanded ? items : items.slice(0, 2)).map((item, i) => (
          <li key={i} className="flex">
            <span className="mr-2">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <p className="text-sm text-gray-500 mt-4">
        {expanded ? "Click to collapse" : "Click to see scope"}
      </p>
    </div>
  );
};

export default OwnershipCard;