# Scripting pipeline: deterministic compiler and runtime

Status: implementation design for the hackathon and the first production-shaped iteration  
Audience: the agent working on the app, especially the timeline, agent panel, and analysis integration  
Scope: compiling an already parsed editing script into inspectable proposals and validated timeline operations

## Decision

Treat a script as a request to **compile an edit**, never as permission to mutate the accepted timeline.

```text
script text / structured script
  -> parser AST
  -> resolved edit-intent IR
  -> expanded operation-plan IR
  -> capability lowering
  -> deterministic validation and simulation
  -> EditProposal(baseRevision, atomic batches, diagnostics, preview)
  -> explicit user approval
  -> transactional apply to the same base revision
  -> immutable descendant revision
```

The language model may author the script or help select evidence before this boundary. It is not part of compilation. Given identical script, base revision, asset/evidence snapshots, compiler version, and capabilities, the compiler must emit the same semantic proposal. No compiler phase writes editor state.

This fits the research model of `evidence -> beat -> intent -> operation -> revision`, and it can be introduced around the current pure reducer in `src/lib/editor/operations.ts` rather than replacing the UI or timeline all at once.

## Current-state constraints

The existing app provides a useful P0 substrate:

- `src/lib/editor/types.ts` has a `TimelineDocument` and five `TimelineOperation` variants: insert, update, remove, split, and track update.
- `src/lib/editor/operations.ts` applies operations as pure functions and reduces an operation list in order.
- `src/components/editor/AgentPanel.tsx` creates operation arrays, but applies them immediately through `onOperations`.
- `src/lib/analysis/timeline.ts` turns analysis directly into a complete replacement `TimelineDocument`.
- `src/components/editor/EditorShell.tsx` owns one mutable timeline snapshot; the Undo and Redo controls are not wired to revision history.
- Time is floating-point seconds, effects are untyped strings, source duration is unavailable, and operations do not carry preconditions.

There are also behaviors that a compiler/runtime must not mistake for validation:

- `element.update` clamps timing silently.
- a missing element, missing track, or invalid split can become a silent no-op.
- insert does not prove that `element.trackId` agrees with the destination `trackId`.
- an update can patch `trackId` without moving the element between track arrays.
- batches can partially change the simulated document before a later operation proves invalid.
- document duration is not recomputed from content and source bounds are not checked.

For P0, preserve the reducer as an execution primitive but place strict validation and postcondition checks around it. Silent clamping/no-op behavior should be considered a runtime defect, not a fallback policy.

## Boundaries and ownership

The scripting system has four components with deliberately different authority:

| Component | May be probabilistic? | May write accepted timeline? | Output |
|---|---:|---:|---|
| Author/planner | Yes | No | script plus evidence references |
| Compiler | No | No | proposal or diagnostics |
| Preview runtime | No | No | ephemeral simulated revision and diff |
| Commit runtime | No | Only after approval | immutable revision or conflict/error |

The compiler consumes immutable snapshots. It must not fetch mutable UI state during a phase. The UI constructs a `CompileRequest` at invocation time and pins everything by revision/hash.

The compiler is not responsible for:

- deciding whether a story is good;
- inventing source evidence or repairing unsupported claims;
- rendering a final MP4;
- silently adapting a stale proposal to a newly edited timeline;
- executing arbitrary code embedded in a script.

## Core contracts

These interfaces illustrate semantics, not final TypeScript file placement. For P0, seconds can remain the transport type while validation quantizes them to project frames. The future canonical representation should use integer ticks and an explicit rational rate.

```ts
type RevisionId = string;       // content-derived, e.g. rev_<sha256-prefix>
type ContentHash = string;
type DiagnosticSeverity = "info" | "warning" | "error";

interface CompileRequest {
  script: ScriptDocument | ParsedScript;
  base: TimelineRevisionSnapshot;
  assets: AssetCatalogSnapshot;
  evidence?: EvidenceGraphSnapshot;
  style?: StyleMapSnapshot;
  capabilities: CapabilityManifest;
  policy: CompilePolicy;
  compilerVersion: string;
}

interface TimelineRevisionSnapshot {
  revisionId: RevisionId;
  timelineHash: ContentHash;
  document: TimelineDocument;
  parentRevisionIds: RevisionId[];
}

interface CompilePolicy {
  unsupported: "error" | "declared-fallback";
  warningsRequireApproval: boolean;
  maxExpandedOperations: number;
  maxPreviewDurationSeconds: number;
  frameRounding: "nearest" | "floor" | "ceil";
}

interface EditProposal {
  proposalId: string;                 // content-derived from semantic payload
  compilerVersion: string;
  baseRevisionId: RevisionId;
  baseTimelineHash: ContentHash;
  dependencyHashes: {
    script: ContentHash;
    assets: ContentHash;
    evidence?: ContentHash;
    style?: ContentHash;
    capabilities: ContentHash;
    policy: ContentHash;
  };
  summary: string;
  intentPlan: EditIntentIR;
  batches: AtomicOperationBatch[];
  diagnostics: Diagnostic[];
  degradations: CapabilityDecision[];
  preview: PreviewDescriptor;
  status: "proposed";                 // status changes live outside semantic payload
}

interface AtomicOperationBatch {
  batchId: string;
  label: string;
  baseRevisionId: RevisionId;
  preconditions: OperationPrecondition[];
  operations: OperationEnvelope[];
  expectedResultHash: ContentHash;
  inverseOperations: OperationEnvelope[];
  affectedRanges: CompositionRange[];
}

interface OperationEnvelope {
  operationId: string;
  operation: TimelineOperation | FutureTimelineOperation;
  intentId: string;
  evidenceRefs: EvidenceRef[];
  sourceLocation: SourceSpan;
  capabilityUsed: string;
}
```

