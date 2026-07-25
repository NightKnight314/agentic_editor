# Scripting pipeline: EditScript v0.1

Status: implementation design for the hackathon. This is the contract between source analysis and timeline operations. It does not replace the evidence store, editor document, or renderer.

## Decision

Introduce a declarative `EditScript`:

```text
AnalysisResponse + asset facts + brief + style map
  -> normalize evidence catalog
  -> author EditScript (selectors, beats, recipes, passes, constraints)
  -> bind selectors and freeze a ResolutionLock
  -> compile deterministically against a base timeline revision
  -> preflight
  -> EditProposal<TimelineOperation[]>
  -> human review/apply
```

The script is data, not executable TypeScript. JSON is the canonical persisted form; YAML is only a convenient authoring view. Do not allow arbitrary expressions, callbacks, or prompt text to execute during compilation. Predicates, ranking terms, recipes, constraints, and operations all come from closed registries.

This separates responsibilities that are currently combined in `AnalysisResult.timeline.segments`:

| Concern | Owner |
|---|---|
| What exists in the source | evidence catalog (`AnalysisResult.events` initially) |
| What story job should be done | beats |
| Which evidence may do that job | selectors and frozen bindings |
| How to edit it | recipe invocations |
| When finishing work happens | ordered layer passes |
| Whether the result is allowed | deterministic constraints |
| Whether the result is good | human/editorial review |
| Exact editor mutations | compiler output only |

`timelineFromAnalysis` should eventually become `compileEditScript`; during migration it can remain the final lowering adapter.

## Core invariants

1. Evidence is in **source time**. Timeline placement is in **composition time**. A naked `start` is invalid in the new contract.
2. Ranges are half-open `[start, start + duration)` and use integer ticks with an explicit scale.
3. A script may query/rank evidence, but deterministic compilation only consumes a frozen `ResolutionLock` containing exact event IDs and source ranges.
4. Planner output names intents and recipes; only the compiler emits `TimelineOperation`s.
5. IDs never use `Date.now()`, array positions, or random UUIDs. Generated IDs derive from canonical content and logical paths.
6. Every selected source range retains evidence lineage. Editorial copy is never represented as transcript evidence.
7. A missing requirement follows a declared fallback or blocks. The compiler does not silently invent footage, dialogue, handles, or a new selection.
8. Hard checks and subjective review stay separate. A high story score cannot override an invalid source range.
9. Layer passes follow dependency order. Decorative work cannot change the story cut.
10. Compilation is atomic against a named base revision; a stale base is a hard failure.

## Minimal data contract

The names below are deliberately compatible with Zod and plain JSON.

