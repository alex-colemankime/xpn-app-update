// Placeholder content for design review: sample station updates (a member
// drive banner and a Free at Noon video). Only loaded when SHOW_SAMPLES is on
// (dev and preview builds); a production build leaves this module out
// entirely (see vite.config.js).

// In the format the station would host (updates.js).
export const SAMPLE_UPDATES = {
  updates: [
    {
      id: "sample-fall-drive",
      kind: "banner",
      text: "It’s the Fall Member Drive. Keep WXPN listener-supported.",
      action: { label: "Donate", url: "https://xpn.org/donate/" },
      starts: "2026-10-01T06:00:00-04:00",
      ends: "2026-10-17T00:00:00-04:00",
      notify: [
        {
          at: "2026-10-01T08:00:00-04:00",
          title: "The Fall Member Drive is on",
          text: "Keep WXPN listener-supported. Tap to donate.",
        },
        {
          at: "2026-10-09T08:00:00-04:00",
          title: "One week left in the Fall Member Drive",
          text: "Keep WXPN listener-supported. Tap to donate.",
        },
        {
          at: "2026-10-16T08:00:00-04:00",
          title: "Last day of the Fall Member Drive",
          text: "There’s still time to give. Tap to donate.",
        },
      ],
    },
    {
      id: "sample-fan-dawes",
      kind: "live",
      title: "Free at Noon: Dawes",
      text: "Live from The Music Hall at World Stage",
      watch: "https://www.youtube.com/@wxpn/live",
      show: "freeatnoon",
      starts: "2026-10-09T12:00:00-04:00",
      ends: "2026-10-09T13:00:00-04:00",
    },
  ],
};
