#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/Users/heeya/Downloads/LeaseFlow_Team_Pilot_Hackathon_MVP"
ADMIN_URL="http://127.0.0.1:3000"
MOBILE_URL="http://127.0.0.1:8082"
CLIP_DIR="$ROOT_DIR/artifacts/submission/video-clips-en"
WORK_DIR="$ROOT_DIR/artifacts/submission/video-work-en"
SAMPLE_FILE="$WORK_DIR/LeaseFlow_Synthetic_Building_Update.json"
FFMPEG_DIR="/Users/heeya/.cache/leaseflow-video-tools/node_modules/ffmpeg-static"

export PATH="$FFMPEG_DIR:$PATH"
mkdir -p "$CLIP_DIR" "$WORK_DIR"

reset_demo() {
  local workflow revision
  workflow="$(/usr/bin/curl -fsS "$ADMIN_URL/api/demo/workflow?actor_id=usr-manager")"
  revision="$(printf '%s' "$workflow" | jq -r '.state.revision')"
  /usr/bin/curl -fsS -X POST "$ADMIN_URL/api/demo/reset" \
    -H 'content-type: application/json' \
    --data "{\"actor_id\":\"usr-manager\",\"expected_revision\":$revision}" >/dev/null
}

record_start() {
  local session="$1" output="$2" url="$3" width="${4:-1600}" height="${5:-900}"
  agent-browser --session "$session" record start "$output" "$url"
  agent-browser --session "$session" set viewport "$width" "$height"
  agent-browser --session "$session" wait --load networkidle
}

record_stop() {
  local session="$1"
  agent-browser --session "$session" record stop
}

reset_demo
/usr/bin/curl -fsS "$ADMIN_URL/api/demo/sample-source" -o "$SAMPLE_FILE"

record_start leaseflow-video-workspace "$CLIP_DIR/01-workspace.webm" "$ADMIN_URL/"
agent-browser --session leaseflow-video-workspace wait 1800
agent-browser --session leaseflow-video-workspace scroll down 280
agent-browser --session leaseflow-video-workspace wait 1200
agent-browser --session leaseflow-video-workspace scroll up 280
agent-browser --session leaseflow-video-workspace wait 900
record_stop leaseflow-video-workspace

record_start leaseflow-video-intake "$CLIP_DIR/02-upload-review.webm" "$ADMIN_URL/building-updates/new"
agent-browser --session leaseflow-video-intake wait --text "Upload Source"
agent-browser --session leaseflow-video-intake wait 800
agent-browser --session leaseflow-video-intake upload 'input[type="file"]' "$SAMPLE_FILE"
agent-browser --session leaseflow-video-intake wait 900
agent-browser --session leaseflow-video-intake click 'form button'
agent-browser --session leaseflow-video-intake wait --text "Review Changes"
agent-browser --session leaseflow-video-intake wait 1800
agent-browser --session leaseflow-video-intake scroll down 240
agent-browser --session leaseflow-video-intake wait 900
UPDATE_URL="$(agent-browser --session leaseflow-video-intake get url | /usr/bin/tail -n 1)"
record_stop leaseflow-video-intake

record_start leaseflow-video-review "$CLIP_DIR/03-approve-publish.webm" "$UPDATE_URL"
agent-browser --session leaseflow-video-review wait --text "Complete Data Steward Review"
agent-browser --session leaseflow-video-review wait 700
agent-browser --session leaseflow-video-review find text "Complete Data Steward Review" click
agent-browser --session leaseflow-video-review wait 900
agent-browser --session leaseflow-video-review find text "Demo Settings" click
agent-browser --session leaseflow-video-review select "details.lf-admin-demo-disclosure select" usr-senior
agent-browser --session leaseflow-video-review wait --text "Approve and Publish Current Information"
agent-browser --session leaseflow-video-review find text "Approve and Publish Current Information" click
agent-browser --session leaseflow-video-review wait --text "Current information has been published."
agent-browser --session leaseflow-video-review wait 1800
record_stop leaseflow-video-review

record_start leaseflow-video-building "$CLIP_DIR/04-web-current.webm" "$ADMIN_URL/buildings/bld-cobalt"
agent-browser --session leaseflow-video-building wait --text "5F Leasing Information"
agent-browser --session leaseflow-video-building wait 1600
agent-browser --session leaseflow-video-building scroll down 360
agent-browser --session leaseflow-video-building wait 1500
record_stop leaseflow-video-building

record_start leaseflow-video-mobile "$CLIP_DIR/04-mobile-current.webm" "$MOBILE_URL/" 430 820
agent-browser --session leaseflow-video-mobile wait 3200
agent-browser --session leaseflow-video-mobile scroll down 420
agent-browser --session leaseflow-video-mobile wait 1500
agent-browser --session leaseflow-video-mobile scroll down 360
agent-browser --session leaseflow-video-mobile wait 1200
record_stop leaseflow-video-mobile

record_start leaseflow-video-request "$CLIP_DIR/05-request-package.webm" "$ADMIN_URL/work"
agent-browser --session leaseflow-video-request find text "Demo Settings" click
agent-browser --session leaseflow-video-request select "details.lf-admin-demo-disclosure select" usr-manager
agent-browser --session leaseflow-video-request wait --text "Import Call Request"
agent-browser --session leaseflow-video-request find text "Import Call Request" click
agent-browser --session leaseflow-video-request wait --text "Confirm Request"
agent-browser --session leaseflow-video-request find text "Confirm Request" click
agent-browser --session leaseflow-video-request wait --text "Prepare Package"
agent-browser --session leaseflow-video-request find text "Prepare Package" click
agent-browser --session leaseflow-video-request wait --text "Review and Approve"
agent-browser --session leaseflow-video-request wait 1200
agent-browser --session leaseflow-video-request find text "Review and Approve" click
agent-browser --session leaseflow-video-request wait --text "Confirm and Record Delivery"
agent-browser --session leaseflow-video-request wait 1600
record_stop leaseflow-video-request

record_start leaseflow-video-weekly "$CLIP_DIR/06-weekly-automation.webm" "$ADMIN_URL/weekly"
agent-browser --session leaseflow-video-weekly find text "Demo Settings" click
agent-browser --session leaseflow-video-weekly select "details.lf-admin-demo-disclosure select" usr-manager
agent-browser --session leaseflow-video-weekly wait --text "Configure"
agent-browser --session leaseflow-video-weekly wait 800
agent-browser --session leaseflow-video-weekly find text "Configure" click
agent-browser --session leaseflow-video-weekly wait --text "Report Automation"
agent-browser --session leaseflow-video-weekly wait 1700
agent-browser --session leaseflow-video-weekly find text "Weekly Reports" click
agent-browser --session leaseflow-video-weekly wait --text "Prepare Building Report"
agent-browser --session leaseflow-video-weekly find text "Prepare Building Report" click
agent-browser --session leaseflow-video-weekly wait 1800
record_stop leaseflow-video-weekly

agent-browser --session leaseflow-video-workspace close || true
agent-browser --session leaseflow-video-intake close || true
agent-browser --session leaseflow-video-review close || true
agent-browser --session leaseflow-video-building close || true
agent-browser --session leaseflow-video-mobile close || true
agent-browser --session leaseflow-video-request close || true
agent-browser --session leaseflow-video-weekly close || true

printf 'Captured English demo clips in %s\n' "$CLIP_DIR"
