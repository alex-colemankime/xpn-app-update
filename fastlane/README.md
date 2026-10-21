# Store submissions (fastlane)

Store listings, TestFlight and Play uploads, and review submissions, each one command. The builds themselves come from the **Release** workflow (`.github/workflows/release.yml`), which signs the Play bundle and uploads to TestFlight; these lanes do everything around them and sign nothing.

The listing is written once, in `store/listing.md`. `tools/store-metadata.mjs` turns it into fastlane's files and checks every store limit; every lane that sends a listing runs it first, so the stores always get what `listing.md` says.

## Install

Ruby 3.x (macOS's system Ruby is too old; use Homebrew's or rbenv), then from the repository root:

```sh
bundle install                       # fastlane, from the root Gemfile; commit the Gemfile.lock it writes
bundle exec fastlane lanes           # lists the lanes below
```

Node runs the metadata script, as for the rest of the repo. Only `ios beta` needs a Mac (Apple's uploader); the listing, review and Android lanes run anywhere.

## Environment

The same names as the Release workflow's secrets, so one set of keys serves both.

| Variable                                                                                | For           | What                                                                                                                                                        |
| --------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ASC_KEY_ID`, `ASC_ISSUER_ID`                                                           | iOS           | The App Store Connect API key (Users and Access › Integrations), App Manager role or higher                                                                 |
| `ASC_KEY_P8` or `ASC_KEY_PATH`                                                          | iOS           | The key's `.p8`: its text, or the file's path                                                                                                               |
| `APPLE_TEAM_ID`                                                                         | iOS           | Optional here (`Appfile`); needed only with more than one team                                                                                              |
| `ASC_REVIEW_FIRST_NAME`, `ASC_REVIEW_LAST_NAME`, `ASC_REVIEW_PHONE`, `ASC_REVIEW_EMAIL` | iOS           | App Review's contact person (required to submit). Kept out of the repo; once set in App Store Connect it stays, so these can be left unset afterwards       |
| `FASTLANE_USER`                                                                         | `ios privacy` | An Apple ID (Admin or App Manager) — App Privacy can't be set with an API key. Asks for the two-factor code                                                 |
| `PLAY_SERVICE_ACCOUNT_JSON` or `PLAY_SERVICE_ACCOUNT_JSON_PATH`                         | Android       | The Google Cloud service account's JSON key (its text, or the file's path), invited in Play Console › Users and permissions with release and listing rights |
| `IPA`, `AAB`                                                                            | builds        | Optional paths, instead of the `ipa:` / `aab:` options                                                                                                      |

Keep them in your shell or in `fastlane/.env`, which fastlane reads by itself and the repo's `.gitignore` already keeps out of git.

## Lanes

| Lane                                         | Does                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fastlane ios metadata`                      | Name, subtitle, description, keywords, promotional text, what's new, the three URLs, categories (Music, Entertainment), App Review notes and the screenshots, to the version in `package.json` (made if it isn't there). No build, no submission.                                                                                                                                                                                 |
| `fastlane ios beta ipa:build/export/App.ipa` | Uploads an `.ipa` you already have to TestFlight. Add `changelog:"…"` to set What to Test (it then waits for processing). The Release workflow uploads its own builds, so this is for a build made on a Mac.                                                                                                                                                                                                                      |
| `fastlane ios release`                       | Everything `ios metadata` sends, then picks the build (`build:42`, or the latest of this version), answers export compliance (no non-exempt encryption), no advertising identifier, third-party content (the broadcasts), and submits for review. A submission still waiting for review is withdrawn and replaced. Release after approval is by hand unless `automatic_release:true`; `phased_release:true` releases over 7 days. |
| `fastlane ios privacy`                       | App Privacy answers (`fastlane/app_privacy_details.json`, made from the table in `listing.md`), then publishes them; `skip_publish:true` leaves them to look over in App Store Connect first.                                                                                                                                                                                                                                     |
| `fastlane android metadata`                  | Title, short and full description, feature graphic and phone screenshots to the Play listing. Needs a release on the internal track (fastlane attaches a listing edit to one).                                                                                                                                                                                                                                                    |
| `fastlane android internal aab:…`            | Uploads a signed `.aab` to internal testing, with `changelogs/default.txt` as its release notes. Default path: the Release workflow's (`android/app/build/outputs/bundle/release/app-release.aab`); the workflow's `android-release` artifact is the same file. Add `draft:true` while the app has never been released (see below).                                                                                               |
| `fastlane android promote`                   | Moves the internal release to production at a 20% staged rollout (`rollout:0.5`, `rollout:1` for everyone; `version_code:N` if internal holds more than one).                                                                                                                                                                                                                                                                     |
| `fastlane android rollout rollout:0.5`       | Raises a staged production rollout; `rollout:1` completes it.                                                                                                                                                                                                                                                                                                                                                                     |

Run each as `bundle exec fastlane …`. The listing text alone: `node tools/store-metadata.mjs` (writes) or `node tools/store-metadata.mjs --check` (fails if the committed files are behind `listing.md`, for CI).

