# WXPN app

A radio-first app for WXPN 88.5 FM, XPN2 and Homegrown: listen live, see what's playing, save songs, follow shows and get reminded when they start, wake up to the station, and find concerts. React + Vite on the web, packaged for iOS and Android with Capacitor.

## Run

```sh
npm ci
npm run dev        # http://127.0.0.1:5173, sample content visible
npm run check      # lint, formatting, tests and a production build
```

| Script                | What it does                                            |
| --------------------- | ------------------------------------------------------- |
| `npm run dev`         | Dev server with hot reload                              |
| `npm run build`       | Production build into `dist/`                           |
| `npm run build:pages` | Build for the GitHub Pages preview (`/xpn-app-update/`) |
| `npm test`            | Unit tests (`node --test`, no extra dependencies)       |
| `npm run lint`        | ESLint, including React hooks rules                     |
| `npm run format`      | Prettier, in place                                      |
| `npm run check`       | Everything CI runs, in one go                           |
| `npm run cap:sync`    | Build and copy into the native projects                 |

CI runs `lint`, `format:check`, `test` and `build` on every push and pull request. Pushes to `main` also deploy the preview to GitHub Pages:

- **Live preview:** https://alex-colemankime.github.io/xpn-app-update/ (on a computer, with Phone, Tablet and Laptop buttons)
- **Every screen:** https://alex-colemankime.github.io/xpn-app-update/screens/ (light and dark, from `design/screens/`)

## Configuration

Build-time settings are Vite env variables, set in the shell or a `.env.local` file (git-ignored).

