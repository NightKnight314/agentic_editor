# Nighthack methodology-to-product blueprint

Date: 2026-07-25  
Scope: translate editing craft and technical research into a machine-actionable architecture for the current prototype.

## What already exists

The repository already has the right early abstractions:

- a typed timeline with video, overlay, caption, and audio tracks;
- basic insert, update, remove, split, and track-update operations;
- a local agent context containing project, playhead, selection, nearby elements, constraints, and an active style map;
- a structured `kumar-method` style map with beats, pacing, visuals, typography, audio, planner rules, and a weighted review rubric;
- an agent panel that maps natural-language prompts to operations.

The prototype currently applies heuristic operations immediately. Its next leap is to separate analysis, planning, preview/approval, execution, and verification.

## Recommended architecture

```text
media ingest
  -> immutable asset facts + proxies
  -> time-aligned analysis store
  -> evidence graph / searchable candidates
  -> brief + style map + hard constraints
  -> beat planner + ranked edit candidates
  -> validated operation proposal
  -> visual diff / user approval
  -> transactional timeline mutation
  -> render + automated QC + human playback
  -> outcome telemetry for later experiments
```

OpenTimelineIO is a useful interoperability model: it represents editorial cut information—including clips, timing, tracks, transitions, markers, and metadata—while referencing media externally rather than embedding it. Its adapter ecosystem covers interchange formats such as AAF, CMX 3600, Final Cut XML, and XGES, with differing support levels. Nighthack does not need to adopt OTIO immediately, but should preserve enough semantics to export to it later. See [OpenTimelineIO overview](https://opentimelineio.readthedocs.io/en/latest/index.html) and [adapter documentation](https://opentimelineio.readthedocs.io/en/latest/tutorials/adapters.html).

## P0: changes that unlock a credible hackathon demo

### 1. Replace immediate mutation with proposals

Return an `EditProposal` containing:

```ts
interface EditProposal {
  id: string;
  summary: string;
  intent: string;
  operations: EvidenceOperation[];
  alternatives?: EditProposal[];
  warnings: string[];
  checks: ConstraintCheck[];
  status: "proposed" | "approved" | "applied" | "reverted";
}
```

Show affected timeline regions, before/after timing, rationale, and warnings. Give the user Apply and Reject controls. Store the inverse patch or a full immutable timeline snapshot for undo.

### 2. Make operations expressive and safe

Add:

- ripple trim, roll trim, slip, slide, lift, extract/ripple delete;
- linked and independently editable audio/video components for J- and L-cuts;
- transitions with explicit in/out offsets and required media handles;
- typed effects and keyframes rather than string effect names;
- batch/transaction IDs, preconditions, ordering, and inverse operations;
- source duration and source-range validation;
- track compatibility, overlap/collision, lock, sync, and project-bound checks.

Frame-accurate trimming requires looking at both sides of an edit and distinguishes trim-in/out from rolling edits; Premiere's current trim documentation offers a concrete interaction model. Split edits make incoming audio precede picture (J-cut) or outgoing audio continue over the next picture (L-cut). See [Adobe trim mode](https://helpx.adobe.com/premiere/desktop/edit-projects/trim-clips/edit-in-trim-mode.html) and [Adobe J/L cuts](https://helpx.adobe.com/premiere/desktop/edit-projects/trim-clips/perform-j-cuts-and-l-cuts.html).

### 3. Add a minimal analysis manifest

For each asset, persist:

- technical facts: hash, streams, duration, timebase/frame rate, dimensions, rotation, audio layout, color metadata;
- timestamped transcript tokens, segments, speaker IDs, language, and confidence;
- shot boundaries and representative thumbnails;
- silence/speech/music regions and coarse quality flags;
- user-authored markers and corrections;
- analysis model/version and creation date.

Use stable IDs and integer frames or rational time internally. Display seconds may be rounded, but must not be written back as timing truth.

### 4. Implement one end-to-end editorial workflow

For the demo, make “tighten the hook” real:

1. find transcript/shot candidates in the opening and the strongest later proof or premise;
2. propose a 0–3 second opening plus a coherent continuation;
3. preserve full words and complete source ranges;
4. compare at least two alternatives;
5. preview and apply the selected proposal;
6. run duration, collision, caption, and speech-boundary checks.

YouTube describes retention graphs as empirical feedback: flat regions retain viewers, gradual declines lose viewers, spikes can indicate rewatching/sharing or confusion, and dips indicate skipping or abandonment. Its own guidance says the opening should quickly deliver on the title/thumbnail promise and that creators should experiment. Product implication: store opening variants and outcome telemetry instead of hard-coding a universal “three-second” law. See [YouTube key moments for audience retention](https://support.google.com/youtube/answer/9314415?hl=en-GB) and [YouTube recommendation-system content guidance](https://support.google.com/youtube/answer/16559650?hl=en).

### 5. Add a visible review gate

Compile the style map into checks:

- hard: valid source range, output duration, complete dialogue, no locked-track edits;
- measurable: hook deadline, shot-duration outliers, caption safe-area collisions, effect budget;
- subjective: story, contrast, rhythm, and humanity, each with evidence and a confidence label.

Never present subjective criteria as objective pass/fail facts.

## P1: platform-quality foundations

### Evidence-bearing timeline operations

Attach to each operation:

- source evidence (`assetId`, exact range, transcript/shot IDs);
- editorial intent and originating prompt/style rule;
- detector/planner version and confidence;
- constraints checked and results;
- actor, timestamp, approval, and undo link.

This action log also creates a path to content provenance. C2PA defines signed, tamper-evident provenance assertions and standardized edit actions such as cropping, adding text, changing speed, adjusting color, enhancement, transcoding, and generalized editing. C2PA intentionally validates associated assertions and bindings; it does not judge whether edits are “good” or “bad.” See the current [C2PA specifications index](https://spec.c2pa.org/specifications/) and [C2PA 2.3 action assertions](https://spec.c2pa.org/specifications/specifications/2.3/specs/C2PA_Specification.html#_actions).

### Truth-preserving transcript editing

- keep verbatim token text, normalized display text, timestamps, speaker, and confidence separately;
- snap text deletions to word/phoneme-aware boundaries with configurable handles;
- render the resulting speech sequence back to text so the user can read what the edit implies;
- flag reordered clauses, removed negation, cross-sentence splices, and chronology changes;
- require approval for edits that may change meaning.

### Accessibility as a first-class track

Captions must contain dialogue plus meaningful speaker and non-speech audio information when those sounds convey content. WCAG 2.2 requires captions for prerecorded synchronized media with meaningful audio at Level A. Product implication: generate captions from the final conformed timeline, preserve correction provenance, support sidecar export, and validate coverage and synchronization. See [W3C Understanding SC 1.2.2](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded) and [W3C captions guidance](https://www.w3.org/WAI/media/av/captions/).

### Export and QC

Generate a high-quality master before platform renditions. Record delivery profiles explicitly. Automated QC should probe output structure and detect likely black/freeze/silence, clipping, missing captions, invalid duration, and mismatched color/audio metadata; it cannot replace full human playback.

## Data-model gaps in the current prototype

| Current shape | Limitation | Recommended addition |
|---|---|---|
| floating-point `start`/`duration` | drift and ambiguous timebase | rational time or integer frames plus project rate |
| optional `sourceStart`, no source duration | cannot fully validate trims | asset manifest and explicit source range |
| string `effects` | no typed parameters, bounds, or keyframes | effect schema, parameter units, time-varying values |
| `volume` only | no gain stages, automation, channel layout | clip gain, track mix, keyframes, bus/layout metadata |
| no linked components | cannot model split edits or sync groups | link/sync group IDs and component-level timing |
| immediate operation reduce | no preflight, transaction, or undo | proposal, validation, atomic batch, inverse patch |
| nearby timeline context only | no source evidence or global story view | asset analysis manifest, beat plan, candidate retrieval |
| generic text/caption elements | no language, speaker, token timing, style regions | caption cue schema and transcript lineage |
| no markers/transitions/gaps | weak interchange and editorial semantics | explicit marker, gap, transition, stack/item types |

## Evaluation plan

Measure layers separately:

- perception: transcript and timing accuracy, speaker/boundary/tracking metrics;
- planning: constraint satisfaction, evidence coverage, redundancy, beat coverage, pairwise human preference;
- execution: deterministic replay, invalid-operation rate, sync/collision errors, round-trip fidelity;
- output: QC failures, caption coverage, render success, representative-device review;
- product: proposal acceptance, undo rate, time to first usable cut, manual repair time, and publish rate.

Post-publish retention can guide experiments but is confounded by packaging, audience, topic, and distribution. Compare like formats and preserve editorial judgment.

## Suggested implementation order

1. immutable timeline history + proposal/apply/revert UI;
2. asset manifest + source-bound validation;
3. transcript/shot analysis and source candidate viewer;
4. evidence-bearing operation schema and preflight validator;
5. one excellent “tighten hook” planner with alternatives;
6. caption conformance and export;
7. render profile + automated QC;
8. OTIO export and provenance mapping.

## Sources

- [Adobe: Edit in Trim mode](https://helpx.adobe.com/premiere/desktop/edit-projects/trim-clips/edit-in-trim-mode.html)
- [Adobe: Perform J cuts and L cuts](https://helpx.adobe.com/premiere/desktop/edit-projects/trim-clips/perform-j-cuts-and-l-cuts.html)
- [C2PA specifications](https://spec.c2pa.org/specifications/)
- [OpenTimelineIO documentation](https://opentimelineio.readthedocs.io/en/latest/index.html)
- [OpenTimelineIO adapters](https://opentimelineio.readthedocs.io/en/latest/tutorials/adapters.html)
- [W3C: Captions for prerecorded media](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded)
- [W3C: Captions/subtitles](https://www.w3.org/WAI/media/av/captions/)
- [YouTube: Key moments for audience retention](https://support.google.com/youtube/answer/9314415?hl=en-GB)
- [YouTube: Content performance for recommendations](https://support.google.com/youtube/answer/16559650?hl=en)

All web sources accessed 2026-07-25.