```ts
type Time = {
  ticks: number;           // non-negative safe integer
  ticksPerSecond: number;  // positive integer; P0 commonly uses 1000 or 30
};

type SourceRange = {
  space: "source";
  assetId: string;
  streamId?: string;
  start: Time;
  duration: Time;
};

type CompositionRange = {
  space: "composition";
  revisionId: string;
  start: Time;
  duration: Time;
};

type EvidenceEvent = {
  id: string;
  kind: "hook" | "identity" | "claim" | "proof" | "action" |
        "reaction" | "humor" | "visual_change" | "call_to_action" |
        "speech" | "shot" | "sound" | "user_marker";
  range: SourceRange;
  summary: string;
  transcript?: string;
  visual?: string;
  tags: string[];
  scores: Record<string, number>; // selection, speechClarity, novelty, etc.
  producer: { name: string; version: string };
};

type EvidenceSelector = {
  id: string;
  assetIds?: string[];
  kinds?: EvidenceEvent["kind"][];
  within?: SourceRange;
  tagsAny?: string[];
  tagsAll?: string[];
  textContainsAny?: string[]; // case-folded literal search; not model inference
  minScores?: Record<string, number>;
  excludeEventIds?: string[];
  rank: Array<{
    field: "selection" | "speechClarity" | "novelty" | "visualVariety" |
           "sourceEarlier" | "sourceLater";
    direction: "asc" | "desc";
    weight: number;
  }>;
  limit: number;
  distinctBy?: "event" | "sourceRange" | "transcript";
};

type SourceChoice =
  | { from: { selectorId: string }; role: string; trim?: TrimPolicy }
  | { from: { eventId: string; range?: SourceRange }; role: string; trim?: TrimPolicy };

type TrimPolicy = {
  min?: Time;
  ideal?: Time;
  max?: Time;
  preserve?: Array<"complete_phrase" | "word_boundary" | "action" | "chronology">;
};

type BeatFunction =
  | "hook" | "setup" | "claim" | "proof" | "demonstration"
  | "contrast" | "reaction" | "payoff" | "callback" | "cta";

type Beat = {
  id: string;
  function: BeatFunction;
  styleBeat?: string; // e.g. kumar-method's pattern_interrupt
  intent: string;
  optional?: boolean;
  targetDuration?: { min: Time; ideal: Time; max: Time };
  choices: SourceChoice[];
  choose: {
    strategy: "highest_ranked" | "first_declared" | "locked";
    count: number;
  };
  recipes?: RecipeUse[];
  fallback: FallbackStep[];
  reviewTags?: string[];
};

type RecipeUse = {
  id: string; // invocation ID, unique inside the script
  recipe: { id: string; version: number };
  bind: Record<string, string>; // recipe slot -> beat role or named resource
  parameters: Record<string, unknown>;
  when?: { predicate: string; args?: Record<string, unknown> };
};

type FallbackStep =
  | { when: "no_match" | "low_confidence" | "missing_handles" |
            "unsupported_capability" | "budget_exceeded";
      action: "use_selector"; selectorId: string }
  | { when: string; action: "substitute_recipe";
      recipe: { id: string; version: number } }
  | { when: string; action: "use_hard_cut" | "omit_optional" | "request_review" | "block" };

type LayerPass = {
  id: string;
  enabled?: boolean; // defaults true; alternatives may disable optional passes
  phase: "assembly" | "dialogue" | "coverage" | "layout" | "captions" |
         "grade" | "music" | "decoration" | "delivery";
  after?: string[];
  scope: { beats?: string[]; all?: true };
  recipes: RecipeUse[];
  mayChange: Array<"source_selection" | "composition_timing" | "picture" |
                   "dialogue" | "graphics" | "captions" | "mix" | "look" | "delivery">;
};

type Constraint = {
  id: string;
  check: string; // closed constraint registry key
  severity: "hard" | "warning" | "needs_review";
  phase: "binding" | "scheduling" | "postcompile";
  scope?: { beatIds?: string[]; passIds?: string[]; timeline?: true };
  args?: Record<string, unknown>;
};

type ReviewSpec = {
  hunks: Array<{
    id: string;
    label: string;
    beatIds?: string[];
    passIds?: string[];
    preview: "boundary_loop" | "range" | "representative" | "full";
    preroll?: Time;
    postroll?: Time;
  }>;
  rubric: Array<{
    id: string;
    question: string;
    weight: number;
    kind: "editorial" | "technical";
  }>;
};

type Alternative = {
  id: string;
  label: string;
  objective: string;
  overrides: Array<
    | { path: `beats.${string}.choose.strategy`; value: "highest_ranked" | "first_declared" }
    | { path: `beats.${string}.choices`; value: SourceChoice[] }
    | { path: `recipes.${string}.parameters.${string}`; value: unknown }
    | { path: `passes.${string}.enabled`; value: boolean }
  >;
};

interface EditScript {
  schemaVersion: "0.1";
  id: string; // stable author-chosen slug
  title: string;
  inputs: {
    analysisId: string;
    evidenceHash: string;
    assetManifestHash: string;
    baseRevisionId: string;
    baseRevisionHash: string;
    style: { id: string; version: number; contentHash: string };
  };
  declarations: {
    brief: {
      purpose: string;
      audience?: string;
      requiredClaims?: string[];
      forbiddenClaims?: string[];
    };
    output: { width: number; height: number; fps: number; duration: { min: Time; target: Time; max: Time } };
    assets: Record<string, { assetId: string }>; // aliases only
    recipes: Record<string, { id: string; version: number }>;
    editorialCopy: Record<string, {
      text: string;
      role: "label" | "title" | "context" | "cta";
      authoredBy: "user" | "planner";
      supportsWithEventIds?: string[];
    }>;
  };
  selectors: Record<string, EvidenceSelector>;
  beats: Record<string, Beat>;
  beatOrder: string[];
  passes: Record<string, LayerPass>;
  passOrder: string[];
  constraints: Constraint[];
  alternatives: Alternative[];
  review: ReviewSpec;
}
```

