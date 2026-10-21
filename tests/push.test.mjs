// Push notifications (push.js): registering a phone's token and the
// listener's topics with the station's sender, and what a tap opens.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createPushClient, kindsPushed, pushTarget, topicsToSend } from "../push.js";

// A stand-in for the phone's push API: permission, and a token on register().
function phone({ permission = "granted", grant = "granted", fail = false } = {}) {
  const listeners = {};
  let receive = permission;
  return {
    listeners,
    asked: 0,
    registered: 0,
    addListener(event, fn) {
      (listeners[event] ||= []).push(fn);
      return Promise.resolve({ remove() {} });
    },
    async checkPermissions() {
      return { receive };
    },
    async requestPermissions() {
      this.asked++;
      receive = grant;
      return { receive };
    },
    async register() {
      this.registered++;
      queueMicrotask(() =>
        fail
          ? listeners.registrationError?.forEach((fn) => fn({ error: "no" }))
          : listeners.registration?.forEach((fn) => fn({ value: "token-1" })),
      );
    },
    newToken(value) {
      listeners.registration.forEach((fn) => fn({ value }));
    },
  };
}

test("turning a topic on registers the phone and tells the sender once", async () => {
  const api = phone();
  const posts = [];
  const push = createPushClient({
    api,
    platform: "ios",
    sent: null,
    post: async (b) => posts.push(b),
  });
  assert.equal(await push.setTopics(["live"]), true);
  assert.equal(posts.length, 1);
  assert.deepEqual(
    { token: posts[0].token, platform: posts[0].platform, topics: posts[0].topics },
    { token: "token-1", platform: "ios", topics: ["live"] },
  );
  await push.setTopics(["live"]);
  assert.equal(posts.length, 1, "nothing changed, nothing sent");
  await push.setTopics(["drives", "live"]);
  assert.deepEqual(posts.at(-1).topics, ["drives", "live"]);
  assert.equal(api.registered, 1, "the phone registers once");

  // All off: the sender is told to send nothing.
  await push.setTopics([]);
  assert.deepEqual(posts.at(-1).topics, []);

  // The phone replaces its token: reported by itself.
  api.newToken("token-2");
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(posts.at(-1).token, "token-2");
});

test("a listener who declines notifications is not registered", async () => {
  const api = phone({ permission: "prompt", grant: "denied" });
  const posts = [];
  const push = createPushClient({
    api,
    platform: "android",
    sent: null,
    post: async (b) => posts.push(b),
  });
  assert.equal(await push.setTopics(["drives"]), false);
  assert.equal(api.asked, 1);
  assert.equal(api.registered, 0);
  assert.deepEqual(posts, []);
});

test("what was last sent survives a restart, so it isn't sent again", async () => {
  const api = phone();
  const posts = [];
  const push = createPushClient({
    api,
    platform: "ios",
    sent: { token: "token-1", key: "token-1|live", endpoint: "https://one.test/r", at: 5000 },
    endpoint: "https://one.test/r",
    now: () => 6000,
    post: async (b) => posts.push(b),
  });
  await push.setTopics(["live"]);
  assert.deepEqual(posts, []);
});

test("a tap opens what the notification is about, https links only", () => {
  assert.deepEqual(pushTarget({ action: "open", url: "https://xpn.org/donate/" }), {
    action: "open",
    url: "https://xpn.org/donate/",
  });
  assert.deepEqual(
    pushTarget({ action: "watch", watch: "https://www.youtube.com/watch?v=a", title: "FAN" }),
    {
      action: "watch",
      live: { watch: "https://www.youtube.com/watch?v=a", title: "FAN" },
    },
  );
  assert.deepEqual(pushTarget({ action: "listen", stream: "xpn2" }), {
    action: "listen",
    stream: "xpn2",
  });
  assert.equal(pushTarget({ action: "open", url: "javascript:alert(1)" }), null);
  assert.equal(pushTarget({ action: "nope" }), null);
  assert.equal(pushTarget(null), null);
});

test("on then quickly off ends with the server told to send nothing", async () => {
  const api = phone();
  const done = [];
  // A slow server: each request finishes a moment after it starts, so the
  // "on" would land after the "off" if both were in flight at once.
  let delay = 30;
  const push = createPushClient({
    api,
    platform: "ios",
    sent: { token: "token-1", key: "token-1|" },
    post: (b) =>
      new Promise((resolve) =>
        setTimeout(
          () => {
            done.push(b.topics.join(","));
            resolve();
          },
          (delay -= 20),
        ),
      ),
  });
  const on = push.setTopics(["live"]);
  await new Promise((r) => setTimeout(r, 1));
  const off = push.setTopics([]);
  await Promise.allSettled([on, off]);
  assert.equal(done.at(-1), "", "the last word the server has is: nothing");
});

test("a failed registration is tried again on the next attempt", async () => {
  const api = phone();
  let fail = true;
  const register = api.register.bind(api);
  api.register = async () => {
    if (fail) {
      api.registered++;
      throw new Error("no network");
    }
    return register();
  };
  const posts = [];
  const push = createPushClient({
    api,
    platform: "ios",
    sent: null,
    post: async (b) => posts.push(b),
  });
  await assert.rejects(push.setTopics(["live"]));
  fail = false;
  assert.equal(await push.setTopics(["live"]), true);
  assert.equal(api.registered, 2, "two attempts, two registrations");
  assert.deepEqual(posts.at(-1).topics, ["live"]);
});

