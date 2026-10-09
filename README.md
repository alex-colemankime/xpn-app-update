# WXPN app

A radio-first app for WXPN 88.5 FM, XPN2 and Homegrown: listen live, see what's playing, save songs, follow shows and get reminded when they start, play archived broadcasts, watch the station's videos, wake up to the station, and find concerts. React + Vite on the web, packaged for iOS and Android with Capacitor.

## Run

```sh
npm ci
npm run dev        # http://127.0.0.1:5173, sample content visible
npm run check      # lint, formatting, tests and a production build
```

| Script                       | What it does                                              |
| ---------------------------- | --------------------------------------------------------- |
| `npm run dev`                | Dev server with hot reload                                |
| `npm run build`              | Production build into `dist/`                             |
| `npm run build:pages`        | Build for the GitHub Pages preview (`/xpn-app-update/`)   |
| `npm test`                   | Unit tests (`node --test`, no extra dependencies)         |
| `npm run e2e`                | End-to-end tests: builds, serves and drives the app       |
| `node tools/store-shots.mjs` | Store screenshots from raw shots (see `store/listing.md`) |
| `npm run lint`               | ESLint, including React hooks rules                       |
| `npm run format`             | Prettier, in place                                        |
| `npm run check`              | Everything CI runs except `npm audit`, in one go          |
| `npm run cap:sync`           | Build and copy into the native projects                   |

End-to-end tests (`tests/e2e`, Playwright) play the station, change station, save a song and find it in Favorites, open and follow a show, follow a show link, keep the dark theme, and open every screen without an error, at phone and desktop sizes. Every outside service is answered by fixtures (`tests/e2e/fixtures.mjs`; the streams are a few seconds of silence), so they run offline. To use a browser already installed, set `PLAYWRIGHT_CHROMIUM` to its path; otherwise `npx playwright install chromium` once.

