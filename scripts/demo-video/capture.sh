#!/bin/zsh
set -euo pipefail

ROOT_DIR=${0:A:h:h:h}
ADMIN_URL=${LEASEFLOW_ADMIN_URL:-http://127.0.0.1:3000}
MOBILE_URL=${LEASEFLOW_MOBILE_URL:-http://127.0.0.1:8081}
FRAME_DIR="$ROOT_DIR/artifacts/submission/video-frames"
CHROME_BIN=${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
WORK_DIR=$(mktemp -d "${TMPDIR:-/tmp}/leaseflow-demo-video.XXXXXX")
chmod 700 "$WORK_DIR"
RESPONSE_FILE="$WORK_DIR/response.json"
CAPTURE_INDEX=0

cleanup() {
  rm -rf -- "$WORK_DIR"
}
trap cleanup EXIT HUP INT TERM

mkdir -p "$FRAME_DIR"

if [[ ! -x "$CHROME_BIN" ]]; then
  print -u2 "Chrome not found: $CHROME_BIN"
  exit 1
fi

for url in "$ADMIN_URL/api/demo/workflow" "$MOBILE_URL"; do
  curl -fsS "$url" >/dev/null
done

revision() {
  curl -fsS "$ADMIN_URL/api/demo/workflow" \
    | node -p 'JSON.parse(require("fs").readFileSync(0,"utf8")).state.revision'
}

post_json() {
  local endpoint=$1
  local json=$2
  curl -fsS -X POST "$ADMIN_URL$endpoint" \
    -H 'content-type: application/json' \
    --data "$json" > "$RESPONSE_FILE"
}

capture() {
  local output=$1
  local url=$2
  local width=$3
  local height=$4
  local budget=$5
  local capture_work
  local profile
  local temporary_output
  (( CAPTURE_INDEX += 1 ))
  capture_work="$WORK_DIR/capture-$CAPTURE_INDEX"
  profile="$capture_work/profile"
  temporary_output="$capture_work/frame.png"
  mkdir -p "$profile"

  if command -v agent-browser >/dev/null 2>&1; then
    local session="leaseflow-video-${RANDOM}-${RANDOM}"
    agent-browser --session "$session" open "$url" >/dev/null
    agent-browser --session "$session" set viewport "$width" "$height" >/dev/null
    agent-browser --session "$session" wait "$budget" >/dev/null
    agent-browser --session "$session" screenshot "$temporary_output" >/dev/null
    agent-browser --session "$session" close >/dev/null
    mv -f "$temporary_output" "$FRAME_DIR/$output"
    return
  fi

  "$CHROME_BIN" \
    --headless=new \
    --disable-gpu \
    --disable-extensions \
    --disable-background-networking \
    --disable-component-update \
    --hide-scrollbars \
    --no-first-run \
    --no-default-browser-check \
    --user-data-dir="$profile" \
    --window-size="$width,$height" \
    --virtual-time-budget="$budget" \
    --screenshot="$temporary_output" \
    "$url" >"$capture_work/chrome.log" 2>&1 &
  local chrome_pid=$!

  for _ in {1..60}; do
    [[ -s "$temporary_output" ]] && break
    sleep 1
  done
  kill "$chrome_pid" 2>/dev/null || true
  [[ -s "$temporary_output" ]]
  mv -f "$temporary_output" "$FRAME_DIR/$output"
}

current_revision=$(revision)
post_json /api/demo/reset "{\"actor_id\":\"usr-manager\",\"expected_revision\":$current_revision}"
capture 01-admin-source-registry.png "$ADMIN_URL/#source-assets" 1440 2600 3500

current_revision=$(revision)
post_json /api/demo/extract "{\"actor_id\":\"usr-junior\",\"expected_revision\":$current_revision}"
capture 02-admin-data-steward-review.png "$ADMIN_URL/" 1440 1400 3500

current_revision=$(revision)
post_json /api/demo/confirm "{\"actor_id\":\"usr-junior\",\"expected_revision\":$current_revision}"
current_revision=$(revision)
post_json /api/demo/publish "{\"actor_id\":\"usr-senior\",\"expected_revision\":$current_revision}"

current_revision=$(revision)
post_json /api/demo/assets "{\"action\":\"confirm\",\"actor_id\":\"usr-junior\",\"expected_revision\":$current_revision,\"asset_id\":\"asset-cobalt-plan-v2\",\"building_id\":\"bld-cobalt\",\"externally_shareable\":true}"
current_revision=$(revision)
post_json /api/demo/assets "{\"action\":\"publish\",\"actor_id\":\"usr-senior\",\"expected_revision\":$current_revision,\"asset_id\":\"asset-cobalt-plan-v2\"}"
capture 03-admin-published-v2.png "$ADMIN_URL/#source-assets" 1440 2600 3500

current_revision=$(revision)
post_json /api/mobile/workflow "{\"action\":\"import\",\"source\":\"call\",\"actor_id\":\"usr-manager\",\"expected_revision\":$current_revision}"
request_id=$(RESPONSE_FILE="$RESPONSE_FILE" node -p 'JSON.parse(require("fs").readFileSync(process.env.RESPONSE_FILE,"utf8")).requests[0].id')
current_revision=$(revision)
post_json /api/mobile/workflow "{\"action\":\"confirm\",\"request_id\":\"$request_id\",\"actor_id\":\"usr-manager\",\"expected_revision\":$current_revision}"
current_revision=$(revision)
post_json /api/mobile/workflow "{\"action\":\"draft\",\"request_id\":\"$request_id\",\"actor_id\":\"usr-manager\",\"expected_revision\":$current_revision}"
package_id=$(RESPONSE_FILE="$RESPONSE_FILE" node -p 'JSON.parse(require("fs").readFileSync(process.env.RESPONSE_FILE,"utf8")).packages[0].id')
capture 04-mobile-package-draft.png "$ADMIN_URL/mobile-preview" 1280 1000 4000

current_revision=$(revision)
post_json /api/mobile/workflow "{\"action\":\"approve\",\"package_id\":\"$package_id\",\"actor_id\":\"usr-manager\",\"expected_revision\":$current_revision}"
capture 05-mobile-human-approved.png "$ADMIN_URL/mobile-preview" 1280 1000 4000

current_revision=$(revision)
post_json /api/mobile/reports "{\"action\":\"draft\",\"actor_id\":\"usr-manager\",\"expected_revision\":$current_revision}"
report_id=$(RESPONSE_FILE="$RESPONSE_FILE" node -p 'JSON.parse(require("fs").readFileSync(process.env.RESPONSE_FILE,"utf8")).reports[0].id')
current_revision=$(revision)
post_json /api/mobile/reports "{\"action\":\"investigate\",\"report_id\":\"$report_id\",\"command\":\"협의 중인 면적 변동 있는지 확인해\",\"actor_id\":\"usr-manager\",\"expected_revision\":$current_revision}"
capture 06-weekly-source-backed-patch.png "$ADMIN_URL/reports" 1440 1800 4000

current_revision=$(revision)
post_json /api/mobile/reports "{\"action\":\"decide_patch\",\"report_id\":\"$report_id\",\"decision\":\"accept\",\"actor_id\":\"usr-manager\",\"expected_revision\":$current_revision}"
current_revision=$(revision)
post_json /api/mobile/reports "{\"action\":\"approve\",\"report_id\":\"$report_id\",\"actor_id\":\"usr-manager\",\"expected_revision\":$current_revision}"
capture 07-weekly-approved.png "$ADMIN_URL/reports" 1440 1800 4000

print "Captured synthetic demo frames in $FRAME_DIR"
