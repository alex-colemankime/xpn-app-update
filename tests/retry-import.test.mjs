import { test } from "node:test";
import assert from "node:assert/strict";
import { retryImport } from "../retry-import.js";

const noWait = () => Promise.resolve();
const failing = (times, value = "module") => {
  let calls = 0;
  const load = async () => {
    calls += 1;
    if (calls <= times) throw new Error("Failed to fetch dynamically imported module");
    return value;
  };
  return { load, calls: () => calls };
};

test("a load that works is used straight away", async () => {
  const { load, calls } = failing(0);
  assert.equal(await retryImport(load, { wait: noWait })(), "module");
  assert.equal(calls(), 1);
});

test("online, a failed load is tried again", async () => {
  const { load, calls } = failing(2);
  assert.equal(await retryImport(load, { wait: noWait, online: () => true })(), "module");
  assert.equal(calls(), 3);
});

test("online, it gives up after its tries", async () => {
  const { load, calls } = failing(5);
  await assert.rejects(retryImport(load, { tries: 3, wait: noWait, online: () => true })());
  assert.equal(calls(), 3);
});

test("offline, it waits for the connection, without using up tries", async () => {
  const { load, calls } = failing(4);
  let waits = 0;
  const run = retryImport(load, {
    tries: 1,
    wait: noWait,
    online: () => false,
    whenOnline: async () => {
      waits += 1;
    },
  });
  assert.equal(await run(), "module");
  assert.equal(waits, 4);
  assert.equal(calls(), 5);
});

test("a retry asks for the failed module at a fresh address", async () => {
  const asked = [];
  let first = true;
  const run = retryImport(
    async () => {
      if (!first) return "never";
      first = false;
      throw new TypeError(
        "Failed to fetch dynamically imported module: https://x.org/assets/Videos-ab12.js",
      );
    },
    {
      wait: noWait,
      online: () => true,
      importUrl: async (url) => {
        asked.push(url);
        return "fresh";
      },
    },
  );
  assert.equal(await run(), "fresh");
  assert.deepEqual(asked, ["https://x.org/assets/Videos-ab12.js?retry=1"]);
});
