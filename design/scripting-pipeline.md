# Nighthack scripting pipeline

Status: implementation design  
Date: 2026-07-25  
Audience: the app implementation agent and future maintainers

## Decision summary

Introduce an `EditScript` between media analysis and timeline mutation.

```text
media
  → analysis observations/events
  → EditScript (creative, declarative, inspectable)
  → resolved script (all selectors bound to exact evidence/source ranges)
  → compiled proposal (typed timeline-operation batch + diagnostics + diff)
  → preview and human approval
  → immutable timeline revision
  → render and QC
```

The language model may produce or revise an `EditScript`. It must not emit unchecked mutations against the live timeline. Resolution, compilation, validation, diffing, and application are deterministic application responsibilities.

This preserves the useful work already present in:

- `src/lib/analysis/schema.ts`: structured analysis output;
- `src/lib/analysis/sanitize.ts`: source-bound and duration cleanup;
- `src/lib/analysis/timeline.ts`: initial analysis-to-timeline lowering;
- `src/lib/editor/types.ts`: timeline state and operation vocabulary;
- `src/lib/editor/operations.ts`: operation application.

The proposal is additive: move creative assembly out of `timelineFromAnalysis`, then evolve timing and revision semantics without blocking the demo.

## Why call it a script?

The script is a declarative editorial program—not JavaScript, an LLM prompt, a transcript, or a screenplay. It states:

- the output contract;
- the narrative beats and their purposes;
- which source evidence may satisfy each beat;
- how chosen evidence should be assembled;
- which reusable edit patterns and finishing passes to apply;
- hard constraints, soft preferences, fallbacks, and review criteria.

It deliberately stops short of committing exact low-level mutations. A selector such as “the highest-scoring verified hook containing the deadline” becomes an exact source range during resolution. A recipe such as “responsive identity card” becomes several timeline operations during compilation.

## Artifact boundaries

Do not overload `analysis`, `events`, `script`, or `timeline`.

| Artifact | Responsibility | May be stochastic? | May mutate live timeline? |
|---|---|---:|---:|
| `AnalysisEnvelope` | Preserve transcript, visual/audio observations, source events, quality, and provenance | Yes | No |
| `EditScript` | Express story intent, selectors, patterns, constraints, and review contract | Yes | No |
| `ResolvedScript` | Bind every selected role to exact immutable evidence and source ranges | No | No |
| `CompiledProposal` | Carry typed operations, semantic hunks, diagnostics, diff, and preview scope | No | No |
| `TimelineRevision` | Represent accepted editor state with parent/base identity | No | Created atomically |
| `RenderManifest` | Record delivery profile, output, measurements, and QC | No | No |

The current `AnalysisResult` combines analysis, story decisions, a proposed edit, and a review score. Preserve it as a V1 transport shape, but normalize it into the new boundaries before adding features.

## Pipeline stages

### 1. Ingest

Create immutable asset facts:

- stable `assetId` derived from content identity;
- original/proxy locators;
- exact duration, rate/timebase, dimensions, rotation, audio layout, and color metadata;
- source availability range;
- source hash and analysis revision.

For P0, the current imported asset ID and seconds can remain at the UI boundary. Do not let `Date.now()` or filename be the persistent identity of an edit decision.

### 2. Analyze

Analyzers produce observations, not edits:

- transcript words/segments and confidence;
- shot/scene boundaries;
- speakers, visible subjects, actions, text, audio events, and quality;
- source events such as `says`, `demonstrates`, `reacts`, and `call_to_action`;
- model/tool version and source range for every claim.

The current sparse 12-frame sample is useful for a hackathon overview, but cannot support frame-accurate visual claims or transition handles. Preserve that limitation in diagnostics (`visual_sampling_sparse`) instead of converting it into confident detail.

### 3. Author the edit script

An agent or human creates `EditScript@1` from:

