// Loading a screen's code can fail when the connection drops (on the web;
// the phone apps carry their code with them). React remembers a failed lazy
// load for good, and the error would take down the whole app, so a failed
// load waits instead: offline, until the connection is back; online, a
// couple more tries a moment apart before giving up.
//
// Browsers remember a failed module download too, so a retry asks for the
// same file at a fresh address (the one the error names, plus "?retry=n").
// That can't help when what failed was a piece the screen shares with
// others: the browser won't fetch it again until the page reloads. Then the
// load gives up, and that screen alone says so (ScreenErrorBoundary).

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isOnline = () => typeof navigator === "undefined" || navigator.onLine !== false;
const nextOnline = () =>
  new Promise((resolve) => window.addEventListener("online", resolve, { once: true }));
const importFresh = (url) => import(/* @vite-ignore */ url);

// The module address in a failed import's message, if it names one.
export function failedModuleUrl(error) {
  const found = String(error?.message || "").match(/(https?:\/\/[^\s'"]+?\.m?[jt]sx?)\b/);
  return found ? found[1] : "";
}

export function retryImport(
  load,
  {
    tries = 3,
    wait = pause,
    online = isOnline,
    whenOnline = nextOnline,
    importUrl = importFresh,
  } = {},
) {
  return async () => {
    let attempt = load;
    for (let failed = 0, round = 0; ; round += 1) {
      try {
        return await attempt();
      } catch (error) {
        const url = failedModuleUrl(error);
        if (url) attempt = () => importUrl(`${url}?retry=${round + 1}`);
        // Offline doesn't count as a try: the code is fine, the line is down.
        if (!online()) {
          await whenOnline();
          continue;
        }
        failed += 1;
        if (failed >= tries) throw error;
        await wait(500 * 2 ** (failed - 1));
      }
    }
  };
}
