# Post-production methodologies for an AI video editing platform

Research date and source access date: **2026-07-25**

This note translates post-production practice into rules an editing planner, timeline engine, renderer, and QC service can execute. It distinguishes a **standard or normative requirement** from an **industry recommended practice**, a **platform recommendation**, and a **product technique**. Numeric targets are valid only inside the delivery profile that names their source.

## 1. Operating model: finish to a delivery profile

There is no universal “web video” master. Loudness, color, caption syntax, raster, codec, metadata, and safe regions depend on the destination. The planner should require or infer a versioned delivery profile before destructive finishing. If the destination is unknown, produce a high-quality tagged mezzanine and explicit derivatives rather than baking arbitrary platform assumptions into the master.

Recommended pipeline:

1. **Probe and preserve:** hash originals; read wrapper, stream, time base, frame-rate mode, color tags, channel layout, rotation/clean-aperture metadata, timecode, and subtitle streams. Never modify camera originals.
2. **Analyze:** generate shot boundaries, word- and speaker-timed transcript, sound classes, faces/subjects, motion vectors, OCR regions, clipping/noise/loudness measurements, color statistics, and confidence values.
3. **Plan non-destructively:** express trims, transforms, mix automation, grade operations, caption cues, and delivery transforms as an inspectable graph. Keep source time and sequence time mappings.
4. **Preview at the target:** use the actual output aspect ratio, output color transform, caption safe overlay, downmix, and approximate delivery encode. Proxy preview is not final validation.
5. **Render a mezzanine:** render from full-resolution originals, with the intended output color transform and enough precision for the target.
6. **Encode derivatives:** make platform-specific distribution files and sidecar captions from the mezzanine or a common high-quality render.
7. **Validate the encoded artifact:** re-probe and decode the actual output; compare metadata to decoded essence; run automated tests and a human review pass appropriate to risk.

Every automated operation should retain `source`, `parameters`, `model/tool version`, `confidence`, `affected time ranges`, `reversibility`, and `reason`. Low-confidence semantic changes—speaker attribution, profanity, dialogue reconstruction, face reframing, creative grade, music edits—should become review tasks, not silent commits.

### Minimum machine-readable delivery profile

```yaml
profile_id: youtube_sdr_1080p_v2026-07-25
authority: platform_recommendation   # standard | regulation | recommended_practice | platform | house
video:
  raster: [1920, 1080]
  pixel_aspect: "1:1"
  frame_rate: source_native
  scan: progressive
  color:
    primaries: bt709
    transfer: bt709
    matrix: bt709
    range: limited_or_explicit
audio:
  sample_rate_hz: 48000
  codec: aac_lc
  channels: stereo
  loudness_method: itu_r_bs_1770_5
  loudness_target: null              # never invent one if destination does not publish one
captions:
  canonical: webvtt
  deliver: [webvtt, srt]
layout:
  aspect_ratio: "16:9"
  safe_regions: profile_specific
container: mp4
qc_template: youtube_sdr_2026_07
```

## 2. Dialogue cleanup, mixing, loudness, and music ducking

### 2.1 Preserve intelligibility and continuity before chasing loudness

Use this order because later processors react to what earlier processors leave behind:

1. **Editorial repair:** choose the best microphone/alternate take, align double-system sound, correct polarity, add short equal-power fades at edits, and fill gaps with matching room tone.
2. **Clip gain:** correct large level differences before compression. Measure by utterance/speaker, but listen across edits.
3. **Correct specific faults:** remove DC/rumble, electrical hum, isolated clicks, and obvious broadband noise. Adobe identifies rumble below roughly 80 Hz and common mains hum around 50 or 60 Hz; these are diagnoses, not instructions to high-pass every voice at a fixed frequency.
4. **Control voice defects:** de-ess, reduce excessive reverberation, and use narrow corrective EQ only when evidence supports it.
5. **Shape dynamics:** gentle compression or speech leveling, then automation; preserve consonants and natural pauses.
6. **Mix context:** balance dialogue, music, effects, ambience, and audio description. Check mono compatibility and the required stereo/surround downmix.
7. **Programme loudness and true peak:** measure the whole finished programme with the delivery profile’s method; normalize/limit only after the creative mix.
8. **Measure again after lossy encoding:** codec reconstruction can create peaks not visible in the PCM sample peaks.

Actionable rules:

- Keep an unprocessed dialogue stem and store processing as a reversible chain.
- Estimate stationary noise from speech-free regions. Never learn a “noise print” from consonants or breaths.
- Apply the minimum repair that clears the problem. Denoise and dereverb often trade noise for watery/metallic speech; expose strength and an A/B preview.
- Detect hard clipping before restoration. A de-clip result is an estimate and should be flagged as reconstructed audio.
- Do not gate room tone to digital silence between words. Use downward expansion or explicit ambience beds; hard gates expose edits and sound unnatural.
- Use short fades on every audio cut unless a deliberate transient must remain. Inspect zero crossings but do not move a sync-critical edit merely to reach one.
- Preserve overlaps, breaths, laughter, and meaningful non-speech events in the semantic timeline. ASR silence is not necessarily editorial silence.
- Do not normalize each clip independently to the programme target; that destroys intended dynamics and makes background noise surge.