- brief;
- style map;
- analysis/event catalog;
- current accepted timeline and locks;
- target delivery profile.

The script contains stable beat IDs and selector clauses. It may request alternatives, but may not name arbitrary object mutations.

### 4. Normalize and statically validate

Before media selection:

- parse and schema-validate;
- apply explicit defaults;
- resolve style/brief references by version;
- reject unknown recipe IDs, effect IDs, units, or parameters;
- build the beat/recipe dependency DAG and reject cycles;
- verify required fallbacks exist;
- assign deterministic IDs where omitted.

This phase never reads mutable UI state except through the named base revision.

### 5. Resolve selectors

Bind semantic requests to exact source evidence:

```text
beat selector
  → eligible events
  → hard-filtered candidates
  → scored candidates
  → selected binding plus alternatives
  → exact source range and evidence lineage
```

Hard filters run before ranking: range availability, human rejection, rights, required transcript completeness, source confidence threshold, speaker/person locks, chronology, and required handles.

The resolver emits `missing_evidence`, `ambiguous_binding`, or a fallback. It never invents a range to satisfy a required beat.

### 6. Schedule the assembly

Compute composition placement from the beat order and resolved durations. Prefer sequential scheduling plus explicit gaps/overlaps. Keep source selection distinct from composition placement.

For P0:

- one project output rate;
- forward, constant-speed source playback;
- half-open intervals;
- sequential primary video/dialogue assembly;
- overlay/caption/music tracks derived from recipes.

The canonical future representation should be integer ticks with rational rate. Until the timeline model migrates from floating-point seconds, quantize once at the compiler boundary and never accumulate rounded deltas.

### 7. Expand edit patterns

Patterns compile semantic intent into dependency-aware operations:

- J/L-cut bridges;
- proof montage;
- responsive identity card;
- caption layout;
- dialogue-cleanup and music-ducking passes;
- grade/look and restrained accent effects.

Patterns declare prerequisites, parameters, reads/writes, protected ranges, effect budget, fallback, and postconditions. They cannot override source truth, user locks, delivery requirements, or required reading/speech time.

### 8. Compile domain commands

Lower the resolved script into a closed command vocabulary. Prefer domain commands such as:

- `place_clip`, `trim_item`, `move_item`, `split_item`, `remove_item`;
- `link_items`, `bridge_audio`, `add_transition`;
- `add_title`, `add_caption`, `set_transform`, `set_effect`, `set_gain`;
- `create_track`, `add_marker`.

An adapter may lower these into today's five `TimelineOperation` variants. Keep the richer domain command in the proposal so semantic intent is not lost.

### 9. Preflight against a clone

Apply the entire batch to an isolated copy of the named base revision, then validate:

- base revision and touched-item preconditions;
- source range availability and positive duration;
- project-bound and frame-grid timing;
- track compatibility, lock state, collisions, and intentional gaps;
- linked A/V sync and transition handles;
- required beats/claims and complete speech;
- caption timing/collision and effect budget;
- exact expected duration delta;
- deterministic replay and inverse/snapshot availability.

Hard failures block the proposal. Warnings remain visible and scoped.

### 10. Present a proposal

The proposal is the agent's user-facing unit, not an already-mutated timeline.

It includes:

- one-sentence summary;
- base revision ID/hash;
- semantic hunks with operation dependencies;
- evidence and source ranges;
- changed output ranges and ripple scope;
- warnings and blocked alternatives;
- before/after timing and duration;
- appropriate preview scopes;
- `Apply selected`, `Keep current`, and `Edit` choices.

Speech edits need transcript/waveform diffs plus A/V context. Reframes need overlay or before/after frames. Global style passes need representative ranges, not just a text list.

### 11. Commit a revision

On approval:

1. confirm the base revision is still current;
2. re-run cheap preconditions;
3. apply all selected dependent hunks atomically;
4. create a new immutable revision;
5. retain the proposal, evidence, compiler version, and user decision;
6. make revert create another revision rather than erasing history.

