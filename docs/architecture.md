# How the app fits together

A map for the first day on the code. The README lists every file and
every integration. This page explains how the parts connect, and where to
go to change something.

## The shape of it

One React app (Vite) runs in three places: a browser, the iPhone app and
the Android app (Capacitor 8 wraps the same build). Code that works only on
a phone checks `Capacitor.isNativePlatform()` and does nothing in a
browser. CarPlay, Android Auto and the home screen widgets are native code
that the web app talks to through two small plugins.

```
main.jsx ── starts the services below, then renders App
App.jsx  ── the screens, the tab bar or sidebar, the player bar, and every
            sheet the address names (show, host, concert, video)

screens/     one file per tab: Listen, Shows, Videos, Concerts, Favorites, Settings
components/  the pieces they share (rows, sheets, the player bar, the alarm…)
hooks/       React glue over the modules below
*.js (root)  the app's logic, plain modules with no React, mostly pure and tested
styles/      tokens (base.css) first, then each screen and feature
```

## State: stores, not a framework

Shared state is a small store (`createStore` in `storage.js`): a value,
`set`, and `subscribe`, which tells listeners only when the value really
changes. React reads stores with `useSyncExternalStore`, usually through a
hook named after the thing (`usePlayer`, `useFavoriteItems`, `useNow`).
Modules update stores directly, so the lock screen, the car and the widget
see the same state as the screens.

Data kept on the phone (favorites, settings, the alarm) goes through
`storage.js` under the original `xpn.*` keys. Everything read back is
checked against a schema and repaired or dropped (`favorites.js` › `SCHEMA`),
so bad saved data can't break a screen.

## Addresses and sheets

`hooks/useRoute.js` owns the address: `#/<screen>` plus, at most, one
sheet: `/show/<id>[/episode/<id>]`, `/host/<slug>`, `/concert/<id>`,
`/video/<id>` or `/live`. App draws each sheet from the address, so Back
closes it and every sheet has a link that can be shared. To open or close a
sheet, use the route's actions (`openShow`, `openHost`, `openConcert`,
`closeShow`). Don't keep local "open" state.

Screens stay mounted while hidden (`<Activity>` in App.jsx). Each one
keeps its scroll position and search, and a screen's effects pause while
it's out of view. Concerts and Videos load lazily the first time they're
opened.

## Playback

- **`player-core.js`**: one `<audio>` element for the life of the app.
  Play, pause, reconnecting with backoff (alternating to the backup
  stream), volume, and the lock screen's controls. It is pure enough to
  test with a fake element (`tests/player.test.mjs`).
- **`player.js`**: wraps the core with stores (what's playing, volume, the
  sleep timer) and decides who owns the lock screen. That is either
  `"live"` or `"episode"` (`setAudioFocus`).
- **`episode-core.js` and `episode-player.js`**: the archive player
  (seeking, resume points, lengths), with its own element.
- **`cast.js`**: AirPlay or Google Cast, wherever the browser offers it.
- **`car.js` and `widget.js`**: build a snapshot of what's playing
  (`carNowPlaying`, `widgetNowPlaying`; both are pure and tested) and send
  it to the native plugins `CarAudio` and `HomeWidget`. Commands from the
  car or a widget come back as events and call the same actions as the
  screen's buttons.

## Where the data comes from

| What                          | Module                                          | Source                                                                                                              |
| ----------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Songs                         | `nowplaying.js`                                 | The station's playlist files, polled every 30s while visible or playing, plus the now-playing file for song lengths |
| Shows, schedule               | `catalog.js`, `schedule.js`, `shows.json`       | Bundled. Times are Eastern; `time.js` shows them as station time                                                    |
| Hosts                         | `hosts.js`, `hosts.json`                        | Bundled from xpn.org host pages (`tools/fetch-hosts.mjs`, run weekly by the "Fetch artwork" workflow)               |
| Concerts                      | `concerts.js`                                   | xpn.org's Events Calendar REST API, the next 12 months                                                              |
| Archive                       | `archive.js`                                    | Show pages on xpn.org (their audio players)                                                                         |
| Videos                        | `videos.js`                                     | Brightcove playlists (NPR's account)                                                                                |
| Banners, live video, switches | `updates.js`, `remote-config.js`, `features.js` | `updates.json`, written with `tools/updates-composer.html`                                                          |

Every feed degrades gracefully: when it fails, the screen says so, and
the app never invents data.

## Notifications

- **Local** (`notifications.js`): show reminders (`reminders.js`), the
  radio alarm (`alarm.js`, scheduled a week ahead), and station alerts
  (`hooks/useStationAlerts.js`). Each feature owns a range of notification
  ids (`slotOf`), so rescheduling one never cancels another's.
- **Push** (`push.js`): registration with the station's sender
  (`services/push-sender/`). Taps route through the same actions as
  in-app buttons.

## Native code

|               | iOS (`ios/App/`)                          | Android (`android/app/src/main/java/org/xpn/wxpn/`) |
| ------------- | ----------------------------------------- | --------------------------------------------------- |
| Car           | `CarPlaySceneDelegate.swift`              | `WxpnCarService.kt` (Android Auto)                  |
| Car bridge    | `CarAudioPlugin.swift`                    | `CarAudioPlugin.kt`                                 |
| Widget        | `WXPNWidget/WXPNWidget.swift` (extension) | `WxpnWidget.kt` and `res/layout/`                   |
| Widget bridge | `HomeWidgetPlugin.swift`                  | `HomeWidgetPlugin.kt`                               |
| Station list  | `Shared.swift` (both targets)             | `Stations.kt`                                       |

Plugins are registered in `MainViewController.swift` and
`MainActivity.java`. Two third-party plugins are patched (`patches/`,
applied by patch-package on install, with the plugins pinned): local
notifications (Android weekly alarms) and media session (an artwork
timeout).

## How to change common things

- **Add or change a station:** `streams.js`; the native station lists
  (`Shared.swift`, `Stations.kt`); the car tiles (`tools/car-art.mjs`); and
  the Android widget's layout ids.
- **Change the schedule or a show:** `shows.json`. Tests check that the
  week is fully covered.
- **Add a screen:** a file in `screens/`; register it in App.jsx (`Screen`)
  and in `components/Navigation.jsx`; add it to `SCREENS` in
  `useRoute.js`.
- **Add a sheet with an address:** extend `parseRoute` and `routeHash` (and
  `tests/route.test.mjs`), add an action, and draw it in App.jsx.
- **Let the station switch a feature off:** add it to `features.js` (`BUILT`)
  and to `remote-config.js` (`FEATURES`).
- **Colors, type, spacing:** tokens in `styles/base.css`.
  `docs/design-system.md` records the decisions the station has made, such
  as orange only for actions and choices marked in ink.
- **A new analytics event:** `track()` in `analytics.js`. List it in the
  README's analytics paragraph.

## Checking a change

- `npm run check` runs lint, formatting, unit tests and a build.
- `npm run e2e` drives the built app in Chromium (phone and desktop) against
  fixtures, with accessibility checks.
- Every push also builds both native apps ("Native apps"), launches them in
  an emulator and a simulator ("Native smoke"), and retakes the screens
  page when styles change ("Screens").
