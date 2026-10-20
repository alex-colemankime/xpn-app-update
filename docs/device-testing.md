# Testing on phones

What to check on a real iPhone and Android phone before each store release.
The unit and browser tests (`npm run check`, `npm run e2e`) cover the app's
logic; these are the things only a phone can show: audio in the background,
notifications, links, the car, and how the system treats the app.

Get the builds from:

- **Android:** the **Android test build** pre-release on GitHub (Releases),
  rebuilt from every push to `main`. Open `wxpn-test.apk` on the phone; each
  new one installs over the last (they share a test signing key). A test
  build installed before that key was added has to be uninstalled once.
- **iPhone:** TestFlight, once the Release workflow can sign (see README ›
  Native apps). Until then, Xcode on a Mac: open `ios/App/App.xcodeproj`,
  choose the team under Signing & Capabilities, and run on a connected phone.

Note the phone, OS version and build for each pass. Anything that fails:
what you did, what happened, and a screen recording if you can.

## Listening

- [ ] WXPN plays within a few seconds of Listen live; XPN2 and Homegrown too.
- [ ] Lock the phone: audio carries on, and the lock screen shows the song,
      its artwork and play/pause, which work.
- [ ] Switch to another app for a few minutes, come back: still playing,
      song info current.
- [ ] Headphones: unplug (or disconnect Bluetooth) pauses; the headset
      button plays and pauses.
- [ ] A phone call, or another app's audio, pauses the station; it doesn't
      fight back.
- [ ] Airplane mode while playing: "Reconnecting", then it plays again
      within seconds of turning airplane mode off.
- [ ] iPhone: the ring/silent switch on silent still plays the station.
- [ ] AirPlay (iPhone) to a speaker or TV, from the mini player and Listen.
- [ ] Sleep timer, 15 minutes: fades out and stops.

## Archive

- [ ] Tap an episode in Shows › Archive: it plays, its row turns orange;
      tap it again: it pauses. Skip back 15 and ahead 30; the lock screen
      shows the episode with skip and the scrubber.
- [ ] Pause, close the app fully, reopen: the episode resumes where it was.
- [ ] Save an episode, wait an hour, play it from Favorites: it plays (the
      link is read again).

## Notifications

- [ ] Turn on show reminders for a show starting within the hour: the
      permission prompt appears once; the reminder arrives with the app
      closed, and tapping it opens Listen playing WXPN.
- [ ] Radio alarm for two minutes from now, app closed and phone locked:
      it arrives on time; tapping starts the wake-up station at the alarm
      volume. Android 14+: the prompt to allow Alarms & reminders appears
      when the alarm is turned on.
- [ ] The alarm keeps ringing with the app left closed: set it for a time
      a few minutes ahead on today's weekday, let it ring, then (without
      opening the app) move the phone's clock a week on, or leave it two
      weeks; it rings each week. On Android, with the phone left idle and
      unplugged overnight, the next week's alarm is still on time.
- [ ] An alarm set for under a minute from now still rings.
- [ ] Turn notifications off for WXPN in the phone's Settings, reopen the
      app: reminders and the alarm switch themselves off and say why.
- [ ] Android: the notification icon is the station icon, not a square.

## Links and sign-ins

- [ ] Tap an xpn.org show link (in Messages or Notes): it opens that show's
      page in the app (needs the files in `native/well-known` hosted on
      xpn.org).
- [ ] Share a show from its page; tap the shared link on another phone
      with the app.
- [ ] Settings › Your playlist › Apple Music (and Spotify, if set up): the
      sign-in completes and returns to the app; heart a song, and it shows
      in "WXPN Favorites" there.
- [ ] Donate opens xpn.org in the in-app browser; closing it returns to the
      app.

## Videos and concerts

- [ ] A World Cafe video plays in the app, full screen and back; the radio
      pauses and is offered back afterwards.
- [ ] iPhone: a live YouTube video (Free at Noon) opens in the in-app
      browser.
- [ ] Open a concert, Add to calendar: the system's New Event sheet opens,
      filled in; it saves to the calendar.
- [ ] Open a song's sheet, Open in Spotify and Open in Apple Music: with
      the app installed, it opens on the search for the song (not the web
      page); without it, the browser does.

## The car

CarPlay needs Apple's CarPlay audio entitlement in the build
(`docs/carplay-entitlement-request.md`); until then the CarPlay scene never
appears. Android Auto needs no approval to test with the Desktop Head Unit.

