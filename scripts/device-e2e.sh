#!/usr/bin/env bash
# Run the human-path E2E specs on real Android phones and tablets.
#
#   1. Wireless debugging on, phone on the same Wi-Fi or tailnet.
#      adb connect <tailscale-ip>:<port>    (port from: adb mdns services)
#   2. Chrome installed and enabled on the device (it is driven over CDP).
#   3. A production build served on the PC: npm run build && PORT=4399 npm run preview
#   4. scripts/device-e2e.sh [spec ...]     (default: e2e/human.spec.ts)
#
# The device reaches the PC through `adb reverse`, so the page is served from
# http://localhost on the device: a secure context, which cross-origin
# isolation (SharedArrayBuffer, ffmpeg.wasm) needs. Over a LAN or Tailscale IP
# it would be plain http and the heavy tools would refuse to start.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT=${E2E_PORT:-4399}
SPECS=("${@:-e2e/human.spec.ts}")
curl -sf -o /dev/null "http://localhost:$PORT/" || { echo "nothing on :$PORT. Run: npm run build && PORT=$PORT npm run preview"; exit 1; }

cdp=9231
status=0
while read -r serial state rest; do
  [[ "$state" == device ]] || continue
  model=$(adb -s "$serial" shell getprop ro.product.model | tr -d '\r')
  name="${model}-$(adb -s "$serial" shell wm size | awk '/Physical/{print $3}' | tr -d '\r')"
  echo "== $name ($serial)"
  # Recreate the tunnel every run: one left over from a preview server that
  # has since restarted stays listed but carries nothing, and every page load
  # on the device then times out.
  adb -s "$serial" reverse --remove "tcp:$PORT" 2>/dev/null || true
  adb -s "$serial" reverse "tcp:$PORT" "tcp:$PORT"
  # Chrome must be running for its DevTools socket to exist.
  adb -s "$serial" shell am start --user 0 -a android.intent.action.VIEW -d "http://localhost:$PORT/" -p com.android.chrome >/dev/null
  sleep 3
  adb -s "$serial" forward "tcp:$cdp" localabstract:chrome_devtools_remote
  DEVICE_CDP="http://localhost:$cdp" DEVICE_NAME="$name" E2E_PORT=$PORT \
    npx playwright test "${SPECS[@]}" --project=device --workers=1 --reporter=line || status=1
  cdp=$((cdp + 1))
done < <(adb devices | tail -n +2)
exit $status
