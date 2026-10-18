# Testing on phones

What to check on a real iPhone and Android phone before each store release.
The unit and browser tests (`npm run check`, `npm run e2e`) cover the app's
logic; these are the things only a phone can show: audio in the background,
notifications, links, the car, and how the system treats the app.

Get the builds from:

- **Android:** the **Android test build** pre-release on GitHub (Releases),
  rebuilt from every push to `main`. Open `wxpn-test.apk` on the phone.
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

- [ ] CarPlay (Xcode's CarPlay simulator, or a car): WXPN, XPN2 and
      Homegrown are listed; choosing one plays it and opens Now Playing;
      play and pause work. Start it from the car with the phone app closed.
- [ ] Android Auto (the Desktop Head Unit, or a car): the same.

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
- [ ] Haptics: choosing a station, a day or a view ticks (selection); play
      and pause tap lightly; a hold buzzes once. Nothing buzzes in a browser.
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
