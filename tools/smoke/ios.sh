#!/usr/bin/env bash
# Smoke test for the iPhone app in Xcode's simulator (native-smoke.yml runs
# it on the Mac after the simulator build). The simulator can't tap the
# screen without a UI test target, so this checks what can be seen from
# outside:
#   1. the build carries the widget (PlugIns/*.appex) and declares the
#      CarPlay scene and background audio in its Info.plist;
#   2. the app opens, its page loads, and it is still running 30 seconds on;
#   3. it survives going to the background (Settings in front) and coming
#      back, and a second, cold start;
#   4. no crash report, uncaught exception or Swift fatal error.
# A crash, or the app's process dying, fails the run.
#
#   tools/smoke/ios.sh path/to/App.app [output folder]
#
# The output folder gets the app's console output, the simulator's log for
# the app, screenshots, any crash reports and summary.txt. Written for the
# bash that comes with macOS (3.2), so no newer features.

set -uo pipefail

APP=${1:?usage: ios.sh App.app [OUT]}
OUT=${2:-smoke-out/ios}
mkdir -p "$OUT"
: >"$OUT/failures.txt"
: >"$OUT/warnings.txt"
: >"$OUT/notes.txt"

fail() {
  echo "::error::iOS: $*"
  echo "$*" >>"$OUT/failures.txt"
}
warn() {
  echo "::warning::iOS: $*"
  echo "$*" >>"$OUT/warnings.txt"
}
note() {
  echo "  $*"
  echo "$*" >>"$OUT/notes.txt"
}
step() { echo "== $*"; }

# Runs a command with a time limit (macOS has no `timeout`).
limit() {
  local secs=$1
  shift
  "$@" &
  local pid=$!
  # Kept off the output, so a pipe from this ends when the command does.
  (sleep "$secs" && kill "$pid" 2>/dev/null) </dev/null >/dev/null 2>&1 &
  local watchdog=$!
  wait "$pid"
  local status=$?
  kill "$watchdog" 2>/dev/null
  wait "$watchdog" 2>/dev/null
  return $status
}

plist() { /usr/libexec/PlistBuddy -c "Print :$2" "$1" 2>/dev/null; }

shot_n=0
shot() {
  shot_n=$((shot_n + 1))
  limit 30 xcrun simctl io "$UDID" screenshot "$(printf "%s/%02d-%s.png" "$OUT" "$shot_n" "$1")" >/dev/null 2>&1
}

alive() { [ -n "${1:-}" ] && kill -0 "$1" 2>/dev/null; }

# Opens the app; prints its process id. (`simctl launch` prints
# "org.xpn.wxpn: 12345"; on an app already running it brings it to the
# front and prints the same id.) Each launch's console output goes in its
# own console-N files.
launches=0
launch() {
  launches=$((launches + 1))
  limit 60 xcrun simctl launch --stdout="$OUT/console-$launches.txt" \
    --stderr="$OUT/console-$launches-err.txt" "$UDID" "$BUNDLE" 2>>"$OUT/simctl.txt" |
    sed -n 's/.*: *\([0-9][0-9]*\)$/\1/p' | tail -1
}

summary() {
  {
    if [ -s "$OUT/failures.txt" ]; then echo "iOS smoke test: FAILED"; else echo "iOS smoke test: passed"; fi
    sed 's/^/FAIL: /' "$OUT/failures.txt"
    sed 's/^/warning: /' "$OUT/warnings.txt"
    sed 's/^/- /' "$OUT/notes.txt"
  } >"$OUT/summary.txt"
  cat "$OUT/summary.txt"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
      echo '```'
      cat "$OUT/summary.txt"
      echo '```'
    } >>"$GITHUB_STEP_SUMMARY"
  fi
}

# --- 1. What's in the build ----------------------------------------------

step "Checking the build"
INFO="$APP/Info.plist"
if [ ! -f "$INFO" ]; then
  fail "no app at $APP"
  summary
  exit 1
