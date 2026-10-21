# CarPlay entitlement request

CarPlay only shows apps Apple has approved for a CarPlay category. WXPN
needs the **CarPlay audio** entitlement (`com.apple.developer.carplay-audio`).
Apple reviews requests by hand, often over several weeks, so send this
before the app is otherwise finished: the wait then overlaps the rest of the
work.

## How to send it

1. Sign in to the Apple Developer account that will publish the app (the
   Account Holder or an Admin) and open
   **developer.apple.com/contact/carplay**.
2. Choose **Audio** as the category and fill in the form with the answers
   below.
3. Once Apple grants it, the entitlement appears for the app ID
   `com.jacobsmedia.WXPN` (the existing WXPN app's) in Certificates, Identifiers &
   Profiles. Then:
   - add `com.apple.developer.carplay-audio` (Boolean, YES) to
     `ios/App/App/App.entitlements`;
   - let automatic signing refresh the profile (the Release workflow does,
     with `-allowProvisioningUpdates`), or regenerate it by hand;
   - test with Xcode's CarPlay simulator (I/O › External Displays ›
     CarPlay) and in a car, with `docs/device-testing.md` › The car.

Until then the app builds and works as before; the CarPlay screen simply
never appears.

## Answers for the form

**App name:** WXPN

**Bundle ID:** com.jacobsmedia.WXPN (the existing WXPN 88.5 app, Apple ID 304658861)

**Category:** Audio

**What the app does (short description):**
WXPN is the official app of WXPN 88.5 FM, the listener-supported public
radio station of the University of Pennsylvania in Philadelphia. It plays
the station's three live streams (WXPN, XPN2 and Homegrown), shows what's
playing and what's on the air, and offers the station's archived shows,
videos and concert listings.

**How the app uses CarPlay:**
In CarPlay the app offers audio only, through Apple's audio templates: a
list template with the three live streams, each with its station tile, and
the system Now Playing template showing the current song, artist and
artwork from MPNowPlayingInfoCenter. Choosing a stream starts it; play and
pause come through MPRemoteCommandCenter. Because the streams are live
radio, there is no seeking or skipping. No video, text entry or other
content is shown in the car.

**Why drivers would use it:**
Listening to WXPN is the station's main use. Many listeners hear the
station in the car today on FM, and CarPlay lets them hear XPN2 and
Homegrown, which aren't on FM, and keep listening outside the station's
broadcast area.

**Is the app available now?**
In development; planned for the App Store in [month, year]. A TestFlight
build can be provided on request.

**Company / organization:** WXPN 88.5 FM, University of Pennsylvania

**Contact:** [name, email, phone of the person Apple should reply to]

## What reviewers may ask, and where it's answered

- **The templates used:** `CPListTemplate` and `CPNowPlayingTemplate.shared`
  (`ios/App/App/CarPlaySceneDelegate.swift`).
- **Background audio:** `UIBackgroundModes` › `audio` (`Info.plist`), with
  the audio session category `.playback` (`AppDelegate.swift`).
- **Starting from the car with the phone app closed:** the CarPlay scene
  loads the app's player without showing the phone's window
  (`AppLauncher.ensureWebAppLoaded()`).