test("a registration error event is tried again too, without doubled listeners", async () => {
  let failNext = true;
  const api = phone();
  const base = api.register.bind(api);
  api.register = async function () {
    if (!failNext) return base();
    failNext = false;
    this.registered++;
    queueMicrotask(() => api.listeners.registrationError.forEach((fn) => fn({ error: "no" })));
  };
  const posts = [];
  const push = createPushClient({
    api,
    platform: "android",
    sent: null,
    post: async (b) => posts.push(b),
  });
  await assert.rejects(push.setTopics(["drives"]));
  assert.equal(await push.setTopics(["drives"]), true);
  assert.equal(api.listeners.registration.length, 1);
  assert.equal(posts.length, 1);
});

test("a phone that never answers registration doesn't hold up turning alerts off", async () => {
  const api = phone();
  api.register = async () => {}; // no answer, ever
  const posts = [];
  const push = createPushClient({
    api,
    platform: "ios",
    sent: { token: "token-1", key: "token-1|live" },
    post: async (b) => posts.push(b),
    registerTimeout: 20,
  });
  await assert.rejects(push.setTopics(["live", "drives"]));
  assert.equal(await push.setTopics([]), true);
  assert.deepEqual(posts.at(-1).topics, [], "the opt-out still reaches the sender");
});

test("what the sender has stays known through a failed change", async () => {
  const api = phone();
  let up = true;
  const push = createPushClient({
    api,
    platform: "ios",
    sent: null,
    post: async () => {
      if (!up) throw new Error("server down");
    },
  });
  await push.setTopics(["live"]);
  assert.deepEqual(push.status(), { topics: ["live"], failing: false });
  up = false;
  await assert.rejects(push.setTopics(["drives", "live"]));
  assert.deepEqual(
    push.status(),
    { topics: ["live"], failing: true },
    "the sender still has live, and only live, and the change is to be tried again",
  );
});

test("a replaced token that can't be reported marks push as failing, until it is", async () => {
  const api = phone();
  let up = true;
  const changes = [];
  const push = createPushClient({
    api,
    platform: "android",
    sent: null,
    onChange: () => changes.push(push.status().failing),
    post: async () => {
      if (!up) throw new Error("server down");
    },
  });
  await push.setTopics(["live"]);
  up = false;
  api.newToken("token-2"); // the phone replaces its token; the report fails
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(push.status(), { topics: ["live"], failing: true });
  up = true;
  await push.setTopics(["live"]); // the retry (app back in front) reports it
  assert.deepEqual(push.status(), { topics: ["live"], failing: false });
  assert.deepEqual(changes.slice(-2), [true, false]);
});

test("one subscription covers every notice; off, or push switched off, sends an empty list", () => {
  assert.deepEqual(topicsToSend(true, true), ["station"]);
  assert.deepEqual(topicsToSend(false, true), []);
  assert.deepEqual(topicsToSend(true, false), []);
});

test("a kept per-kind choice sends that version's topics, never the station's", () => {
  assert.deepEqual(topicsToSend(true, true, ["live"]), ["live"]);
  assert.deepEqual(topicsToSend(true, true, ["live", "drives"]), ["drives", "live"]);
  assert.deepEqual(topicsToSend(false, true, ["live"]), []);
  assert.deepEqual(kindsPushed(["station"]), ["live", "drives"]);
  assert.deepEqual(kindsPushed(["live"]), ["live"]);
  assert.deepEqual(kindsPushed([]), []);
});

test("a new sender, or a week gone by, gets the registration again", async () => {
  const day = 24 * 60 * 60 * 1000;
  let clock = 1_000_000;
  const now = () => clock;
  const first = [];
  const one = createPushClient({
    api: phone(),
    platform: "ios",
    sent: null,
    endpoint: "https://one.test/register",
    now,
    post: async (b) => first.push(b),
    save: (value) => (saved = value),
  });
  let saved = null;
  await one.setTopics(["station"]);
  assert.equal(first.length, 1);

  // The next launch, same sender, a day later: nothing to send.
  clock += day;
  const again = [];
  const same = createPushClient({
    api: phone(),
    platform: "ios",
    sent: saved,
    endpoint: "https://one.test/register",
    now,
    post: async (b) => again.push(b),
  });
  await same.setTopics(["station"]);
  assert.equal(again.length, 0, "unchanged and recent: no request");

  // A build pointed at a new sender: registers there, and until then the
  // old sender's topics don't count as covered.
  const second = [];
  const moved = createPushClient({
    api: phone(),
    platform: "ios",
    sent: saved,
    endpoint: "https://two.test/register",
    now,
    post: async (b) => second.push(b),
  });
  assert.deepEqual(moved.status().topics, [], "the new sender has nothing yet");
  await moved.setTopics(["station"]);
  assert.equal(second.length, 1, "the new sender is told");
  assert.deepEqual(moved.status(), { topics: ["station"], failing: false });

  // Eight days on, the same sender is told again (it may have lost it).
  clock += 8 * day;
  const later = [];
  const stale = createPushClient({
    api: phone(),
    platform: "ios",
    sent: saved,
    endpoint: "https://one.test/register",
    now,
    post: async (b) => later.push(b),
  });
  await stale.setTopics(["station"]);
  assert.equal(later.length, 1);
});

test("a registration kept by the earlier version is sent once more", async () => {
  const posts = [];
  const push = createPushClient({
    api: phone(),
    platform: "android",
    sent: { token: "token-1", key: "token-1|station" },
    endpoint: "https://one.test/register",
    post: async (b) => posts.push(b),
  });
  assert.deepEqual(push.status().topics, ["station"], "still counts as covered meanwhile");
  await push.setTopics(["station"]);
  assert.equal(posts.length, 1);
});
