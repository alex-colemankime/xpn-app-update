import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activeUpdates,
  alertPlan,
  LIVE_ALERT_MINUTES,
  normalizeUpdates,
  youTubeEmbed,
  LIVE_ANNOUNCE_MINUTES,
  livestreamUpdate,
} from "../updates.js";
import { airingSoon } from "../catalog.js";

const at = (iso) => Date.parse(iso);
const FILE = {
  updates: [
    {
      id: "drive",
      kind: "banner",
      text: "  The Fall Member Drive is on.  ",
      action: { label: "Donate", url: "https://xpn.org/donate/" },
      starts: "2026-10-05T06:00:00-04:00",
      ends: "2026-10-17T00:00:00-04:00",
    },
    {
      id: "fan",
      kind: "live",
      title: "Free at Noon: Wesley Stace",
      watch: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      starts: "2026-10-09T12:00:00-04:00",
      ends: "2026-10-09T13:00:00-04:00",
    },
  ],
};

test("the station's file is read, and anything malformed is ignored", () => {
  const list = normalizeUpdates({
    updates: [
      ...FILE.updates,
      { id: "no-kind", text: "x" },
      { id: "", kind: "banner", text: "x" },
      { id: "bad-date", kind: "banner", text: "x", starts: "next tuesday" },
      {
        id: "bad-link",
        kind: "banner",
        text: "x",
        action: { label: "Go", url: "javascript:alert(1)" },
      },
      { id: "live-no-start", kind: "live", title: "x", watch: "https://youtu.be/abcdefghijk" },
      null,
    ],
  });
  assert.deepEqual(
    list.map((u) => u.id),
    ["drive", "fan", "bad-link"],
  );
  assert.equal(list[0].text, "The Fall Member Drive is on.");
  assert.equal(list[2].action, null, "an unsafe link drops the button, not the message");
  assert.deepEqual(normalizeUpdates(null), []);
  assert.deepEqual(normalizeUpdates({ updates: "nope" }), []);
});

test("a banner runs between its start and end", () => {
  const list = normalizeUpdates(FILE);
  assert.equal(activeUpdates(list, at("2026-10-05T05:59:00-04:00")).banner, null);
  assert.equal(activeUpdates(list, at("2026-10-10T09:00:00-04:00")).banner.id, "drive");
  assert.equal(activeUpdates(list, at("2026-10-17T00:00:00-04:00")).banner, null);
  const open = normalizeUpdates({ updates: [{ id: "x", kind: "banner", text: "Always" }] });
  assert.equal(activeUpdates(open, 0).banner.id, "x", "no dates means always on");
});

test("a live video is announced before it starts, live while on, gone after", () => {
  const list = normalizeUpdates(FILE);
  const before = at("2026-10-09T12:00:00-04:00") - (LIVE_ANNOUNCE_MINUTES + 1) * 60000;
  assert.equal(activeUpdates(list, before).live, null);
  assert.equal(activeUpdates(list, at("2026-10-09T11:30:00-04:00")).live.state, "soon");
  assert.equal(activeUpdates(list, at("2026-10-09T12:05:00-04:00")).live.state, "live");
  assert.equal(activeUpdates(list, at("2026-10-09T13:00:00-04:00")).live, null);
});

test("notifications a listener asked for: live video just before, drive notices on time", () => {
  const list = normalizeUpdates({
    updates: [
      {
        ...FILE.updates[0],
        notify: [
          { at: "2026-10-05T08:00:00-04:00", title: "The drive is on", text: "Tap to donate." },
          { at: "2026-10-16T08:00:00-04:00", title: "Last day" },
          { at: "2026-10-20T08:00:00-04:00", title: "After the drive has ended" },
          { at: "whenever", title: "A bad time" },
          { at: "2026-10-06T08:00:00-04:00" },
        ],
      },
      { ...FILE.updates[1], show: "freeatnoon" },
      {
        id: "quiet",
        kind: "live",
        title: "No notification",
        watch: "https://youtu.be/abcdefghijk",
        starts: "2026-10-09T15:00:00-04:00",
        notify: false,
      },
    ],
  });
  const now = at("2026-10-06T09:00:00-04:00");
  assert.deepEqual(alertPlan(list, {}, { now }), [], "nothing unless the listener asked");

  const both = alertPlan(list, { live: true, drives: true }, { now });
  assert.deepEqual(
    both.map((a) => [a.title, new Date(a.at).toISOString()]),
    [
      ["Free at Noon: Wesley Stace", "2026-10-09T15:50:00.000Z"],
      ["Last day", "2026-10-16T12:00:00.000Z"],
    ],
    "past, after-the-drive, undated and untitled notices are dropped",
  );
  assert.equal(
    both[0].body,
    `The live video starts in ${LIVE_ALERT_MINUTES} minutes. Tap to watch.`,
  );
  assert.equal(both[0].extra.action, "watch");
  assert.equal(both[0].extra.live.watch, FILE.updates[1].watch);
  assert.equal(both[1].body, "Tap to donate.", "a notice without text offers the banner's action");
  assert.deepEqual(both[1].extra, { action: "open", url: "https://xpn.org/donate/" });
  assert.equal(new Set(both.map((a) => a.key)).size, both.length);

  assert.deepEqual(
    alertPlan(list, { drives: true }, { now }).map((a) => a.title),
    ["Last day"],
  );
  assert.deepEqual(
    alertPlan(list, { live: true }, { now, remindedShows: ["freeatnoon"] }),
    [],
    "a show the listener is already reminded about gets no second notification",
  );
});

