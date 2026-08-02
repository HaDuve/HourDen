#!/usr/bin/env bash
# Feedback loop: Prepare Email cannot open a mail app when macOS
# registers Microsoft Edge as the mailto: handler.
set -euo pipefail

HANDLER=$(python3 - <<'PY'
import plistlib
from pathlib import Path
p = Path.home() / "Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure.plist"
data = plistlib.load(p.open("rb"))
for h in data.get("LSHandlers", []):
    if h.get("LSHandlerURLScheme") == "mailto":
        print(h.get("LSHandlerRoleAll", ""))
        break
PY
)

echo "mailto handler: ${HANDLER:-<none>}"

case "$HANDLER" in
  com.apple.mail|com.microsoft.Outlook|com.microsoft.outlook*)
    echo "PASS: mailto points at a mail client"
    exit 0
    ;;
  com.microsoft.edgemac|com.google.Chrome|com.brave.Browser|company.thebrowser.Browser|org.mozilla.firefox*)
    echo "FAIL: mailto points at a browser ($HANDLER) — OS will not open a mail app for Prepare Email"
    exit 1
    ;;
  *)
    if [[ -z "$HANDLER" ]]; then
      echo "FAIL: no mailto handler registered"
      exit 1
    fi
    echo "WARN: unknown handler $HANDLER — treating as fail until confirmed mail client"
    exit 1
    ;;
esac
