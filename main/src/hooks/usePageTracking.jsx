import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function usePageTracking() {
  const location = useLocation()
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID

  useEffect(() => {
    if (window.gtag && measurementId) {
      window.gtag("event", "page_view", {
        page_path: location.pathname + location.search,
        send_to: measurementId,
      });
    }
  }, [location, measurementId]);
}
