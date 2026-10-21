# Store identity: updating the existing WXPN apps

This release must install as an **update to the existing WXPN apps**, not
as new listings. WXPN's owner confirmed it on October 21, 2026. The builds
now carry the existing apps' identities, found in the public store records
that day:

|             | Existing app                                                                                                                            | This build                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| App Store   | "WXPN 88.5", Apple ID 304658861, bundle ID `com.jacobsmedia.WXPN`, seller University of Pennsylvania, version 3.2.8, iOS 15.6 and later | bundle ID `com.jacobsmedia.WXPN`, widget `com.jacobsmedia.WXPN.widget`, version 4.0.0, iOS 16.4 and later |
| Google Play | `com.jacobsmedia.wxpn`                                                                                                                  | `applicationId "com.jacobsmedia.wxpn"`                                                                    |

What stays as it was, on purpose:

- **The Android source package**, `org.xpn.wxpn`, is the `namespace`.
  Android's store identity is the `applicationId`, so the classes don't
  need to move. Component names (and `adb` commands) are
  `com.jacobsmedia.wxpn/org.xpn.wxpn.MainActivity`.
- **The URL scheme**, `org.xpn.wxpn://`, used for the Spotify return and
  the widget's links. A scheme isn't an identity. Keep it unless the old
  app's own scheme must keep working (see below).
- **The app group**, `group.org.xpn.wxpn`. It's new either way, and gets
  registered under the team that owns the app.

## Before the first upload: confirm with the accounts

The public records establish the identities, but not access to them.

1. **App Store Connect:** the app record 304658861 is in the account the
   build is uploaded to (Penn's, as its seller), and that team can sign
   `com.jacobsmedia.WXPN`. Register `com.jacobsmedia.WXPN.widget` and the
   app group under it. Turn on Push Notifications and Associated Domains for
   the App ID. The CarPlay entitlement request
   (`docs/carplay-entitlement-request.md`) names this bundle ID.
2. **Google Play:** the listing `com.jacobsmedia.wxpn` is in WXPN's or
   Penn's Play Console. Play App Signing's app signing key and the upload key
   are both covered: either the existing upload key (from whoever builds the
   current app, Jacobs Media), or an upload key reset through Play Console ›
   App integrity.
3. **Version code:** Play Console › App bundle explorer shows the existing
   app's highest versionCode. Set the repository variable
   `ANDROID_VERSION_CODE_BASE` above it. The Release workflow adds its run
   number, and refuses to build without the variable.
4. **Firebase:** `google-services.json` for the Android package
   `com.jacobsmedia.wxpn`, and `GoogleService-Info.plist` for
   `com.jacobsmedia.WXPN`.
5. **Links:** `native/well-known/` already names the new identities. Fill in
   the Team ID and the Play signing key's SHA-256 before xpn.org hosts the
   files.

## What carries over from the old app, and what doesn't

The existing apps were built by Jacobs Media, on a different code base.
This app keeps its data in its WebView's storage, so it **can't read what
the old app saved**. Before release, WXPN decides, with whoever has the
old app's source:

- **Saved favorites or settings:** if the old app stores any, either migrate
  them (a small native step on first launch that reads the old storage and
  hands it to `favorites.js`) or tell listeners in the release notes. Each
  needs the old app's storage format.
- **Push notifications:** the old app's push tokens are in its own provider.
  Listeners are asked again in this app, and registered with the new
  sender. Retire the old provider after the update rolls out.
- **Links into the old app:** any custom URL scheme or link domain it
  claimed, if campaigns or partners still use them.
- **Reviews and ratings** stay with the listing; nothing to do.

## Acceptance

On each platform, install the **currently published** app from the store,
use it (save favorites, turn on notifications), then update it through
TestFlight or Play internal testing to this build. Check that:

- it updates in place: the same icon, no second app;
- what WXPN decided to carry over is there;
- links to xpn.org open it;
- notifications register again.

A clean install doesn't count as passing this.