- [ ] CarPlay (Xcode's CarPlay simulator, then a car): WXPN, XPN2 and
      Homegrown are listed, each with its orange tile; choosing one plays it
      and opens Now Playing, with the song, artist and artwork, and play and
      pause only (no skip, no scrubber: it's live).
- [ ] CarPlay: back to the list, the playing station is marked; choose
      another and it switches; choose the same one while Now Playing shows
      and nothing breaks.
- [ ] CarPlay, cold: force-quit the phone app, connect, choose a station.
      It must play with the phone locked. (The web view runs without a
      window then; if it doesn't play, this is the first thing to fix.)
- [ ] CarPlay: connect while a station is already playing on the phone; the
      list marks it straight away.
- [ ] CarPlay: a phone call, then Siri, then a navigation prompt during
      play; the station ducks or pauses and comes back.
- [ ] CarPlay: no signal (airplane mode mid-play); the app recovers when
      signal returns, and the car doesn't show a stuck spinner.
- [ ] Android Auto (the Desktop Head Unit, then a car): the same list with
      tiles; Now Playing shows the song's artwork (the station's tile until
      it loads); play and pause from the car and the steering wheel; start
      from the car with the phone app closed.

## Home screen widget

- [ ] Add it (iPhone: long press the home screen › + › WXPN, small, medium
      and large; Android: long press › Widgets › WXPN). Before the app has
      played anything it shows WXPN and the station's tile.
- [ ] Play a station in the app: the widget shows the streams with the one
      playing underlined, the song, artist and artwork (artwork a moment
      after the words), and WXPN's show on the air.
- [ ] Tap XPN2 in the widget: the app opens playing XPN2, and the widget
      follows. Tap pause: the app opens and pauses. Both again with the app
      force-quit.
- [ ] Dark mode, and the phone's largest text size: nothing is cut off
      badly; Homegrown fits on the medium iPhone widget.
- [ ] An archived episode playing: no stream is underlined; the episode and
      its show are shown.

## Crash reports

Once Firebase is set up (README › Usage and crash reporting):

- [ ] A test crash in a release build reaches Crashlytics within minutes,
      with the version, station and screen keys and the last steps in its
      log; on iOS, with function names (symbols uploaded).
- [ ] Settings › Privacy › off, then a test crash: nothing arrives.

## Gestures

- [ ] Press and hold a song, a show (schedule, All shows, Archive), an
      episode, a concert and a video: the row sinks a little as the hold
      builds, a menu rises with a light buzz, no callout or text selection
      appears, and lifting the finger doesn't also open the row. Scrolling
      over rows never opens one.
- [ ] Pull a show's sheet, the video page and a menu down from the top:
      it follows the finger one to one and the backdrop lightens with it; a
      tick marks the point where letting go closes it. A quick flick closes
      it from anywhere; a nudge, or letting go while moving back up, springs
      it back without a bounce. Catch it mid-flight and it stops under the
      finger. Pulled up, it resists. Scrolling a long sheet still scrolls.
- [ ] Haptics: choosing a station, a day or a view ticks (selection); play,
      pause and a heart tap lightly; a hold buzzes once; skipping in an
      episode doesn't. In a browser, ticks never buzz (Chrome on Android
      gives a very short vibration for the taps).
- [ ] Sideways drags do nothing but scroll: the schedule keeps its day and
      view, the mini player opens only on a tap.
- [ ] Pull down at the top of Listen, Concerts, Videos and Shows › Archive:
      the pull resists more as it goes, ticks once when far enough, and a
      spinner turns while the list loads. Scrolling stays smooth, and in a
      browser the page itself doesn't reload. (On iOS the native overscroll
      bounce still shows under the pull; that gap is known.)

## The system

- [ ] Light and dark: switch the phone's appearance while the app is open;
      the status bar text stays readable.
- [ ] Largest text size (iPhone: Settings › Display & Brightness › Text
      Size; Android: Font size): every screen still reads and nothing is
      cut off.
- [ ] VoiceOver / TalkBack: play, a song's heart and menu, a show's page,
      and Settings can be reached and say what they do.
- [ ] iPad, and the phone turned sideways.
- [ ] Android back button: closes an open menu (a song's, the sleep timer)
      or sheet first, then steps back through screens, and at the start puts
      the app in the background with the station still playing.
- [ ] First launch (delete and reinstall): the welcome appears once.