If the proposal is stale, re-resolve and require review of the refreshed diff. Never apply it to “whatever is current.”

### 12. Render and verify

Rendering consumes only an accepted revision and a named delivery profile. Probe and review the encoded artifact. Render success does not retroactively validate editorial evidence.

## Proposed P0 types

These are conceptual boundaries; exact schemas live in the companion language/compiler docs.

```ts
interface EditScript {
  schemaVersion: "0.1";
  id: string;
  baseRevisionId: string;
  brief: BriefRef | InlineBrief;
  style: StyleMapRef;
  output: OutputContract;
  beats: ScriptBeat[];
  passes: ScriptPass[];
  constraints: ScriptConstraint[];
  alternatives?: AlternativePolicy;
  review: ReviewContract;
}

interface ResolvedBeat {
  beatId: string;
  eventIds: string[];
  sourceSelections: SourceSelection[];
  exactDuration: RationalDuration;
  confidence: ConfidenceBreakdown;
  alternatives: CandidateBinding[];
  fallbacksTaken: string[];
}

interface CompiledProposal {
  proposalId: string;
  scriptId: string;
  baseRevisionId: string;
  baseRevisionHash: string;
  resolvedBeats: ResolvedBeat[];
  hunks: ProposalHunk[];
  domainCommands: DomainCommand[];
  timelineOperations: TimelineOperation[];
  diagnostics: Diagnostic[];
  previewScopes: PreviewScope[];
  expectedTimelineHash: string;
}
```

## Current-to-proposed mapping

| Current field/behavior | P0 destination |
|---|---|
| `AnalysisResult.summary` | analysis summary; never executable |
| `sourceQuality` | observations/quality diagnostics |
| `events[]` | normalize to evidence-bearing source events |
| `timeline.targetDuration` | output contract duration target |
| `timeline.segments[]` | migrate into script beats with explicit event/range selectors |
| segment `storyBeat` | beat function or style-map beat reference |
| segment `transition/effects` | pattern requests, not unchecked string effects |
| `review` | initial critic output; split hard verifier from editorial rubric |
| `sanitizeAnalysis` | retain source sanitization; add structured diagnostics rather than silent clamping |
| `timelineFromAnalysis` | replace with `normalize → resolve → compile → propose`; call only after approval for legacy fallback |
| immediate `runOperations` | proposal preview and explicit commit |

## Silent repair versus diagnostic policy

The current sanitizer clamps ranges and caps segments. Silent repair is acceptable only when it cannot change editorial meaning and the repair is recorded.

| Condition | Policy |
|---|---|
| tiny floating-point drift at source end | quantize/clamp and emit `timing_quantized` info |
| source range materially exceeds media | block selection |
| segment too long | choose an aligned shorter candidate or require review; do not arbitrarily cut mid-thought |
| output exceeds duration | re-resolve optional beats or propose alternatives |
| missing required beat | explicit missing-evidence diagnostic |
| unsupported transition/effect | apply declared fallback with warning or block |
| missing handles | shorten, substitute cut, or block—never freeze invisibly |
| unsupported title claim | remove or require evidence; never trust generated title text |

Every repair should retain original request, applied repair, reason, affected IDs, and severity.

## Scripting passes

Use explicit passes with declared dependencies:

```text
assembly
  → coverage
  → dialogue_continuity
  → reframe_layout
  → information_graphics
  → captions
  → picture_finish
  → music_sound_mix
  → decorative_accents
  → delivery_qc
```

Passes produce proposals or add hunks to one proposal. The app may initially compile them in one request, but the model should remain inspectable layer by layer. A later pass may not rewrite an earlier pass's protected decisions without declaring the conflict.

## Alternatives

Generate a small number of structurally meaningful alternatives, normally:

- `minimal`: least mutation and fewest effects;
- `balanced`: brief/style default;
- `energy_first` or another explicit strategy.

