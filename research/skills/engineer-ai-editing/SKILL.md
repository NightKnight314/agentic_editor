---
name: engineer-ai-editing
description: Design, implement, or review reliable AI-assisted video-editing systems that analyze media, build time-aligned representations, plan edits, emit timeline operations, preserve provenance, involve humans, and evaluate results. Use for transcription, diarization, shot/scene detection, semantic search, highlight selection, active-speaker switching, beat sync, auto-reframing, timeline/EDL interchange, confidence handling, agent architecture, or automated edit QC.
---

# Engineer AI Editing

Separate perception, editorial judgment, execution, and verification. Store evidence behind every generated operation.

## Design the pipeline

1. **Ingest deterministically.** Hash assets; probe streams, duration, timebase, rotation, color, and audio layout; generate proxies without changing source identity.
2. **Analyze once.** Produce timestamped transcript tokens, speakers, shots, scenes, faces/subjects, motion, audio events, music beats, quality flags, and embeddings. Retain model/version and confidence.
3. **Build a media graph.** Link transcript spans, shots, speakers, semantic concepts, claims, and source ranges through stable IDs and rational time.
4. **Plan declaratively.** Convert the brief and style map into constraints, beats, ranked candidates, and a proposed edit decision list. Keep editorial reasons separate from detector scores.
5. **Compile operations.** Validate source bounds, track compatibility, collisions, handles, sync, and output duration before mutating the timeline.
6. **Preview and approve.** Present alternatives, confidence, provenance, and diffs at meaningful checkpoints.
7. **Render and verify.** Render deterministically, probe the output, run automated QC, and require human playback for final acceptance.

Read [references/ai-editing-systems.md](references/ai-editing-systems.md) for algorithms, schemas, confidence policy, evaluation, interoperability, provenance, failure modes, and primary sources.

## Use an evidence-bearing operation model

Represent each proposal with:

```json
{
  "operationId": "op-123",
  "type": "element.update",
  "targetId": "clip-7",
  "parameters": { "start": 12.4, "duration": 2.8 },
  "sourceEvidence": [{ "assetId": "a1", "range": [43.2, 46.0] }],
  "intent": "Remove repeated setup while preserving the complete claim",
  "confidence": 0.88,
  "constraintsChecked": ["source-bounds", "speech-boundary", "duration"],
  "status": "proposed"
}
```

Use rational/frame-aware time internally; do not depend on rounded display seconds as the source of truth. Make batches atomic or explicitly partial, idempotent where possible, ordered, schema-versioned, and undoable.

## Handle uncertainty

- Calibrate confidence per task; raw scores from different models are not comparable.
- Auto-apply only low-risk, reversible operations above task-specific thresholds.
- Offer alternatives for ambiguous creative choices.
- Escalate low-confidence words, speakers, shot boundaries, identity, sensitive claims, major deletions, and synthetic changes.
- Use `unknown` rather than forcing a label. Preserve the original signal and analysis version for reprocessing.

## Evaluate layers separately

- **Perception:** word timing/error, diarization error, boundary precision/recall, tracking stability, audio-event accuracy.
- **Planning:** constraint satisfaction, evidence coverage, redundancy, beat coverage, duration, source diversity, and human preference.
- **Execution:** deterministic replay, valid ranges, sync, no collisions/offlines, interchange round-trip fidelity.
- **Output:** technical QC, accessibility, provenance validity, and representative-device playback.
- **Product:** acceptance/undo rate, time to first usable cut, manual repair time, publish rate, and post-publish retention—segmented by format.

Do not collapse these into one opaque “quality” score; a good plan can fail in execution and a technically valid output can still be a bad edit.

## Preserve trust

- Keep an immutable action log with actor, model/tool version, inputs, parameters, timestamp, and approval.
- Distinguish analysis metadata from signed provenance. Use content credentials only when claims and bindings can be validated.
- Never generate or rearrange speech in a way that creates a false statement without explicit user intent and disclosure.
- Respect consent, likeness, licensed media, and platform disclosure requirements.
- Make the human the publishing authority.
