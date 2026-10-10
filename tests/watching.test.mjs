// Which live video the live route shows (hooks/useWatching.js).
import { test } from "node:test";
import assert from "node:assert/strict";

const { liveToShow } = await import("../hooks/useWatching.js");

const week = (id, state) => ({
  id,
  state,
  title: `Free at Noon: ${id}`,
  watch: "https://www.youtube.com/watch?v=abcdefghijk",
});

test("the chosen video follows the station: soon turns live, and an ended one closes", () => {
  const chosen = week("this-week", "soon");
  assert.equal(
    liveToShow({ chosen, current: week("this-week", "live"), updatesLoaded: true }).state,
    "live",
  );
  assert.equal(
    liveToShow({ chosen, current: null, updatesLoaded: true }),
    null,
    "ended: nothing to show",
  );
  assert.equal(
    liveToShow({ chosen, current: week("next-week", "soon"), updatesLoaded: true }),
    null,
    "a different broadcast isn't the one chosen",
  );
});

test("before the first check the choice stands; with no choice, what is live now", () => {
  const chosen = week("this-week", "live");
  assert.equal(liveToShow({ chosen, current: null, updatesLoaded: false }), chosen);
  assert.equal(
    liveToShow({ chosen: null, current: week("next-week", "live"), updatesLoaded: true }).id,
    "next-week",
  );
  assert.equal(
    liveToShow({
      chosen: null,
      current: { ...week("x", "live"), watch: "https://example.org/stream" },
      updatesLoaded: true,
    }),
    null,
    "only a video that plays in the page",
  );
});

test("a video opened from a push (a link, no id) stays open once updates load", () => {
  const pushed = {
    watch: "https://www.youtube.com/watch?v=abcdefghijk",
    title: "FAN",
    state: "live",
  };
  const shown = liveToShow({
    chosen: pushed,
    current: week("this-week", "live"),
    updatesLoaded: true,
  });
  assert.equal(shown?.id, "this-week");
  assert.equal(
    liveToShow({
      chosen: pushed,
      current: { ...week("other", "live"), watch: "https://www.youtube.com/watch?v=zyxwvutsrqp" },
      updatesLoaded: true,
    }),
    null,
    "a different video live now isn't the one pushed",
  );
});
