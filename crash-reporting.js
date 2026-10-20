// Crash reporting for the phone apps, with Firebase Crashlytics: crashes in
// the native code (which GA4 never sees), and the web app's own errors with
// their stack, each with the steps that led up to it (the screens opened,
// the station played: the same anonymous events GA4 gets) and the app's
// version, station and screen.
//
// Off until Firebase is set up for the apps (android/app/google-services.json,
// ios/App/App/GoogleService-Info.plist; see README › Usage and crash
// reporting); until then every call here quietly does nothing. It follows
// Settings › Privacy as GA4 does: switched off there, nothing is collected
// or sent, crashes included.

import { Capacitor } from "@capacitor/core";
import { FirebaseCrashlytics } from "@capacitor-firebase/crashlytics";
import { describeError, onReported, reportingStore } from "./analytics.js";

// A JavaScript stack (Chrome's "at fn (file:1:2)" on Android, Safari's
// "fn@file:1:2" on iOS) as the frames Crashlytics shows. Addresses are cut
// to the file's name: the app's own files say enough. Pure, so it can be
// tested.
export function parseStack(stack) {
  if (typeof stack !== "string") return [];
  const frames = [];
  for (const line of stack.split("\n")) {
    const match =
      /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/.exec(line) ||
      /^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/.exec(line);
    if (!match) continue;
    const [, functionName = "", file, lineNumber, columnNumber] = match;
    frames.push({
      functionName: functionName || "<anonymous>",
      fileName: file.split(/[?#]/)[0].split("/").pop() || file,
      lineNumber: Number(lineNumber),
      columnNumber: Number(columnNumber),
    });
    if (frames.length === 30) break;
  }
  return frames;
}

// An event as a step in a crash's log: its name and parameters on one line.
// Pure, so it can be tested.
export function breadcrumb(name, params = {}) {
  const parts = Object.entries(params)
    .filter(([key, value]) => key !== "page_location" && value !== "" && value != null)
    .map(([key, value]) => `${key}=${String(value).slice(0, 60)}`);
  return [name, ...parts].join(" ").slice(0, 200);
}

// At launch (phone apps only). `live` is the station player ({ subscribe,
// getSnapshot }), for the station a report was made on.
export function startCrashReporting({ live }) {
  if (!Capacitor.isNativePlatform()) return;
  const quiet = (promise) => promise?.catch?.(() => {}); // not set up: nothing to do
  const key = (name, value) =>
    quiet(FirebaseCrashlytics.setCustomKey({ key: name, value: String(value), type: "string" }));

  // Collection follows the Privacy switch, and Crashlytics remembers it, so
  // a crash before the web app has loaded follows it too.
  const follow = () =>
    quiet(FirebaseCrashlytics.setEnabled({ enabled: reportingStore.getSnapshot().on }));
  follow();
  reportingStore.subscribe(follow);

  key("version", typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "");
  let station = "";
  const followStation = () => {
    const now = live.getSnapshot().streamId || "";
    if (now === station) return;
    station = now;
    key("station", station);
  };
  live.subscribe(followStation);
  followStation();

  // Each error once a session, as for GA4, so a loop can't flood it.
  const recorded = new Set();
  onReported((report) => {
    if (report.kind === "event") {
      if (report.name === "page_view") key("screen", report.params?.page_title || "");
      quiet(FirebaseCrashlytics.log({ message: breadcrumb(report.name, report.params) }));
      return;
    }
    const message = describeError(report.error, report.options?.where);
    if (recorded.has(message)) return;
    recorded.add(message);
    const stacktrace = parseStack(report.error?.stack);
    quiet(
      FirebaseCrashlytics.recordException({ message, ...(stacktrace.length && { stacktrace }) }),
    );
  });
}
