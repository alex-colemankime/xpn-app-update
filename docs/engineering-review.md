# Engineering review, October 21, 2026: findings and status

An independent review of `main` at `0bbe964` (the merge of PR #10) found
the foundation sound and recommended no rewrite. Its findings are below,
with what has been done about each. Treat anything not marked **fixed** as
an acceptance criterion for the agency. Fixed items still need the
acceptance check on real devices or accounts that the last column names.

| ID  | Priority | Finding                                                            | Status                                                                                                                                                                                                               | Still to show                                                                                                                                 |
| --- | -------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | P1       | Must update the existing WXPN apps, but built under new identities | **Fixed in code:** the builds carry `com.jacobsmedia.WXPN` / `com.jacobsmedia.wxpn`; version 4.0.0 (above 3.2.8); Play's versionCode comes from `ANDROID_VERSION_CODE_BASE` ([store-identity.md](store-identity.md)) | Account and signing access confirmed; what carries over from the old app decided; installing over the published app on both platforms         |
| F1  | P1       | No iOS privacy manifests for the app-group UserDefaults            | **Fixed:** `PrivacyInfo.xcprivacy` in the app and the widget (UserDefaults `1C8F.1`; the app's collected data, no tracking); store notes corrected                                                                   | Xcode's privacy report on the signed archive, and an upload with no missing-declaration findings                                              |
| F2  | P1       | iOS 15.0 declared, but the UI needs the dialog API (15.4)          | **Fixed:** iOS 16.4 minimum (`color-mix()` needs 16.2), build target Safari 16.4, and a dialog opens in place without `showModal` rather than failing (browser test)                                                 | The device plan's overlays on a real iOS 16.4 phone                                                                                           |
| F3  | P2       | Changing push backends silently strands registrations              | **Fixed:** acknowledgments are kept per sender address, resent weekly, and don't count as covering notices for another sender (unit tests)                                                                           | A real endpoint change on a test phone                                                                                                        |
| F4  | P2       | Apple Music's developer token expiry asks listeners to reconnect   | **Not done, on purpose:** the owner treats the Spotify and Apple Music connection as a proof of concept, out of scope for now                                                                                        | If it ships: refresh before expiry or retry once after a 401, keeping the listener's user token; a revoked user token still asks to reconnect |
| F5  | P2       | The documented iOS-through-FCM mode rejects FCM tokens             | **Fixed:** each token is stored with how it was registered (`via`) and sent that way; iOS tokens registered before a switch stay on APNs (sender tests)                                                              | Real sends: APNs (default), Android FCM, and iOS FCM if used                                                                                  |
| F6  | P2       | Development dependency advisories not audited                      | **Fixed:** Vite 8.1.6 (patched); the full tree is audited in CI (`tools/audit.mjs`); the one remaining advisory (braces, no fix, install-time only) is a documented exception in `audit-exceptions.json`             | Revisit the exception by its review date                                                                                                      |
| F7  | P3       | Favorites' place test intermittently 3–5px off                     | **Fixed:** the test checks the same song is where it was, within 8px (scroll anchoring); repeated parallel runs pass                                                                                                 | None                                                                                                                                          |

## Also from the review

- **Alarm wording:** the listing now says the alarm opens the station when
  tapped. Neither platform lets a notification start audio on its own
  (README › Native apps).
- **Agency brief:** the push sender and the other new pieces are described as
  built but not yet proven against real services.
- **Release notes:** "What's new (4.0)" is written as an update, since
  this replaces version 3.2.8.

## Not proven by the automated checks (from the review's coverage table)

CI shows that builds run and that mocked journeys pass. It does not show
playback, sign-in or notifications on real phones. The browser suite runs
Chromium against fixtures, and its "phone" is Chromium emulation, not an
iPhone. The smoke test opens the apps in an Android emulator and an iOS
simulator. The agency's evidence, recorded per device in
[device-test-results.xlsx](device-test-results.xlsx), covers:

- **Audio:** long locked-screen sessions, network changes, interruptions,
  Bluetooth and headset controls, background and resume, battery limits.
- **Native:** a cold start from a locked phone and from the car, widget
  taps, and media controls after interruptions.
- **Content:** real feeds, including stale, malformed and partial ones; live
  video, tickets and donate links.
- **Notifications:** real APNs and FCM sends, revoked permissions, opt-out,
  and taps from the foreground, the background and a closed app.
- **Security and reporting:** rate limits on the public `/register`, real
  crash reports with symbols, and reporting switched off.
- **Release:** signed archives validated by the stores, entitlements, the
  link-verification files, a live support page, a staged rollout and who owns
  a rollback.

## Suggested order (from the review)

1. Confirm the store accounts, signing and versionCode
   ([store-identity.md](store-identity.md)).
2. Agree the minimum OS (now iOS 16.4) and confirm it on a device.
3. Deploy the push sender only with F3 and F5's checks done on real phones.
4. Rerun the checks on the final commit.
5. Run the device plan and the acceptance cases above, recording the build,
   OS, device, result and owner.
6. Validate signed store builds and the final listing and privacy content.