Useful implementation primitives include FFmpeg `adeclick`, `adeclip`, `afftdn`/`anlmdn`, `highpass`, `deesser`, `acompressor`, `alimiter`, `sidechaincompress`, `ebur128`, and `loudnorm`. Their defaults are implementation defaults, not delivery requirements. For file outputs, FFmpeg supports two-pass `loudnorm`; use the first pass measurements for deterministic normalization and preserve the JSON measurement report.

### 2.2 Loudness targets are profile-specific

ITU-R BS.1770-5 defines the measurement algorithms for programme loudness and true peak; **it does not prescribe a universal target**. LUFS and LKFS are equivalent units in this context. Record the measurement version and whether the metric is full-programme, dialogue-gated, or another anchor.

| Context | Authority and applicable target | Machine rule |
|---|---|---|
| European broadcast production | EBU R 128 recommended practice: normalize programme loudness to **-23.0 LUFS**; **±1.0 LU** is permitted where exact targeting is impractical, such as live work; **±0.2 LU** is allowed in QC for measurement error. Linear production audio should not exceed **-1 dBTP**. | Whole-programme BS.1770/EBU Mode measurement; do not apply the target to individual clips. Flag a deliberately quieter programme as intentional metadata rather than “fixing” it. |
| EBU streaming | EBU R 128 s2 recommends producing/preparing to R 128 and streaming unchanged at **-23 LUFS** with correct loudness metadata. Without metadata/device adaptation, a broadcaster-controlled distribution level in the **-20 to -16 LUFS** range may be used. | Prefer unchanged master plus correct metadata. A higher distribution level is a separately named derivative with documented dynamic treatment. |
| North American TV exchange | ATSC A/85:2026-07 recommended practice: absent prior agreement/metadata, **-24 LKFS**; maximum **-2 dBTP**. The quick reference anticipates about **±2 dB** measurement variation but says not to aim at either edge. Long-form content uses integrated dialogue loudness; short-form uses full-programme loudness. | Select the correct anchor by content type. Do not compare an ATSC dialogue-gated number directly with an EBU full-programme number as if they were identical measurements. |
| ATSC streaming service | A/85:2026-07 recommends one service target in **-23 to -27 LKFS**, unless parties agree otherwise. | This is a service-level consistency range, not permission to choose a different target per asset. |
| Apple Podcasts | Apple platform recommendation: about **-16 dB LKFS ±1 dB**, true peak no higher than **-1 dBFS**, measured per BS.1770-5 before encoding. | Apply only to the Apple podcast derivative/profile, not a video master. |
| Spotify music playback | Spotify platform behavior/recommendation: normal playback adjusts tracks to **-14 LUFS**; mastering guidance says below **-1 dBTP**, or below **-2 dBTP** when mastered louder than -14 LUFS. | Treat as playback normalization and music-delivery advice, not an online-video standard. Preserve album-relative loudness when the destination supports album normalization. |

Never label sample peak (`dBFS`) as true peak (`dBTP`). True peak estimates the continuous reconstructed waveform and may exceed the highest sample value.

### 2.3 Music ducking as an editable control signal

Ducking is a mix decision, not simply “music is quieter whenever ASR reports text.” Adobe’s documented model tags audio by role, chooses what drives ducking, and generates editable gain keyframes with sensitivity, reduction, fade duration, and fade position controls. A platform should expose the same conceptual controls even if the detector is different.

Planner procedure:

1. Classify clips/stems as dialogue, voice-over, music, effects, or ambience; keep confidence and allow manual correction.
2. Build a speech activity envelope from the **audible dialogue stem**, not transcript tokens alone. Include breaths or vocalizations when they carry meaning.
3. Merge very short gaps so the music does not pump between words. Add configurable pre-roll and post-roll around speech.
4. Convert the activity envelope into gain automation with smooth attack/release curves. Preserve musical phrase boundaries where possible.
5. Reduce only enough for intelligibility, using a speech-to-mask or perceptual intelligibility score plus user intent. There is no standards-based universal duck amount.
6. Apply a ceiling/floor to attenuation and a slope limit to automation; expose keyframes for review.
7. Listen at transitions, cross-talk, whispers, loud music transients, and the start/end of sentences. Verify the final integrated loudness after automation.

Prefer band-limited/dynamic EQ ducking when broadband level reduction audibly kills the music, but mark it as a more complex creative transform. Do not duck diegetic music that characters react to unless the editorial intent says to. Do not regenerate automation over manually corrected keyframes without warning; Adobe likewise notes regeneration overwrites manual changes.

### 2.4 Audio failure modes and gates

