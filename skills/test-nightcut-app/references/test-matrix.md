# Nightcut test matrix

## Free smoke

| Boundary | Required evidence | Pass condition |
|---|---|---|
| Static | command exits and output | `npm run lint` and `npm run typecheck` exit 0 |
| Boot | HTTP response and rendered DOM | root returns 200 and `.editor-shell` renders |
| Editor shell | DOM assertions | media panel, preview, agent panel, and timeline exist |
| Runtime worker | HTTP response | `/ffmpeg-worker.js` returns 200 JavaScript |
| Import | DOM plus screenshot | selected filename and source preview appear |
| Browser health | CDP events | no uncaught exception or failed same-origin request |

## Paid analysis

All free-smoke checks plus:

| Boundary | Required evidence | Pass condition |
|---|---|---|
| Preprocess | progress states | metadata, frame sampling, engine, and audio phases complete |
| Analyze API | network record | exactly one `POST /api/analyze` returns 200 |
| Cost | UI/API result | estimated total remains below configured cap |
| Draft | DOM assertions | status is done and generated video timeline clips exist |
| Preview | playhead/video state | play starts without a browser exception |

The live model may produce variable editorial output. Test schema validity, source bounds, duration, and required beat coverage separately from subjective quality.

## Export QC

| Boundary | Required evidence | Pass condition |
|---|---|---|
| Download | filesystem artifact | nonempty `.mp4` is downloaded |
| Container | `ffprobe` JSON | readable MP4 with H.264 video and AAC audio |
| Format | `ffprobe` JSON | 1080x1920, 30 fps, duration 30–60 seconds |
| Playback | browser/manual evidence | no obvious black/frozen output or missing dialogue |

Until the Export MP4 control creates a file, mark export QC `blocked: renderer not implemented`.