Maps plus explicit order arrays are intentional. References remain stable when order changes, and array index is never identity.

## Resolution lock: the determinism boundary

Selectors are deterministic queries over a hashed catalog, but ranking policy and source analysis can change. Freeze their outcome before compilation:

```ts
interface ResolutionLock {
  schemaVersion: "0.1";
  scriptId: string;
  scriptHash: string;
  evidenceHash: string;
  selectedAlternativeId: string;
  selectorMatches: Record<string, string[]>; // sorted event IDs after filtering/ranking
  beatBindings: Record<string, Array<{
    role: string;
    eventId: string;
    sourceRange: SourceRange;
    selectorId?: string;
  }>>;
  resolvedRecipes: Record<string, {
    recipe: { id: string; version: number; contentHash: string };
    parameters: Record<string, unknown>;
    fallbacksTaken: string[];
  }>;
}
```

The UI/planner can regenerate a lock to explore an alternative. The compiler cannot substitute a different event after the lock is accepted. If a locked event disappears or its range no longer matches the evidence hash, compilation fails as stale.

## Concrete YAML authoring example

This example reproduces today's core behavior while making each decision visible. Time values use milliseconds for source analysis and frames for output scheduling; conversion is explicit in the compiler.

```yaml
schemaVersion: "0.1"
id: founder-profile-v1
title: Founder profile rough cut

inputs:
  analysisId: analysis_01
  evidenceHash: sha256:events...
  assetManifestHash: sha256:assets...
  baseRevisionId: rev_empty_01
  baseRevisionHash: sha256:timeline...
  style: { id: kumar-method, version: 1, contentHash: "sha256:style..." }

declarations:
  brief:
    purpose: Turn the source interview into a truthful, fast vertical founder profile.
    audience: Hackathon judges and social viewers.
    forbiddenClaims: [fabricated dialogue, unsupported credentials]
  output:
    width: 1080
    height: 1920
    fps: 30
    duration:
      min:    { ticks: 900,  ticksPerSecond: 30 }
      target: { ticks: 1350, ticksPerSecond: 30 }
      max:    { ticks: 1800, ticksPerSecond: 30 }
  assets:
    source: { assetId: source-1 }
    score: { assetId: score-1 }
  recipes:
    select:   { id: assembly.select-source, version: 1 }
    dialogue: { id: audio.dialogue-clean, version: 1 }
    captions: { id: captions.word-chunks, version: 1 }
    identity: { id: graphics.identity-card, version: 1 }
    accent:   { id: transition.accent, version: 1 }
    music:    { id: audio.music-bed, version: 1 }
  editorialCopy:
    identity_label:
      text: FOUNDER / BUILDER
      role: label
      authoredBy: planner

selectors:
  opening_claim:
    id: opening_claim
    assetIds: [source-1]
    kinds: [hook, claim]
    minScores: { selection: 0.72 }
    rank:
      - { field: selection, direction: desc, weight: 0.7 }
      - { field: sourceEarlier, direction: asc, weight: 0.3 }
    limit: 4
    distinctBy: sourceRange
  identity:
    id: identity
    assetIds: [source-1]
    kinds: [identity]
    minScores: { selection: 0.55 }
    rank: [{ field: selection, direction: desc, weight: 1 }]
    limit: 3
  proof:
    id: proof
    assetIds: [source-1]
    kinds: [proof, action, visual_change]
    minScores: { selection: 0.55 }
    rank:
      - { field: selection, direction: desc, weight: 0.7 }
      - { field: visualVariety, direction: desc, weight: 0.3 }
    limit: 8
    distinctBy: sourceRange
  candid:
    id: candid
    assetIds: [source-1]
    kinds: [reaction, humor]
    minScores: { selection: 0.5 }
    rank: [{ field: selection, direction: desc, weight: 1 }]
    limit: 3
  ending:
    id: ending
    assetIds: [source-1]
    kinds: [call_to_action, claim]
    tagsAny: [callback, promise, next-step]
    rank:
      - { field: selection, direction: desc, weight: 0.7 }
      - { field: sourceLater, direction: desc, weight: 0.3 }
    limit: 4

beats:
  hook:
    id: hook
    function: hook
    styleBeat: pattern_interrupt
    intent: Land a truthful premise immediately.
    targetDuration:
      min:   { ticks: 45, ticksPerSecond: 30 }
      ideal: { ticks: 75, ticksPerSecond: 30 }
      max:   { ticks: 90, ticksPerSecond: 30 }
    choices:
      - from: { selectorId: opening_claim }
        role: primary_dialogue
        trim:
          max: { ticks: 3000, ticksPerSecond: 1000 }
          preserve: [complete_phrase, word_boundary]
    choose: { strategy: highest_ranked, count: 1 }
    recipes:
      - id: hook_select
        recipe: { id: assembly.select-source, version: 1 }
        bind: { primary: primary_dialogue }
        parameters: { transitionIn: hard_cut, energy: 5 }
    fallback:
      - { when: no_match, action: block }
    reviewTags: [truth, first-three-seconds]

  identity:
    id: identity
    function: setup
    styleBeat: identity_authority
    intent: Establish the person and their authority.
    choices:
      - from: { selectorId: identity }
        role: primary_dialogue
        trim: { preserve: [complete_phrase] }
    choose: { strategy: highest_ranked, count: 1 }
    recipes:
      - id: identity_select
        recipe: { id: assembly.select-source, version: 1 }
        bind: { primary: primary_dialogue }
        parameters: { transitionIn: hard_cut, energy: 3 }
      - id: identity_card
        recipe: { id: graphics.identity-card, version: 1 }
        bind: { anchor: primary_dialogue }
        parameters: { copyId: identity_label, maxWords: 7 }
    fallback:
      - { when: no_match, action: request_review }

  proof:
    id: proof
    function: proof
    styleBeat: proof_escalation
    intent: Show specific proof with increasing energy.
    choices:
      - from: { selectorId: proof }
        role: montage_item
        trim:
          min: { ticks: 12, ticksPerSecond: 30 }
          max: { ticks: 72, ticksPerSecond: 30 }
          preserve: [action]
    choose: { strategy: highest_ranked, count: 3 }
    recipes:
      - id: proof_select
        recipe: { id: assembly.select-source, version: 1 }
        bind: { items: montage_item }
        parameters: { transitionIn: beat_cut, energy: 4 }
    fallback:
      - { when: missing_handles, action: use_hard_cut }
      - { when: no_match, action: block }

  human:
    id: human
    function: reaction
    styleBeat: human_record_scratch
    intent: Release tension with an authentic candid moment.
    optional: true
    choices:
      - from: { selectorId: candid }
        role: primary_dialogue
        trim: { preserve: [complete_phrase] }
    choose: { strategy: highest_ranked, count: 1 }
    fallback:
      - { when: no_match, action: omit_optional }
    reviewTags: [authenticity]

  cta:
    id: cta
    function: cta
    styleBeat: callback_cta
    intent: End on a complete phrase and clean impact.
    choices:
      - from: { selectorId: ending }
        role: primary_dialogue
        trim: { preserve: [complete_phrase, chronology] }
    choose: { strategy: highest_ranked, count: 1 }
    fallback:
      - { when: no_match, action: request_review }

beatOrder: [hook, identity, proof, human, cta]

passes:
  assembly:
    id: assembly
    phase: assembly
    scope: { all: true }
    recipes: [] # beat-local selection recipes run here
    mayChange: [source_selection, composition_timing, picture]
  dialogue:
    id: dialogue
    phase: dialogue
    after: [assembly]
    scope: { all: true }
    recipes:
      - id: dialogue_clean
        recipe: { id: audio.dialogue-clean, version: 1 }
        bind: { dialogue: all_primary_dialogue }
        parameters: { noiseReduction: true, compressor: true }
    mayChange: [dialogue, mix]
  captions:
    id: captions
    phase: captions
    after: [dialogue]
    scope: { all: true }
    recipes:
      - id: caption_chunks
        recipe: { id: captions.word-chunks, version: 1 }
        bind: { speech: conformed_dialogue }
        parameters: { maxWords: 4, maxDurationMs: 1800, uppercase: true }
    mayChange: [captions]
  decoration:
    id: decoration
    phase: decoration
    after: [captions, music]
    scope: { beats: [hook, proof, cta] }
    recipes:
      - id: accent_high_energy
        recipe: { id: transition.accent, version: 1 }
        bind: { boundaries: high_energy_boundaries }
        parameters: { allowed: [punch_in, rgb_split], maxDurationFrames: 24 }
    mayChange: [graphics]
  music:
    id: music
    phase: music
    after: [dialogue]
    scope: { all: true }
    recipes:
      - id: dark_pulse
        recipe: { id: audio.music-bed, version: 1 }
        bind: { timeline: whole_timeline }
        parameters: { assetAlias: score, volume: 0.24, duckUnderDialogueDb: -18 }
    mayChange: [mix]

passOrder: [assembly, dialogue, captions, music, decoration]

constraints:
  - { id: source_bounds, check: source_ranges_within_assets, severity: hard, phase: binding, scope: { timeline: true } }
  - { id: complete_speech, check: preserve_complete_phrases, severity: hard, phase: binding, scope: { timeline: true } }
  - { id: no_duplicate_source, check: forbid_unintentional_duplicate_ranges, severity: hard, phase: binding, scope: { timeline: true } }
  - { id: target_duration, check: duration_within_output_bounds, severity: hard, phase: scheduling, scope: { timeline: true } }
  - { id: hook_deadline, check: beat_ends_by, severity: warning, phase: scheduling, scope: { beatIds: [hook] }, args: { frame: 90 } }
  - { id: caption_safe_area, check: captions_inside_safe_area, severity: hard, phase: postcompile, scope: { passIds: [captions] } }
  - { id: effect_budget, check: style_effect_budget, severity: warning, phase: postcompile, scope: { passIds: [decoration] } }

alternatives:
  - id: minimal
    label: Minimal / speech-led
    objective: Maximize clarity and minimize decorative effects.
    overrides:
      - { path: passes.decoration.enabled, value: false }
  - id: performance_led
    label: Performance-led hook
    objective: Prefer the earliest strong delivery over the highest novelty score.
    overrides:
      - { path: beats.hook.choose.strategy, value: first_declared }

review:
  hunks:
    - id: story_cut
      label: Story and source choices
      beatIds: [hook, identity, proof, human, cta]
      preview: full
    - id: finishing
      label: Captions, accents, and mix
      passIds: [captions, decoration, music]
      preview: representative
  rubric:
    - { id: story, question: Do the beats form a coherent arc?, weight: 30, kind: editorial }
    - { id: truth, question: Does every spoken claim retain its source context?, weight: 25, kind: editorial }
    - { id: rhythm, question: Does the cut escalate without exhausting attention?, weight: 20, kind: editorial }
    - { id: ranges, question: Are ranges, sync, and collisions valid?, weight: 25, kind: technical }
```