- **Metallic speech, lisping, missing consonants:** excessive denoise/de-ess/source separation; compare against the clean source and reduce strength.
- **Pumping/noise breathing:** compressor or denoiser driven by pauses; use clip gain, longer release, and room tone continuity.
- **Hollow/phasey mono:** misaligned microphones or stereo widening; correlation/downmix test and choose one mic when necessary.
- **Music jumps between every phrase:** speech regions were not merged or ramps are too fast.
- **Correct LUFS but unintelligible dialogue:** loudness measures the programme, not dialogue clarity. Run dialogue-vs-background and human intelligibility checks.
- **PCM passes, encoded file clips:** true-peak headroom was insufficient or only sample peaks were tested; decode and remeasure the delivery file.
- **Wrong target “corrected”:** delivery profile confusion. QC output must name authority, method, anchor, target, tolerance, measured value, and channel layout.

## 3. Color management and grading

### 3.1 Separate capture encoding, working space, view, and delivery

A robust color pipeline is:

`source pixels + trustworthy source tags -> input transform -> scene/working space -> technical balance -> creative look/grade -> output/display transform -> explicitly tagged delivery`

ITU-R BT.709 defines HDTV signal parameters; BT.2020 defines UHDTV parameters and a wider color gamut; BT.2100 defines HDR-TV using PQ or HLG with BT.2020 colorimetry; BT.1886 defines the reference EOTF for SDR HDTV studio displays. These are different properties—primaries, transfer, matrix, range, and mastering/display metadata must not be collapsed into a single “Rec.709/HDR” string.

ACES is a color-management system, not a look or a LUT. Its Input Transforms convert camera-native encodings into ACES, Look Transforms apply technical/creative changes in ACES, and Output Transforms render for a specified display and viewing condition. ACES Metadata Files can record the transform chain. A house pipeline may use another wide-gamut working space, but should preserve the same explicit stages.

Actionable rules:

- Store source `primaries`, `transfer`, `matrix`, `range`, bit depth, chroma subsampling, mastering metadata, and the provenance/confidence of each value.
- Trust reliable camera/raw metadata first. If tags are missing or contradictory, infer only as a reviewable hypothesis. Pixel values alone usually cannot prove the intended transfer function.
- Set the working space before grading. Adobe warns that changing it after effects/adjustments can change the image.
- Perform input tone mapping/gamut compression before creative effects only when the chosen pipeline specifies it. In a wide-gamut scene-referred workflow, preserve highlight/color latitude through the grade and tone-map at output.
- Use camera-specific log transforms or official input transforms. Never apply a log-to-709 LUT to footage already decoded to 709.
- Normalize shots technically before applying a sequence-wide creative look: exposure/white balance/neutrality, shot matching, secondary corrections, then look.
- Use waveform, RGB parade, vectorscope, gamut/false-color tools, and a calibrated target display. Automatic white balance from an unknown object is only a suggestion.
- Keep SDR and HDR as distinct output transforms/grades when quality matters. A single blind conversion cannot guarantee equivalent creative intent.
- Render the delivery with tags that describe the pixels actually produced. Validate both tags and decoded appearance.

For YouTube SDR, the current platform recommendation is BT.709 transfer, primaries, and matrix. For YouTube HDR upload, grade in Rec.2020 with PQ or HLG; deliver 10- or 12-bit content with Rec.2020 primaries, Rec.2020 non-constant-luminance matrix, correct PQ/HLG tagging, and HDR metadata. YouTube explicitly warns that grading P3 and merely tagging it Rec.2020 is wrong. These are YouTube delivery requirements, not a rule for every HDR platform.

### 3.2 Automatic grading should optimize constraints, not invent truth

Useful per-shot analysis: exposure distribution, clipped channel percentage, neutral candidates, skin-region confidence across diverse skin tones, color temperature/tint estimate, saturation/gamut excursions, flicker, noise, and match distance to neighboring shots.

Safe automation:

- Suggest reversible exposure/white-balance/contrast operations with bounded changes and thumbnails.
- Match adjacent shots using stable regions/subjects, not global histograms alone; a cut from a dark room to daylight should remain different.
- Smooth temporal parameters inside a shot and reset at cuts. Detect flashes before treating luminance change as flicker.
- Protect specular highlights and intentional silhouettes. A histogram target is not a creative target.
- Apply face/skin adjustments only with strong subject and illumination confidence, and never force all skin to a single vectorscope hue.
- Flag clipped acquisition; lowering gain cannot restore lost highlight or shadow detail.

### 3.3 Color failure modes and gates

- **Washed out/crushed output:** log/HDR interpreted as SDR, wrong range, or absent output transform.
- **Double contrast/saturation:** input transform or LUT applied twice.
- **Hue shifts/negative RGB artifacts:** out-of-gamut values without appropriate gamut compression.
- **HDR badge but bad image:** metadata added to pixels never graded with an HDR transfer function.
- **Editor/export mismatch:** monitor/view transform differs from export transform or OS color management is bypassed.
- **Banding:** grading or repeated transforms at insufficient bit depth; use higher-precision processing/dither where appropriate.
- **Shot-match breathing:** analysis window crosses cuts or follows changing composition; segment first, then smooth per shot.

