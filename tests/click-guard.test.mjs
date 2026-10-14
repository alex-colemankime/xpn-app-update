// A drag's release swallows the click it may produce, and only that one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { swallowNextClick } from "../click-guard.js";

// The least of an element: listeners added and removed, and a click.
function element() {
  const listeners = new Set();
  return {
    addEventListener: (type, fn) => listeners.add(fn),
    removeEventListener: (type, fn) => listeners.delete(fn),
    click() {
      let stopped = false;
      const e = { stopPropagation: () => (stopped = true), preventDefault() {} };
      for (const fn of [...listeners]) {
        listeners.delete(fn); // once
        fn(e);
      }
      return !stopped;
    },
  };
}

test("the click right after a drag is swallowed", () => {
  const el = element();
  swallowNextClick(el);
  assert.equal(el.click(), false);
  assert.equal(el.click(), true, "and the next one goes through");
});

test("a release with no click leaves the next tap alone", async () => {
  const el = element();
  swallowNextClick(el);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(el.click(), true, "a later Undo still works the first time");
});
