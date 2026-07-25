# Effects system

Status: implementation design for the hackathon  
Date: 2026-07-25  
Audience: the app implementation agent

## Recommendation

Build effects as a typed, deterministic render layer that sits after story assembly but before preview/export:

```text
accepted timeline revision
  -> resolve effect recipes and anchors
  -> validate capabilities, budgets, ranges, and handles
  -> evaluate time maps and keyframes
  -> RenderPlan
       -> interactive browser preview (exact where possible, labeled approximation otherwise)
       -> FFmpeg export filtergraph
  -> audiovisual QC
```

Do not expand the current `effects?: string[]` convention. It can remain a migration input, but executable effects need versioned definitions, typed parameters, stable instance IDs, explicit ordering, and declared preview/export implementations.

The first useful product slice is not a giant effects library. It is a small registry whose five or six effects visibly work in both preview and export: constant speed, push/punch transform, short deterministic shake, basic color, blur, gain/fades, and dialogue ducking.

## Why effects need separate semantics

The word “effect” currently hides five different kinds of operation:

| Kind | Example | What it changes | Correct owner |
|---|---|---|---|
| Time map | speed up, slow down, freeze, reverse | source-to-composition mapping and duration | timeline/compiler |
| Clip visual | zoom, position, rotation, blur, color | pixels inside one placed item | effect stack |
| Boundary transition | crossfade, flash, whip, glitch | relationship and handles between two items | transition object |
| Audio processing | EQ, compression, gain, fades | samples or mix buses | audio graph |
| Generated element | impact SFX, grain plate, title, freeze frame | creates or places media | recipe producing timeline elements |

A speed change cannot be a cosmetic string. At constant rate `r`, an input source duration of `d` occupies `d / r` composition time. It also changes caption timing, linked audio, downstream placement, transition handles, and total duration. Likewise, ducking reads a dialogue bus and changes a music bus; it is not an isolated property of one clip.

## Current project reality

The app is a good visual prototype, but its displayed effect names are not executed:

- `TimelineElement.effects` is an untyped `string[]` with no parameters or time ranges.
- `PreviewMonitor` plays only the active primary `<video>` linearly and does not evaluate the active clip's effects.
- the preview always draws a CSS vignette, regardless of timeline intent;
- source time is currently `sourceStart + compositionOffset`, so speed changes cannot preview correctly;
- there is no render/export implementation yet, although both FFmpeg WASM and `ffmpeg-static` are installed;
- the analysis schema emits names such as `slow_push`, `punch_in`, `contrast_grade`, `rgb_split`, and `glitch`, but the names have no executable contract;
- audio cleanup and ducking are labels, not a signal graph.

This means the immediate job is to establish an effect contract and one evaluator, not add more names.

## Typed effect contract

Use integer composition frames for automation. Source timing remains explicit in source frames/ticks.

```ts
type EffectDomain = "time" | "video" | "audio" | "transition" | "mix";
type EffectStage =
  | "time_map"
  | "source_correction"
  | "geometry"
  | "spatial_filter"
  | "color"
  | "stylize"
  | "boundary_transition"
  | "composite"
  | "audio_repair"
  | "audio_tone"
  | "audio_dynamics"
  | "audio_level"
  | "bus_mix"
  | "master";

type Keyframe<T> = {
  frame: number; // local composition frame, integer and half-open
  value: T;
  easing: "hold" | "linear" | "ease_in" | "ease_out" | "ease_in_out";
};

interface EffectInstance {
  id: string; // content-derived from target + recipe path
  definition: { id: string; version: number };
  enabled: boolean;
  target: { elementId?: string; boundaryId?: string; busId?: string };
  localRange: { startFrame: number; durationFrames: number };
  parameters: Record<string, unknown>;
  automation?: Record<string, Keyframe<unknown>[]>;
  motivation:
    | "direct_attention"
    | "emphasize_phrase"
    | "increase_energy"
    | "mask_discontinuity"
    | "establish_tone"
    | "release_tension"
    | "improve_intelligibility"
    | "meet_delivery";
  anchor?: { eventId?: string; wordIds?: string[]; markerId?: string };
  fallback: { definitionId?: string; action: "substitute" | "omit" | "block" };
}

interface EffectDefinition {
  id: string;
  version: number;
  domain: EffectDomain;
  stage: EffectStage;
  accepts: Array<"video" | "image" | "text" | "caption" | "audio" | "boundary" | "bus">;
  parameterSchema: unknown; // Zod in implementation
  reads: string[];
  writes: string[];
  prerequisites: string[];
  cost: { motion: number; attention: number; render: number };
  preview: { support: "exact" | "approximate" | "unsupported"; adapter: string };
  export: { support: "exact" | "unsupported"; adapter: string };
}
```

