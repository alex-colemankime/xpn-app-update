// The app's single icon set. Every icon draws in currentColor, so it follows
// the text color of whatever it sits in, in both themes. Each entry is
// [svg attributes, shapes]; stroke weights are kept per icon because the
// set mixes fine outline icons with heavier navigation glyphs.

const outline = (strokeWidth, extra = {}) => ({
  fill: "none",
  stroke: "currentColor",
  strokeWidth,
  ...extra,
});
const rounded = { strokeLinecap: "round", strokeLinejoin: "round" };
const roundCaps = { strokeLinecap: "round" };
const solid = { fill: "currentColor" };

const HEART =
  "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z";

const ICONS = {
  arrowUp: [outline(1.7, rounded), <path d="M6 18 18 6M6 6h12v12" />],
  back: [outline(2.5, roundCaps), <path d="M15 18l-6-6 6-6" />],
  // Skip keys for archive episodes: a circling arrow with the seconds inside.
  back15: [
    outline(1.7, rounded),
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.2 3.6v3.6h3.6" />
      <text
        x="12.4"
        y="15.3"
        fill="currentColor"
        stroke="none"
        fontSize="7.6"
        fontWeight="700"
        textAnchor="middle"
        fontFamily="inherit"
      >
        15
      </text>
    </>,
  ],
  ahead30: [
    outline(1.7, rounded),
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.8 3.6v3.6h-3.6" />
      <text
        x="11.6"
        y="15.3"
        fill="currentColor"
        stroke="none"
        fontSize="7.6"
        fontWeight="700"
        textAnchor="middle"
        fontFamily="inherit"
      >
        30
      </text>
    </>,
  ],
  cast: [
    outline(1.8, roundCaps),
    <>
      <path d="M2 16.1A5 5 0 015.9 20M2 12.05A9 9 0 019.95 20M2 8V6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2h-6" />
      <line x1="2" y1="20" x2="2.01" y2="20" strokeWidth="3" />
    </>,
  ],
  bell: [
    outline(1.7, rounded),
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />,
  ],
  check: [outline(2, rounded), <path d="m5 12 4.5 4.5L19 7" />],
  chev: [outline(2.5, roundCaps), <path d="M9 18l6-6-6-6" />],
  chevD: [outline(2, roundCaps), <path d="M6 9l6 6 6-6" />],
  clock: [
    outline(1.7, rounded),
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
  ],
  close: [outline(2, roundCaps), <path d="M6 6l12 12M18 6 6 18" />],
  headphones: [
    outline(1.7, rounded),
    <>
      <path d="M3 14v-3a9 9 0 0 1 18 0v3" />
      <rect x="3" y="12" width="4" height="8" rx="2" />
      <rect x="17" y="12" width="4" height="8" rx="2" />
    </>,
  ],
  heart: [outline(1.8), <path d={HEART} />],
  mail: [
    outline(1.7, rounded),
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </>,
  ],
  heartF: [solid, <path d={HEART} />],
  more: [
    solid,
    <>
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </>,
  ],
  moon: [
    outline(1.8, rounded),
    <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2z" />,
  ],
  music: [
    outline(1.7, rounded),
    <>
      <path d="M9 18V5l12-2v13M9 8l12-2" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>,
  ],
  calendarAdd: [
    outline(1.8, rounded),
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 9h18M12 12.5v5M9.5 15h5" />
    </>,
  ],
  navConcerts: [
    outline(2, roundCaps),
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 9h18" />
    </>,
  ],
  video: [
    outline(2, rounded),
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="M10 9.3v5.4l4.6-2.7z" fill="currentColor" />
    </>,
  ],
  navLive: [
    outline(2, roundCaps),
    <>
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      <path d="M16.24 7.76a6 6 0 010 8.49M7.76 16.24a6 6 0 010-8.49" />
      <path d="M19.07 4.93a10 10 0 010 14.14M4.93 19.07a10 10 0 010-14.14" />
    </>,
  ],
  pause: [
    solid,
    <>
      <rect x="6.5" y="5" width="4.2" height="14" rx="2.1" />
      <rect x="13.3" y="5" width="4.2" height="14" rx="2.1" />
    </>,
  ],
  play: [
    { ...solid, stroke: "currentColor", strokeWidth: 2, strokeLinejoin: "round" },
    <path d="M8.5 5.5v13l10.5-6.5-10.5-6.5z" />,
  ],
  plus: [outline(2, rounded), <path d="M12 5v14M5 12h14" />],
  search: [
    outline(2, roundCaps),
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </>,
  ],
  settings: [
    outline(1.7, rounded),
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>,
  ],
  shareAlt: [
    outline(1.8, roundCaps),
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
    </>,
  ],
  volume: [
    outline(1.7, rounded),
    <path d="m11 5-6 4H2v6h3l6 4zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" />,
  ],
};

export function Icon({ name, size = 20 }) {
  const icon = ICONS[name];
  if (!icon) {
    // A typo should be loud while developing, not a silently wrong glyph.
    if (import.meta.env?.DEV) console.warn(`Unknown icon "${name}"`);
    return null;
  }
  const [attrs, shapes] = icon;
  return (
    <span className="icon" aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24" {...attrs}>
        {shapes}
      </svg>
    </span>
  );
}
