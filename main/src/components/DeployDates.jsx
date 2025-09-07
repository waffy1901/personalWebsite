import React from "react";

function DeployDates({ first }) {
  const firstDate = new Date(first).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const lastDeployEnv = process.env.REACT_APP_DEPLOY_DATE;
  const lastDate = lastDeployEnv
    ? new Date(lastDeployEnv).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Unknown";

  return (
    <div className="mt-6 text-center text-gray-700">
      <p>Created: {firstDate}</p>
      <p>Last Updated: {lastDate}</p>
    </div>
  );
}

export default DeployDates;