## Recipe contract and P0 registry

A recipe is separately versioned implementation data. `EditScript` references it by `{id, version}` and supplies bindings/parameters. Keep the P0 registry intentionally small:

| Recipe | Inputs | Intent IR output | Current editor lowering |
|---|---|---|---|
| `assembly.select-source@1` | one or more source bindings | sequential video/audio placements | `element.insert` on `v1` and `a1` |
| `audio.dialogue-clean@1` | conformed primary dialogue | audio chain | audio element with existing effect strings |
| `captions.word-chunks@1` | transcript words mapped through selected ranges | caption cues in composition time | `element.insert` on `c1` |
| `graphics.identity-card@1` | beat placement + editorial title | timed text overlay | `element.insert` on `g1` |
| `transition.accent@1` | a boundary with sufficient source duration | boundary accent intent | P0 `v2` accent element; hard-cut fallback |
| `audio.music-bed@1` | whole composition | music placement + ducking intent | audio element on `a2` |

The current `TimelineOperation` type has no first-class transition, link group, typed effect, or batch precondition. Recipes must not imply capabilities the editor cannot represent. Use the structural P0 lowering above; later add domain operations and richer bindings without changing script semantics.

P0 `element.insert` also assumes tracks already exist. The compiler should require or deterministically initialize the standard skeleton (`v1`, `v2`, `g1`, `c1`, `a1`, `a2`) before lowering; it must not emit inserts to missing tracks.

