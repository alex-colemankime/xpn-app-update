import { LOGO_VIEWBOX, LOGO_W, LOGO_XPN } from "../station-logo.js";

// WXPN's own logo (station-logo.js). Decorative: what it sits in names it
// ("WXPN home").
export function StationLogo({ className = "" }) {
  return (
    <svg
      className={`station-logo ${className}`}
      viewBox={LOGO_VIEWBOX}
      fill="currentColor"
      fillRule="evenodd"
      aria-hidden="true"
    >
      <path className="station-logo-w" d={LOGO_W} />
      {LOGO_XPN.map((d) => (
        <path key={d.slice(0, 12)} d={d} />
      ))}
    </svg>
  );
}
