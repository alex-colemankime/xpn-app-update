# WXPN app design system

A handoff for the team taking the app to the App Store and Google Play. It
describes how the interface is built today, which decisions the station has
already made, and where each piece lives in the code. Every value below is
taken from the source; when this document and the code disagree, the code
wins, and this document should be fixed.

See every screen, light and dark, on the screens page:
`design/screens/index.html`, also live at
<https://alex-colemankime.github.io/xpn-app-update/screens/>.

## 1. Binding client decisions

The station has signed off on these. Don't reverse them without asking the station first.

| Decision                                     | What it means in the code                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hearts take the album art's color            | A saved heart is colored from its artwork by `art-tint.js`: it picks the artwork's main vivid color (or its overall tone for muted or black-and-white art), then moves its lightness until it has at least 3.4:1 contrast on every page, surface, row and bar color in that theme. It never uses the station orange. Until a color is known, the heart uses `--accent`. |
| Donate is at the top of every screen         | Phone: `.topbar-donate` in the header. Tablet and desktop: `.sidebar-donate` at the foot of the sidebar. Giving happens on xpn.org in the browser (App Review 3.2.2).                                                                                                                                                                                                   |
| No progress bar or rewind on live radio      | The live player bar (`LiveBar` in `components/PlayerBar.jsx`) has play/pause, the song, its heart, volume and output, and nothing else. Only archived episodes have a scrubber (`.player-seek`) and the thin phone progress line (`.player-progress`).                                                                                                                  |
| No glowing or pulsing dots                   | "Live" is a still dot and the word. Nothing pulses. The only looping animations are the connecting spinner (after 300ms), the skeleton shimmer, pull-to-refresh, and the ringing alarm bell.                                                                                                                                                                            |
| Orange is only for actions                   | `--action` (#ef7149) and its tonal forms mark things to do: listen, give, the main action of a sheet, a switch that is on, a checked box. Selection and "where you are" (tab, station, view, day, filter) are marked in ink with `--select-ink` / `--select-fill`.                                                                                                      |
| One tonal style for the main keys            | Listen live (`.hero-play`), Tickets and other `.primary-button`s, play/pause (`.player-play`) and the alarm's Snooze all use `--donate-fill` with `--donate-ink` text, and squared corners (`--radius-m`). Only Donate itself is a pill.                                                                                                                                |
| Choices are underlined words                 | Tabs, station switcher, settings choices, days of the week and concert quick filters are words. The chosen one is in ink with a 2px ink underline. Don't turn them into pills, chips or boxed segments.                                                                                                                                                                 |
| Concerts are cards                           | Each concert is a card on `--raised`. WXPN Welcomes / Free at Noon shows get a banner across the top in Donate's colors, and a 40% wash of `--donate-fill` over the rest of the card.                                                                                                                                                                                   |
| Neutral page, not cream                      | The page is `#f5f5f3` (light) and `#111111` (dark).                                                                                                                                                                                                                                                                                                                     |
| The logo's w is in the Donate fill           | `--brand-w: var(--donate-fill)`, applied to `.station-logo-w` and `.wordmark-w`.                                                                                                                                                                                                                                                                                        |
| Onboarding never sends people out of the app | `components/Welcome.jsx` has three steps: follow shows, reminders, and connect a music service. No step opens a browser. The one exception is connecting Spotify or Apple Music, which may leave the app to sign in, so the welcome is marked done before it does.                                                                                                      |
| No generic or "AI-looking" template chrome   | No film grain, glows, heading icons, decorative eyebrow labels, gradient hero blocks or chip rows. The layouts borrow from radio's own documents: the program log (Recently played, with a column of play times) and the alarm read back as a sentence ("Wakes you at 7:00 AM on weekdays to WXPN"). See README, "Design basis".                                        |

Other principles that run through the code:

- **One loud thing per screen.** Secondary actions use a soft fill in the text color (`--soft-fill`) or plain words.
- **Every gesture has a button.** Press and hold, pull to refresh, pull a sheet down and double-tap the artwork all repeat something a visible control already does.
- **The main path is listen, identify a song, save it, find it again.** The album art always belongs to the song shown, and the stream controls and song controls have different labels.
- **Nothing shifts.** The chosen state keeps the same font weight, status lines keep their height, and placeholder rows match the real rows.

## 2. Tokens

Everything is in `styles/base.css`. Light values are on `:root` and
`:root[data-theme="light"]`. Dark values are on `:root[data-theme="dark"]`.
The app always sets `data-theme` (Settings › Appearance: Automatic, Light, Dark).

### 2.1 Color

| Token               | Light                                        | Dark                                         | Used for                                                                                |
| ------------------- | -------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| `--paper`           | `#f5f5f3`                                    | `#111111`                                    | The theme's own page color, before any wash                                             |
| `--paper-raised`    | `#ebebe8`                                    | `#1d1d1d`                                    | The theme's raised surface, before any wash                                             |
| `--bg`              | `var(--paper)`                               | `var(--paper)`                               | Page background; the Listen wash replaces it                                            |
| `--surface`         | `var(--paper-raised)`                        | same                                         | Sheets, menus, search fields, the mini player on phones                                 |
| `--text`            | `#111111`                                    | `#f0f0ed`                                    | Ink                                                                                     |
| `--muted`           | `#5c5c59`                                    | `#a2a29f`                                    | Secondary lines, resting tabs, icons                                                    |
| `--border`          | `#dcdcd8`                                    | `#2f2f2f`                                    | Hairlines between rows, the edges of bars                                               |
| `--control-border`  | `#8a8a86`                                    | `#6f6f6c`                                    | Edges of inputs, the Filters button, checkboxes                                         |
| `--accent`          | `#b83d1c`                                    | `#ff9875`                                    | Links, text buttons on hover, a saved heart before its tint loads, focus ring           |
| `--accent-strong`   | `#983012`                                    | `#ffa585`                                    | Accent text on an orange-tinted fill (keeps 4.5:1)                                      |
| `--action`          | `#ef7149`                                    | `#ef7149`                                    | The station's orange: switch on, checked box, banner action, station mark, filter count |
| `--action-ink`      | `#241710`                                    | `#241710`                                    | Text and glyphs on `--action`                                                           |
| `--row-alt`         | `#ececea`                                    | `#1b1b1b`                                    | Chosen sidebar item, icon-button hover, info notes                                      |
| `--raised`          | `#ffffff`                                    | `#262626`                                    | Desktop player bar, concert cards, alarm banner                                         |
| `--inverse-bg`      | `#1b1b1b`                                    | `#f0f0ed`                                    | Toasts                                                                                  |
| `--inverse-text`    | `#f5f5f3`                                    | `#111111`                                    | Toast text                                                                              |
| `--inverse-accent`  | `#ff9875`                                    | `#b83d1c`                                    | A toast's action                                                                        |
| `--soft-fill`       | text at 7%                                   | same                                         | Secondary button fill; a row while it is being held                                     |
| `--soft-fill-hover` | text at 11%                                  | same                                         | Secondary button hover                                                                  |
| `--select-ink`      | `var(--text)`                                | same                                         | Where you are: tab, station, view, day, filter                                          |
| `--select-fill`     | text at 9%                                   | text at 12%                                  | Pill behind the chosen tab-bar glyph, the sidebar's current screen, date range band     |
| `--donate-fill`     | `--action` 22% into `--bg` (about `#f4d8ce`) | `--action` 26% into `--bg` (about `#4b2a20`) | Donate, primary, play, Snooze, the Welcomes banner                                      |
| `--donate-ink`      | `var(--accent-strong)`                       | same                                         | Text on `--donate-fill` (5.5:1)                                                         |
| `--key-lit`         | `var(--donate-fill)`                         | same                                         | A secondary tonal key (an episode's play at rest, alarm test hover)                     |
| `--brand-w`         | `var(--donate-fill)`                         | same                                         | The w in the logo                                                                       |
| `--grabber`         | text at 30%                                  | same                                         | The 40 × 5px bar on top of sheets                                                       |

Hover and press on tonal keys: `color-mix(in srgb, var(--donate-fill), var(--donate-ink) 8%)` (Donate) and `color-mix(in srgb, var(--action) 34%, var(--bg))` (primary and play). Under `prefers-contrast: more`, `--muted` and `--border` get darker in light mode (`#45463f` / `#8a8b83`) and lighter in dark mode (`#d2d1cb` / `#7a7c7c`) (`styles/states.css`). On washed surfaces in dark mode (the on-air schedule row, Welcomes cards), `--muted` is raised to `#adaeab` so it keeps 4.5:1.

Hard-coded colors you can leave alone: the LIVE tag (`#d93d1e` with white), the live dot (`#ff5a36`), sheet backdrops (`#0009`, menus `#0008`), the video length badge (black at 72%), and the pale w on orange station tiles (`#fcd9c6`).

### 2.2 The art wash

Washes take the artwork's hue and keep the base color's own lightness (OKLCH), so text and hearts keep their contrast. The color is worked out in script (`washed()` / `washVars()` in `art-tint.js`), because some WebKit views don't recompute relative CSS colors when the artwork changes.

| Where       | Variables                                                              | Share of tint (light / dark) | Mixed into       | Set by                                     |
| ----------- | ---------------------------------------------------------------------- | ---------------------------- | ---------------- | ------------------------------------------ |
| Listen page | `--wash-bg-light` / `--wash-bg-dark`, plus `data-art-wash` on `<html>` | 0.24 / 0.22                  | `--paper`        | `useArtWash`, `screens/ListenScreen.jsx`   |
| Player bar  | `--bar-light` / `--bar-dark`, plus `data-tinted`                       | 0.26 / 0.24                  | `--paper-raised` | `useBarTint`, `components/PlayerBar.jsx`   |
| Show sheet  | `--show-light` / `--show-dark` (they replace `--surface`)              | 0.12 / 0.14                  | `--paper-raised` | `components/ShowDetail.jsx`                |
| On-air band | `--tint-light` / `--tint-dark` via `color-mix`                         | 13% / 17% (hover 19% / 24%)  | `--bg`           | `styles/now-playing.css`                   |
| Hearts      | `--tint-light` / `--tint-dark` with `data-tinted`                      | full tint                    | (none)           | `styles/layout.css`, `.saved[data-tinted]` |

Only Listen's wash animates, over `--dur-room` with `--ease-in-out`. Changing theme (`data-theme-switch`) and leaving Listen happen instantly. Contrast is covered by `tests/art-tint.test.mjs`.

### 2.3 Type

The typeface is Figtree Variable (`@fontsource-variable/figtree`), falling back to the system font. The root stays at 16px, so rem units follow the reader's text size. Body text is 17px.

| Token              | Size             | Leading    | Tracking | Use                                                |
| ------------------ | ---------------- | ---------- | -------- | -------------------------------------------------- |
| `--text-display`   | 2rem (32px)      | 1.1        | -0.025em | Screen title on wider screens (`h1`)               |
| `--text-title`     | 1.5rem (24px)    | 1.15       | -0.02em  | Sheet title, concert day heading, the alarm's time |
| `--text-heading`   | 1.25rem (20px)   | 1.25       | -0.015em | Section headings, empty-state titles               |
| `--text-body`      | 1.0625rem (17px) | 1.4        | (none)   | Rows, reading text, buttons                        |
| `--text-secondary` | 0.9375rem (15px) | (inherits) | (none)   | The line under a row's title, details              |
| `--text-caption`   | 0.8125rem (13px) | 1.35       | 0.01em   | Labels, badges, tab names, fine print              |
| `--text-numeral`   | 2.25rem (36px)   | 1          | -0.03em  | Sleep-timer minutes, the alarm setting's time      |

Weights: `--weight-regular` 400, `--weight-semibold` 600 (names, labels), `--weight-bold` 700 (titles, main action). Three places sit outside the scale on purpose. The song title on Listen (`.now-info h2`) is `clamp(2rem, 8.5vw, 2.75rem)` at weight 800, leading 1.02. The station art lettering is `clamp(2rem, 5vw, 4rem)` at 800. The station mark (`.station-mark`) is 1.375rem at 800. Figures that should line up use `font-variant-numeric: tabular-nums`.

### 2.4 Spacing, radii, layout sizes

Spacing is on a 4px grid. Use 2px only between two lines of text that belong together, such as a title and the line under it.

| `--space-1` | `-2` | `-3` | `-4` | `-5` | `-6` | `-8` | `-10` | `-12` |
| ----------- | ---- | ---- | ---- | ---- | ---- | ---- | ----- | ----- |
| 4px         | 8px  | 12px | 16px | 20px | 24px | 32px | 40px  | 48px  |

| Radius          | Value | For                                      |
| --------------- | ----- | ---------------------------------------- |
| `--radius-s`    | 6px   | Covers, thumbnails, badges, menu items   |
| `--radius-m`    | 12px  | Controls, keys, cards, menus, toasts     |
| `--radius-l`    | 20px  | Top corners of sheets, the welcome card  |
| `--radius-full` | 999px | Donate, brief toasts, switches, grabbers |

A corner inside another corner is smaller by the gap between them. Concert cards are square-cornered on purpose, like a printed listing.

| Layout token                   | Value                                                         |
| ------------------------------ | ------------------------------------------------------------- |
| `--player-h`                   | 4.75rem (desktop player bar)                                  |
| `--mini-h`                     | 4.75rem (phone mini player)                                   |
| `--tabbar-h`                   | 4.1875rem                                                     |
| `--sidebar-w`                  | 232px (190px at 768–1000px, 0 on phones)                      |
| `--page-gutter`                | `clamp(28px, 3.5vw, 56px)`, 28px at ≤1200px, 20px at ≤767px   |
| `--page-max`                   | 1376px                                                        |
| `--edge-left` / `--edge-right` | The larger of the gutter and the safe-area inset on that side |

### 2.5 Motion

| Token            | Value                                            | For                                                   |
| ---------------- | ------------------------------------------------ | ----------------------------------------------------- |
| `--dur-press`    | 100ms                                            | Feedback under a finger (scale, the heart press)      |
| `--dur-quick`    | 150ms                                            | Colors, fills, switches, toggles                      |
| `--dur-menu`     | 180ms                                            | Menus opening, the mini player stepping aside, toasts |
| `--dur-song`     | 450ms                                            | A new song fading in (`song-in`)                      |
| `--dur-room`     | 800ms                                            | The Listen wash and the player bar wash               |
| `--dur-sheet`    | 500ms                                            | Sheets rising, on the spring                          |
| `--ease-out`     | `cubic-bezier(0.2, 0.8, 0.2, 1)`                 | Most movement                                         |
| `--ease-in-out`  | `cubic-bezier(0.65, 0, 0.35, 1)`                 | Color changes, the hold fill                          |
| `--spring-sheet` | `linear(...)`, critically damped, 0.35s response | Sheets; `motion.js` runs the same spring for gestures |

Closing is faster than opening: menus close in 120ms, toasts leave in 120ms (180ms before they are removed, `LEAVE_MS` in `Toast.jsx`), and phone menu sheets slide away in 240ms. A press scales to 0.96. Tabs change instantly, except on Android, where they fade through (90ms out, 150ms in starting at 60ms, from scale 0.98). The tab change never slides sideways.

### 2.6 Layers

| Token           | Value | What                                                   |
| --------------- | ----- | ------------------------------------------------------ |
| (sticky, local) | 1     | Sheet headers, concert day headings                    |
| `--z-sidebar`   | 20    | Tablet and desktop sidebar                             |
| `--z-banner`    | 25    | Ringing alarm banner (sticky)                          |
| `--z-bars`      | 30    | Player bar, tab bar, status-bar scrim, pull-to-refresh |
| `--z-toast`     | 90    | Toasts                                                 |
| `--z-skip`      | 100   | Skip link                                              |

Dialogs and popovers use the browser's top layer, so they sit above all of these.

## 3. Components

The shared building blocks are in `ui.jsx`: `Modal`, `Segmented`, `Empty`,
`SkeletonList`, `SearchField`, `ChoiceSetting`, `Switch`, `Art` (which falls back to the
station art if an image fails), `Wordmark` and `PromptLink`.

### Shell

**Header with Donate** (`TopBar`, `components/Navigation.jsx`; `styles/layout.css`). Phones only. From left to right: the station logo (`StationLogo`, 76–92px wide, its w in `--brand-w`), Donate, and a 44px Settings key that opens Settings and closes it again. The header is 64px plus the top safe area, with a hairline under it. On Listen, Shows and Favorites the hairline is hidden, so the screen's tabs hang straight from the header. Donate is a 44px-tall link holding a 34px pill (`--donate-fill` / `--donate-ink`, 15px bold). On press it scales to 0.97 and the fill takes 8% of the ink. Its accessible name is "Donate to WXPN (opens in a new tab)".

**Tab bar** (`TabBar`; `styles/layout.css`, `styles/states.css`). Phones only. Listen, Shows, Videos, Concerts and Favorites. Videos and Concerts appear only when `features.js` turns them on. Each tab has a 21px glyph over a 13px semibold name, in `--muted`. The current tab turns `--select-ink`, its glyph switches to the filled version (icon name + `F`), and a 56 × 30px `--select-fill` pill sits behind the glyph, so the current tab is never shown by color alone. Names stay on one line and are capped at `min(1em, 3.6vw)`.

**Sidebar** (`Sidebar`; `styles/layout.css`). 768px and up. The logo (116px wide), the screens as 48px rows (the current one on `--row-alt` in ink), then Settings and a tonal Donate block at the bottom.

**Mini player and player bar** (`components/PlayerBar.jsx`; `styles/layout.css`, `styles/archive.css`). On tablet and desktop it is a bar on `--raised` under the content. Its ends line up with the page's content edges (`--bar-inset`). It holds play, the song (50px art, title and artist at 15px), the heart, and at the far end the volume (a slim range with a 4px track, 104px wide, 84px at ≤1000px) and Play on another device (the AirPlay or Cast glyph). On phones it is the mini player: full width above the tab bar on `--surface`, with the song first, then Play on another device, then play. When there is no artwork it shows the station mark. Play (`.player-play`) is 48 × 48px, `--radius-m`, and tonal. While connecting, its words say "Connecting…" and a spinner replaces the glyph only after 300ms. While Listen's big controls are on screen, the mini player steps aside (30% down, faded, over `--dur-menu`); an episode's mini player stays. The bar takes the artwork wash (section 2.2). Episodes add a scrubber and a close key; live radio never gets either.

**Status-bar scrim** (`components/StatusScrim.jsx`). Once the page scrolls, the page color blurs in under the phone's status bar. With reduced transparency it is a solid band instead.

### Choices

**Segmented tabs** (`Segmented`, variant `tabs`; `styles/controls.css`). Switches between views of a screen (for example Shows: schedule, all shows, hosts, archive) and between stations on Listen (`.station-switcher`). Words at 17px semibold, at least 44px tall (48px for the station switcher on wider screens), on a hairline. The current one is in `--select-ink` with a 2px ink underline. Each is `aria-pressed` inside a labeled `role="group"`. On phones they run edge to edge and scroll sideways.

**Underline choices** (`Segmented` variant `pill`, rendered as `.segmented-pill`; `ChoiceSetting`). For a setting with a few options (station, snooze length, theme). A row of words 20px apart, muted at rest. The chosen one is in ink with a 2px underline drawn 8px from the bottom (`::after`). No boxes, no fills.

**Day pickers** (`.day-picker` for the schedule, `.repeat-days` for the alarm's days). They use the same underline mark. On the schedule, today stays in ink even while another day is chosen.

**Concert quick filters** (`.chip`, `styles/concerts.css`). Despite the class name, these are words and not chips: 15px semibold, underlined when `aria-pressed="true"`, in a row that scrolls sideways and fades at the end only while there is more to scroll. **Filters** (`.filters-button`) is an outlined 44px key that fills with ink when any of its filters is on, with its count in a badge of the page color. Inside the filter sheet, checkboxes (`.filter-box`, 22px) fill with `--action` when on. The date range calendar (`components/RangeCalendar.jsx`) marks the chosen range with a `--select-fill` band, and its first and last days as ink circles.

**Switch** (`Switch`; `styles/settings.css`). 45 × 27px. Off is `--muted` with a `--bg` knob. On is `--action` with an `--action-ink` knob, moved 18px. Its hit area extends to at least 44px. It has `role="switch"` and `aria-checked`.

### Buttons

| Kind          | Class                      | Anatomy and size                                                                                                             | Tokens                                               |
| ------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Primary tonal | `.primary-button`          | Min height 48px, padding 12 × 24px (12 × 16px on phones), 17px bold, `--radius-m`                                            | `--donate-fill`, `--donate-ink`; hover at 34% action |
| Listen live   | `.now-controls .hero-play` | Fills its row, min height 50px (46px on phones); the label shortens with an ellipsis                                         | Same tonal pair                                      |
| Hero keys     | `.hero-key`                | 48 × 50px (46 × 46px on phones): heart, the song's "…" menu, Play on another device; plain glyphs in ink, soft fill on hover | `--text`, `--soft-fill`; a saved heart in its tint   |
| Secondary     | `.secondary-button`        | Min height 44px, padding 12 × 16px, 17px semibold, no outline                                                                | `--soft-fill` / `--soft-fill-hover`                  |
| Text          | `.text-button`             | Min height 44px, 15px semibold, muted; `--accent` on hover                                                                   | `--muted`, `--accent`                                |
| Icon          | `.icon-button`             | 44 × 44px circle, muted; hover on `--row-alt` in `--accent`                                                                  | `--muted`, `--row-alt`                               |
| Watch         | `.watch-button`            | 44px, ink fill with page-colored text, never orange                                                                          | `--text`, `--bg`                                     |
| Round key     | `.round-key`               | 34px circle, accent outline; filled with `--action` while its sound plays (alarm test)                                       | `--accent`, `--action`                               |

All of them scale to 0.96 on press, are dimmed to 0.6 when disabled, and show the focus ring described in section 5.

### Rows

**Track row** (`TrackRow`, `components/MusicRows.jsx`; `.track-row` in `styles/layout.css`). Used for Recently played and saved songs. Everything except the heart is one button that opens the song's sheet. Press and hold opens the same sheet. Anatomy: an optional time column (`.track-time`, 3.9rem, tabular 15px semibold muted), 46px art, the title (17px semibold, up to two lines), then the artist and time line (15px muted), and the heart (an `icon-button`). Rows are separated by hairlines. Long lists use `content-visibility: auto` with a 72px intrinsic height.

**Schedule row** (`.schedule-row`, `styles/controls.css`; `screens/ShowsScreen.jsx`). An hours column (4.25em, 4em on phones, so "midnight" fits at any text size), 65px art (47px on phones), the show name in semibold, the host, and a description (hidden on phones). The show on air now gets a 40% `--donate-fill` wash that extends 12px past each side as box-shadows, so nothing in the row moves. Screen readers hear "On air now"; there is no visible label.

**Setting rows** (`styles/settings.css`). `.setting-row`: min height 52px, hairline above, name at 17px, value at 15px muted (inline for "Alarm volume 70%"), sliders 135px wide (115px on phones) and 44px tall. `.alert-row`: a name with what it does under it, and a switch. `.setting-choice`: a name, then underline choices. `.service-row`: 56px, with "Connect" in accent.

**Host and show rows** (`components/HostSheet.jsx`, `styles/show-page.css`). `.host-show` is a grid of 56px art, the text, and a chevron, at min height 72px with a hairline under it. `HostLine` turns each host name in a show's sheet into a link to that host's sheet. `.archive-row` (`styles/archive.css`) is a broadcast in a show's list. Its hairline is inset with a background gradient, so the 12px hover fill can reach past the text. `.show-on-air` is the "On air now" row in a show's sheet. It plays the live station and never looks like an episode's Play.

### Overlays

**Sheets and modals** (`Modal` in `ui.jsx`; `styles/show-page.css`, `styles/responsive.css`, `styles/gestures.css`). Built on the native `<dialog>`, which provides the focus trap, Escape and the backdrop. On wider screens a sheet is a 570px side panel that slides in 48px from the right. On phones it is a bottom sheet with `--radius-l` top corners, a grabber, and a maximum height of the viewport minus 40px and the top inset. The header is sticky, holding the title (24px bold) and the Close key. The body padding is 24px. The backdrop is `#0009` with a 3px blur. When a sheet opens, focus moves to its title; when it closes, focus goes back to what opened it. **Drag to dismiss** (`hooks/useSheetDrag.js`, phones only): the sheet follows the finger one to one from its header, or anywhere once it is scrolled to the top. Letting go closes it if the throw would carry it past half its height, or if it is past 28% of its height (at least 96px) and not moving up. Moving up faster than 300px/s always springs it back. The backdrop fades as `--sheet-pull` goes from 0 to 1, and a haptic tick marks the point where letting go would close it. Show sheets take the show's wash, and routed sheets step back with Android's Back. The welcome (`.welcome-dialog`) is a centered 600px card on wider screens.

**Hold menus** (`components/HoldMenu.jsx`, `hold.js`; `styles/gestures.css`, `styles/now-playing.css`). Press and hold for 450ms (within 10px of the start point) on a song, show, episode, concert or video. While held, the row sinks to 0.98 on `--soft-fill`, and the menu arrives with a haptic. The menu is a bottom sheet, at most 480px wide and centered, with a grabber, opening on the sheet spring. On wider screens, a menu that knows what opened it hangs from that element through CSS anchor positioning. It has a head (`.popover-menu-head`: 44px art, title, muted line), then items at 48px with their glyph at the end. Every choice in it also exists as a button somewhere else. Other popover menus (sleep timer, add to calendar) are 240px or more, on `--surface` with a 1px border, and grow from their corner in 180ms.

**Toasts** (`components/Toast.jsx`, `toast.js`; `styles/notices.css`). The page's colors turned around (`--inverse-bg` / `--inverse-text`), rising from just above the player. A **brief** toast (under 40 characters) is a 40px pill sized to its words, slightly glassy, and stays 2s (3s with an action). A **bar** toast is up to 440px wide, with optional 36px art or an icon, a title and a line, one action in `--inverse-accent`, and a grabber. It stays 3s, or 4.5s with an action. Swipe it 32px down or 72px sideways to dismiss. Dismiss is visible only to keyboard focus. Toasts are announced through `role="status" aria-live="polite"`, and an open sheet carries its own `Toast inModal`.

### Banners and notices

**Station banner** (`components/StationUpdates.jsx`; `styles/station-updates.css`). A message from the station across the top of every screen: a band with a 15% `--action` wash, 15px semibold text (up to two lines), a compact `--action` key (36px drawn, 44px hit area), and a close key. On phones, a member-drive Donate key in the banner is hidden, because the header's Donate is right above it.

**Live banner** (`.station-banner[data-kind="live"]`). When there is a live video, the band turns to ink (like an ON AIR light), the whole band becomes the button, it carries a small red LIVE tag with a still white dot, and "Watch" sits at its end. On Listen it also appears as a **live card** (`.live-card`), and on phones that card is an edge-to-edge band under the station tabs.

**On-air band** (`components/OnAir.jsx`; `.on-air`). The show on air, with its art, on a wash of the show's color. Edge to edge on phones.

**Alarm banner** (`components/AlarmBanner.jsx`; `styles/alarm-banner.css`). A sticky bar at `--z-banner` on `--raised`: a ringing bell in `--donate-ink`, the time it went off at 24px bold tabular, then Snooze (tonal, the big target) and Dismiss (outlined), 12px apart. On phones the two keys sit side by side at equal width, 50px tall. The bell stops ringing under reduced motion.

**Offline notice** (`components/OfflineNotice.jsx`). A plain `--surface` line with `role="status"`.

### States

**Empty states** (`Empty` in `ui.jsx`; `.empty-state`). A 32px icon in `--accent`, a 20px semibold title, a muted line (at most 410px wide), then either a secondary button or a link to another screen ("Go to Videos ›").

**Skeletons** (`SkeletonList` in `ui.jsx`; `styles/states.css`). Placeholder rows shaped like the list they stand in for (46px art, lines at 62% and 38% width), with a 1.4s shimmer, inside `role="status"` with a hidden label. They are used so a list never replaces a line of text.

**Errors**. `.screen-error` replaces a single screen that failed. `.app-error` (`error-boundary.jsx`) replaces the whole app.

### Cards

**Show cards** (`ShowCard`, `components/MusicRows.jsx`; `HostCard` reuses it). A cover (`--radius-s`, aspect 1.5 on desktop, 1.1 at ≤1200px, 1.35 on phones, square in All shows on phones), then the name (17px semibold) and host or time (15px muted). The cover zooms to 1.04 on hover. Grid: 4 columns, 3 at 768–1000px (All shows), 2 on phones.

**Concert cards** (`components/ConcertRow.jsx`; `styles/concerts.css`). Grouped under a day heading ("Tonight Oct 18": the word in bold ink, the date muted, 24px). On phones the heading sticks to the top and gets a hairline only while it is stuck. From 768px it moves into a 10rem column beside the cards. Each card, on `--raised` and square-cornered, shows the headliner (17px semibold), "with" and the supporting acts (two lines at most), then venue, town and age limit, with the heart at the top right. The Welcomes banner sits on top (caption size, centered, one line). Tapping a card opens its sheet: the photo (no taller than 33dvh or 320px), the date, Tickets as a full-width primary button, then Add to calendar, Share and Save as plain words with glyphs.

**Video cards** (`components/VideoCard.jsx`; `styles/videos.css`). The whole card plays the video, so there is no play badge. A 16:9 thumbnail with a length badge, then the title (two lines), the detail, and the date. On phones each one is a row (136px thumbnail beside the text). From 640px they form a grid with a 232px minimum column. The newest video is a hero card: full width, then at 900px and up, two columns with the title at `--text-display`.

### Home screen widget

`widget.js` (the data, from `widgetNowPlaying()`), `ios/App/WXPNWidget/WXPNWidget.swift` `android/app/src/main/java/org/xpn/wxpn/WxpnWidget.kt` and `android/app/src/main/res/layout/wxpn_widget.xml`. It shows the stream name and line (or "Archive" for an episode), the song's art, title and artist, the WXPN show on air, and play/pause. Play/pause uses Donate's tonal colors and the squared shape, and opens the app to play or pause. The widget's colors mirror `base.css` in light and dark. It is shown on the screens page under "Home screen widget" (`tools/widget-screens.mjs`).

## 4. Layout

| Width                     | Shell                                                       | Gutter                                        | Notes                                                                                                                      |
| ------------------------- | ----------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| ≤ 767px (phone)           | Header, tab bar, mini player; no sidebar (`--sidebar-w: 0`) | 20px, or the safe area if larger (`--edge-*`) | Sheets and menus become bottom sheets; screen titles are visually hidden (the tab names the screen); tabs run edge to edge |
| 768–1000px (small tablet) | Sidebar 190px, player bar                                   | 28px                                          | Listen in one column; All shows in 3 columns; volume slider 84px                                                           |
| 1001–1200px               | Sidebar 232px                                               | 28px                                          | Listen in two columns (the stage, then Recently played)                                                                    |
| > 1200px (desktop)        | Sidebar 232px                                               | `clamp(28px, 3.5vw, 56px)`                    | Content max 1376px, centered                                                                                               |

Breakpoints are defined in `styles/layout.css` and `styles/responsive.css`, with a few local ones: videos at 640 and 900px, and `@media (min-width: 768px)` for concert day columns and for 900px-wide list columns on Concerts and Favorites. The listen stage is sized against the window height (`--stage-room`). On phones it subtracts 408px of measured chrome plus any banner and safe areas, and never drops below 84% of the width.

**Safe areas.** Use `var(--safe-area-inset-*, env(safe-area-inset-*))` everywhere. Capacitor 8 sets the variable on Android (edge to edge, which Android 15 and 16 require), and iOS and browsers fall back to `env()`. A band that runs edge to edge keeps its words at `--edge-left` / `--edge-right`. The launch-time insets from `fixed-insets.js` keep the artwork from resizing when Safari's toolbar collapses. Bottom padding and `scroll-padding` leave room for the tab bar, mini player and home indicator.

## 5. Accessibility conventions

- **Names.** Every icon-only key has an `aria-label` ("Close", "Settings" / "Close settings", "Clear Search…", "Volume", "Close the episode and return to the station"). External links say "(opens in a new tab)". Row buttons add a hidden context line ("Open Listen live:", ", WXPN"). Choices use `aria-pressed` inside labeled groups. The current screen uses `aria-current="page"`. On phones `h1`s are `.sr-only`, so every screen still has a heading. Status lines and toasts use `role="status"`.
- **Never color alone.** The current tab fills its glyph and gets a pill. Under `forced-colors` the current tab, the chosen choice, switches and the main keys get `Highlight` outlines or borders (`styles/states.css`). Links in running text are underlined.
- **Reduced motion.** A global rule in `styles/layout.css` turns off transitions, animations and smooth scrolling. On top of that, the busy spinner, heart bloom, heart press, pull spinner, alarm bell, view transitions, press scaling and hold scaling each have their own off switch. `motion.js` exposes `reduced()` for gestures. `prefers-reduced-transparency` removes the blur from the scrim and brief toasts.
- **Text size.** All sizes are in rem, and the root stays at 16px. On iPhone, `text-size.js` reads the system Text Size at launch and on resume, and applies it through `@capacitor/text-zoom`. Android passes its font size to the web view itself. Layout widths that depend on text use em (the schedule's hours column), badges grow with their text, tab names are capped, and `prefers-contrast: more` darkens `--muted` and `--border`.
- **Focus.** `:focus-visible` shows a 2px `--accent` outline at a 4px offset. Inside rows that clip their paint, the offset is -2px. Search fields show the ring on `:focus-within`. There is a skip link. Sheets focus their title (which shows no ring) and return focus when they close. Popover menus move focus to their first item. Hold menus return focus to what opened them.
- **Targets.** Everything you can press is at least 44px, using `::after` hit areas where the drawn control is smaller (switch, toast action, banner action).

## 6. Verifying changes

1. **`npm run check`** runs lint, Prettier, the `node:test` suites in `tests/*.test.mjs` (including `art-tint.test.mjs` for heart and wash contrast, and `gestures.test.mjs`), and a build. CI runs the same.
2. **`npm run e2e`** builds the app and runs Playwright (`tests/e2e`) on a Pixel 7 profile and a 1440 × 900 desktop: `app.spec.mjs`, `gestures.spec.mjs`, and `a11y.spec.mjs` (axe, WCAG 2.1 A/AA, in light and dark, at both sizes, covering sheets and panels).
3. **The screens page.** `node tools/capture-screens.mjs [shot ...]` retakes the shots from a build with `VITE_SHOW_SAMPLES=true`, served at `SCREENS_BASE_URL`. Times are frozen to Tuesday 2026-10-20 at 3:02pm Eastern, with World Cafe on air. Phone shots are 390 × 844 @2x, desk shots 1440 × 900, plus tablet sizes, in light and dark. It writes PNGs to `screens-out/`. The Screens workflow (`.github/workflows/screens.yml`) publishes them, and they are stored in `design/screens/img` as WebP. Compare before and after for every screen you touch, in both themes. `tools/store-shots.mjs` frames the store shots (light only), and `tools/lock-screens.mjs` / `tools/widget-screens.mjs` render the lock-screen and widget sections.
4. **Devices.** Follow `docs/device-testing.md` for the checks only a real phone can show: background audio, notifications, links, the car, and how the system treats the app.

When you change a token, check the hearts and washes against `GROUNDS` in `art-tint.js`. That list repeats the light and dark page, surface, row and raised colors, and has to be updated with them.
