import React, { useState } from "react";
import { portfolioUrls } from "../data/profile";

function DeployDates({ first }) {
  const [copiedProvider, setCopiedProvider] = useState(null);
  const [localPreviewDate] = useState(() => new Date());

  const firstDate = new Date(first).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const isDevPreview = import.meta.env.DEV;
  const lastDeployEnv = import.meta.env.VITE_DEPLOY_DATE;
  const lastDate = isDevPreview
    ? localPreviewDate.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : lastDeployEnv
    ? new Date(lastDeployEnv).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Unknown";

  const year = new Date().getFullYear();

  const prompt = `Summarize ${portfolioUrls.aiSummary}`;

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
      } catch {
        console.error("Clipboard copy failed");
      }

      window.open(provider.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <footer className="mc-panel-dark mt-4 flex flex-col gap-4 p-4 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between">
      <div className="grid gap-1">
        <p>
          <span className="font-black text-white">Created:</span> {firstDate}
        </p>
        <p>
          <span className="font-black text-white">Last updated:</span> {lastDate}
        </p>
        <p className="text-xs text-slate-500">© {year} Waffy Ahmed</p>
      </div>

      <div className="flex items-center gap-3">
        <p className="text-xs font-black uppercase text-[#93B4FF]">AI brief</p>
        <div className="flex gap-2">
          {AI_PROVIDERS.map((provider) => (
            <div key={provider.name} className="group relative flex items-center">
              <button
                type="button"
                onClick={() => handleAIAction(provider)}
                aria-label={provider.label}
                className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/10 transition hover:border-[#2563EB] hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2 focus:ring-offset-[#0B1220]"
              >
                <img
                  src={provider.icon}
                  alt=""
                  aria-hidden="true"
                  className="h-5 w-5 opacity-90"
                />
              </button>

              <div className="pointer-events-none absolute right-0 top-full mt-2">
                <span
                  className={`whitespace-nowrap rounded bg-white px-2 py-1 text-xs font-bold text-slate-700 shadow-sm transition-all duration-150 ${
                    copiedProvider === provider.name
                      ? "translate-y-0 opacity-100"
                      : "translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
                  }`}
                >
                  {copiedProvider === provider.name
                    ? "Copied"
                    : provider.name === "chatgpt"
                    ? "ChatGPT"
                    : "Claude"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}

export default DeployDates;
