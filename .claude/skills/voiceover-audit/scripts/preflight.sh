#!/bin/bash
# Preflight for the VoiceOver audit. Checks every prerequisite and prints exact
# remediation for whatever is missing. Deliberately never enables anything:
# VoiceOver, Accessibility and Automation are system settings, and turning them
# on is the operator's call, not the tool's.
#
# Exit 0 = ready to capture. Exit 1 = something needs a human.

ok=0
say()  { printf '  %s %s\n' "$1" "$2"; }
fail() { ok=1; }

echo "VoiceOver audit — preflight"
echo

# 1. VoiceOver running -------------------------------------------------------
if pgrep -x VoiceOver >/dev/null; then
  say "✓" "VoiceOver is running"
else
  say "✗" "VoiceOver is not running"
  say " " "  → press ⌘F5, or run: /System/Library/CoreServices/VoiceOver.app/Contents/MacOS/VoiceOver"
  say " " "  (it will speak aloud and capture your keyboard while it runs)"
  fail
fi

# 2. AppleScript control -----------------------------------------------------
# Only meaningful once VoiceOver is up; querying it while it is down would
# launch the screen reader as a side effect, which this script must not do.
if pgrep -x VoiceOver >/dev/null; then
  probe=$(osascript -e 'tell application "VoiceOver" to return content of last phrase' 2>&1)
  status=$?
  if [ $status -eq 0 ]; then
    say "✓" "AppleScript control works (last phrase readable)"
  else
    case "$probe" in
      *-1743*|*"Not authorized"*|*"not allowed"*)
        say "✗" "Automation permission denied"
        say " " "  → approve the 'wants to control VoiceOver' prompt when it appears,"
        say " " "     or re-enable it in System Settings → Privacy & Security → Automation"
        say " " "     (entries only exist there AFTER a first request — nothing to pre-add)" ;;
      *"AppleScript"*|*-1728*)
        say "✗" "VoiceOver is not accepting AppleScript"
        say " " "  → VoiceOver Utility → General →"
        say " " "     check 'Allow VoiceOver to be controlled with AppleScript'"
        say " " "     open it: open -a 'VoiceOver Utility'" ;;
      *)
        say "✗" "AppleScript probe failed: $probe" ;;
    esac
    fail
  fi
else
  say "–" "AppleScript control: not probed (would launch VoiceOver)"
fi

# 3. Safari ------------------------------------------------------------------
if pgrep -x Safari >/dev/null; then
  say "✓" "Safari is running"
else
  say "✗" "Safari is not running — the rule specifies VoiceOver + Safari (WebKit)"
  say " " "  → open Safari on the demo you want to audit"
  fail
fi

# 4. The demo under test -----------------------------------------------------
for probe in "http://localhost:8787/|agent demo" "http://localhost:8321/lifecycle-demo/|lifecycle demo"; do
  url=${probe%%|*}; name=${probe##*|}
  if curl -s -o /dev/null --max-time 2 "$url"; then
    say "✓" "$name reachable ($url)"
  else
    say "–" "$name not running ($url)"
  fi
done

echo
if [ $ok -eq 0 ]; then
  echo "Ready. Next: scripts/vo-capture.mjs"
else
  echo "Not ready — resolve the ✗ items above. Nothing was changed."
fi
exit $ok
