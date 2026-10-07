import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeEntities, oneLine, plainText, webUrl } from "../text.js";

test("feed text is stripped of markup and fully entity-decoded", () => {
  assert.equal(plainText("Hall &#038; Oates"), "Hall & Oates");
  assert.equal(plainText("Guns N&#8217; Roses"), "Guns N’ Roses");
  assert.equal(plainText("<em>Sold</em> &ndash; out &hellip;"), "Sold – out …");
  assert.equal(plainText("&#x1F3B8; night"), "🎸 night");
  assert.equal(
    plainText("&lt;script&gt;"),
    "<script>",
    "decoded text is never re-parsed as markup",
  );
  assert.equal(plainText("  A \n  B "), "A B");
  assert.equal(plainText("&bogus; &#0;"), "&bogus; &#0;");
});

test("only web links survive; http only where allowed", () => {
  assert.equal(webUrl("https://tickets.test/x"), "https://tickets.test/x");
  assert.equal(webUrl("javascript:alert(1)"), "");
  assert.equal(webUrl("data:text/html,hi"), "");
  assert.equal(webUrl("/relative"), "");
  assert.equal(webUrl(undefined), "");
});

test("http links pass only where they are allowed", () => {
  assert.equal(webUrl("http://old-venue.test/"), "");
  assert.equal(webUrl("http://old-venue.test/", { http: true }), "http://old-venue.test/");
});

test("fields become one tidy line, and only text counts", () => {
  assert.equal(oneLine("  The Fall  Member\n Drive "), "The Fall Member Drive");
  assert.equal(oneLine("abcdef", 3), "abc");
  assert.equal(oneLine(42), "42");
  assert.equal(oneLine({ text: "x" }), "");
  assert.equal(oneLine(null), "");
  assert.equal(decodeEntities("Hall &amp; Oates"), "Hall & Oates");
});
