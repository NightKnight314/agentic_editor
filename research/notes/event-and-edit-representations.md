# Event and edit representations

Date: 2026-07-25  
Scope: a formal intermediate representation connecting multimodal source analysis to narrative beats, edit decisions, timeline operations, revisions, and interchange formats.

## Executive recommendation

Use a small, typed, provenance-bearing graph as the product's canonical representation. Keep three layers separate and compile only in one direction:

```text
immutable assets
  -> observations and evidence assertions in source time
  -> canonical source events
  -> narrative beat graph in story/presentation order
  -> edit intents and candidate uses
  -> validated timeline operations in composition time
  -> immutable timeline revision
  -> OTIO / FCPXML / AAF / EDL adapters and rendered media
```

The distinction is structural, not merely naming:

| Layer | Answers | Clock | Truth status | Typical mutation |
|---|---|---|---|---|
| Observation | What did one analyzer or person detect? | Source stream | Claimed, uncertain, reproducible | Supersede; never silently overwrite |
| Source event | What likely happened in the recorded material? | Source asset | Evidence-backed interpretation | Re-resolve when evidence changes |
| Narrative beat | What job should a portion of the story perform? | Story order; optional target duration | Editorial intent, not source fact | Reorder, merge, split, reject |
| Edit intent | How should evidence realize a beat? | Source and target composition constraints | Proposal | Rank alternatives; lower to operations |
| Timeline operation | What exact deterministic mutation should occur? | Composition plus referenced source time | Executable command | Apply atomically to a known base revision |
| Timeline revision | What is the accepted state? | Composition | Immutable accepted artifact | Create a descendant revision |

Do **not** use one polymorphic `events` array for all of these. It makes confidence meaningless, conflates source and record time, and encourages a language model to mutate the timeline before the system has checked whether the evidence, media handles, or base revision still exist.

OpenTimelineIO (OTIO) is the best model and likely library for a neutral **timeline compile target**, but not for the complete reasoning graph. OTIO is deliberately about editorial cut information and external media references. Its native document is a tree and does not support shared object instancing, while the evidence layer needs many-to-many references among observations, events, beats, and decisions. OTIO's own adapter guide also warns that only native OTIO round-trips all OTIO features; other adapters are lossy. See the official [OTIO overview](https://opentimelineio.readthedocs.io/en/latest/index.html), [file-format specification](https://github.com/AcademySoftwareFoundation/OpenTimelineIO/blob/main/docs/tutorials/otio-file-format-specification.md), and [adapter-writing guide](https://github.com/AcademySoftwareFoundation/OpenTimelineIO/blob/main/docs/tutorials/write-an-adapter.md).

## What the standards contribute

No single standard spans machine perception, narrative reasoning, nonlinear editing, revision control, and delivery. The useful design is a composition of narrower standards:

| Standard/model | Adopt internally | Do not assume |
|---|---|---|
| W3C Media Fragments | Half-open temporal source selectors and track-aware locators | Frame accuracy from decimal normal-play-time strings |
| W3C Web Annotation | `source + selector + state` pattern for attaching a claim to part of a resource | That an annotation body is automatically true |
| W3C PROV | Entity/activity/agent provenance and derivation vocabulary | That provenance alone proves correctness |
| EBU CCDM / EBUCore | Separate editorial objects from media resources; timeline tracks for ordered rundown; parts for bounded segments | A ready-made AI editing JSON schema |
| MovieLabs OMC | Narrative versus production context, asset/composition/version terminology | A timeline execution model |
| OTIO | Rational-time timeline structure, clips, tracks, stacks, gaps, transitions, markers, metadata | Lossless conversion through every adapter |
| AAF | Rich professional authoring interchange and source lineage | A lightweight web-native internal model |
| FCPXML | Final Cut Pro-specific resources, sequences, anchored items, and rational seconds | Portability to other editors or stable support for every FCP feature |
| CMX 3600 EDL | Lowest-common-denominator linear cut list | Multiple video tracks, nesting, or effects |
| JSON Patch / JSON Pointer | Standard patch transport and precondition `test` operations | Stable addressing into reordered arrays |
| JSON Canonicalization Scheme | Reproducible serialized bytes for hashes | Compatibility with arbitrary non-I-JSON numbers |
| C2PA actions/ingredients | Later export of signed edit provenance about rendered assets | An internal undo, collaboration, or editorial-quality model |

The EBU's model is especially close to the sketches. EBU CCDM defines an `EditorialObject` as an idea or story that can itself contain parts, relates it to the media resource that instantiates it, and recommends a `TimelineTrack` rather than a generic part relation when an ordered rundown is required. Its example explicitly distinguishes the last ten seconds of an interview **as used in** a news item from the one-minute original source. See [EBU CCDM Tech 3351, section 2.2.2](https://tech.ebu.ch/docs/tech/tech3351.pdf). EBUCore separately describes `part` as editorial or technical partitioning optionally bound to a timeline; see [EBUCore Tech 3293](https://tech.ebu.ch/docs/tech/tech3293.pdf).

