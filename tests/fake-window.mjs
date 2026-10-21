// A minimal browser `window` for unit tests of modules that read it: an
// in-memory localStorage (values kept as strings, as the browser does), event
// methods that do nothing, and a web address. Install it before importing the
// module under test — use `await import()` after calling this, since static
// imports are hoisted and would run first.
//
//   const memory = fakeWindow({ storage: [["xpn.volume", "70"]], gtag() {} });
//
// `storage` seeds localStorage; any other property is added to (or replaces
// the default on) `window`. Returns the Map backing localStorage.
export function fakeWindow({ storage = [], ...extra } = {}) {
  const memory = new Map(storage);
  globalThis.window = {
    localStorage: {
      getItem: (key) => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => memory.set(key, String(value)),
      removeItem: (key) => memory.delete(key),
    },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
    location: { origin: "https://app.test", pathname: "/", href: "https://app.test/" },
    ...extra,
  };
  return memory;
}