Creation metadata such as `createdAt`, actor, approval record, and display-only model prose belongs in an event-store wrapper around the proposal. Keeping it outside the hashed semantic payload prevents timestamps from destroying determinism.

### Revisions

A revision is an immutable accepted artifact:

```ts
interface TimelineRevision {
  revisionId: RevisionId;
  parentRevisionIds: RevisionId[];
  timelineHash: ContentHash;
  document: TimelineDocument;
  causedBy: {
    proposalId?: string;
    batchIds: string[];
    approvalId?: string;
    revertOfRevisionId?: RevisionId;
  };
}
```

For P0 an in-memory array is sufficient. A revision ID should be derived from canonicalized document content and its parent identity, not `Date.now()`. This also removes the nondeterministic ID currently created by `timelineFromAnalysis`.

## Intermediate representations

Do not lower directly from syntax nodes to `TimelineOperation[]`. Three IRs keep creative meaning visible long enough to validate it.

### 1. Parsed script AST

The AST preserves author source spans, declarations, references, order, and explicit fallback clauses. It contains syntax, not resolved timeline objects.

```ts
interface AstNode {
  nodeId: string;       // stable within normalized script
  kind: string;
  span: SourceSpan;
}
```

Every later diagnostic retains the originating `SourceSpan`. Parser recovery may produce multiple diagnostics, but no proposal is emitted from an AST containing parser errors.

### 2. Edit-intent IR

This is the semantic plan. References are resolved, defaults are explicit, units are normalized, and evidence requirements are attached, but timeline mechanics are not yet chosen.

```ts
interface EditIntentIR {
  intentsById: Record<string, EditIntent>;
  order: string[];
  declaredOutputs: Postcondition[];
}

type EditIntent =
  | { kind: "place-source"; id: string; source: ResolvedSourceRange; at: FrameTime;
      targetTrack: ResolvedTrackRef; role?: string; evidence: EvidenceRef[] }
  | { kind: "trim"; id: string; item: ResolvedElementRef; in?: FrameTime; out?: FrameTime;
      mode: "overwrite" | "ripple"; preserve: PreservationRule[] }
  | { kind: "split"; id: string; item: ResolvedElementRef; at: FrameTime }
  | { kind: "remove"; id: string; item: ResolvedElementRef; mode: "lift" | "extract" }
  | { kind: "set-property"; id: string; target: ResolvedRef; property: TypedProperty; value: unknown }
  | { kind: "apply-pattern"; id: string; patternId: string; version: number;
      args: Record<string, unknown>; fallback?: FallbackClause };
```

Resolved references include both stable ID and a fingerprint of the object as seen in the base revision. Display names are never execution identities. A query such as “the first hook clip” must resolve to exactly one stable ID during compilation or produce an ambiguity error.

### 3. Operation-plan IR

Pattern calls and compound intents expand into primitive editing semantics while retaining dependencies and group atomicity.

```ts
interface OperationPlanIR {
  groups: Array<{
    groupId: string;
    intentIds: string[];
    atomic: true;
    dependencies: string[];
    primitives: PrimitiveEdit[];
    postconditions: Postcondition[];
  }>;
}

type PrimitiveEdit =
  | InsertPrimitive | UpdatePrimitive | RemovePrimitive | SplitPrimitive
  | MovePrimitive | RippleTrimPrimitive | RollPrimitive | SlipPrimitive
  | TransitionPrimitive | EffectPrimitive | AudioMixPrimitive;
```

This IR can express future semantics even when the present runtime cannot. Capability lowering decides whether a primitive maps exactly to current operations, uses an explicit declared fallback, or blocks compilation.

### 4. Lowered operation batches

