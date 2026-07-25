# Visual and temporal effects system

Status: implementation design for the hackathon. This document covers retiming, freeze frames, transforms, blur, color, shake, and picture transitions. Audio sweetening is a separate design, but retiming includes the minimum audio policy needed to keep picture and sound coherent.

## Recommendation

Effects should be typed, bounded, deterministic graph nodes—not strings interpreted differently by the planner, preview, and export paths.

```text
EditScript recipe
  -> EffectIntent (editorial purpose and bounded controls)
  -> capability negotiation and prerequisite checks
  -> EffectInstance graph (exact target, interval, parameters, keyframes)
  -> preview binding or disclosed proxy
  -> render binding
  -> frame/audio QC
```

The model may request `emphasize this phrase with a restrained punch-in`. It should not write CSS, WebGL, or FFmpeg expressions. A closed effect registry resolves that request to a versioned definition. The compiler owns duration math, source handles, graph order, parameter bounds, deterministic seeds, fallbacks, and renderer lowering.

For P0, a small set of effects executed reliably will make the editor feel much more capable than a long list of labels that do not preview or render. Ship constant speed, freeze, punch-in/slow push, deterministic shake, Gaussian blur, a basic grade, cross-dissolve, and dip-to-color first.

## What exists today

The current application is an assembly preview, not yet an effects engine:

- `TimelineElement.effects?: string[]` carries untyped names without parameters, versions, intervals, keyframes, or ordering.
- Analysis may emit `vertical_reframe`, `slow_push`, `punch_in`, `contrast_grade`, `grain`, `vignette`, `rgb_split`, `three_panel`, and `raw_cut`; transitions may be `hard_cut`, `beat_cut`, `white_flash`, `rgb_split`, `glitch`, or `record_scratch`.
- `timelineFromAnalysis` copies those strings onto primary clips and sometimes creates a short duplicate video on `v2`. No effect is actually evaluated.
- `PreviewMonitor` selects a primary clip, maps composition time to `sourceStart + localTime`, and plays the source `<video>`. It does not apply playback rate, source-time curves, transforms, filters, or transition overlap.
- The preview uses `object-fit: cover`, which is a useful temporary vertical reframe but has no stored crop, anchor, or subject-safe guarantee.
- `@ffmpeg/ffmpeg` exists in the project, but is used only to extract analysis audio. There is no picture export filter graph.
- Timeline operations can update whole elements, but cannot attach a typed effect, keyframe a property, add a transition, or atomically retime linked picture/audio.

Therefore every current effect label must be shown as `planned / not rendered` until a binding exists. The UI must never imply that the visible preview contains an effect which export will add later without an explicit proxy/finality badge.

## The contract

### Effect definition

Definitions live in a closed, versioned registry. A definition describes semantics, not one renderer's syntax.

```ts
type EffectStage =
  | "time_map"
  | "source_correction"
  | "geometry"
  | "spatial_filter"
  | "color"
  | "stylize"
  | "boundary_transition"
  | "composite";

type EffectTarget =
  | { kind: "element"; elementId: string }
  | { kind: "boundary"; outgoingId: string; incomingId: string }
  | { kind: "adjustment"; trackId: string; elementIds: string[] };

interface EffectDefinition {
  id: string;                  // e.g. "transform.punch_in"
  version: number;
  stage: EffectStage;
  targetKinds: EffectTarget["kind"][];
  parameterSchemaId: string;
  prerequisites: string[];     // closed checker IDs
  conflicts: string[];         // effect or exclusive-slot IDs
  previewBindings: string[];
  renderBindings: string[];
  fallbackEffectIds: string[];
  attentionCost: number;
  reducedMotionSubstitute?: string;
}
```

### Effect instance

An instance is immutable proposal data and contains all values needed to reproduce it.

