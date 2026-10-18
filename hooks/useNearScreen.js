import { useCallback, useState } from "react";

// Whether an element has come near the screen (within a screen's height of
// it), and stays so once it has: for work a long list's rows can leave until
// they are about to be seen, such as reading a heart's color from its
// artwork. One observer serves every element. Where there is no
// IntersectionObserver, everything counts as near.
const callbacks = new Map();
let observer = null;
function watch(el, onNear) {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        callbacks.get(entry.target)?.();
        unwatch(entry.target);
      }
    },
    { rootMargin: "100% 0px" },
  );
  callbacks.set(el, onNear);
  observer.observe(el);
  return () => unwatch(el);
}
function unwatch(el) {
  callbacks.delete(el);
  observer?.unobserve(el);
}

// [ref, near]: put `ref` on the element.
export function useNearScreen() {
  const [near, setNear] = useState(() => typeof IntersectionObserver === "undefined");
  const ref = useCallback(
    (el) => {
      if (!el || near) return;
      return watch(el, () => setNear(true));
    },
    [near],
  );
  return [ref, near];
}