| Variable                     | Effect                                                                                                                                                                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_XPN_CONCERTS_ENDPOINT` | The concert calendar. Default: xpn.org's own calendar (`https://xpn.org/wp-json/tribe/events/v1/events`). `off` removes the Concerts tab.                                                                                                                      |
| `VITE_XPN_UPDATES_URL`       | The station updates file (banner, live video). Unset: no updates (preview builds show samples). See "Station updates".                                                                                                                                         |
| `VITE_XPN_ARCHIVE_FEEDS`     | Where on-demand episodes come from, as `show=URL` pairs (a show page on xpn.org, or a podcast feed). Default: the four shows xpn.org archives (Sleepy Hollow, Funky Friday, Land of the Lost, World Cafe). `off` removes the Archive tab. See "Audio archive". |
| `VITE_XPN_LIVESTREAM_PAGE`   | Where the app finds the week's Free at Noon video. Default: the livestream page on xpn.org (WordPress REST). `off` turns it off. See "Station updates".                                                                                                        |
| `VITE_SPOTIFY_CLIENT_ID`     | Turns on the Spotify playlist. See "Playlist sync".                                                                                                                                                                                                            |
| `VITE_APPLE_MUSIC_TOKEN_URL` | Turns on the Apple Music playlist: an endpoint returning `{ "token": "…" }`, a MusicKit developer token. (`VITE_APPLE_MUSIC_DEVELOPER_TOKEN` takes a token directly.)                                                                                          |
| `VITE_SITE_URL`              | The address the build is served from. Adds the share image and link-preview tags (the Pages workflow sets it to the preview's address).                                                                                                                        |
| `VITE_DEVICE_PREVIEW=true`   | The shared design preview: on a computer, the page opens the app in a phone, tablet or laptop frame with buttons to switch (`?device=tablet`, keys 1–3). Phones and tablets get the app itself. **Never for a store build.**                                   |
| `VITE_SHOW_SAMPLES=true`     | Placeholder episodes and sample station updates in a production build. Always on in `npm run dev`; set for the Pages preview; **never for a store build.**                                                                                                     |

## Station updates

The station can put a message in the app without a release: a banner across every screen (a member drive) and a live video to watch (Free at Noon). Both come from one small JSON file at `VITE_XPN_UPDATES_URL`, checked at launch, when the app comes back to the front, and every five minutes.

- **Write it** with `tools/updates-composer.html` (open the file in a browser): fill in the message, link and times in Eastern, see a preview, then copy or download `updates.json`. The format is documented at the top of `updates.js`.
- **Host it** anywhere the station can edit over HTTPS, for example the WordPress media library or a page that serves the JSON. It must be served with `Access-Control-Allow-Origin: *` (or the app's origins) so the web app can read it; the phone apps need the same.
- **Free at Noon needs no update at all.** From two hours before each Free at Noon until it ends, the app reads xpn.org/livestream (the page staff already update each week) and offers that page's YouTube video, titled from the video's own title ("Free at Noon: Mikaela Davis"). A page not edited since last week's show ended is taken to be last week's and ignored. A live item in `updates.json` takes priority, for anything else the station streams.
- **Behavior:** a banner shows between its start and end; listeners can dismiss it, and a new `id` shows again. A live video appears on Listen two hours before it starts ("Today at 12pm"), and while it is on it takes over the banner on the other screens. YouTube links play in the app (the radio pauses and is offered back afterwards); other links open in the browser.
- **Notifications (member drives, live video).** Listeners opt in under Settings › From WXPN; both are off until they do, with the consent wording beside each switch, as App Review 4.5.4 requires for anything promotional. A banner's `notify` list (up to six `{ at, title, text }`, written in the composer) becomes notifications for listeners who turned on member drives; a live video notifies those who turned on live video, 10 minutes before it starts (`"notify": false` skips one; a followed show with reminders on gets its reminder instead). The app schedules them on the phone, like show reminders, so no push service is needed. The catch: a phone learns of a notification when the app next opens, so post a drive's notifications before the drive starts. Tapping opens the video, or the banner's link (the donate page) in the browser view.
- **Reaching phones that haven't opened the app** needs a push service (Firebase Cloud Messaging, or one with a sending dashboard such as OneSignal or Airship), an APNs key from the Apple Developer account, and `@capacitor/push-notifications`. The same two switches become the listener's subscriptions (one topic each), so nothing in Settings changes.

## Audio archive

Shows › Archive lists recent broadcasts of the shows xpn.org archives, newest show first, each with its latest three (the rest in the show's sheet). They play in the app on their own player, with skip back 15 and ahead 30, lock-screen controls, and their place kept.

- **Source:** each archived show's page on xpn.org already lists its last ten broadcasts (from StreamGuys); the app reads that list (`parseArchivePage` in `archive.js`), so the station publishes nothing new. A dated title ("Sleepy Hollow - 10.04.2026") becomes the day it aired, in the show's slot; a feature ("Friko on World Cafe") keeps its name.
- **Signed links:** the audio links carry a key, so they are always read fresh from xpn.org and never built into the app.
- **Sturdier later:** a small JSON route on xpn.org returning the same list (title, date, audio, length) would replace reading the page's markup, and could add lengths before playback. Shows not archived on xpn.org (Echoes, The Folk Show…) appear once they are.

## Playlist sync

Like the playlist workout apps build from the songs you like: every song a listener saves goes into a "WXPN Favorites" playlist in their Spotify or Apple Music, kept in step as they save and unsave (`playlist-sync.js`, `music-services.js`). No server is needed.

- **Spotify:** create an app at developer.spotify.com, copy its Client ID to `VITE_SPOTIFY_CLIENT_ID`, and add these Redirect URIs: the web app's address (e.g. `https://xpn.org/app/`), and `org.xpn.wxpn://spotify-callback` for the phone apps. Sign-in uses PKCE, so there is no client secret to protect. Requests follow Spotify's February 2026 Web API (`POST /me/playlists`, `/playlists/{id}/items`).
  - **Limits as of 2026:** a Development Mode app works for at most 5 Spotify accounts the station allowlists, and the app owner needs Spotify Premium. Opening it to all listeners needs Extended Quota, which Spotify grants only to registered organizations with at least 250,000 monthly active users (applications take up to six weeks). If WXPN doesn't qualify, ship with Apple Music only and leave `VITE_SPOTIFY_CLIENT_ID` unset; the app then shows no Spotify option. A listener Spotify hasn't allowlisted sees "Spotify hasn't opened WXPN's playlist feature to your account yet" rather than a sign-in loop.
- **Apple Music:** needs a MusicKit developer token (Apple Developer account › MusicKit identifier and key). Tokens expire within six months, so serve one from a small endpoint (`VITE_APPLE_MUSIC_TOKEN_URL`) rather than building it in. Apple's API cannot remove songs from a playlist, so unsaving leaves the song there (the app says so). MusicKit JS signs in through a popup, which works on the web; in the iOS app it needs testing, and a native MusicKit plugin may be needed.
- Each service shows in Settings only when configured; Favorites invites listeners to set it up.

## Native apps

`capacitor.config.json` is ready; the native projects are generated on a Mac and are not in this repository yet.

Use Node 22 or newer (`.nvmrc` pins 24, as CI does).

1. **Confirm the app ID.** `appId` is `org.xpn.wxpn`. It becomes the permanent store identity at the first upload, so confirm it before step 2.
2. Generate the projects: `npm run build && npx cap add ios && npx cap add android`.
   - App icon and splash: `brand/app-icon-1024.png` is the 1024×1024 source. `npx @capacitor/assets generate --iconBackgroundColor '#ef7149' --splashBackgroundColor '#faf6ee'` (with the icon copied to `assets/icon.png`) writes every native size.
3. **iOS background audio** (required, or audio stops when the screen locks):
   - Xcode › Signing & Capabilities › + Background Modes › **Audio, AirPlay, and Picture in Picture** (adds `UIBackgroundModes: audio` to `Info.plist`).
   - In `AppDelegate.swift`, before returning from `application(_:didFinishLaunchingWithOptions:)`:
     `try? AVAudioSession.sharedInstance().setCategory(.playback)` (with `import AVFoundation`).
4. Android audio needs nothing extra: `@capgo/capacitor-media-session` provides the media notification and the foreground service that keeps audio alive in the background.
5. **Notifications: show reminders and the radio alarm** (`@capacitor/local-notifications`):
   - iOS: nothing to add. The permission prompt appears when the listener turns reminders or the alarm on.
   - Android 13+: the plugin declares `POST_NOTIFICATIONS`; the prompt appears the same way. Add `<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />` to `AndroidManifest.xml` so the radio alarm can ring on the minute. Android 14+ leaves it off for apps that aren't alarm clocks, so turning the alarm on checks it and, if it's off, offers to open Settings › Alarms & reminders. (Don't use `USE_EXACT_ALARM`: Google Play allows it only for apps whose core purpose is an alarm clock or calendar.)
   - Android needs a small monochrome icon at `res/drawable/ic_stat_wxpn.png` (white on transparent, 24dp). `capacitor.config.json` already names it; without the file Android shows a blank square.
   - A notification cannot start audio by itself on either platform: the alarm notification wakes the listener, and tapping it starts the station.
6. **Spotify sign-in return** (only with playlist sync): register the URL scheme `org.xpn.wxpn` (iOS: Info › URL Types; Android: an intent filter with `android:scheme="org.xpn.wxpn"` on the main activity). `@capacitor/app` delivers the return trip and `@capacitor/browser` shows the sign-in page.
7. **Calendar** (adding saved concerts): `@ebarooni/capacitor-calendar` opens the system's New Event sheet. iOS needs `NSCalendarsWriteOnlyAccessUsageDescription` (and `NSCalendarsUsageDescription` for iOS 16) in Info.plist, for example "WXPN adds the concerts you choose to your calendar." Android needs `WRITE_CALENDAR` in the manifest.
8. **Store requirements in 2026:** App Store uploads must be built with Xcode 26 and the iOS 26 SDK (since April 28, 2026). Google Play requires new apps and updates to target Android 16 (API 36) from August 31, 2026; Capacitor 8 targets it. Android 15+ draws apps edge to edge with no opt-out; the CSS reads Capacitor's `--safe-area-inset-*` values for that (see `global.css`).
9. **Video on iOS:** YouTube refuses embedded players that can't send a web referrer, which an iOS app (`capacitor://localhost`) can't, so on iOS a station video opens in the in-app browser instead of the sheet.
10. **Status bar**: `@capacitor/status-bar` switches the status bar text between light and dark with the app's theme, so it stays readable when the app and phone themes differ. No setup needed.
11. After any web change: `npm run cap:sync`, then build from Xcode / Android Studio.

The Android back button steps back through screens and closes the show sheet, because navigation uses hash routes with real history entries.

## How it works

- **Playback** (`player-core.js`, wired up in `player.js`): one `<audio>` element for the life of the app, playing the StreamGuys MP3 mounts in `streams.js` (WXPN uses the no-preroll mount; each station has a backup, the mount xpn.org's own player uses, and all six were checked live on October 5, 2026). Play always rejoins the live broadcast; pause detaches the stream so it stops using data. If the stream drops or stalls while the listener wants audio, it reconnects on a backoff (1s, 2s, 4s, 8s, 15s), alternating with the backup mount, and immediately when the device comes back online. A pause from outside the app (a phone call, another app) is respected rather than fought. If the browser refuses to start audio without a tap, the app says so instead of retrying. Lock-screen and headset controls call the same actions as the on-screen button.
- **Now playing** (`nowplaying.js`): polls the station's playlist feeds every 30 seconds while the app is visible (and while hidden if audio is playing, so the lock screen keeps up), per station. Just after midnight ET the previous day's list is merged in. It also reads the station's now-playing file (the one xpn.org's player uses) for the current song's length and any artwork the playlist lacks. A song is shown as playing until its length plus three minutes has passed, or 15 minutes when its length is unknown, so a long jam is not dropped mid-song. That holds on screen, in the mini player and on the lock screen; an older report (the feed pauses overnight, or has failed) moves to Recently played and the station is shown instead. Homegrown (the former Kids Corner stream, same mounts) has audio but no song feed.
- **Shows** (`catalog.js`, `shows.json`): directory and weekly schedule in Eastern time, matched to the program guide on xpn.org on October 5, 2026, including each show's page and artwork. Air times shown on cards and sheets ("Weekdays, 2–4pm") are generated from the schedule, so every show reads the same way. Tests check the data on every run, including that the schedule covers every minute of the week.
- **Times** (`time.js`): the schedule is Eastern, but everything a listener reads as a time ("until 4pm", "Next on air: Friday at 1pm", when a song played, the sleep timer, reminders) is in the device's own zone. The schedule grid stays in Eastern and says so.
- **Concerts in your calendar** (`calendar.js`): a saved concert gets an Add to calendar button (and saving one offers it). In the phone apps it opens the system's New Event sheet, filled in; in a browser it offers an `.ics` file (Apple Calendar, Outlook) or a Google Calendar link, and Favorites can add every saved concert in one file. Concerts are all-day events, since the calendar's times are placeholders; the note links tickets and says to check the venue for times.
- **Concerts** (`concerts.js`): xpn.org's own calendar (The Events Calendar's REST API), the next year of shows, all pages. Regions, WXPN Welcomes and Free at Noon come from its categories; ages from its age field, fetched only for shows on screen. Filters match the website: tonight, this weekend, next 7 days, by region, WXPN Welcomes, Free at Noon, saved. A failing calendar shows an error, never invented events. Saved concerts keep their details, so they stay in Favorites while the calendar is down.
- **Favorites, appearance, volume** (`favorites.js`, `storage.js`): stored on the device under the original `xpn.*` keys, so they carry over from earlier versions. Removing a favorite offers Undo, which puts it back in its old place; the first save says where saved things go. A saved heart takes its color from the item's artwork (`art-tint.js`), adjusted per theme to keep 3:1 contrast; show tints are stored in `shows.json`, song tints are read from the album art (Spotify's image CDN allows it), and art with no vivid color keeps the accent. Everything read back is repaired or dropped if damaged, so bad stored data cannot break a screen. Song ids keep letters from every script.
- **Radio alarm** (`alarm.js`, `hooks/useRadioAlarm.js`): in the native apps a week of alarms is scheduled as notifications, so it works with the app closed; tapping it starts the wake-up station. In a browser it only plays while the page is open and the device awake.
- **Notifications** (`notifications.js`): shared by reminders and the alarm. Each sync replaces that feature's pending notifications as the phone reports them, one sync at a time; if notifications are turned off in the phone's Settings, the feature turns itself off and says why.
- **Performance**: the React Compiler (`babel-plugin-react-compiler`, set up in `vite.config.js`) memoizes components automatically. Screens not in front are kept in a React `Activity` set to hidden, so they keep their state but stop their effects and subscriptions. Concerts, Settings, the welcome and the video sheet load separately from the first download. Long lists skip off-screen rows (`content-visibility`). The app's network requests time out after 10 seconds.
- **Security**: production builds carry a Content Security Policy (added by `vite.config.js`): scripts only from the app and Apple's MusicKit, network only to WXPN's feeds, Spotify, Apple Music and the configured update and token URLs. If you add a service, add its address there. Sample content isn't included in production builds at all.
- **Interface**: screens cross-fade (View Transitions) and the show sheet slides in, as a bottom sheet on phones; both are skipped under reduced motion. Space plays and pauses unless focus is on a control. Layout respects the notch and rounded corners in the native apps, and there are high-contrast and forced-colors adaptations.
- **First launch** (`components/Welcome.jsx`): follow a few shows, turn on reminders for them, then connect Spotify or Apple Music so hearted songs build a playlist. Steps with nothing to offer are left out (no reminders without a followed show, no playlist step when no service is configured). Closing it any way counts as done (`xpn.onboarded`), and it never covers a shared show link.
- **Show reminders** (`reminders.js`, `hooks/useShowReminders.js`): reminders for followed shows, at the start or 5 or 15 minutes before, set in Settings or offered in the show sheet right after following. In the native apps they are local notifications for the coming week, rescheduled whenever follows or settings change and each time the app returns to the foreground; iOS allows 64 pending, so at most 48 are scheduled. Tapping one opens Listen and starts WXPN. Permission is only asked when the listener turns reminders on. In a browser, a reminder appears in the app (with a Listen button) while it is open. Times are Eastern and handle daylight-saving changes.
- **Song menu** (`components/MusicRows.jsx`, `components/PlaylistSync.jsx`): every song, now playing or in a list, has a menu built around the listener's own playlist. Until Spotify or Apple Music is connected it explains the playlist and offers to connect; once connected it shows whether the song is in "WXPN Favorites" (or adds it), plus Share.
- **On air and sleep timer** (`schedule.js`): the Listen screen names the show and host on air from the FM schedule, including shows that run past midnight; overnight gaps in the schedule show nothing rather than a guess. The sleep timer stops playback after 15–60 minutes or at the end of the current show, fading out over the last 20 seconds. Native builds give a light haptic tap on play, pause, save and station changes (`haptics.js`).
- **Brand**: the wordmark sets the "w" lighter so "xpn" carries the name, as in WXPN's logo. The light theme is a warm cream rather than white.

## Layout

```
App.jsx            app shell: layout, navigation, show sheet
screens/           one file per screen
components/        player bar, rows and cards shared by screens
hooks/             player, route, alarm, reminders, concerts, appearance, clock
player-core.js     playback state machine (no browser or framework imports)
player.js          wires the core to <audio>, media session and React
playback-text.js   every word the player shows
streams.js         the station's stream URLs (with backups) and lettering
art-tint.js        heart colors from artwork
calendar.js        saved concerts into the listener's calendar
nowplaying.js      playlist feed, freshness
concerts.js        concert calendar (xpn.org)
updates.js         station updates: format, timing, YouTube links
playlist-sync.js   keeping the saved-songs playlist in step
music-services.js  Spotify and Apple Music
samples.js         placeholder episodes and updates (dev and preview only)
tools/             updates-composer.html, for writing station updates
catalog.js         show directory and schedule, from shows.json
schedule.js        what is on air, next airings, air-time wording
favorites.js       saved songs, shows, episodes and concerts
alarm.js           alarm settings, "should it ring", the native alarm plan
reminders.js       which show reminders to schedule, and their text
notifications.js   the phone's notifications, for reminders and the alarm
links.js           every xpn.org address the app uses
storage.js         small stores, in memory or on the device
time.js            Eastern and local time helpers
config.js          build-time switches
tests/             node:test suites, importing the real modules
brand/             logo source files (not shipped with the app)
```

## Known gaps before a store release

- **Real content feeds.** Episodes and concerts are placeholders until feeds exist; production builds hide them (see Configuration).
- **iOS/Android device testing**, especially background audio, lock-screen controls and song updates while locked, interruptions such as phone calls, the Android back button, and notifications (reminders and the alarm arriving with the app closed, tapping one to start the stream).
- **Larger text on iPhone:** browser zoom and Android's font size scale the app, but iOS's Text Size setting does not reach a web view. Adding `@capacitor/text-zoom` and applying its preferred zoom at launch would cover it.
- **Station updates hosting:** choose where `updates.json` lives and who edits it.
- **Playlist sync accounts:** a Spotify app (with extended quota) and an Apple Music developer token.
- **Crash and usage reporting** are not wired up.
- **A Content-Security-Policy** should be added once the final feed domains are known.

## Design basis

The main journey is **listen → identify a song → save it → find it again**. Album art always belongs to the reported song; stream controls and song controls have distinct labels. Recently played and saved tracks share the listening screen; shows and concerts have their own screens, with a persistent mini player.

References reviewed: [KEXP mobile app](https://www.kexp.org/mobile/), [KEXP roadmap](https://kexp.org/mobile/mobile-roadmap/), [KCRW app](https://www.kcrw.com/stories/welcome-to-the-new-kcrw-com-and-kcrw-app), [WXPN program guide](https://xpn.org/program_guide/), [WXPN playlist](https://xpn.org/wxpn-playlists/).
