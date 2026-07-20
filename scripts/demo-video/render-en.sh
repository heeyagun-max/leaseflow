#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/Users/heeya/Downloads/LeaseFlow_Team_Pilot_Hackathon_MVP"
CLIP_DIR="$ROOT_DIR/artifacts/submission/video-clips-en"
WORK_DIR="$ROOT_DIR/artifacts/submission/video-render-en"
NARRATION_DIR="$ROOT_DIR/scripts/demo-video/narration-en"
OUTPUT="$ROOT_DIR/artifacts/submission/LeaseFlow_OpenAI_Build_Week_Demo_EN.mp4"
FFMPEG_DIR="/Users/heeya/.cache/leaseflow-video-tools/node_modules/ffmpeg-static"
FONT="/System/Library/Fonts/Supplemental/Arial Bold.ttf"
SCENE_DURATION=25

export PATH="$FFMPEG_DIR:$PATH"
mkdir -p "$WORK_DIR"

titles=(
  "A real workflow bottleneck"
  "Source files become structured updates"
  "Human review controls publication"
  "One current record, on web and mobile"
  "Requests become approved packages"
  "Weekly reporting starts with the landlord"
  "Codex for Everyone"
)

for index in 1 2 3 4 5 6 7; do
  padded="$(printf '%02d' "$index")"
  /usr/bin/say -v Samantha -r 168 -f "$NARRATION_DIR/$padded.txt" -o "$WORK_DIR/$padded.aiff"
  printf '%s' "${titles[$((index - 1))]}" > "$WORK_DIR/$padded-title.txt"
done
printf '%s' "AI adapts to the worker — not the other way around." > "$WORK_DIR/07-tagline.txt"

render_standard_scene() {
  local input="$1" index="$2" darken="${3:-0}"
  local padded filter
  padded="$(printf '%02d' "$index")"
  filter="scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xF4F6F8,setpts=4*PTS,tpad=stop_mode=clone:stop_duration=30,trim=duration=$SCENE_DURATION,fps=30"
  if [[ "$darken" == "1" ]]; then
    filter="$filter,drawbox=x=0:y=0:w=iw:h=ih:color=0x071521@0.82:t=fill,drawtext=fontfile='$FONT':textfile='$WORK_DIR/$padded-title.txt':fontsize=78:fontcolor=white:x=(w-text_w)/2:y=400,drawtext=fontfile='$FONT':textfile='$WORK_DIR/07-tagline.txt':fontsize=34:fontcolor=0xD7E5EE:x=(w-text_w)/2:y=520"
  else
    filter="$filter,drawtext=fontfile='$FONT':textfile='$WORK_DIR/$padded-title.txt':fontsize=48:fontcolor=white:x=72:y=70:box=1:boxcolor=0x071521@0.88:boxborderw=24:enable='between(t,0,5.5)'"
  fi
  ffmpeg -y -hide_banner -loglevel error -i "$input" -vf "$filter" \
    -an -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p "$WORK_DIR/$padded-video.mp4"
}

render_standard_scene "$CLIP_DIR/01-workspace.webm" 1
render_standard_scene "$CLIP_DIR/02-upload-review.webm" 2
render_standard_scene "$CLIP_DIR/03-approve-publish.webm" 3

ffmpeg -y -hide_banner -loglevel error \
  -i "$CLIP_DIR/04-web-current.webm" -i "$CLIP_DIR/04-mobile-current.webm" \
  -filter_complex "color=c=0xE8EDF1:s=1920x1080:r=30:d=$SCENE_DURATION[bg];[0:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=white,setpts=4*PTS,tpad=stop_mode=clone:stop_duration=30,trim=duration=$SCENE_DURATION,fps=30[web];[1:v]scale=-2:720,setpts=3*PTS,tpad=stop_mode=clone:stop_duration=30,trim=duration=$SCENE_DURATION,fps=30[mobile];[bg][web]overlay=70:220[tmp];[tmp][mobile]overlay=1430:220,drawtext=fontfile='$FONT':textfile='$WORK_DIR/04-title.txt':fontsize=48:fontcolor=white:x=72:y=70:box=1:boxcolor=0x071521@0.88:boxborderw=24:enable='between(t,0,5.5)'[v]" \
  -map "[v]" -an -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p "$WORK_DIR/04-video.mp4"

render_standard_scene "$CLIP_DIR/05-request-package.webm" 5
render_standard_scene "$CLIP_DIR/06-weekly-automation.webm" 6
render_standard_scene "$CLIP_DIR/01-workspace.webm" 7 1

for index in 1 2 3 4 5 6 7; do
  padded="$(printf '%02d' "$index")"
  ffmpeg -y -hide_banner -loglevel error \
    -i "$WORK_DIR/$padded-video.mp4" -i "$WORK_DIR/$padded.aiff" \
    -filter_complex "[1:a]adelay=900|900,apad=pad_dur=$SCENE_DURATION,volume=1.08[a]" \
    -map 0:v -map "[a]" -t "$SCENE_DURATION" -c:v copy -c:a aac -b:a 160k \
    "$WORK_DIR/$padded-scene.mp4"
done

: > "$WORK_DIR/concat.txt"
for index in 1 2 3 4 5 6 7; do
  padded="$(printf '%02d' "$index")"
  printf "file '%s/%s-scene.mp4'\n" "$WORK_DIR" "$padded" >> "$WORK_DIR/concat.txt"
done

ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i "$WORK_DIR/concat.txt" -c copy -movflags +faststart "$OUTPUT"
printf 'Rendered %s\n' "$OUTPUT"
