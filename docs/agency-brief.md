# WXPN app: brief for a store release

WXPN wants its app on the App Store and Google Play, with CarPlay. This brief
says what already exists, what's left, and what a quote should cover, so
quotes can be compared and kept tight.

## What exists

- **The app.** A complete listener app, working in a browser and built for
  iPhone and Android with Capacitor 8 from one React code base: live
  streams (WXPN, XPN2, Homegrown) with what's playing and Recently played;
  the schedule, shows and hosts; the audio archive; videos; concerts;
  favorites; show reminders; a radio alarm and sleep timer; playlist sync
  to Spotify and Apple Music; station banners and notifications; usage
  reporting.
- **Phone-only pieces, written and compiling:** CarPlay and Android Auto, a
  home screen widget (iOS and Android), crash reporting (Firebase
  Crashlytics), push registration, background audio and the lock screen.
- **Tests and builds.** About 370 unit tests and 130 browser tests
  (phone and desktop, with automated accessibility checks). Every push
  runs them, builds both native apps, and publishes an Android test build.
  A Release workflow signs store builds once the accounts' keys are added.
- **Design.** A live preview at
  https://alex-colemankime.github.io/xpn-app-update/ and every screen in
  light and dark at …/screens/. `docs/design-system.md` covers tokens,
  components and the decisions the station has made (please keep them
  unless WXPN agrees otherwise).
- **Docs.** README (setup, every integration, known gaps),
  `docs/architecture.md` (how the code fits together),
  `docs/device-testing.md` (the device test plan, with a results sheet per
  device), and `docs/carplay-entitlement-request.md`.
- **Ready to deploy:** a push sender (`services/push-sender/`), publishing
  station updates from the composer, fastlane lanes for both stores, and a
  CI smoke test that opens both apps in an emulator and a simulator.

Nothing has been tested on a real phone yet. That is the main job.

## The work

Please quote each package separately, in hours, with your assumptions.

1. **Onboarding.** Read the code and docs, run the app and the builds,
   and raise anything that changes the estimate in the first week.
2. **Device testing and fixes.** Run `docs/device-testing.md` on at least
   two current iPhones, one older iPhone (iOS 16 or 17), two Android phones
   (a Pixel and a Samsung) and an iPad, then fix what fails.
   - **Done when:** every item passes on each device, or is agreed as a
     known issue, and the results are written down.
3. **CarPlay and Android Auto.** Get CarPlay working in Xcode's CarPlay
   simulator and in a car, including starting from the car with the phone
   app closed and locked, and Android Auto in the Desktop Head Unit and a
   car. Answer Apple's and Google's review questions.
   - **Done when:** the car items in the test plan pass, and both stores
     accept the car integration.
   - Apple's entitlement may already be granted by the time you start (see
     below).
4. **Back-end services.** Most of these depend on decisions below.
   - The push sender: `services/push-sender/` is written and tested
     against stand-ins; deploy it, add the Firebase and APNs keys, and
     confirm real sends (or swap in a hosted service if WXPN prefers).
   - Station updates: staff already publish from
     `tools/updates-composer.html`; confirm the flow with them.
   - The Apple Music token endpoint (`services/apple-music-token.js`),
     deployed.
   - Spotify, if WXPN qualifies (see below).
   - **Done when:** staff can send a notification and post a banner without
     a developer, and playlist sync works end to end.
5. **Crash reporting and analytics.** Create the Firebase project, add its
   two config files (README › Usage and crash reporting), and confirm
   crashes and GA4 events arrive.
6. **Design and accessibility review.** A design pass on real devices,
   within `docs/design-system.md`, and a VoiceOver and TalkBack pass. An
   automated audit has already been done and fixed; this pass is the
   human one.
7. **Store submission.** Signing, then the listings, screenshots and
   privacy answers, already drafted in `store/` and sent by the fastlane
   lanes in `fastlane/` (its README lists what stays manual), and
   handling review feedback until both apps are live.
8. **Project management** across the above.

**Out of scope unless quoted separately:** new features, a redesign, and
changes to xpn.org beyond hosting the two link-verification files.

## What WXPN decides first

These change the cost most; settle them before asking for quotes.

- **Push notifications.** A hosted service (OneSignal, Airship), Firebase,
  or a WordPress plugin. Also decide who sends them.
- **Station updates.** A file in the WordPress media library, or Advanced
  Ads groups. Also decide who edits them.
- **Spotify.** Spotify opens wider access only to organizations with
  250,000 or more monthly users. If WXPN doesn't qualify, ship with Apple
  Music only.
- **Store accounts.** Publish under WXPN's own Apple and Google accounts or
  under Penn's; the agency gets developer access, not ownership.

## Accounts and access the agency needs

- **GitHub:** the repository (write access, on a branch, with WXPN
  merging).
- **Apple:** a Developer Program membership with App Manager access, and an
  App Store Connect API key for the Release workflow.
- **Google:** Play Console access, and the Firebase project.
- **CarPlay:** the entitlement request. Send it now
  (`docs/carplay-entitlement-request.md`), since approval can take weeks.
- **xpn.org:** someone who can host `.well-known` files and edit station
  updates.

## Timeline

About 8 to 12 weeks, depending most on device-testing findings, Apple's
CarPlay approval and store review. Ask for a plan with milestones:
onboarding done, devices passing, TestFlight and Play internal testing,
store submission, and live.

## What to send back

- Hours per package above, with the rate and assumptions.
- The devices and cars you'll test on.
- Who does the work (iOS, Android and web experience; CarPlay apps
  shipped before).
- How you'll report progress, and how WXPN reviews before each store
  submission.
