# WXPN app

A radio-first redesign of the existing React/Vite app. The original package manager, Capacitor media-session integration, and local favorites and alarm storage keys are preserved.

## Run

```sh
npm ci
npm run dev
npm run build
```

`npm run build:pages` retains the GitHub Pages path. The existing workflow publishes only pushes to `main`.

## Listening experience

- **Listen:** selected station, actual reported song and artwork, play/pause, save/share, recently played, and the listener’s saved songs. No sample music is substituted into the live playlist.
- **Favorites:** songs, followed shows, episodes, and concerts saved on the current device; search and song sharing.
- **Shows:** searchable show directory, weekly schedule in Eastern Time, show details, follow/unfollow, and episode saves.
- **Concerts:** search, region and month filters, WXPN Welcomes, and saved concerts.
- **Settings:** Light, Dark, or device-based appearance; output selection where supported, volume, local alarm, and station contact links.

The same audio element stays alive across screens. Play reconnects to the current broadcast; Pause detaches the source. Buffering and errors are distinct states. Media-session play/pause controls invoke the same player actions as the visible buttons.

## Data and limitations

`nowplaying.js` polls the official WXPN and XPN2 playlist feeds every 30 seconds while visible, refreshes on play and return to the app, and separates each stream’s data. Feed dates use `America/New_York`. Old or interrupted song reports are labeled **Last reported song**. Kids Corner audio works; no song feed is configured for it.

`shows.json` retains the more complete directory from the supplied preview. Weekday schedule corrections in `catalog.js` were checked against WXPN’s program guide on September 7, 2026. Specialty schedules may change.

Concerts remain explicitly labeled sample listings when no `VITE_XPN_CONCERTS_ENDPOINT` is supplied. A configured feed failure produces an error state, not fabricated events. Sample archive episodes have no audio source; their detail views say so and link to WXPN instead of simulating playback.

Favorites and alarm preferences use the original `xpn.*` local-storage keys. They remain device/origin-local, so the private redesign URL does not automatically inherit favorites from GitHub Pages. Alarm behavior depends on the browser staying open and awake and allowing audio. Native iOS/Android background behavior must be verified in a configured Capacitor host; native projects are not present in this repository.

## Design basis

The main journey is **listen → identify a song → save it → find it again**. Album art always belongs to the reported song; stream controls and song controls have distinct labels. Recently played and saved tracks occupy the listening screen. Shows and concerts have their own screens, with a persistent mini player.

References reviewed:

- [KEXP mobile app](https://www.kexp.org/mobile/): live listening, real-time playlist, favorites, and a separate archive.
- [KEXP roadmap](https://kexp.org/mobile/mobile-roadmap/): search, favorites export, and playback improvements.
- [KCRW app](https://www.kcrw.com/stories/welcome-to-the-new-kcrw-com-and-kcrw-app): direct stream access and music playlists.
- [WXPN program guide](https://xpn.org/program_guide/)
- [WXPN playlist](https://xpn.org/wxpn-playlists/)

Source is split between the app shell (`App.jsx`), content screens (`screens/`), reusable music rows and player (`components/`), data and appearance hooks (`hooks/`), shared accessible controls (`ui.jsx`), and the existing player/storage modules. No UI library or new production dependency was added.

Appearance is saved as `xpn.appearance`. Device mode follows operating-system changes, and the theme is applied before React starts to avoid a flash on reload. Shared color tokens in `global.css` cover both palettes.
