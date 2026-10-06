import { test } from "node:test";
import assert from "node:assert/strict";
import { withTimeout } from "../net.js";

function olderBrowser(t) {
  const descriptor = Object.getOwnPropertyDescriptor(AbortSignal, "any");
  Object.defineProperty(AbortSignal, "any", { value: undefined, configurable: true });
  t.after(() => Object.defineProperty(AbortSignal, "any", descriptor));
  t.mock.timers.enable({ apis: ["setTimeout"] });
}

test("requests still time out without AbortSignal.any", (t) => {
  olderBrowser(t);
  const signal = withTimeout(undefined, 1000);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(1000);
  assert.equal(signal.aborted, true);
  assert.equal(signal.reason.name, "TimeoutError");
});

test("caller cancellation is forwarded without waiting for the timeout", (t) => {
  olderBrowser(t);
  const parent = new AbortController();
  const signal = withTimeout(parent.signal, 1000);
  parent.abort(new Error("screen closed"));
  assert.equal(signal.aborted, true);
  assert.equal(signal.reason, parent.signal.reason);
  t.mock.timers.tick(1000);
  assert.equal(signal.reason, parent.signal.reason);
});

test("a previously cancelled request stays cancelled", () => {
  const parent = new AbortController();
  parent.abort();
  assert.equal(withTimeout(parent.signal).aborted, true);
});
