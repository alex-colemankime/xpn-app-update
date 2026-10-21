# WXPN push sender

A Cloudflare Worker that keeps the phones' push tokens and sends the station's notifications to them: Android through Google's Firebase Cloud Messaging (FCM), iOS straight to Apple (APNs). It matches what the app already does (`push.js`), so nothing in the app changes; deploy it, set its secrets, and build the app with `VITE_PUSH_REGISTER_URL` pointing at it.

| Route            | Who                      | What                                                                          |
| ---------------- | ------------------------ | ----------------------------------------------------------------------------- |
| `POST /register` | the app                  | `{ token, platform, topics, app, version }`; empty `topics` forgets the token |
| `POST /send`     | staff, with the send key | `{ title, body, data, kind }` to every phone with notifications on            |
| `GET /`          | staff                    | the sending page                                                              |

Files: `worker.js` (routes, storage, sending), `core.js` (validation, the FCM and APNs payloads, JWT signing; no Cloudflare, tested in Node by `tests/push-sender.test.mjs`), `page.js` (the sending page), `wrangler.toml`.

## Deploy

You need a Cloudflare account (free) and Node 22. From this folder:

1. **Sign in:** `npx wrangler login`.
2. **Make the token store:** `npx wrangler kv namespace create TOKENS`, and put the `id` it prints in `wrangler.toml` (`REPLACE_WITH_KV_NAMESPACE_ID`).
3. **Set the secrets** (each asks for the value, or reads it from a file as shown):
   - `npx wrangler secret put SEND_KEY`: the password staff send with. Make it long and random (`openssl rand -base64 24`); anyone with it can notify every listener.
   - `npx wrangler secret put FCM_SERVICE_ACCOUNT < service-account.json` (see below).
   - `npx wrangler secret put APNS_KEY_P8 < AuthKey_XXXXXXXXXX.p8`, `npx wrangler secret put APNS_KEY_ID` (the 10 characters in the file's name), `npx wrangler secret put APNS_TEAM_ID` (Apple Developer › Membership details).
4. **Deploy:** `npx wrangler deploy`. It prints the address, e.g. `https://wxpn-push.<account>.workers.dev` (a custom domain such as `push.xpn.org` can be added in the Cloudflare dashboard).
5. **Point the app at it:** build with `VITE_PUSH_REGISTER_URL=https://wxpn-push.<account>.workers.dev/register` (the repository variable of the same name for the Release workflow). The app registers when a listener turns on Settings › Notifications from WXPN.

The variables in `wrangler.toml` (`APNS_BUNDLE_ID`, `APNS_SANDBOX`, `IOS_VIA`, `PAGE_SIZE`…) are explained there.

### Where the keys come from

- **FCM service account (Android):** in the Firebase console, the same project whose `google-services.json` is in `android/app/`: Project settings › Service accounts › Generate new private key. That downloads the JSON this needs whole. The Firebase Cloud Messaging API (V1) must be enabled (Project settings › Cloud Messaging; it is for new projects). Keep the file out of the repository.
- **APNs key (iOS):** developer.apple.com › Certificates, Identifiers & Profiles › Keys › +, tick Apple Push Notifications service (APNs); if asked for an environment, choose Sandbox & Production. Download the `.p8` (Apple offers it only once). One key works for all the team's apps. The App ID `com.jacobsmedia.WXPN` needs the Push Notifications capability (Xcode › Signing & Capabilities).
- **Sandbox or production:** builds installed from Xcode get sandbox tokens; TestFlight and App Store builds get production tokens, and each works only with its own APNs server. The Worker sends to production unless `APNS_SANDBOX = "true"`. For testing from Xcode, deploy a second copy (`npx wrangler deploy --name wxpn-push-dev` with its own KV namespace) with sandbox on.

## iOS tokens: what the app sends

Checked in the code: the app uses `@capacitor/push-notifications`. On iOS its plugin turns the device token Apple gives `AppDelegate` (`didRegisterForRemoteNotificationsWithDeviceToken`, forwarded in `ios/App/App/AppDelegate.swift`) into upper-case hex and reports that, so **iOS tokens are APNs device tokens**, sent as they are to `https://api.push.apple.com/3/device/<token>`. The Firebase iOS SDK isn't in the app, so there are no FCM tokens on iOS. On Android the plugin asks `FirebaseMessaging.getToken()`, so **Android tokens are FCM tokens**. The Worker checks each against its platform (hex for iOS, FCM's characters for Android).

