#!/usr/bin/env bash
# Smoke test for the Android app on an emulator (native-smoke.yml runs it
# once the emulator has booted). It installs the debug build and uses the
# app the way a listener would, watching for crashes:
#   1. opens the app and waits for the page to draw (the Listen screen),
#      closing the first-run welcome if it shows;
#   2. taps play and checks Android's media session says "playing", so the
#      notification, lock screen and car controls have something to show;
#   3. goes to the home screen with the station playing, and comes back;
#   4. presses the widget's play key (the same command the widget sends);
#   5. turns the phone sideways and back;
#   6. starts the Android Auto service, and checks the widget is offered;
#   7. reads the log for a crash.
# A crash, or the app's process dying, fails the run. The stream is on the
# internet, so if it can't be reached the play checks are warnings instead.
#
#   tools/smoke/android.sh path/to/app-debug.apk [output folder]
#
# The output folder gets the full log, the crash log, screenshots, screen
# dumps and summary.txt.

set -uo pipefail

# The store identity (applicationId) and the source package its classes are
# in (namespace), which differ (docs/store-identity.md).
PKG=com.jacobsmedia.wxpn
SRC=org.xpn.wxpn
APK=${1:?usage: android.sh APP.apk [OUT]}
OUT=${2:-smoke-out/android}
HERE=$(cd "$(dirname "$0")" && pwd)
STREAM_URL=https://wxpnhi.xpn.org/xpnhi-nopreroll

mkdir -p "$OUT"
failures=()
warnings=()
notes=()

fail() {
  echo "::error::Android: $*"
  failures+=("$*")
}
warn() {
  echo "::warning::Android: $*"
  warnings+=("$*")
}
note() {
  echo "  $*"
  notes+=("$*")
}
step() { echo "== $*"; }

# adb with a time limit, so a hung emulator fails the run instead of
# stalling it until the job's limit.
a() { timeout 60 adb "$@"; }
sh_() { timeout 60 adb shell "$@" 2>/dev/null | tr -d '\r'; }

shot_n=0
shot() {
  shot_n=$((shot_n + 1))
  local file
  file=$(printf "%s/%02d-%s.png" "$OUT" "$shot_n" "$1")
  timeout 30 adb exec-out screencap -p >"$file" 2>/dev/null || rm -f "$file"
}

# The screen's elements, as uiautomator sees them, into $OUT/ui.xml. A dump
# can fail while the screen is busy ("could not get idle state"), so it
# tries a few times.
# A slow emulator's own apps (the launcher) can stop answering and put an
# "isn't responding" dialog over the app; that's waited out, not counted.
dump() {
  for _ in 1 2 3 4; do
    rm -f "$OUT/ui.xml"
    if timeout 30 adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 &&
      timeout 30 adb exec-out cat /sdcard/ui.xml >"$OUT/ui.xml" 2>/dev/null &&
      grep -q "<hierarchy" "$OUT/ui.xml"; then
      if grep -q "isn't responding" "$OUT/ui.xml"; then
        note "a system dialog said another app isn't responding; waited"
        tap '^Wait$' || sh_ am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null
        sleep 2
        continue
      fi
      return 0
    fi
    sleep 2
  done
  return 1
}

# Where on screen an element is ("x y"), from the last dump.
find_node() { python3 -I "$HERE/find-node.py" "$OUT/ui.xml" "$1"; }
on_screen() { find_node "$1" >/dev/null; }

# Dumps until something matching the pattern shows, up to $2 seconds.
wait_for() {
  local pattern=$1 limit=$2 start=$SECONDS
  while ((SECONDS - start < limit)); do
    if dump && on_screen "$pattern"; then return 0; fi
    sleep 3
  done
  return 1
}

tap() {
  local at
  at=$(find_node "$1") || return 1
  # shellcheck disable=SC2086 # "x y" is meant to split into two arguments
  a shell input tap $at
}

app_pid() { sh_ pidof "$PKG" | awk '{print $1}'; }