This is the minimum shared contract. The visual/temporal and audio companion documents refine targets, bindings, and parameters, but their persisted forms should normalize to these domains and stages rather than introduce a second runtime model.

The registry—not a model prompt—defines valid parameter ranges, defaults, ordering stage, render adapters, capability requirements, cost, and fallback behavior. Unknown IDs or parameters block compilation.

Keyframes are deterministic data. A model may request “subtle shake on this word,” but a versioned recipe expands it to exact transform keyframes before proposal review.

## Time maps

Time effects get a first-class contract because they affect editorial structure:

```ts
interface TimeMap {
  id: string;
  elementId: string;
  segments: Array<{
    composition: { startFrame: number; durationFrames: number };
    source: { startTick: number; durationTicks: number; ticksPerSecond: number };
    interpolation: "hold" | "linear";
    preservePitch: boolean;
  }>;
}
```

For constant speed, one segment is enough. For a ramp, store piecewise mapping segments whose boundaries and accumulated source positions are already resolved; do not ask preview and export to integrate separate free-form curves.

Rules:

1. time mapping runs before every visual or audio effect;
2. video and linked production audio share the same mapping unless the script explicitly detaches them;
3. caption and transcript anchors map through the same function;
4. changing a time map reschedules downstream composition placement and invalidates boundary handles;
5. speech defaults to pitch preservation and a conservative supported rate window;
6. very fast montage video may mute/detach production audio and use a declared music/SFX treatment;
7. reverse and optical-flow interpolation are out of scope for P0.

Browser preview can set `HTMLMediaElement.playbackRate`; browsers correct pitch by default, but behavior and useful audio ranges vary, so supported bounds must be capability-tested ([MDN playbackRate](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate)). FFmpeg export can use `setpts` for video and `atempo`/audio timestamp filters for audio; exact available filters should come from the installed binary's capability probe ([FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html)).

## Visual evaluation order

Effect order must be stable. Use stage order, then explicit instance order inside a stage:

```text
decode and time map
  -> orientation / source normalization
  -> crop and focal reframe
  -> transform animation (scale, position, rotation, shake)
  -> spatial processing (blur, sharpen)
  -> color correction / look
  -> stylization (grain, vignette, RGB split)
  -> transition compositing
  -> titles, captions, and graphic overlays
  -> output colorspace / scale / encode
```

This prevents a model from accidentally blurring captions, grading a brand graphic, or applying shake before the overscan crop. Recipes may expose a friendly compound effect such as `punch_in`, but expansion uses these primitive stages.

### Transform coordinate system

Store transform values in normalized output coordinates so preview and export do not depend on source resolution:

```ts
interface TransformValue {
  scale: number;      // 1 = fitted base frame
  x: number;          // -1..1 relative output width
  y: number;          // -1..1 relative output height
  rotationDeg: number;
  anchorX: number;    // 0..1 in source image
  anchorY: number;    // 0..1 in source image
}
```

Every animated transform needs an overscan validator. Shake or rotation that would reveal empty pixels is shortened, reduced through a declared fallback, or blocked. Focal anchors should be frozen into the proposal rather than rerunning face detection during render.

### Deterministic shake

Never call `Math.random()` per frame. `transform.shake@1` expands from a content-derived seed into exact keyframes. P0 should use a short, authored impulse pattern rather than procedural noise:

```text
frame offsets: 0, 1, 3, 5, 8, 12
amplitude:     0, +1, -0.7, +0.45, -0.2, 0
```