Each recipe implementation declares:

```ts
interface RecipeDefinition {
  id: string;
  version: number;
  slots: Record<string, { accepts: string[]; min: number; max: number }>;
  parameterSchema: unknown; // Zod schema in implementation
  phase: LayerPass["phase"];
  requiresCapabilities: string[];
  reads: string[];
  writes: string[];
  fallbacks: string[];
  expand(input: FrozenRecipeInput): IntentNode[]; // pure function
}
```

`IntentNode` remains renderer-neutral (`place_source`, `place_dialogue`, `add_caption`, `add_text`, `add_accent`, `mix_music`). A separate adapter lowers it into today's `TimelineOperation` union. This keeps editorial recipes usable when the timeline model grows.

## Pass ordering and ownership

Default dependency order:

```text
assembly -> dialogue -> coverage/layout -> captions -> grade -> music -> decoration -> delivery
```

The declared `passOrder` is presentation order; `after` edges are the actual dependency graph. Validate both and reject cycles. A pass may only modify fields named by `mayChange`:

- `assembly` alone may select sources or change core composition timing;
- `dialogue` may conform linked dialogue and mix it, but not choose a different quote;
- `captions` read the conformed dialogue, never the original uncut transcript;
- `grade`, `music`, and `decoration` cannot move a story cut;
- `delivery` cannot repair editorial errors by changing content.

