# Reusable edit-pattern and style systems

**Research date:** 2026-07-25  
**Scope:** reusable editorial idioms, procedural and example-derived recipes, transition and motion-graphics parameters, effect/layer dependency graphs, constraint-aware selection, validation, and fallbacks.  
**Implementation status:** research guidance only; no application code is changed.

## Executive recommendation

Nighthack should represent a reusable edit as a **versioned, parameterized recipe**, not as a preset that blindly pastes effects and not as a reference timeline that is replayed frame-for-frame.

A recipe should say:

- what editorial purpose it serves;
- what evidence and source conditions it needs;
- which semantic slots it must fill;
- which typed timeline operations it may emit;
- which effects and tracks depend on which other operations;
- how much visual and auditory attention it is allowed to consume;
- what must be true before and after execution;
- how to degrade when footage, handles, renderer capabilities, or confidence are insufficient;
- how the user can compare, pin, override, or revert the result.

The most useful architecture is a two-level system:

```text
semantic recipe
  intent + slot predicates + constraints + budgets + fallback ladder
             ↓ bind against source evidence and style map
renderer-neutral operation graph
  cuts + ranges + overlaps + layers + parameters + dependencies
             ↓ capability-specific lowering
renderer binding
  native timeline ops / Remotion component / MOGRT / export adapter
```

This separation keeps `J-cut`, `identity card`, `beat montage`, or `humanizing reaction` meaningful even when the renderer changes. It also prevents the design identity of a reference creator from becoming inseparable from the editorial method.

## What prior systems establish

### Editing idioms can be composable objective functions

Leake et al.'s *Computational Video Editing for Dialogue-Driven Scenes* is the clearest precedent for reusable editorial idioms. It labels script lines and candidate clips with information such as speaker visibility, framing, and emotional intensity, then represents basic idioms as Hidden Markov Models. Users combine idioms, weight their relative importance, adjust parameters, generate an edit, pin a chosen clip, and regenerate around that fixed choice. Example idioms include starting wide, keeping the speaker visible, reserving close-ups for emotional lines, avoiding jump cuts, and controlling dialogue tempo [S1].

The product lesson is not “implement an HMM.” It is:

1. express an idiom as a score over candidates and transitions rather than a fixed sequence;
2. allow compatible idioms to combine with explicit weights;
3. distinguish start-state, per-item, and between-item rules;
4. expose meaningful parameters such as framing threshold or tempo;
5. let human pins become hard constraints on regeneration;
6. return alternatives quickly enough to support exploration.

### Procedural editing works best as constrained matching

QuickCut aligns narration events to annotated footage, lets authors define basic, alternative, and ordered-group constraints, and uses dynamic programming to choose frame-level cut points while accounting for low-quality footage and transitions [S2]. Silver earlier showed that transcripts, storyboards, outlines, and timelines can be synchronized views over the same metadata, with intelligent selection and cut/copy/paste bridging mismatched audio and video boundaries [S3]. ChunkyEdit argues that editors reason in thematic “chunks” while building paper edits and stringouts, not only at individual-frame or whole-file granularity [S4].

For Nighthack, recipe slots should therefore bind to semantic units such as `utterance`, `action`, `reaction`, `proof`, `speaker_turn`, or `beat`, while the compiler resolves those units to source ranges. A pattern author should not have to hard-code asset IDs or absolute frames.

### Example timelines can teach style descriptors, but copying the timeline is brittle

Frey et al. extract framing, content type, playback speed, and lighting from a professionally edited source, match those properties to unseen raw footage, and transfer visual and temporal edits [S5]. This demonstrates a practical path from an example to a style representation. It does **not** establish that an entire creator identity can be faithfully or safely reduced to one reference.

Useful reference-derived descriptors include:

- shot-duration distributions by narrative role, rather than an exact cut list;
- framing/shot-scale preferences and change matrices;
- rate and placement of cut types;
- audio lead/lag distributions around picture cuts;
- use of speed changes, freeze frames, crops, and split screens;
- graphic density, text occupancy, animation duration, and easing families;
- palette roles, contrast/saturation tendencies, and texture intensity;
- music-energy curve and accent density;
- effect co-occurrence and effect-free recovery intervals;
- where style changes across the story arc.

`Learning Where to Cut from Edited Videos` further shows that edited examples can supervise a model of plausible cut regions, but its user study and learned score support candidate ranking rather than a universal editing law [S6]. MovieCuts provides ten professional cut-type labels across a large corpus, while its reported best benchmark performance shows that cut-type recognition remains difficult; inferred cut semantics should retain confidence and permit correction [S7]. AutoTransition frames transition recommendation as multimodal retrieval from adjacent video and audio context, with sequence context across multiple transitions [S8]. These papers support **context-conditioned recommendations**, not automatic transition spam.

### Alternatives and diffs belong in the recipe workflow

VideoDiff generates alternatives for rough cuts, B-roll, and text effects, aligns variants, and highlights differences through timelines, transcripts, and previews. Its design supports pinning, archiving, refining, recombining, and regenerating alternatives; its study found that comparison support helped users consider more varied results and increased satisfaction [S9].

Recipes should therefore produce a small set of meaningfully distinct candidates such as `continuity-first`, `energy-first`, and `minimal`, not ten random parameter seeds. Each candidate needs a structured diff: changed source ranges, added effects, duration delta, budget delta, warnings, and the rule responsible for every change.

### Professional template systems expose bounded controls