This is the execution representation: ordered, concrete, preconditioned, reversible operations. It contains no unresolved selectors and no implicit defaults.

Current-operation lowering is intentionally narrow:

| Primitive | P0 lowering |
|---|---|
| insert element | `element.insert` after target/source/ID checks |
| patch allowed property | `element.update` with an allowlisted patch |
| remove element | `element.remove` with captured full element for inverse |
| split element | `element.split` with deterministic child ID support added to runtime, or block |
| update track flags/name | `track.update` with allowlisted patch |
| move within track | `element.update { start }` |
| move between tracks | remove + insert in one atomic batch; never patch `trackId` alone |
| ripple/roll/slip/transition/keyframes | future native op, or declared recipe expansion only if semantics are exactly preserved |

An approximation is not exact lowering. For example, changing one clip duration is not a valid silent fallback for a ripple trim because downstream timing differs.

## Compilation phases

Each phase is a pure function of its inputs and returns a value plus diagnostics. Errors accumulate where safe so the author can fix several issues in one pass.

### Phase 0: snapshot and canonicalization

1. Verify the base timeline hash.
2. Canonicalize maps, numeric units, and script formatting irrelevant to meaning.
3. Quantize script timing to the project frame boundary under the declared rounding policy.
4. Pin asset, evidence, style, capabilities, policy, and compiler hashes.

Do not rewrite the timeline document merely to canonicalize it. Hash canonical serialization with stable key ordering and reject non-finite numbers.

### Phase 1: parse and schema-check

The parser emits an AST and source diagnostics. A schema checker rejects unknown statements, duplicate declarations, invalid units, invalid enum values, and unbounded collections. Unknown fields are errors for executable nodes, not ignored hints.

### Phase 2: name and selector resolution

Resolve script references against the pinned base and catalogs:

- element IDs to `{ trackId, elementId, fingerprint }`;
- track aliases to one compatible track ID;
- assets and source ranges to immutable catalog records;
- evidence references to active, non-superseded assertions/events;
- pattern names to exact versioned definitions;
- style tokens to typed values.

Zero matches produces `RESOLVE_NOT_FOUND`; multiple matches produces `RESOLVE_AMBIGUOUS`. The compiler must not choose the nearest or first object unless the script explicitly requested an ordered selector.

### Phase 3: semantic elaboration

Normalize defaults and convert the AST to edit intents. Validate editorial preconditions that can be checked mechanically:

- positive half-open ranges `[start, end)`;
- source and composition clock are not mixed;
- full-word or evidence boundaries requested by the script exist;
- required evidence is attached;
- an element kind and target track kind are compatible;
- protected/locked targets are identified before expansion.

Subjective judgments remain warnings or review annotations. “Strong hook” cannot become an objective compiler pass/fail unless the script defines a measurable proxy such as “first selected speech begins by frame 60.”

### Phase 4: pattern expansion

Expand versioned patterns into operation-plan groups. Expansion is hygienic:

- generated IDs derive from `(scriptHash, AST node ID, pattern version, local ordinal)`;
- pattern-local names cannot capture outer names accidentally;
- recursion and expansion counts are bounded;
- a pattern declares required capabilities, preconditions, and its fallback policy;
- expansion retains the originating script span and pattern step ID.

Patterns never call the model or query mutable editor state. If a pattern needs candidate selection, candidate IDs must already be in the script or resolved intent.

### Phase 5: scheduling and dependency analysis

Build a dependency graph among primitive edits. An operation that reads or mutates an object depends on prior operations that create or change its identity/range. Reject cycles.

The scheduler produces a stable topological order: dependencies first, then script order, then stable operation ID. Never rely on JavaScript object iteration as editorial ordering.

Operations are grouped atomically by author statement or pattern contract. The compiler may merge adjacent groups only when neither observable failure behavior nor user approval granularity changes.

### Phase 6: capability negotiation and lowering

Resolve every primitive against a pinned capability manifest before producing executable operations. See the capability section below. Lower exact matches first; apply only script- or pattern-declared fallbacks; otherwise emit a blocking diagnostic.

### Phase 7: static validation

Run validators that need no simulation: shape, identifiers, patch allowlists, track compatibility, locks, asset availability, source bounds, time quantization, evidence lineage, capability requirements, and operation limits.

### Phase 8: simulation and dynamic validation

Apply each batch to a private copy of the base using strict operation semantics. Check preconditions before the first operation, validate after every operation for precise blame, then validate batch and document postconditions. Compute the exact result hash, inverse operations, affected ranges, and structural diff.

No simulation artifact is stored as the accepted timeline.

### Phase 9: proposal packaging