All alternatives must compile against the same base and evidence snapshot. Align them by source and beat so differences are cheap to inspect. Do not generate cosmetic random seeds and call them creative choices.

## Trust boundaries

- Treat analysis model output as claims with provenance, not truth.
- Treat the edit-script model as a planner, not an executor.
- Treat deterministic validators as necessary but insufficient for editorial quality.
- Treat human approval as authority to create a revision, not proof the edit is universally good.
- Treat publish/render as a separate permission boundary.

High-impact transformations require review: reordered speech, removed negation/qualification, chronology changes, reactions, identity, unsupported proof, generated frames, synthetic voice/image, and major deletions.

## Recommended module boundaries

Suggested implementation locations; these are not changes made by this design task:

```text
src/lib/scripting/
  schema.ts          parse and version EditScript
  normalize.ts       defaults, IDs, style/brief references
  selectors.ts       eligibility and candidate ranking
  schedule.ts        source selection → composition placement
  recipes.ts         recipe registry and expansion
  compile.ts         resolved script → domain commands/operations
  validate.ts        static, preflight, post-state validators
  diagnostics.ts     stable error codes and repair metadata
  proposal.ts        hunks, diffs, preview scopes
  revision.ts        base hashes, atomic commit, snapshots/inverses
```

Keep the analyzer, script planner, deterministic compiler, timeline engine, and renderer replaceable. Avoid one giant API route that performs all stages and returns only a final timeline.

## P0 build sequence

1. Add `EditScript@1` schema around the existing `timeline.segments` concept.
2. Normalize current analysis events into stable `byId` maps with source/evidence references.
3. Convert the current generated segments into a script rather than directly into a timeline.
4. Compile the script to today's `TimelineOperation[]` through a deterministic adapter.
5. Add structured diagnostics for bounds, duration, title evidence, complete speech, and unknown effects.
6. Introduce `baseRevisionId`, a timeline snapshot/hash, and non-mutating proposal state.
7. Show proposal summary, affected ranges, warnings, and Apply/Keep controls.
8. Apply atomically and retain the previous snapshot for revert.
9. Add the three initial recipes: J-cut bridge, proof montage, responsive identity card.
10. Run the worked Kiro fixture as a repeatable acceptance test.

## Demo acceptance criteria

The scripting pipeline is credible when:

1. the same script, base revision, evidence snapshot, and compiler version produce the same proposal;
2. every placed clip traces to exact source evidence;
3. required unsupported beats are shown as missing rather than fabricated;
4. generated title claims must cite evidence or be removed;
5. speech selections end on verified transcript/acoustic boundaries;
6. source ranges never exceed media availability;
7. missing handles use a declared fallback;
8. effect and transition strings are validated against a registry;
9. the timeline does not change before Apply;
10. stale proposals cannot apply;
11. Apply creates a new revision and revert preserves history;
12. the app can explain which script beat, recipe, and evidence produced any changed timeline item.

## Explicit non-goals for the hackathon

- arbitrary executable user scripts;
- online RLHF/RLAIF from interaction traces;
- automatic conflict-free multiuser merging;
- full OTIO/AAF/FCPXML interchange parity;
- arbitrary third-party shaders/plugins;
- perfect frame-level visual understanding from sparse samples;
- autonomous publication;
- a universal scalar edit-quality score.

## Companion documents

- `scripting-pipeline-script-language.md` defines the authoring shape and migration examples.
- `scripting-pipeline-compiler.md` defines deterministic compilation, validation, proposals, and revisions.
- `scripting-pipeline-example.md` grounds the design in the existing Kiro analysis and Kumar style map.

The research rationale lives under `research/notes/`, especially `event-and-edit-representations.md`, `edit-pattern-and-style-systems.md`, `human-agent-coediting.md`, and `hackathon-sketch-synthesis.md`.