Adobe Motion Graphics templates package layers, source media, and precompositions while exposing only selected text, color, layout, media, or effect controls to the editor. Responsive Design—Time protects intro, outro, or arbitrary animation regions while stretching only unprotected time [S12, S13]. Apple Motion rigs can map one published control to several underlying effect parameters; Apple's guidance explicitly notes that exposing every parameter can overwhelm users [S16]. Remotion similarly supports validated input props and dynamic duration/dimensions, while `TransitionSeries` separates transition timing from presentation and enforces adjacency/duration rules [S17, S18].

The common design is a **small, typed control surface over a more complex internal graph**. Nighthack recipes should publish editorial controls (`energy`, `text_density`, `accent_strength`, `transition_duration`) and keep implementation knobs private unless advanced mode is requested.

## Three distinct artifacts

Do not overload “style,” “pattern,” and “template.”

| Artifact | Describes | Should contain | Should not contain |
|---|---|---|---|
| **Style map** | global creative policy | story curve, palette roles, pacing ranges, preferred/forbidden vocabulary, aggregate budgets, review rubric | a mandatory sequence of effects |
| **Edit recipe** | a reusable local or sectional decision method | intent, slots, predicates, parameters, operations, graph dependencies, budgets, fallback and validation | project-specific asset IDs or copied dialogue |
| **Renderer template/binding** | how operations become output in one engine | components/layers, exact effect IDs, keyframes, shader or plug-in requirements, parameter mapping | editorial selection logic |

A style map selects and weights recipes. A recipe produces a renderer-neutral operation graph. A binding lowers that graph into a supported engine. A single recipe may have `native_web_v1`, `remotion_v1`, and `mogrt_v1` bindings with different capability levels.

## Machine-actionable recipe schema

The following TypeScript-like schema is deliberately explicit. Fields marked “hard” must be verified deterministically. Scores and preferences remain soft.

```ts
type Time = { value: number; rate: number };          // rational, never float seconds internally
type Range = { start: Time; duration: Time };          // half-open [start, end)
type Predicate = {
  fact: string;                                        // e.g. "clip.speakerVisible"
  op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "exists";
  value?: unknown;
  confidenceAtLeast?: number;
  onUnknown: "fail" | "warn" | "request_review";
};

interface EditRecipe {
  schemaVersion: "1.0";
  id: string;                                          // stable slug
  version: number;                                     // immutable published version
  name: string;
  family:
    | "selection" | "continuity" | "transition" | "montage"
    | "layout" | "graphics" | "caption" | "audio" | "grade" | "delivery";
  intent: {
    function: string;                                  // “bridge locations without breaking speech”
    narrativeRoles: string[];                          // hook, proof, reaction, CTA...
    desiredPerceptualEffect: string[];                 // urgency, clarity, release...
    contraindications: string[];                       // testimony, seizure risk, no handles...
  };

  provenance: {
    author: string;
    license: string;
    derivedFrom?: Array<{
      sourceId: string;                                // internal, rights-reviewed reference
      allowedUse: "analysis" | "licensed_template" | "user_owned";
      extractedFeatures: string[];
    }>;
    identityPolicy: {
      bannedLiteralAssets: string[];                   // logos, dialogue, music, faces, exact titles
      bannedIdentityClaims: string[];                  // “in the style of living creator X”
      minimumAbstraction: "feature_distribution" | "licensed_template";
    };
  };

  scope: {
    appliesTo: "boundary" | "beat" | "section" | "timeline" | "delivery";
    minDuration?: Time;
    maxDuration?: Time;
    supportedAspectRatios?: string[];
    supportedFrameRates?: number[];
  };

  slots: Array<{
    id: string;                                        // outgoing, incoming, reaction, title...
    accepts: string[];                                 // evidence/timeline item types
    cardinality: { min: number; max: number };
    predicates: Predicate[];
    requiredHandles?: { head: Time; tail: Time };
    preserve?: Array<"sync" | "complete_phrase" | "action" | "identity" | "chronology">;
    distinctFrom?: string[];                           // do not bind same source range twice
  }>;

  parameters: Record<string, {
    type: "number" | "integer" | "boolean" | "enum" | "color" | "time" | "string";
    default: unknown;
    minimum?: number;
    maximum?: number;
    step?: number;
    values?: unknown[];
    units?: string;
    userFacing: boolean;
    description: string;
  }>;

  preconditions: Array<{
    id: string;
    severity: "hard" | "soft";
    check: string;                                     // named deterministic predicate where hard
    repair?: string;
  }>;

  graph: {
    nodes: Array<{
      id: string;
      op: string;                                      // typed operation, not prose
      phase: string;
      reads: string[];
      writes: string[];
      after: string[];
      before?: string[];
      condition?: string;
      params: Record<string, unknown>;
      inverse: string;                                 // inverse op or snapshot policy
    }>;
    exclusiveResources: string[];                      // e.g. boundary:A-B, captionLane:primary
  };

  costs: {
    attentionUnits: number;
    renderTier: "cheap" | "preview_ok" | "final_only";
    estimatedGpuMsPerFrame?: number;
    generatedFrameCount?: number;
    budgetClaims: Record<string, number>;
  };

  capabilities: {
    required: string[];
    optional: string[];
    bindings: Array<{
      engine: string;
      bindingId: string;
      fidelity: "exact" | "approximate" | "structural_only";
    }>;
  };

  postconditions: Array<{
    id: string;
    severity: "error" | "warning";
    check: string;
    inspectWindow?: { beforeFrames: number; afterFrames: number };
  }>;

  fallback: Array<{
    when: string;
    action: "adjust_parameter" | "substitute_recipe" | "emit_cut" | "skip" | "request_review";
    value: unknown;
    preservesIntent: boolean;
  }>;

  review: {
    previewRanges: string[];
    questions: string[];
    diffFields: string[];
  };

  tests: Array<{
    fixture: string;
    expected: "pass" | "fallback" | "reject";
    assertions: string[];
  }>;
}
```

