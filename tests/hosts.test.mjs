import { test } from "node:test";
import assert from "node:assert/strict";
import { HOSTS, foldName, hostBySlug, hostsOfShow } from "../hosts.js";
import { SHOWS } from "../catalog.js";

test("every host has a name, a bio and only shows the guide has", () => {
  assert.ok(HOSTS.length > 10);
  for (const host of HOSTS) {
    assert.ok(host.name && host.slug, host.slug);
    assert.ok(Array.isArray(host.bio), host.slug);
    for (const id of host.shows) assert.ok(SHOWS[id], `${host.slug}: ${id}`);
  }
});

test("a show's hosts come in the order its host line names them", () => {
  const show = { id: "s", host: "Kristen Kurtis & Bob Bumbera" };
  const hosts = [
    { name: "Bob Bumbera", shows: ["s"] },
    { name: "Someone Else", shows: ["s"] },
    { name: "Kristen Kurtis", shows: ["s"] },
    { name: "Not On It", shows: ["t"] },
  ];
  assert.deepEqual(
    hostsOfShow(show, hosts).map((h) => h.name),
    ["Kristen Kurtis", "Bob Bumbera", "Someone Else"],
  );
  assert.deepEqual(hostsOfShow(null, hosts), []);
});

test("the guide's hosted shows find their hosts", () => {
  assert.deepEqual(
    hostsOfShow(SHOWS.worldcafe).map((h) => h.name),
    ["Raina Douris", "Stephen Kallao"],
  );
  assert.equal(hostBySlug("dan-reed")?.name, "Dan Reed");
  assert.equal(hostBySlug("nobody"), null);
});

test("a host line with a straight apostrophe finds the host whose page has a curly one", () => {
  const show = { id: "s", host: "Debra D'Alessandro" };
  const hosts = [
    { name: "Debra D\u2019Alessandro", shows: ["s"] },
    { name: "Other", shows: ["s"] },
  ];
  assert.equal(hostsOfShow(show, hosts)[0].name, "Debra D\u2019Alessandro");
  assert.equal(foldName("D\u2019Alessandro").length, "D\u2019Alessandro".length);
});
