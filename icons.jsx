// The app's single icon set. Every icon draws in currentColor, so it follows
// the text color of whatever it sits in, in both themes. Each entry is
// [svg attributes, shapes]; stroke weights are kept per icon because the
// set mixes fine outline icons with heavier small marks (chevrons, close).

const outline = (strokeWidth, extra = {}) => ({
  fill: "none",
  stroke: "currentColor",
  strokeWidth,
  ...extra,
});
const rounded = { strokeLinecap: "round", strokeLinejoin: "round" };
const roundCaps = { strokeLinecap: "round" };
const solid = { fill: "currentColor" };

// The five screens' glyphs (the tab bar and sidebar) share one stroke. Each
// has a filled twin for the screen that is shown, as the platforms' own tab
// bars do; a twin covers the same outline, so choosing a tab fills its glyph
// without moving or resizing it.
const NAV_STROKE = 1.75;

const HEART =
  "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z";
const HEADBAND = "M3 14v-3a9 9 0 0 1 18 0v3";
const BROADCAST = (
  <>
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    <path d="M16.24 7.76a6 6 0 010 8.49M7.76 16.24a6 6 0 010-8.49" />
    <path d="M19.07 4.93a10 10 0 010 14.14M4.93 19.07a10 10 0 010-14.14" />
  </>
);

const ICONS = {
  // Social platforms, for the station's accounts (links.js SOCIAL).
  instagram: [
    outline(1.8, rounded),
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" stroke="none" />
    </>,
  ],
  facebook: [
    solid,
    <path d="M13.5 21v-7.2h2.4l.4-2.8h-2.8V9.2c0-.8.2-1.4 1.4-1.4h1.5V5.3c-.3 0-1.1-.1-2.1-.1-2.1 0-3.6 1.3-3.6 3.7V11H8.3v2.8h2.4V21h2.8z" />,
  ],
  youtube: [
    solid,
    <path d="M21.6 7.2a2.5 2.5 0 00-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 002.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 001.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 001.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z" />,
  ],
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
  airplay: [
    outline(1.8, rounded),
    <>
      <path d="M5 17H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-1" />
      <path d="M12 15l5 6H7z" />
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
    outline(NAV_STROKE, rounded),
    <>
      <path d={HEADBAND} />
      <rect x="3" y="12" width="4" height="8" rx="2" />
      <rect x="17" y="12" width="4" height="8" rx="2" />
    </>,
  ],
  // Chosen: the cups filled, the band as it was.
  headphonesF: [
    outline(NAV_STROKE, rounded),
    <>
      <path d={HEADBAND} />
      <rect x="3" y="12" width="4" height="8" rx="2" fill="currentColor" />
      <rect x="17" y="12" width="4" height="8" rx="2" fill="currentColor" />
    </>,
  ],
  heart: [outline(NAV_STROKE), <path d={HEART} />],
  mail: [
    outline(1.7, rounded),
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </>,
  ],
  // Saved, and Favorites while it is shown: filled out to the outline's
  // outer edge (its stroke drawn in the fill's color), so a heart keeps its
  // size as it is saved or chosen.
  heartF: [{ ...outline(NAV_STROKE), fill: "currentColor" }, <path d={HEART} />],
  // Filter: three lines, each shorter, as a funnel.
  filter: [outline(2, roundCaps), <path d="M4 7h16M7 12h10M10 17h4" />],
  // Privacy: a shield with a check.
  shield: [
    outline(1.7, rounded),
    <>
      <path d="M12 3 5 6v5.5c0 4.3 2.9 8 7 9.5 4.1-1.5 7-5.2 7-9.5V6l-7-3z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>,
  ],
  // Opens elsewhere (another app, the web): an arrow out of the corner.
  out: [outline(1.8, rounded), <path d="M7 17L17 7M9 7h8v8" />],
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
    outline(NAV_STROKE, roundCaps),
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 2v4M16 2v4M3 9h18" />
    </>,
  ],
  // Chosen: the page filled out to the outline's outer edge, the line under
  // its top left open, the rings standing up from it.
  navConcertsF: [
    outline(NAV_STROKE, roundCaps),
    <>
      <path
        d="M5 3.125h14a2.875 2.875 0 0 1 2.875 2.875v2.125H2.125V6A2.875 2.875 0 0 1 5 3.125zM2.125 9.875h19.75V19a2.875 2.875 0 0 1-2.875 2.875H5A2.875 2.875 0 0 1 2.125 19z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M8 2v4M16 2v4" />
    </>,
  ],
  video: [
    outline(NAV_STROKE, rounded),
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="3" />
      <path d="M10 9.3v5.4l4.6-2.7z" fill="currentColor" />
    </>,
  ],
  // Chosen: the screen filled out to the outline's outer edge, the play mark
  // cut out of it at the size it is drawn above.
  videoF: [
    { ...solid, fillRule: "evenodd" },
    <path d="M5.5 4.125h13a3.875 3.875 0 0 1 3.875 3.875v8a3.875 3.875 0 0 1-3.875 3.875h-13A3.875 3.875 0 0 1 1.625 16V8A3.875 3.875 0 0 1 5.5 4.125zM9.125 9.3v5.4a.875.875 0 0 0 1.318.755l4.6-2.7a.875.875 0 0 0 0-1.51l-4.6-2.7A.875.875 0 0 0 9.125 9.3z" />,
  ],
  navLive: [outline(NAV_STROKE, roundCaps), BROADCAST],
  // Chosen: the same waves, heavier, around the filled center.
  navLiveF: [outline(2.25, roundCaps), BROADCAST],
  pause: [
    solid,
    <>
      <rect x="6.5" y="5" width="4.2" height="14" rx="2.1" />
      <rect x="13.3" y="5" width="4.2" height="14" rx="2.1" />
    </>,
  ],
  // A softly rounded triangle whose weight sits on the center, so it needs
  // no nudging to look centered in a round key.
  play: [
    solid,
    <path d="M8 6.2c0-1.13 1.23-1.83 2.2-1.25l9.4 5.8c.92.57.92 1.92 0 2.5l-9.4 5.8C9.23 19.63 8 18.93 8 17.8V6.2z" />,
  ],
  plus: [outline(2, rounded), <path d="M12 5v14M5 12h14" />],
  star: [
    solid,
    <path d="M12 2.8l2.75 5.6 6.15.9-4.45 4.35 1.05 6.13L12 16.9l-5.5 2.88 1.05-6.13L3.1 9.3l6.15-.9z" />,
  ],
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