QC should decode test patches or representative frames and verify legal/profile ranges, gamut excursions, transfer/primaries/matrix agreement, bit depth, HDR metadata when required, and visual output on at least the intended class of display. Metadata agreement is necessary but not sufficient.

## 4. Cuts, transitions, retiming, and motion

The default edit should be a motivated cut. Add a transition only when it communicates a change in time/place/state, hides an unavoidable discontinuity, or follows an explicit style. Transition duration is an aesthetic choice tied to cadence; Adobe’s 30-frame default is a product default, not a standard.

Actionable transition rules:

- Require media handles on both sides for a true two-sided dissolve. If handles are absent, shorten/reposition the transition or ask; do not silently freeze/repeat edge frames.
- Preserve audio continuity independently from picture. J/L cuts, ambience beds, and constant room tone often hide dialogue edits better than a visual effect.
- At dialogue cuts, prefer natural pauses, stable head pose, similar framing, and covered edits (B-roll/cutaway) before Morph Cut.
- Morph Cut/optical-flow face interpolation is appropriate mainly for a relatively static talking head with stable background and small pose change. Adobe notes lip-sync and result quality can fail; every synthesized transition needs preview and a `generated_frames` marker.
- Detect duplicate, dropped, and flash frames around every transition.
- Use easing for graphic transforms unless a linear move is intentional. Apply motion blur to animated layers; use frame blending/optical flow for retimed live action. Adobe distinguishes Frame Mix (faster) from Pixel Motion (higher quality for large slowdowns) and warns motion blur can weaken optical-flow estimation.
- Preserve source cadence by default. Retiming requires an explicit speed curve, audio policy, interpolation policy, and review of occlusion, fine patterns, particles, water, flashes, and fast limbs.
- Never interpolate across a shot cut. Segment the motion-estimation domain at cuts and discontinuities.

Accessibility and safety constraints:

- WCAG 2.2 Success Criterion 2.3.1 says content must not flash more than three times in any one-second period unless below the defined general/red flash thresholds. Treat automated flash detection as a release gate and retain a specialist/manual fallback for borderline sequences.
- For editor UI or interactive overlays, WCAG 2.2 SC 2.2.2 requires a pause/stop/hide mechanism for auto-starting moving/blinking/scrolling information lasting more than five seconds when presented alongside other content (unless essential). This is an interface requirement, not a command to shorten ordinary authored video.
- Offer a reduced-motion derivative or motion-intensity constraint for templates: replace whip/zoom/parallax transitions with cuts/fades and avoid animated blur/depth effects. Apple specifically recommends disabling or changing depth simulation such as parallax, animated blur, and depth-of-field effects when Reduce Motion is enabled.

Failure modes include missing handles, one-frame black flashes, optical-flow warping, motion vectors crossing cuts, retimed audio pitch artifacts, sync drift, strobing from frame-rate conversion, transition spam, and template animation that obscures captions or meaningful action.

## 5. Captions, subtitles, transcripts, and accessibility

### 5.1 Model timed text as semantic data

Keep a canonical cue model independent of burned-in graphics:

```json
{
  "id": "cue-0042",
  "start": "00:01:03.480",
  "end": "00:01:06.120",
  "text": "The export is ready.",
  "speaker": "MAYA",
  "language": "en-US",
  "kind": "caption",
  "sound": null,
  "position": {"mode": "avoid_regions", "preferred": "bottom"},
  "word_times": [],
  "confidence": 0.98,
  "review": ["proper_noun_verified"]
}
```

Distinguish:

- **Captions:** same-language dialogue plus speaker identity and meaningful non-speech audio for Deaf/hard-of-hearing viewers.
- **Subtitles:** usually translate dialogue and may assume the viewer can hear other audio.
- **Transcript:** a separate, navigable text representation. W3C notes it serves needs captions do not and is not a replacement for synchronized captions.
- **Audio description/descriptive transcript:** conveys meaningful visual information. WCAG 2.2 requires prerecorded captions at Level A (SC 1.2.2) and audio description for prerecorded synchronized video at Level AA (SC 1.2.5), subject to the criteria’s exceptions.

W3C’s WebVTT specification supports timed cues, cue boxes, line/position/size/alignment, regions, vertical text, chapters, and descriptions. Use WebVTT or TTML when positioning/styling must survive. SRT is interoperable but weakly specified; YouTube supports only basic UTF-8 SRT and ignores styling. Generate SRT as a derivative, not the only source of truth.

### 5.2 Authoring procedure

