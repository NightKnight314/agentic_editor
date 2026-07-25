# Nightcut failure triage

Follow the first failing boundary. Do not jump directly to OpenAI.

1. **Boot:** inspect Next output, compilation errors, port conflicts, and stale `.next/dev/lock`. A Turbopack database error is local cache corruption; use the repository's webpack dev script and one server.
2. **Import:** verify the browser can decode metadata and the file input received the intended absolute path.
3. **Frames:** inspect video `loadedmetadata`, `seeked`, canvas availability, and source codec support.
4. **Media engine:** verify `/ffmpeg-worker.js`, the FFmpeg core CDN requests, worker exceptions, WebAssembly support, and memory pressure. A `Cannot find module 'blob:…'` error means a bundler rewrote the worker's dynamic import.
5. **Audio:** capture FFmpeg logs and exit code; verify an MP3 is produced and remains below 24 MB.
6. **API:** require evidence of `POST /api/analyze`. If no POST exists, the failure is still client-side.
7. **OpenAI:** inspect safe error text, status, request duration, configured model name, schema parse, and cost cap. Never expose the key or full media payload.
8. **Timeline:** verify sanitized source ranges, positive clip durations, total duration, and at least one primary video clip.
9. **Preview:** map composition time to source time and inspect play/pause, seek, clip boundaries, and browser media errors.
10. **Export:** separate renderer failure from encoded-file QC. Probe the produced file; a button/toast is not evidence of export.

Record the first observable failure, the last successful boundary, and one minimal reproduction.
