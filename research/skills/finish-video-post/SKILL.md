---
name: finish-video-post
description: Finish and quality-check edited video through dialogue cleanup, audio mixing, loudness delivery, color management and grading, captions, motion and transitions, reframing, accessibility, encoding, export, and technical QC. Use when polishing a timeline, generating post-production operations, validating deliverables, or adapting an edit to platforms and aspect ratios.
---

# Finish Video Post

Finish in dependency order. Preserve a clean master and derive platform renditions from it.

## Establish delivery requirements

Record the target platform or broadcaster, raster/aspect ratio, frame rate, color space and transfer function, audio layout, loudness specification, caption format, codec/container, bitrate policy, and file-naming rules. Do not treat a social-platform recommendation as a broadcast standard.

Read [references/post-production.md](references/post-production.md) for standards, numeric targets, methods, failure modes, and source links.

## Run finishing passes

1. **Conform.** Relink originals, confirm timebase, check source ranges, remove offline media, and preserve sync.
2. **Dialogue.** Repair only what is distracting; then use clip gain, subtractive EQ, conservative compression, de-essing, and automation. Avoid denoising artifacts.
3. **Mix.** Set dialogue first, place ambience, then music and effects. Duck with automation or sidechain control where masking occurs. Measure the completed program against its declared loudness/peak specification.
4. **Color.** Normalize each camera into the working color space before creative grading. Balance exposure and white balance, match shots, protect skin and highlights, then apply the look. Tag exports correctly.
5. **Graphics and captions.** Check spelling, timing, line breaks, speaker identification, meaningful non-speech sounds, contrast, safe placement, and collisions with platform UI.
6. **Motion and reframing.** Track the subject with bounded, smooth changes. Review the whole shot and cut boundaries; do not let auto-reframe crop gestures, text, products, or newly entering subjects.
7. **Export.** Create a high-quality master, then transcode renditions. Avoid repeated lossy generations and accidental frame-rate conversion.
8. **QC.** Combine automated probes with real-time human playback.

## Emit operations and evidence

For each proposed change include target element/track, bounded parameter values, time range, rationale, and whether it is corrective or creative. Attach measurement evidence where applicable: loudness and true peak, color/tags, dropped/duplicate frames, black/freeze/silence flags, caption coverage, and output probe data.

Use staged statuses: `proposed`, `previewed`, `approved`, `rendered`, `verified`. Keep automated normalization, cleanup, and reframing previewable and reversible.

## QC gates

- Verify duration, raster, aspect ratio, frame rate, scan mode, codec, profile, chroma subsampling, bit depth, and color metadata.
- Verify channel count/order, sample rate, sync, program loudness, true peak, clipping, dropouts, and unintended silence.
- Inspect first and last frames, every transition, text entry/exit, speed change, and reframed shot.
- Validate caption presence, timing, completeness, reading order, line wrapping, speaker/sound cues, and sidecar/burn-in choice.
- Watch the entire final encoded file on representative devices; spot-checking the timeline is insufficient.

## Guardrails

- Never apply a numeric loudness, caption, safe-area, or encoding target without recording which delivery context requires it.
- Never bake an irreversible look before normalization or destroy the clean master.
- Never use captions that omit meaningful non-speech information when accessibility is required.
- Never claim provenance or authenticity merely because a file contains metadata; validate it.
- Do not hide editorial problems with noise reduction, transitions, motion graphics, or aggressive reframing.