1. Transcribe with word timestamps and language spans; diarize speakers separately.
2. Restore punctuation/case without changing meaning. Verify names, terminology, numbers, URLs, and quoted language against an authoritative source.
3. Add speaker IDs when not visually obvious and meaningful non-speech audio/music cues. W3C’s caption guidance explicitly includes these.
4. Segment cues on syntactic and prosodic boundaries. Do not split a name, modifier+noun, prepositional phrase, or auxiliary+verb merely to balance line widths.
5. Synchronize to speech/sound. Avoid cue changes in the middle of a word and avoid leaving stale captions across a shot/meaning change.
6. Fit the intended reading-rate profile; first extend timing into available silence, then re-segment. Edit speech only when the profile permits it and preserve meaning/essential vocabulary.
7. Place cues to avoid faces, mouths, names, lower thirds, signs, demonstrations, and platform UI. Keep position stable rather than making captions chase a moving speaker.
8. Human-review ASR and translation. YouTube itself warns automatic captions can misrepresent accents, dialects, names, overlapping speakers, and poor audio.
9. Export both closed-caption sidecar(s) and, only when requested, an open-caption render. Closed captions preserve user font/size/color preferences and language selection.
10. Validate syntax, overlap, timing, reading rate, safe-region collision, encoding, and the actual destination player.

FCC rules for U.S. television caption quality identify four outcomes: **accuracy, synchronicity, completeness, and placement**. Treat these as semantic QC dimensions even when the asset is not regulated broadcast content; legal applicability depends on distribution context.

DCMP’s Captioning Key is an educational-media guideline, not a universal law. It recommends normally no more than two lines, logical line division, approximately synchronized cues, placement away from essential visuals, and presentation-rate ceilings of **130 wpm for lower-level, 140 wpm for middle-level, and 160 wpm for upper-level educational media**. It also gives a **40-frame minimum (1 second + 10 frames in its broadcast context)** and six-second maximum cue duration. Store these only in a `dcmp_education` profile; frame-count guidance is cadence/context-sensitive and should not become the platform-wide default.

### 5.3 Caption failure modes and gates

- ASR confidence is high but the proper noun is wrong; require term-list/entity verification.
- Speaker labels leak across a cut or overlap; use audiovisual diarization and mark uncertainty.
- Captions omit laughter, alarms, music, or an offscreen speaker that changes meaning.
- Translation is literal but too long; use a qualified subtitle review rather than deleting meaning automatically.
- Cue overlap/zero duration/negative time after a ripple edit; regenerate from sequence-time anchors and validate.
- Burned captions collide with mobile controls, lower thirds, or reframed faces; run per-frame region collision checks.
- Styled WebVTT is uploaded to a platform that supports only limited markup; validate destination capability and preview after upload.
- Captions are present but inaccessible because they are baked only, too small, low contrast, or unavailable to assistive technology.

## 6. Reframing, aspect ratios, and safe areas

Generate a distinct sequence/version for each aspect ratio; do not overwrite the framing of the master. Adobe’s Auto Reframe similarly duplicates the sequence, applies per-clip motion tracking, and warns that complex/rapid scenes need manual keyframe refinement.

### 6.1 Reframe planner

1. Read display aspect ratio, pixel aspect ratio, rotation, clean aperture, and any existing crop.
2. Segment at shots. Detect faces, bodies, active speaker, gaze, important objects, text/graphics, and motion; carry uncertainty.
3. Build per-frame **must-include**, **prefer-include**, and **must-not-cover** regions. Dialogue speaker and task-relevant object often need to coexist.
4. Solve crop/scale in normalized coordinates subject to target raster, maximum scale, edge padding, and safe regions.
5. Smooth the crop path inside the shot with velocity/acceleration constraints; cut or deliberately retarget at shot boundaries. Avoid micro-panning from detector jitter.
6. Detect impossible compositions (widely separated people, side-by-side demo, important text spanning width). Choose a layout such as split screen, picture-in-picture, or blurred/patterned background only with style permission; otherwise request review.
7. Re-layout graphics and captions, not just footage. OCR test every title after reflow.
8. Preview with real destination UI exclusion zones and on representative devices.

Safe areas are delivery conventions, not one percentage for all screens. SMPTE ST 2046-1/RP guidance defines legacy television safe-action and safe-title concepts; an NAB engineering summary describes 93% width/height safe action and 90% safe title for that television context. Modern mobile platforms overlay controls asymmetrically and change them over time. YouTube’s Shorts editor provides live visual guides and warns when text/stickers enter a non-safe area but does not publish a timeless universal pixel margin. Therefore safe zones should be **versioned polygons per platform, surface, device class, and date**, with a conservative fallback plus preview—not a hard-coded “10% rule.”

Failure modes: following the wrong face, cutting off hands/products, oscillating crop, zooming beyond source resolution, captions outside crop, graphics clipped by UI, jump at shot boundaries, subject too large for headroom, or nesting that breaks transition handles. Adobe specifically notes nested Auto Reframe sequences may not preserve soft transitions correctly because handle media is absent.

## 7. Codecs, proxies, render, and export

### 7.1 Keep four media roles distinct

- **Camera original/source:** immutable evidence and maximum available quality.
- **Proxy:** low-cost editorial representation attached by stable asset ID/timecode, never a finishing source.
- **Mezzanine/master:** high-quality render suitable for QC, archive, and derivative encodes.
- **Delivery derivative:** destination-specific container/codec/bitrate/color/audio/caption package.

Proxy rules:

