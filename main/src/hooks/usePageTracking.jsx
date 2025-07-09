import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function usePageTracking() {
  const location = useLocation()
  useEffect(() => {
    if (window.gtag) {
      window.gtag("event", "page_view", {
        page_path: location.pathname + location.search,
        send_to: process.env.REACT_APP_GA_MEASUREMENT_ID,
      });
    }
  }, [location]);
}
