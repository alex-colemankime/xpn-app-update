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

End-to-end tests (`tests/e2e`, Playwright) play the station, change station, save a song and find it in Favorites, keep each screen's place between tabs, open and follow a show, pass an accessibility check (axe, WCAG 2.1 AA) on every screen in light and dark, follow a show link, keep the dark theme, and open every screen without an error, at phone and desktop sizes. Every outside service is answered by fixtures (`tests/e2e/fixtures.mjs`; the streams are a few seconds of silence), so they run offline. To use a browser already installed, set `PLAYWRIGHT_CHROMIUM` to its path; otherwise `npx playwright install chromium` once.

CI runs `lint`, `format:check`, `test`, the end-to-end tests and `build` on every push and pull request, plus `npm audit` of everything the app ships (a high or critical advisory fails a branch's checks, and is flagged on `main` without blocking the preview). Pushes to `main` also deploy the preview to GitHub Pages:

- **Live preview:** https://alex-colemankime.github.io/xpn-app-update/ (on a computer, with Phone, Tablet and Laptop buttons)
- **Every screen:** https://alex-colemankime.github.io/xpn-app-update/screens/ (light and dark, from `design/screens/`). To retake shots, run the **Screens** workflow (Actions › Screens, naming the shots or none for all): `tools/capture-screens.mjs` drives the built app in Chromium at the page's moment and song, and puts PNGs on the `screens-out` branch to convert to WebP for `design/screens/img`. The lock screens are drawings of the systems' own, at the same moments: `node tools/lock-screens.mjs` (needs the Inter font).

## Configuration

Build-time settings are Vite env variables, set in the shell or a `.env.local` file (git-ignored).

| Variable                     | Effect                                                                                                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_XPN_CONCERTS_ENDPOINT` | The concert calendar. Default: xpn.org's own calendar (`https://xpn.org/wp-json/tribe/events/v1/events`). `off` removes the Concerts tab.                                                                                                                                     |
| `VITE_XPN_UPDATES_URL`       | The station updates and app switches. Production default: `control/updates.json` as published with the Pages site; another address (an xpn.org file, an Advanced Ads group), or `off`. Development and the preview show samples. See "Station updates" and "Remote config".   |
| `VITE_PUSH_REGISTER_URL`     | Turns on push notifications: where the app registers a phone's push token and topics. Unset: live video and drive notifications are planned on the phone. See "Push notifications".                                                                                           |
| `VITE_GA4_ID`                | Usage and crash reporting. Production builds report to WXPN's "WXPN App" GA4 property (`G-JDR8LLHT18`) by default; a `G-…` id names another, and `off` turns it off (the preview and the end-to-end tests). Development builds never report. See "Usage and crash reporting". |
| `VITE_XPN_ARCHIVE_FEEDS`     | Where on-demand episodes come from, as `show=URL` pairs (a show page on xpn.org, or a podcast feed). Default: the four shows xpn.org archives (Sleepy Hollow, Funky Friday, Land of the Lost, World Cafe). `off` removes the Archive tab. See "Audio archive".                |
| `VITE_BRIGHTCOVE_VIDEOS`     | The Videos tab's collections (shown as one feed), as `Section name=playlist id` pairs. Default: the NPR Music Video Network's World Cafe and WXPN collections (the ones on livesessions.npr.org). `off` removes the tab. See "Videos".                                        |
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
- **Notifications (member drives, live video, anything else).** Listeners opt in with one switch, Settings › Notifications from WXPN; it is off until they turn it on, with the consent wording beside it, as App Review 4.5.4 requires for anything promotional. A banner's `notify` list (up to six `{ at, title, text }`; the composer has room for three) becomes notifications for listeners who turned it on; so does a live video, 10 minutes before it starts (`"notify": false` skips one; a followed show with reminders on gets its reminder instead). The app schedules them on the phone, like show reminders, so no push service is needed. The catch: a phone learns of a notification when the app next opens, so post a drive's notifications before the drive starts. Tapping opens the video, or the banner's link (the donate page) in the browser view.
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

Notifications from the station (live video, member drives, anything else) that reach phones whether or not the app has been opened lately. The app side is done (`push.js`); it needs a sender, which can be any service that sends to Apple (APNs) and Google (FCM):

- **The contract.** With `VITE_PUSH_REGISTER_URL` set, the phone app sends `POST { token, platform: "ios" | "android", topics: ["station"], app, version }` there whenever the listener's switch (Settings › Notifications from WXPN) or the phone's token changes; an empty `topics` means send nothing. One topic covers every kind of notice, so the station can send a new kind without an app update. The token is an APNs device token on iOS and an FCM token on Android. A notification's data says what a tap opens: `{ "action": "watch", "watch": "<YouTube or video URL>", "title": "…" }`, `{ "action": "open", "url": "https://xpn.org/donate/" }` or `{ "action": "listen", "stream": "xpn" }`.
- **Sender options.** A hosted service with a sending dashboard staff can use (OneSignal, Airship; register tokens with its API, or swap `push.js`'s registration for its SDK); Firebase Cloud Messaging (free; with the Firebase iOS SDK added, iOS tokens become FCM tokens too, so one API sends to both); or a small WordPress plugin that stores tokens and sends through APNs and FCM, so sending lives next to the content in WordPress.
- **Native setup.** iOS: Xcode › Signing & Capabilities › + Push Notifications, and an APNs key (.p8) from the Apple Developer account for the sender. Android: a Firebase project's `google-services.json` in `android/app/` (FCM needs it even if the sender is elsewhere). Notifications arriving while the app is open show as banners (`capacitor.config.json` › `PushNotifications.presentationOptions`).

## Usage and crash reporting

Production builds report to the **WXPN App** GA4 property (account 552242 › property 558304207, web stream "WXPN app", measurement id `G-JDR8LLHT18`; kept apart from xpn.org's WXPN 2024 property so app users don't add to the website's totals). Set up in it: custom dimensions Station, Show, Content, Item type, Feature, Place and Music service, the custom metric Listening minutes (`minutes`), 14-month data retention, and enhanced measurement off (the app reports its own screens). Once the first donate taps arrive, star `donate_click` in Admin › Events to make it a key event. The app (`analytics.js`) sends: screens as `page_view`, and `play_station`, `save` / `unsave`, `episode_play`, `video_play`, `donate_click` (`place`: header, sidebar, settings, banner or notification), `share`, `turn_on` (reminders, alarm, live, drives), `music_connect`, and errors as `exception` (anonymous, each once per session; React's and the page's uncaught errors included). Listening time is reported as `listen_time` (`listening.js`): `{ content: "live" | "episode", station, show, minutes }`, every five minutes while audio plays and when it stops, so summing Listening minutes gives listening hours by station and show. No cookies, advertising ids, Google signals or ad personalization; each install has a random id. Listeners can turn it off in Settings › Privacy, which forgets the id. The Content Security Policy allows Google's addresses only when an id is set.

**Crash reports** (phone apps; `crash-reporting.js`) go to Firebase Crashlytics: native crashes (which GA4 can't see) and the web app's own errors with their stack, each with the app version, station and screen, and the steps before it (the same anonymous events GA4 gets). It follows the same Privacy switch, and does nothing until Firebase is set up. To switch it on:

1. Create a Firebase project (the one Android push needs anyway). Add an Android app `org.xpn.wxpn` and an iOS app `org.xpn.wxpn`.
2. Put `google-services.json` in `android/app/`. The Google services and Crashlytics Gradle plugins apply themselves once it's there.
3. Add `GoogleService-Info.plist` to the App target in Xcode (`ios/App/App/`, ticked for the App target). The "Upload Crashlytics symbols" build phase then sends release builds' symbols, so native crashes show function names.
4. Build a release, force a test crash, and check the Crashlytics dashboard.

## Videos

The Videos tab shows the station's video collections as one feed, newest first, the newest one large, with search; World Cafe's show page shows its newest four.

- **Source:** Brightcove playlists, read with Brightcove's Playback API (`videos.js`). By default these are the NPR Music Video Network's "World Cafe" and "WXPN all videos" collections, the same ones livesessions.npr.org shows, so whatever reaches those pages reaches the app. The app reads the player's public policy key from the player's own config, so no key is built in.
- **Watching:** a full-screen watch page, as video apps have it: the video at the top (pinned there on phones, all the way down the page), the title with a heart to save it (to Favorites › Videos) and the kind of session under it, the show it is tagged with (Follow), the description, and Up next from the same collection: three, then See more, under the video; the full list beside it on wider screens. It has its own address (`#/videos/video/<id>`), so Back closes it and a video can be linked. Free at Noon's live video opens the same page (`#/listen/live`). The radio (or an archive episode) pauses and is offered back afterwards.
- **Playback:** in the account's Brightcove Player, loaded into the app's own frame (`public/video-player.html`) so the app can hide the title and description the player draws over the picture on pause or touch (the watch page shows both under the video). The frame is sandboxed without access to the app or its storage, loads scripts only from Brightcove's player host, and refuses to run anywhere but inside that sandbox. If the player can't start there, the frame hands over to Brightcove's own player page, overlay and all. Streams are HLS/DASH only, which the player handles on every platform. Plays are counted in that account's Brightcove Analytics, marked `wxpn-app`.
- **WXPN's own account instead:** make matching playlists in WXPN's Video Cloud (for example a smart playlist on the `worldcafe` tag) and set `VITE_BRIGHTCOVE_ACCOUNT=6416377368001` and `VITE_BRIGHTCOVE_VIDEOS`. Plays then count in WXPN's account. The Default Player has no domain restrictions; if one is added, the app's origins must be allowed.

## Audio archive

Shows › Archive lists recent broadcasts of the shows xpn.org archives, newest show first, each with its latest three (the rest in the show's sheet). Each row leads with a small play key that says how long the broadcast is, or how much is left once started. A dated broadcast's length is its slot in the schedule until the file reports its own; a feature with no slot (World Cafe's sessions) has its length read from the file's header up front, one file at a time, and kept on the device (`episode-length.js`). They play in the app on their own player, with skip back 15 and ahead 30, lock-screen controls, and their place kept.

- **Source:** each archived show's page on xpn.org already lists its last ten broadcasts (from StreamGuys); the app reads that list (`parseArchivePage` in `archive.js`), so the station publishes nothing new. A dated title ("Sleepy Hollow - 10.04.2026") becomes the day it aired, in the show's slot; a feature ("Friko on World Cafe") keeps its name.
- **Signed links:** the audio links carry a key and run out after a few hours. Each episode notes when its link was read; one read more than 20 minutes ago is read again from its show's page just before it plays (resuming, or recovering mid-listen, included). Favorites keep no link at all. A saved broadcast that has left the archive says so in Favorites and on its page, and tapping one that has gone explains why it can't play.
- **Sturdier later:** a small JSON route on xpn.org returning the same list (title, date, audio, length) would replace reading the page's markup, and could give exact lengths before playback. Shows not archived on xpn.org (Echoes, The Folk Show…) appear once they are.

## Playlist sync

Like the playlist workout apps build from the songs you like: every song a listener saves goes into a "WXPN Favorites" playlist in their Spotify or Apple Music, kept in step as they save and unsave (`playlist-sync.js`, `music-services.js`). No server is needed. Settings always has the way to connect; Favorites invites it once, under the songs, after five saves, until it is connected or dismissed. A song's sheet never offers to connect: once connected, it says where the song stands in the playlist.

- **Spotify:** create an app at developer.spotify.com, copy its Client ID to `VITE_SPOTIFY_CLIENT_ID`, and add these Redirect URIs: the web app's address (e.g. `https://xpn.org/app/`), and `org.xpn.wxpn://spotify-callback` for the phone apps. Sign-in uses PKCE, so there is no client secret to protect. Requests follow Spotify's February 2026 Web API (`POST /me/playlists`, `/playlists/{id}/items`).
  - **Limits as of 2026:** a Development Mode app works for at most 5 Spotify accounts the station allowlists, and the app owner needs Spotify Premium. Opening it to all listeners needs Extended Quota, which Spotify grants only to registered organizations with at least 250,000 monthly active users (applications take up to six weeks). If WXPN doesn't qualify, ship with Apple Music only and leave `VITE_SPOTIFY_CLIENT_ID` unset; the app then shows no Spotify option. A listener Spotify hasn't allowlisted sees "Spotify hasn't opened WXPN's playlist feature to your account yet" rather than a sign-in loop.
- **Apple Music:** needs a MusicKit developer token (Apple Developer account › MusicKit identifier and key). Tokens expire within six months, so the app asks a small endpoint for one (`VITE_APPLE_MUSIC_TOKEN_URL`) rather than having one built in. `services/apple-music-token.js` is that endpoint, ready to deploy as a Cloudflare Worker (free tier) with the MusicKit key as a secret; its header says how. It answers only the app's own origins and makes a fresh 30-day token as needed. Apple's API cannot remove songs from a playlist, so unsaving leaves the song there (the app says so). MusicKit JS signs in through a popup, which works on the web; in the iOS app it needs testing, and a native MusicKit plugin may be needed.
- **Accounts:** the playlist belongs to the account that made it. After every sign-in, the next sync checks the playlist on record against the account now signed in (Spotify: its owner; Apple Music: that it is in this library) and starts a fresh one for a different account.
- **Matching:** a song goes in only when the catalog has the same title (versions and featured artists aside) by the same lead artist; anything less certain is left out rather than risk the wrong song.
- Each service shows in Settings only when configured; Favorites invites listeners to set it up.

## Native apps

The iPhone and Android projects are in `ios/` and `android/` (Capacitor 8, app ID `org.xpn.wxpn`), set up for everything below. The **Native apps** workflow builds both on every push: an Android test build anyone can install (from `main`, the **Android test build** pre-release under Releases; signed with a test key that stays the same, so each installs over the last: `android/test-signing/`), and an unsigned iPhone simulator build that shows the project compiles. Each build's log is on the `native-out` branch. What only a phone can show is listed in [docs/device-testing.md](docs/device-testing.md).

Use Node 22 or newer (`.nvmrc` pins 24, as CI does). Capacitor must be 8.4.3 or later: 8.3.5–8.4.2 let remote content load at the app's origin ([GHSA-rvm3-566m-v7fv](https://github.com/advisories/GHSA-rvm3-566m-v7fv)).

**Working on them:** after any web change, `npm run cap:sync`, then open `ios/App/App.xcodeproj` in Xcode or `android/` in Android Studio. Version: `package.json`'s, which Android reads itself; for iOS, set `MARKETING_VERSION` to match (the Release workflow does). Icons and launch screens come from `brand/app-icon-1024.png`: `python3 tools/make-native-assets.py`, then `npx @capacitor/assets generate --ios --android --iosProject ios/App --androidProject android --iconBackgroundColor '#ef7149' --splashBackgroundColor '#f7f3ea' --splashBackgroundColorDark '#202224'`.

**Before the first store upload** (these need WXPN's accounts):

1. **Confirm the app ID.** `org.xpn.wxpn` becomes the permanent store identity at the first upload. To change it: `appId` in `capacitor.config.json`, `PRODUCT_BUNDLE_IDENTIFIER` in the Xcode project, `applicationId` and `namespace` in `android/app/build.gradle` (and the Java/Kotlin package), and the URL scheme in both projects and `music-services.js`.
2. **Apple:** enroll WXPN in the Apple Developer Program (the fee is waived for nonprofits and accredited schools; Penn may publish under its own account). Register the App ID with Push Notifications and Associated Domains; Xcode can do this when it first signs. In Xcode, choose the team under Signing & Capabilities.
3. **Google:** a Play Console account ($25 once), and a Firebase project's `google-services.json` in `android/app/` (push needs it, see "Push notifications").
4. **Store builds:** the **Release** workflow (run by hand) builds a signed Play bundle and a TestFlight upload once the secrets it lists are added: an Android upload key, and an App Store Connect API key. Each platform runs only when its secrets are there. The app's settings (Spotify, Apple Music, push and the rest of Configuration) come from repository variables of the same names, which the workflow passes into both builds; it warns about any integration left unset.
5. **Links that open the app** (`deep-links.js`): xpn.org show pages, Listen, the playlist page and the concert calendar open in the app on phones that have it; donate links always open the website. Both apps are set up for them; xpn.org has to vouch for the apps: host `native/well-known/apple-app-site-association` (with WXPN's Apple Team ID in place of `TEAMID`) and `native/well-known/assetlinks.json` (with the Play app signing key's SHA-256, from Play Console › App integrity) at `https://xpn.org/.well-known/` (and `www.`), served as `application/json` with no redirect. Show pages have a Share button that shares the show's xpn.org address, so a shared show opens in the app for anyone who has it.

**What's set up:**

- **Background audio.** iOS: `UIBackgroundModes: audio` and an `AVAudioSession` playback category (`AppDelegate.swift`), so the station plays with the screen locked and through the silent switch. Android: `@capgo/capacitor-media-session` provides the media notification and the foreground service that keeps audio alive.
- **The radio alarm** is a notification the phone repeats each week by itself, one per chosen day (`alarm.js` › `alarmPlan`), so it keeps ringing if the app isn't opened again. On Android, `patches/` (applied by `patch-package` on install) makes the plugin re-arm each week's alarm as it armed the first, waking the phone and allowed while idle; the plugin is pinned to the version the patch is for.
- **Notifications** (`@capacitor/local-notifications`): the permission prompt appears when the listener turns reminders or the alarm on. Android 13+ declares `POST_NOTIFICATIONS` and `SCHEDULE_EXACT_ALARM` (from the plugin); Android 14+ leaves exact alarms off for apps that aren't alarm clocks, so turning the alarm on checks and, if needed, offers Settings › Alarms & reminders. (Not `USE_EXACT_ALARM`: Play allows it only for alarm clock and calendar apps.) The notification icon is `res/drawable/ic_stat_wxpn.xml`, the Listen icon. A notification can't start audio by itself on either platform: the alarm wakes the listener, and tapping it starts the station.
- **Push** (`@capacitor/push-notifications`): the iOS entitlement (`App.entitlements`) and the token hand-off in `AppDelegate.swift`. Notifications arriving while the app is open show as banners (`capacitor.config.json`).
- **Spotify's sign-in return:** the URL scheme `org.xpn.wxpn` (iOS URL Types; an Android intent filter for `org.xpn.wxpn://spotify-callback`).
- **Calendar** (`@ebarooni/capacitor-calendar`): iOS's usage text for adding concerts (`NSCalendarsWriteOnlyAccessUsageDescription`, and `NSCalendarsUsageDescription` for iOS 16). Android opens the calendar app's own New Event screen, which needs no permission.
- **Links:** iOS Associated Domains `applinks:xpn.org` and `applinks:www.xpn.org` (`App.entitlements`); the Android App Links intent filter on the main activity.
- **Scenes** (iOS): the phone's window (`SceneDelegate.swift`, one window, also on iPad) and CarPlay (`CarPlaySceneDelegate.swift`), in `Info.plist`.
- **Export compliance:** `ITSAppUsesNonExemptEncryption` is false (the app uses only HTTPS), so TestFlight doesn't ask each upload.
- **Store requirements in 2026:** App Store uploads must be built with Xcode 26 and the iOS 26 SDK (since April 28, 2026). Google Play requires new apps and updates to target Android 16 (API 36) from August 31, 2026; Capacitor 8 targets it. Android 15+ draws apps edge to edge with no opt-out; the CSS reads Capacitor's `--safe-area-inset-*` values for that (see `styles/base.css`).
- **Video on iOS:** YouTube refuses embedded players that can't send a web referrer, which an iOS app (`capacitor://localhost`) can't, so on iOS a live YouTube video (Free at Noon) opens in the in-app browser instead of the watch page. Brightcove videos play in the app everywhere.
- **Status bar**: `@capacitor/status-bar` switches the status bar text between light and dark with the app's theme, so it stays readable when the app and phone themes differ. No setup needed.
- **Larger text on iPhone:** nothing to set up. `@capacitor/text-zoom` applies iOS's Text Size setting at launch and whenever the app comes back to the front (`text-size.js`); check the screens at the largest sizes.
- **CarPlay and Android Auto** (`car.js`; `ios/App/App/CarPlaySceneDelegate.swift` and `CarAudioPlugin.swift`, registered by `MainViewController.swift`; `android/app/src/main/java/org/xpn/wxpn/WxpnCarService.kt` and `CarAudioPlugin.kt`, registered by `MainActivity.java`). The car lists WXPN, XPN2 and Homegrown; choosing one plays it, and play and pause work as the app's. On CarPlay the song comes from the lock screen's information; Android Auto gets it from the app.
- **Home screen widget** (`widget.js`; `ios/App/WXPNWidget/` and `HomeWidgetPlugin.swift`; `android/app/src/main/java/org/xpn/wxpn/WxpnWidget.kt` and `HomeWidgetPlugin.kt`, with `res/layout/wxpn_widget.xml`). A block for the home screen: WXPN, XPN2 and Homegrown across the top (the one playing underlined; a tap on another opens the app playing it), the song's artwork, title and artist, WXPN's show on the air, and play. The app sends what's playing whenever it changes; the widget never fetches anything itself. Its play key opens the app and plays or pauses (the car's `toggle` command). On iOS it comes in small, medium and large and reads from the app group `group.org.xpn.wxpn`: in the Apple developer account the app ID `org.xpn.wxpn` and the widget's `org.xpn.wxpn.widget` both need that app group (automatic signing in the Release workflow can usually register them). Drawn for the screens page by `tools/widget-screens.mjs`.
  - **CarPlay needs Apple's approval:** request the CarPlay audio entitlement (developer.apple.com/contact/carplay), and once granted, add `com.apple.developer.carplay-audio` (true) to `App.entitlements`. Until then the CarPlay scene simply never appears. Test with Xcode's CarPlay simulator (I/O › External Displays › CarPlay), including starting from the car with the app closed.
  - **Android Auto** works without approval for testing (Android Studio's Desktop Head Unit); Google reviews it against the car app quality guidelines at submission. Starting the app from the car with it closed opens it in the background, which some phones block.
- **Store review prompt** (`review.js`, `@capacitor-community/in-app-review`): nothing to set up. The app asks right after a heart, once the listener has listened two hours in all and saved three things, at most once per version and 120 days apart; the phone decides whether to show it.

The Android back button steps back through screens and closes the show sheet, because navigation uses hash routes with real history entries.

## How it works

- **Playing on another device** (`cast.js`): a button in the player (beside play in the phone mini player, at the bar's far edge on larger screens), on Listen and in Settings opens the platform's own picker, for the station or an archive episode: AirPlay in the iPhone and iPad apps and Safari, Google Cast in Chrome. The Android app's WebView offers neither, so no button shows there; casting from the Android app would need Google's Cast SDK on the native side (a Cast receiver can play the same StreamGuys URLs).
- **Playback** (`player-core.js`, wired up in `player.js`): one `<audio>` element for the life of the app, playing the StreamGuys MP3 mounts in `streams.js` (WXPN uses the no-preroll mount; each station has a backup, the mount xpn.org's own player uses, and all six were checked live on October 5, 2026). Play always rejoins the live broadcast; pause detaches the stream so it stops using data. If the stream drops or stalls while the listener wants audio, it reconnects on a backoff (1s, 2s, 4s, 8s, 15s), alternating with the backup mount, and immediately when the device comes back online. A pause from outside the app (a phone call, another app) is respected rather than fought. If the browser refuses to start audio without a tap, the app says so instead of retrying. Lock-screen and headset controls call the same actions as the on-screen button.
- **Now playing** (`nowplaying.js`): polls the station's playlist feeds every 30 seconds while the app is visible (and while hidden if audio is playing, so the lock screen keeps up), per station. Just after midnight ET the previous day's list is merged in. It also reads the station's now-playing file (the one xpn.org's player uses) for the current song's length and any artwork the playlist lacks. A song is shown as playing until its length plus three minutes has passed, or 15 minutes when its length is unknown, so a long jam is not dropped mid-song. That holds on screen, in the mini player and on the lock screen; an older report (the feed pauses overnight, or has failed) moves to Recently played and the station is shown instead. Homegrown (the former Kids Corner stream, same mounts) has audio but no song feed. The playlist names a show between bars for its own segments ("|World Cafe|", a session hour); the app shows those under the show's name, gives their hearts the show's color, and leaves them out of playlist sync.
- **Shows** (`catalog.js`, `shows.json`): directory and weekly schedule in Eastern time, matched to the program guide on xpn.org on October 5, 2026, including each show's page and artwork. Air times shown on cards and sheets ("Weekdays, 2–4pm") are generated from the schedule, so every show reads the same way. Tests check the data on every run, including that the schedule covers every minute of the week.
- **Hosts** (`hosts.js`, `hosts.json`, `components/HostSheet.jsx`): the station's hosts, from xpn.org's own host pages (`tools/fetch-hosts.mjs`, run by the Fetch artwork workflow): each host's portrait (square, bundled in `public/hosts`), the line under their name there, their bio, their page, and the shows they host, read from the programs their page links to and the shows' host lines. Shows › Hosts lists them in the order you will hear them (on now, next, then everyone); a host's sheet gives their shows and when they air (each opens the show's sheet; Back returns), then their bio. In a show's sheet, each host's name opens theirs. Like shows, a host's sheet has an address (`#/shows/host/dan-reed`).
- **Times** (`time.js`): the schedule is Eastern, but everything a listener reads as a time ("until 4pm", "Next on air: Friday at 1pm", when a song played, the sleep timer, reminders) is in the device's own zone. The schedule stays in Eastern and says so.
- **Concerts in your calendar** (`calendar.js`): every concert's sheet has Add to calendar. In the phone apps it opens the system's New Event sheet, filled in; in a browser it offers an `.ics` file (Apple Calendar, Outlook) or a Google Calendar link, and Favorites can add every saved concert in one file. Concerts are all-day events, since the calendar's times are placeholders; the note links tickets and says to check the venue for times.
- **Concerts** (`concerts.js`): xpn.org's own calendar (The Events Calendar's REST API), the next year of shows, all pages. Regions, WXPN Welcomes and Free at Noon come from its categories; ages from its age field, fetched only for shows on screen. How many concerts are listed shows only once a filter is on ("6 of 36", with Clear), quietly at the end of the first day's heading. The quick filters are words under the search, underlined in ink when on. Filters match the website: chips under the search for tonight, this weekend, WXPN Welcomes and Free at Noon, and a Filters key at the end of the search that opens a sheet for next 7 days, picked dates, regions, saved and artists you like (one date filter at a time). The list is grouped by day: the day's name on the page, larger than anything in the rows, the day as a word and its date muted ("Tonight Oct 18", "Wednesday Oct 21"), which stays at the top while its concerts scroll (on tablets and computers it sits in a column of its own beside them). Each concert is a card of its own on a raised surface, so its edge says where it ends; within a day the station's own shows come first (`inShowOrder`, applied before the list is paged). A row has one heavy line, the headliner; the acts supporting it go on a lighter "with …" line (`splitBill` splits "Headliner / Support", never inside parentheses), then the venue, a town or region other than the Philadelphia area, and the age limit in one muted line; WXPN Welcomes and Free at Noon run as a banner across the top of their card, centered, in Donate's colors; cards are square-cornered, as a printed listing is. The list has no images, since almost no listings have one; a row opens the concert's sheet: its photo, when and where, Tickets, Add to calendar, Share and Save. A failing calendar shows an error, never invented events.
- **Concerts by artists you like** (`concert-alerts.js`, `hooks/useConcertAlerts.js`): whenever the calendar loads or refreshes, its listings are checked against the artists of the songs a listener has saved (names compared without case, accents, punctuation or a leading "The"; every act on a bill counts). A concert not announced before brings a notice in the app ("Bright Eyes at Union Transfer"), once per concert; the first check announces what is already on the calendar as one notice. View opens Concerts showing only artists you like. On by default; Settings turns it off. It runs in the app, so a closed app hears on its next opening; reaching a closed phone the moment a show is listed would need the push sender ("Push notifications") to match artists on the server. Saved concerts keep their details, so they stay in Favorites while the calendar is down.
- **Favorites, appearance, volume** (`favorites.js`, `storage.js`): stored on the device under the original `xpn.*` keys, so they carry over from earlier versions. Removing a favorite offers Undo, which puts it back in its old place; the first save says where saved things go. Notices are kept for those, errors and copies to the clipboard; nothing announces what the screen already shows. Favorites lists every saved song. A song's row opens its sheet (so does a press and hold, and the "···" on Listen): Save, Open in Spotify, Open in Apple Music (their search for the song, as plain links the phone hands to the installed app), Share; a show's own segment offers the show instead. On a phone it is a sheet from the bottom; on a wider screen it hangs from the row. A saved heart takes its color from the item's artwork (`art-tint.js`), adjusted per theme to keep 3:1 contrast; show tints are stored in `shows.json`, song tints are read from the album art (Spotify's image CDN allows it), and art with no vivid color keeps the accent. Everything read back is repaired or dropped if damaged, so bad stored data cannot break a screen. Song ids keep letters from every script.
- **Radio alarm** (`alarm.js`, `hooks/useRadioAlarm.js`): in the native apps a week of alarms is scheduled as notifications, so it works with the app closed; tapping it starts the wake-up station. In a browser it only plays while the page is open and the device awake.
- **Notifications** (`notifications.js`): shared by reminders, the alarm and the station's notifications. iOS keeps only the soonest 64 pending, so the plans share one budget of 60: the alarm first, then everything else soonest first (the rest is scheduled as the week rolls on). Each sync replaces the pending notifications as the phone reports them, one sync at a time, and reads the result back; a failure shows in Settings. If notifications are turned off in the phone's Settings, the feature turns itself off and says why.
- **Performance**: the React Compiler (`babel-plugin-react-compiler`, set up in `vite.config.js`) memoizes components automatically. Screens not in front are kept in a React `Activity` set to hidden, so they keep their state but stop their effects and subscriptions. Concerts, Videos, Settings, the welcome and the watch page load separately from the first download. Long lists skip off-screen rows (`content-visibility`). The app's network requests time out after 10 seconds.
- **Security**: production builds carry a Content Security Policy (added by `vite.config.js`): scripts only from the app and Apple's MusicKit, network only to WXPN's feeds, Brightcove, Spotify, Apple Music and the configured update and token URLs; video frames only from the app's own video frame, Brightcove and YouTube. If you add a service, add its address there. Sample content isn't included in production builds at all.
- **Interface**: changing tabs is instant, as a phone's own tab bars are (the Android app uses Material's quick fade-through); sheets and menus rise on one spring and slide away when closed, menus on wider screens grow from the control that opened them. Nothing loops but a loading spinner (shown only if connecting takes longer than 300ms) and the ringing alarm; live is a still dot. Sheets follow the finger and carry its speed when let go (thrown or past halfway they close, otherwise they spring back, and they can be caught mid-flight); a press and hold builds up visibly before its menu opens; each gesture means one thing, so there are no swipes between days or views and no flick on the mini player. While the radio plays, the glow behind Listen's artwork drifts very slowly, and holds still when paused. All of it is skipped under reduced motion. Space plays and pauses what the player bar holds (the station, or an archive episode) unless focus is on a control. Layout respects the notch and rounded corners in the native apps, and there are high-contrast and forced-colors adaptations.
- **First launch** (`components/Welcome.jsx`): follow a few shows, turn on reminders for them, then connect Spotify or Apple Music so hearted songs build a playlist. No step sends the listener out of the app; the station's social accounts are in Settings › Stay connected (`links.js`). Show artwork is bundled in `public/shows`; `tools/fetch-show-art.mjs` (run by the Fetch artwork workflow) brings in any show whose image still points at xpn.org. Steps with nothing to offer are left out (no reminders without a followed show, no playlist step when no service is configured). Closing it any way counts as done (`xpn.onboarded`), and it never covers a shared show link.
- **Show reminders** (`reminders.js`, `hooks/useShowReminders.js`): reminders for followed shows, at the start or 5 or 15 minutes before, set in Settings or offered in the show sheet right after following. In the native apps they are local notifications for the coming week, rescheduled whenever follows or settings change and each time the app returns to the foreground; iOS allows 64 pending, so at most 48 are scheduled. Tapping one opens Listen and starts WXPN. Permission is only asked when the listener turns reminders on. In a browser, a reminder appears in the app (with a Listen button) while it is open. Times are Eastern and handle daylight-saving changes.
- **A song's sheet** (`components/MusicRows.jsx`, `components/HoldMenu.jsx`, `components/PlaylistSync.jsx`): every song, now playing or in a list, opens one sheet, from its row, a press and hold, or Listen's "···": Save, Open in Spotify, Open in Apple Music (or the show, for a show's own segment), Share, and once a service is connected and the song saved, where it stands in "WXPN Favorites". It never offers to connect.
- **On air and sleep timer** (`schedule.js`): the Listen screen names the show and host on air from the FM schedule, including shows that run past midnight; overnight gaps in the schedule show nothing rather than a guess. The sleep timer stops playback after 15–60 minutes or at the end of the current show, fading out over the last 20 seconds. Native builds use three haptics (`haptics.js`): a selection tick for choosing a station, day or view, a sheet crossing its close line and a pull that will refresh; a light tap for play, pause and a heart; a medium one when a press-and-hold menu opens. Android browsers give a very short vibration for the taps, never for ticks.
- **Brand** (`components/StationLogo.jsx`): the header and sidebar draw WXPN's own logo from xpn.org, a lowercase wxpn with the w a step lighter. The page is a neutral off-white (`#f5f5f3`) with white raised surfaces, and dark mode is xpn.org's `#111`; orange is only for things to do, and Listen live, Tickets and play share Donate's tonal colors (a pale orange fill, deep orange words), square-cornered where Donate is a pill. Each song's artwork color does the rest.

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
hosts.js             the station's hosts, from hosts.json
archive.js           archived broadcasts, read from xpn.org's show pages
episode-length.js    an archive episode's length, read from its file
videos.js            Brightcove playlists, for Videos and show pages
concerts.js          concert calendar (xpn.org)
calendar.js          saved concerts into the listener's calendar
updates.js           station updates: format, timing, notifications, YouTube
push.js              push notifications: registering with the sender, taps
analytics.js         usage and crash reporting (GA4)
car.js               CarPlay and Android Auto (the car side is in ios/ and android/)
widget.js            the home screen widget (the widget itself is in ios/ and android/)
crash-reporting.js   crash reports to Firebase Crashlytics (phone apps)
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
ios/, android/       the iPhone and Android projects (Capacitor)
native/well-known/   the files xpn.org hosts so its links open the app
services/            the Apple Music token endpoint (a Cloudflare Worker)
tools/               updates-composer.html, for writing station updates; screenshot and icon scripts
docs/                device-testing.md, what to check on phones
design/screens/      the screens page (every screen, light and dark)
tests/               node:test suites, importing the real modules
brand/               logo source files (not shipped with the app)
```

## Known gaps before a store release

- **For an agency:** [docs/agency-brief.md](docs/agency-brief.md) is a brief to quote the remaining work against; [docs/design-system.md](docs/design-system.md) is the design handoff.
- **Testing on phones** ([docs/device-testing.md](docs/device-testing.md)): both apps build, but neither has run on a real phone yet. Background audio, the lock screen, interruptions, notifications arriving with the app closed, links, the Android back button.
- **CarPlay and Android Auto:** the native code compiles in both apps, with the stations' tiles and Android Auto's artwork; it needs Apple's CarPlay entitlement (request: [docs/carplay-entitlement-request.md](docs/carplay-entitlement-request.md)) and testing in the simulators and a car.
- **Home screen widget:** compiles in both apps; needs the app group set up for the iOS app and widget IDs, and a look on real phones (artwork, dark mode, the play key from a cold start).
- **Developer accounts and store builds:** see "Native apps › Before the first store upload".
- **Push sender:** choose the service (see "Push notifications") and set `VITE_PUSH_REGISTER_URL`.
- **Station updates hosting:** choose where `updates.json` lives and who edits it.
- **Playlist sync accounts:** a Spotify app (with extended quota), and for Apple Music, a MusicKit key served by `services/apple-music-token.js` (see "Playlist sync").
- **Reporting:** GA4 is set up (WXPN App property); data starts with the first production build people use. Crash reporting (Crashlytics) is built in and needs the Firebase project's two config files (see "Usage and crash reporting").
- **Store listing:** screenshots (iPhone, iPad, Android), Play's feature graphic and the listing text are in `store/` (`store/listing.md`); confirm the support page before submitting.
- **Store privacy answers:** with reporting on, Apple's App Privacy and Google's Data safety should declare Usage Data (product interaction) and Diagnostics (crash data), not linked to identity and not used for tracking; with push, a device id (push token) for app functionality. Favorites and settings stay on the phone.

## Design basis

The app avoids the looks generated interfaces default to (audited against Anthropic's frontend-design guidance, [avoid-ai-design](https://github.com/funboy322/avoid-ai-design) and a Reddit-mined ranking of AI-design tells). Instead its structures come from radio's own documents:

- **The program log:** Recently played puts when each song played first, in a column of figures.
- **The alarm read back:** "Wakes you at 7:00 AM on weekdays to WXPN", over its controls.

A choice is marked one way everywhere, as an underlined word in ink. There are no film grain, live dots, glows or heading icons.

The main journey is **listen → identify a song → save it → find it again**. Album art always belongs to the reported song; stream controls and song controls have distinct labels. Recently played shares the listening screen; saved songs live in Favorites, and shows, videos and concerts have their own screens, with a persistent mini player.

References reviewed: [KEXP mobile app](https://www.kexp.org/mobile/), [KEXP roadmap](https://kexp.org/mobile/mobile-roadmap/), [KCRW app](https://www.kcrw.com/stories/welcome-to-the-new-kcrw-com-and-kcrw-app), [WXPN program guide](https://xpn.org/program_guide/), [WXPN playlist](https://xpn.org/wxpn-playlists/).