test("YouTube links play in the app; others open in the browser", () => {
  assert.match(
    youTubeEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/,
  );
  assert.match(youTubeEmbed("https://youtu.be/dQw4w9WgXcQ"), /embed\/dQw4w9WgXcQ/);
  assert.match(youTubeEmbed("https://www.youtube.com/live/dQw4w9WgXcQ?si=x"), /embed\/dQw4w9WgXcQ/);
  assert.match(
    youTubeEmbed("https://www.youtube.com/embed/live_stream?channel=UC123"),
    /live_stream\?channel=UC123/,
  );
  assert.equal(
    youTubeEmbed("https://www.youtube.com/@wxpn/live"),
    null,
    "a channel page cannot be embedded",
  );
  assert.equal(youTubeEmbed("https://vimeo.com/123"), null);
  assert.equal(youTubeEmbed("not a url"), null);
});

const PAGE = [
  {
    title: { rendered: "WATCH LIVE: Mikaela Davis Play Free at Noon" },
    modified_gmt: "2026-10-05T20:53:51",
    content: {
      rendered:
        '<div><iframe src="https://www.youtube.com/embed/cMJr1qNQ_qg?si=db9SFpxCUqh7LGo3" title="Free At Noon livestream: Mikaela Davis" allowfullscreen></iframe></div><p>Tune in!</p>',
    },
  },
];
const FRIDAY = {
  starts: Date.parse("2026-10-09T12:00:00-04:00"),
  ends: Date.parse("2026-10-09T13:00:00-04:00"),
};

test("the livestream page becomes the week's Free at Noon video", () => {
  const live = livestreamUpdate(PAGE, FRIDAY);
  assert.equal(live.kind, "live");
  assert.equal(live.title, "Free at Noon: Mikaela Davis");
  assert.equal(live.watch, "https://www.youtube.com/watch?v=cMJr1qNQ_qg");
  assert.equal(live.show, "freeatnoon");
  assert.equal(live.starts, FRIDAY.starts);
  assert.equal(live.ends, FRIDAY.ends);
  assert.ok(youTubeEmbed(live.watch), "plays in the app");
  assert.equal(activeUpdates([live], FRIDAY.starts + 60000).live.state, "live");
});

test("a stale, empty or odd livestream page offers nothing", () => {
  const old = [{ ...PAGE[0], modified_gmt: "2026-09-25T15:00:00" }];
  assert.equal(livestreamUpdate(old, FRIDAY), null, "last week's page");
  const editedDuringLastShow = [{ ...PAGE[0], modified_gmt: "2026-10-02T16:10:00" }];
  assert.equal(
    livestreamUpdate(editedDuringLastShow, FRIDAY),
    null,
    "touched during last week's show",
  );
  const setUpAfterLastShow = [{ ...PAGE[0], modified_gmt: "2026-10-02T17:30:00" }];
  assert.ok(livestreamUpdate(setUpAfterLastShow, FRIDAY), "set up after last week's show ended");
  const noVideo = [{ ...PAGE[0], content: { rendered: "<p>Back soon</p>" } }];
  assert.equal(livestreamUpdate(noVideo, FRIDAY), null);
  assert.equal(livestreamUpdate([], FRIDAY), null);
  assert.equal(livestreamUpdate(PAGE, null), null);
  const untitled = [
    {
      ...PAGE[0],
      content: { rendered: '<iframe src="https://www.youtube.com/embed/abcdef123"></iframe>' },
    },
  ];
  assert.equal(livestreamUpdate(untitled, FRIDAY).title, "Mikaela Davis Play Free at Noon");
});

test("Free at Noon is looked for only around its airing", () => {
  const on = (iso) => new Date(iso);
  assert.equal(airingSoon("freeatnoon", 120, on("2026-10-05T12:00:00-04:00")), null, "Monday");
  const before = airingSoon("freeatnoon", 120, on("2026-10-09T10:30:00-04:00"));
  assert.deepEqual(before, FRIDAY, "90 minutes before");
  assert.deepEqual(
    airingSoon("freeatnoon", 120, on("2026-10-09T12:30:00-04:00")),
    FRIDAY,
    "during",
  );
  assert.equal(airingSoon("freeatnoon", 120, on("2026-10-09T13:00:00-04:00")), null, "after");
  assert.equal(airingSoon("freeatnoon", 120, on("2026-10-09T09:30:00-04:00")), null, "too early");
});