### Parameter resolution order

Resolve parameters in a predictable order and retain provenance for the resolved value:

```text
explicit user override
  > approved project brief constraint
  > active style-map override
  > recipe parameter default
  > renderer binding default
```

A lower-priority layer may never widen a hard safety or rights constraint. Renderer defaults must not silently change editorial meaning. If a binding cannot honor `protected_outro_frames`, `complete_phrase`, or a handle requirement, it is unsupported, not “approximately successful.”

### Recipe instance output

Instantiation should produce an immutable, reviewable record:

```json
{
  "recipe": { "id": "dialogue.j-cut-bridge", "version": 3 },
  "baseRevision": "rev_17",
  "bindings": {
    "outgoing": { "eventId": "utt_91", "sourceRange": "..." },
    "incoming": { "eventId": "shot_44", "sourceRange": "..." }
  },
  "resolvedParameters": {
    "audioLeadFrames": { "value": 12, "source": "style_map" }
  },
  "score": { "intentFit": 0.84, "continuity": 0.71, "confidence": 0.88 },
  "operations": ["op_201", "op_202", "op_203"],
  "budgetDelta": { "transitionAttention": 0.25 },
  "warnings": [],
  "fallbacksTaken": [],
  "inversePatch": "patch_inv_88"
}
```

## Effect and layer dependency graph

Effects are order-sensitive. Adobe documents that raster layers normally render masks, then effects, then transformations, then layer styles, and that effects within a group run top-to-bottom. Continuously rasterized vector layers change the ordering of transforms and effects. Adjustment layers operate on the composite below them [S14, S15]. Therefore `effects: ["blur", "scale"]` is not a sufficient representation.

Model each recipe instance as a directed acyclic graph (DAG). An edge means “must complete before,” not merely “appears earlier in an array.” Each node declares the streams and coordinate spaces it reads and writes.

### Recommended video graph

```text
source decode
  → cadence/timebase conform
  → source transform / stabilization
  → subject tracking ──────────────┐
  → reframing / layout             │ tracking drives crop/masks
  → per-shot technical correction  │
  → local masks and effects ←──────┘
  → transition overlap/composite
  → scene/section creative look
  → base-picture composite ────────────────┐
                                           ├→ captions / information graphics
graphic assets → layout → animation ───────┤
                                           ├→ decorative overlay
                                           └→ output transform → encode
```

Important branch rules:

- Caption and brand colors should usually be composited after the creative picture look so that grading does not damage legibility or brand color. If a look intentionally affects graphics, declare that dependency explicitly.
- Tracking must occur in a stable coordinate space. A crop, scale, or stabilization change before versus after tracking can change the result.
- A transition reads both adjacent clips over an overlap interval. It is not a decoration attached to one frame.
- Temporal effects such as echo, optical flow, motion blur, denoise, or frame interpolation require neighboring frames and must declare their temporal radius.
- An adjustment/global effect reads the full composite below it; moving a layer above it changes semantics.
- Output transforms and encoding are delivery operations. They should not be baked into a reusable creative recipe.

### Recommended audio graph

```text
source decode → sync/conform → repair/denoise → dialogue edit → clip gain
                                                        ↓ sidechain key
music edit → music gain/ducking ───────────────────────→ mix bus
SFX edit → transient control ──────────────────────────→ mix bus
room tone / ambience ──────────────────────────────────→ mix bus
mix bus → loudness/true-peak delivery → encode
```

A J/L-cut changes source ranges and overlap before the final mix. Ducking reads dialogue activity. Loudness normalization must measure the resulting program, not individual source clips in isolation.

### Graph node contract

Every effect node should declare:

- `inputSpace` and `outputSpace`: source pixels, composition pixels, linear light, display-referred, source samples, mix bus;
- temporal range plus any required head/tail context;
- alpha and premultiplication expectations;
- color-space and transfer-function expectations;
- deterministic seed, if stochastic;
- GPU/CPU capability and preview substitute;
- whether it generates pixels/frames or only transforms originals;
- invalidation keys for caching;
- inverse or removal behavior;
- bounds on every keyframe or expression output.

Reject cyclic dependencies. If two recipes both claim the primary caption lane, the same cut boundary, or incompatible output transforms, require an explicit merge policy rather than relying on insertion order.

## Composition rules

Recipes compose only after their constraints and graphs compose.

### 1. Slot compatibility

A bound item must satisfy every hard predicate and all preservation requirements. Combining recipes intersects hard predicates. An empty intersection means the combination is invalid.

Example: `intensify-with-closeup` requires a close-up candidate; `keep-both-speakers-visible` requires a two-shot. They may both score a sequence, but cannot both bind the same shot unless a candidate actually satisfies both representations.

### 2. Interval ownership

Operations claim source and composition intervals with a mode:

- `exclusive`: trim, speed map, or primary transition owns the interval;
- `overlay`: graphics or effects may share the interval;
- `read_only`: analysis or measurement;
- `mix`: audio may combine subject to bus limits.

At most one recipe may own an exclusive boundary unless a higher-level composite recipe defines the combination. This avoids putting a whip, dissolve, and flash on the same cut accidentally.

### 3. Graph union and topological order

Combine DAGs by unioning nodes and dependency edges, then topologically sort. Reject cycles. Standard phase edges should be inserted automatically, but recipes may add stronger local edges. The compiler should report the exact cycle when composition fails.

### 4. Budget addition

Sum budget claims over rolling windows, section windows, and simultaneous layers. Budgets are constraints, not post-hoc style scores. If a combination exceeds a hard budget, try the fallback ladder before rejecting.

