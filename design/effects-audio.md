# Audio effects and mixing system

Research/design date: **2026-07-25**. This is an implementation contract, not a claim that the current preview renders these effects.

## Decision

Model audio as three different things:

1. **Processors** transform an existing clip or bus: cleanup, EQ, compression, time/pitch change, limiting.
2. **Automation** changes parameters over composition time: gain rides, fades, and music ducking.
3. **Generated/placed assets** add audio: music, ambience, impact, riser, whoosh, record scratch.

The model requests semantic recipes such as `audio.dialogue-clean@1` or `audio.record-scratch-stop@1`. A deterministic compiler resolves them to typed effects, automation, and licensed assets supported by the active capability manifest. Unknown effects, missing assets, unsafe levels, or unavailable processors produce diagnostics rather than unchecked strings.

```text
source mapping / retime
  -> audio_repair
  -> audio_tone
  -> audio_dynamics
  -> audio_level
  -> dialogue | music | sfx buses
  -> bus_mix
  -> master
  -> encoded-output QC
```

The same compiled graph must drive preview and export. Browser preview may lower to Web Audio and export to FFmpeg, but any mismatch must be disclosed. The [Web Audio Recommendation](https://www.w3.org/TR/webaudio-1.0/) defines routing graphs and ordered parameter automation; [FFmpeg's filter documentation](https://ffmpeg.org/ffmpeg-filters.html) provides likely offline primitives. Backend defaults are never product semantics.

## Core schema

Use integer audio ticks at a declared rate, normally 48,000 ticks/second, rather than floating-point seconds.

```ts
type AudioRole = "dialogue" | "voiceover" | "music" | "sfx" | "ambience" | "master";

interface AudioEffectInstance {
  id: string;
  effect: { id: string; version: number };
  target: {
    scope: "clip" | "track" | "bus" | "master";
    targetId: string;
    range?: { startTick: string; endTick: string };
  };
  stage: "audio_repair" | "audio_tone" | "audio_dynamics" |
         "audio_level" | "bus_mix" | "master";
  enabled: boolean;
  parameters: Record<string, number | string | boolean | object>;
  automation?: Record<string, AutomationCurve>;
  provenance: {
    authoredBy: "user" | "agent" | "recipe" | "analysis";
    recipeId?: string;
    reason: string;
    evidenceIds?: string[];
  };
}

interface AutomationCurve {
  domain: "composition_ticks" | "clip_local_ticks";
  interpolation: "hold" | "linear" | "equal_power" | "exponential";
  defaultValue: number;
  points: Array<{ tick: string; value: number }>;
  generatedFrom?: {
    generatorId: string;
    generatorVersion: number;
    evidenceHash: string;
    parametersHash: string;
  };
  protectedRanges?: Array<{ startTick: string; endTick: string }>;
}

interface AudioCue {
  id: string;
  assetId: string;
  role: "music" | "sfx" | "ambience";
  startTick: string;
  sourceRange?: { startTick: string; endTick: string };
  gainDb: number;
  fades: { inTicks: string; outTicks: string; curve: "linear" | "equal_power" };
  sync?: { kind: "onset" | "peak" | "downbeat" | "end"; anchorTick: string };
}
```

Every registry entry declares parameter units/ranges, automatable parameters, channel layouts, latency/tail behavior, preview/export bindings, and fallback. Units belong in names such as `frequencyHz` and `attackMs`, never only UI labels.

## P0 registry

### Gain and fades — `audio_level`

```ts
type GainV1 = { gainDb: number }; // hard range -96..+24
type FadeV1 = {
  direction: "in" | "out";
  durationMs: number;             // 2..10000
  curve: "linear" | "equal_power";
};
```

Use dB, with `linear = 10^(dB/20)`. Default boundary repair is a 5 ms equal-power fade on non-transient cuts, shortened to fit. Do not erase a protected clap, plosive, or impact. Crossfades are explicit overlaps requiring source handles.

### Repair and cleanup — `audio_repair`

```ts
type DialogueDenoiseV1 = {
  engine: "ffmpeg_afftdn" | "ffmpeg_anlmdn" | "model";
  reductionDb: number;            // 0..18; recommended 3..9
  noiseProfileEvidenceId?: string;
  mix: number;                    // 0..1
};
```

Only learn a noise profile from pinned speech-free evidence. Never use consonants, breaths, laughter, or uncertain ASR gaps. Preserve the dry signal and warn above conservative ranges. De-clicking/de-clipping are later; de-clipping must be labeled reconstruction. Missing engines bypass with a warning, not an unrelated substitute.

### High-pass and EQ — `audio_tone`

```ts
type HighPassV1 = { cutoffHz: number; slopeDbPerOctave: 6 | 12 | 18 | 24 };
type EqBand = {
  id: string;
  shape: "bell" | "low_shelf" | "high_shelf" | "notch";
  frequencyHz: number;            // 20..20000
  gainDb: number;                 // -18..+18
  q: number;                      // 0.1..20
};
type ParametricEqV1 = { bands: EqBand[] }; // P0 maximum 6
```

High-pass is diagnosis-driven, not “80 Hz on every voice.” Prefer bounded subtractive correction, attach rumble/hum/tone evidence, and leave low-confidence changes for review.

### Compressor — `audio_dynamics`

```ts
type CompressorV1 = {
  thresholdDb: number;            // -60..0
  ratio: number;                  // 1..20
  attackMs: number;               // 0.1..200
  releaseMs: number;              // 10..2000
  kneeDb: number;                 // 0..24
  makeupGainDb: number;           // -12..+18
  detector: "peak" | "rms";
  channelLink: "average" | "maximum";
};
```

A gentle house starting point can be -20 dB threshold, 2.5:1, 12 ms attack, 120 ms release, 6 dB knee, no makeup gain. It is not a standard. Warn on sustained reduction over 9 dB. Web Audio offers ordinary compression but no sidechain, so it cannot authoritatively preview ducking ([Web Audio 1.1](https://www.w3.org/TR/webaudio-1.1/)).

### Ducking — generated `audio_level` automation on the music bus

```ts
type DuckingV1 = {
  targetBusId: string;
  triggerBusIds: string[];
  attenuationDb: number;          // -30..0; common starting range -18..-6
  thresholdDbfs: number;          // -60..-6
  attackMs: number;               // 5..500
  releaseMs: number;              // 50..3000
  preRollMs: number;              // 0..1000
  postRollMs: number;             // 0..2000
  mergeGapMs: number;             // 0..2000
  floorDb: number;
  detector: "audio_activity" | "manual_regions";
};
```

Generate visible, editable keyframes from the audible dialogue/voiceover bus, not transcript tokens alone. Merge short gaps to prevent word-by-word pumping. Preserve protected manual keyframes and report regeneration conflicts. There is no universal attenuation. FFmpeg supports a two-input `sidechaincompress`, but materialized automation is more inspectable and portable ([official sidechaincompress docs](https://ffmpeg.org/ffmpeg-filters.html#sidechaincompress)).

### Time stretch and pitch shift — source mapping before `audio_repair`

```ts
type TimePitchV1 = {
  tempoRatio: number;             // P0 0.5..2.0
  pitchSemitones: number;         // later -12..+12
  mode: "preserve_pitch" | "tape" | "pitch_only";
  preserveFormants: boolean;
  transientMode: "crisp" | "balanced" | "smooth";
};
```

For linked A/V, the picture rate mapping is authoritative. At constant rate `r`, composition duration is `sourceDuration/r`; pitch-preserved audio uses tempo ratio `r`. Reject edits when the backend cannot keep sync. P0's processor supports only 0.5–2x constant, pitch-preserving rates, while automatic edits of intelligible speech stay within 0.85–1.25x; going wider requires explicit review or a mute/detach policy. FFmpeg `atempo` supports tempo adjustment; above 2 it may skip samples and recommends chaining. FFmpeg's optional `rubberband` filter independently changes tempo/pitch/formants ([official FFmpeg docs](https://ffmpeg.org/ffmpeg-filters.html#atempo)), but Rubber Band is GPL-2-or-later unless commercially licensed ([official licensing](https://breakfastquay.com/rubberband/license.html)). Capability- and license-probe it; do not assume it exists.

### Loudness and peak safety — `master`

```ts
type LoudnessProfile = {
  id: string;
  measurement: "itu_bs_1770_5";
  anchor: "full_programme" | "dialogue_gated";
  integratedTargetLufs: number;
  toleranceLu: number;
  maxTruePeakDbtp: number;
  loudnessRangeTargetLu?: number;
  authority: string;
};
```

Never invent a generic “social” target. ITU BS.1770 defines measurement, not one target ([ITU-R BS.1770-5](https://www.itu.int/rec/R-REC-BS.1770-5-202311-I)). EBU R 128's -23 LUFS applies to its broadcast profile ([EBU R 128](https://tech.ebu.ch/fr/publications/r128)). Every other destination gets a named, versioned profile.

For deterministic file delivery: render the creative mix; measure and store integrated loudness/LRA/threshold/true peak with the graph and engine hash; apply the profile adjustment and true-peak guard; then measure final PCM and the lossy encode. FFmpeg `loudnorm` supports double-pass normalization and true-peak targeting ([official loudnorm docs](https://ffmpeg.org/ffmpeg-filters.html#loudnorm)). Do not normalize each clip to programme loudness, and never call sample peak dBFS true peak dBTP.

## Cue recipes

### Impact

Align the asset's annotated perceptual peak to verified story/picture evidence. Set gain from measured asset loudness/peak, optionally dip music 2–5 dB for 80–250 ms, protect critical speech onsets, and check summed true peak. Missing asset fallback: omit.

### Riser

Align the climax to the reveal. Use onset/peak/tail metadata, reserve headroom for any following impact, and only stretch within the asset's declared range. Otherwise select another licensed asset or omit.

### Record-scratch stop

At a protected phrase/beat boundary: optionally apply 120–350 ms `tape` deceleration; align a scratch asset peak to the visual stop; hold 80–400 ms with intentional room tone; resume with a cut, impact, or ambience. P0 uses scratch cue plus gain/fade automation without pitch ramp. Later adds linked tape-stop retiming.

### Whoosh

Require supporting motion direction or transition intent. Align perceptual peak, not file start, to the cut. Default budget: no more than one prominent transition SFX per three seconds unless the named style overrides it.

## Ordering and deterministic rendering

The compiler topologically sorts by the canonical stage, then target scope, then stable effect ID. Array order is not execution order.

- `audio_repair`: DC/de-click/de-clip/denoise/dereverb.
- `audio_tone`: high-pass, notches, corrective EQ, de-ess.
- `audio_dynamics`: clip compressor/leveler.
- `audio_level`: clip gain, boundary fades, manual rides.
- role buses: dialogue, music, sfx, ambience.
- `bus_mix`: ducking and role-bus balance.
- `master`: programme adjustment and true-peak guard.

Pin sample rate, channel layout, asset hashes, processor/backend versions, evidence, and delivery profile. Sort keyframes by tick and reject conflicting duplicates. Quantize generated boundaries with one documented rounding rule. Canonical equal-power fade: outgoing `cos(pi*x/2)`, incoming `sin(pi*x/2)`. Declare processor latency/tails and compensate parallel paths. Float-process internally; explicitly dither only at delivery. Identical inputs and capabilities must yield identical graph JSON/keyframes. Byte-identical lossy output is only promised for the same encoder build.

If browser preview cannot reproduce offline denoise, sidechain, or stretch, render a short proxy stem or label “structural preview only.” Never audition an unrelated substitute.

## Asset licensing

Every external cue/music/impulse response needs a manifest containing content hash, source URL, creator/title, exact license ID/URL, acquisition time, commercial/modification/synchronization/render-distribution rights, attribution, territory/expiry, and proof artifact.

P0 allowlist: project-owned recordings; explicitly licensed proprietary assets; CC0; and CC BY with generated attribution. Block unknown, NC when commercial status is true/unknown, and ND when the intended use may adapt the asset. CC BY permits commercial adaptation with attribution; CC0 has no conditions; NC/ND add restrictions ([Creative Commons overview](https://creativecommons.org/share-your-work/cclicenses/)). “From Freesound” is not a license: licenses vary per upload, attribution may be required, and user uploads can still be problematic, so preserve the sound page and evidence ([Freesound licensing FAQ](https://freesound.org/help/faq/)). Never use ripped film/game/song audio.

## Current capability mapping

| Desired | Current repository | Honest next step |
|---|---|---|
| representation | `volume?: number`, `effects?: string[]` | typed graph sidecar/document extension; retain legacy only for migration |
| cleanup | strings `noise-reduction`, `compressor` | map known strings to recipe requests; do not claim audible output |
| ducking | `duck-under-dialogue-18db` plus `volume: 0.24` | explicit music-bus automation from audio activity |
| cues | placeholder `score-1`, no rights | require asset catalog/rights preflight |
| retime | implicit linear 1x only | constant linked A/V rate with capability check |
| preview | original `<video>` audio | label source preview; add Web Audio or rendered proxy |
| export | explicitly unimplemented | offline graph lowering before claiming support |
| mutations | generic partial update, silent repair | typed commands, preconditions, atomic proposal commit |

Do not overload `volume` with dB. If a legacy value is known to be linear, migrate with `20*log10(volume)` and preserve provenance.

## P0 vs later

P0: typed registry and buses; rights manifest; boundary fades and dB gain; diagnosis-driven high-pass/EQ; conservative denoise/compression; visible ducking keyframes; licensed impact/riser/scratch/whoosh cues; 0.5–2x constant pitch-preserving linked speed with the narrower automatic speech policy above; FFmpeg offline render; rendered preview stem; two-pass profile loudness/peak QC.

Later: speed ramps/tape stops/reverse/stutter; high-quality independent pitch/formants after licensing; de-ess/dereverb/hum/de-click/de-clip; dynamic EQ/multiband; band-limited ducking/stem separation; convolution/spatial audio; plugin hosting; stem export.

## Acceptance gates

1. Same graph inputs compile to identical effects and automation ticks.
2. Unknown effects/parameters, missing assets/sidechains, invalid rights, stale evidence, and missing backends are structured errors.
3. Cuts are click-free without erasing protected transients or consuming missing handles.
4. Ducking follows audible speech, merges configured gaps, and preserves manual points.
5. Linked retime is sample-accurate at endpoints and preserves pitch when requested.
6. Cue peak alignment survives timeline movement/recompile.
7. Final PCM and encoded derivative report loudness/true peak against the named profile.
8. Preview approximations/bypasses are disclosed.
9. Every external asset has rights and attribution records.
10. Every audible result traces to source, recipe, parameters, automation, evidence, rights, measurements, and revision.