# The playback state(s) of the app's media sessions: 3 is playing, 2 paused,
# 6 buffering, 7 error. One line per session (the media session plugin's,
# and the Android Auto one while it runs).
session_states() {
  sh_ dumpsys media_session | awk -v pkg="package=$PKG" '
    /package=/ { mine = index($0, pkg) > 0 }
    mine && match($0, /state=PlaybackState \{state=[A-Z_]+\([0-9]+\)/) {
      s = substr($0, RSTART, RLENGTH); gsub(/[^0-9]/, "", s); print s
    }'
}
is_playing() { session_states | grep -qx 3; }

# Waits up to $1 seconds for the media session to say playing.
wait_playing() {
  local limit=$1 start=$SECONDS
  while ((SECONDS - start < limit)); do
    if is_playing; then return 0; fi
    sleep 3
  done
  return 1
}

# A crash of the app's own process: a Java/Kotlin exception, a native crash
# or the app not responding. (The WebView's page runs in a separate process;
# a crash there shows as a blank page, which the screen checks catch.)
crashes() {
  {
    # The crash buffer holds every app's crashes; only this one's count.
    grep -E "AndroidRuntime.*Process: $PKG," -B 2 -A 30 "$OUT/crash.txt" 2>/dev/null
    grep -E "AndroidRuntime.*Process: $PKG,|Fatal signal [0-9]+.*pid [0-9]+ \($PKG\)|ANR in $PKG" \
      -B 2 -A 20 "$OUT/logcat.txt" 2>/dev/null | grep -v "^--$"
  } | head -200
}

# --- Setup ---------------------------------------------------------------

step "Waiting for the emulator"
timeout 120 adb wait-for-device
for _ in $(seq 1 60); do
  [ "$(sh_ getprop sys.boot_completed)" = "1" ] && break
  sleep 2
done
sh_ input keyevent KEYCODE_WAKEUP >/dev/null
sh_ wm dismiss-keyguard >/dev/null
note "Android $(sh_ getprop ro.build.version.release) (API $(sh_ getprop ro.build.version.sdk)), WebView $(sh_ dumpsys webviewupdate | grep -m1 -oE 'Current WebView package.*' || echo '?')"

# No "isn't responding" dialogs for the emulator's own slow apps.
sh_ settings put global hide_error_dialogs 1 || true

step "Installing the app"
if ! timeout 180 adb install -r -t "$APK"; then
  fail "the app didn't install"
  printf "%s\n" "${failures[@]}" >"$OUT/summary.txt"
  exit 1
fi
# Notifications on, so the playback notification (and its foreground
# service) behave as on a phone where the listener said yes.
sh_ pm grant "$PKG" android.permission.POST_NOTIFICATIONS >/dev/null

a logcat -c
a logcat -b crash -c
adb logcat -v threadtime >"$OUT/logcat.txt" 2>&1 &
logcat_pid=$!
trap 'kill $logcat_pid 2>/dev/null' EXIT

# Whether the stream answers from here, to tell a network problem from an
# app problem when playback doesn't start.
# A live stream never ends, so the time limit always cuts it off; what
# counts is that it answered.
stream_code=$(curl -s -o /dev/null --max-time 8 -w '%{http_code}' "$STREAM_URL" || true)
if [ "$stream_code" = 200 ] || [ "$stream_code" = 206 ]; then
  stream_up=1
else
  stream_up=0
  note "the stream ($STREAM_URL) didn't answer from the runner"
fi

# --- 1. Launch -----------------------------------------------------------

step "Opening the app"
sh_ am start -W -n "$PKG/$SRC.MainActivity"
sleep 3
pid=$(app_pid)
[ -n "$pid" ] || fail "the app's process isn't running after launch"
note "app process $pid"

# Something the page draws: the play controls, the player bar, the tabs,
# or the first-run welcome over them.
READY='^(Listen live|Listen|Play WXPN|Radio player|Welcome to WXPN|Mobile navigation)\b'
if wait_for "$READY" 90; then
  note "the page drew"
else
  fail "the page didn't draw within 90 seconds (blank WebView?)"
fi
shot launch

# The welcome loads a moment after the page, so give it a few seconds.
if wait_for '^Welcome to WXPN$' 10; then
  step "Closing the first-run welcome"
  for _ in 1 2 3; do
    tap '^Close$' || sh_ input keyevent KEYCODE_BACK
    sleep 2
    dump && ! on_screen '^Welcome to WXPN$' && break
  done
  if on_screen '^Welcome to WXPN$'; then warn "the welcome wouldn't close"; fi
  shot welcome-closed
fi

# --- 2. Play -------------------------------------------------------------

step "Playing the station"
PLAY='^(Play WXPN|Listen live ?, ?WXPN|Listen live)$'
PLAYING='^(Pause ?,? ?WXPN|Pause)$'
TROUBLE='^(Retry WXPN|Try again|Offline)$|could not connect|Having trouble reaching'
played=0
if wait_for "$PLAY" 30 && tap "$PLAY"; then
  for attempt in 1 2 3; do
    if wait_playing 40; then
      played=1
      break
    fi
    dump
    if on_screen "$TROUBLE"; then
      note "attempt $attempt: the app says the stream couldn't connect"
      # Its own retry, as a listener would.
      tap '^(Retry WXPN|Try again)$' || true
    elif on_screen "$PLAYING"; then
      break # the app thinks it's playing; checked below
    elif ! on_screen '^(Cancel connecting|Stop reconnecting)'; then
      tap "$PLAY" || true
    fi
  done
  shot playing
  if ((played)); then
    note "media session: playing (state 3)"
  else
    dump
    states=$(session_states | tr '\n' ' ')
    if on_screen "$PLAYING"; then
      fail "the app shows Pause but Android's media session isn't playing (states: ${states:-none}); notification, lock screen and car controls would be wrong"
    elif ((stream_up)); then
      warn "playback didn't start within 2 minutes although the stream answers from the runner (session states: ${states:-none}); see playing.png and logcat.txt"
    else
      warn "playback didn't start; the stream couldn't be reached from the runner either, so this is likely the network"
    fi
  fi
else
  fail "couldn't find the play button (Play WXPN / Listen live)"
fi

# --- 3. Background and back ----------------------------------------------

step "To the home screen and back"
sh_ input keyevent KEYCODE_HOME
sleep 20
if [ -z "$(app_pid)" ]; then
  fail "the app's process died in the background"
elif ((played)); then
  if is_playing; then
    note "still playing in the background"
  else
    warn "playback stopped once the app was in the background (states: $(session_states | tr '\n' ' '))"
  fi
fi
shot home
sh_ am start -W -n "$PKG/$SRC.MainActivity" >/dev/null
sleep 3
# Android also ends an app when a system process it relies on dies (on a
# loaded emulator, Play services and its font provider, which the WebView
# uses): that's the emulator, not the app, so it's a warning.
system_kill() {
  grep -E "Killing $pid:$PKG/.*depends on provider .* in dying proc" "$OUT/logcat.txt" | head -1
}
if wait_for "$READY" 30 || { [ -n "$(system_kill)" ] && wait_for "$READY" 60; }; then
  note "came back to the page"
else
  fail "the page was blank on coming back"
fi
shot back
new_pid=$(app_pid)
if [ -n "$pid" ] && [ -n "$new_pid" ] && [ "$new_pid" != "$pid" ] && [ -n "$(system_kill)" ]; then
  warn "the app restarted (process $pid, now $new_pid): Android ended it when a system process it uses died ($(system_kill | sed 's/.*depends on/depends on/'))"
elif [ -n "$pid" ] && [ -n "$new_pid" ] && [ "$new_pid" != "$pid" ]; then
  fail "the app restarted (process $pid, now $new_pid): it died while away"
fi

# --- 4. The widget's play key --------------------------------------------

# A widget can't be put on the home screen without someone dragging it
# there, but its keys only open the app with a command (WxpnWidget.kt,
# MainActivity.java), and that part can be tried.
step "The widget's play key"
before=$(session_states | tr '\n' ' ')
sh_ am start -W -n "$PKG/$SRC.MainActivity" -a "$SRC.WIDGET_TOGGLE" >/dev/null
sleep 8
after=$(session_states | tr '\n' ' ')
note "widget toggle: session states '${before% }' then '${after% }'"
if ((played)) && is_playing; then
  warn "the widget's play key didn't pause the station"
fi
shot widget-toggle

# --- 5. Sideways and back ------------------------------------------------

step "Turning the phone"
sh_ settings put system accelerometer_rotation 0
sh_ settings put system user_rotation 1
sleep 4
if wait_for "$READY" 20; then note "drew sideways"; else fail "the page was blank sideways"; fi
shot landscape
sh_ settings put system user_rotation 0
sleep 4
wait_for "$READY" 20 || fail "the page was blank after turning back"
shot portrait

# --- 6. Android Auto and the widget, as Android sees them ----------------

step "Android Auto service"
pkg_dump=$(sh_ dumpsys package "$PKG")
if grep -q "android.media.browse.MediaBrowserService" <<<"$pkg_dump"; then
  note "WxpnCarService is declared as a media browser"
else
  fail "no MediaBrowserService declared: Android Auto won't list the app"
fi
# A car binds to the service; starting it directly runs the same setup
# (its media session, station list), which is where it would crash.
# It may stop again as soon as nothing is bound to it, so it counts as
# started once Android has its media session or has connected to it.
sh_ am startservice -n "$PKG/$SRC.WxpnCarService" || true
car_up=0
for _ in $(seq 1 10); do
  if sh_ dumpsys activity services "$PKG" | grep -q "ServiceRecord.*WxpnCarService" ||
    sh_ dumpsys media_session | grep -q "$PKG/WxpnCar" ||
    # The whole run's log (the phone's own buffer rolls over).
    grep -qE "Service connected for ComponentInfo\{$PKG/$SRC.WxpnCarService\}|addSession.*$PKG/WxpnCar" "$OUT/logcat.txt"; then
    car_up=1
    break
  fi
  sleep 2
done
if ((car_up)); then note "WxpnCarService started"; else fail "WxpnCarService didn't start"; fi
if sh_ dumpsys media_session | grep -q "WxpnCar"; then
  note "the car's media session exists"
else
  warn "the car's media session (WxpnCar) isn't listed"
fi
sh_ am stopservice -n "$PKG/$SRC.WxpnCarService" >/dev/null
sleep 2
[ -n "$(app_pid)" ] || fail "the app's process died after starting the Android Auto service"

step "Home screen widget"
if grep -q "android.appwidget.action.APPWIDGET_UPDATE" <<<"$pkg_dump" &&
  sh_ dumpsys appwidget | grep -qF "$SRC.WxpnWidget"; then
  note "the widget is offered to home screens"
else
  fail "the widget (WxpnWidget) isn't registered with Android's widget list"
fi

# --- 7. Crashes ----------------------------------------------------------

step "Reading the log"
sleep 2
timeout 30 adb logcat -d -b crash >"$OUT/crash.txt" 2>&1
kill "$logcat_pid" 2>/dev/null
crash=$(crashes)
if [ -n "$crash" ]; then
  fail "the log shows a crash (crash.txt, logcat.txt)"
  printf "%s\n" "$crash" >"$OUT/crash-excerpt.txt"
  printf "%s\n" "$crash" | head -40
fi
js_errors=$(grep -c " E Capacitor/Console" "$OUT/logcat.txt" 2>/dev/null || true)
note "page errors in the log (Capacitor/Console): ${js_errors:-0}"
sh_ dumpsys media_session >"$OUT/media_session.txt"
dump && cp "$OUT/ui.xml" "$OUT/ui-last.xml"

# --- Summary -------------------------------------------------------------

{
  echo "Android smoke test: $([ ${#failures[@]} -eq 0 ] && echo passed || echo FAILED)"
  for f in "${failures[@]}"; do echo "FAIL: $f"; done
  for w in "${warnings[@]}"; do echo "warning: $w"; done
  for n in "${notes[@]}"; do echo "- $n"; done
} >"$OUT/summary.txt"
cat "$OUT/summary.txt"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  { echo '```'; cat "$OUT/summary.txt"; echo '```'; } >>"$GITHUB_STEP_SUMMARY"
fi
[ ${#failures[@]} -eq 0 ]
