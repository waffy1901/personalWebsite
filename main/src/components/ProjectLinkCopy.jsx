import React, { useState } from "react";

export default function ProjectLinkCopy({ id, title }) {
  const [status, setStatus] = useState(null);
  const url = new URL(`/projects/#${id}`, window.location.origin).href;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={copyLink}
        aria-label={`Copy link to ${title}`}
        className="mc-button-primary py-3 sm:py-2"
      >
        Copy link
      </button>
      <p role="status" className="text-sm">
        {status === "copied" ? "Project link copied." : null}
        {status === "failed" ? "Copy failed. Select the link and copy it manually." : null}
      </p>
      {status === "failed" ? (
        <input
          aria-label={`Link to ${title}`}
          className="mt-2 w-full min-w-0 rounded-md border border-slate-500 bg-white px-3 py-2 text-sm text-[#0B1220] focus:outline-2 focus:outline-[#2563EB]"
          value={url}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}
    </div>
  );
}
