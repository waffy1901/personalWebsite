import React from "react";

function DeployDates({ first, last }) {
  const firstDate = new Date(first).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const lastDate = new Date(last).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mt-6 text-center text-gray-700">
      <p>Created: {firstDate}</p>
      <p>Last Updated: {lastDate}</p>
    </div>
  );
}

export default DeployDates;