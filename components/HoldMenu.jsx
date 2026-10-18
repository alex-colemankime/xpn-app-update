import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { closeHoldMenu, getHoldMenu, subscribeHoldMenu } from "../hold.js";
import { useSheetDrag } from "../hooks/useSheetDrag.js";

// The menu a press and hold opens (hold.js), and a song's sheet: a sheet
// from the bottom, over whatever is in front. On wider screens, a menu that
// knows what opened it hangs from that instead, as a menu from its button.
// A tap outside it, Escape, Back or a pull down closes it, as they close
// the other menus, and focus goes back to what opened it.
const WIDE = "(min-width: 768px)";
const ANCHOR = "--hold-from";
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
    const from = menu.from;
    if (el.hasAttribute("data-anchored")) from.style.setProperty("anchor-name", ANCHOR);
    // Focus goes to the menu itself, so a screen reader reads it from the
    // top and no choice opens already outlined.
    el.focus({ preventScroll: true });
    // A touch or click outside it (on its shade, too) closes it. On what
    // opened it, that thing's own click does (hold.js).
    const outside = (e) => {
      if (from?.contains(e.target)) return;
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
      const focused =
        el.contains(document.activeElement) || document.activeElement === document.body;
      try {
        el.hidePopover();
      } catch {
        // already hidden
      }
      if (from) {
        from.style.removeProperty("anchor-name");
        if (focused && from.isConnected) from.focus({ preventScroll: true });
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
  const anchored = Boolean(
    menu.from && window.matchMedia?.(WIDE).matches && window.CSS?.supports?.("anchor-name: --a"),
  );
  return createPortal(
    <div
      ref={(el) => {
        ref.current = el;
        return drag(el);
      }}
      className="popover-menu hold-menu"
      popover="manual"
      data-anchored={anchored || undefined}
      style={anchored ? { positionAnchor: ANCHOR } : undefined}
      role="dialog"
      tabIndex={-1}
      aria-label={menu.label}
    >
      {menu.render(closeHoldMenu)}
    </div>,
    menu.container,
  );
}