If there are no blocking diagnostics, package intent IR, operation batches, preconditions, expected hashes, degradations, diagnostics, and preview descriptor into a proposal. Warnings remain visible. A proposal with errors is not executable; the UI may show a failed compilation report instead.

## Compiler pseudocode

```ts
function compile(request: CompileRequest): CompileResult {
  const diagnostics = new DiagnosticBag();
  const pinned = pinAndVerifyInputs(request, diagnostics);
  if (diagnostics.hasErrors()) return failed(diagnostics);

  const ast = parseOrAcceptAst(pinned.script, diagnostics);
  schemaCheck(ast, diagnostics);
  if (diagnostics.hasErrors()) return failed(diagnostics);

  const resolved = resolveNames(ast, pinned, diagnostics);
  const intents = elaborate(resolved, pinned, diagnostics);
  const expanded = expandPatterns(intents, pinned, diagnostics);
  const scheduled = scheduleDependencies(expanded, diagnostics);
  if (diagnostics.hasErrors()) return failed(diagnostics);

  const negotiated = negotiateCapabilities(scheduled, pinned.capabilities, pinned.policy, diagnostics);
  const lowered = lowerToOperationBatches(negotiated, pinned, diagnostics);
  validateStatic(lowered, pinned, diagnostics);
  if (diagnostics.hasErrors()) return failed(diagnostics);

  const simulation = simulateAll(lowered, pinned.base, pinned, diagnostics);
  if (diagnostics.hasErrors()) return failed(diagnostics);

  const semanticPayload = {
    compilerVersion: pinned.compilerVersion,
    baseRevisionId: pinned.base.revisionId,
    baseTimelineHash: pinned.base.timelineHash,
    dependencyHashes: pinned.hashes,
    intentPlan: intents,
    batches: simulation.batches,
    diagnostics: diagnostics.sorted(),
    degradations: negotiated.decisions,
    preview: buildPreviewDescriptor(pinned.base.document, simulation.finalDocument)
  };

  return { ok: true, proposal: {
    proposalId: stableId("proposal", hashCanonical(semanticPayload)),
    summary: summarizeDeterministically(intents),
    status: "proposed",
    ...semanticPayload
  }};
}
```

Diagnostics sort by source location, then severity/code, so output order is stable.

## Preconditions, validators, and diagnostics

### Preconditions

Preconditions prevent a valid proposal from applying to a different reality:

```ts
type OperationPrecondition =
  | { kind: "revision-is"; revisionId: RevisionId; timelineHash: ContentHash }
  | { kind: "element-exists"; elementId: string; trackId: string; fingerprint: ContentHash }
  | { kind: "element-absent"; elementId: string }
  | { kind: "track-exists"; trackId: string; kindExpected: TrackKind; unlocked: true }
  | { kind: "asset-range-available"; assetId: string; startFrame: number; durationFrames: number;
      assetCatalogHash: ContentHash }
  | { kind: "evidence-active"; evidenceId: string; evidenceGraphHash: ContentHash }
  | { kind: "capability-set-is"; hash: ContentHash };
```

Use object fingerprints for touched objects even though the whole base hash is pinned. They improve conflict messages and prepare for future partial rebasing. P0 commit still requires an exact base revision/hash match.

### Validation layers

| Layer | Examples | When |
|---|---|---|
| Structural | known op, required field, finite numbers, unique IDs | before simulation |
| Reference | element/track/asset/evidence exists and is active | resolution/static |
| Temporal | frame alignment, positive duration, source and composition bounds | static and after each op |
| Compatibility | element kind vs track kind, effect/property support | static |
| Protection | locked/hidden policy, immutable fields, patch allowlist | static/runtime |
| Relational | overlaps, sync groups, linked A/V, transitions/handles | dynamic/future |
| Document | unique IDs globally, valid duration, no orphan `trackId` | after each batch |
| Declared | output duration, required beats, caption coverage | final postconditions |

P0 should implement at least:

1. globally unique track and element IDs;
2. every element resides in and names the same existing track;
3. only compatible element/track kinds;
4. finite frame-quantized `start`, `duration`, and `sourceStart`;
5. `start >= 0`, `duration > 0`, and `start + duration <= timeline.duration`, unless one explicit operation expands document duration;
6. source range within known asset duration when an asset catalog entry exists;
7. locked tracks reject writes;
8. updates cannot patch `id`, `trackId`, or arbitrary nested arrays in P0;
9. referenced targets exist exactly once;
10. every operation changes the state in the way its postcondition predicts.

The overlap rule must be track-policy-specific. Video overlays may intentionally overlap; “no overlap anywhere” is not a valid global invariant.

### Diagnostic shape