### 5. Parameter namespaces

Do not merge same-named parameters by accident. Use semantic namespaces such as `transition.duration`, `caption.activeWordColor`, and `mix.dialogueDuckDb`. A composite recipe may publish a macro parameter (`energy`) that maps through bounded functions to child parameters.

### 6. Preserve editorial invariants

No style recipe may override:

- valid source ranges and media availability;
- linked audio/video sync unless a split edit is intentional and bounded;
- complete required speech or action;
- truth, chronology, speaker attribution, and synthetic-content labels;
- caption timing and safe-area requirements;
- delivery and accessibility constraints;
- user pins, locks, and forbidden ranges.

### 7. Idempotence and stable regeneration

Applying the same recipe/version/parameters to the same base revision and evidence snapshot should produce the same proposal. Use explicit random seeds for variations. Reapplying a recipe should update its existing instance rather than stack a duplicate unless the recipe declares `repeatable: true`.

### 8. Locality

A boundary recipe may not rewrite an entire section. A beat recipe may not modify delivery settings. Every recipe declares its maximum edit radius. Proposals outside that radius are a compiler error.

### 9. Protected user work

Pins and manual edits become graph constraints. Regeneration should route around them, like the fixed-clip regeneration in RoughCut [S1]. If a recipe can no longer satisfy its intent, report the conflict; do not silently unlock the user's decision.

### 10. Variant diversity

Generate alternatives by changing editorial strategy, not cosmetic noise. Require a minimum semantic distance such as different source choices, cut structure, coverage plan, or graphic density. Present a source-aligned diff and a concise rationale, following the comparison principles demonstrated by VideoDiff [S9].

## Effect budgets

An effect budget limits cumulative attention and technical risk. Counts alone are insufficient: one full-screen strobe is not equivalent to one two-frame sound accent. Track several dimensions.

```ts
interface EffectBudget {
  windowSeconds: number;                    // usually 10; evaluate rolling windows
  hard: {
    simultaneousFullFrameEffects: number;
    primaryTransitionsPerBoundary: number;
    captionLanes: number;
    maxFlashEventsPerSecond: number;
    maxScale: number;
    maxRotationDegrees: number;
    maxGeneratedFrameRatio: number;
  };
  soft: {
    attentionUnits: number;
    accentTransitions: number;
    punchIns: number;
    decorativeOverlays: number;
    fullScreenTextSeconds: number;
    impactSfx: number;
    speedRamps: number;
  };
  recovery: {
    minCleanFramesAfterMajorAccent: number;
    minSecondsBetweenSameMotif: number;
  };
}
```

### Suggested default cost model

These are conservative product defaults to tune through testing, not universal craft laws.

| Operation | Attention units | Additional claims |
|---|---:|---|
| straight cut | 0 | none |
| J/L audio bridge | 0.25 | split-edit boundary |
| short dissolve/fade | 0.5 | one primary transition |
| match cut | 0.75 | verified correspondence |
| punch-in under 1.15× | 0.5 | crop resolution |
| whip/glitch/RGB split | 1.5 | one primary transition; motion/flash risk |
| white flash | 2 | flash counter; luminance QC |
| lower third | 0.75 | primary or secondary graphic lane |
| full-screen identity card | 1.5 | full-screen text time |
| picture-in-picture | 1 | layout lane; simultaneous video decode |
| active-word caption emphasis | 0.25 per cue | caption lane |
| impact SFX | 0.5 | transient/headroom budget |
| optical-flow/generated transition | 2.5 | generated-frame ratio; final-only review |

Default rolling ten-second budget for an ordinary social-video section:

- `attentionUnits ≤ 5` soft;
- `accentTransitions ≤ 2` soft;
- `simultaneousFullFrameEffects ≤ 1` hard;
- `primaryTransitionsPerBoundary ≤ 1` hard;
- `decorativeOverlays ≤ 2` soft;
- `fullScreenTextSeconds ≤ 3` soft;
- `impactSfx ≤ 3` soft;
- `maxScale ≤ 1.20` hard unless source resolution and style map permit more;
- at least `12 clean frames` after a major accent at 30 fps;
- never exceed three flashes in a one-second period without formal threshold analysis; a stricter reduced-motion mode should replace flashes with cuts or fades. W3C's technique G19 uses no more than three flashes per second as a technology-independent sufficient technique [S19].

Budgets should vary by beat. A hook may spend more attention early; testimony, proof, accessibility-critical text, and the “human record-scratch” beat may deliberately reserve a low budget. The style map owns aggregate targets, while each recipe declares costs.

### Budget failure order

When over budget:

1. remove duplicate decorative overlays;
2. lower intensity or shorten the least important accent;
3. substitute a hard cut or audio bridge for a stylized transition;
4. preserve the higher-priority narrative emphasis;
5. request review if the explicit user request still cannot fit.

Never solve an attention-budget failure by shortening required reading time or clipping speech.

## Example-derived style without identity copying

Treat a reference as evidence for abstract decisions, not as a bag of assets.

### Extraction pipeline

```text
rights check and reference ownership
  → shot/cut/graphics/audio segmentation
  → per-event descriptors with confidence
  → normalize by duration, format, and narrative phase
  → aggregate distributions and conditional rules
  → remove literal identity-bearing content
  → user reviews a plain-language style map
  → compile to recipe weights and budgets
```

### Keep

- conditional distributions: “close-ups become more likely at high-emotion lines”;
- bounded rhythms: shot-duration quantiles by beat and changes over time;
- transition vocabulary and placement conditions;
- graphic hierarchy: title/lower-third/caption roles and relative scale;
- palette **roles** and contrast relationships, not sampled trademark colors by default;
- animation grammar: enter, hold, exit proportions and easing families;
- audio-picture relationships: beat accents, dialogue ducking, deliberate silence;
- effect density and recovery spacing.