If two passes write the same exclusive resource (for example the same boundary or primary caption lane), require an explicit dependency and winner. Do not rely on object iteration order.

## Deterministic binding, scheduling, and IDs

### Selector evaluation

1. Verify `evidenceHash`.
2. Filter using only declared predicate fields.
3. Normalize text with Unicode NFKC and locale-independent case folding.
4. Score declared rank terms; missing scores sort last.
5. Break ties by `event.id` ascending.
6. Apply `distinctBy` and `limit`.
7. Execute the fallback ladder if cardinality is unsatisfied.
8. Persist all matches and final choices in `ResolutionLock`.

### Scheduling

P0 schedules chosen uses sequentially in `beatOrder`, so composition start is the sum of prior conformed durations. Source ranges remain unchanged. Later recipes may create overlap, but must declare it (for example a J-cut audio lead). Composition times are compiler output, never copied from source time.

All time conversion uses:

```text
targetTicks = roundHalfToEven(sourceTicks * targetScale / sourceScale)
```

Quantize picture placement to output frames. Retain transcript/audio source ticks for caption and speech-boundary calculations, then map them through each placed clip.

### Stable identifiers

Canonicalize objects with sorted keys and normalized numeric/time values. Then use a namespaced SHA-256 prefix:

```text
scriptInstanceHash = sha256(canonical(EditScript) + canonical(ResolutionLock))
proposalId         = "proposal_" + sha256(baseRevisionHash + scriptInstanceHash + compilerVersion)[0:20]
commandId(path)    = "op_"       + sha256(proposalId + ":" + logicalPath)[0:20]
elementId(path)    = "el_"       + sha256(proposalId + ":" + logicalPath)[0:20]
```