fi
BUNDLE=$(plist "$INFO" CFBundleIdentifier)
EXE=$(plist "$INFO" CFBundleExecutable)
note "app $BUNDLE ($EXE), version $(plist "$INFO" CFBundleShortVersionString) ($(plist "$INFO" CFBundleVersion))"

widget_found=0
for appex in "$APP"/PlugIns/*.appex; do
  [ -d "$appex" ] || continue
  point=$(plist "$appex/Info.plist" NSExtension:NSExtensionPointIdentifier)
  id=$(plist "$appex/Info.plist" CFBundleIdentifier)
  note "extension $(basename "$appex"): $id, $point"
  if [ "$point" = "com.apple.widgetkit-extension" ]; then
    widget_found=1
    case "$id" in
      "$BUNDLE".*) ;;
      *) fail "the widget's bundle id ($id) isn't under the app's ($BUNDLE); iOS won't install it" ;;
    esac
  fi
done
[ "$widget_found" = 1 ] || fail "no widget extension in App.app/PlugIns: the home screen widget is missing"

SCENES=UIApplicationSceneManifest:UISceneConfigurations
car_class=$(plist "$INFO" "$SCENES:CPTemplateApplicationSceneSessionRoleApplication:0:UISceneClassName")
car_delegate=$(plist "$INFO" "$SCENES:CPTemplateApplicationSceneSessionRoleApplication:0:UISceneDelegateClassName")
if [ "$car_class" = "CPTemplateApplicationScene" ] && [ -n "$car_delegate" ]; then
  note "CarPlay scene declared ($car_delegate)"
  # The delegate is named "App.CarPlaySceneDelegate"; a "$(...)" left in it
  # means the build didn't fill in the module name, and CarPlay would find
  # no class.
  # shellcheck disable=SC2016 # a literal "$(", not an expansion
  case "$car_delegate" in *'$('*) fail "the CarPlay scene's delegate wasn't filled in: $car_delegate" ;; esac
else
  fail "no CarPlay scene (CPTemplateApplicationScene) in Info.plist"
fi
phone_delegate=$(plist "$INFO" "$SCENES:UIWindowSceneSessionRoleApplication:0:UISceneDelegateClassName")
[ -n "$phone_delegate" ] || fail "no phone scene in Info.plist"
if plist "$INFO" UIBackgroundModes | grep -qx '[[:space:]]*audio'; then
  note "background audio declared"
else
  fail "UIBackgroundModes has no audio: the station would stop when the phone locks"
fi

# --- A simulator ----------------------------------------------------------

step "Starting a simulator"
# The newest iOS the runner has, and an iPhone on it.
UDID=$(xcrun simctl list devices available --json | python3 -I -c '
import json, re, sys
devices = json.load(sys.stdin)["devices"]
def version(runtime):
    return [int(n) for n in re.findall(r"\d+", runtime.split("iOS")[-1])]
for runtime in sorted((r for r in devices if "iOS" in r), key=version, reverse=True):
    for d in devices[runtime]:
        if d["name"].startswith("iPhone") and d.get("isAvailable", True):
            print(d["udid"], runtime.rsplit(".", 1)[-1], d["name"], sep="\t")
            sys.exit(0)
' | head -1)
if [ -z "$UDID" ]; then
  fail "no iPhone simulator available on this runner"
  summary
  exit 1
fi
note "simulator: $(echo "$UDID" | cut -f3) on $(echo "$UDID" | cut -f2)"
UDID=$(echo "$UDID" | cut -f1)
limit 60 xcrun simctl boot "$UDID" 2>/dev/null
if ! limit 300 xcrun simctl bootstatus "$UDID" -b >/dev/null; then
  fail "the simulator didn't boot"
  summary
  exit 1
fi

# Crash reports newer than this file are this run's.
touch "$OUT/.start"
xcrun simctl spawn "$UDID" log stream --level debug --style compact \
  --predicate "process == \"$EXE\" OR process == \"ReportCrash\"" \
  >"$OUT/device.log" 2>&1 &
log_pid=$!
trap 'kill $log_pid 2>/dev/null' EXIT

step "Installing the app"
if ! limit 120 xcrun simctl install "$UDID" "$APP"; then
  fail "the app didn't install"
  summary
  exit 1
fi

# --- 2. Open and wait ----------------------------------------------------

step "Opening the app"
launch >"$OUT/.pid"
pid=$(cat "$OUT/.pid")
if [ -z "$pid" ]; then
  fail "the app didn't open (see simctl.txt)"
else
  note "app process $pid"
fi
sleep 10
shot launch
# Capacitor writes "WebView loaded" once the page has loaded.
loaded=0
for _ in $(seq 1 20); do
  if grep -q "WebView loaded" "$OUT"/console-*.txt "$OUT/device.log" 2>/dev/null; then
    loaded=1
    break
  fi
  sleep 3
done
if [ "$loaded" = 1 ]; then note "the page loaded"; else warn "didn't see \"WebView loaded\" in the console within a minute"; fi
sleep 20
shot after-30s
if alive "$pid"; then note "still running after 30 seconds"; else fail "the app wasn't running 30 seconds after opening"; fi

# --- 3. Background, back, and a cold start -------------------------------

step "To the background and back"
limit 60 xcrun simctl launch "$UDID" com.apple.Preferences >/dev/null 2>&1
sleep 15
shot background
alive "$pid" || fail "the app's process ended in the background"
launch >"$OUT/.pid"
again=$(cat "$OUT/.pid")
sleep 8
shot back
if [ -n "$pid" ] && [ -n "$again" ] && [ "$again" != "$pid" ]; then
  fail "the app started afresh on coming back (process $pid, now $again): it died while away"
fi
pid=${again:-$pid}
if alive "$pid"; then note "came back to the front"; else fail "the app wasn't running after coming back"; fi

step "Closing it and opening it again"
limit 30 xcrun simctl terminate "$UDID" "$BUNDLE" >/dev/null 2>&1
sleep 3
launch >"$OUT/.pid"
pid=$(cat "$OUT/.pid")
sleep 20
shot cold-start
if alive "$pid"; then note "a second start ran 20 seconds"; else fail "the app wasn't running 20 seconds after a second start"; fi

# --- 4. Crashes ----------------------------------------------------------

step "Looking for crashes"
sleep 2
kill "$log_pid" 2>/dev/null
mkdir -p "$OUT/crashes"
for dir in "$HOME/Library/Logs/DiagnosticReports" "$HOME/Library/Logs/DiagnosticReports/Retired"; do
  [ -d "$dir" ] || continue
  find "$dir" -maxdepth 1 -type f \( -name '*.ips' -o -name '*.crash' \) -newer "$OUT/.start" \
    -exec grep -l -e "$BUNDLE" -e "\"procName\" *: *\"$EXE\"" {} + 2>/dev/null |
    while read -r report; do cp "$report" "$OUT/crashes/"; done
done
reports=$(find "$OUT/crashes" -type f | wc -l | tr -d ' ')
[ "$reports" = 0 ] || fail "$reports crash report(s) from the app (crashes/)"
if grep -E "Terminating app due to uncaught exception|Fatal error:|EXC_BAD_ACCESS|SIGABRT|dyld\[[0-9]+\]: (Library not loaded|Symbol not found)" \
  "$OUT"/console-*.txt "$OUT/device.log" >"$OUT/crash-excerpt.txt" 2>/dev/null; then
  fail "the log shows a crash (crash-excerpt.txt)"
  head -20 "$OUT/crash-excerpt.txt"
fi
if grep -qiE "WebContent.*(crash|terminat)|webViewWebContentProcessDidTerminate" "$OUT/device.log" 2>/dev/null; then
  warn "the WebView's page process ended at some point (device.log); the app reloads it, but it shouldn't happen"
fi
js_errors=$(cat "$OUT"/console-*.txt 2>/dev/null | grep -c "\[error\]" || true)
note "page errors in the console: ${js_errors:-0}"

limit 60 xcrun simctl shutdown "$UDID" >/dev/null 2>&1
summary
[ ! -s "$OUT/failures.txt" ]