### Exclude or require explicit licensed reuse

- logos, watermarks, faces, voice likeness, music, footage, and exact sound effects;
- exact dialogue, slogans, scripts, jokes, or title copy;
- exact font files or proprietary templates without rights;
- a unique signature sequence copied shot-for-shot;
- names or prompts that claim the output is by, endorsed by, or indistinguishable from another creator;
- hidden reference assets in rendered or cached output.

### Similarity guard

Before publication, compare the generated edit against each reference at three levels:

1. **Literal:** perceptual hashes, audio fingerprints, OCR text overlap, logos, watermarks.
2. **Sequence:** near-identical ordered cut/event sequences and timing.
3. **Identity:** names, likeness, branded language, or UI labels implying authorship/endorsement.

Allow similarity in high-level descriptors while rejecting literal and identity similarity. Record which extracted features influenced each recipe choice so the user can remove a reference from the derivation chain and regenerate.

## Pattern library: initial contracts

### 1. Dialogue J-cut bridge

**Intent:** motivate a picture change with incoming audio while maintaining conversational flow.

**Preconditions**

- adjacent utterances or scenes exist;
- incoming audio has a complete intelligible lead range;
- lead does not create false simultaneity or attribution;
- source handles cover the requested lead;
- linked sync after the bridge remains known.

**Parameters**

- `audioLeadFrames`: integer, default 8, range 2–24 at 30 fps;
- `pictureCutAnchor`: `speaker_turn | breath | action | semantic_shift`;
- `roomToneCrossfadeFrames`: integer, 0–12.

**Graph**

`trim outgoing picture → extend incoming audio left → crossfade ambience → picture cut → restore linked incoming A/V`.

**Postconditions**

- no clipped phoneme or duplicated word;
- no unintended dialogue overlap;
- measured sync on visible speech after the picture cut is within project tolerance;
- no audible room-tone discontinuity.

**Fallback**

Shorten the lead, then use a straight cut with a short room-tone bridge; if attribution remains ambiguous, request review.

### 2. Match-on-action cut

**Intent:** bridge angle or location on a shared action phase.

**Preconditions**

- both candidates contain the same authentic action or a semantically intended analogy;
- action phase estimates exceed confidence threshold;
- chronology and identity constraints permit the pairing;
- outgoing and incoming handles preserve the action.

**Parameters**

- `phaseTolerance`: 0–1 normalized action phase;
- `directionPolicy`: `preserve | intentional_reverse`;
- `speedAdjustmentMax`: default ±5%, hard max defined by style map.

**Postconditions**

- no repeated or missing action phase beyond tolerance;
- screen direction does not reverse accidentally;
- any retiming is labeled and audio policy is explicit.

**Fallback**

Try a nearby frame, then use a cutaway/insert, then a straight cut at a semantic boundary. Never fabricate matching motion.

### 3. Beat-emphasis montage

**Intent:** compress proof or escalation into diverse, rhythmic evidence.

**Preconditions**

- at least three distinct valid shots;
- every shot supports the beat and preserves required context;
- music beat grid confidence is sufficient if beat sync is requested;
- repeated-source and diversity constraints pass.

**Parameters**

- `shotCount`: 3–6;
- `shotDurationFrames`: bounded distribution, not one fixed duration;
- `syncStrength`: 0–1;
- `diversityWeights`: subject, scale, motion, location;
- `progression`: `increase_energy | reveal_detail | breadth | contrast`.

**Postconditions**

- each shot adds evidence or contrast;
- duration and source ranges are valid;
- no two consecutive shots are near duplicates unless intentional;
- dialogue remains intelligible or is explicitly absent;
- effect budget passes.

**Fallback**

Reduce shot count, loosen beat snapping while preserving phrase/action boundaries, or create a slower three-shot proof sequence. Do not loop the same B-roll to fill quota.

### 4. Responsive identity card

**Intent:** establish a person, role, claim, or chapter with one legible graphic moment.

**Preconditions**

- text is approved or traceable to source/brief;
- font/license and brand assets are available;
- safe area, contrast, and reading-duration checks can pass;
- card does not cover required visual evidence.

**Parameters**

- text fields with character limits;
- `introFrames`, `holdPolicy`, `outroFrames`;
- palette role and alignment;
- optional replaceable media slot.

**Graph**

Protected intro → elastic hold → protected outro. This mirrors Adobe Responsive Design—Time: preserve intro/outro animation while stretching only the unprotected region [S13].

**Postconditions**

- protected regions retain duration;
- text fits without scaling below minimum;
- no caption collision;
- replaceable media matches slot aspect/crop policy;
- missing fonts have a declared substitute or block export.

**Fallback**

Shorten copy through user-approved alternate text, switch to two lines, use a static card, or omit. Never silently truncate a name or claim.

### 5. Parameterized accent transition

**Intent:** mark a meaningful change of time, place, state, or energy.

**Preconditions**

- a semantic boundary exists;
- this boundary is not already owned by another primary transition;
- both adjacent items and handles can support the transition;
- required engine capability exists;
- flash, motion, and effect budgets pass.

**Parameters**

- `presentation`: `dissolve | wipe | slide | whip | flash_overlay`;
- `durationFrames` bounded by adjacent material;
- `easing`, `direction`, `intensity`, `motionBlur`;
- separate in/out offsets.

