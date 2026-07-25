# Post-production reference

Use this reference for finishing order, profile-driven targets, automated operations, and QC. The full research note is at `../../../notes/post-production-methodologies.md`.

## Finish to a named profile

There is no universal web master. Define a versioned delivery profile containing authority type, raster/aspect, rational frame rate, scan, color primaries/transfer/matrix/range, bit depth, codec/container/rate control, audio layout/sample rate/loudness method and target, caption formats, layout exclusion regions, and QC template.

Keep camera originals immutable and distinguish source, proxy, mezzanine/master, and delivery derivative. Probe and preserve metadata; plan non-destructively; preview through the target transform; render from originals; encode derivatives from the mezzanine; validate the actual encoded artifact.

## Dialogue and mix

Process in this order:

1. choose/align the best source and repair edit continuity with fades/room tone;
2. set clip gain before dynamics;
3. repair diagnosed rumble, hum, clicks, or broadband noise conservatively;
4. de-ess/dereverberate/correct EQ only as evidence requires;
5. use gentle compression/leveling, then automation;
6. mix dialogue, music, effects, ambience, and descriptions in context;
7. measure whole-program loudness/true peak with the delivery method;
8. decode and remeasure lossy output.

Keep a clean dialogue stem. Do not learn noise from consonants/breaths, gate room tone to silence, normalize every clip to a program target, or mistake ASR silence for editorial silence. Flag de-clipping as reconstruction.

### Loudness context

ITU-R BS.1770 defines measurement, not one target. Examples valid only in their profiles:

- EBU R128 broadcast: -23 LUFS program target and production maximum -1 dBTP under its rules.
- ATSC A/85 exchange: commonly -24 LKFS and maximum -2 dBTP, with content-type measurement details.
- Apple Podcasts: about -16 LKFS ±1 and true peak no higher than -1 dBFS.
- Spotify playback normalization: -14 LUFS behavior/guidance is not a video standard.

Never conflate sample peak dBFS with true peak dBTP, or full-program measurement with dialogue-gated measurement.

### Ducking

Classify audible roles, create a speech activity envelope from audio rather than transcript alone, merge short gaps, add pre/post roll, generate smooth editable automation, and preserve musical phrases. There is no universal duck amount. Avoid pumping and do not overwrite hand-edited keyframes silently.

## Color

Keep explicit stages:

```text
source encoding/tags
  -> input transform
  -> scene/working space
  -> technical balance and shot match
  -> creative look
  -> output/display transform
  -> correctly tagged delivery
```

Store primaries, transfer, matrix, range, bit depth, chroma, HDR metadata, and confidence/provenance. Do not apply a log-to-709 transform twice, infer missing tags as fact, or attach HDR metadata to SDR pixels. Balance before the look, smooth inside shots only, reset at cuts, and validate pixels as well as metadata. Use separate SDR/HDR outputs where quality matters.

## Transitions, retiming, and motion

- Default to a motivated cut.
- Require handles for true transitions; do not silently freeze edge frames.
- Try sound continuity, stable poses, or legitimate cutaways before generated morphs.
- Mark morph/optical-flow frames as generated and preview them.
- Never interpolate motion across a cut.
- Make retime speed curve, audio policy, interpolation policy, and artifact review explicit.
- Check flash safety: WCAG 2.2 SC 2.3.1 limits flashes over the defined thresholds.
- Offer reduced-motion template behavior where relevant.

## Captions and accessibility

Maintain a canonical cue model with exact time, text, speaker, language, kind, meaningful sound, position intent, word times, confidence, and review state. Distinguish captions, translated subtitles, transcript, and audio description.

Author by verifying names/numbers/terms, adding unobvious speakers and meaningful sounds, segmenting at syntax/prosody, synchronizing to audio, fitting a named reading profile, avoiding faces/graphics/UI, human-reviewing ASR/translation, exporting sidecars and requested open captions, then validating in the destination player.

WCAG 2.2 requires prerecorded captions for synchronized media with meaningful audio at Level A and audio description under the Level AA criterion and exceptions. The FCC’s accuracy, synchronicity, completeness, and placement dimensions are useful semantic QC even when its television regulation does not apply. DCMP numeric reading/cue guidance belongs only in an educational profile—not a global default.

Use WebVTT/TTML when placement/styling must survive. Treat SRT as a basic derivative. Burned captions alone remove user control and language selection.

## Reframing

Create separate aspect-ratio versions. Per shot, detect and track required/preferred/avoid regions and optimize crop center/scale with bounds on resolution loss, velocity, acceleration, and jitter. Re-layout graphics/captions and OCR-test titles. If required regions cannot fit, use an approved layout, padding, or review.

Safe areas are versioned delivery conventions. Store platform/surface/device/date-specific exclusion polygons and preview real UI; do not hard-code one universal 10% margin.

## Proxies and export

Preserve source timecode, exact rational rate, duration, channel layout, and mapping in proxies; relink originals before final effects/render. Detect variable frame rate and build a timestamp map. Preserve native frame rate unless conversion is required. Keep drop-frame notation separate from playback rate.

Map every export setting explicitly, fail incompatible combinations early, write atomically, pin encoder versions, decode a sample during long renders, and decode the complete output for QC. File creation is not delivery success.

## Layered QC

Use wrapper, bitstream, decoded baseband, cross-check, and program-layout layers.

- **Source:** decodability, streams, clocks, metadata confidence, corruption/black/silence candidates.
- **Timeline:** valid ranges, intentional gaps/overlaps, transition handles, monotonic maps, caption validity, synthetic labels, original relink.
- **Output:** complete decode, expected duration/streams/timestamps, A/V sync, black/freeze/drop/flash/interlace/range/gamut candidates, loudness/true peak/silence/clipping/layout, caption syntax/coverage/collision, manifest/hashes.
- **Human:** review flags and transitions; for critical release, watch the complete encoded program with captions/audio configurations on representative playback.

Tool detector defaults are not pass/fail standards. Label creative black/freeze/silence as candidates. A test lacking required data is `unknown` or `not_applicable`, never a silent pass. Every result should name authority, profile, method, expected, measured, severity, ranges, tool version, and evidence.

## Key authoritative sources

- [ITU-R BS.1770-5](https://www.itu.int/rec/R-REC-BS.1770-5-202311-I)
- [EBU R 128](https://tech.ebu.ch/files/live/sites/tech/files/shared/r/r128.pdf)
- [ACES overview](https://docs.acescentral.com/background/overview/)
- [W3C WebVTT](https://www.w3.org/TR/webvtt/all/)
- [W3C captions](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html)
- [W3C flash safety](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)
- [EBU QC layers](https://qc.ebu.io/help/layers)
- [FFmpeg filters](https://www.ffmpeg.org/ffmpeg-filters.html)
- [Adobe color management](https://helpx.adobe.com/premiere/desktop/correct-color/set-up-color-management/how-color-management-works.html)
- [Adobe Auto Reframe](https://helpx.adobe.com/premiere/desktop/add-video-effects/commonly-used-effects/add-auto-reframe-effect-to-a-sequence.html)
- [YouTube encoding guidance](https://support.google.com/youtube/answer/1722171)

Sources accessed 2026-07-25.
