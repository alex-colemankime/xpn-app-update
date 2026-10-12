import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { closeHoldMenu, getHoldMenu, subscribeHoldMenu } from "../hold.js";
import { useSheetDrag } from "../hooks/useSheetDrag.js";

// The menu a press and hold opens (hold.js): a sheet from the bottom, over
// whatever is in front. A tap outside it, Escape, Back or a pull down
// closes it, as they close the other menus.
export function HoldMenu() {
  const menu = useSyncExternalStore(subscribeHoldMenu, getHoldMenu, () => null);
  const ref = useRef(null);
  const drag = useSheetDrag({ anyWidth: true });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!menu || !el) return;
    try {
      el.showPopover();
    } catch {
      return; // no popovers in this web view
    }
    // Focus goes to the menu itself, so a screen reader reads it from the
    // top and no choice opens already outlined.
    el.focus({ preventScroll: true });
    // A touch or click outside it (on its shade, too) closes it.
    const outside = (e) => {
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
        closeHoldMenu();
    };
    const key = (e) => e.key === "Escape" && closeHoldMenu();
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", key, true);
    window.addEventListener("hashchange", closeHoldMenu);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("hashchange", closeHoldMenu);
      try {
        el.hidePopover();
      } catch {
        // already hidden
      }
    };
  }, [menu]);
  // Closed some other way (Back, a pull down): forget it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const toggled = (e) => e.newState === "closed" && closeHoldMenu();
    el.addEventListener("toggle", toggled);
    return () => el.removeEventListener("toggle", toggled);
  }, [menu]);
  if (!menu) return null;
  return createPortal(
    <div
      ref={(el) => {
        ref.current = el;
        return drag(el);
      }}
      className="popover-menu hold-menu"
      popover="manual"
      role="dialog"
      tabIndex={-1}
      aria-label={menu.label}
    >
      {menu.render(closeHoldMenu)}
    </div>,
    menu.container,
  );
}
