import { useEffect } from "react";

// While the big controls are on screen, the phone layout hides the mini
// player, which would only repeat them; it slides back once they scroll away.
export function useHeroVisibility(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const root = document.documentElement;
    let observer;
    const nav = document.querySelector(".mobile-nav");
    const observe = () => {
      observer?.disconnect();
      // The tab bar covers part of the viewport. The mini player steps aside
      // as soon as the full main transport fits above the navigation.
      const bottom = nav?.offsetHeight || 0;
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.99)
            root.dataset.heroVisible = "";
          else delete root.dataset.heroVisible;
        },
        { rootMargin: `0px 0px -${bottom}px 0px`, threshold: [0, 0.99, 1] },
      );
      observer.observe(el);
    };
    observe();
    const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(observe) : null;
    if (nav) resize?.observe(nav);
    window.addEventListener("resize", observe);
    return () => {
      observer?.disconnect();
      resize?.disconnect();
      window.removeEventListener("resize", observe);
      delete root.dataset.heroVisible;
    };
  }, [ref]);
}
