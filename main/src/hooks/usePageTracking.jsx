import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ANALYTICS_SCRIPT_ID = "google-analytics-script";

export default function usePageTracking() {
  const location = useLocation()
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID

  useEffect(() => {
    if (!measurementId) {
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function gtag() {
        window.dataLayer.push(arguments);
      };

    if (!document.getElementById(ANALYTICS_SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = ANALYTICS_SCRIPT_ID;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
        measurementId
      )}`;
      document.head.appendChild(script);
    }

    if (window.__portfolioGaInitialized !== measurementId) {
      window.gtag("js", new Date());
      window.gtag("config", measurementId, { send_page_view: false });
      window.__portfolioGaInitialized = measurementId;
    }

    window.gtag("event", "page_view", {
      page_path: location.pathname + location.search,
      send_to: measurementId,
    });
  }, [location, measurementId]);
}