- Preserve duration, start timecode, exact rational frame rate, audio channel count/layout, and source-to-proxy time mapping. Copy rotation and color metadata deliberately.
- Link by durable asset ID plus verified duration/timecode, not filename alone. Adobe can match filenames, extensions, tape names, and timecode, but those are fallible heuristics.
- Add a visible proxy badge in the viewer. Refuse final export from proxy-only media unless the user explicitly authorizes it.
- Relink full-resolution originals before effects that depend on resolution, noise texture, focus, stabilization borders, or color precision.
- Render from full-resolution sources and validate there are no offline frames, low-resolution substitutions, or mismatched audio channels.

Apple describes ProRes as a high-quality, high-performance editing codec family. ProRes 422 Proxy is appropriate as one proxy option; ProRes 422/HQ or 4444 can serve as mezzanine choices depending on chroma/alpha/quality needs. These are codec choices, not standards-mandated defaults. Preserve alpha only in a codec/profile that supports it. Avoid repeated lossy delivery transcodes; encode each derivative from the mezzanine.

### 7.2 Frame rate, scan, and time base

- Preserve native frame rate unless the profile explicitly requires conversion. YouTube likewise recommends uploading the recorded/native rate and deinterlacing interlaced content before upload.
- Detect variable frame rate and build an explicit timestamp map. Do not assume `frame_index / nominal_fps` is source time.
- Represent NTSC-derived rates as rationals (for example, 30000/1001), and preserve drop-frame versus non-drop-frame **timecode notation** separately from playback rate.
- Deinterlace with field-order-aware processing. Do not deinterlace progressive segmented frame or progressive footage because a metadata flag looked suspicious; EBU QC notes accurate scan-type automation may need visual confirmation.
- Frame-rate conversion must specify cadence strategy: duplication/drop, blend, or motion-compensated interpolation. Inspect pans, credits, flashes, cuts, and sync.
- Never insert letterbox/pillarbox pixels merely to reach a platform aspect ratio when the destination player adapts natively; YouTube explicitly recommends native aspect without baked bars.

### 7.3 Encode from the destination profile

For current YouTube upload, the platform recommends MP4 with the `moov` atom at the front, H.264 High Profile, progressive scan, CABAC, variable bitrate, 4:2:0 chroma, source-native frame rate, and AAC-LC/Opus/Eclipsa audio at 48 kHz. Example **upload recommendations**, not universal quality thresholds: SDR 1080p is **8 Mbps at 24/25/30 fps or 12 Mbps at 48/50/60 fps**; SDR 2160p is **35–45 Mbps or 53–68 Mbps**, respectively. YouTube re-encodes uploads, so retain a higher-quality mezzanine and test the processed result.

Export rules:

- Map every setting explicitly: container, codec/profile/level, raster, sample aspect, frame rate, scan, GOP, rate control, pixel format, bit depth, primaries/transfer/matrix/range, HDR metadata, audio codec/rate/layout, captions, chapters, and fast-start/streaming flags.
- Fail early on incompatible combinations (for example, an HDR output space with an 8-bit codec setting). Adobe’s color-managed export similarly warns when format/bit depth cannot represent the output color space.
- Estimate size and available storage before render; write atomically to a temporary output and finalize only after encode succeeds.
- Record encoder name/version and command/config. Deterministic builds should pin versions and settings.
- Decode a sample early for long renders, then decode the complete artifact for QC. File creation success is not delivery success.
- Use `ffprobe` JSON or equivalent to produce a normalized manifest; it exposes wrapper/stream metadata in machine-parseable sections.

Common failures: proxy exported as master, VFR sync drift, mismatched channel mapping, missing `moov` fast-start, incorrect full/limited range, color tags copied without conversion, alpha discarded, rotation applied twice, GOP/profile rejected by destination, subtitle stream lost, truncated file, or generational compression.

## 8. Quality control as a layered, profile-driven system

EBU QC separates tests into **wrapper**, **bitstream**, **baseband** (decoded frames/samples), **cross-check** (agreement between layers), and **programme layout**. Use that architecture. A wrapper saying “BT.709, 48 kHz stereo” does not prove the decoded image/audio match it.

### 8.1 QC stages

**Source preflight**

- readable/decodeable, stable duration/time bases, expected streams, no obvious corruption;
- frame-rate/scan/color/channel metadata captured with confidence;
- clipping, long silence/black/freeze, and missing-media candidates reported, not automatically deleted.

**Timeline invariants**

- no gaps or overlaps unless intentional; no transition beyond available handles;
- audio/video mapping remains monotonic except explicit retimes;
- captions are in bounds and do not overlap invalidly;
- all generated/synthetic regions are labeled;
- source references resolve to originals for final render.

**Post-render automated QC**

- wrapper/bitstream conformance to the exact delivery profile;
- decode every frame/sample or use a verified full-stream decode pass;
- expected duration and A/V sync; start/end and frame-count consistency;
- black/constant-color, freeze/duplicate/drop, corruption, interlace/combing, illegal range/gamut, flash/PSE, blocking/banding candidates;
- loudness, maximum true peak, silence, clipping, channel layout, phase/downmix;
- captions: parse, language, timing, overlap, reading rate, spelling/entity flags, placement collision, and required completeness;
- hashes, file size, manifest, and test provenance.