Logical paths use declared IDs, never indexes: `beats.proof.bindings.montage_item.event_17.video`, not `beats[2].choices[0]`. The same frozen inputs produce byte-identical normalized operations. A changed base revision produces a different proposal and command namespace.

## Compiler phases and diagnostics

```ts
compile(
  script: EditScript,
  lock: ResolutionLock,
  evidence: EvidenceCatalog,
  assets: AssetManifest,
  base: TimelineDocument,
  compilerVersion: string,
): {
  proposalId: string;
  operations: TimelineOperation[];
  diagnostics: Diagnostic[];
  hunks: ReviewHunk[];
  outputTimelineHash?: string;
}
```

Phases:

1. Schema validation and reference resolution.
2. Input-hash and base-revision checks.
3. Resolution-lock verification.
4. Hard binding constraints and declared fallbacks.
5. Sequential beat scheduling in composition time.
6. Recipe expansion to intent nodes.
7. Pass DAG topological sort and ownership checks.
8. Intent lowering to stable `TimelineOperation`s.
9. Simulation on a copy of `TimelineDocument`.
10. Postcompile constraints and review-hunk construction.
11. Canonical operation hash. Return no applicable proposal if any hard diagnostic remains.

```ts
interface Diagnostic {
  code: string; // stable: SOURCE_RANGE_OOB, STALE_BASE, MISSING_HANDLES, ...
  severity: "error" | "warning" | "needs_review";
  message: string;
  objectIds: string[];
  evidenceIds: string[];
  suggestedFallbackId?: string;
}
```

Subjective rubric answers never originate from this validator. They can be proposed by a model and confirmed by a human, with confidence shown separately.

## Alternatives and fallbacks

These are different mechanisms:

- An **alternative** is an intentional, inspectable editorial strategy selected before locking, such as minimal versus performance-led. It gets its own `ResolutionLock` and proposal ID.
- A **fallback** is a bounded repair for a known precondition failure, such as hard cut when transition handles are missing.

Rules:

1. Alternatives use a closed override vocabulary and cannot weaken hard constraints.
2. Every alternative names an objective; cosmetic random seeds are not meaningful variants.
3. Fallbacks execute in declaration order, record `fallbacksTaken`, and stop after the first valid repair.
4. Fallback chains must be acyclic and finite.
5. `omit_optional` is only legal for a beat with `optional: true`; the sample human beat is the only intended P0 case.
6. `request_review` produces no silent timeline mutation for that beat.
7. `block` terminates compilation with evidence-linked diagnostics.

## Review output

The compiler groups operations into stable hunks using `review.hunks`. Each hunk includes:

```ts
interface ReviewHunk {
  id: string;
  label: string;
  operationIds: string[];
  beatIds: string[];
  passIds: string[];
  evidenceIds: string[];
  sourceRanges: SourceRange[];
  affectedCompositionRanges: CompositionRange[];
  diagnostics: Diagnostic[];
  preview: { kind: string; preroll: Time; postroll: Time };
}
```

The story cut and finishing layers should normally be separate hunks. This lets the user approve source/story choices before decorative work and supports partial re-generation without pretending independent operations are safe when they share dependencies.

## Migration from the current `AnalysisResult`

No analyzer rewrite is required for the first slice.

### Normalize current events

For every `AnalysisResult.events[i]`:

```ts
{
  id: event.id,
  kind: event.kind,
  range: {
    space: "source",
    assetId: "source-1",
    start:    { ticks: Math.round(event.start * 1000), ticksPerSecond: 1000 },
    duration: { ticks: Math.round((event.end - event.start) * 1000), ticksPerSecond: 1000 }
  },
  summary: event.summary,
  transcript: event.transcript,
  visual: event.visual,
  tags: event.tags,
  scores: { selection: event.selectionScore },
  producer: { name: response.usage.analysisModel, version: "current" }
}
```