## What's committed

- `fastlane/metadata/**.txt` and `fastlane/app_privacy_details.json`: generated, committed, so a change to the listing shows in review as text. Regenerate after editing `store/listing.md`; never edit them by hand.
- Screenshots: not duplicated. `store/` (made by `tools/store-shots.mjs`) holds the only committed images, about 5 MB; the script copies them to `fastlane/screenshots/en-US/` (deliver) and `fastlane/metadata/android/en-US/images/` (supply) each run, and `fastlane/.gitignore` keeps the copies out of git. It checks each size first: `store/ios` must be iPhone 6.9" (1320×2868; App Store Connect scales it for the smaller iPhones), `store/ipad` iPad 13" (2064×2752), `store/android` 2 to 8 phone shots between 16:9 and 2:1, and `feature-graphic.png` 1024×500. Deliver tells the display types apart by pixel size; the `iphone-6.9-` and `ipad-13-` prefixes only keep the folder readable.

## First submission

Once the by-hand steps below are done:

**iOS**

1. Release workflow (makes and uploads build 1 to TestFlight; wait for its email that it has processed).
2. `fastlane ios privacy` (once, and again whenever the data the app collects changes).
3. `fastlane ios metadata`, then look over the version page in App Store Connect.
4. `fastlane ios release`.

**Android**

1. Release workflow (makes the signed bundle). On an app that has never been released, Play only takes draft releases, so the workflow's own upload step fails; upload with `fastlane android internal aab:… draft:true` instead (or the first bundle by hand, if Play still asks for one, which also accepts Play App Signing).
2. `fastlane android metadata`.
3. Finish the App content section (below) and the store settings.
4. `fastlane android promote draft:true`, then in Play Console › Publishing overview send the production release for review. Afterwards releases are no longer drafts and `fastlane android promote` rolls out straight away.

## A review round

**App Store rejection**

- Listing or notes only: fix `store/listing.md`, `node tools/store-metadata.mjs`, commit, `fastlane ios release` (same build), and reply in App Store Connect's App Review messages.
- The app: fix, run the Release workflow (a new build number), then `fastlane ios release` (picks the newest build) and reply to App Review.

**Play rejection**

- Listing: fix `listing.md`, `fastlane android metadata` (Play sends the change for review).
- The app: fix, Release workflow (uploads to internal when `PLAY_SERVICE_ACCOUNT_JSON` is set; otherwise `fastlane android internal`), then `fastlane android promote`.
- A declaration (Data safety, permissions): fix it in Play Console, then resubmit from Publishing overview. None of these have an API.

## Still by hand

**App Store Connect**

- **The app record** (Apps › New App: platform, name WXPN, language, bundle ID `org.xpn.wxpn`, SKU). The API can't create apps.
- **Pricing and Availability:** free, and the countries.
- **Age rating questionnaire.** Answer the unrestricted web access question carefully (see `listing.md`); fastlane's old age-rating file doesn't cover Apple's 2025 questions, so it's left to the form.
- **App Privacy, without `ios privacy`.** The App Store Connect API (and so any API-key login) has no App Privacy endpoints at all. `ios privacy` sets every answer in the table (data types, purposes, not linked to the user, not used for tracking) through an Apple ID session instead. Either way, check them against the privacy policy before the first submission, as `listing.md` says. The privacy policy URL itself goes up with `ios metadata`.
- **Copyright line** (the version page): `listing.md` doesn't give the rights holder's name (WXPN, or the Trustees of the University of Pennsylvania); add it once, by hand or as `fastlane/metadata/copyright.txt` through `listing.md` and the script.
- **Content rights:** `ios release` answers "uses third-party content"; Apple's form also asks that WXPN has the rights to it, which is WXPN's to confirm.
- **App Review contact,** if the `ASC_REVIEW_*` variables aren't set.
- **Replying to App Review** and releasing an approved version (unless `automatic_release:true`).
- **CarPlay:** the entitlement request (README › Native apps).

**Play Console**

- **Creating the app** (name, default language, app, free) and, at the first upload, accepting Play App Signing. The API can't create apps.
- **App content, all of it** (the Play Developer API has no endpoints for any of these): **Data safety** (every question, from `listing.md` › Data safety; the form can export its answers as a CSV and import them again, which saves retyping them for a second app), privacy policy URL, app access (no sign-in), ads (none), content rating questionnaire, target audience (13 and over), news app, government app, financial and health features, and the **foreground service** declaration with its video.
- **Store settings:** app category (Music & Audio), contact email and website. fastlane's supply doesn't set them.
- **App icon** for the listing (512×512 PNG, from `brand/app-icon-1024.png`); the script doesn't make one.
- **Android Auto:** opt in under Advanced settings › Form factors, for Google's car review.
- **Testing requirement:** a personal developer account must run a closed test (12 testers, 14 days) before production; an organization account, as WXPN's should be, doesn't.