CI runs `lint`, `format:check`, `test`, the end-to-end tests and `build` on every push and pull request, plus `npm audit` of everything the app ships (a high or critical advisory fails a branch's checks, and is flagged on `main` without blocking the preview). Pushes to `main` also deploy the preview to GitHub Pages:

- **Live preview:** https://alex-colemankime.github.io/xpn-app-update/ (on a computer, with Phone, Tablet and Laptop buttons)
- **Every screen:** https://alex-colemankime.github.io/xpn-app-update/screens/ (light and dark, from `design/screens/`)

## Configuration

Build-time settings are Vite env variables, set in the shell or a `.env.local` file (git-ignored).

| Variable                     | Effect                                                                                                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_XPN_CONCERTS_ENDPOINT` | The concert calendar. Default: xpn.org's own calendar (`https://xpn.org/wp-json/tribe/events/v1/events`). `off` removes the Concerts tab.                                                                                                                                     |
| `VITE_XPN_UPDATES_URL`       | The station updates and app switches. Production default: `control/updates.json` as published with the Pages site; another address (an xpn.org file, an Advanced Ads group), or `off`. Development and the preview show samples. See "Station updates" and "Remote config".   |
| `VITE_PUSH_REGISTER_URL`     | Turns on push notifications: where the app registers a phone's push token and topics. Unset: live video and drive notifications are planned on the phone. See "Push notifications".                                                                                           |
| `VITE_GA4_ID`                | Usage and crash reporting. Production builds report to WXPN's "WXPN App" GA4 property (`G-JDR8LLHT18`) by default; a `G-…` id names another, and `off` turns it off (the preview and the end-to-end tests). Development builds never report. See "Usage and crash reporting". |
| `VITE_XPN_ARCHIVE_FEEDS`     | Where on-demand episodes come from, as `show=URL` pairs (a show page on xpn.org, or a podcast feed). Default: the four shows xpn.org archives (Sleepy Hollow, Funky Friday, Land of the Lost, World Cafe). `off` removes the Archive tab. See "Audio archive".                |
| `VITE_BRIGHTCOVE_VIDEOS`     | The Videos tab's sections, as `Section name=playlist id` pairs. Default: the NPR Music Video Network's World Cafe and WXPN collections (the ones on livesessions.npr.org). `off` removes the tab. See "Videos".                                                               |
| `VITE_BRIGHTCOVE_ACCOUNT`    | The Brightcove account those playlists live in. Default: the NPR Music Video Network (`6416366397001`).                                                                                                                                                                       |
| `VITE_BRIGHTCOVE_PLAYER`     | That account's player, which plays the videos and whose public policy key reads the playlists. Default: `default`.                                                                                                                                                            |
| `VITE_XPN_LIVESTREAM_PAGE`   | Where the app finds the week's Free at Noon video. Default: the livestream page on xpn.org (WordPress REST). `off` turns it off. See "Station updates".                                                                                                                       |
| `VITE_SPOTIFY_CLIENT_ID`     | Turns on the Spotify playlist. See "Playlist sync".                                                                                                                                                                                                                           |
| `VITE_APPLE_MUSIC_TOKEN_URL` | Turns on the Apple Music playlist: an endpoint returning `{ "token": "…" }`, a MusicKit developer token. (`VITE_APPLE_MUSIC_DEVELOPER_TOKEN` takes a token directly.)                                                                                                         |
| `VITE_SITE_URL`              | The address the build is served from. Adds the share image and link-preview tags (the Pages workflow sets it to the preview's address).                                                                                                                                       |
| `VITE_DEVICE_PREVIEW=true`   | The shared design preview: on a computer, the page opens the app in a phone, tablet or laptop frame with buttons to switch (`?device=tablet`, keys 1–3). Phones and tablets get the app itself. **Never for a store build.**                                                  |
| `VITE_SHOW_SAMPLES=true`     | Sample station updates (a member drive banner and a live video) in a production build. Always on in `npm run dev`; set for the Pages preview; **never for a store build.**                                                                                                    |

## Station updates

The station can put a message in the app without a release: a banner across every screen (a member drive) and a live video to watch (Free at Noon). Both come from one small JSON file at `VITE_XPN_UPDATES_URL`, checked at launch, when the app comes back to the front, and every five minutes.

- **Write it** with `tools/updates-composer.html` (open the file in a browser): fill in the message, link and times in Eastern, see a preview, then copy or download `updates.json`. The format is documented at the top of `updates.js`.
- **Host it** anywhere the station can edit over HTTPS, for example the WordPress media library or a page that serves the JSON. It must be served with `Access-Control-Allow-Origin: *` (or the app's origins) so the web app can read it; the phone apps need the same.
- **Free at Noon needs no update at all.** From two hours before each Free at Noon until it ends, the app reads xpn.org/livestream (the page staff already update each week) and offers that page's YouTube video, titled from the video's own title ("Free at Noon: Mikaela Davis"). A page not edited since last week's show ended is taken to be last week's and ignored. A live item in `updates.json` takes priority, for anything else the station streams.
- **Behavior:** a banner shows between its start and end; listeners can dismiss it, and a new `id` shows again. A live video appears on Listen two hours before it starts ("Today at 12pm"), and while it is on it takes over the banner on the other screens. YouTube links play in the app, on the watch page (`#/listen/live`, so Back closes it); other links, and YouTube on iOS, open in the browser view. Either way the radio pauses and is offered back afterwards.
- **Notifications (member drives, live video).** Listeners opt in under Settings › From WXPN; both are off until they do, with the consent wording beside each switch, as App Review 4.5.4 requires for anything promotional. A banner's `notify` list (up to six `{ at, title, text }`; the composer has room for three) becomes notifications for listeners who turned on member drives; a live video notifies those who turned on live video, 10 minutes before it starts (`"notify": false` skips one; a followed show with reminders on gets its reminder instead). The app schedules them on the phone, like show reminders, so no push service is needed. The catch: a phone learns of a notification when the app next opens, so post a drive's notifications before the drive starts. Tapping opens the video, or the banner's link (the donate page) in the browser view.
- **Reaching phones that haven't opened the app** is push; see "Push notifications". With it set up, the phone stops planning these itself, so nothing arrives twice.
- **From WordPress instead of a file:** point `VITE_XPN_UPDATES_URL` at an Advanced Ads group's REST address (Advanced Ads Pro › Settings › Pro › REST API; `https://xpn.org/wp-json/advanced-ads/v1/groups/<id>`). Each ad in the group is one update, and the ad's own start and expiry dates decide when it shows. An ad's content is either a plain message whose first link is the button (a banner), or the update as JSON from the composer's **Copy for Advanced Ads** (a live video, or a banner with notifications). WordPress's curly quotes are undone, and half-written JSON is skipped. The REST response's exact shape should be checked against a real group once it exists; `advancedAdsUpdates` in `updates.js` reads `content` (plain or `{ rendered }`) and `id` from each ad, as a list or `{ ads: [...] }`.

## Remote config

Changes the station can make to apps already on phones, without a store release, in the same station updates (a `"config"` object beside `"updates"` in the file, or an Advanced Ads ad whose JSON is `{ "config": { … } }`). See `remote-config.js` and `features.js`.

**Where it lives:** production builds read `control/updates.json` from this repository, as the deploy publishes it (`https://alex-colemankime.github.io/xpn-app-update/updates.json`). To change it, edit the file on GitHub (or build it in `tools/updates-composer.html`, which now has an **App switches** section, and paste it in) and commit to `main`. CI checks the file (`tests/control-file.test.mjs`) before the deploy publishes it, and phones pick it up within minutes. To move it to xpn.org or an Advanced Ads group later, set `VITE_XPN_UPDATES_URL` for the build.

- **`streams`:** new addresses for a station (`{ "xpn": { "url": "…", "backupUrl": "…" } }`), for when StreamGuys moves a mount. Used from the next connection. Only https addresses on xpn.org or StreamGuys hosts are accepted; removing the entry goes back to the built-in address.
- **`off`:** features to turn off, for a feed or service that breaks: `videos`, `concerts`, `archive`, `playlistSync`, `push`, `liveVideo` (reading Free at Noon from xpn.org) and `reviewPrompt`. Phones follow while the app is open: a tab disappears (a listener on it goes back to Listen), and comes back when the feature is removed from the list.
- **`update`:** `{ "minVersion": "1.2.0", "message": "…", "required": false, "ios": "<App Store link>" }`. Phone apps older than `minVersion` ask to update (Android links to the Play listing on its own). `required: true` can't be dismissed: for a version that can no longer work. Otherwise it can be set aside once per minimum version.

The last config is kept on the phone, so it holds offline and from the first moment of the next launch.

## Push notifications

Live video and member drive notifications that reach phones whether or not the app has been opened lately. The app side is done (`push.js`); it needs a sender, which can be any service that sends to Apple (APNs) and Google (FCM):

- **The contract.** With `VITE_PUSH_REGISTER_URL` set, the phone app sends `POST { token, platform: "ios" | "android", topics: ["live", "drives"], app, version }` there whenever the listener's switches (Settings › From WXPN) or the phone's token change; an empty `topics` means send nothing. The token is an APNs device token on iOS and an FCM token on Android. A notification's data says what a tap opens: `{ "action": "watch", "watch": "<YouTube or video URL>", "title": "…" }`, `{ "action": "open", "url": "https://xpn.org/donate/" }` or `{ "action": "listen", "stream": "xpn" }`.
- **Sender options.** A hosted service with a sending dashboard staff can use (OneSignal, Airship; register tokens with its API, or swap `push.js`'s registration for its SDK); Firebase Cloud Messaging (free; with the Firebase iOS SDK added, iOS tokens become FCM tokens too, so one API sends to both); or a small WordPress plugin that stores tokens and sends through APNs and FCM, so sending lives next to the content in WordPress.
- **Native setup.** iOS: Xcode › Signing & Capabilities › + Push Notifications, and an APNs key (.p8) from the Apple Developer account for the sender. Android: a Firebase project's `google-services.json` in `android/app/` (FCM needs it even if the sender is elsewhere). Notifications arriving while the app is open show as banners (`capacitor.config.json` › `PushNotifications.presentationOptions`).

## Usage and crash reporting

Production builds report to the **WXPN App** GA4 property (account 552242 › property 558304207, web stream "WXPN app", measurement id `G-JDR8LLHT18`; kept apart from xpn.org's WXPN 2024 property so app users don't add to the website's totals). Set up in it: custom dimensions Station, Show, Content, Item type, Feature, Place and Music service, the custom metric Listening minutes (`minutes`), 14-month data retention, and enhanced measurement off (the app reports its own screens). Once the first donate taps arrive, star `donate_click` in Admin › Events to make it a key event. The app (`analytics.js`) sends: screens as `page_view`, and `play_station`, `save` / `unsave`, `episode_play`, `video_play`, `donate_click`, `share`, `turn_on` (reminders, alarm, live, drives), `music_connect`, and errors as `exception` (anonymous, each once per session; React's and the page's uncaught errors included). Listening time is reported as `listen_time` (`listening.js`): `{ content: "live" | "episode", station, show, minutes }`, every five minutes while audio plays and when it stops, so summing Listening minutes gives listening hours by station and show. No cookies, advertising ids, Google signals or ad personalization; each install has a random id. Listeners can turn it off in Settings › Privacy, which forgets the id. The Content Security Policy allows Google's addresses only when an id is set. Native crashes (outside the web view) need a native crash reporter such as Firebase Crashlytics or Sentry, added in Xcode and Android Studio.

## Videos

The Videos tab shows the station's video collections, newest first, the newest one large, with search; World Cafe's show page shows its newest four.

- **Source:** Brightcove playlists, read with Brightcove's Playback API (`videos.js`). By default these are the NPR Music Video Network's "World Cafe" and "WXPN all videos" collections, the same ones livesessions.npr.org shows, so whatever reaches those pages reaches the app. The app reads the player's public policy key from the player's own config, so no key is built in.
- **Watching:** a full-screen watch page, as video apps have it: the video at the top (pinned there on phones, all the way down the page), the title with a heart to save it (to Favorites › Videos) and the kind of session under it, the show it is tagged with (Follow), the description, and Up next from the same collection: three, then See more, under the video; the full list beside it on wider screens. It has its own address (`#/videos/video/<id>`), so Back closes it and a video can be linked. Free at Noon's live video opens the same page (`#/listen/live`). The radio (or an archive episode) pauses and is offered back afterwards.
- **Playback:** in the account's Brightcove Player, loaded into the app's own frame (`public/video-player.html`) so the app can hide the title and description the player draws over the picture on pause or touch (the watch page shows both under the video). The frame is sandboxed without access to the app or its storage, loads scripts only from Brightcove's player host, and refuses to run anywhere but inside that sandbox. If the player can't start there, the frame hands over to Brightcove's own player page, overlay and all. Streams are HLS/DASH only, which the player handles on every platform. Plays are counted in that account's Brightcove Analytics, marked `wxpn-app`.
- **WXPN's own account instead:** make matching playlists in WXPN's Video Cloud (for example a smart playlist on the `worldcafe` tag) and set `VITE_BRIGHTCOVE_ACCOUNT=6416377368001` and `VITE_BRIGHTCOVE_VIDEOS`. Plays then count in WXPN's account. The Default Player has no domain restrictions; if one is added, the app's origins must be allowed.

## Audio archive

Shows › Archive lists recent broadcasts of the shows xpn.org archives, newest show first, each with its latest three (the rest in the show's sheet). They play in the app on their own player, with skip back 15 and ahead 30, lock-screen controls, and their place kept.

- **Source:** each archived show's page on xpn.org already lists its last ten broadcasts (from StreamGuys); the app reads that list (`parseArchivePage` in `archive.js`), so the station publishes nothing new. A dated title ("Sleepy Hollow - 10.04.2026") becomes the day it aired, in the show's slot; a feature ("Friko on World Cafe") keeps its name.
- **Signed links:** the audio links carry a key and run out after a few hours. Each episode notes when its link was read; one read more than 20 minutes ago is read again from its show's page just before it plays (resuming, or recovering mid-listen, included). Favorites keep no link at all. A saved broadcast that has left the archive says so in Favorites and on its page, and tapping one that has gone explains why it can't play.
- **Sturdier later:** a small JSON route on xpn.org returning the same list (title, date, audio, length) would replace reading the page's markup, and could add lengths before playback. Shows not archived on xpn.org (Echoes, The Folk Show…) appear once they are.

## Playlist sync

Like the playlist workout apps build from the songs you like: every song a listener saves goes into a "WXPN Favorites" playlist in their Spotify or Apple Music, kept in step as they save and unsave (`playlist-sync.js`, `music-services.js`). No server is needed.

- **Spotify:** create an app at developer.spotify.com, copy its Client ID to `VITE_SPOTIFY_CLIENT_ID`, and add these Redirect URIs: the web app's address (e.g. `https://xpn.org/app/`), and `org.xpn.wxpn://spotify-callback` for the phone apps. Sign-in uses PKCE, so there is no client secret to protect. Requests follow Spotify's February 2026 Web API (`POST /me/playlists`, `/playlists/{id}/items`).
  - **Limits as of 2026:** a Development Mode app works for at most 5 Spotify accounts the station allowlists, and the app owner needs Spotify Premium. Opening it to all listeners needs Extended Quota, which Spotify grants only to registered organizations with at least 250,000 monthly active users (applications take up to six weeks). If WXPN doesn't qualify, ship with Apple Music only and leave `VITE_SPOTIFY_CLIENT_ID` unset; the app then shows no Spotify option. A listener Spotify hasn't allowlisted sees "Spotify hasn't opened WXPN's playlist feature to your account yet" rather than a sign-in loop.
- **Apple Music:** needs a MusicKit developer token (Apple Developer account › MusicKit identifier and key). Tokens expire within six months, so serve one from a small endpoint (`VITE_APPLE_MUSIC_TOKEN_URL`) rather than building it in. Apple's API cannot remove songs from a playlist, so unsaving leaves the song there (the app says so). MusicKit JS signs in through a popup, which works on the web; in the iOS app it needs testing, and a native MusicKit plugin may be needed.
- **Accounts:** the playlist belongs to the account that made it. After every sign-in, the next sync checks the playlist on record against the account now signed in (Spotify: its owner; Apple Music: that it is in this library) and starts a fresh one for a different account.
- **Matching:** a song goes in only when the catalog has the same title (versions and featured artists aside) by the same lead artist; anything less certain is left out rather than risk the wrong song.
- Each service shows in Settings only when configured; Favorites invites listeners to set it up.

## Native apps

`capacitor.config.json` is ready; the native projects are generated on a Mac and are not in this repository yet.

Use Node 22 or newer (`.nvmrc` pins 24, as CI does).

1. **Confirm the app ID.** `appId` is `org.xpn.wxpn`. It becomes the permanent store identity at the first upload, so confirm it before step 2.
2. Generate the projects: `npm run build && npx cap add ios && npx cap add android`. Capacitor must be 8.4.3 or later: 8.3.5–8.4.2 let remote content load at the app's origin ([GHSA-rvm3-566m-v7fv](https://github.com/advisories/GHSA-rvm3-566m-v7fv)).
   - App icon and splash: `brand/app-icon-1024.png` is the 1024×1024 source. `npx @capacitor/assets generate --iconBackgroundColor '#ef7149' --splashBackgroundColor '#faf8f3'` (with the icon copied to `assets/icon.png`) writes every native size.
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
8. **Store requirements in 2026:** App Store uploads must be built with Xcode 26 and the iOS 26 SDK (since April 28, 2026). Google Play requires new apps and updates to target Android 16 (API 36) from August 31, 2026; Capacitor 8 targets it. Android 15+ draws apps edge to edge with no opt-out; the CSS reads Capacitor's `--safe-area-inset-*` values for that (see `styles/base.css`).
9. **Video on iOS:** YouTube refuses embedded players that can't send a web referrer, which an iOS app (`capacitor://localhost`) can't, so on iOS a live YouTube video (Free at Noon) opens in the in-app browser instead of the watch page. Brightcove videos play in the app everywhere.
10. **Status bar**: `@capacitor/status-bar` switches the status bar text between light and dark with the app's theme, so it stays readable when the app and phone themes differ. No setup needed.
11. **Larger text on iPhone:** nothing to set up. `@capacitor/text-zoom` applies iOS's Text Size setting at launch and whenever the app comes back to the front (`text-size.js`); check the screens at the largest sizes.
12. **CarPlay and Android Auto** (`car.js`, with native code in `native/`, written but untested until the projects exist):
    - **iOS:** request the CarPlay audio entitlement from Apple (developer.apple.com/contact/carplay) and add it to the App ID and an `App.entitlements` file (`com.apple.developer.carplay-audio`). Add `native/ios/*.swift` to the App target. In Main.storyboard set the Bridge View Controller's Custom Class to `MainViewController` (it registers the plugin). Add `native/ios/Info.plist.carplay.xml`'s scene manifest to `Info.plist`. Optional station artwork: image sets `car-xpn`, `car-xpn2`, `car-homegrown`. Test with Xcode's CarPlay simulator (I/O › External Displays › CarPlay), including starting from the car with the app closed.
    - **Android:** the app module needs Kotlin (`apply plugin: 'kotlin-android'` in `android/app/build.gradle`, and the Kotlin Gradle plugin in the project's), plus `implementation "androidx.media:media:1.7.0"`. Copy `native/android/*.kt` into `android/app/src/main/java/org/xpn/wxpn/` and `res/xml/automotive_app_desc.xml` into `res/xml/`, add `AndroidManifest.car.xml`'s entries inside `<application>`, and in `MainActivity` call `registerPlugin(CarAudioPlugin.class);` before `super.onCreate`. Test with Android Studio's Desktop Head Unit. Google reviews Android Auto apps against its car app quality guidelines when the app is submitted.
    - The car lists WXPN, XPN2 and Homegrown; choosing one plays it, and play and pause work as the app's. On CarPlay the song comes from the lock screen's information; Android Auto gets it from the app.
13. **Links that open the app** (`deep-links.js`): xpn.org show pages, Listen, the playlist page and the concert calendar open in the app on phones that have it; donate links always open the website. Host `native/well-known/apple-app-site-association` (with your Apple Team ID in place of `TEAMID`) and `native/well-known/assetlinks.json` (with the Play app signing key's SHA-256, from Play Console › App integrity) at `https://xpn.org/.well-known/` (and `www.`), served as `application/json` with no redirect. iOS: Signing & Capabilities › + Associated Domains › `applinks:xpn.org` and `applinks:www.xpn.org`. Android: add `native/android/AndroidManifest.links.xml`'s intent filter to the main activity. Show pages have a Share button that shares the show's xpn.org address, so a shared show opens in the app for anyone who has it.
14. **Store review prompt** (`review.js`, `@capacitor-community/in-app-review`): nothing to set up. The app asks right after a heart, once the listener has listened two hours in all and saved three things, at most once per version and 120 days apart; the phone decides whether to show it.
15. After any web change: `npm run cap:sync`, then build from Xcode / Android Studio.

The Android back button steps back through screens and closes the show sheet, because navigation uses hash routes with real history entries.

## How it works

- **Playback** (`player-core.js`, wired up in `player.js`): one `<audio>` element for the life of the app, playing the StreamGuys MP3 mounts in `streams.js` (WXPN uses the no-preroll mount; each station has a backup, the mount xpn.org's own player uses, and all six were checked live on October 5, 2026). Play always rejoins the live broadcast; pause detaches the stream so it stops using data. If the stream drops or stalls while the listener wants audio, it reconnects on a backoff (1s, 2s, 4s, 8s, 15s), alternating with the backup mount, and immediately when the device comes back online. A pause from outside the app (a phone call, another app) is respected rather than fought. If the browser refuses to start audio without a tap, the app says so instead of retrying. Lock-screen and headset controls call the same actions as the on-screen button.
- **Now playing** (`nowplaying.js`): polls the station's playlist feeds every 30 seconds while the app is visible (and while hidden if audio is playing, so the lock screen keeps up), per station. Just after midnight ET the previous day's list is merged in. It also reads the station's now-playing file (the one xpn.org's player uses) for the current song's length and any artwork the playlist lacks. A song is shown as playing until its length plus three minutes has passed, or 15 minutes when its length is unknown, so a long jam is not dropped mid-song. That holds on screen, in the mini player and on the lock screen; an older report (the feed pauses overnight, or has failed) moves to Recently played and the station is shown instead. Homegrown (the former Kids Corner stream, same mounts) has audio but no song feed. The playlist names a show between bars for its own segments ("|World Cafe|", a session hour); the app shows those under the show's name, gives their hearts the show's color, and leaves them out of playlist sync.
- **Shows** (`catalog.js`, `shows.json`): directory and weekly schedule in Eastern time, matched to the program guide on xpn.org on October 5, 2026, including each show's page and artwork. Air times shown on cards and sheets ("Weekdays, 2–4pm") are generated from the schedule, so every show reads the same way. Tests check the data on every run, including that the schedule covers every minute of the week.
- **Times** (`time.js`): the schedule is Eastern, but everything a listener reads as a time ("until 4pm", "Next on air: Friday at 1pm", when a song played, the sleep timer, reminders) is in the device's own zone. The schedule grid stays in Eastern and says so.
- **Concerts in your calendar** (`calendar.js`): a saved concert gets an Add to calendar button (and saving one offers it). In the phone apps it opens the system's New Event sheet, filled in; in a browser it offers an `.ics` file (Apple Calendar, Outlook) or a Google Calendar link, and Favorites can add every saved concert in one file. Concerts are all-day events, since the calendar's times are placeholders; the note links tickets and says to check the venue for times.
- **Concerts** (`concerts.js`): xpn.org's own calendar (The Events Calendar's REST API), the next year of shows, all pages. Regions, WXPN Welcomes and Free at Noon come from its categories; ages from its age field, fetched only for shows on screen. Filters match the website: tonight, this weekend, next 7 days, by region, WXPN Welcomes, Free at Noon, saved. A failing calendar shows an error, never invented events. Saved concerts keep their details, so they stay in Favorites while the calendar is down.
- **Favorites, appearance, volume** (`favorites.js`, `storage.js`): stored on the device under the original `xpn.*` keys, so they carry over from earlier versions. Removing a favorite offers Undo, which puts it back in its old place; the first save says where saved things go. A saved heart takes its color from the item's artwork (`art-tint.js`), adjusted per theme to keep 3:1 contrast; show tints are stored in `shows.json`, song tints are read from the album art (Spotify's image CDN allows it), and art with no vivid color keeps the accent. Everything read back is repaired or dropped if damaged, so bad stored data cannot break a screen. Song ids keep letters from every script.
- **Radio alarm** (`alarm.js`, `hooks/useRadioAlarm.js`): in the native apps a week of alarms is scheduled as notifications, so it works with the app closed; tapping it starts the wake-up station. In a browser it only plays while the page is open and the device awake.
- **Notifications** (`notifications.js`): shared by reminders, the alarm and the station's notifications. iOS keeps only the soonest 64 pending, so the plans share one budget of 60: the alarm first, then everything else soonest first (the rest is scheduled as the week rolls on). Each sync replaces the pending notifications as the phone reports them, one sync at a time, and reads the result back; a failure shows in Settings. If notifications are turned off in the phone's Settings, the feature turns itself off and says why.
- **Performance**: the React Compiler (`babel-plugin-react-compiler`, set up in `vite.config.js`) memoizes components automatically. Screens not in front are kept in a React `Activity` set to hidden, so they keep their state but stop their effects and subscriptions. Concerts, Videos, Settings, the welcome and the watch page load separately from the first download. Long lists skip off-screen rows (`content-visibility`). The app's network requests time out after 10 seconds.
- **Security**: production builds carry a Content Security Policy (added by `vite.config.js`): scripts only from the app and Apple's MusicKit, network only to WXPN's feeds, Brightcove, Spotify, Apple Music and the configured update and token URLs; video frames only from the app's own video frame, Brightcove and YouTube. If you add a service, add its address there. Sample content isn't included in production builds at all.
- **Interface**: screens cross-fade (View Transitions) and the show sheet slides in, as a bottom sheet on phones; both are skipped under reduced motion. Space plays and pauses unless focus is on a control. Layout respects the notch and rounded corners in the native apps, and there are high-contrast and forced-colors adaptations.
- **First launch** (`components/Welcome.jsx`): follow a few shows, turn on reminders for them, then connect Spotify or Apple Music so hearted songs build a playlist, and last, the Instagram, Facebook and YouTube accounts of WXPN and World Cafe (also in Settings › Stay connected; the addresses are in `links.js`). Show artwork is bundled in `public/shows`; `tools/fetch-show-art.mjs` (run by the Fetch artwork workflow) brings in any show whose image still points at xpn.org. Steps with nothing to offer are left out (no reminders without a followed show, no playlist step when no service is configured). Closing it any way counts as done (`xpn.onboarded`), and it never covers a shared show link.
- **Show reminders** (`reminders.js`, `hooks/useShowReminders.js`): reminders for followed shows, at the start or 5 or 15 minutes before, set in Settings or offered in the show sheet right after following. In the native apps they are local notifications for the coming week, rescheduled whenever follows or settings change and each time the app returns to the foreground; iOS allows 64 pending, so at most 48 are scheduled. Tapping one opens Listen and starts WXPN. Permission is only asked when the listener turns reminders on. In a browser, a reminder appears in the app (with a Listen button) while it is open. Times are Eastern and handle daylight-saving changes.
- **Song menu** (`components/MusicRows.jsx`, `components/PlaylistSync.jsx`): every song, now playing or in a list, has a menu built around the listener's own playlist. Until Spotify or Apple Music is connected it explains the playlist and offers to connect; once connected it shows whether the song is in "WXPN Favorites" (or adds it), plus Share.
- **On air and sleep timer** (`schedule.js`): the Listen screen names the show and host on air from the FM schedule, including shows that run past midnight; overnight gaps in the schedule show nothing rather than a guess. The sleep timer stops playback after 15–60 minutes or at the end of the current show, fading out over the last 20 seconds. Native builds give a light haptic tap on play, pause, save and station changes (`haptics.js`).
- **Brand**: the wordmark sets the "w" lighter so "xpn" carries the name, as in WXPN's logo. The light theme is a warm cream rather than white.

## Layout

```
main.jsx             entry: error boundary, design preview frame
App.jsx              app shell: screens, banners, show page, watch page
screens/             one file per tab
components/          everything shared or split out of a screen: navigation,
                     player bar, rows and cards, show page, watch page,
                     sleep timer, settings panels
hooks/               player, route, alarm, reminders, station updates and
                     alerts, watching, concerts, appearance, clock
player-core.js       playback state machine (no browser or framework imports)
player.js            wires the core to <audio>, media session and React
episode-core.js      archive episode playback state (no browser imports)
episode-player.js    wires it to its own <audio> and the lock screen
playback-text.js     every word the player shows
streams.js           the station's stream URLs (with backups) and lettering
nowplaying.js        playlist feed, freshness
catalog.js           show directory and schedule, from shows.json
schedule.js          what is on air, next airings, air-time wording
archive.js           archived broadcasts, read from xpn.org's show pages
videos.js            Brightcove playlists, for Videos and show pages
concerts.js          concert calendar (xpn.org)
calendar.js          saved concerts into the listener's calendar
updates.js           station updates: format, timing, notifications, YouTube
push.js              push notifications: registering with the sender, taps
analytics.js         usage and crash reporting (GA4)
car.js               CarPlay and Android Auto, with native/ for the car side
text-size.js         iPhone Text Size
remote-config.js     station changes: stream addresses, features off, update prompt
listening.js         listening time, for reporting
deep-links.js        xpn.org links that open the app
review.js            when to ask for a store rating
favorites.js         saved songs, shows, episodes, videos and concerts
art-tint.js          heart colors from artwork
playlist-sync.js     keeping the saved-songs playlist in step
music-services.js    Spotify and Apple Music
alarm.js             alarm settings, "should it ring", the native alarm plan
reminders.js         which show reminders to schedule, and their text
notifications.js     the phone's notifications, for every feature that uses them
links.js             every xpn.org address the app uses, and opening pages
text.js              feed text: entities, plain text, one-line titles, safe URLs
time.js              Eastern and local time, dates, lengths
net.js               fetch with a timeout
storage.js           small stores, in memory or on the device
toast.js, haptics.js notices and taps
samples.js           a sample station update (dev and preview only)
config.js            build-time switches
assets.js            files in public/, at the deploy base
preview-shell.js     the phone, tablet and laptop frame of the shared preview
global.css           imports every style sheet in styles/, in cascade order
styles/              tokens and shell first, then each screen and feature
tools/               updates-composer.html, for writing station updates
design/screens/      the screens page (every screen, light and dark)
tests/               node:test suites, importing the real modules
brand/               logo source files (not shipped with the app)
```

## Known gaps before a store release

- **iOS/Android device testing**, especially background audio, lock-screen controls and song updates while locked, interruptions such as phone calls, the Android back button, and notifications (reminders and the alarm arriving with the app closed, tapping one to start the stream).
- **CarPlay and Android Auto:** the native code is written but has never been compiled; it needs the steps above, Apple's CarPlay entitlement and testing in the simulators and a car.
- **Push sender:** choose the service (see "Push notifications") and set `VITE_PUSH_REGISTER_URL`.
- **Station updates hosting:** choose where `updates.json` lives and who edits it.
- **Playlist sync accounts:** a Spotify app (with extended quota) and an Apple Music developer token.
- **Reporting:** GA4 is set up (WXPN App property); data starts with the first production build people use. Native crashes need Crashlytics or Sentry.
- **Store listing:** screenshots (iPhone, iPad, Android), Play's feature graphic and the listing text are in `store/` (`store/listing.md`); confirm the support page before submitting.
- **Store privacy answers:** with reporting on, Apple's App Privacy and Google's Data safety should declare Usage Data (product interaction) and Diagnostics (crash data), not linked to identity and not used for tracking; with push, a device id (push token) for app functionality. Favorites and settings stay on the phone.

## Design basis

The main journey is **listen → identify a song → save it → find it again**. Album art always belongs to the reported song; stream controls and song controls have distinct labels. Recently played shares the listening screen; saved songs live in Favorites, and shows, videos and concerts have their own screens, with a persistent mini player.

References reviewed: [KEXP mobile app](https://www.kexp.org/mobile/), [KEXP roadmap](https://kexp.org/mobile/mobile-roadmap/), [KCRW app](https://www.kcrw.com/stories/welcome-to-the-new-kcrw-com-and-kcrw-app), [WXPN program guide](https://xpn.org/program_guide/), [WXPN playlist](https://xpn.org/wxpn-playlists/).
