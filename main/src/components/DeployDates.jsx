import React, { useState } from "react";

function DeployDates({ first }) {
  const [copiedProvider, setCopiedProvider] = useState(null);

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

  const prompt = `Summarize ${siteUrl}`;

  /**
   * AI Provider Configuration
   */
  const AI_PROVIDERS = [
    {
      name: "chatgpt",
      label: "Summarize with ChatGPT",
      icon: "/logos/chatgpt.svg",
      type: "prefill",
      url: `https://chat.openai.com/?q=${encodeURIComponent(prompt)}`,
    },
    {
      name: "claude",
      label: "Summarize with Claude",
      icon: "/logos/claude.svg",
      type: "copyThenOpen",
      url: "https://claude.ai",
    },
  ];

  /**
   * Unified action handler
   */
  const handleAIAction = async (provider) => {
    if (provider.type === "prefill") {
      window.open(provider.url, "_blank", "noopener,noreferrer");
      return;
    }

    if (provider.type === "copyThenOpen") {
      try {
        await navigator.clipboard.writeText(prompt);
        setCopiedProvider(provider.name);
        setTimeout(() => setCopiedProvider(null), 900);
      } catch (err) {
        console.error("Clipboard copy failed");
      }

      window.open(provider.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div className="mt-3 text-center text-gray-700">
      <p>Created: {firstDate}</p>
      <p>Last Updated: {lastDate}</p>

      {/* AI Summary Section */}
      <div className="mt-2 text-sm text-gray-600">
        <p>View an AI-generated summary of this portfolio</p>

        <div className="flex justify-center gap-6 mt-2">
          {AI_PROVIDERS.map((provider) => (
            <div
              key={provider.name}
              className="relative flex flex-col items-center group"
            >
              <button
                onClick={() => handleAIAction(provider)}
                aria-label={provider.label}
                className="transition-transform hover:scale-110"
              >
                <img
                  src={provider.icon}
                  alt={provider.label}
                  className="h-6 w-6 opacity-80 hover:opacity-100 transition"
                />
              </button>

              {/* Tooltip */}
              <div className="absolute top-full mt-2 pointer-events-none">
                <span
                  className={`whitespace-nowrap text-xs bg-white/95 text-gray-700
                  px-2 py-1 rounded shadow-sm transition-all duration-150
                  ${
                    copiedProvider === provider.name
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0"
                  }`}
                >
                  {copiedProvider === provider.name
                    ? "Copied!"
                    : provider.name === "chatgpt"
                    ? "ChatGPT"
                    : "Claude"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        © {year} Waffy Ahmed
      </p>
    </div>
  );
}

export default DeployDates;