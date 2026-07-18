#!/bin/zsh
set -euo pipefail

ROOT_DIR=${0:A:h:h:h}
FRAME_DIR="$ROOT_DIR/artifacts/submission/video-frames"
OUTPUT_DIR="$ROOT_DIR/artifacts/submission"
NARRATION_TEXT="$ROOT_DIR/docs/submission/DEMO_VIDEO_KO.md"
NARRATION_PLAIN="$OUTPUT_DIR/LeaseFlow_Demo_Narration_KO.txt"
NARRATION_AUDIO="$OUTPUT_DIR/LeaseFlow_Demo_Narration_KO.aiff"
OUTPUT_VIDEO="$OUTPUT_DIR/LeaseFlow_Hackathon_Demo_KO.mp4"

mkdir -p "$OUTPUT_DIR"

awk '/^## 내레이션 원고/{capture=1;next}/^## 샷 리스트/{capture=0}capture && NF{print}' "$NARRATION_TEXT" > "$NARRATION_PLAIN"
say -v Yuna -r 205 -f "$NARRATION_PLAIN" -o "$NARRATION_AUDIO"
swift "$ROOT_DIR/scripts/demo-video/render.swift" "$FRAME_DIR" "$NARRATION_AUDIO" "$OUTPUT_VIDEO"
swift "$ROOT_DIR/scripts/demo-video/probe.swift" "$OUTPUT_VIDEO"

print "Created $OUTPUT_VIDEO"