If the app later adds the Firebase iOS SDK (making iOS tokens FCM tokens), set `IOS_VIA = "fcm"`: iPhones then register FCM tokens, which are stored as such and sent through FCM. Tokens registered before the switch are APNs tokens, and keep going through APNs until each phone registers again (the app re-registers at least weekly), so keep the APNs key until they have.

## Sending

**The page:** open the Worker's address. Fill in a title (100 characters at most) and the message (400), choose what a tap opens (listen to a station, open an https link, watch a video in the app, or just open the app) and the kind of notice, enter the send key (kept in that browser tab until it closes), check the preview, and Send. It asks once more, then reports how many phones it reached, how many couldn't be reached, and how many no longer have the app (those tokens are removed).

**From a script:**

```sh
curl -X POST https://wxpn-push.<account>.workers.dev/send \
  -H "Authorization: Bearer $SEND_KEY" -H "Content-Type: application/json" \
  -d '{ "title": "Live now", "body": "Dawes at Free at Noon",
        "kind": "live",
        "data": { "action": "watch", "watch": "https://www.youtube.com/watch?v=…", "title": "Dawes" } }'
```

The answer is `{ "sent", "failed", "removed", "skipped", "cursor", "errors", "warnings" }`. Each request sends to one page of phones (`PAGE_SIZE`); while `cursor` isn't null, send the same body again with that `"cursor"` added. The page does this itself.

- `data` is one of `{ "action": "listen", "stream": "xpn" }` (or `xpn2`, `homegrown`), `{ "action": "open", "url": "https://…" }`, `{ "action": "watch", "watch": "https://…", "title": "…" }`, or left out (the tap just opens the app). Links must be https.
- `kind` is `live`, `drives` or `other` (the default). Everyone on the current app gets every kind; listeners still on the first version, which had a switch per kind, get only the kinds they chose.

**Dead tokens:** a phone that has removed the app (FCM `UNREGISTERED` / 404, APNs 410 or `BadDeviceToken`) is forgotten. If every token on a platform comes back that way at once (five or more), it's far more likely a setup mistake (sandbox tokens sent to production, another Firebase project), so none are removed and the answer says what to check.

## Costs

Google and Apple charge nothing for push. Cloudflare's free plan covers a station's use with two limits to know:

- **KV writes, 1,000 a day** (also 1,000 deletes and 100,000 reads). Each listener who turns notifications on, or whose phone gets a new token, is one write; the same registration again isn't written. A launch where more than about 1,000 listeners a day turn it on needs the Workers Paid plan (US $5 a month, which includes a million KV writes a month); registrations over the limit fail and the app retries later.
- **50 outside requests per request,** so each `/send` reaches 40 phones (`PAGE_SIZE`) and the page sends page after page; 1,000 KV lists a day makes that 40,000 phones a day. On the paid plan raise `PAGE_SIZE` (to a few hundred) so a send takes fewer requests.

Requests (100,000 a day free) and CPU (signing is done once per request and the credentials are kept for up to an hour) aren't a concern.

## Not yet tried against the real services

The tests stand in for Google and Apple. Before relying on it, send to a test phone on each platform, and check:

- **APNs needs HTTP/2.** Whether Cloudflare's outgoing `fetch` reaches Apple over HTTP/2 hasn't been tried here. If iOS sends fail (connection errors, or "APNs" errors on every iOS phone while Android works), the options are: run this same `worker.js` where `fetch` speaks HTTP/2 (Deno Deploy runs standard fetch handlers), or add the Firebase iOS SDK to the app and set `IOS_VIA = "fcm"`.
- A notification's tap on each platform opens what its `data` says (the app reads it as `pushTarget` in `push.js`): Android gets the data from the tray notification's extras, iOS from the payload beside `aps`.