Apply the pattern to bounded X/Y/rotation values, with scale overscan. A regenerated proposal with the same inputs is byte-identical.

## Audio evaluation order

Use explicit buses: `dialogue`, `music`, `sfx`, then `master`.

```text
source decode and time map
  -> repair (denoise/declick, if supported)
  -> high-pass / corrective EQ
  -> de-esser (later)
  -> clip compression
  -> clip gain and fades
  -> dialogue/music/SFX buses
  -> sidechain ducking on music from dialogue activity
  -> bus gain
  -> master loudness and true-peak protection
  -> encode
```

Impacts, risers, record scratches, and music drops are placed audio elements with licensed/original asset provenance. They are not magic filter names. Ducking is deterministic volume automation or a sidechain processor on the music bus. The effect proposal must show what triggered it and the reduction applied.

Browser preview can use Web Audio nodes for a useful approximation of EQ, compression, gain, and automation; `DynamicsCompressorNode` is broadly available ([MDN Web Audio compressor](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/createDynamicsCompressor)). Export uses a probed FFmpeg audio filter graph. Loudness normalization and limiting are delivery/master operations, not per-dialogue-clip decorations.

## Render plan and adapters

Compile the accepted timeline and effects into a renderer-neutral `RenderPlan`:

```ts
interface RenderPlan {
  revisionId: string;
  width: number;
  height: number;
  fps: number;
  durationFrames: number;
  visualLayers: RenderLayer[];
  audioBuses: AudioBusPlan[];
  diagnostics: RenderDiagnostic[];
  dependencyHashes: {
    registry: string;
    assets: string;
    capabilities: string;
  };
}
```

Two adapters consume the same evaluated values:

- **Interactive browser preview:** `<video>` time mapping, CSS transforms/filters for the P0 visual subset, and Web Audio for basic mixing. It favors responsiveness.
- **Export:** server/worker FFmpeg using `ffmpeg-static`; use FFmpeg WASM only when client-side export is a product requirement. It favors deterministic encoded output.

Every effect definition declares preview fidelity:

- `exact`: evaluated parameter values and expected appearance match closely;
- `approximate`: timing is correct but pixel/audio output differs; show an `≈` badge;
- `unsupported`: show structural state and request a short rendered preview.

For effects where CSS and FFmpeg differ materially, the approval-grade preview is a cached rendered range produced from the export plan. Never imply pixel parity when there is none.

