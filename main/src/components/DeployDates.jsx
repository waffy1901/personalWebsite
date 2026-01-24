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

  const siteUrl = "https://waffy.netlify.app/ai-summary.txt";
  const year = new Date().getFullYear();

  return (
    <div className="mt-3 text-center text-gray-700">
      <p>Created: {firstDate}</p>
      <p>Last Updated: {lastDate}</p>

      <div className="mt-1 text-sm text-gray-600">
        <p>Ask an AI to summarize this site</p>
        <div className="flex justify-center gap-4 mt-1">
          <a
            href={`https://chat.openai.com/?q=Summarize%20${siteUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Summarize with ChatGPT"
          >
            <img
              src="/logos/chatgpt.svg"
              alt="ChatGPT"
              className="h-6 w-6 opacity-80 hover:opacity-100 transition"
            />
          </a>

          <a
            href={`https://claude.ai/?q=Summarize%20${siteUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Summarize with Claude"
          >
            <img
              src="/logos/claude.svg"
              alt="Claude"
              className="h-6 w-6 opacity-80 hover:opacity-100 transition"
            />
          </a>
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-500">
        © {year} Waffy Ahmed
      </p>
    </div>
  );
}

export default DeployDates;
