# WXPN app: store listing

Drafts for App Store Connect and the Google Play Console, within each field's limit. Screenshots are in this folder (`ios/` 1320×2868, `ipad/` 2064×2752, `android/` 1080×2160 and `feature-graphic.png` 1024×500), made with `tools/store-shots.mjs`.

## Both stores

**Name** (30): WXPN

**Category:** Music (secondary on iOS: Entertainment)

**Support URL:** https://xpn.org/app/ (the app help page; copy is drafted in the "WXPN App Support page" doc. It must be live, and load without signing in, before submitting: Apple's reviewers open it. Settings › App help links to it too) · **Marketing URL:** https://xpn.org · **Privacy policy:** https://xpn.org/privacy-policy/

**Price:** free, no in-app purchases. Donating opens xpn.org in the browser view (App Review 3.2.2, approved nonprofits).

## App Store

**Subtitle** (30): Philadelphia public radio

**Promotional text** (170): Listen live to WXPN 88.5 FM, XPN2 and Homegrown. Save the songs you hear, follow your shows, catch up on broadcasts and find concerts around Philadelphia.

**Keywords** (100): world cafe,public radio,philadelphia,npr,radio,live music,free at noon,xpn2,homegrown,concerts

**Description** (4000):

WXPN is Philadelphia's listener-supported public radio station and the home of NPR's World Cafe. The app brings the station with you.

LISTEN
• WXPN 88.5 FM, XPN2 and Homegrown, live, with what's playing and what just played
• Keeps playing with the screen locked, with controls on the lock screen
• A sleep timer, and a radio alarm that wakes you to the station

SAVE WHAT YOU HEAR
• Heart a song to keep it, and share it
• Add your hearted songs to a Spotify or Apple Music playlist

SHOWS
• Every show and the full weekly schedule
• Follow a show and get a reminder before it starts
• Listen back to recent broadcasts of Sleepy Hollow, Funky Friday, Land of the Lost and World Cafe

VIDEOS AND CONCERTS
• World Cafe sessions and WXPN videos to watch
• Concerts around Philadelphia, by date and region, with tickets and add to calendar
• Free at Noon live, with a notification if you'd like one

WXPN is a public media service of the University of Pennsylvania, supported by its members. Become one at xpn.org.

**What's new (1.0):** The new WXPN app.

**App Review notes:** No sign-in is needed. Listen live: the Listen tab's Listen live button. Notifications are off until turned on in Settings (show reminders, radio alarm, From WXPN). The radio alarm schedules a notification; tapping it starts the station (a notification can't start audio on its own). Donate opens xpn.org/donate in the browser view, as App Review 3.2.2 allows for nonprofits. Playlist sync signs in with Spotify or Apple Music only if the listener chooses to.

**Age rating:** no objectionable content. The browser view only opens xpn.org, ticket and streaming-service pages from the app's own links; if App Review counts that as unrestricted web access, the rating becomes 17+, so answer that question carefully.

**App Privacy** (App Store Connect › App Privacy). Worked out from what the code sends (`analytics.js`, `push.js`, `playlist-sync.js`, the video players); have it checked against the privacy policy before submitting.

- **Do you or your partners collect data?** Yes, with usage reporting on (it is by default; Settings › Privacy turns it off).
- **Tracking:** No. No advertising ids, no Google signals or ad personalization, no data broker, no linking with other companies' data.
- **Data collected, none of it linked to the user's identity:**

| Apple's data type                   | What it is in the app                                                                                                   | Purposes                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Usage Data › Product Interaction    | Screens opened, plays, hearts, shares, notification switches (GA4 events)                                               | Analytics                    |
| Diagnostics › Crash Data            | Uncaught errors, as an anonymous line                                                                                   | App Functionality, Analytics |
| Diagnostics › Other Diagnostic Data | Caught errors (a screen that couldn't load)                                                                             | App Functionality, Analytics |
| Location › Coarse Location          | Google Analytics works out a country and city from the connection's address; the app never asks for location            | Analytics                    |
| Identifiers › Device ID             | Only once push is set up (`VITE_PUSH_REGISTER_URL`): the phone's push token, to send live video and drive notifications | App Functionality            |

- **Not collected** (stays on the phone, or goes only where the listener sends it): favorites, saved episodes and places, the alarm, reminders and settings; the Spotify or Apple Music sign-in and the songs added to the listener's own playlist (sent from the phone straight to that service, at the listener's request, never to WXPN); calendar events (written by the system's own New Event sheet).
- **Embedded players:** World Cafe and WXPN videos play in Brightcove's player (NPR's Music Video Network account), which counts plays in its own analytics; live videos play in YouTube's privacy-enhanced (nocookie) player. Those are their services, under their policies; the privacy policy should name them.
- **Required-reason APIs:** none in the app or its plugins (Capacitor's own privacy manifest declares none), so no app privacy manifest entries are needed today. Add one if a native SDK (Crashlytics, Firebase Messaging) goes in later.
- **Encryption:** `ITSAppUsesNonExemptEncryption` is false in Info.plist (HTTPS only), so no export compliance questions per build.

## Google Play

**Short description** (80): WXPN 88.5 FM, XPN2 and Homegrown live, plus shows, videos and concerts

**Full description:** as the App Store description.

**Data safety** (Play Console › App content › Data safety), from the same facts:

- **Does the app collect or share user data?** Collects, yes; shares, no (Google Analytics processes it for WXPN as a service provider, which Play doesn't count as sharing).
- **Collected, optional (reporting can be turned off), not linked to an account, encrypted in transit:**
  - App activity › App interactions: analytics.
  - App info and performance › Crash logs, and Diagnostics: analytics, app functionality.
  - Location › Approximate location: analytics (derived by Google Analytics from the connection's address).
  - Device or other IDs: app functionality, only once push is set up (the FCM token).
- **Processed only on the device** (not "collected"): favorites, settings, the alarm and reminders.
- **Deletion:** nothing is tied to a person or an account. Turning off Settings › Privacy › Share app usage stops reporting and forgets the install's id; say so in the deletion answer, and that there are no accounts.

**Other Play Console declarations:**

- **Foreground service permissions:** Media playback (`FOREGROUND_SERVICE_MEDIA_PLAYBACK`), for the station and episodes playing with the screen off and the media notification. Play asks for a short video of it: start the station, lock the phone, show the notification's controls.
- **Exact alarms:** the app uses `SCHEDULE_EXACT_ALARM` (from the notifications plugin) for the radio alarm, and asks the listener to allow it when the alarm is turned on; no Play declaration is needed for that permission (only `USE_EXACT_ALARM` needs one).
- **Notifications:** asked for only when a listener turns on reminders, the alarm or station notifications.
- **Ads:** no ads.

**Content rating questionnaire:** reference app, no user-generated content, no ads.

**Target audience:** 13 and over (not designed for children).

**Android Auto:** declared in the app (see README › CarPlay and Android Auto); Google reviews it against the car app quality guidelines.
