# Playlist feed: problems to fix at the source

The app shows what WXPN's playlist files say
(`origin.xpn.org/utils/playlist/json/<date>.json` and
`…/nowplaying/json/xpnNowPlaying.json`). Three problems in those files show
up in the app, and xpn.org's own playlist page. They can only be fixed where
the files are made. Examples are from October 13–20, 2026.

## 1. Accented letters become spaces

Every letter outside plain ASCII is replaced by a space before the file is
written, so the original can't be recovered. Two examples ("Mon Rov a"
and "M ty" are others):

| In the file                              | Should be              |
| ---------------------------------------- | ---------------------- |
| Hermanos Guti rrez                       | Hermanos Gutiérrez     |
| Vendr n Suaves Lluvias (Silvana Estrada) | Vendrán Suaves Lluvias |

**Fix:** write the files as UTF-8 end to end (database column, export
script, and the `Content-Type: application/json; charset=utf-8` header).

## 2. Wrong artwork

The artwork is a Spotify image chosen when the song is logged, and the
match is sometimes wrong. Soccer Mommy's "Rings of Saturn" (single) carries
A Flock of Seagulls' self-titled cover
(`i.scdn.co/image/ab67616d00001e022d6da1ee1b8d8fe70e1c43fe`) on every play
that week. Ten covers that week were also used for two different
artists. Some are fine (duets, compilations), others aren't, for example
Wreckless Eric with a Stone Roses cover.

**Fix:** match artwork on artist and title together (Spotify's track
search with `artist:` and `track:`), and let staff correct a match once
for every later play.

## 3. Stray backslashes

The now-playing file escapes apostrophes twice: `"This Year\\'s Model"`.
The app now removes these; the file should write `"This Year's Model"`.

## What the app does meanwhile

- Shows the text as given, with stray backslashes removed.
- Shows the artwork as given. Checking every cover against another catalog
  (Apple's, say) would catch the wrong ones, but it would add a lookup for
  every song. That only makes sense if the source can't be fixed.
