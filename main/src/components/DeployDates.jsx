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

  const siteUrl = "https://waffy.netlify.app/ai-summary.html";

  return (
    <div className="mt-6 text-center text-gray-700">
      <p>Created: {firstDate}</p>
      <p>Last Updated: {lastDate}</p>

      {/* AI Summary Section */}
      <div className="mt-2 text-sm text-gray-600">
        <p>Ask an AI to summarize this site</p>
        <div className="flex justify-center gap-3 mt-1">
          <a
            href={`https://chat.openai.com/?q=Summarize%20${siteUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            ChatGPT
          </a>
          <a
            href={`https://claude.ai/?q=Summarize%20${siteUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Claude
          </a>
        </div>
      </div>
    </div>
  );
}

export default DeployDates;
