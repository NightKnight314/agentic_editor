# Hackathon sketch synthesis

Date: 2026-07-25  
Source: four handwritten Samsung Notes sketches in `images/`.

This note translates the founder's travel sketches into shared terminology and research requirements. It is architectural guidance, not an implementation change.

## The product thesis in one line

```text
source dump → multimodal evidence/events → story/narrative → edit plan → timeline → stylistic layers → human review → revision
```

The central idea is that an AI editor should not jump directly from a prompt and raw media to rendered video. It should build an inspectable intermediate representation of what occurs in the source, use that evidence to construct a narrative, compile the narrative into timeline operations, and add style in controlled passes.

## Sketch 1: source, prompts, scripts, timeline, builder, review

The first sketch proposes:

- a source dump analyzed into video, audio, text, vision, and image signals;
- prompts and scripts feeding timeline events;
- a builder converting events into clips;
- review through specification matching;
- a re-plan loop when the result does not match the specification.

### Research interpretation

Replace the ambiguous word `script` with three explicit artifacts:

1. **Brief:** audience, purpose, target duration/platform, required and forbidden content.
2. **Beat plan:** ordered narrative functions and supporting evidence.
3. **Operation proposal:** executable, reversible timeline mutations.

Treat “builder” as a deterministic compiler and renderer boundary:

```text
brief + style map + source evidence
  → planner
  → proposed edit decision graph
  → constraint verifier
  → timeline-operation compiler
  → preview/render
```

Review should have two independent outputs:

- **Editorial review:** story clarity, emotion, truth, rhythm, style fit.
- **Technical verification:** ranges, sync, handles, collisions, captions, color/audio/delivery.

A technically valid cut can be editorially weak; an excellent plan can fail during execution. Do not collapse these into one score.

## Sketch 2: reusable build patterns and layered construction

The second sketch lists fonts, effects, transitions, example timelines, layering, agent views of clips, step decomposition, reinforcement/preference learning, stacked effects, shaders, and animation. It proposes starting with the timeline and building layer by layer.

### Research interpretation

Create a reusable **edit-pattern library**, but model patterns as parameterized recipes rather than opaque presets:

```ts
interface EditPattern {
  id: string;
  version: number;
  intent: string;
  appliesWhen: Predicate[];
  requires: Capability[];
  steps: PatternStep[];
  parameters: ParameterSchema;
  constraints: Constraint[];
  effectBudget?: EffectBudget;
  review: ReviewCriterion[];
  fallback: FallbackPolicy;
}
```

Candidate pattern families:

- transcript/radio-cut patterns;
- hook, reveal, proof, reaction, callback, and CTA beats;
- J/L-cut dialogue bridges;
- match-on-action and cutaway coverage;
- music montage and beat-emphasis patterns;
- caption chunking and active-word emphasis;
- identity cards, lower thirds, and end cards;
- reframing, split screen, picture-in-picture, and comparison layouts;
- audio cleanup, ducking, and loudness delivery chains;
- grade normalization, shot match, and creative look layers.

Every recipe needs preconditions, required source handles, typed parameters, bounded effects, semantic intent, and a fallback. A transition recipe must not manufacture missing handles; a customer-reaction recipe must not run without an authentic reaction.

### Layer order

Use dependency order rather than arbitrary effect stacking:

1. source and conform;
2. story/radio cut;
3. picture coverage and continuity;
4. dialogue and base audio continuity;
5. reframing and spatial layout;
6. captions and information graphics;
7. color normalization and creative look;
8. music, effects, and mix automation;
9. decorative motion/effects;
10. output transform, encode, and QC.

Allow style maps to reorder compatible creative passes, but keep technical dependencies explicit.

### Feedback data instead of hackathon-time model training

Do not begin with online RLHF/RLAIF. Record structured interaction data:

- proposal shown;
- accepted, rejected, modified, or reverted;
- exact human delta from proposal to accepted timeline;
- reason tags and free-text feedback;
- media/format/style context;
- planner, model, and recipe versions;
- time to decision and later publish state.

This immediately improves retrieval, ranking, and evaluation while creating a future preference-learning dataset.

## Sketch 3: multimodal arrays and event extraction

The third sketch represents video, images, and audio as indexed streams, then proposes image descriptions, audio transcription/splicing, audio event timelines, image-based scene changes, and a unified event list.

### Research interpretation

The event list should be the platform's evidence layer, not a flat natural-language summary. Keep stream-native timing and uncertainty.

```ts
interface MediaEvent<T = unknown> {
  id: string;
  assetId: string;
  streamId: string;
  sourceRange: RationalTimeRange;
  kind:
    | "speech" | "speaker_turn" | "silence" | "music" | "sound"
    | "shot" | "transition" | "scene" | "face" | "action"
    | "object" | "text" | "quality" | "user_marker";
  value: T;
  confidence?: number;
  boundaryUncertainty?: { startMs?: number; endMs?: number };
  producer: { name: string; version: string; parametersHash: string };
  parents: string[];
  status: "machine" | "human_confirmed" | "human_rejected" | "superseded";
}
```

Maintain at least three levels:

- **Evidence events:** detected or user-authored facts about source media.
- **Narrative beats:** editorial functions supported by evidence.
- **Timeline events/operations:** composition-time decisions referencing source evidence.

Do not use one `events` array for all three. Their truth conditions and clocks differ.