```ts
type Frame = number; // non-negative safe integer in composition frame space

type ScalarCurve = {
  defaultValue: number;
  keyframes: Array<{
    frame: Frame;
    value: number;
    interpolation: "hold" | "linear" | "ease_in" | "ease_out" |
                   "ease_in_out" | "cubic_bezier";
    bezier?: [number, number, number, number];
  }>;
  before: "hold";
  after: "hold";
};

interface EffectInstance<P> {
  id: string;                  // stable hash of logical path, not a random UUID
  definition: { id: string; version: number; contentHash: string };
  target: EffectTarget;
  range: { space: "composition"; startFrame: Frame; durationFrames: number };
  parameters: P;
  seed?: string;
  graph: { stage: EffectStage; after: string[] };
  binding: {
    preview: { id: string; fidelity: "exact" | "proxy" | "none" };
    render: { id: string; fidelity: "exact" | "approximate" };
  };
  fallbacksTaken: Array<{ reason: string; from: string; to: string }>;
}
```

Do not put arbitrary expressions in parameters. Curves, easing, noise, tracking references, and blend modes come from closed schemas. This keeps scripts safe and makes validation, hashing, migration, and multi-renderer parity possible.

### Time and source mapping

Effect intervals and keyframes use integer output frames. Source media uses rational ticks. Conversion happens once at the compiler boundary with an explicit rounding policy. Frame intervals are half-open: `[startFrame, startFrame + durationFrames)`.

Retiming is special. It owns a monotonic source-time map rather than a visual property:

```ts
interface TimeMap {
  points: Array<{
    compositionFrame: Frame;
    sourceTick: number;
  }>;
  interpolation: "linear_speed"; // P0; optical-flow curves are later
  audioPolicy: "mute" | "linked_resample" | "linked_pitch_preserve" | "detach";
}
```

For each segment, speed is the source-time delta divided by composition-time delta. Source ticks must never decrease in P0. A freeze is represented by a dedicated freeze node, not a zero-slope speed segment, so duration insertion and audio treatment remain explicit.

## Deterministic animation

Preview and export must produce the same property value for a given revision, instance, and frame.

