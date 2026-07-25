# Human–agent collaborative video editing

Accessed/researched: 2026-07-25  
Scope: mixed initiative, proposals and diffs, alternatives, explanations, approval, critique, revision history, feedback data, and evaluation.  
Status: research synthesis and product guidance; not an implementation specification.

## Executive recommendation

Build the editor around an **evidence → proposal → inspect → preview → decide → immutable revision** loop. The agent may analyze, retrieve, rank, and propose proactively, but it should not silently overwrite an accepted cut. Each proposal must name its base revision, show what changes and why, retain links to source evidence, survive deterministic preflight checks, and support four semantically different outcomes: `accept`, `reject`, `modify`, and `revert`.

This is not merely a safety wrapper. It is the creative interaction model. VideoDiff found that aligned timeline/transcript differences reduced comparison time from an average 74 seconds per question to 38 seconds and improved comparison accuracy; its users could refine, recombine, pin, and archive variations rather than choose from opaque final renders ([Huh et al., 2025](https://arxiv.org/abs/2502.10190)). VideOrigami found that connected canvas, narrative, scene-plan, and timeline representations helped creators stay oriented, but also found that destructive direct manipulation made participants reluctant to iterate when prior versions were not visibly retrievable ([Cao et al., 2025](https://hci.ucsd.edu/papers/videorigami.pdf)). The platform should therefore make the edit's intermediate structures and history visible, not reduce collaboration to chat plus a finished render.

The hackathon-sized version is:

```text
accepted revision R7
  → agent proposal P18 against R7
  → deterministic preflight
  → proposal card + aligned diff + range preview
  → accept all / accept selected / edit / reject
  → immutable R8, or no timeline change
  → later revert creates R9; it does not erase R8
```

## What the research supports

### Mixed initiative is adjustable initiative, not maximum autonomy

Mixed-initiative systems couple automation with direct manipulation. Horvitz's foundational principles include user invocation of intelligent services, scoping actions according to inferred goals and confidence, and choosing whether to act or ask by considering the costs and benefits under uncertainty ([Horvitz, 1999](https://erichorvitz.com/uiact.htm)). The 18 empirically validated Microsoft human–AI interaction guidelines add efficient invocation, dismissal and correction; graceful degradation when uncertain; explanations; granular feedback; consequences of feedback; and global controls ([Amershi et al., 2019](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/)).

For editing, initiative should vary by consequence:

| Level | Agent behavior | Appropriate examples | Required user control |
|---|---|---|---|
| Observe | Analyze and annotate, no composition change | transcript, shots, faces, silence, quality flags | inspect, correct, hide |
| Suggest | Offer a recommendation in context | cut point, B-roll, title, music cue | dismiss or preview |
| Propose | Build a typed patch against a revision | rough cut, caption pass, reframe pass | diff, preview, partial accept |
| Apply with permission | Commit an approved, verified patch | explicit “Apply” action | atomic commit and undo |
| Auto-apply reversible low-risk work | Commit within an explicitly enabled policy | perhaps spelling normalization or proxy metadata, never story cuts by default | visible activity, global off switch, easy revert |
| Block and ask | Stop because intent or evidence is insufficient | uncertain identity, quote context, rights, destructive ripple | focused clarification with safe alternatives |

Default to `propose` for story, timing, source selection, speech removal, synthetic content, and any edit whose error requires rewatching to discover. Do not equate high model confidence with permission. Confidence concerns the inference; permission concerns the consequence.

Creative systems also need more than prompt-response turn taking. In a 185-person study, mixed-initiative co-creative configurations covering more ways for human and AI to communicate intent were rated as high as or higher than narrower configurations, while preferences differed by expertise; participants additionally asked for scrutability and explainability ([Lin et al., 2023](https://arxiv.org/abs/2305.07465)). COFI similarly models collaboration through participation style, initiative timing, contribution type, and communication with both the collaborator and the shared artifact, and its analysis of 92 systems found communication channels underdeveloped ([Rezwana and Maher, 2022](https://arxiv.org/abs/2204.07666)). Preserve both command paths:

- language for intent, goals, critique, and cross-cut transformations;
- direct timeline/transcript/canvas manipulation for exact selection, timing, spatial reference, and repair.

LAVE deliberately supports both agent execution and direct timeline editing so people can manually refine agent actions ([Wang et al., 2024](https://arxiv.org/abs/2402.10294)). ExpressEdit's formative work found editors naturally combine language with sketching to convey temporal, spatial, operational, and parameter references ([Tilekbay et al., 2024](https://arxiv.org/abs/2403.17693)). Chat should complement, not replace, native editing instruments.

### Alternatives are useful only when their differences are cheap to inspect

Video is temporally expensive to compare. Ten full renders are not ten usable choices. VideoDiff derived six goals from professional editors: minimize redundant watching; enable rapid difference skimming; support different edit stages; choose the appropriate comparison modality; organize/customize variants; and help users find the best, lower-error version. Its interface aligned alternatives to common source sections, synchronized transcripts, switched between source and edited time, offered effect-specific previews, and kept refine/recombine/regenerate actions next to the parent version ([Huh et al., 2025](https://arxiv.org/abs/2502.10190)).

Use a small, intentionally diverse set—normally three candidates plus “keep current”—and describe the trade-off axis:

- A: shortest and fastest hook;
- B: more context and chronological fidelity;
- C: performance-led, preserving pauses and reactions;
- Current: no change.

The alternatives should differ because of declared objectives or constraints, not merely sampling noise. Show a compact comparison table before asking anyone to watch:

| Signal | Current | A | B | C |
|---|---:|---:|---:|---:|
| Duration | 42 s | 29 s | 38 s | 41 s |
| Source segments removed | — | 5 | 2 | 1 |
| Required beats covered | 4/4 | 3/4 ⚠ | 4/4 | 4/4 |
| Speaker changes | 3 | 3 | 3 | 4 |
| Low-confidence decisions | 0 | 1 | 0 | 1 |

Pin, archive, rename, branch from, and recombine alternatives. Never automatically promote a newly generated option merely because it is new. VideoDiff placed edited variants beside their parent and summarized the change; that lineage is more useful than a flat gallery.

### Intermediate structures are the common ground

VideOrigami's freeform asset canvas, narrative editor, grid scene plan, and timeline are examples of **compositional structures** that allow inspection and control at different fidelities. Synchronized highlighting helped users trace related content across views, while artifacts of the process remained available for fact checking and further editing ([Cao et al., 2025](https://hci.ucsd.edu/papers/videorigami.pdf)). ReelFramer similarly asks users to settle a premise and foundational story details before generating a complete script; it color-highlights where source information points appear so omissions are glanceable ([Wang et al., 2024](https://arxiv.org/abs/2304.09653)).

For this platform, preserve and cross-highlight:

```text
source evidence ↔ narrative beat ↔ timeline operation ↔ rendered range
```

Clicking any one should reveal the others. This makes a recommendation explainable in editorial terms and repairable in timeline terms.

## Interaction protocol and state machine

### Proposal lifecycle

```text
                    ┌──────────────┐
intent/context ───▶ │   drafting   │
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐      failed hard check
                    │  preflight   │ ──────────────────────▶ blocked
                    └──────┬───────┘                          │
                           │ valid/warnings                    │ repair or cancel
                           ▼                                   │
                    ┌──────────────┐ ◀─────────────────────────┘
                    │   proposed   │
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐
                    │  reviewing   │
                    └──┬───┬───┬──┘
              accept   │   │   │ reject
                       │   │   └──────────────▶ rejected
                       │   └ modify
                       ▼      ▼
                  committed  superseded ──▶ new proposal against same/new base
                       │
                       │ later revert
                       ▼
                 reverted_by_new_revision
```

Terminal proposal states are facts, not mutable labels. A later revert does not change `committed` into “never happened”; it appends a new revision and a `revert` feedback event. If the base revision changed during review, set `stale`, recompute the diff, and require re-review for conflicting operations.

### Transition rules

1. `drafting → preflight`: proposal has typed operations, a base revision, evidence links, and preview scope.
2. `preflight → blocked`: any hard invariant fails. A blocked patch cannot be previewed as if executable.
3. `preflight → proposed`: hard checks pass; warnings remain explicit.
4. `proposed → reviewing`: the user opens the proposal or preview. Log exposure, not approval.
5. `reviewing → committed`: selected operations apply atomically to the named base and produce a new immutable revision.
6. `reviewing → rejected`: no timeline mutation. Reason is optional and should take one gesture; detailed feedback is offered, not demanded.
7. `reviewing → superseded`: the user edits the proposal, changes its intent, or asks for another candidate. The replacement has its own ID and `parentProposalId`.
8. `committed → reverted_by_new_revision`: an inverse or compensating patch produces another revision. Preserve downstream changes where possible; if not, show the conflict before applying.

### Proposal card

Every proposal card should answer, in this order:

1. **What:** “Remove 11.2 s across three pauses and one repeated phrase.”
2. **Where:** affected output and source ranges, with click-to-seek.
3. **Why:** concise goal/constraint and evidence, not hidden chain-of-thought.
4. **Risk:** warnings, uncertainty, ripple scope, lost context, and render cost.
5. **Difference:** aligned transcript/timeline delta; unchanged context collapsed but expandable.
6. **Preview:** preroll, changed interval, and postroll; audio-first preview for speech cuts.
7. **Choice:** Apply selected, Keep current, Edit, or Show alternatives, with equal visual weight.

Avoid presenting free-form model rationales as proof. The most useful explanation is often a faithful, inspectable provenance statement:

```text
Suggested because: your brief asks for ≤30 s; this removes a repeated claim
at source 00:04:18.200–00:04:25.600. Transcript confidence 0.94.
Consequence: output becomes 29.6 s; the reaction shot moves 7.4 s earlier.
Not checked: whether the pause is important for comic timing.
```

Amershi et al. recommend making capability and likely error clear, explaining behavior on demand, and conveying the consequences of user actions ([2019](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/)). Explanations should help users predict, verify, or change the system—not decorate a recommendation with persuasive prose. Mental-model evaluation research likewise argues that the goal is a valid user representation of system behavior, not merely higher reported trust ([Schrills and Franke, 2020](https://arxiv.org/abs/2002.02526)).

### Diff and preview modes

Use the modality that exposes the decision most directly:

| Edit | Primary diff | Required preview/context |
|---|---|---|
| Speech deletion/reorder | word-aligned transcript with deletions/moves | waveform plus A/V preroll and postroll |
| Shot selection/reorder | source-aligned shot strip and beat labels | cut-boundary loops and full sequence option |
| B-roll | insertion span above A-roll transcript | underlying line before/after, source provenance |
| Reframe/crop | before/after frame or wipe overlay; tracked subject path | representative frames plus motion preview |
| Captions/text | text diff and safe-area overlay | read-time and collision warnings |
| Audio mix | gain/envelope diff | loudness delta and bypass A/B |
| Color/effect | split-screen or bypass | representative shots and scopes when relevant |
| Global style pass | parameter/recipe diff grouped by pass | contact sheet plus short representative montage |

Offer `changed ranges only` first, then `in context`, then `full cut`. A boundary loop might play two seconds before and after a cut; a narrative reordering needs the whole affected beat. Never claim a low-resolution or partial preview is the final render.

### Partial approval

Group operations into meaningful, dependency-aware hunks. Let users accept a whole proposal or independent hunks, but do not expose individual low-level operations when that would break a semantic edit. For example, “remove repeated sentence” may require linked video trim, two audio fades, caption deletion, and downstream marker movement; those operations should be one atomic hunk.

Dependencies must be explicit:

```text
H1 remove repeated phrase
 ├─ O1 trim linked A/V
 ├─ O2 remove caption words
 ├─ O3 add 3-frame audio crossfade
 └─ O4 ripple downstream beat markers

H2 add reaction cutaway (independent of H1)
```

If accepting H1 invalidates H2's placement, either declare the dependency or rebase H2 and require a refreshed preview.

## Concrete data contracts

These are intentionally more specific than the HCI literature. They are implementation recommendations derived from the cited findings.

```ts
type ProposalState =
  | "drafting" | "preflight" | "blocked" | "proposed" | "reviewing"
  | "stale" | "committed" | "rejected" | "superseded";

type RationalTime = { value: number; rate: number };
type TimeRange = { start: RationalTime; duration: RationalTime };

interface EvidenceRef {
  evidenceId: string;
  assetId: string;
  sourceRange: TimeRange;
  kind: "transcript" | "shot" | "face" | "action" | "sound" |
        "music" | "quality" | "user_marker" | "brief_rule";
  claim: string;                 // UI-safe, falsifiable summary
  confidence?: number;
  producerVersion: string;
  humanStatus?: "unreviewed" | "confirmed" | "rejected";
}

interface ProposalHunk {
  hunkId: string;
  label: string;
  intent: string;
  operationIds: string[];
  dependsOn: string[];
  affectedOutputRanges: TimeRange[];
  evidence: EvidenceRef[];
  warnings: ReviewIssue[];
  preview: {
    kind: "boundary_loop" | "range" | "representative" | "full";
    uri?: string;
    prerollMs: number;
    postrollMs: number;
    fidelity: "proxy" | "final";
  };
}

interface EditProposal {
  proposalId: string;
  projectId: string;
  baseRevisionId: string;
  parentProposalId?: string;
  author: { kind: "agent" | "human"; id: string };
  createdAt: string;
  state: ProposalState;
  userIntent: string;
  summary: string;
  objectiveTradeoffs: string[];
  hunks: ProposalHunk[];
  operations: TimelineOperation[]; // typed, deterministic commands
  inverseOperations?: TimelineOperation[];
  preconditions: Predicate[];
  preflight: {
    status: "pending" | "passed" | "blocked";
    hardFailures: ReviewIssue[];
    warnings: ReviewIssue[];
    verifierVersion: string;
  };
  planner: { model: string; version: string; promptOrPolicyHash: string };
}

interface ReviewIssue {
  issueId: string;
  type:
    | "unsupported_story_beat" | "missing_required_beat" | "redundancy"
    | "truth_or_context_risk" | "continuity" | "pacing" | "style_deviation"
    | "source_range" | "handles" | "sync" | "collision" | "accessibility"
    | "audio" | "color" | "delivery" | "low_confidence";
  severity: "blocker" | "warning" | "suggestion";
  affectedIds: string[];
  range?: TimeRange;
  claim: string;
  evidenceIds: string[];
  repairs: Array<{ label: string; operationTemplateId?: string }>;
  status: "open" | "resolved" | "dismissed";
}
```

JSON Patch is a useful wire-format analogy because it defines ordered `add`, `remove`, `replace`, `move`, `copy`, and `test` operations and specifies atomic failure behavior for HTTP PATCH ([RFC 6902](https://www.rfc-editor.org/info/rfc6902/)). A video timeline still needs domain operations—trim, slip, ripple, link, transition, gain, transform—and frame/sample-aware preconditions rather than generic array-index mutations. Store stable item IDs, not fragile positional JSON paths.

## Critique and discrepancy loop

Do not ask an agent “is this good?” and accept a single scalar self-score. Review against explicit, independently inspectable dimensions:

```text
accepted revision + brief + style map + evidence
  → deterministic technical checks
  → editorial rubric checks
  → typed discrepancy list
  → rank by severity × confidence × repair cost
  → user dismisses, edits, or requests repair
  → repair proposal against the same named revision
  → preview and decision
```

Separate three reviewers conceptually even if the hackathon uses one model plus code:

- **Verifier:** deterministic invariants—ranges, handles, sync, collisions, required delivery values.
- **Critic:** editorial observations—missing premise, repetition, unsupported claim, weak hook, rhythm, style deviation.
- **Human editor:** decides whether the observation matters and whether a repair serves the piece.

Every discrepancy needs a falsifiable claim, scope, evidence, severity, and candidate repair. “Pacing could be better” is not actionable; “the 14.8-second setup exceeds the brief's 8-second hook target; compare trims at these two sentence boundaries” is. A dismissed discrepancy should remain dismissed for that revision unless relevant evidence or constraints change.

ReelFramer demonstrates a useful discrepancy visualization: map required information points into the generated script so absence indicates a possible omission and excessive concentration becomes visible ([Wang et al., 2024](https://arxiv.org/abs/2304.09653)). For this platform, use the same pattern for required beats, people, claims, brand/legal elements, and style constraints.

Critique should be scope-aware. The agent may critique a selected beat, affected range, sequence, or delivery profile. Do not flood the user with whole-project advice after a local trim. Cap visible issues, place blockers first, and group repeated instances.

## Undo, revision history, and branching

### Required semantics

- The accepted timeline is an immutable revision with a stable ID and parent(s).
- Applying a proposal creates a new revision; it never mutates the prior revision in place.
- Undo during the current session may apply an inverse command, but a durable revert is another revision referencing the reverted proposal.
- Agent proposals and previews are ephemeral until accepted, but their decision records remain available for audit and learning.
- Branching an alternative records its common ancestor. Merging uses stable timeline-item identities and detects semantic conflicts.
- Autosave is not version history. Users need named checkpoints and a visible proposal/revision lineage.
- Restore must preview which later changes would be lost. Prefer “create new revision from this point” over destructive rollback.

VideOrigami directly observed fear of losing previous versions: its direct-manipulation interface made history less visible than chat, and users became reluctant to explore even though undo/redo could theoretically be added ([Cao et al., 2025](https://hci.ucsd.edu/papers/videorigami.pdf)). Therefore expose history spatially:

```text
R7 accepted cut
├─ P18 “faster hook” → R8
│  ├─ manual caption fix → R9 (current)
│  └─ P22 “performance-led alternative” (uncommitted)
└─ P19 “chronological hook” (archived)
```

At minimum, show: author, timestamp, intent summary, changed ranges, proposal/model version, parent revision, and Restore as new revision. “Undo AI” should not be a special unreliable mechanism; agent and human edits should share the same revision substrate while retaining authorship.

## Feedback and future preference data

### Log events, not inferred approval

```ts
type FeedbackAction =
  | "exposed" | "previewed" | "accepted" | "partially_accepted"
  | "rejected" | "modified" | "dismissed" | "reverted"
  | "published" | "abandoned";

interface CoeditFeedbackEvent {
  eventId: string;
  occurredAt: string;
  sessionId: string;
  projectId: string;
  actorId: string;                // pseudonymous for research export
  proposalId: string;
  baseRevisionId: string;
  resultingRevisionId?: string;
  action: FeedbackAction;
  selectedHunkIds?: string[];
  shownAlternativeIds: string[];  // full exposure set
  displayOrder: string[];
  previewedRanges: TimeRange[];
  dwellMs?: number;
  reasonTags?: Array<
    "wrong_content" | "wrong_timing" | "missing_context" | "style_mismatch" |
    "continuity" | "technical_failure" | "too_aggressive" | "too_subtle" |
    "prefer_current" | "other"
  >;
  comment?: string;
  humanDelta?: TimelineOperation[]; // proposal → eventual human result
  context: {
    briefHash: string;
    styleMapVersion?: string;
    mediaProfile: string;
    taskStage: string;
    plannerVersion: string;
    UIExperiment?: string;
  };
  consent: { productImprovement: boolean; modelTraining: boolean };
}
```

Semantics matter:

- **Accept:** positive evidence that this proposal was useful in this context, not timeless approval of every operation.
- **Partial accept:** labels selected and unselected hunks separately; unselected is not necessarily rejection if dependency or time prevented review.
- **Reject/dismiss:** explicit negative or “not now” feedback. Keep those distinct.
- **Modify:** the most valuable repair signal. Store the exact proposal-to-human delta and the final accepted context.
- **Revert:** delayed negative evidence, stronger when the revert explicitly targets the proposal. It may still mean the client's brief changed; ask for an optional reason.
- **Publish:** downstream evidence of viability, not proof that every edit was preferred.
- **Abandon:** ambiguous. Never label all shown candidates negative.

InstructGPT used human rankings of multiple model outputs as preference data, demonstrating the training value of explicit comparisons ([Ouyang et al., 2022](https://arxiv.org/abs/2203.02155)). The hackathon should **collect**, not immediately train on, interaction traces. First use them for replayable evaluation, failure clustering, recipe ranking, and retrieval of accepted examples.

### Bias and privacy safeguards

Implicit interaction data is biased by what was shown, its order, UI prominence, latency, and user attention. Learning-to-rank research shows that directly treating clicks as relevance labels produces biased models and motivates logging exposure/position propensities ([Joachims, Swaminathan, and Schnabel, 2017](https://arxiv.org/abs/1608.04468)). Applied here:

- log the complete candidate set and presentation order;
- log whether each candidate was actually previewed and how much;
- occasionally randomize equally safe candidates if conducting a consented experiment;
- retain current-cut/“none” as a choice;
- separate user-, project-, organization-, and global-level preferences;
- do not learn from collaborator actions as if they were the project owner's preference;
- delay final labels long enough to capture modify, revert, and publish outcomes;
- version models, prompts, recipes, evidence, and UI experiments;
- redact transcript/media content from analytics unless it is necessary and consented;
- provide separate, comprehensible controls for product analytics, personalization, and model training;
- establish retention/deletion/export rules before collecting free text or media-derived features.

Microsoft's guidelines recommend granular feedback, making future consequences clear, cautious adaptation, and global controls ([Amershi et al., 2019](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/)). Never imply that a thumbs-down immediately “teaches this project” unless it does. Show the actual scope: “Hide this suggestion,” “Prefer fewer text effects in this project,” or “Send feedback to improve the product.”

## Failure modes and dark patterns

| Failure/dark pattern | Why it fails | Guardrail |
|---|---|---|
| Silent timeline mutation | User discovers losses only by rewatching | proposals are non-mutating until explicit apply |
| One giant “magic edit” | impossible to inspect or partially approve | semantic hunks with provenance and affected ranges |
| Approval-colored default | visually steers users to accept | equal weight for Apply and Keep current; no preselection |
| Fake explanation | fluent rationale may be unfaithful and overpersuasive | operation/evidence/constraint-derived explanations; state unknowns |
| Confidence theater | an uncalibrated percentage looks authoritative | show only calibrated, meaningful confidence with failure implication |
| Alternative overload | shifts labor from editing to exhaustive watching | 3 diverse options, glanceable comparison, generate more on request |
| Novelty bias | newest option pinned as “best” | preserve current baseline and lineage; neutral ordering by default |
| Destructive regeneration | replaces a liked version | branch beside parent; pin/archive; immutable history |
| Hidden ripple | local request changes remote tracks/captions | affected-range map, dependency graph, preflight |
| Reject friction | easy accept, multi-step dismissal | one-click keep/reject; reason optional |
| Feedback coercion | blocks work until user labels data | feedback optional; editing never hostage to model improvement |
| False personalization claim | implies one action permanently trains AI | state scope and timing of adaptation precisely |
| Auto-learning instability | behavior shifts without clear cause | project-level preference ledger, versioning, reset/global controls |
| Agent self-review monoculture | same model generates and rubber-stamps | deterministic verifier; explicit rubric; human final judgment |
| High-fidelity anchoring | polished result causes premature convergence | begin with outline/beat/low-fidelity alternatives where appropriate |
| Oversight burden | approval dialogs become mechanical click-through | batch only independent low-risk hunks; escalate meaningful risks |

VideOrigami participants reported both overshoot—high-fidelity generations blocking nascent ideas—and loss of control when generated visuals missed their intent; lower-fidelity visual descriptions left more room for ideation ([Cao et al., 2025](https://hci.ucsd.edu/papers/videorigami.pdf)). Use fidelity progressively: beat plan before full timeline, thumbnails before final assets, proxy preview before render.

The FTC describes dark patterns as interfaces that obscure, subvert, or impair choice and highlights hidden information, visual steering, difficult cancellation, and deceptive data-sharing choices ([FTC, 2022](https://www.ftc.gov/reports/bringing-dark-patterns-light)). In a co-editor, the analogous harms are hidden edits, accept-biased buttons, obstructed undo, and consent bundled into ordinary feedback. Audit these explicitly even if no payment is involved.

## Evaluation and user-study plan

### Evaluate the team, not only the model

Offline edit-quality metrics cannot establish whether the collaboration works. Measure four layers:

1. **Proposal validity:** operation-schema validity, hard-check pass rate, stale/conflict rate, preview/render success, and unsupported-claim rate.
2. **Human–agent task performance:** time to first viable cut, time to locate a difference, comparison accuracy, accepted result quality, correction time, and missed injected errors.
3. **Interaction quality:** invocation/dismissal/correction cost, preview burden, number and diversity of explored branches, human modification distance, revert rate, and history recovery success.
4. **Experience:** workload, usability, agency/control, ownership, trust calibration, creativity support, satisfaction, and willingness to reuse.

Acceptance rate alone is a dangerous success metric: it can rise through visual steering, mediocre defaults, or review fatigue. A healthy system may lower raw acceptance while improving final quality and user agency.

### Hackathon study: 6–12 creators, within subjects

Use a 45–60 minute study that compares:

- **Baseline:** same agent recommendations and preview player, but a flat proposal/result list without aligned diffs, evidence links, partial apply, or visible lineage.
- **Collaborative UI:** proposal cards, source-aligned diff, context preview, alternatives, partial apply, and immutable history.

Counterbalance condition and footage order. Recruit novices and experienced editors; analyze them separately because expertise changes mixed-initiative preferences ([Lin et al., 2023](https://arxiv.org/abs/2305.07465)) and VideOrigami observed different expert/novice responses to generation ([Cao et al., 2025](https://hci.ucsd.edu/papers/videorigami.pdf)). Give both conditions identical model outputs to isolate interface value.

Tasks:

1. **Difference comprehension:** compare three 30–60 second cuts and answer factual questions about omitted content, order, duration, B-roll, and captions.
2. **Brief-driven edit:** choose/refine a cut to a target audience, duration, and required-beat brief.
3. **Failure recovery:** inject an unsupported removal, insufficient-handle transition, or context-losing quote and measure detection and repair.
4. **Version recovery:** modify an accepted edit, then restore/branch from the earlier version without losing an unrelated later change.

VideoDiff provides a strong precedent: a within-subject study with 12 creators used matched footage, task time/accuracy, NASA-TLX, usefulness, final satisfaction, and the Creativity Support Index; it also added exploratory sessions on creators' own footage ([Huh et al., 2025](https://arxiv.org/abs/2502.10190)). B-Script compared timeline, transcript, and transcript-plus-recommendation interfaces with 110 participants, finding transcript interaction faster/easier and recommendations associated with more engaging outputs ([Huber et al., 2019](https://research.adobe.com/publication/b-script-transcript-based-b-roll-video-editing-with-recommendations/)). PodReels likewise combined a formative expert study with a creator evaluation and found reduced mental demand and improved teaser-production efficiency ([Wang et al., 2024](https://arxiv.org/abs/2311.05867)).

Collect:

- task completion time and success;
- comparison-question accuracy;
- total video seconds watched per decision and redundant rewatch time;
- number of alternatives previewed, pinned, recombined, or abandoned;
- accept/partial/reject/modify/revert actions and human-delta size;
- injected-error detection and false-alarm rates;
- undo/restore completion time and errors;
- NASA-TLX mental/temporal demand;
- a short usability score such as SUS;
- Creativity Support Index factors for exploration, expressiveness, immersion, enjoyment, and results worth effort;
- 5- or 7-point items for “I remained in control,” “I understand why edits were proposed,” “I can predict what Apply will change,” and “the final cut feels like mine”;
- interview prompts about trust calibration, unwanted steering, missing controls, and when the agent should lead/follow/ask.

For outcome quality, have at least two blind raters evaluate both final cuts in randomized order on:

- brief compliance;
- factual/contextual faithfulness;
- narrative clarity/coherence;
- pacing and engagement;
- continuity and technical defects;
- style fit;
- overall preference.

Report inter-rater agreement and disagreements rather than hiding subjectivity behind an average. ReelFramer used separate journalism experts for information coverage and TikTok power users for coherence/entertainment/style, illustrating why the evaluator must match the criterion ([Wang et al., 2024](https://arxiv.org/abs/2304.09653)).

### Instrumentation tests before recruiting

- Every Apply event names the exact proposal, selected hunks, base, and resulting revision.
- Every proposal exposure logs all displayed alternatives and order.
- Preview telemetry distinguishes loaded, started, seeked, and substantially watched.
- Revert can target a proposal even after intervening edits.
- Model/UI versions are attached to every event.
- Test accounts can export and delete their research events.
- Analytics failure never blocks editing.

## Hackathon priorities

### Must demonstrate

1. One typed proposal against an immutable base revision.
2. A synchronized transcript/timeline diff with source and output context.
3. Range preview with preroll/postroll and visible proxy status.
4. `Apply`, `Apply selected`, `Keep current`, and `Edit` actions.
5. A new revision on apply and a visible, non-destructive revert.
6. Evidence-backed “why” and a deterministic warning/blocker area.
7. Structured accept/reject/modify/revert logging with model and recipe versions.

### Strong next additions

1. Three objective-driven alternatives plus current, aligned to the same source.
2. Semantic hunks and dependency-aware partial approval.
3. Evidence ↔ beat ↔ operation cross-highlighting.
4. Typed discrepancy review with dismiss/repair.
5. Project preference controls (“fewer text effects,” “preserve pauses”) whose scope and future effect are explicit.

### Defer

- online RLHF or automatic fine-tuning from hackathon interactions;
- autonomous final-cut mutation;
- large alternative galleries;
- free-form agent rationales presented as ground truth;
- complex collaborative branch merging;
- a universal scalar “quality” or “confidence” score.

## Decision checklist

Before shipping an agent edit interaction, verify:

- Is the current accepted cut preserved?
- Does the proposal name the exact base revision?
- Can the user see all affected ranges and downstream ripple?
- Are source evidence and required constraints inspectable?
- Is the preview modality suited to the edit?
- Is “keep current” as easy as “apply”?
- Can independent changes be approved separately without violating dependencies?
- Does apply create an immutable revision, and can revert preserve later unrelated work?
- Are accept, partial accept, modify, dismiss, reject, and revert logged distinctly?
- Are exposure/order/preview events logged so preference data is interpretable?
- Does feedback state whether it affects this suggestion, this project, personalization, analytics, or model training?
- Are explanations faithful to operations/evidence, concise, and clear about unknowns?
- Has the flow been tested for novices and experienced editors separately?

## Primary and official sources

All links accessed 2026-07-25.

1. Eric Horvitz. “Principles of Mixed-Initiative User Interfaces.” CHI 1999. [Author publication page](https://erichorvitz.com/uiact.htm).
2. Saleema Amershi et al. “Guidelines for Human-AI Interaction.” CHI 2019. [Microsoft Research](https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/), [paper PDF](https://www.microsoft.com/en-us/research/wp-content/uploads/2019/01/Guidelines-for-Human-AI-Interaction-camera-ready.pdf).
3. Mina Huh et al. “VideoDiff: Human-AI Video Co-Creation with Alternatives.” CHI 2025. [Paper and HTML](https://arxiv.org/abs/2502.10190), [ACM DOI](https://doi.org/10.1145/3706598.3713417).
4. Bryan Wang et al. “LAVE: LLM-Powered Agent Assistance and Language Augmentation for Video Editing.” IUI 2024. [Paper](https://arxiv.org/abs/2402.10294).
5. Yining Cao et al. “Compositional Structures as Substrates for Human-AI Co-creation Environment: A Design Approach and A Case Study.” CHI 2025. [Author PDF](https://hci.ucsd.edu/papers/videorigami.pdf), [ACM DOI](https://doi.org/10.1145/3706598.3713401).
6. Zhiyu Lin et al. “Beyond Prompts: Exploring the Design Space of Mixed-Initiative Co-Creativity Systems.” ICCC 2023. [Paper](https://arxiv.org/abs/2305.07465).
7. Jeba Rezwana and Mary Lou Maher. “Designing Creative AI Partners with COFI.” TOCHI 2022. [Paper](https://arxiv.org/abs/2204.07666).
8. Bekzat Tilekbay et al. “ExpressEdit: Video Editing with Natural Language and Sketching.” IUI 2024. [Paper](https://arxiv.org/abs/2403.17693).
9. Bernd Huber et al. “B-Script: Transcript-based B-roll Video Editing with Recommendations.” CHI 2019. [Adobe Research](https://research.adobe.com/publication/b-script-transcript-based-b-roll-video-editing-with-recommendations/), [paper PDF](https://scholar.harvard.edu/files/bhb/files/bhuber_bscript.pdf).
10. Sitong Wang et al. “PodReels: Human-AI Co-Creation of Video Podcast Teasers.” DIS 2024. [Paper](https://arxiv.org/abs/2311.05867), [ACM DOI](https://doi.org/10.1145/3643834.3661591).
11. Sitong Wang et al. “ReelFramer: Human-AI Co-Creation for News-to-Video Translation.” CHI 2024. [Paper](https://arxiv.org/abs/2304.09653).
12. Marius Schrills and Thomas Franke. “How to Answer Why—Evaluating the Explanations of AI Through Mental Model Analysis.” 2020. [Paper](https://arxiv.org/abs/2002.02526).
13. Berkeley J. Dietvorst, Joseph P. Simmons, and Cade Massey. “Overcoming Algorithm Aversion: People Will Use Imperfect Algorithms If They Can (Even Slightly) Modify Them.” Management Science 2018. [Author PDF](https://faculty.wharton.upenn.edu/wp-content/uploads/2016/08/Dietvorst-Simmons-Massey-2018.pdf), [DOI](https://doi.org/10.1287/mnsc.2016.2643).
14. Thorsten Joachims, Adith Swaminathan, and Tobias Schnabel. “Unbiased Learning-to-Rank with Biased Feedback.” WSDM 2017. [Paper](https://arxiv.org/abs/1608.04468).
15. Long Ouyang et al. “Training Language Models to Follow Instructions with Human Feedback.” NeurIPS 2022. [Paper](https://arxiv.org/abs/2203.02155).
16. IETF. “RFC 6902: JavaScript Object Notation (JSON) Patch.” 2013. [RFC Editor](https://www.rfc-editor.org/info/rfc6902/).
17. Microsoft. “Human-AI eXperience (HAX) Toolkit.” [Official toolkit](https://www.microsoft.com/en-us/haxtoolkit/), [design patterns](https://www.microsoft.com/en-us/haxtoolkit/?p=108).
18. U.S. Federal Trade Commission. “Bringing Dark Patterns to Light.” 2022. [Official report](https://www.ftc.gov/reports/bringing-dark-patterns-light).