```ts
interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  primary: SourceSpan;
  related?: Array<{ message: string; location: SourceSpan | TimelineLocation }>;
  intentId?: string;
  operationId?: string;
  affectedIds?: string[];
  suggestedFix?: string;       // deterministic guidance, never an auto-applied mutation
  blocking: boolean;
}
```

Suggested stable codes:

- `PARSE_*`, `SCHEMA_*`
- `RESOLVE_NOT_FOUND`, `RESOLVE_AMBIGUOUS`, `RESOLVE_SUPERSEDED_EVIDENCE`
- `TIME_WRONG_SPACE`, `TIME_OFF_FRAME`, `TIME_INVALID_RANGE`, `SOURCE_OUT_OF_BOUNDS`
- `TRACK_INCOMPATIBLE`, `TRACK_LOCKED`, `PATCH_FORBIDDEN`
- `CAPABILITY_MISSING`, `CAPABILITY_VERSION_MISMATCH`, `FALLBACK_APPLIED`
- `PRECONDITION_FAILED`, `BASE_REVISION_CONFLICT`
- `SIMULATION_NO_EFFECT`, `POSTCONDITION_FAILED`, `DOCUMENT_INVALID`
- `LIMIT_EXPANSION`, `LIMIT_OPERATIONS`, `LIMIT_PREVIEW`

Warnings do not disappear when a proposal is applied. The approval record should capture which warnings the user saw.

## Capability negotiation

Compilation targets a capability manifest, not an assumed editor implementation.

```ts
interface CapabilityManifest {
  manifestVersion: 1;
  editorRuntime: string;
  timelineSchemaVersion: number;
  operations: Record<string, {
    version: number;
    support: "native" | "recipe" | "preview-only";
    constraints?: Record<string, unknown>;
  }>;
  effects: Record<string, { version: number; parameters: Record<string, ParameterSpec> }>;
  preview: { structural: boolean; audiovisual: boolean; maxSeconds: number };
  renderer?: { id: string; version: string; features: string[] };
}
```

For each required capability, negotiation returns one of:

```ts
type CapabilityDecision =
  | { result: "exact"; requirement: string; capability: string }
  | { result: "fallback"; requirement: string; fallbackId: string; semanticLoss: string;
      requiresApproval: true }
  | { result: "preview-only"; requirement: string; reason: string }
  | { result: "unsupported"; requirement: string; reason: string };
```

Rules:

1. Exact version/range matching is preferred.
2. A fallback must be declared by the script or versioned pattern and list semantic loss.
3. A fallback that changes story meaning, evidence, source selection, or timing intent is forbidden.
4. `preview-only` cannot enter an executable batch.
5. Unsupported executable intent is a compile error, not a skipped operation.
6. The capability-manifest hash is pinned into the proposal and checked at commit.

Examples:

- A named grade unavailable in the renderer may fall back to “no creative grade” if the pattern declares it and the user sees the degradation.
- A J-cut cannot fall back to a straight cut without explicit approval because the intended audio/picture relationship changes.
- A ripple trim cannot fall back to an overwrite trim merely because both change duration.

## Atomic apply, conflict handling, and revisions

### Commit protocol

The runtime applies a proposal only after an approval record references its exact proposal ID. P0 should commit the whole proposal atomically; later, independently selectable batches can be committed as a new proposal compiled against the intermediate accepted revision.

```ts
function commitProposal(store: RevisionStore, proposal: EditProposal, approval: Approval): CommitResult {
  assert(approval.proposalId === proposal.proposalId);
  assert(!proposal.diagnostics.some(d => d.blocking));

  return store.transaction(() => {
    const head = store.getHead();
    if (head.revisionId !== proposal.baseRevisionId || head.timelineHash !== proposal.baseTimelineHash) {
      return conflict("BASE_REVISION_CONFLICT", head.revisionId);
    }
    verifyCapabilitiesStillMatch(proposal.dependencyHashes.capabilities);

    let working = deepClone(head.document);
    for (const batch of proposal.batches) {
      assertPreconditions(batch.preconditions, working, head);
      working = applyBatchStrict(working, batch.operations);
      validateDocument(working);
      assert(hashTimeline(working) === batch.expectedResultHash);
    }

    const revision = makeRevision({
      document: deepFreeze(working),
      parents: [head.revisionId],
      causedBy: { proposalId: proposal.proposalId, batchIds: proposal.batches.map(b => b.batchId),
                  approvalId: approval.id }
    });
    store.appendAndSetHead(revision);
    return { ok: true, revision };
  });
}
```

`applyBatchStrict` wraps or replaces current reducer cases so a missing target, invalid split, clamped value, or no-op throws a typed execution error. Commit failure leaves the head unchanged.

### Stale proposals

If the head no longer equals the proposal base, do not apply and do not silently replay operations. Offer:

- **Preview old proposal** against its original base, read-only.
- **Recompile** the original script against the new head, producing a new proposal ID, diff, and approval requirement.
- Later, **checked rebase** only when all touched-object fingerprints and range dependencies are unchanged; even then it emits a new proposal.

Index-based array patches and name-based targeting are never safe to rebase.

### Undo and redo

Undo is a new forward commit, not deletion of history.

At compile simulation, capture inverse operations from the exact pre-operation state and reverse their order per batch:

| Forward | Inverse data required |
|---|---|
| insert | inserted stable element ID -> remove |
| remove | full removed element plus original track/position -> insert |
| update | old values for exactly the patched keys -> update |
| split | original full element and generated child IDs -> remove children + restore original |
| cross-track move | original track and placement -> atomic move back |

To revert revision `R8` while head is `R8`, compile inverse batches against `R8` and commit `R9` with `revertOfRevisionId: R8`. If later revisions exist, default to recompiling a semantic revert and checking conflicts rather than replaying an old inverse blindly.

Redo is reapplication as a newly compiled proposal against the current head. It is not moving a mutable history pointer in a collaborative/revisioned model. A local P0 UI may expose pointer-like Undo/Redo, but the underlying records should still be append-only revisions.

## Preview and diff

Preview uses the same strict simulator and lowered operations as commit. There must not be a separate “best effort” preview implementation.

```ts
interface PreviewDescriptor {
  baseRevisionId: RevisionId;
  resultTimelineHash: ContentHash;
  affectedRanges: CompositionRange[];
  structuralDiff: TimelineDiff;
  renderRequests: Array<{
    range: CompositionRange;
    beforeHash: ContentHash;
    afterHash: ContentHash;
    priority: "primary" | "context";
  }>;
}
```

P0 can provide structural preview without a renderer:

- before/after item positions and durations;
- inserted/removed/updated elements;
- affected track and time ranges with one or two seconds of context;
- warnings, fallback decisions, evidence links, and expected output duration;
- a temporary timeline shown in the existing preview monitor.

The ephemeral preview document is addressed by result hash and never becomes the accepted head until commit. If audiovisual preview exists, render only merged affected ranges plus context; full-project rendering is not a precondition for approval.

Preview failures are not compile fallbacks. The proposal can remain structurally inspectable, but the UI must say audiovisual preview is unavailable.

## Caching and invalidation

Use content-addressed phase caches. Cache values are immutable and include compiler/schema versions.

| Phase output | Cache key includes | Invalidated by |
|---|---|---|
| AST | normalized script text, parser version | script/parser change |
| resolved intents | AST hash, base hash, asset/evidence/style hashes, resolver version | any referenced snapshot change |
| pattern expansion | intent hash, exact pattern versions, policy hash | intent/pattern/policy change |
| lowered batches | plan hash, capability hash, lowering version | plan/capability/compiler change |
| simulation/diff | batch hash, base timeline hash, validator version | operations/base/validator change |
| render preview | result hash, range, renderer/version, asset-representation hashes | result/range/renderer/media change |

Important rules:

- Cache success and diagnostics, but never cache approval or proposal status with compilation artifacts.
- A changed playhead or UI selection invalidates compilation only if the script explicitly captured it as a selector input. Resolve `selection`/`playhead` into stable IDs/frame times before hashing.
- Asset proxy replacement need not invalidate semantic compilation if asset identity, available range, and content hash are unchanged; it does invalidate rendered preview.
- New unrelated evidence should not eventually invalidate an intent that pins specific evidence IDs, but P0 may safely use the whole evidence snapshot hash.
- Do not reuse simulation across different base timeline hashes even if operation text is identical.
- Cache access cannot change diagnostic ordering or generated IDs.

P0 can use in-memory `Map<hash, value>` caches. The contracts matter more than persistence during the hackathon.

## Error and fallback policy

The governing principle is: **preserve intent or stop visibly**.

### Blocking errors

No executable proposal is emitted for parse/schema errors, unresolved or ambiguous identities, wrong time space, invalid ranges, locked targets, missing source media, source-bound violations, missing required capabilities, expansion limits, failed simulation, or failed postconditions.

### Warnings

Warnings are appropriate for declared degradations, low-confidence evidence, subjective style concerns, unusually short handles, potential caption collision, or unavailable audiovisual preview. Policies may require explicit warning acknowledgment.

### Declared fallbacks

A fallback is eligible only when all are true:

1. the script or exact pattern version declares it;
2. its preconditions pass;
3. semantic loss is stated in the proposal;
4. it does not invent evidence or exceed source bounds;
5. it is deterministic;
6. the capability policy permits it.

