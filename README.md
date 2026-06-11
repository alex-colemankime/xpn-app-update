# WXPN App

React app + Capacitor native shells, ready for the iOS App Store and Google
Play. The same Vite build also works as an installable PWA on the web.


## Previewing on your computer

```
npm install        # once
npm run dev        # then open http://localhost:5173
```

At desktop width you get the phone-frame mockup view with the demo nav
buttons, same as the GitHub Pages version. For the real app experience,
open browser DevTools, toggle device emulation (Cmd+Shift+M in Chrome),
pick an iPhone, and **reload** — the mobile/desktop check runs once at
page load, so it needs the reload to take effect. The play button streams
actual live WXPN audio either way.

To preview on your actual phone: `npm run dev -- --host`, then open the
Network URL it prints on a phone on the same wifi. That's the fastest way
to feel real scrolling, tap targets, and safe-area behavior.

To preview the production/PWA build (service worker active, what users
would install): `npm run build && npm run preview`.

The native iOS preview needs a Mac: `npx cap open ios`, then Run on an
iPhone simulator from Xcode. The Android equivalent (`npx cap open
android` + emulator) works on Windows/Linux too. Background-audio and
lock-screen behavior should always get a final check on a physical phone —
simulators fake those poorly.

## Code layout

- `src/App.jsx` — all UI components
- `src/theme.js` — colors, fonts, shared button style (the design tokens)
- `src/icons.jsx` — the SVG icon set
- `src/data.js` — static content: hosts, shows, album art. This is the
  file that gets replaced by live API data when that gets wired up.
- `src/player.js` — audio + media session

## Audio architecture

One `<audio>` element does playback on every platform (the stream is plain
HTTPS MP3 from StreamGuys). Media controls go through
`@capgo/capacitor-media-session` (the Capacitor-8 maintained fork of
jofr/capacitor-media-session), one code path everywhere:

- **iOS**: lock screen + control center play/pause with WXPN metadata.
  Background playback comes from two native settings, already applied:
  `UIBackgroundModes: audio` in `ios/App/App/Info.plist`, and
  `AVAudioSession` category `.playback` in `AppDelegate.swift` (also makes
  the stream ignore the ring/silent switch, which is correct for radio).
- **Android**: media notification with controls, and the plugin runs a
  foreground service so the OS doesn't kill audio in the background. The
  Android-14 typed permission is already in the app manifest.
- **Web/PWA**: thin wrapper over the standard Media Session API.

## Daily workflow

```
npm install            # once
npm run dev            # browser dev with hot reload — do UI work here
npm run build          # production web build into dist/
npx cap sync           # copy dist/ into ios/ and android/ + update plugins
npx cap open ios       # open Xcode (Mac only)
npx cap open android   # open Android Studio
```

UI development stays in the browser like always. The native projects only
need re-opening when you change plugins or native config.

## Getting it on the App Store (from a Mac)

1. `npm install && npm run build && npx cap sync`
2. `npx cap open ios` — Capacitor 8 uses Swift Package Manager, so there's
   no CocoaPods setup; Xcode resolves the packages on first open.
3. In Signing & Capabilities, pick the team (needs an Apple Developer
   Program membership — $99/yr; if this is going out as the station's app,
   it should be an org account, possibly the one the existing WXPN app
   lives under).
4. Confirm Background Modes shows "Audio, AirPlay, and Picture in Picture"
   checked (the Info.plist entry is already there).
5. Set the bundle ID in `capacitor.config.ts` AND in Xcode to the real
   registered App ID (placeholder is `org.xpn.app`).
6. Run on a physical phone first: start the stream, lock the screen,
   confirm it keeps playing and lock screen controls work.
7. Product → Archive → Distribute to upload to App Store Connect.
   TestFlight to staff before public release.

App Review note: streaming radio apps are routine, but have screenshots and
a privacy policy URL ready, and the app must not be a bare website wrapper —
this one isn't (native audio behavior, offline shell, app-specific UI).

Play Store is the same flow through Android Studio (Build → Generate Signed
Bundle); Play Console account is $25 one-time.

## TODOs in the code

- `src/player.js` — XPN2 mount URL is blank; get it from the streaming
  dashboard. Confirm whether to use the `-nopreroll` mount for the app.
- `setMetadata(track)` is the hook for live now-playing data: poll the
  playlist feed and call it with `{title, artist, album}` and the lock
  screen / notification updates with the current song. Inside Capacitor
  there's no CORS wall (native shell, not a browser origin), so the feed
  can be fetched directly even if it lacks CORS headers.
- `public/icons/` are generated placeholders — replace with brand icons.
  iOS also wants the full AppIcon set in
  `ios/App/App/Assets.xcassets/AppIcon.appiconset/` (a single 1024px
  source works; Xcode 15+ generates the rest).
- GitHub Pages: use `npm run build:pages` (sets the `/wxpn-app/` base
  path — a plain `npm run build` deployed to a project page would 404
  every asset) and publish `dist/`.