Before building a filtergraph, probe the installed FFmpeg binary and hash its version, filters, encoders, and hardware capabilities into the proposal. The official FFmpeg filter documentation covers the relevant timing, transform, blur, color, compositing, dynamics, and loudness primitives, but the local build remains authoritative ([FFmpeg filter documentation](https://ffmpeg.org/ffmpeg-filters.html)).

## P0 registry

Start with a deliberately small vocabulary:

| Definition | Parameters | Bounds / policy | Preview | Export |
|---|---|---|---|---|
| `time.constant_rate@1` | `rate`, `preservePitch`, audio policy | automatic speech 0.85–1.25; pitch-preserved audio 0.5–2.0; detached/muted visual montage 0.5–4.0 | media playback rate | `setpts` + audio tempo |
| `time.freeze@1` | source frame, duration, audio policy | explicit duration insertion; 2–90 frames | repeated extracted frame | freeze-frame filter/loop |
| `transform.push@1` | start/end scale, focal anchor | 1.0–1.12; full-beat, smooth | CSS transform | scale/crop expressions |
| `transform.punch@1` | peak scale, attack/settle frames, anchor | peak <= 1.18; 4–18 frames | CSS transform | scale/crop expressions |
| `transform.shake@1` | intensity, duration, axis mix | <= 12 frames by default; overscan required | CSS keyframes | deterministic transform expressions |
| `filter.blur@1` | radius, in/out keyframes | full-frame only P0; radius 0–20 | CSS blur approximation | Gaussian blur |
| `color.basic@1` | exposure/brightness, contrast, saturation, warmth | conservative bounded values | CSS approximation | basic color filters |
| `look.vignette@1` | amount, softness | never hard-coded globally | CSS overlay approximation | vignette filter |
| `audio.gain_fade@1` | gain dB, fade-in/out frames | no clipping at output | Web Audio gain | volume/fade filters |
| `audio.dialogue_chain@1` | high-pass, compressor preset | preset registry, no arbitrary filter string | Web Audio approximation | EQ/dynamics filters |
| `mix.music_duck@1` | reduction dB, attack/release | dialogue-triggered; bounded reduction | gain automation | automation/sidechain |

`rgb_split`, glitch, white flash, grain, record scratch, riser, speed ramps, masked blur, LUTs, optical flow, stabilization, and motion tracking come after this registry and renderer seam work. A short `rgb_split` could replace color or blur in the demo set if the style needs spectacle more than generality.

## Recipe layer

Scripts should request motivated recipes, not raw stacks:

```ts
interface EffectRecipeUse {
  recipe: { id: "emphasis.punch"; version: 1 };
  target: { beatId: "proof"; wordIds: ["w142"] };
  parameters: { intensity: "medium" };
  fallback: "hard_cut";
}
```

`emphasis.punch@1` can expand to:

1. a 7-frame scale attack anchored on the subject;
2. a 10-frame settle;
3. an optional licensed impact SFX element;
4. a caption emphasis marker;
5. one charge against the punch-zoom budget.

The expansion is deterministic and inspectable. The effect instance retains the beat, word/event anchor, motivation, and recipe lineage. Removing or moving the anchor invalidates or re-resolves the effect rather than leaving it at an unrelated absolute time.

Useful initial recipes:

- `emphasis.punch@1`: decisive word or visual reveal;
- `focus.slow_push@1`: sustained attention on a calm authority beat;
- `impact.micro_shake@1`: very short physical emphasis, normally paired with an impact;
- `transition.flash_cut@1`: bounded boundary accent with a hard-cut fallback;
- `tone.prestige@1`: conservative color + vignette, no timing change;
- `release.raw@1`: intentionally removes decorative effects for a candid beat;
- `dialogue.clarity@1`: high-pass/compression/gain preset;
- `music.dialogue_duck@1`: music automation from dialogue activity.

## Editorial budgets and safety

Effects must have a reason and a budget. More intensity is not automatically more impact; contrast creates impact.

Each style map should define:

```ts
interface EffectBudget {
  windowFrames: number;
  maximumAttentionCost: number;
  maximumMotionCost: number;
  perDefinition?: Record<string, { min: number; max: number }>;
  forbiddenCombinations?: string[][];
  quietBeatIds?: string[];
}
```

Recommended rules for the current Kumar style:

- reserve the strongest accent for the hook, proof reveal, or tonal release;
- do not place punch, shake, glitch, and flash on the same boundary;
- use slow push for sustained emphasis and punch for a moment—never both continuously;
- let the candid/human beat remove treatment so the next accent has contrast;
- decorative motion may not obscure captions, faces, required evidence, or UI safe areas;
- full-frame motion needs a reduced-motion review mode and a warning at higher intensity.

W3C accessibility guidance notes that unnecessary motion can cause distraction, dizziness, nausea, or headaches for people with vestibular disorders; authoring and preview should therefore offer a reduced-motion mode and avoid assuming that more zoom/shake is harmless ([W3C animation guidance](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions)). The published video itself cannot read a viewer's browser preference, so the editor should be able to generate or approve a reduced-motion alternative.

Also validate flashes against the applicable delivery/accessibility policy before export; do not ship a “white flash” recipe without a bounded duration/intensity and a flash-frequency QC check.

## Validation and diagnostics

Hard failures:

- unknown effect/version/parameter;
- wrong target kind or effect stage;
- invalid or non-monotonic keyframes;
- time map outside source bounds;
- speed change that leaves captions or linked audio unmapped;
- transition without required source handles;
- transform reveals empty pixels without a declared fallback;
- missing effect/SFX asset or unverified license;
- unsupported export adapter;
- effect graph cycle or exclusive-write collision;
- master output that exceeds delivery safety limits.

Warnings or review requirements:

- approximate browser preview;
- high motion/attention budget;
- strong speed change on speech;
- blur obscuring evidence or captions;
- heavy grade affecting skin/brand colors;
- unverified subject anchor;
- effect not motivated by an event/beat/marker;
- repeated accents with no quiet interval;
- loudness, true-peak, clipping, flash, or caption-safe-area QC concern.

Diagnostics name the effect instance, target, affected composition range, recipe, motivation, fallback, and preview fidelity.

## Migration from current effect strings

Add a one-way compatibility normalizer. Never interpret arbitrary strings at render time.

| Current string | Typed migration |
|---|---|
| `slow_push`, `slow-push` | `transform.push@1` conservative preset |
| `punch_in`, `punch-in` | `transform.punch@1` medium preset |
| `contrast_grade`, `contrast-grade` | `color.basic@1` prestige preset |
| `vignette` | `look.vignette@1` subtle preset |
| `rgb_split`, `rgb-split` | unsupported until registered; declared omit/hard-cut fallback |
| `glitch` | unsupported until registered; declared hard-cut fallback |
| `noise-reduction` | capability-gated dialogue repair preset |
| `compressor` | `audio.dialogue_chain@1` compressor stage |
| `duck-under-dialogue-18db` | `mix.music_duck@1 { reductionDb: 18 }` |
| `speed-ramp` | block migration until a concrete time map is supplied |
| `agent-polish` | reject as unknown; it has no executable meaning |

Emit `LEGACY_EFFECT_NORMALIZED` for known aliases and `UNKNOWN_LEGACY_EFFECT` for everything else. Do not silently display a green effect indicator for something preview/export ignored.

## Hackathon build order

1. Add `EffectDefinition`, `EffectInstance`, `Keyframe`, `TimeMap`, and Zod schemas plus a registry hash.
2. Normalize the existing known strings into conservative typed presets and surface unknown strings.
3. Add a pure evaluator: at composition frame `f`, return source time, transform, filter, opacity, and audio values for active elements.
4. Make `PreviewMonitor` consume the evaluator for constant rate, push/punch, shake, basic color, blur, and vignette. Remove the unconditional vignette.
5. Add effect controls that edit typed parameters and show stage, motivation, preview fidelity, and budget—not just the name.
6. Compile the same evaluated plan into an FFmpeg export graph; probe and pin the binary capability hash.
7. Add gain/fades and dialogue/music bus automation, then loudness/peak QC.
8. Integrate effects into the proposal/revision boundary: agent-generated changes preview first and apply atomically.
9. Add rendered-range previews for approximate effects.
10. Only then expand to speed ramps, transitions, RGB split/glitch, freeze frames, tracked masks, and richer audio repair.

The best demo slice is one 8–12 second sequence showing:

- a 1.15x tightened non-speech or lightly spoken range;
- a focal-point slow push;
- a word-anchored punch plus impact;
- a short deterministic shake or blur-to-clear reveal;
- dialogue clarity with music ducking;
- preview/export generated from the same plan;
- an Apply/Reject diff and a reduced-motion alternative.

## Acceptance tests

- identical revision, registry, capabilities, and effect instances produce byte-identical `RenderPlan`s;
- source time is correct before, during, and after a speed change;
- mapped captions remain aligned to selected words;
- linked video/audio stay synchronized or fail visibly;
- changing speed changes downstream composition timing deterministically;
- keyframes evaluate identically at boundaries in preview and export planning;
- shake keyframes and IDs do not vary across runs;
- unsupported effects cannot claim successful preview/export;
- removing an anchored word/beat invalidates or removes its effect with a diagnostic;
- budget violations identify the conflicting instances;
- a high-motion recipe has a reduced-motion alternative or explicit review requirement;
- rejected proposals do not change the accepted timeline;
- an exported test fixture passes duration, A/V sync, loudness/peak, caption-safe-area, and flash QC.

## Relationship to the scripting pipeline

The scripting system remains the authority boundary:

```text
EditScript recipe request
  -> resolved beat/word/marker anchor
  -> typed effect instances and generated asset requirements
  -> capability and budget validation
  -> proposal hunk with preview fidelity
  -> approval
  -> accepted revision
  -> RenderPlan
```

Effects do not bypass compilation, source evidence, or human review. They make an editorial decision legible and executable; they do not substitute for one.
