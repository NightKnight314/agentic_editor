# AI editing systems reference

Use this reference for architecture, subsystem methods, confidence, evaluation, and interoperability. The full research note is at `../../../notes/ai-assisted-editing-methodologies.md`.

## Canonical architecture

```text
immutable assets + rational clocks
  -> versioned parallel analyzers
  -> time-ranged evidence store
  -> semantic/shot/phrase candidates
  -> explicit brief + constraint ledger
  -> planner/ranker/optimizer
  -> typed patch against a base revision
  -> deterministic verification
  -> preview + alternatives + uncertainty
  -> human approval
  -> immutable revision + render QC + provenance
```

Use half-open ranges `[start,end)`. Quantize picture edits to frames and audio to samples. Distinguish trim, move, slip, slide, roll, ripple, replace, transition, transform, and gain operations. Verify transition handles and linked A/V sync. Keep inverse patches.

## Evidence record

Every analyzer output should contain asset ID, exact source range, label/value, confidence and boundary uncertainty, producer/version/parameter hash, parent evidence, and state (`machine`, `human_confirmed`, `human_rejected`, `superseded`). Store unknowns and alternate hypotheses rather than forcing labels.

## Subsystem methods

### Speech and transcript editing

Use VAD, contextual ASR, forced alignment, punctuation/phrase grouping, and overlap-aware speaker attribution. Keep separate recognition, language, alignment, and timing confidence. Text deletion selects stable word IDs, expands to acoustic boundaries with handles, and previews. Block frame-accurate deletion when alignment is weak; fall back to a phrase.

Evaluate WER, entity/name error, boundary MAE/P90, within-tolerance rate, audible-splice defects, timing corrections, and acceptance.

### Diarization

Model a region as a set of active speaker hypotheses. Separate anonymous acoustic clusters from confirmed person identity. Preserve overlap, laughter, backchannels, and unknown speaker. Evaluate DER only with declared collar and overlap policy; add JER, word diarization error, speaker-count error, and per-speaker results.

### Shot and scene boundaries

Distinguish hard cuts from gradual-transition intervals. Retain a posterior curve and use temporal context, hysteresis/NMS, flash handling, and configurable minimum lengths. For scenes, cluster a temporally adjacent shot graph using visual, people/location, transcript/topic, ambience/music, and gaps. Keep hierarchical `shot → beat/topic → scene/chapter` levels.

### Query-conditioned highlights

Define highlight relative to query, audience, duration, and style. Score phrase/shot candidates for relevance, salience, evidence, novelty, diversity, and narrative order under duration and continuity constraints. Provide “relevant,” “energetic,” and “balanced story” alternatives when useful. Preserve lead-in/out and complete speech.

### Music rhythm

Detect sections, downbeats, beats, tempo/meter, energy, and confidence. Generate semantic cut windows first, then globally match them to rhythmic targets within bounded displacement. Store `snapDelta`. Disable or weaken snapping for speech-led, rubato, or low-confidence music.

### Active speaker and multicamera

Combine audio-visual active-speaker evidence with diarization, face tracks, framing/quality, and sequence transition costs. Optimize a sequence rather than switching greedily at each turn. Prefer confident visible speaker, user-pinned angle, wide/two-shot, previous safe angle, then hold. Never chatter through ambiguity.

### Reframing

Detect and track required/preferred/avoid regions, split at shot boundaries, choose stationary/pan/track modes, and optimize center/scale for coverage plus low velocity/acceleration/jerk. If required regions cannot fit, widen, pad/letterbox, or ask—never silently crop required faces, text, logos, products, or disclosures.

## Confidence and fallback

- Calibrate per model/domain; report reliability, not just ranking metrics.
- Auto-suggest only high-confidence reversible work that passes hard checks.
- Present alternatives for medium confidence or model disagreement.
- Block dependent operations when low confidence affects timing, identity, required content, or meaning.
- Degrade by capability when a model is absent; use deterministic baselines rather than invented data.
- On infeasible constraints, return the minimal conflict set and repair options.
- On stale base revision, rebase safely or reject; never apply blindly.

Human-confirmed evidence outranks inference. Use hysteresis so minor score movement does not churn the timeline.

## Verification

Check:

- assets/streams/ranges exist; timing is finite, positive, quantized, and in bounds;
- overlaps/gaps are intentional; transitions have handles; sync and speed ramps are valid;
- output/delivery constraints match;
- must-use, prohibited, pinned, and required words/entities/disclosures;
- complete phrases, source repetition, shot duration, active-speaker/crop requirements;
- rights, consent, synthetic labels, lineage, and input provenance state.

After render, decode the complete file, probe streams/timestamps/counts, detect likely black/freeze/flash/silence/clipping/drift, recheck crop coverage and captions on pixels, compare render fingerprints to the plan, and validate provenance.

## Evaluation

Evaluate perception, planning, execution, rendered output, and product outcomes separately. Maintain rights-cleared golden reels across interviews, multicam, tutorials, montage, action, vertical reframe, multilingual/noisy/overlap, variable-frame-rate phones, and gradual transitions.

Track runtime, real-time factor, memory/VRAM, cache rate, and cost per source minute alongside quality. Use blind A/B preference and measure correction distance, time to usable/final cut, acceptance, undo, controllability, and trust.

## Interchange and provenance

OpenTimelineIO models rational time, ranges, stacks/tracks, clips, transitions, markers, metadata, and external media references. Keep richer analysis/revision data internally. Treat EDL and other adapters as potentially lossy and emit capability reports.

C2PA can bind signed provenance assertions and ingredients to output. A valid signature supports lineage/integrity claims under a trust model; it does not prove depicted facts are true. Keep internal logs richer than public manifests.

## Primary sources

- [OpenTimelineIO](https://opentimelineio.readthedocs.io/en/latest/index.html)
- [WhisperX](https://arxiv.org/abs/2303.00747)
- [pyannote.audio](https://arxiv.org/abs/1911.01255)
- [TransNet V2](https://arxiv.org/abs/2008.04838)
- [QVHighlights](https://arxiv.org/abs/2107.09609)
- [AVA ActiveSpeaker](https://arxiv.org/abs/1901.01342)
- [Computational Video Editing for Dialogue-Driven Scenes](https://graphics.stanford.edu/papers/roughcut/)
- [Google AutoFlip](https://research.google/blog/autoflip-an-open-source-framework-for-intelligent-video-reframing/)
- [LAVE](https://arxiv.org/abs/2402.10294)
- [VideoDiff](https://arxiv.org/abs/2502.10190)
- [C2PA specification](https://spec.c2pa.org/specifications/specifications/2.2/specs/C2PA_Specification)

Sources accessed 2026-07-25.