1. Sort keyframes by frame and reject duplicates. Values and Bézier controls must be finite and within the definition's hard bounds.
2. Clamp outside the first and last keyframe; never extrapolate by default. Remotion's interpolation documentation illustrates why explicit clamping matters and also distinguishes ordinary numeric scale from perceptual-area scale: [Remotion `interpolate()`](https://www.remotion.dev/docs/interpolate).
3. Evaluate in composition-frame space. Pausing, seeking, preview frame drops, and render parallelism must not alter a value.
4. Use named easing functions or a bounded cubic Bézier. Do not accept executable easing callbacks.
5. Quantize serialized floats to six decimal places and renderer inputs to the target's supported precision. Never repeatedly integrate frame-to-frame deltas; calculate from the absolute frame.
6. Any noise uses `seed = hash(revisionHash, instanceId, channel)` and `sample = PRNG(seed, absoluteFrame or bucket)`. The same seed must always give the same value, following the reproducibility property described by [Remotion's seeded `random()`](https://www.remotion.dev/docs/random). Never use `Math.random()`.
7. A tracked anchor references a frozen tracking artifact hash. Changing tracking creates a new effect proposal; it cannot silently move an approved effect.

An implementation-neutral evaluator is:

```ts
function valueAt(curve: ScalarCurve, frame: Frame): number {
  // Binary-search bounding keyframes.
  // Hold before/after the curve.
  // Normalize t from absolute integer frames.
  // Apply the registered easing to t.
  // Interpolate endpoints and clamp to the parameter bounds.
}
```

Golden tests should sample the first, middle, and last active frames, every keyframe, one frame on either side of each keyframe, and frames outside the interval.

## Composition order

Ordering is semantic. The default picture graph is:

```text
decode / orientation / cadence conform
  -> retime or freeze
  -> source correction and stabilization
  -> subject tracking artifact
  -> reframe / crop
  -> local transform (push, punch, shake)
  -> spatial filter (blur, sharpen)
  -> per-shot technical color correction
  -> stylization (vignette, grain, RGB split)
  -> transition composite of adjacent prepared clips
  -> scene/section creative grade
  -> captions and information graphics
  -> decorative overlays
  -> output color transform / scale / encode
```

Rules:

- Retime precedes all frame-local effects because it decides which source frame exists at each composition frame.
- Stabilization precedes intentional shake. Otherwise stabilization may cancel the effect.
- Reframe and transform precede blur so no unblurred crop border is pulled into view. They also precede vignette so the vignette stays attached to the output frame.
- A local clip grade normally occurs before a transition; a section look normally occurs after it. This avoids mismatched exposure within a dissolve while keeping a scene-wide look continuous.
- Captions and factual graphics are outside the creative picture grade by default to preserve contrast and brand color.
- A boundary transition reads both adjacent prepared clips. It is never just an array item on the outgoing clip.
- Only one primary transition may own a boundary. A flash overlay may coexist only if a registered composite recipe declares that relationship and passes the flash budget.
- Two nodes that write the same exclusive property (`time_map`, primary crop, or primary boundary transition) conflict unless a composite definition explicitly merges them.

The compiler unions dependency edges and topologically sorts the graph. A cycle or ambiguous exclusive write is a blocking diagnostic.

## Effect catalog

The defaults below are product guardrails, not claims of universal editing taste. Style maps may narrow them but should not exceed hard safety and source-quality limits without review.

### `time.constant_speed` — P0

Purpose: compress low-information action, extend a reaction, or sharpen pacing.

```ts
interface ConstantSpeedParams {
  rate: number; // picture 0.5..4.0; pitch-preserved audio 0.5..2.0
  frameSampling: "nearest" | "blend";
  audioPolicy: "mute" | "linked_resample" | "linked_pitch_preserve" | "detach";
}
```

Prerequisites: exact source range and duration; output duration of at least two frames; linked audio state known; enough source frames; complete required speech/action after mapping. Automatic edits of intelligible dialogue stay within `0.85..1.25`; wider changes require explicit review, and linked pitch-preserved audio is limited to `0.5..2.0` in P0. Rates above that require muting or detaching production audio.

Duration is `sourceDuration / rate`, rounded once according to the project frame policy. FFmpeg implements basic picture retiming by changing presentation timestamps; its official examples use `setpts=0.5*PTS` for fast motion and `setpts=2.0*PTS` for slow motion: [FFmpeg `setpts`](https://ffmpeg.org/ffmpeg-filters.html#setpts_002c-asetpts). That renderer detail must stay inside the binding.

Fallback: clamp to the nearest supported reviewed rate -> use nearest-frame sampling -> keep original speed. Never silently change edit duration without rescheduling downstream items.

### `time.speed_ramp` — stretch goal after the P0 constant-rate seam

Purpose: accelerate into an action or create a controlled emphasis without a visible cut.

```ts
interface SpeedRampParams {
  points: Array<{ compositionFrame: Frame; rate: number }>;
  interpolation: "linear_rate";
  frameSampling: "nearest" | "blend" | "motion_interpolated";
  audioPolicy: "mute" | "linked_pitch_preserve" | "detach";
}
```

The first stretch implementation supports two or three points, rates `0.5..4.0`, no reversal, and nearest/blend sampling. The compiler integrates the rate curve deterministically to calculate source consumption, then either adjusts the composition duration or rejects the ramp if the pinned duration cannot consume the exact range. It must not independently interpolate source and composition endpoints and hope they agree.

Motion-interpolated slow motion is later because it needs neighboring frames, greater compute, and artifact review. FFmpeg's `minterpolate` explicitly creates frame-rate conversion using motion interpolation and can also duplicate or blend frames: [FFmpeg `minterpolate`](https://ffmpeg.org/ffmpeg-filters.html#minterpolate). Mark it `final_only` unless the preview can run the same algorithm.

Fallback: motion interpolation -> blend -> nearest -> constant speed -> original speed. A fallback may change quality, not timing; if timing changes, recompile the schedule.

### `time.freeze` — P0

Purpose: hold a decisive expression/frame while text or narration lands.

```ts
interface FreezeParams {
  sourceTick: number;
  durationFrames: number; // default 18 at 30 fps; hard range 2..90
  audioPolicy: "continue_detached" | "room_tone" | "mute";
  entry: "cut" | "one_frame_blend";
  exit: "cut" | "one_frame_blend";
}
```

Prerequisites: the frozen frame decodes successfully; the source tick is within the clip; the frame is not a corrupted/interlaced partial image; the inserted duration can ripple or the surrounding interval is explicitly replaced. The compiler extracts one exact source frame and repeats it; it does not rely on the browser remaining paused. FFmpeg exposes frame replacement directly through `freezeframes`: [FFmpeg `freezeframes`](https://ffmpeg.org/ffmpeg-filters.html#freezeframes).

Fallback: nearest valid frame -> shorten hold -> omit. If dialogue continues, the freeze must be editorially intentional and reviewed for lip-sync expectations.

### `transform.punch_in` and `transform.slow_push` — P0

Purpose: create emphasis or visual progression from one shot without changing source time.

```ts
interface TransformParams {
  scale: ScalarCurve;          // normalized; 1 is fitted baseline
  positionX: ScalarCurve;      // normalized composition coordinates, -1..1
  positionY: ScalarCurve;
  rotationDegrees?: ScalarCurve;
  anchor:
    | { kind: "fixed"; x: number; y: number } // normalized source coordinates
    | { kind: "track"; artifactId: string; subjectId: string; artifactHash: string };
  cropPolicy: "cover" | "contain";
  edgePolicy: "crop" | "mirror" | "solid";
}
```

`punch_in` is normally a 4–8 frame ease from 1.0 to `1.08..1.15`, followed by a hold. `slow_push` normally moves over most of a shot to `1.04..1.12`. P0 hard maximum is 1.20 unless a resolution check explicitly approves more. Rotation defaults to zero and is limited to ±2 degrees for ordinary presets.

Prerequisites: source resolution after crop is sufficient for delivery; anchor is inside the visible source; crop covers the full output at every sampled keyframe; face/text safe regions are not cut. A fixed center anchor is valid when tracking is unavailable but must be disclosed. FFmpeg's official `zoompan` interface validates the basic conceptual controls—zoom, x/y position, duration, output size, and frame rate: [FFmpeg `zoompan`](https://ffmpeg.org/ffmpeg-filters.html#zoompan).

Fallback: tracked anchor -> fixed analyzed anchor -> center; reduce scale -> static crop -> omit. Never invent tracking coordinates.

### `transform.shake` — P0 with one preset

Purpose: a short impact accent, not a continuous texture.

```ts
interface ShakeParams {
  amplitudeX: ScalarCurve;     // pixels at delivery resolution; hard max 32
  amplitudeY: ScalarCurve;     // hard max 32
  rotationAmplitude: ScalarCurve; // degrees; hard max 2.5
  frequencyHz: number;         // 2..18
  damping: ScalarCurve;        // 0..1 envelope
  sampleHoldFrames: number;    // 1..4
  seed: string;
  edgePolicy: "overscan_crop" | "mirror";
}
```

Generate independent deterministic noise channels, apply the absolute-frame sample-and-hold, low-pass to the requested frequency, multiply by the damping envelope, then clamp. The binding must overscan by the maximum displacement so black borders never appear. P0 ships one `impact_shake` preset: 6–10 frames, fast decay, maximum 18 px translation and 1.2° rotation at 1080×1920. Scale amplitudes with output dimensions.

Prerequisites: motion/attention budget; no active stabilization after this node; overscan can preserve acceptable resolution; no critical caption/graphic is inside the shaken picture group. Shake never moves accessibility-critical captions by default.

Fallback: lower amplitude -> transform-free two-frame blur/brightness accent -> cut-only emphasis -> omit. A project-wide reduced-motion mode substitutes the transform-free accent or omits it.

### `filter.gaussian_blur` — P0

Purpose: de-emphasize a background, create a transition accent, or support text legibility. Privacy redaction requires a separate tracked-redaction effect and must not reuse this decorative definition.

```ts
interface BlurParams {
  radiusPx: ScalarCurve;       // 0..40 at 1080-wide output
  quality: "preview" | "final";
  region: "full_frame" | { maskArtifactId: string; artifactHash: string };
  edgePolicy: "clamp" | "mirror";
}
```

P0 supports full-frame blur only. Radius scales with output width. Apply after reframe/transform and before captions. A masked blur is later because mask tracking and feather behavior must be frozen and reviewable.

Prerequisites: supported preview and render binding; sufficient edge policy; mask artifact for regional blur. Fallback: lower-radius proxy -> translucent color wash for text backing -> omit. Decorative blur must never be presented as secure anonymization.

### `color.basic_grade` — P0

Purpose: technical consistency and a restrained creative look.

```ts
interface BasicGradeParams {
  exposureStops: number;  // -2..2, preset default range -0.5..0.5
  contrast: number;       // 0.5..1.5, preset default 0.85..1.2
  saturation: number;     // 0..2, preset default 0.75..1.25
  temperature: number;    // normalized -1..1
  tint: number;           // normalized -1..1
  fade: number;           // 0..0.3
  vignette?: { amount: number; midpoint: number; feather: number };
  workingSpace: "scene_linear" | "display_referred_srgb";
}
```

P0 should use one declared display-referred pipeline consistently, record source color metadata, and avoid pretending to be a color-managed finishing suite. Technical shot matching and a creative section grade are separate instances. The render binding can lower to documented FFmpeg filters such as exposure, color balance, curves, and colorspace, all listed in the [official FFmpeg filter documentation](https://ffmpeg.org/ffmpeg-filters.html).

Prerequisites: known or explicitly assumed input transfer/range; no clipped output beyond warning thresholds; skin-tone and brand-color review where applicable. Fallback: remove creative look -> retain technical exposure/contrast only -> identity transform. Unknown HDR/wide-gamut input blocks a final P0 export unless it is explicitly converted or reviewed.

### `transition.cross_dissolve` and `transition.dip_to_color` — P0

Purpose: signal a gentle continuity change or a stronger section break.

```ts
interface TransitionParams {
  durationFrames: number;      // P0 default 6; hard range 2..18 at 30 fps
  inOffsetFrames: number;
  outOffsetFrames: number;
  alignment: "center" | "start_at_cut" | "end_at_cut";
  easing: "linear" | "ease_in_out";
  color?: "#000000" | "#FFFFFF";
}
```

A transition owns the boundary and reads both clips. It requires sufficient unused source handles on each side; displayed clip duration is not proof of handle availability. OpenTimelineIO represents this with separate in/out offsets and notes both structural limits and the possibility that available media is still too short: [OTIO timeline transitions](https://opentimelineio.readthedocs.io/en/latest/tutorials/otio-timeline-structure.html#transitions). The compiler must perform the stricter available-media check.

Both inputs are conformed to the same frame rate, dimensions, pixel format, and timebase before render. Those are explicit requirements of FFmpeg's `xfade`: [FFmpeg `xfade`](https://ffmpeg.org/ffmpeg-filters.html#xfade). The internal model remains renderer-neutral.

No transition may be longer than either adjacent visible sequence, two primary transitions may not be adjacent, and the boundary slot cannot simultaneously hold an unrelated overlay. These executable invariants also match the documented [Remotion `TransitionSeries` rules](https://www.remotion.dev/docs/transitions/transitionseries#rules).

Fallback: shorten symmetrically -> use asymmetric offsets if alignment permits -> dip-to-color -> hard cut with optional audio bridge. Do not duplicate the outgoing last frame or incoming first frame to fake missing handles without an explicit freeze-frame treatment.

### Later effects

The following are valuable only after P0 graph, preview, and QC contracts work:

- tracked reframe, face-safe crop, and privacy blur;
- optical-flow slow motion and motion blur;
- whip/slide/zoom transitions with directional motion matching;
- RGB split, glitch, chromatic aberration, film grain, halation, and lens distortion;
- masks, rotoscoping, compositing blend modes, and depth-aware effects;
- LUT import and fully color-managed HDR workflows;
- stabilization analysis and rolling-shutter repair;
- reverse time, boomerang, temporal echo, and frame blending across cuts.

Every later temporal effect must declare its required head/tail frame radius. It cannot read across a cut unless the definition explicitly owns that boundary.

## Capability negotiation and fallbacks

Each runtime publishes a hashed manifest:

```ts
interface EffectCapability {
  definitionId: string;
  versions: number[];
  parameterSubset: Record<string, unknown>;
  maxWidth: number;
  maxFps: number;
  colorSpaces: string[];
  temporalRadiusFrames: { head: number; tail: number };
  deterministic: boolean;
  fidelity: "exact" | "approximate" | "proxy";
  cost: "realtime" | "degraded_realtime" | "final_only";
}
```

The compiler resolves capabilities before emitting a proposal. It records the exact preview and render bindings and any fidelity gap. Fallbacks are definition data, tried in declared order, and produce diagnostics. They are never silent.

General fallback ladder:

1. preserve timing and intent with a cheaper exact binding;
2. reduce bounded intensity, resolution, or sample quality;
3. substitute the registered lower-motion/lower-compute effect;
4. use structural emphasis such as a clean cut or static crop;
5. omit an optional effect;
6. block if the effect is required or timing would change without recompilation.

A preview proxy may reduce blur kernel size, sample a shake every two frames, use frame blending instead of optical flow, or show an ungraded proxy. It may not change transition duration, source selection, crop safety, or keyframe timing.

## P0 delivery plan

| Phase | Build | Why |
|---|---|---|
| 1 | typed effect registry, `EffectInstance`, curve evaluator, manifest, diagnostics | creates one contract for planner/compiler/UI/render |
| 2 | preview bindings for punch/slow push, shake, blur, and basic grade | immediate visible impact without timeline-duration changes |
| 3 | constant speed and freeze with linked audio policy and atomic rescheduling | establishes correct source/composition mapping |
| 4 | explicit boundary model plus dissolve/dip and handle validation | transitions cannot be represented safely by current strings |
| 5 | FFmpeg render-plan lowering and golden frame tests | makes export reproducible and comparable with preview |
| 6 | effect controls, presets, reduced-motion toggle, and effect-budget UI | makes the system usable rather than agent-only |

Suggested P0 registry IDs:

```text
time.constant_speed@1
time.freeze@1
time.speed_ramp@1            // stretch goal; limited mode
transform.punch_in@1
transform.slow_push@1
transform.impact_shake@1
filter.gaussian_blur@1
color.basic_grade@1
transition.cross_dissolve@1
transition.dip_to_color@1
```

Current labels migrate as follows:

| Current label | Typed P0 result | Note |
|---|---|---|
| `slow_push` | `transform.slow_push@1` | compile preset to explicit scale/position curves |
| `punch_in` | `transform.punch_in@1` | remove the duplicated `v2` accent workaround |
| `vertical_reframe` | static `TransformParams` crop | tracked anchor later |
| `contrast_grade` | `color.basic_grade@1` | explicit values and working-space assumption |
| `vignette` | nested basic-grade vignette | split into separate filter later if necessary |
| `raw_cut` | no visual effect | editorial metadata, not a renderer node |
| `grain` | unsupported P0 | warn and omit; add deterministic seeded grain later |
| `rgb_split` | unsupported P0 | substitute short blur/transform accent or hard cut |
| `three_panel` | unsupported P0 layout recipe | not a clip-local effect |
| `hard_cut`, `beat_cut` | boundary metadata, no picture effect | beat alignment is timing intent |
| `white_flash` | `dip_to_color` only if flash QC passes | otherwise dissolve/hard cut |
| `glitch`, `record_scratch` | composite recipes later | record scratch also needs an audio definition |

## Validation, safety, and QC

### Compile-time checks

- all IDs, versions, parameters, units, ranges, and curve values validate;
- targets exist in the named base revision and are not locked;
- effect range is inside its target except for an explicit boundary overlap;
- time maps are monotonic, exactly consume their source range, and agree with scheduled duration;
- linked picture/audio retimes are atomic and carry a declared audio policy;
- transforms cover the output frame and meet resolution/safe-region thresholds;
- transition handles and conformed stream properties are sufficient;
- graph is acyclic and contains no conflicting exclusive writes;
- preview/export capabilities and fidelity gap are known;
- rolling attention, motion, full-frame, and flash budgets pass.

### Render checks

Render the first, middle, and last frame of every effect; every keyframe and neighboring frame; both sides and midpoint of each transition; and the full audio/picture boundary for retimes. Detect black edges, unexpected transparent pixels, frozen or duplicated frames, jumps, color discontinuities, clipped values, caption obstruction, flash events, duration drift, and A/V sync drift.

Hash representative decoded output frames in a normalized pixel format. Exact CPU bindings can use tight hashes; GPU/codec variants need bounded perceptual metrics. A keyframe-value trace should accompany failures so the problem can be distinguished from encode variation.

### Motion and flashing

Provide project preferences `motion: full | reduced` and `flash: prohibited | checked`. Reduced motion substitutes or disables shake, whip, large rapid zoom, and other nonessential movement while preserving editorial timing.

As a conservative automated rule, prohibit any full-frame flash sequence exceeding three flashes in a one-second window, then run luminance/red-flash analysis on final output. WCAG 2.2 requires content either not flash more than three times per second or remain below defined thresholds: [W3C WCAG 2.3.1](https://www.w3.org/TR/WCAG22/#three-flashes-or-below-threshold). W3C also recommends supporting reduced-motion preferences because unnecessary movement can cause vestibular symptoms: [Understanding animation from interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html). Although those criteria target web content, they are appropriate product safety guardrails for generated social video.

## Acceptance criteria

The effect system is ready for P0 only when:

1. The same revision and frame always produce the same evaluated parameters and source frame.
2. Preview shows every proposed P0 effect exactly or clearly labels its proxy/final-only state.
3. Reordering unrelated effect instances cannot change graph semantics or generated IDs.
4. Constant-speed, freeze, and ramp operations update duration and linked audio atomically.
5. No transform exposes an edge or violates its crop-resolution threshold.
6. No transition compiles without explicit adjacency, offsets, and real source handles.
7. Unsupported current effect strings produce visible migration diagnostics, not no-ops.
8. Reduced-motion and flash policies deterministically substitute or block unsafe effects.
9. Removing an effect restores the underlying timeline without cumulative rounding drift.
10. A reviewer can trace any rendered effect to its recipe, registry version, parameters, keyframes, seed, fallback decisions, and base revision.

## Deliberate non-goals for the hackathon

- arbitrary user shaders, scripts, or FFmpeg filter strings;
- third-party plug-in hosting;
- full After Effects-style nesting and masking;
- perfect real-time parity for optical flow or heavy temporal denoise;
- secure anonymization from a decorative blur;
- automatic high-intensity effects solely because a model assigned high `energy`;
- baking effects destructively into source assets.

The highest-leverage implementation is not another effect preset. It is the typed registry plus deterministic curve evaluator and one complete vertical slice—`transform.punch_in@1` from script intent through preview, render plan, diagnostics, removal, and golden-frame test. Once that contract is real, the rest of the P0 catalog becomes controlled expansion rather than a collection of one-off behaviors.
