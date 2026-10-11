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

- [ ] Play an episode from Shows › Archive; skip back 15 and ahead 30; the
      lock screen shows the episode with skip and the scrubber.
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
- [ ] Save a concert, Add to calendar: the system's New Event sheet opens,
      filled in; it saves to the calendar.

## The car

- [ ] CarPlay (Xcode's CarPlay simulator, or a car): WXPN, XPN2 and
      Homegrown are listed; choosing one plays it and opens Now Playing;
      play and pause work. Start it from the car with the phone app closed.
- [ ] Android Auto (the Desktop Head Unit, or a car): the same.

## The system

- [ ] Light and dark: switch the phone's appearance while the app is open;
      the status bar text stays readable.
- [ ] Largest text size (iPhone: Settings › Display & Brightness › Text
      Size; Android: Font size): every screen still reads and nothing is
      cut off.
- [ ] VoiceOver / TalkBack: play, a song's heart and menu, a show's page,
      and Settings can be reached and say what they do.
- [ ] iPad, and the phone turned sideways.
- [ ] Android back button: steps back through screens and closes sheets,
      then leaves the app.
- [ ] First launch (delete and reinstall): the welcome appears once.
