import { test } from "node:test";
import assert from "node:assert/strict";
import { savedShowGroups } from "../saved-shows.js";

const catalog = {
  worldcafe: { id: "worldcafe", name: "World Cafe", img: "/shows/wc.jpg" },
  funky: { id: "funky", name: "Funky Friday", img: "/shows/funky.jpg" },
};
const ep = (id, show, date, savedAt, title = id) => ({ id, show, date, savedAt, title });

test("a show with saved episodes but no follow gets a group, not followed", () => {
  const [g] = savedShowGroups({ episodes: [ep("a", "funky", "2026-10-02", 5)], catalog });
  assert.equal(g.id, "funky");
  assert.equal(g.followed, false);
  assert.equal(g.show.name, "Funky Friday");
  assert.deepEqual(
    g.episodes.map((e) => e.id),
    ["a"],
  );
});

test("following and episodes merge into one group", () => {
  const groups = savedShowGroups({
    followed: [{ id: "funky", name: "Funky Friday", savedAt: 1 }],
    episodes: [ep("a", "funky", "2026-10-02", 5)],
    catalog,
  });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].followed, true);
});

test("episodes run newest broadcast first", () => {
  const [g] = savedShowGroups({
    episodes: [ep("old", "funky", "2026-09-01", 9), ep("new", "funky", "2026-10-01", 1)],
    catalog,
  });
  assert.deepEqual(
    g.episodes.map((e) => e.id),
    ["new", "old"],
  );
});

test("groups order by newest saved episode, so following doesn't reorder", () => {
  const episodes = [ep("a", "funky", "2026-10-02", 10), ep("b", "worldcafe", "2026-10-02", 20)];
  const before = savedShowGroups({ episodes, catalog }).map((g) => g.id);
  // Following Funky Friday now (a newer save) leaves it where it was.
  const after = savedShowGroups({
    followed: [{ id: "funky", name: "Funky Friday", savedAt: 99 }],
    episodes,
    catalog,
  }).map((g) => g.id);
  assert.deepEqual(before, ["worldcafe", "funky"]);
  assert.deepEqual(after, before);
});

test("a show not in the catalog takes its name and art from the episode", () => {
  const [g] = savedShowGroups({
    episodes: [
      { ...ep("x", "gone", "2026-10-01", 1), showName: "Old Show", image: "https://a/b.jpg" },
    ],
    catalog,
  });
  assert.equal(g.show.name, "Old Show");
  assert.equal(g.show.img, "https://a/b.jpg");
});

test("search keeps a show by name, or only the episodes it matches", () => {
  const episodes = [
    ep("a", "funky", "2026-10-02", 1, "Prince night"),
    ep("b", "funky", "2026-10-01", 2, "Disco"),
    ep("c", "worldcafe", "2026-10-01", 3, "Waxahatchee"),
  ];
  const byShow = savedShowGroups({ episodes, catalog, query: "funky" });
  assert.deepEqual(
    byShow.map((g) => [g.id, g.episodes.length]),
    [["funky", 2]],
  );
  const byEpisode = savedShowGroups({ episodes, catalog, query: "prince" });
  assert.deepEqual(
    byEpisode.map((g) => [g.id, g.episodes.map((e) => e.id)]),
    [["funky", ["a"]]],
  );
});