Do not catch a compiler exception and emit a partial proposal. Unexpected exceptions become `INTERNAL_COMPILER_ERROR` with a correlation ID; inputs should be retained for reproduction without exposing sensitive media content in logs.

Resource limits are errors, not reasons to truncate silently: maximum AST nodes, pattern depth, expanded operations, diagnostic count, and preview duration should be policy values.

## Determinism rules

1. Canonically serialize all hashed values with stable key order and finite normalized numbers.
2. Quantize times once at the compiler boundary; do not repeatedly round between phases.
3. Generate IDs from semantic inputs and stable ordinals, never time, randomness, or array length in mutable state.
4. Pin every versioned dependency: compiler, parser, timeline schema, pattern, style, capabilities, validators, and relevant asset/evidence snapshots.
5. Use stable sort tie-breakers everywhere.
6. Keep model calls, network retrieval, current date, and locale-sensitive formatting outside compilation.
7. Treat the script source span as diagnostic metadata, not timeline identity.
8. Re-running compilation may create a new audit event, but its proposal semantic payload and ID remain identical.

## Required invariants

These are implementation gates, not aspirations.

1. **No direct mutation:** compilation and preview never alter the accepted revision or objects reachable from it.
2. **Pinned base:** every proposal names one exact base revision and timeline hash.
3. **Deterministic result:** identical pinned inputs produce identical intent IR, operations, diagnostics, result hash, and proposal ID.
4. **Resolved execution:** no executable operation contains a name/query/“current selection” selector.
5. **Atomicity:** either every approved batch passes and a descendant revision is appended, or the head is unchanged.
6. **Strict execution:** no operation may clamp, disappear, or partially succeed without a diagnostic and failed transaction.
7. **Capability honesty:** every executable operation names supported capability semantics; every degradation is explicit.
8. **Reversibility:** every accepted batch has a tested inverse or is rejected as non-reversible under current policy.
9. **Evidence integrity:** lowering cannot replace, widen, or fabricate source evidence to make an operation pass.
10. **Clock integrity:** source and composition times are typed; persisted executable timing is frame/tick aligned.
11. **Identity integrity:** IDs are stable and globally unique; moving an item never creates an orphan or ID alias.
12. **Preview parity:** preview and commit use the same operations, validators, and base; the committed result hash must equal the previewed expected hash.
13. **History preservation:** accept, modify, and revert append records; they do not overwrite the proposal or erase accepted revisions.
14. **Visible failure:** unsupported intent and stale state fail explicitly; neither is converted into best-effort editing.

## P0 migration path

The smallest credible route preserves current UI behavior while changing its authority model.

### Step 1: introduce revision and proposal wrappers

Add in-memory types for `TimelineRevisionSnapshot`, `EditProposal`, `AtomicOperationBatch`, diagnostics, and approval. Initialize `EditorShell` with a deterministic `R0` around `demoTimeline`. Replace the single authoritative `timeline` state with `headRevision`; derived `timeline` remains `headRevision.document`.

Acceptance:

- every accepted change creates a new immutable snapshot;
- head and parent IDs are visible in development diagnostics;
- existing drag/inspector edits can temporarily compile as one-operation local proposals and auto-approve as explicit direct-manipulation actions.

### Step 2: strict validator and simulator around current five operations

Create a strict `validateOperation` and `simulateBatch`. Use current `applyTimelineOperation` only after validation, then assert that the expected target changed and the document remains valid. Deep-clone/freeze in development to expose mutation leaks.

Tighten current semantics:

- reject values that would be clamped;
- reject missing targets/tracks and invalid splits;
- forbid `id` and `trackId` in `element.update` patches;
- make split child IDs compiler-supplied or deterministically derived and collision-checked;
- capture inverse operations during simulation;
- decide document-duration expansion explicitly.

Acceptance: an invalid second operation causes zero accepted changes.

### Step 3: make AgentPanel propose, not apply

Change `localPlan` to return a script/intent or proposal request. At minimum, wrap its existing operations in a compiler-produced proposal. Replace `onOperations` with `onPropose`; show summary, operation diff, warnings, Apply, and Reject. Apply calls the commit runtime only after approval.

Acceptance: clicking “Tighten the hook” leaves the accepted cut unchanged until Apply; a concurrent manual edit makes the old proposal stale.

### Step 4: structural preview and undo

Simulate the proposal to an ephemeral document, let the preview monitor toggle base/result, and show affected ranges. Wire Undo to compile/commit the inverse of the head revision.

Acceptance: preview result hash equals committed result hash; Undo creates a new revision and restores canonical document equality with the prior state.

### Step 5: route analysis through the same gate

Stop replacing the timeline directly with `timelineFromAnalysis(payload)`. For P0, compute the analyzed draft, diff it against the current base, and package the replacement as a proposal, or introduce an explicit `timeline.replace-draft` operation permitted only for first-draft construction. The proposal must still name the base and require approval.