OTIO represents a transition between adjacent track items with `in_offset` and `out_offset`; those offsets describe overlap with the neighboring clips [S10, S11]. Remotion separates the transition's timing from presentation, makes the two scenes overlap, shortens total sequence duration by the transition duration, and disallows a transition longer than either adjacent sequence or two adjacent transitions [S18]. These are useful verifier invariants even if Nighthack uses another renderer.

**Postconditions**

- exact overlap math is valid;
- no missing frame, black flash, duplicated frame, or unexpected total-duration shift;
- first/last and midpoint frames render;
- reduced-motion substitute exists for high-motion variants.

**Fallback ladder**

Shorten → substitute a lower-motion dissolve → substitute a hard cut plus optional audio bridge → request review if a stylized transition was explicit and essential.

### 6. Example-derived pacing curve

**Intent:** apply an abstract rhythm learned from a reference set without copying its edit.

**Preconditions**

- references pass rights/identity policy;
- at least one duration-normalized pacing descriptor exists;
- target has enough semantically valid candidates;
- hard speech/action constraints take priority.

**Parameters**

- target shot-duration quantiles by normalized story phase;
- change-rate curve;
- maximum deviation from natural source boundary;
- diversity and repetition penalties.

**Postconditions**

- no exact reference EDL is reproduced;
- target-specific narrative order remains coherent;
- all cuts land in allowed regions;
- similarity guard passes.

**Fallback**

Relax toward the target style map's generic pacing bounds, then preserve the natural cut. Never force a cut solely to match a histogram.

## Constraint-aware selection

Recipe selection is a two-stage problem.

### Eligibility filter

Reject recipes that fail hard requirements:

- missing semantic slot or evidence;
- unavailable handles or invalid ranges;
- incompatible renderer or export target;
- occupied exclusive resource;
- accessibility, rights, safety, or user-lock conflict;
- budget hard limit;
- unsupported aspect ratio, cadence, color, or audio layout.

### Ranking

For eligible recipes, rank instances with an inspectable score:

```text
score =
  w_intent      × intent_fit
+ w_evidence    × evidence_confidence
+ w_continuity  × continuity_gain
+ w_style       × style_map_fit
+ w_novelty     × sequence_diversity
+ w_quality     × source_quality
- w_attention   × budget_pressure
- w_risk        × technical_and_truth_risk
- w_repeat      × motif_repetition
- w_cost        × render_cost
```

Use different weights by phase. A proof beat weights truth and source quality more heavily; a hook may weight novelty and immediacy; testimony should increase continuity/comprehension and penalize effects. Show the top reasons and top disqualifier for every candidate. Low-confidence evidence should reduce rank or trigger review, never be converted into a confident fact.

### Search strategy for a hackathon

Do not build a learned end-to-end selector first. Use:

1. deterministic eligibility predicates;
2. a weighted candidate scorer;
3. beam search or dynamic programming for sequences with transition costs;
4. explicit diversity penalties for alternatives;
5. a verifier over the proposed graph;
6. user pins and regenerations.

This captures the most transferable ideas from RoughCut and QuickCut with far less infrastructure than training a dedicated policy.

## Validation protocol

Validation must occur at four levels.

### A. Static recipe validation

Run when a recipe is published:

- schema and version valid;
- parameter defaults inside bounds;
- graph acyclic;
- all node inputs supplied and outputs uniquely named;
- no unknown operation or capability;
- inverse behavior present;
- fallback references exist and do not form a cycle;
- tests cover pass, fallback, and rejection;
- provenance/license/identity policy complete;
- renderer bindings declare fidelity.

### B. Instance preflight

Run before applying a proposal:

- base revision unchanged;
- all bound events and media still exist;
- source ranges and rational time rates valid;
- handles and temporal radii available;
- linked sync and speed maps valid;
- exclusive intervals and lanes unoccupied;
- graph union remains acyclic;
- parameter and expression bounds hold;
- aggregate budgets pass or fallback is selected;
- generated media and licensed assets are labeled.

### C. Timeline postconditions

Run after applying to a copy:

- exact expected duration delta;
- no unintended gaps, overlaps, negative durations, or out-of-bounds ranges;
- no transition exceeds neighboring material;
- no adjacent primary transitions;
- protected animation regions preserved;
- captions and graphics remain in safe areas and do not collide;
- audio buses, channel layouts, and loudness chain intact;
- user pins and unrelated items unchanged;
- inverse patch restores the base revision byte-for-byte or semantically equivalently.

### D. Render and perceptual QC

Render at least the first, middle, and last frame of every new effect plus handles around every changed boundary. Detect:

- black/transparent or single-frame flashes;
- frozen, repeated, dropped, or generated-frame artifacts;
- optical-flow warping and motion discontinuity;
- crop/track jumps and subject clipping;
- text overflow, missing fonts, aliasing, or unreadable contrast;
- caption timing/collision errors;
- audio clicks, clipped phonemes, room-tone jumps, true-peak overs, and sync drift;
- unexpected color-space or alpha changes;
- performance regressions beyond the recipe's declared tier;
- flash-frequency violations.

Every nontrivial proposal still needs a playable preview. VideoDiff's study found that transcripts and thumbnails help comparison but cannot replace watching for errors such as cut-off sentences and jump cuts [S9].

## Failure-mode catalog and deterministic response