### Multimodal fusion rules

- Run analyzers independently so any one can be replaced or recomputed.
- Join results through source ranges and stable identities, not generated prose alone.
- Preserve disagreements: audible speech with no visible active speaker can be voice-over, offscreen speech, dubbing, overlap, or sync error.
- Store raw or compact confidence curves where later thresholds may change.
- Keep `unknown` and unclassified pools so ambiguous but valuable material is not discarded.
- Segment video at real cuts before smoothing face tracks, crop paths, grades, or optical flow.

## Sketch 4: events to narrative, draft, style, V1, feedback, discrepancies

The fourth sketch proposes an event-list-to-story transformation, a timeline draft, stylistic layering, presentation of V1 to a human, feedback, discrepancy detection, and iteration until done.

### Research interpretation

Use an explicit revision protocol:

```text
revision N
  → proposal against baseRevision N
  → preflight verification
  → preview + evidence + warnings + alternatives
  → human accept/reject/modify
  → atomic revision N+1 or no change
  → editorial + technical review
  → next discrepancy list
```

Discrepancies should be typed:

- missing/unsupported story beat;
- redundant or unclear beat;
- truth/context/chronology risk;
- continuity or performance issue;
- pacing/readability issue;
- style-map deviation;
- source-range, handle, sync, or collision failure;
- accessibility, color, audio, or delivery failure;
- low-confidence inference requiring confirmation.

Each discrepancy needs severity, affected range, supporting evidence, proposed repairs, and resolution status.

## Shared vocabulary

| Sketch term | Recommended product term |
|---|---|
| Source dump | Immutable asset inventory |
| Analyze | Versioned multimodal analyzers |
| Events | Source evidence events |
| Story/narrative | Beat graph / edit outline |
| Script | Brief, beat plan, or operation proposal—name the specific artifact |
| Builder | Verifier + timeline-operation compiler + renderer |
| Clip | Timeline item referencing a source range |
| Spec matching | Constraint checks plus editorial rubric |
| Re-plan | New proposal against an immutable base revision |
| Build pattern | Parameterized, constrained edit recipe |
| Stylistic layering | Ordered creative finishing passes |
| Feedback | Structured accept/reject/modify/revert record |
| Discrepancy | Typed review issue with evidence and repair options |

## Recommended research and product priorities

1. Formalize the three-layer event model: evidence, narrative beats, timeline operations.
2. Specify revision/proposal/approval/undo semantics.
3. Build a small pattern library with preconditions, typed parameters, fallbacks, and review rules.
4. Visualize evidence-to-beat-to-timeline lineage in the agent UI.
5. Record structured human deltas instead of attempting immediate preference-model training.
6. Compile the existing `kumar-method` map into candidate scoring, operation bounds, effect budgets, and review criteria.
7. Demonstrate one complete loop: transcript and shot events → truthful hook alternatives → preview → approval → verified timeline revision.

## Post-research refinement: the smallest coherent system

The follow-on event-model, pattern-system, and human-agent research converges on this canonical chain:

```text
Asset
  → Observation
  → EvidenceAssertion
  → SourceEvent
  → NarrativeBeat
  → CandidateUse / EditIntent
  → CommandEnvelope
  → immutable TimelineRevision
```

Each boundary has one job:

- observations retain detector- or human-shaped outputs and uncertainty;
- evidence assertions make falsifiable propositions from observations;
- source events resolve what likely occurred without pretending editorial wishes are facts;
- beats express story function and can reorder presentation without rewriting source chronology;
- candidate uses bind evidence to beat roles while preserving alternatives;
- edit intents say what transformation should occur;
- command envelopes carry closed, deterministic operations, evidence, and preconditions;
- accepted commands create a new revision rather than overwriting the current cut.

For the hackathon pattern library, prioritize three recipes:

1. `dialogue.j-cut-bridge` — demonstrates independent audio/picture timing, handle validation, and honest hard-cut fallback.
2. `montage.beat-proof` — demonstrates evidence-slot binding, duration/diversity optimization, music as a soft target, and graceful reduction from five to two valid shots.
3. `graphics.identity-card` — demonstrates protected intro/outro animation, elastic hold, typed text/layout controls, and aspect-ratio-safe rendering.

For review, the smallest convincing interaction is:

```text
accepted revision
  → proposal against exact base revision
  → deterministic preflight
  → aligned diff + changed-range preview + evidence + warnings
  → Apply selected / Keep current / Edit
  → new immutable revision or no mutation
  → later revert creates another revision
```

Log `exposed`, `previewed`, `accepted`, `partially_accepted`, `rejected`, `modified`, `dismissed`, `reverted`, `published`, and `abandoned` distinctly. Store which alternatives were shown and in what order. This makes later preference learning possible without mislabeling unseen or abandoned choices.

## Relationship to the research pack

- `ai-assisted-editing-methodologies.md` supports evidence stores, rational time, analyzers, confidence, patch verification, and evaluation.
- `editorial-methodologies.md` supports beat construction, truth constraints, continuity, pacing, and method selection.
- `post-production-methodologies.md` supports ordered finishing layers and profile-driven QC.
- `style-map-authoring.md` supports compiling creative direction into planner constraints and review rubrics.
- `platform-integration-blueprint.md` maps these ideas to the current prototype's data-model gaps and implementation order.