FFmpeg provides useful detectors: `blackdetect`/`blackframe`, `freezedetect`, `signalstats`, `silencedetect`, `ebur128`, `idet`, `cropdetect`, `blockdetect`, and `blurdetect`. Defaults such as `blackdetect`’s two-second duration/98% black-frame ratio or `freezedetect`’s two-second duration are **tool defaults**, not pass/fail definitions. Configure thresholds from the profile and label detections as candidates because black/freeze/silence can be creative intent.

**Human QC**

- watch and listen in real time at least around every flagged event, edit/transition, caption collision, reframing exception, and generated frame;
- for release-critical assets, perform a full programme pass on the actual delivery encode with captions and required audio configurations;
- inspect beginning/end, sync references, dialogue intelligibility, grade continuity, graphics spelling, legal/editorial issues, and representative destination playback;
- do not let a perceptual metric replace review. EBU explicitly categorizes general image-quality assessment as human-only and notes automated QC cannot fully replace expertise.

### 8.2 QC result schema and severity

```json
{
  "test_id": "audio.programme_loudness",
  "authority": "EBU R 128 v5.0",
  "profile": "ebu_broadcast_file",
  "layer": "baseband",
  "method": "ITU-R BS.1770-5, full programme, gated",
  "expected": {"target_lufs": -23.0, "qc_tolerance_lu": 0.2},
  "measured": {"integrated_lufs": -22.7, "max_true_peak_dbtp": -1.4},
  "status": "fail",
  "severity": "delivery_blocker",
  "ranges": [],
  "tool": {"name": "ffmpeg loudnorm", "version": "pinned-build"},
  "evidence": ["measurement.json"]
}
```

Recommended severities:

- `delivery_blocker`: violates a contractual/regulatory/platform constraint or cannot decode.
- `review_required`: likely defect, ambiguous intent, generated material, or low-confidence interpretation.
- `warning`: quality risk that may be acceptable by intent.
- `info`: measured property or intentional exception.

Report every failure with timecode/range, frame count when useful, stream/channel identity, measured and expected values, authority/profile, and evidence thumbnail/audio excerpt. EBU QC recommends reporting changes over time and clearly marking calculated rather than read metadata. Tests that cannot apply because required information is absent should be `not_applicable`/`unknown`, never silently pass.

## 9. Planner policy: what may be automatic

| Operation | Auto-apply when | Require review when |
|---|---|---|
| Short fades/crossfades | no sync/transient conflict; bounded and reversible | music beat/transient or intentional hard cut |
| Clip gain matching | high-confidence same speaker/context; target is local consistency | dramatic whisper/shout, archival/noisy source |
| Dialogue repair | defect is classified and mild; A/B score improves | reconstruction, strong denoise/dereverb, overlap separation |
| Ducking | audio roles and speech activity are strong; keyframes exposed | diegetic music, singing, overlapping speakers, dense sound design |
| Loudness normalization | delivery profile and measurement anchor are explicit | no target/profile, large gain/dynamic change needed |
| Input color transform | reliable camera/raw metadata or explicit user choice | missing/contradictory tags, already baked look unknown |
| Shot balance | bounded technical correction with stable reference | creative look, mixed lighting, silhouettes, clipped source |
| Transition | explicit template/editorial rule and handles exist | generated frames, morph/optical flow, missing handles |
| Caption timing/layout | transcript reviewed; no conflicts; destination supported | ASR/translation uncertainty, overlapping speech, important graphics |
| Auto reframe | one clear subject and feasible crop, smooth path | multiple subjects, wide demo/text, fast action, excessive upscale |
| Export | complete versioned profile and preflight pass | inferred settings, missing originals, metadata/essence conflict |

The safest high-speed hackathon architecture is not “one AI makes a final video.” It is a chain of specialized analyzers that produce evidence, a planner that creates reversible decisions under a named profile, deterministic media tools that render, and independent QC that evaluates the encoded artifact.

## Sources

All sources accessed **2026-07-25**.

### Standards, regulations, and industry recommended practices