| Failure | Detect | First repair | Final fallback |
|---|---|---|---|
| Missing transition handles | compare requested offsets with available source range | shorten/asymmetrically align | hard cut |
| Unsupported effect/binding | capability negotiation | approximate binding with disclosed fidelity | structural-only cut/layout or skip |
| Effect graph cycle | topological sort failure | remove lower-priority optional edge/node | reject combination |
| Two recipes own one boundary | exclusive-resource conflict | choose higher intent score | offer alternatives |
| Effect budget exceeded | rolling/simultaneous budget sum | reduce/omit lowest-priority decoration | minimal recipe |
| Reference identity leakage | hash/OCR/logo/audio/sequence checks | replace literal asset/copy | block export and review |
| No authentic reaction/proof | empty evidence slot | bind explicit title card if truthful and allowed | mark beat missing |
| Text does not fit | layout measurement | alternate layout or approved shorter copy | static/omitted card |
| Missing font | font availability check | licensed declared substitute | block branded export |
| Low-confidence cut type/action | confidence threshold | use generic boundary/cut | request review |
| Reframe loses subject | saliency/face/hand/object bounds | widen crop or use alternate layout | original framing/letterbox |
| Temporal effect crosses a cut | temporal-radius interval check | trim effect window | non-temporal substitute |
| Optical-flow artifact | flow consistency/render QC | reduce duration/change interpolation | hard cut/dissolve |
| Speech clipped | word/phoneme and listen-window check | expand trim to safe boundary | retain original utterance |
| False attribution/chronology | evidence lineage and chronology constraints | reorder/remove bridge | request review |
| Caption/graphic collision | occupancy map | move lower-priority graphic | serialize or omit decoration |
| Flash or motion risk | flash/motion analyzer | reduce intensity/frequency | reduced-motion cut/fade |
| Preview too expensive | cost estimate and missed frame budget | proxy effect/lower resolution | final-only effect with warning |
| Reapply duplicates effect | instance identity/idempotence check | update existing instance | reject duplicate |
| Stale proposal | base revision mismatch | rebind/replan against new revision | require comparison |
| Undo incomplete | inverse-patch verification | restore snapshot | block recipe publication |

## Official timeline and effects constraints worth adopting

### OpenTimelineIO semantics

OTIO represents clips, gaps, tracks/stacks, transitions, markers, and external media references. A transition sits between adjacent items and has separate overlap offsets into the previous and next item. OTIO's documentation notes that transitions do not themselves change the nominal track duration, may be ignored by a playback tool, cannot be adjacent to another transition, and must not consume more than the neighboring items; available media may still be too short, so Nighthack must check media handles rather than trusting structural validity [S10, S11].

Store a richer internal recipe graph, but make the timeline portion mappable to OTIO concepts. Keep renderer-specific effects in typed metadata/bindings and emit an export capability report when an adapter cannot preserve them.

### Adobe template and render-order semantics

Motion Graphics templates demonstrate:

- explicitly published controls;
- replaceable media slots;
- grouped controls and constrained customization;
- packaged dependencies;
- warnings for missing fonts or host requirements;
- protected intro/outro/other regions for duration adaptation [S12, S13].

After Effects render-order documentation establishes that layer stack, mask/effect/transform order, adjustment layers, and precomposition boundaries are semantic, not cosmetic [S14, S15]. Recipe bindings need golden-frame tests whenever their node order changes.

### Apple Motion/FCPXML semantics

Apple's Motion plug-in guidance uses rigs to map one user control to multiple underlying parameters and recommends exposing a task-oriented surface rather than every plug-in knob [S16]. FCPXML represents transitions, filter effects, parameter IDs, values/keyframes, and transition alignment; Apple's older interchange guide explicitly shows adjacent source ranges extended to supply transition frames [S20, S21]. Use stable language-independent effect/parameter identifiers and preserve keyframe interpolation metadata when exporting.

### Remotion semantics

Remotion parameterized videos support input props, schemas, defaults, dynamic metadata, and preview in a player [S17]. Its `TransitionSeries` distinguishes transitions—which overlap scenes and shorten total duration—from overlays, which sit over a cut without changing timing. It also gives executable rules: transition duration cannot exceed either adjacent sequence, and transitions/overlays cannot occupy adjacent slots without a sequence [S18]. Mirror this separation internally as `primary_transition` versus `boundary_overlay`.

## Hackathon priorities

### P0 — demonstrate the thesis

1. **Implement the recipe record, not a generalized plug-in platform.** Support stable `id/version`, intent, parameters, preconditions, typed operations, budget claims, fallback, and postconditions.
2. **Ship three recipes:** `dialogue.j-cut-bridge`, `montage.beat-proof`, and `graphics.identity-card`. They cover editorial, temporal, audio, and graphics behavior.
3. **Add one constraint-aware selector:** deterministic eligibility plus weighted scoring from the existing evidence events and `kumar-method` style map.
4. **Compile into proposals against a base revision.** Apply only to a copy, validate, and retain an inverse patch.
5. **Show two or three alternatives with source-aligned diffs.** One should be explicitly minimal. Let the user pin an option and regenerate around it.
6. **Enforce essentials:** source bounds, complete speech, handle checks, one primary transition per boundary, graph acyclicity, effect budget, caption collision, stale-revision rejection.

### P1 — make style reusable

1. Add recipe graph phases and exclusive resource claims.
2. Compile style-map fields into recipe weights, parameter bounds, and rolling budgets.
3. Add a renderer capability matrix and disclosed fallback fidelity.
4. Add protected intro/hold/outro regions to graphics.
5. Store structured accept/reject/modify/revert events and exact user deltas.
6. Add one example-timeline analyzer that extracts only shot-duration, framing, transition, text-density, and palette-role descriptors.

### P2 — harden after the demo

1. Golden fixtures for every recipe and renderer binding.
2. Render QC around every changed boundary.
3. Rights/identity similarity guards for imported references.
4. Cost-aware preview substitutes and caching by graph invalidation keys.
5. OTIO import/export with a capability-loss report.
6. Preference ranking learned from accepted/modified proposals, only after enough structured interaction data exists.

### Explicitly defer

