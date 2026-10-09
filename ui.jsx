import { useEffect, useId, useRef } from "react";
import { STATION_ART } from "./assets.js";
import { Icon } from "./icons.jsx";
import { Toast, modalClosed, modalOpened } from "./components/Toast.jsx";
import { track } from "./analytics.js";

export { Icon };

// For a popover menu's onToggle: move focus to its first item when it opens,
// so keyboard and screen-reader users land inside it (the platform returns
// focus to the button when it closes).
export function focusFirstItem(e) {
  if (e.newState === "open") {
    e.currentTarget.querySelector("button, a")?.focus({ preventScroll: true });
  }
}

// A ref that keeps a CSS variable on the page set to the element's height
// while it is shown (a banner), so layouts below can make room for it.
export const heightVar = (name) => (el) => {
  if (!el) return;
  const root = document.documentElement;
  const set = () => root.style.setProperty(name, `${el.offsetHeight}px`);
  set();
  const observer = new ResizeObserver(set);
  observer.observe(el);
  return () => {
    observer.disconnect();
    root.style.removeProperty(name);
  };
};

// "World Cafe", "World Cafe and Funky Friday", "World Cafe, Funky Friday and 2 more".
export const nameList = (names) =>
  names.length <= 2
    ? names.join(" and ")
    : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;

// The station's lettering. As in WXPN's own logo, the "w" is set lighter so
// "xpn" carries the name. Other text is shown as is.
export function Wordmark({ text = "wxpn", dot = false }) {
  const split = /^w(?=xpn)/i.test(text);
  return (
    <span className="wordmark" aria-hidden="true">
      {split ? (
        <>
          <span className="wordmark-w">{text[0]}</span>
          {text.slice(1)}
        </>
      ) : (
        text
      )}
      {dot && <span className="wordmark-dot">.</span>}
    </span>
  );
}

// Artwork that falls back to the station mark when a feed image is missing
// or fails to load, so a row never shows a broken-image icon.
export function Art({ src, alt = "", className = "", ...props }) {
  return (
    <img
      src={src || STATION_ART}
      alt={alt}
      className={className}
      decoding="async"
      onError={(e) => {
        // Once only: if the station mark itself fails, it stays failed
        // rather than retrying forever.
        const img = e.currentTarget;
        if ("fallback" in img.dataset) return;
        img.dataset.fallback = "";
        img.src = STATION_ART;
      }}
      {...props}
    />
  );
}

// Native dialog provides focus containment, Escape dismissal, and a modal backdrop.
// Without `onClose` it can't be dismissed (no Close key, Escape or backdrop).
export function Modal({ title, children, onClose, className = "", style }) {
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement;
    el.showModal();
    modalOpened();
    // Start at the title, so a screen reader reads the sheet from the top
    // and no button opens already outlined.
    el.querySelector(".dialog-title")?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      modalClosed();
      el.close();
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`detail-dialog ${className}`}
      style={style}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
          onClose?.();
      }}
    >
      <div className="dialog-header">
        <h2 id={id} className="dialog-title" tabIndex={-1}>
          {title}
        </h2>
        {onClose && (
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        )}
      </div>
      {children}
      <Toast inModal />
    </dialog>
  );
}
// One choice among a few. "tabs" (underlined) switches between views of a
// screen, or the station; "pill" (a joined row of keys) picks a setting.
export function Segmented({
  value,
  onChange,
  options,
  label,
  variant = "tabs",
  className = "",
  disabled = false,
}) {
  return (
    <div
      className={`segmented ${variant === "pill" ? "segmented-pill" : ""} ${className}`}
      role="group"
      aria-label={label}
    >
      {options.map((option) => {
        const o = typeof option === "string" ? { value: option, label: option } : option;
        return (
          <button
            key={o.value}
            aria-pressed={value === o.value}
            className={value === o.value ? "active" : ""}
            disabled={disabled}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
export function Empty({ icon, title, children, action, onAction }) {
  return (
    <div className="empty-state">
      <Icon name={icon} size={32} />
      <h2>{title}</h2>
      <p>{children}</p>
      {action && (
        <button className="secondary-button" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}
export function SearchField({ value, onChange, placeholder }) {
  const input = useRef(null);
  const id = useId();
  return (
    <div className="search-field">
      <label className="sr-only" htmlFor={id}>
        {placeholder}
      </label>
      <Icon name="search" size={18} />
      <input
        id={id}
        ref={input}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      {value && (
        <button
          className="icon-button search-clear"
          aria-label={`Clear ${placeholder}`}
          onClick={() => {
            onChange("");
            input.current?.focus();
          }}
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}
// A row that leads to a page on the web: an icon, a line and a note, and
// the chevron every row that goes somewhere carries.
export function PromptLink({ href, icon, title, note }) {
  return (
    <a className="playlist-prompt newsletter-prompt" href={href} target="_blank" rel="noreferrer">
      <Icon name={icon} size={18} />
      <span>
        <strong>{title}</strong>
        <small>{note}</small>
      </span>
      <Icon name="chev" size={16} />
    </a>
  );
}

// Native share sheet where there is one, the clipboard otherwise.
export async function shareText(title, text, url) {
  try {
    if (navigator.share) {
      await navigator.share(url ? { title, text, url } : { title, text });
      track("share", { method: "share_sheet" });
      return "Shared.";
    }
    if (!navigator.clipboard) return "Sharing is not available in this browser.";
    await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
    track("share", { method: "clipboard" });
    return "Copied to clipboard.";
  } catch (error) {
    return error.name === "AbortError" ? "" : "Sharing is unavailable. Please try again.";
  }
}

// A setting with a few choices: its name, then the choices side by side, so
// every option is visible and one tap away (no dropdown to open).
export function ChoiceSetting({ label, value, onChange, options, disabled = false }) {
  return (
    <div className="setting-choice">
      <span className="setting-choice-label" aria-hidden="true">
        {label}
      </span>
      <Segmented
        label={label}
        variant="pill"
        value={value}
        onChange={onChange}
        options={options}
        disabled={disabled}
      />
    </div>
  );
}

// An on/off switch. `label` names it, or `labelledBy` and `describedBy` point
// at the words beside it.
export function Switch({ on, onChange, label, labelledBy, describedBy }) {
  return (
    <button
      className={`switch ${on ? "checked" : ""}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
  );
}
