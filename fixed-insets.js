// The safe-area insets, measured once (and again when the width changes, as
// on rotating the phone) into --fixed-inset-top and --fixed-inset-bottom.
// In Safari the bottom inset changes as its toolbar collapses on scroll;
// sizes worked out from it (the artwork on Listen) would then grow and
// shrink while the listener scrolls. The tab bar keeps the live inset.
export function fixInsets() {
  if (typeof document === "undefined") return;
  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;" +
    "padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)";
  document.body.append(probe);
  const root = document.documentElement;
  let width = -1;
  const measure = () => {
    if (window.innerWidth === width) return;
    width = window.innerWidth;
    const { paddingTop, paddingBottom } = getComputedStyle(probe);
    root.style.setProperty("--fixed-inset-top", paddingTop);
    root.style.setProperty("--fixed-inset-bottom", paddingBottom);
  };
  measure();
  window.addEventListener("resize", measure);
}