Reject invalid/empty ranges before normalization. Preserve original event IDs when present; only derive an ID from immutable asset hash + normalized range + kind if missing.

### Lift current segments into a locked legacy script

Each current `timeline.segments[i]` becomes one beat instance. Use `segment.id` as the beat ID and map its style beat to the generic function:

| Current `storyBeat` | New `function` |
|---|---|
| `pattern_interrupt` | `hook` |
| `identity_authority` | `setup` |
| `ambition_conflict` | `claim` |
| `proof_escalation` | `proof` |
| `human_record_scratch` | `reaction` |
| `callback_cta` | `cta` |

Create a direct locked `SourceChoice` using the segment's exact source range. Add all overlapping event IDs as lineage. Preserve:

- `rationale` as beat `intent`;
- `title` as `graphics.identity-card` or generic title recipe parameters;
- `transition` as `assembly.select-source.parameters.transitionIn`;
- `effects` as a `legacy.effects` recipe invocation in `decoration` until typed recipes cover them;
- `energy` as recipe parameter and style-budget input;
- segment array order as `beatOrder`;
- `timeline.targetDuration` as output target, but recompute and validate actual duration;
- `review` as an imported editorial rubric result, never as technical validation.

The generated `ResolutionLock` uses the direct ranges, so the first compiler can reproduce current output without implementing selector ranking. Once selectors are enabled, newly planned scripts use event references instead of segment-authored naked ranges.

### Preserve current `timelineFromAnalysis` behavior as recipes

The compatibility profile should produce:

1. sequential `v1` video and `a1` dialogue per selected source range;
2. dialogue effects `noise-reduction` and `compressor`;
3. title overlay when `segment.title` is present;
4. `v2` accent when `energy >= 4` and duration is at least 1.5 seconds;
5. captions grouped from words inside each conformed source selection;
6. one `a2` music bed covering compiled composition duration.

The only intended output change is deterministic timeline/element IDs instead of `analysis-${Date.now()}`.

## P0 implementation slices

1. Add Zod schemas for `Time`, `SourceRange`, `EditScript`, and `ResolutionLock`.
2. Implement `migrateAnalysisToScript(response)` using direct locked segment ranges.
3. Implement canonical hashing and deterministic IDs.
4. Implement the six-recipe compatibility registry and compile to today's `TimelineOperation` union.
5. Apply operations to a fresh `TimelineDocument` in memory and compare against current `timelineFromAnalysis` output (ignoring IDs).
6. Add hard checks: stale base, source bounds, positive ranges, target duration, track compatibility, and caption range.
7. Expose story-cut and finishing review hunks.
8. Then enable evidence selectors and two alternatives (`minimal`, `performance_led`) without changing the compiler boundary.

Defer first-class transitions, J/L cuts, rational rates beyond safe integer ticks, typed effects/keyframes, OTIO export, and revision branching until the editor model supports them. The script language already leaves room for those capabilities without claiming they work today.

## Acceptance tests

- Same analysis, style hash, base revision, selected alternative, and compiler version produce identical proposal, operation, and element IDs.
- Reordering JSON object keys does not change hashes or output.
- Reordering `beatOrder` changes composition placement but not declared beat IDs.
- Changing a source event range invalidates the evidence hash and lock.
- A stale base revision produces `STALE_BASE` and zero applicable operations.
- A segment outside the asset duration produces `SOURCE_RANGE_OOB` and zero applicable operations.
- Captions are generated only from words inside selected source ranges and appear in mapped composition time.
- Missing transition handles take the declared hard-cut fallback and record it.
- A missing required hook blocks; a missing optional human beat may be omitted and is reported.
- The minimal alternative disables decoration without changing source selections unless its own lock says so.
- Technical failures cannot be overridden by an editorial review score.
- Migrated `AnalysisResult` produces the same track/element semantics as current `timelineFromAnalysis`, except for deterministic IDs.
