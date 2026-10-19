import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { closeHoldMenu, getHoldMenu, subscribeHoldMenu } from "../hold.js";
import { useSheetDrag } from "../hooks/useSheetDrag.js";

// The menu a press and hold opens (hold.js), and a song's sheet: a sheet
// from the bottom, over whatever is in front. On wider screens, a menu that
// knows what opened it hangs from that instead, as a menu from its button.
// A tap outside it, Escape, Back, a pull down or Tab past its last choice
// closes it, as they close the other menus, and focus goes back to what
// opened it. It leaves the way it came before it is taken away.
const WIDE = "(min-width: 768px)";
const ANCHOR = "--hold-from";

// One opener at a time carries the anchor name the menu hangs from.
let anchored = null;
function anchorTo(el) {
  anchored?.style.removeProperty("anchor-name");
  anchored = el;
  el?.style.setProperty("anchor-name", ANCHOR);
}

// A tap on a sheet's shade closes the sheet and goes no further: the click
// that follows it never reaches whatever is under the shade (another song,
// a heart, play). Only that click: the next press, or a moment, lets go.
function swallowNextClick() {
  const swallow = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };
  const release = () => document.removeEventListener("click", swallow, true);
  document.addEventListener("click", swallow, { capture: true, once: true });
  document.addEventListener("pointerdown", release, { capture: true, once: true });
  setTimeout(release, 700);
}

export function HoldMenu() {
  const menu = useSyncExternalStore(subscribeHoldMenu, getHoldMenu, () => null);
  // The menu on screen: the open one, or the one just closed while it
  // leaves.
  const [shown, setShown] = useState(menu);
  if (menu && menu !== shown) setShown(menu);
  const ref = useRef(null);
  const drag = useSheetDrag({ anyWidth: true });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!menu || !el) return;
    const from = menu.from;
    const hangs = el.hasAttribute("data-anchored");
    if (hangs) anchorTo(from);
    try {
      // Its opener as its source: Tab goes on from the menu to what follows
      // the opener (engines without the option ignore it).
      // Still leaving after the last close, it is shown again as it is.
      if (!el.matches(":popover-open")) el.showPopover(from ? { source: from } : undefined);
    } catch {
      return; // no popovers in this web view
    }
    // Focus goes to the menu itself, so a screen reader reads it from the
    // top and no choice opens already outlined.
    el.focus({ preventScroll: true });
    // A touch or click outside it (on its shade, too) closes it. On what
    // opened it, that thing's own click does (hold.js).
    const outside = (e) => {
      if (from?.contains(e.target)) return;
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
        if (!hangs) swallowNextClick();
        closeHoldMenu();
      }
    };
    const key = (e) => e.key === "Escape" && closeHoldMenu();
    // Focus moving on past it (Tab after the last choice) closes it; to its
    // opener, the opener's own click decides.
    const leave = (e) => {
      const to = e.relatedTarget;
      if (to && !el.contains(to) && !from?.contains(to)) closeHoldMenu();
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", key, true);
    el.addEventListener("focusout", leave);
    window.addEventListener("hashchange", closeHoldMenu);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", key, true);
      el.removeEventListener("focusout", leave);
      window.removeEventListener("hashchange", closeHoldMenu);
    };
  }, [menu]);

  // Closed: hide it, give focus back to its opener if it had it, and take it
  // away once its closing transition has played (at once where there is
  // none).
  useEffect(() => {
    const el = ref.current;
    if (menu || !shown || !el) return;
    const from = shown.from;
    const focused = el.contains(document.activeElement) || document.activeElement === document.body;
    try {
      el.hidePopover();
    } catch {
      // already hidden
    }
    if (focused && from?.isConnected) from.focus({ preventScroll: true });
    let live = true;
    Promise.allSettled((el.getAnimations?.() || []).map((a) => a.finished)).then(() => {
      if (!live || getHoldMenu()) return;
      if (anchored === from) anchorTo(null);
      setShown(null);
    });
    return () => {
      live = false;
    };
  }, [menu, shown]);

  // Closed some other way (Back, a pull down): forget it.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const toggled = (e) => e.newState === "closed" && closeHoldMenu();
    el.addEventListener("toggle", toggled);
    return () => el.removeEventListener("toggle", toggled);
  }, [shown]);

  if (!shown) return null;
  const hangs = Boolean(
    shown.from && window.matchMedia?.(WIDE).matches && window.CSS?.supports?.("anchor-name: --a"),
  );
  return createPortal(
    <div
      ref={(el) => {
        ref.current = el;
        return drag(el);
      }}
      className="popover-menu hold-menu"
      popover="manual"
      data-anchored={hangs || undefined}
      style={hangs ? { positionAnchor: ANCHOR } : undefined}
      role="dialog"
      tabIndex={-1}
      aria-label={shown.label}
    >
      {shown.render(closeHoldMenu)}
    </div>,
    shown.container,
  );
}