Replace `id: analysis-${Date.now()}` with a deterministic ID from analysis input/result hashes.

Acceptance: source analysis cannot silently discard manual edits made after analysis began; stale analysis results compile/commit as conflicts.

### Step 6: add script front end and intent lowering

Connect the chosen script grammar to the AST, resolver, intent IR, and current-operation lowering. Support only a narrow truthful subset first: select by stable ID, insert, update allowed fields, move within track, split, remove, and atomic grouping. Reject unimplemented ripple/J-cut/transition semantics with capability diagnostics.

Acceptance: two runs of the same fixture produce byte-identical semantic proposals; ambiguous display-name selection fails.

### Step 7: add assets, integer time, and future operations incrementally

Introduce an asset manifest with duration and representations, then source-range validation. Migrate persisted timing to frames/ticks behind an adapter so UI seconds remain ergonomic. Add native compound operations only with validators, inverses, and capability entries.

Recommended native future operations:

```ts
type FutureTimelineOperation =
  | { type: "element.move"; elementId: string; fromTrackId: string; toTrackId: string; atFrame: number }
  | { type: "trim.overwrite"; elementId: string; edge: "in" | "out"; toFrame: number }
  | { type: "trim.ripple"; elementId: string; edge: "in" | "out"; toFrame: number; affectedTrackIds: string[] }
  | { type: "trim.roll"; leftElementId: string; rightElementId: string; cutToFrame: number }
  | { type: "element.slip"; elementId: string; sourceStartFrame: number }
  | { type: "transition.set"; leftElementId: string; rightElementId: string; spec: TypedTransition }
  | { type: "effect.set"; elementId: string; effect: TypedEffect }
  | { type: "document.setDuration"; durationFrames: number };
```

Do not implement these as arbitrary `Partial<TimelineElement>` patches; their relational preconditions and inverse semantics belong in their operation type.

## P0 fixtures and tests

The other agent should be able to validate the contract without a renderer.

1. **Determinism:** compile the same script/base/capabilities twice and deep-equal proposal semantic payloads.
2. **No mutation:** freeze base, compile and preview, then verify base hash unchanged.
3. **Atomic failure:** valid update followed by missing-element update yields error and unchanged head.
4. **Stale base:** compile against R0, commit a manual edit to R1, then reject the R0 proposal.
5. **Inverse:** apply insert/update/remove/split fixtures and apply generated inverse; canonical document equals base.
6. **No silent clamp:** negative start or overlong duration is a blocking diagnostic.
7. **Track move:** patching `trackId` is rejected; atomic remove+insert/native move succeeds only across compatible unlocked tracks.
8. **Ambiguity:** duplicate display names cannot resolve without a stable ID or explicit ordered selector.
9. **Capabilities:** unsupported ripple trim fails; a declared cosmetic fallback compiles with a visible degradation.
10. **Preview parity:** preview hash equals committed revision timeline hash.
11. **Analysis race:** analysis based on R0 cannot replace R1.
12. **Limit:** recursive/large pattern expansion stops with a deterministic limit diagnostic.

## Recommended module seam

Names are illustrative, but keep pure compiler code independent of React:

```text
src/lib/scripting/
  ast.ts                 parser-facing structures
  compiler.ts            phase orchestration
  resolve.ts             snapshot-bound reference resolution
  intents.ts             semantic IR
  expand.ts              versioned patterns
  capabilities.ts        negotiation
  lower.ts               IR -> operation batches
  diagnostics.ts
src/lib/editor/
  validate.ts            operation/document validators
  simulate.ts            strict pure batch simulation + inverses
  revisions.ts           revision hashing/store contracts
  proposals.ts           preview/commit/revert protocol
```

The key dependency direction is:

```text
React UI -> proposal runtime -> compiler -> editor operation types/pure simulation
```

Editor primitives must not import React, agent/model clients, or UI selection state.

## Final implementation recommendation

For the hackathon, prioritize the authority boundary over language breadth. A tiny script subset that always produces a pinned, previewable, atomic, reversible proposal demonstrates the product thesis better than a rich grammar that mutates the timeline optimistically.

The first vertical slice should be “tighten the hook” compiled against a known revision:

1. resolved stable clip/title IDs and evidence references;
2. three current operations in one atomic batch;
3. strict duration, lock, target, and no-clamp validation;
4. before/after structural preview;
5. Apply/Reject;
6. immutable revision and working Undo;
7. stale-proposal failure after any intervening edit.

That slice establishes the durable runtime contract. Ripple edits, split A/V, typed effects, rational time, and richer patterns can then land as honest capability additions without changing the core scripting model.
