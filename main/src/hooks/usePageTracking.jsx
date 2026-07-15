import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { initializeAnalytics, trackEvent } from "../utils/analytics";

export default function usePageTracking() {
  const { pathname } = useLocation()
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID

  useEffect(() => {
    if (!measurementId) {
      return;
    }

    initializeAnalytics(measurementId)
    trackEvent("page_view", {
      page_location: `${window.location.origin}${pathname}`,
      page_path: pathname,
      page_title: document.title,
    });
  }, [measurementId, pathname]);
}
