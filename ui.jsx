import { useEffect, useId, useRef } from "react";
import { publicAsset } from "./data.js";
import { ic } from "./icons.jsx";
const paths = {
  arrowRight: (
    <>
      <path d="M4 12h16M14 6l6 6-6 6" />
    </>
  ),
  arrowUp: (
    <>
      <path d="M6 18 18 6M6 6h12v12" />
    </>
  ),
  headphones: (
    <>
      <path d="M3 14v-3a9 9 0 0 1 18 0v3" />
      <rect x="3" y="12" width="4" height="8" rx="2" />
      <rect x="17" y="12" width="4" height="8" rx="2" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h6m4 0h6M4 17h10m4 0h2" />
      <circle cx="12" cy="7" r="2" />
      <circle cx="16" cy="17" r="2" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l12-2v13M9 8l12-2" />
      <ellipse cx="6" cy="18" rx="3" ry="3" />
      <ellipse cx="18" cy="16" rx="3" ry="3" />
    </>
  ),
  volume: (
    <>
      <path d="m11 5-6 4H2v6h3l6 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
};
export function Icon({ name, size = 20 }) {
  return (
    <span className="icon" aria-hidden="true">
      {ic[name] ? (
        ic[name](size, "currentColor")
      ) : (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {paths[name] || paths.music}
        </svg>
      )}
    </span>
  );
}

// Native dialog provides focus containment, Escape dismissal, and a modal backdrop.
export function Art({ src, alt = "", className = "", ...props }) {
  return (
    <img
      src={src || publicAsset("icons/icon-512.png")}
      alt={alt}
      className={className}
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = publicAsset("icons/icon-512.png");
      }}
      {...props}
    />
  );
}
export function Modal({ title, description, children, onClose }) {
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement;
    el.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="detail-dialog"
      aria-labelledby={id}
      aria-describedby={description ? `${id}-description` : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
          onClose();
      }}
    >
      <div className="dialog-header">
        <div>
          <span className="eyebrow">WXPN / DISCOVER</span>
          <h2 id={id}>{title}</h2>
          {description && <p id={`${id}-description`}>{description}</p>}
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close details">
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => {
        const o = typeof option === "string" ? { value: option, label: option } : option;
        return (
          <button
            key={o.value}
            aria-pressed={value === o.value}
            className={value === o.value ? "active" : ""}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
export function Empty({ icon = "heart", title, children, action, onAction }) {
  return (
    <div className="empty-state">
      <Icon name={icon} size={32} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action && (
        <button className="secondary-button" onClick={onAction}>
          {action}
          <Icon name="arrowRight" size={17} />
        </button>
      )}
    </div>
  );
}
export function SearchField({ value, onChange, placeholder, label }) {
  return (
    <label className="search-field">
      <span className="sr-only">{label || placeholder}</span>
      <Icon name="search" size={18} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
export async function shareText(title, text) {
  try {
    if (navigator.share) {
      await navigator.share({ title, text });
      return "Shared.";
    }
    if (!navigator.clipboard) return "Sharing is not available in this browser.";
    await navigator.clipboard.writeText(text);
    return "Copied to clipboard.";
  } catch (error) {
    return error.name === "AbortError" ? "" : "Sharing is unavailable. Please try again.";
  }
}