MovieLabs makes a similarly useful distinction: a narrative scene is defined by creative unity and need not map one-to-one to a production scene, while an editorial composition is a set of assets and instructions from which an output asset can be rendered. See the current [MovieLabs Ontology for Media Creation](https://mc.movielabs.com/docs/ontology/), its [context model](https://mc.movielabs.com/docs/ontology/context/context/), and its [asset model](https://mc.movielabs.com/docs/ontology/assets/concepts-and-terms/). Nighthack's `Beat` is therefore closer to an editorial/narrative object than to a detected shot.

## Time must be typed by coordinate system

### Required clocks

At minimum, distinguish these coordinate systems:

1. **Stream time:** a sample, frame, or packet position in one source stream.
2. **Asset time:** a common source-asset timeline used to align its streams.
3. **Embedded timecode:** a label such as `01:00:00:00`; it may be discontinuous and is not a duration.
4. **Item-local time:** time measured from the beginning of a trimmed or nested item.
5. **Parent time:** the item's placement in its immediate track or stack.
6. **Composition time:** time in the root program timeline.
7. **Wall-clock time:** capture or publication date/time; never substitute this for media time.

OTIO's time-range documentation emphasizes that asking for a clip range is incomplete unless the caller knows whether it is in clip time or parent time. It distinguishes a media reference's available range, the clip's selected source range, the clip's visible range including transition handles, and the clip's range in its parent. See [OTIO Time Ranges](https://opentimelineio.readthedocs.io/en/v0.18.1/tutorials/time-ranges.html). Apple's current FCPXML documentation similarly distinguishes `offset` in parent time, `start` in an element's local timeline, and `duration` in parent time, and represents time as rational seconds; see [FCPXML Timing Attributes](https://developer.apple.com/documentation/professional-video-applications/timing-attributes).

Use integer ticks plus an explicit rational rate. Never persist floating-point seconds as timing truth.

```ts
interface RationalRate {
  numerator: number;    // e.g. 30000
  denominator: number;  // e.g. 1001
}

interface TickTime {
  ticks: number;         // safe integer; BigInt/string if projects can exceed JS safe range
  ticksPerSecond: RationalRate;
}

interface TickRange {
  start: TickTime;
  durationTicks: number;
  // Semantic interval is [start, start + duration), never inclusive at the end.
}

type TimeSpace =
  | { kind: "stream"; streamId: string }
  | { kind: "asset"; assetId: string }
  | { kind: "item"; itemId: string }
  | { kind: "track"; trackId: string }
  | { kind: "composition"; revisionId: string };

interface LocatedRange {
  space: TimeSpace;
  range: TickRange;
}
```

The half-open interval `[start, end)` prevents double membership at adjacent cuts. W3C Media Fragments defines temporal fragments this way and treats an empty interval as invalid; see [Media Fragments URI 1.0](https://www.w3.org/TR/media-frags/). Apply the same rule to observations, source selections, beats with fixed targets, timeline items, and keyframe domains.

### Explicit transforms

Never infer a transform from two naked time numbers. Store it:

```ts
interface TimeTransformSegment {
  compositionRange: LocatedRange; // item-local or parent/composition time
  sourceStart: TickTime;
  sourceSpace: TimeSpace;
  speed: { numerator: number; denominator: number }; // negative permits reverse
  interpolation: "hold" | "linear" | "optical-flow" | "frame-blend";
}
```

For a constant-speed segment:

```text
source(t) = sourceStart + speed * (t - compositionStart)
```

Piecewise segments model ramps. Every transformation must say which two spaces it maps. Round only at a declared boundary, such as output frame quantization. Record the rounding policy (`floor`, `ceil`, nearest-even) because otherwise two implementations can compile different last frames.

### Source locators

Use stable asset and stream identifiers plus a typed span. A URI is a locator, not identity; proxies and originals can share an asset identity while having different locators and available ranges.

```ts
interface SourceLocator {
  assetId: string;
  streamId?: string;
  range: LocatedRange;
  representationId?: string; // original, proxy, isolated audio, transcript version
  contentHash?: string;
  selectorUri?: string;       // optional interoperability form, e.g. #t=10,20&track=audio
}
```

W3C Web Annotation's `SpecificResource` pattern wraps a source with a selector and, optionally, a state identifying which version of the source the selector was evaluated against. That state concept is important for mutable remote media. See [W3C Selectors and States](https://www.w3.org/TR/selectors-states/).

## Segmentation is a graph with several overlapping hierarchies

A camera shot, a speaker turn, a sentence, a musical phrase, an on-screen text region, and a topic segment can overlap without any one being the correct parent of the others. Therefore:

- use containment trees only **within a segmentation vocabulary** such as `scene -> shot` or `transcript segment -> token`;
- represent cross-vocabulary relations as graph edges such as `cooccurs_with`, `depicts`, `spoken_by`, or `supports`;
- allow the same observation to support several events and the same event to support several beats;
- keep boundary uncertainty on the observation that produced it;
- model instantaneous points as zero-duration markers only where the consuming type permits them; media selections and placed clips must have positive duration.

```ts
type SegmentKind =
  | "shot" | "scene" | "take" | "speaker_turn" | "utterance" | "token"
  | "silence" | "music_phrase" | "sound_event" | "action" | "face_track"
  | "object_track" | "ocr_region" | "topic" | "chapter" | "user_region";

interface Segment {
  id: string;
  kind: SegmentKind;
  locator: SourceLocator;
  parentId?: string; // only a parent in the same declared hierarchy
  childIds?: string[];
  boundaryUncertainty?: {
    startMinusTicks: number;
    startPlusTicks: number;
    endMinusTicks: number;
    endPlusTicks: number;
  };
  generatedBy: ProducerRunRef;
  status: "machine" | "human-confirmed" | "human-rejected" | "superseded";
}
```

Useful interval predicates are `before`, `meets`, `overlaps`, `starts`, `during`, `finishes`, `equals`, and their inverses. Store a relation only when it carries meaning or saves an expensive query; derive ordinary temporal relations from ranges. Treat `meets` as exact adjacency after conversion into the same coordinate system.

WebVTT is instructive but should remain an import/export form: it supports captions, descriptions, chapters, and generic timed metadata; cue start times are ordered, cue end must exceed cue start, and ordinary cues may overlap. See the current [WebVTT specification](https://www.w3.org/TR/2026/CRD-webvtt1-20260520/). Its text timestamp precision is useful for delivery, not as the canonical editing timebase.

## Proposed canonical graph schema

The following is intentionally small enough for a hackathon. Store each collection as a map keyed by stable ID, with separate order arrays where order is semantic. This makes references and patches safer than deeply nested arrays.

### Assets, producer runs, and observations

```ts
interface Asset {
  id: string;
  originalName: string;
  contentHash: string;
  representations: Record<string, {
    uri: string;
    role: "original" | "proxy" | "mezzanine" | "analysis-derivative";
    contentHash?: string;
  }>;
  streams: Record<string, {
    kind: "video" | "audio" | "text" | "data";
    ticksPerSecond: RationalRate;
    availableRange: LocatedRange;
    startTimecode?: { value: string; dropFrame: boolean };
  }>;
}

interface ProducerRunRef {
  runId: string;
  producer: string;          // detector, model, human, import adapter
  version: string;
  parametersHash: string;
  inputRevisionHashes: string[];
  createdAt: string;
}

interface Observation<T = unknown> {
  id: string;
  type: string;              // transcript.token, vision.face, audio.music, user.marker...
  target: SourceLocator;
  value: T;
  confidence?: number;       // confidence in this assertion, not in the asset or whole event
  calibrationId?: string;
  generatedBy: ProducerRunRef;
  derivedFromObservationIds: string[];
  status: "active" | "human-confirmed" | "human-rejected" | "superseded";
  supersededBy?: string;
}
```

Do not overwrite an old detector result when a model changes. Insert the new observation, mark the prior one superseded if policy calls for it, and retain both producer runs. This permits reproduction, A/B evaluation, and re-resolution without destroying the evidence that informed an earlier edit.

### Evidence assertions and canonical source events

An observation is a detector-shaped output. An evidence assertion states what proposition that output supports or contradicts. This intermediate node avoids turning a face detector's numeric output directly into the higher-level claim “Alice reacts positively.”

```ts
interface EvidenceAssertion {
  id: string;
  proposition: string;
  subjectIds: string[]; // entities or source-event candidates
  predicate: string;
  object: unknown;
  polarity: "supports" | "contradicts" | "neutral";
  strength?: number;
  observationIds: string[];
  author: ProducerRunRef;
  status: "proposed" | "accepted" | "rejected" | "superseded";
}

interface SourceEvent {
  id: string;
  type: string; // says, demonstrates, reacts, arrives, product_shown, applause...
  label: string;
  participants: Array<{ entityId: string; role: string }>;
  loci: SourceLocator[];
  assertionIds: string[];
  relationEdges: Array<{
    type: "before" | "causes" | "responds_to" | "part_of" | "same_as" | "contrasts";
    targetEventId: string;
  }>;
  resolution: "machine-proposed" | "human-confirmed" | "disputed" | "superseded";
}
```

Confidence should remain attached to individual claims. Combining a 0.93 speech detector, 0.70 speaker classifier, and 0.62 sentiment classifier into one `event.confidence = 0.75` hides which part is uncertain and prevents meaningful review. Preserve the chain and compute task-specific scores only while ranking candidates.

### Beat graph

A beat is an editorial function supported by evidence; it is not necessarily a continuous source interval. One beat may draw from several assets, while one event may serve several alternative beats.

```ts
type BeatFunction =
  | "hook" | "setup" | "question" | "context" | "claim" | "proof"
  | "demonstration" | "contrast" | "reaction" | "turn" | "payoff"
  | "callback" | "transition" | "cta";

interface NarrativeBeat {
  id: string;
  function: BeatFunction;
  intent: string;
  requiredClaims: string[];
  supportedByEventIds: string[];
  targetDuration?: { minTicks: number; idealTicks: number; maxTicks: number; rate: RationalRate };
  constraints: Array<
    | { type: "must-follow"; beatId: string }
    | { type: "must-precede"; beatId: string }
    | { type: "must-preserve-chronology"; eventIds: string[] }
    | { type: "requires-human-confirmation"; reason: string }
    | { type: "forbid-meaning-change" }
    | { type: "style-rule"; ruleId: string }
  >;
  status: "candidate" | "selected" | "rejected" | "satisfied";
}

interface BeatPlan {
  id: string;
  beatById: Record<string, NarrativeBeat>;
  presentationOrder: string[];
  storyEdges: Array<{
    fromBeatId: string;
    toBeatId: string;
    relation: "precedes" | "sets_up" | "answers" | "contrasts" | "pays_off";
  }>;
  generatedBy: ProducerRunRef;
  basedOnGraphHash: string;
}
```

`presentationOrder` is explicit because narrative order may differ from source chronology. A chronology change is acceptable only if the beat constraints allow it; the compiler should flag reordered speech or causality-sensitive events rather than treating a new array position as harmless.

### Candidate uses and edit intents

Separate **what should happen** from **which exact clip performs it**. That permits ranked alternatives and graceful fallback.

```ts
interface CandidateUse {
  id: string;
  beatId: string;
  sourceSelections: SourceLocator[];
  roles: string[]; // primary_dialogue, b_roll, reaction, room_tone, music...
  eventIds: string[];
  scores: Record<string, number>; // relevance, quality, continuity, novelty...
  hardFailures: string[];
  warnings: string[];
}

interface EditIntent {
  id: string;
  beatId?: string;
  type:
    | "select" | "place" | "trim" | "reorder" | "bridge_audio"
    | "cover_with_broll" | "add_transition" | "caption" | "reframe"
    | "mix" | "grade" | "decorate";
  candidateUseIds: string[];
  preferredCandidateUseId?: string;
  parameters: Record<string, unknown>;
  originatingRuleIds: string[];
  rationale: string;
}
```

### Timeline commands

The language model should propose `EditIntent`s or domain commands, not arbitrary object mutations. A deterministic compiler lowers those to a closed command vocabulary.

```ts
type TimelineCommand =
  | { type: "create_track"; trackId: string; kind: "video" | "audio" | "caption"; index: number }
  | { type: "place_clip"; itemId: string; trackId: string; at: TickTime;
      source: SourceLocator; duration: TickTime; linkGroupId?: string }
  | { type: "insert_gap"; itemId: string; trackId: string; at: TickTime; duration: TickTime }
  | { type: "move_item"; itemId: string; trackId: string; at: TickTime; ripple: boolean }
  | { type: "trim_item"; itemId: string; sourceRange: SourceLocator; duration: TickTime; ripple: boolean }
  | { type: "split_item"; itemId: string; atItemLocal: TickTime; leftId: string; rightId: string }
  | { type: "remove_item"; itemId: string; ripple: boolean }
  | { type: "link_items"; itemIds: string[]; linkGroupId: string; syncOffsets: TickTime[] }
  | { type: "add_transition"; transitionId: string; leftItemId: string; rightItemId: string;
      kind: string; inOffset: TickTime; outOffset: TickTime }
  | { type: "set_effect"; effectId: string; targetId: string; pluginId: string;
      pluginVersion?: string; parameters: Record<string, unknown> }
  | { type: "set_keyframes"; effectId: string; parameter: string;
      keyframes: Array<{ atItemLocal: TickTime; value: unknown; interpolation: string }> }
  | { type: "add_marker"; markerId: string; targetId: string; range: LocatedRange; label: string }
  | { type: "add_caption"; cueId: string; trackId: string; range: LocatedRange;
      text: string; sourceObservationIds: string[] };

interface CommandEnvelope {
  id: string;
  command: TimelineCommand;
  intentId: string;
  evidenceIds: string[];
  preconditions: Precondition[];
}
```

Use explicit `Gap` and `Transition` objects rather than treating empty space or overlaps as accidental geometry. OTIO makes both first-class. Its transition model uses an exclusive in-offset against the previous item and out-offset against the next; the required visible source range can therefore extend past a clip's trimmed range. See the official [OTIO schema reference](https://opentimelineio.readthedocs.io/en/latest/api/python/opentimelineio.schema.html).

## Provenance and lineage

### Minimal internal mapping to W3C PROV

W3C PROV defines provenance around entities, activities, and agents, with derivation and generation relationships. It is meant to support quality/trust assessments, reproduction, versioning, and validation; see the [PROV overview](https://www.w3.org/TR/prov-overview/) and [PROV Data Model](https://www.w3.org/TR/prov-dm/).

Map the edit graph as follows:

| Internal object | PROV concept | Important relations |
|---|---|---|
| Asset representation | Entity | `specializationOf` logical asset; hash identifies bytes |
| Observation | Entity | `wasGeneratedBy` analyzer run; `wasDerivedFrom` source representation |
| Source event | Entity | `wasDerivedFrom` evidence assertions/observations |
| Beat plan | Entity | `wasGeneratedBy` planner; `used` source-event graph and brief |
| Edit proposal | Entity | `wasDerivedFrom` beat plan; `used` base revision |
| Accepted timeline revision | Entity | `wasGeneratedBy` apply activity; `wasRevisionOf` base |
| Rendered file | Entity | `wasGeneratedBy` render; `wasDerivedFrom` timeline and source assets |
| Analyzer/planner/compiler/render | Activity | Version and parameter hash |
| Human, model, application | Agent | `wasAssociatedWith` activity; `wasAttributedTo` artifact |

Store useful qualified provenance directly rather than requiring RDF at runtime:

```ts
interface LineageRecord {
  entityId: string;
  entityType: string;
  generatedBy?: string;
  derivedFrom: string[];
  used: string[];
  attributedTo: string[];
  activity?: {
    id: string;
    type: string;
    software: string;
    version: string;
    parametersHash: string;
    startedAt: string;
    endedAt?: string;
  };
}
```

The lineage graph should answer:

- Which exact source frames and transcript observations justify this timeline item?
- Which planner/style rule proposed it?
- Which human accepted or changed it?
- Which revision first contained it?
- Which downstream captions, preview files, and renders must be invalidated if its source range changes?
- Can the analyzer run and compiler version reproduce the proposal?

For published renders, C2PA can later carry a signed, tamper-evident summary. C2PA 2.3 defines ingredient assertions and action assertions such as added text, adjusted color, speed change, placement, and general editing, with software-agent and parameter data. Assertions in a signed claim cannot simply be modified later. Its action-array order is not normative, however, so the internal revision log must remain the ordering authority. See [C2PA 2.3 actions and ingredients](https://spec.c2pa.org/specifications/specifications/2.3/specs/C2PA_Specification.html#_actions).

## Deterministic compilation

The planner may be stochastic; applying a selected plan must not be. Treat compilation as a pure function:

```text
compile(
  baseRevisionHash,
  immutableAssetManifestHash,
  evidenceGraphHash,
  selectedBeatPlanHash,
  selectedCandidateUses,
  compilerVersion,
  explicitPolicy
) -> { commands, diagnostics, outputHash }
```

### Compilation phases

1. **Freeze inputs.** Resolve every mutable alias to an immutable revision/content hash.
2. **Normalize time.** Validate source rates and convert only through explicit transforms.
3. **Resolve references.** Confirm that every event, observation, asset, stream, rule, and base item exists.
4. **Schedule beats.** Produce deterministic presentation order and duration targets from the accepted beat plan.
5. **Choose declared candidates.** The compiler must not silently run creative retrieval; it consumes selected candidates or fails with alternatives.
6. **Lower intents.** Convert edit recipes into the closed command vocabulary with stable IDs derived from proposal ID plus logical command path.
7. **Preflight commands.** Simulate them against an isolated copy of the base revision.
8. **Validate post-state.** Run structural, temporal, source, evidence, and project constraints.
9. **Canonicalize and hash.** Serialize normalized data reproducibly.
10. **Commit atomically.** Either all commands create one new immutable revision or none do.
11. **Export separately.** Run adapter capability checks and report losses; never redefine the internal truth to fit EDL/FCPXML.

Any ambient input—current time, random seed, locale, default frame rate, filesystem ordering, plugin discovery order—must be passed explicitly or excluded. Sort unordered maps before hashing. RFC 8785 defines a JSON Canonicalization Scheme with deterministic property ordering and I-JSON constraints for hashable JSON; see [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.html). Because JCS uses IEEE-754-compatible JSON numbers, represent large tick integers and exact arbitrary rationals as validated decimal strings if they might exceed the interoperable integer range.

## Validation invariants

Validate both the proposal and the resulting revision. Diagnostics should have a stable code, severity, affected IDs/ranges, evidence, and repair suggestions.

### Identity and structure

- Every persisted object has a globally unique, immutable ID.
- References resolve to exactly one object of an allowed type.
- A superseded object remains addressable and names its successor when known.
- Containment is acyclic; the evidence/derivation graph may be a DAG but must reject derivation cycles.
- Order is stored exactly once for each ordered collection; map iteration order is never semantic.
- Schema version and compiler version are explicit.
- Extension metadata is namespaced, following OTIO's recommendation for metadata dictionaries.

### Temporal

- `durationTicks >= 0` for annotations and markers; `durationTicks > 0` for source selections, clips, cues, gaps, and transitions.
- Each range is `[start, end)` and `end = start + duration` in the same time space/rate.
- No comparison occurs across time spaces without a declared transform.
- Each source selection lies within its stream's available range unless the object is explicitly a request for unavailable future media.
- Retime segments cover the item without gaps or ambiguous overlaps and map monotonically except where reverse playback is explicitly allowed.
- Keyframes lie in the owning effect's item-local domain.
- Adjacent cuts on a sequential track meet exactly after quantization; unfilled time is an explicit gap.
- A transition's required visible ranges exist on both adjacent sources; otherwise reject it or use its declared fallback.
- Linked audio/video sync offsets remain unchanged unless a command explicitly modifies or breaks the link.

### Observation and evidence

- Every observation targets immutable source bytes or a versioned state.
- Confidence, when present, is finite and in `[0,1]`, and identifies the producing calibration regime when scores are compared.
- Human rejection never deletes the machine observation.
- Every accepted evidence assertion cites at least one observation or is explicitly marked user-authored.
- Every source event cites at least one assertion and locator, unless its type is a deliberately abstract/user-authored event.
- Contradictory assertions can coexist; resolution status records the decision rather than deleting disagreement.

### Narrative

- Each selected beat has at least one supporting event or an explicit `missing_evidence` diagnostic.
- Beat dependency edges are acyclic unless a relation type explicitly permits callbacks.
- `presentationOrder` contains each selected beat exactly once.
- Required claims are covered; forbidden claims are absent.
- Reordered chronology, removed negation, cross-speaker splices, or meaning-sensitive transcript edits trigger declared review rules.
- Duration bounds are checked against compiled uses, not merely planner estimates.

### Timeline and command application

- Every command's preconditions pass against the declared base revision.
- Commands in a batch either all apply or none apply.
- Track/item types are compatible.
- Locked or protected tracks cannot change without explicit authorization.
- Items do not overlap on tracks that forbid overlap; tracks that permit layering have explicit z/compositing order.
- Placed item IDs are new; updated/removed item IDs already exist.
- All timeline items retain source/event/intent lineage where applicable.
- Captions after conform cover the final conformed speech ranges, not stale source times.
- Running the same compiler with identical hashed inputs produces byte-identical normalized commands and semantic-equivalent timeline state.

### Export

- Target format and adapter version are explicit.
- A capability preflight lists unsupported and degraded features before export.
- A round-trip test compares semantic essentials: item order, source ranges, composition ranges, track kind, transitions, markers, and link/sync state.
- Every intentional loss is a structured diagnostic, not a log-string side effect.

JSON Schema Draft 2020-12 can validate much of the structural layer, but graph references, acyclicity, range arithmetic, capability checks, and post-state semantics need application-level validators. See the official [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12).

## Revision, proposal, patch, and undo semantics

### Immutable revision DAG

Use an immutable revision graph rather than one mutable project document:

```ts
interface TimelineRevision {
  id: string;
  parentRevisionIds: string[]; // one normally; two or more only after explicit merge
  projectId: string;
  sequence: TimelineState;
  normalizedHash: string;
  createdAt: string;
  createdBy: string;
  changeSetId: string;
}

interface ChangeSet {
  id: string;
  baseRevisionId: string;
  baseRevisionHash: string;
  proposalId?: string;
  commands: CommandEnvelope[];
  inverseCommands?: CommandEnvelope[];
  preconditions: Precondition[];
  compilerVersion: string;
  evidenceGraphHash: string;
  status: "proposed" | "validated" | "accepted" | "rejected" | "applied" | "reverted";
}

type Precondition =
  | { type: "revision_hash_equals"; value: string }
  | { type: "item_exists"; itemId: string }
  | { type: "item_hash_equals"; itemId: string; value: string }
  | { type: "range_available"; source: SourceLocator }
  | { type: "track_unlocked"; trackId: string }
  | { type: "no_overlap"; trackId: string; range: LocatedRange };
```

An **undo** creates a new descendant revision by applying an inverse change set; it does not erase history. A **revert** may be semantic rather than byte-for-byte if later revisions have intervened, so show conflicts and require approval. A **branch** is a pair of revisions with the same ancestor. A **merge** is a domain-aware operation over stable item identities and time constraints, not a blind JSON merge.

MovieLabs' version ontology treats a revision as a change whose result remains usable in the same production context and notes that revision chains can fork. This vocabulary maps well to alternate cuts; see [MovieLabs OMC asset versions](https://mc.movielabs.com/docs/ontology/assets-versions/provenance/).

### JSON Patch as transport, not creative command language

RFC 6902 JSON Patch defines ordered `add`, `remove`, `replace`, `move`, `copy`, and `test` operations. Processing stops at an error, and HTTP PATCH application is atomic. Its `test` operation is useful for optimistic concurrency; see [RFC 6902](https://www.ietf.org/rfc/rfc6902). JSON Pointer addresses array elements by numeric index; see [RFC 6901](https://datatracker.ietf.org/doc/html/rfc6901). Index addressing is fragile after concurrent inserts or reorderings.

Recommended policy:

- expose domain commands to agents and users;
- compile domain commands to a simulated post-state;
- optionally generate JSON Patch for storage or transport;
- begin every patch with tests for schema version, base hash, and touched item hashes;
- patch normalized `byId` maps by stable ID, not nested timeline arrays by index;
- include a separate order list whose concurrent reorder is treated as a semantic conflict;
- reject stale patches rather than guessing how to rebase them.

Do not introduce CRDT or operational-transform machinery for the hackathon. Field-level convergence does not guarantee a valid edit: two individually valid trims can exhaust transition handles, two moves can create a collision, and a converged array order may violate beat dependencies. Immutable revisions plus optimistic preconditions and explicit conflict resolution are simpler and editorially safer.

### Conflict taxonomy

| Conflict | Example | Default handling |
|---|---|---|
| Identity | Both branches create `item-7` differently | Reject; IDs should be collision-resistant |
| Existence | One deletes an item another trims | Present delete-versus-edit choice |
| Temporal | Independent moves overlap on V1 | Re-run placement validator; propose alternate track/time |
| Source | Relinked asset lacks prior source handles | Block and request relink/alternate candidate |
| Narrative | One reorders beats another edits their bridge | Re-plan affected dependency neighborhood |
| Effect | Both change same parameter/keyframe | Per-parameter choice if domains do not overlap; otherwise conflict |
| Metadata | Independent namespaced metadata changes | Merge if keys are disjoint |
| Capability | Merge produces construct target adapter cannot export | Preserve internally; warn at export boundary |

## Interchange mapping

### OTIO

Compile the accepted timeline revision to canonical OTIO roughly as follows:

| Nighthack | OTIO |
|---|---|
| Timeline revision | `Timeline` with revision/hash metadata |
| Layered root tracks | top-level `Stack` of `Track`s |
| Sequential item | `Clip`, `Gap`, `Transition`, or nested composition |
| Source selection | `Clip.source_range` |
| Available source media | `MediaReference.available_range` |
| Source file/proxy | `ExternalReference` or multiple media references where supported |
| Composition placement | Derived from sequential track order/gaps; query as range in parent |
| Annotation | `Marker` where its semantics fit |
| Retime | `LinearTimeWarp` / `TimeEffect` where representable |
| Evidence lineage | Namespaced `metadata["nighthack"]` with compact IDs/hashes |

Keep the complete evidence graph outside OTIO and link it by graph/revision hash. OTIO metadata can carry compact IDs, but the OTIO guide cautions that very large data should not live there. The file-format specification also says the native structure is a tree without object instancing, confirming that duplicated source uses should remain references into Nighthack's external graph rather than embedded evidence objects.

### AAF

AAF is a rich authoring format capable of carrying essence or external essence references, compositional information, event triggers, effects, markers, and source lineage. It is a serious professional interchange target, not an expedient web application database. See the [AAF Object Specification overview](https://aafassociation.org/specs/object_spec.html) and [AAF specification](https://aafassociation.org/html/specs/aafspec-v1.0.1.pdf).

Current OTIO AAF adapter support is still narrower than AAF itself: its official feature matrix supports tracks, audio, gaps, markers, nesting, and transitions, but not audio/video effects, and it does not write linear speed effects. See the [OTIO AAF adapter](https://github.com/OpenTimelineIO/otio-aaf-adapter). Adapter capability, not the theoretical container, determines practical round-trip fidelity.

### FCPXML

FCPXML is useful when Final Cut Pro is a demonstration target. It describes resources, metadata, projects, rendered media, sequences, and editing decisions, and validates against an Apple-supplied DTD. See the current [FCPXML Reference](https://developer.apple.com/documentation/professional-video-applications/fcpxml-reference) and Apple's [Final Cut XML transfer guide](https://support.apple.com/guide/final-cut-pro/use-xml-to-transfer-projects-verdbd66ae/mac).

Do not make FCPXML the internal model. It has application-specific anchored-item and magnetic-timeline semantics, evolves by Final Cut version, and the current OTIO FCPXML adapter's official feature matrix does not support transitions, effects, or speed effects. See the [OTIO FCPXML adapter](https://github.com/OpenTimelineIO/otio-fcpx-xml-adapter).

Final Cut Pro 7 XML (`xmeml`) is a different, retired format. Its older DTD usefully shows the classic distinction among clip source `in/out` and sequence `start/end`, but it should not be confused with modern FCPXML. See Apple's retired [Final Cut Pro XML encoding guide](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/FinalCutPro_XML/Basics/Basics.html).

### CMX 3600 EDL

Treat EDL as a review/conform fallback. The current official OTIO adapter matrix supports one clip track, gaps, markers, transitions, audio, and linear speed effects, but not multiple video tracks, nesting, or audio/video effects. It also requires callers to supply a rate because the EDL does not carry one, and real EDLs may contain overlapping or invalid record timecode. See the [OTIO CMX 3600 adapter](https://github.com/OpenTimelineIO/otio-cmx3600-adapter).

Never silently flatten the rich internal edit to EDL. Emit a degradation report such as:

```json
{
  "target": "cmx3600",
  "losses": [
    { "code": "flatten.multiple_video_tracks", "severity": "warning", "affected": ["V2"] },
    { "code": "drop.effect", "severity": "warning", "affected": ["fx-title-shadow"] },
    { "code": "drop.evidence_metadata", "severity": "info", "affected": ["graph:sha256:..."] }
  ]
}
```

## End-to-end example

Assume an interview asset at 24 fps contains the line “Editing took us three days” from source frames `[240, 288)`, and a product demonstration occurs at `[900, 972)`.

### 1. Observations

```json
{
  "observations": {
    "obs-words-1": {
      "type": "transcript.segment",
      "target": { "assetId": "asset-interview", "streamId": "audio-1",
        "range": { "space": { "kind": "stream", "streamId": "audio-1" },
          "range": { "start": { "ticks": 480000, "ticksPerSecond": { "numerator": 48000, "denominator": 1 } }, "durationTicks": 96000 } } },
      "value": { "text": "Editing took us three days", "speakerId": "person-founder" },
      "confidence": 0.96,
      "generatedBy": { "runId": "asr-17", "producer": "asr", "version": "17", "parametersHash": "sha256:a" }
    },
    "obs-demo-1": {
      "type": "vision.action",
      "target": { "assetId": "asset-interview", "streamId": "video-1",
        "range": { "space": { "kind": "stream", "streamId": "video-1" },
          "range": { "start": { "ticks": 900, "ticksPerSecond": { "numerator": 24, "denominator": 1 } }, "durationTicks": 72 } } },
      "value": { "label": "user generates rough cut" },
      "confidence": 0.78,
      "generatedBy": { "runId": "vision-4", "producer": "action-detector", "version": "4", "parametersHash": "sha256:b" }
    }
  }
}
```

The two streams use different tick rates. Their locators remain stream-native until a versioned asset alignment transform maps them into common asset time.

### 2. Events and assertions

```json
{
  "assertions": {
    "assert-pain": {
      "proposition": "The founder says editing took three days",
      "polarity": "supports",
      "observationIds": ["obs-words-1"],
      "status": "accepted"
    },
    "assert-proof": {
      "proposition": "The source depicts a generated rough cut",
      "polarity": "supports",
      "observationIds": ["obs-demo-1"],
      "status": "proposed"
    }
  },
  "events": {
    "event-pain": { "type": "says", "assertionIds": ["assert-pain"] },
    "event-proof": { "type": "demonstrates", "assertionIds": ["assert-proof"] }
  }
}
```

### 3. Beat plan

```json
{
  "beatById": {
    "beat-hook": {
      "function": "hook",
      "intent": "State the costly pain in the founder's own words",
      "supportedByEventIds": ["event-pain"],
      "constraints": [{ "type": "forbid-meaning-change" }]
    },
    "beat-proof": {
      "function": "proof",
      "intent": "Immediately show the product producing an edit",
      "supportedByEventIds": ["event-proof"],
      "constraints": [
        { "type": "must-follow", "beatId": "beat-hook" },
        { "type": "requires-human-confirmation", "reason": "vision assertion is not confirmed" }
      ]
    }
  },
  "presentationOrder": ["beat-hook", "beat-proof"]
}
```

### 4. Compiled command proposal

```json
{
  "baseRevisionId": "rev-12",
  "baseRevisionHash": "sha256:base",
  "commands": [
    {
      "id": "cmd-hook",
      "intentId": "intent-hook",
      "evidenceIds": ["obs-words-1", "assert-pain", "event-pain"],
      "preconditions": [
        { "type": "revision_hash_equals", "value": "sha256:base" },
        { "type": "range_available", "assetId": "asset-interview", "streamId": "video-1", "start": 240, "duration": 48 }
      ],
      "command": {
        "type": "place_clip", "itemId": "item-hook", "trackId": "V1",
        "at": { "ticks": 0, "ticksPerSecond": { "numerator": 24, "denominator": 1 } },
        "source": { "assetId": "asset-interview", "streamId": "video-1", "start": 240, "duration": 48 },
        "duration": { "ticks": 48, "ticksPerSecond": { "numerator": 24, "denominator": 1 } }
      }
    },
    {
      "id": "cmd-proof",
      "intentId": "intent-proof",
      "evidenceIds": ["obs-demo-1", "assert-proof", "event-proof"],
      "preconditions": [
        { "type": "range_available", "assetId": "asset-interview", "streamId": "video-1", "start": 900, "duration": 72 }
      ],
      "command": {
        "type": "place_clip", "itemId": "item-proof", "trackId": "V1",
        "at": { "ticks": 48, "ticksPerSecond": { "numerator": 24, "denominator": 1 } },
        "source": { "assetId": "asset-interview", "streamId": "video-1", "start": 900, "duration": 72 },
        "duration": { "ticks": 72, "ticksPerSecond": { "numerator": 24, "denominator": 1 } }
      }
    }
  ]
}
```

The exact abbreviated JSON above is illustrative; production objects should use the same full `SourceLocator` shape everywhere. The important result is inspectable lineage:

```text
item-proof
  <- cmd-proof
  <- intent-proof
  <- beat-proof
  <- event-proof
  <- assert-proof
  <- obs-demo-1
  <- asset-interview frames [900,972)
```

The review UI can now say, “This proof shot is based on a 0.78 machine observation and requires confirmation,” rather than presenting the edit as fact.

## Failure modes and repairs

| Failure mode | Consequence | Repair |
|---|---|---|
| One flat `events` array | Source facts, story wishes, and mutations become indistinguishable | Separate observations, events, beats, intents, and commands |
| Float seconds everywhere | Drift, off-by-one frames, ambiguous rate | Integer ticks plus rational rate and explicit time space |
| Naked `start` with no coordinate system | Source time is mistaken for composition time | Wrap every range in a typed `TimeSpace` |
| Inclusive ends | Adjacent events share a boundary frame | Use `[start,end)` universally |
| Overwriting analyzer output | Earlier decisions become irreproducible | Immutable observations plus supersession edges |
| Averaging confidence into one event score | Review cannot find the uncertain premise | Confidence per assertion; task-specific ranking scores |
| Treating segmentation as one tree | Shot, speech, topic, and object tracks cannot overlap correctly | Separate hierarchies plus cross-layer graph edges |
| Direct event-to-timeline generation | No narrative rationale or candidate alternatives | Event -> beat -> intent -> deterministic command |
| Agent emits arbitrary JSON mutation | Invalid state and unsafe stale edits | Closed command vocabulary, preconditions, simulation, atomic commit |
| Patch by array index | Concurrent insert changes the target | Maps by stable ID plus explicit order arrays |
| Full-document regeneration | Unrelated user changes disappear | Minimal change sets against an immutable base hash |
| Silent rebase of stale proposal | Agent edits a different cut than it reviewed | Fail revision-hash precondition and regenerate proposal |
| Transition without handles | Freeze, black, repeated frame, or invalid export | Validate visible source range before adding transition |
| Caption timing copied from source | Captions drift after trims/reorders/retimes | Conform cues through the accepted timeline transform |
| OTIO used as evidence database | Many-to-many lineage is duplicated or lost | External graph linked through compact OTIO metadata |
| Assuming adapter parity | Effects/nesting/retimes disappear on export | Per-adapter capability matrix and degradation report |
| EDL as canonical model | Product is capped at one flat track | Rich internal model; EDL only as explicit lossy projection |
| CRDT convergence treated as editorial validity | Converged state can still collide or break handles/story | Domain validation and explicit semantic conflict resolution |
| Provenance treated as truth | A well-documented hallucination still passes | Separate lineage from human/evidence validation status |

## Hackathon implementation recommendation

### P0: one credible vertical slice

Implement only these six persisted object types:

1. `Asset` with streams, hashes, rates, and available ranges.
2. `Observation` with source locator, producer run, confidence, and status.
3. `SourceEvent` with evidence assertion IDs and source locators.
4. `NarrativeBeat` plus a `presentationOrder` list.
5. `ChangeSet` containing evidence-bearing domain commands and preconditions.
6. Immutable `TimelineRevision` with parent, normalized hash, and change-set ID.

Demonstrate:

```text
transcript + shot observation
  -> pain and proof source events
  -> hook + proof beat plan
  -> two candidate source selections
  -> proposal diff with lineage and warnings
  -> human Apply
  -> atomic revision
  -> deterministic replay and OTIO export
```

The highest-value UI interaction is clicking a proposed or accepted timeline item and seeing the chain back to its exact source range, transcript/vision evidence, beat, rule, and approval. That proves the platform is doing inspectable editorial reasoning rather than opaque prompt-to-render generation.

### P0 shortcuts that are safe

- Use one project composition rate, while preserving native source rates in locators.
- Support constant-speed forward playback only; reject or defer ramps/reverse.
- Keep the evidence graph in normalized JSON maps.
- Use application validators plus JSON Schema for structure.
- Use full immutable revision snapshots if command inversion is not ready; still store the forward change set.
- Export native `.otio` first. Treat FCPXML/AAF/EDL as later adapters.
- Use optimistic single-writer concurrency through a base-revision hash.
- Store graph and revision hashes even if canonical JCS hashing lands after the demo.

### P0 shortcuts that are unsafe

- Guessing frame rate when ingest metadata knows it.
- Writing rounded UI seconds back into the canonical state.
- Applying a proposal to “whatever revision is current.”
- Removing rejected evidence from history.
- Claiming unsupported source events as facts because a model emitted JSON.
- Automatically flattening or dropping unsupported export features without a report.
- Letting the language model choose object IDs or patch array indices freely.

### P1 after the demo

- piecewise retime transforms and frame-sampling policies;
- linked component audio/video with J/L-cut commands;
- transitions with source-handle calculation;
- branching and domain-aware merge;
- adapter capability and semantic round-trip tests;
- WebVTT caption/metadata import and conform;
- external graph store/query layer using PROV-compatible relationships;
- C2PA ingredient/action export for published renders;
- calibrated detector confidence and human correction workflow;
- dependency-based invalidation of derived observations, previews, captions, and renders.

## Source list

All sources accessed 2026-07-25. Technical claims above prefer primary standards bodies, official vendor documentation, and official project repositories.

- [Academy Software Foundation: OpenTimelineIO overview](https://opentimelineio.readthedocs.io/en/latest/index.html)
- [Academy Software Foundation: OpenTimelineIO architecture](https://opentimelineio.readthedocs.io/en/v0.16.0/tutorials/architecture.html)
- [Academy Software Foundation: OpenTimelineIO time ranges](https://opentimelineio.readthedocs.io/en/v0.18.1/tutorials/time-ranges.html)
- [Academy Software Foundation: OpenTimelineIO schema API](https://opentimelineio.readthedocs.io/en/latest/api/python/opentimelineio.schema.html)
- [Academy Software Foundation: OpenTimelineIO file-format specification](https://github.com/AcademySoftwareFoundation/OpenTimelineIO/blob/main/docs/tutorials/otio-file-format-specification.md)
- [Academy Software Foundation: writing an OTIO adapter](https://github.com/AcademySoftwareFoundation/OpenTimelineIO/blob/main/docs/tutorials/write-an-adapter.md)
- [OpenTimelineIO: CMX 3600 adapter and feature matrix](https://github.com/OpenTimelineIO/otio-cmx3600-adapter)
- [OpenTimelineIO: AAF adapter and feature matrix](https://github.com/OpenTimelineIO/otio-aaf-adapter)
- [OpenTimelineIO: FCPXML adapter and feature matrix](https://github.com/OpenTimelineIO/otio-fcpx-xml-adapter)
- [AAF Association: AAF Object Specification overview](https://aafassociation.org/specs/object_spec.html)
- [AAF Association: AAF Object Specification 1.0.1](https://aafassociation.org/html/specs/aafspec-v1.0.1.pdf)
- [Apple: FCPXML Reference](https://developer.apple.com/documentation/professional-video-applications/fcpxml-reference)
- [Apple: FCPXML Timing Attributes](https://developer.apple.com/documentation/professional-video-applications/timing-attributes)
- [Apple: Use XML to transfer Final Cut Pro projects](https://support.apple.com/guide/final-cut-pro/use-xml-to-transfer-projects-verdbd66ae/mac)
- [Apple: retired Final Cut Pro 7 XML encoding guide](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/FinalCutPro_XML/Basics/Basics.html)
- [Apple: Final Cut Pro 7 XML DTD](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/FinalCutPro_XML/DTD/DTD.html)
- [European Broadcasting Union: CCDM Tech 3351](https://tech.ebu.ch/docs/tech/tech3351.pdf)
- [European Broadcasting Union: EBUCore Tech 3293](https://tech.ebu.ch/docs/tech/tech3293.pdf)
- [MovieLabs: Ontology for Media Creation 2.8](https://mc.movielabs.com/docs/ontology/)
- [MovieLabs: OMC context model](https://mc.movielabs.com/docs/ontology/context/context/)
- [MovieLabs: OMC asset model](https://mc.movielabs.com/docs/ontology/assets/concepts-and-terms/)
- [MovieLabs: OMC versions and provenance](https://mc.movielabs.com/docs/ontology/assets-versions/provenance/)
- [W3C: Media Fragments URI 1.0](https://www.w3.org/TR/media-frags/)
- [W3C: Selectors and States](https://www.w3.org/TR/selectors-states/)
- [W3C: Web Annotation Data Model](https://www.w3.org/TR/annotation-model/)
- [W3C: PROV overview](https://www.w3.org/TR/prov-overview/)
- [W3C: PROV Data Model](https://www.w3.org/TR/prov-dm/)
- [W3C: WebVTT](https://www.w3.org/TR/2026/CRD-webvtt1-20260520/)
- [IETF: RFC 6901, JSON Pointer](https://datatracker.ietf.org/doc/html/rfc6901)
- [IETF: RFC 6902, JSON Patch](https://www.ietf.org/rfc/rfc6902)
- [RFC Editor: RFC 8785, JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785.html)
- [JSON Schema: Draft 2020-12](https://json-schema.org/draft/2020-12)
- [C2PA: Content Credentials Technical Specification 2.3](https://spec.c2pa.org/specifications/specifications/2.3/specs/C2PA_Specification.html)
