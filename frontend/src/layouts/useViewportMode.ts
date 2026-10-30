import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 760px)";

/**
 * Selects a dedicated application shell for phones.
 * This is a layout breakpoint, not a device/user-agent sniff.
 */
export function useViewportMode(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile;
}
