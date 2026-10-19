import { test } from "node:test";
import assert from "node:assert/strict";
import { artistKey, concertsByLikedArtists, newMatches } from "../concert-alerts.js";

test("artists' names compare without case, accents, punctuation or a leading The", () => {
  assert.equal(artistKey("The Beths"), artistKey("beths"));
  assert.equal(artistKey("Beyoncé"), artistKey("Beyonce"));
  assert.equal(artistKey("Hall & Oates"), artistKey("Hall and Oates"));
  assert.notEqual(artistKey("Bright Eyes"), artistKey("Bright Eyes & Friends"));
});

const concert = (id, artist) => ({ id, artist, date: "2026-10-20", venue: "Union Transfer" });

test("a concert matches when any act on its bill is an artist of a saved song", () => {
  const concerts = [
    concert("1", "Beck / Ioanna Gika / Wayne Faler"),
    concert("2", "Big Thief"),
    concert("3", "Jillian Ashcraft & Her Band"),
    concert("4", "The Beths (Album Release Show)"),
    concert("5", "Bright Eyes & Friends Revue"),
  ];
  const songs = [
    { artist: "Ioanna Gika" },
    { artist: "Phoebe Bridgers feat. Jillian Ashcraft" },
    { artist: "Beths" },
    { artist: "Bright Eyes" },
  ];
  const found = concertsByLikedArtists(concerts, songs);
  assert.deepEqual(
    found.map((m) => [m.concert.id, m.artist]),
    [
      ["1", "Ioanna Gika"],
      ["3", "Phoebe Bridgers feat. Jillian Ashcraft"],
      ["4", "Beths"],
    ],
  );
  assert.deepEqual(concertsByLikedArtists(concerts, []), []);
});

test("each concert is announced once; the first check announces what's already there together", () => {
  const matches = [{ concert: { id: "1" } }, { concert: { id: "2" } }];
  const first = newMatches(matches, null);
  assert.equal(first.first, true);
  assert.equal(first.fresh.length, 2);
  const again = newMatches(matches, first.seen);
  assert.equal(again.fresh.length, 0);
  const later = newMatches([...matches, { concert: { id: "3" } }], again.seen);
  assert.deepEqual(
    later.fresh.map((m) => m.concert.id),
    ["3"],
  );
  assert.equal(later.first, false);
});