- end-to-end “copy this creator” style models;
- online reinforcement learning during the hackathon;
- arbitrary user-authored shaders or plug-ins;
- generative transitions without frame-level review and provenance;
- a huge preset marketplace before recipe validation/versioning exists;
- automatic conflict resolution that hides which creative rule lost.

## Minimum acceptance test for the demo

Given a timeline with one talking-head section, three proof shots, music with a beat grid, and a valid name/role:

1. the planner proposes a J-cut, a three-to-five-shot proof montage, and a responsive identity card;
2. every proposal cites its source evidence, recipe/version, parameters, budget delta, and rationale;
3. an insufficient-handle J-cut falls back to a hard cut plus room tone;
4. a montage with only two valid proof shots reduces shot count rather than repeating footage;
5. a long name triggers a layout fallback rather than truncation;
6. combining the three recipes produces an acyclic graph and remains inside the section budget;
7. the preview shows changed ranges and a source-aligned diff;
8. pinning one proof shot preserves it through regeneration;
9. applying creates a new revision; reverting restores the base revision;
10. no app path can silently apply an unverified or stale proposal.

## Sources

All sources were accessed **2026-07-25**. Technical claims above rely on papers, author/institution project pages, standards bodies, or official product documentation.

1. **[S1] Leake, Davis, Truong, and Agrawala, “Computational Video Editing for Dialogue-Driven Scenes,” ACM TOG/SIGGRAPH 2017.** Stanford Graphics project page and paper: https://graphics.stanford.edu/papers/roughcut/ and https://graphics.stanford.edu/papers/roughcut/files/roughcut-small.pdf
2. **[S2] Truong, Berthouzoz, Li, and Agrawala, “QuickCut: An Interactive Tool for Editing Narrated Video,” UIST 2016.** Stanford Graphics project page and paper: https://graphics.stanford.edu/projects/quickcut/ and https://graphics.stanford.edu/projects/quickcut/quickcut.pdf
3. **[S3] Casares et al., “Simplifying Video Editing Using Metadata,” DIS 2002.** Carnegie Mellon repository: https://kilthub.cmu.edu/articles/journal_contribution/Simplifying_Video_Editing_Using_Metadata/6470426
4. **[S4] Leake and Li, “ChunkyEdit: Text-first video interview editing via chunking,” CHI 2024.** ACM Digital Library: https://doi.org/10.1145/3613904.3642667
5. **[S5] Frey, Chi, Yang, and Essa, “Automatic Style Transfer for Non-Linear Video Editing,” CVPR Workshops 2021.** Google Research publication page: https://research.google/pubs/automatic-style-transfer-for-non-linear-video-editing/
6. **[S6] Huang, Bai, Wang, Caba, and Agarwala, “Learning Where To Cut From Edited Videos,” ICCV Workshops 2021.** CVF Open Access: https://openaccess.thecvf.com/content/ICCV2021W/CVEU/html/Huang_Learning_Where_To_Cut_From_Edited_Videos_ICCVW_2021_paper.html
7. **[S7] Pardo et al., “MovieCuts: A New Dataset and Benchmark for Cut Type Recognition,” ECCV 2022.** ECVA paper: https://www.ecva.net/papers/eccv_2022/papers_ECCV/papers/136670659.pdf
8. **[S8] Shen, Zhang, Xu, and Jin, “AutoTransition: Learning to Recommend Video Transition Effects,” ECCV 2022.** ECVA paper: https://www.ecva.net/papers/eccv_2022/papers_ECCV/papers/136980282.pdf
9. **[S9] Huh et al., “VideoDiff: Human-AI Video Co-Creation with Alternatives,” CHI 2025.** ACM Digital Library: https://doi.org/10.1145/3706598.3713417
10. **[S10] OpenTimelineIO schema API — `Transition`.** https://opentimelineio.readthedocs.io/en/latest/api/python/opentimelineio.schema.html
11. **[S11] OpenTimelineIO timeline structure — transitions, tracks, and stacks.** https://opentimelineio.readthedocs.io/en/v0.16.0/tutorials/otio-timeline-structure.html
12. **[S12] Adobe After Effects — create Motion Graphics templates with Essential Graphics.** https://helpx.adobe.com/uk/after-effects/using/creating-motion-graphics-templates.html
13. **[S13] Adobe After Effects — Responsive Design—Time and protected regions.** https://helpx.adobe.com/uk/after-effects/using/responsive-design.html
14. **[S14] Adobe After Effects — effects, animation presets, and effect render order.** https://helpx.adobe.com/after-effects/desktop/apply-effects-and-animation-presets/effects-and-animation-presets/effects-animation-presets-overview.html
15. **[S15] Adobe After Effects — precomposing, nesting, and render order.** https://helpx.adobe.com/au/after-effects/using/precomposing-nesting-pre-rendering.html
16. **[S16] Apple Developer — preparing plug-ins for use in Final Cut Pro.** https://developer.apple.com/documentation/professional-video-applications/preparing-plug-ins-for-use-in-final-cut-pro
17. **[S17] Remotion — parameterized videos.** https://www.remotion.dev/docs/parameterized-rendering
18. **[S18] Remotion — `TransitionSeries`.** https://www.remotion.dev/docs/transitions/transitionseries
19. **[S19] W3C WAI — Technique G19: no more than three flashes in any one-second period.** https://www.w3.org/WAI/WCAG21/Techniques/general/G19
20. **[S20] Apple Developer — Final Cut Pro XML interchange elements.** https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/FinalCutPro_XML/Elements/Elements.html
21. **[S21] Apple Developer — Final Cut Pro XML interchange basics and effect encoding.** https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/FinalCutPro_XML/Basics/Basics.html