- [ITU-R BS.1770-5: Algorithms to measure audio programme loudness and true-peak audio level](https://www.itu.int/rec/R-REC-BS.1770-5-202311-I)
- [EBU R 128 v5.0: Loudness normalisation and permitted maximum level of audio signals](https://tech.ebu.ch/files/live/sites/tech/files/shared/r/r128.pdf)
- [EBU R 128 s2: Loudness in Streaming](https://tech.ebu.ch/docs/r/r128s2.pdf)
- [ATSC A/85:2026-07: Techniques for Establishing and Maintaining Audio Loudness](https://www.atsc.org/wp-content/uploads/2026/07/A85-2026-07.pdf)
- [ATSC A/85:2026-07 Annex M: Loudness and True Peak Quick Reference](https://www.atsc.org/wp-content/uploads/2026/07/A85-2026-07-Annex-M.pdf)
- [ITU-R BT.709-6: HDTV production and programme-exchange parameters](https://www.itu.int/rec/R-REC-BT.709-6-201506-I)
- [ITU-R BT.2020-2: UHDTV production and programme-exchange parameters](https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.2020-2-201510-I%21%21PDF-E.pdf)
- [ITU-R BT.2100-3: HDR television image parameter values](https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.2100-3-202502-I%21%21PDF-E.pdf)
- [ITU-R BT.1886: Reference EOTF for HDTV studio displays](https://www.itu.int/dms_pubrec/itu-r/rec/bt/r-rec-bt.1886-0-201103-i%21%21pdf-e.pdf)
- [ACES system overview and transform architecture](https://docs.acescentral.com/background/overview/)
- [ACES Input Transforms](https://docs.acescentral.com/system-components/input-transforms/)
- [ACES Output Transforms](https://docs.acescentral.com/system-components/output-transforms/)
- [W3C WebVTT specification series](https://www.w3.org/TR/webvtt/all/)
- [W3C WCAG: Captions (Prerecorded), Success Criterion 1.2.2](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html)
- [W3C WCAG: Audio Description (Prerecorded), Success Criterion 1.2.5](https://www.w3.org/WAI/WCAG22/Understanding/audio-description-prerecorded.html)
- [W3C WCAG: Three Flashes or Below Threshold, Success Criterion 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)
- [W3C WCAG: Pause, Stop, Hide, Success Criterion 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- [W3C Media Accessibility User Requirements](https://www.w3.org/TR/media-accessibility-reqs/)
- [FCC 14-12: Closed Captioning Quality Report and Order](https://docs.fcc.gov/public/attachments/FCC-14-12A1_Rcd.pdf)
- [DCMP Captioning Key](https://dcmp.org/captioningkey/print)
- [SMPTE Recommended Practice index, including RP 218 safe-area guidance](https://www.smpte.org/standards/document-index/RP)
- [NAB engineering summary of SMPTE television safe areas](https://www.nab.org/xert/scitech/pdfs/tv031510.pdf)
- [EBU QC catalogue help and purpose](https://qc.ebu.io/help/index)
- [EBU QC layer model](https://qc.ebu.io/help/layers)
- [EBU QC global reporting rules](https://qc.ebu.io/help/global_rules)
- [EBU QC General Image Quality test definition](https://qc.ebu.io/items/0087B/versions/1-0-0/)

### Primary vendor/platform implementation guidance

- [FFmpeg filter documentation](https://www.ffmpeg.org/ffmpeg-filters.html)
- [FFprobe machine-readable media inspection documentation](https://ffmpeg.org/ffprobe.html)
- [Adobe Premiere: Repair dialogue](https://helpx.adobe.com/premiere/desktop/add-audio-effects/adjust-volume-and-levels/repair-dialogue.html)
- [Adobe Premiere: Automatically duck audio](https://helpx.adobe.com/au/premiere/desktop/add-audio-effects/adjust-volume-and-levels/automatically-duck-audio.html)
- [Adobe Premiere: How Color Management works](https://helpx.adobe.com/premiere/desktop/correct-color/set-up-color-management/how-color-management-works.html)
- [Adobe Premiere: Auto Reframe a sequence](https://helpx.adobe.com/premiere/desktop/add-video-effects/commonly-used-effects/add-auto-reframe-effect-to-a-sequence.html)
- [Adobe Premiere: Morph Cut workflow and limitations](https://helpx.adobe.com/uk/premiere/desktop/add-video-effects/apply-video-transitions/apply-morph-cut-to-smoothen-jump-cuts.html)
- [Adobe After Effects: Time stretching, remapping, and frame blending](https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/time-stretching-and-time-remapping/time-stretching-time-remapping.html)
- [Adobe Premiere: Ingest and proxy workflow](https://helpx.adobe.com/premiere/desktop/organize-media/ingest-proxy-workflow/ingest-and-proxy-workflow.html)
- [Apple Final Cut Pro ecosystem and official white-paper index](https://support.apple.com/en-us/125519)
- [Apple ProRes white paper](https://www.apple.com/final-cut-pro/docs/Apple_ProRes.pdf)
- [Apple: HDR and Wide Color Gamut in Final Cut Pro](https://www.apple.com/final-cut-pro/docs/HDR_WideColor.pdf)
- [Apple reduced-motion evaluation criteria](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria)
- [Apple Podcasts audio requirements](https://podcasters.apple.com/support/893-audio-requirements)
- [Spotify loudness normalization behavior and mastering guidance](https://support.spotify.com/us/artists/article/loudness-normalization/)
- [YouTube recommended upload encoding settings](https://support.google.com/youtube/answer/1722171)
- [YouTube HDR upload requirements](https://support.google.com/youtube/answer/7126552)
- [YouTube supported caption/subtitle files](https://support.google.com/youtube/answer/2734698)
- [YouTube automatic-caption limitations and review guidance](https://support.google.com/youtube/answer/6373554)
- [YouTube Shorts editor safe-area guidance](https://support.google.com/youtube/answer/16215842)
