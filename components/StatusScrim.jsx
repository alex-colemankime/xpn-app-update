import { useEffect, useRef } from "react";

// Under the phone's status bar (the time, signal and battery), once the
// page scrolls: a soft band of the page's own color with the content blurred
// behind it, fading down into the page, so text scrolling up never sits
// half-covered under the clock (as in Spotify). Only where there is a
// status bar to clear (a safe area at the top); none in a browser.
export function StatusScrim() {
  const ref = useRef(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (ref.current) ref.current.dataset.on = window.scrollY > 4 ? "true" : "false";
    };
    const onScroll = () => {
      frame ||= requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return <div ref={ref} className="status-scrim" aria-hidden="true" />;
}
