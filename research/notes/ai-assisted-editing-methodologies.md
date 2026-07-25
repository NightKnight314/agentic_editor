# AI-assisted and computational video editing methodologies

Accessed/researched: 2026-07-25

## Executive recommendation

Build the product as a **non-destructive evidence → plan → verify → preview → approve** system. Computer-vision, audio, and language models should emit time-ranged evidence with confidence and provenance; they should not mutate the timeline directly. A planner turns user intent plus that evidence into typed timeline patches. A deterministic verifier rejects impossible or policy-violating patches. The editor sees a preview, alternatives, and reasons, and can accept, revise, or undo.

This separation is the most important architectural choice. It allows models and thresholds to change without corrupting projects, makes uncertain results inspectable, and keeps final timing frame/sample accurate even when model outputs are approximate.

## End-to-end architecture

```text
source assets
  ↓ ingest, hash, probe, clock normalization, proxy generation
canonical media graph (immutable asset IDs + rational source time)
  ↓ parallel analyzers
speech ─ faces ─ shots ─ scenes ─ objects/text ─ music/rhythm ─ quality
  ↓
evidence store (time spans, labels, scores, embeddings, model/version, lineage)
  ↓
candidate generator (phrases, shots, reactions, highlights, crop paths)
  ↓
intent + style profile + explicit constraint ledger
  ↓
planner/ranker/optimizer → typed patch against a timeline revision
  ↓
deterministic verifier (time, media, continuity, policy, delivery)
  ↓
low-resolution preview + rationale + alternatives + uncertainty flags
  ↓ human accept/edit/reject
committed timeline revision → OTIO/adapter/export/render → QC → C2PA manifest
```

### Stage 1: ingest and canonical time

1. Compute a stable asset ID from content hash; retain the original URI separately.
2. Probe streams, duration, average and nominal frame rate, time base, start time, sample rate, channel layout, rotation, color metadata, and variable-frame-rate status.
3. Keep source time in each stream's native rational units. Never use a binary floating-point second as the authoritative edit coordinate. Convert only at API/UI boundaries.
4. Create low-resolution proxies, waveform/envelope pyramids, sparse frame thumbnails, and analysis audio while preserving a mapping back to source time.
5. For multicamera material, estimate clock transforms from production timecode when present, otherwise waveform correlation; retain offset, drift/scale, uncertainty, and sync anchors. Do not destructively rewrite source timestamps.

### Stage 2: analyzers produce evidence

Analyzers run independently and can be recomputed. Every result records its asset, source range, confidence, model/algorithm version, parameters, parent evidence IDs, and status (`machine`, `human_confirmed`, `human_rejected`, `superseded`). Store raw posteriors or compact score curves where practical; a single label discards information needed for later threshold changes.

### Stage 3: planner and verifier

The planner should operate on semantic units—utterances, shots, scenes, beats, and face tracks—but emit only typed operations such as `insert_clip`, `trim`, `split`, `move`, `replace_source`, `set_transform`, `add_transition`, and `set_gain`. Each patch declares its base revision and preconditions. The verifier applies it to a copy, then checks hard constraints before the user sees a preview. RefineCut independently frames executable video-editing planning around typed timeline patches and a deterministic verifier operating against an explicit constraint ledger [S23].

Keep three kinds of rules distinct:

- **Hard constraints:** source range exists, no negative duration, output duration bounds, required speaker/brand/legal content present, no unapproved synthetic media, crop covers required regions, track/channel rules, and delivery limits.
- **Soft objectives:** relevance, visual diversity, rhythm, preferred shot scale, camera continuity, transcript coherence, salience, and minimal deviation from the current cut.
- **Warnings:** low-confidence evidence, abrupt loudness change, possible jump cut, subtitle collision, uncertain face-speaker association, and provenance gaps.

## Machine-actionable data model

The internal model can serialize to OTIO, but it should also retain analysis evidence and revision history that ordinary interchange formats do not express.

```ts
type RationalTime = { value: bigint | number; rate: number };
type TimeRange = { start: RationalTime; duration: RationalTime };

type AssetRef = {
  assetId: string;              // content-addressed identity
  uri: string;                  // relocatable/media-linker concern
  streamId: string;
  availableRange: TimeRange;
  contentHash: string;
  c2paValidation?: "valid" | "invalid" | "absent" | "unknown";
};

type Evidence<T> = {
  id: string;
  assetId: string;
  range: TimeRange;             // source coordinates
  kind: string;
  value: T;
  confidence: number;           // calibrated probability if available
  uncertainty?: { startStdMs?: number; endStdMs?: number };
  producer: { name: string; version: string; paramsHash: string };
  parents: string[];
  state: "machine" | "human_confirmed" | "human_rejected" | "superseded";
};

type TimelineClip = {
  id: string;
  asset: AssetRef;
  sourceRange: TimeRange;
  timelineRange: TimeRange;     // derived or cached placement
  transform?: { scale: number; x: number; y: number; rotation: number };
  gainDb?: number;
  linkedGroupId?: string;       // linked A/V and multicam groups
  evidenceIds: string[];
};

type TimelinePatch = {
  patchId: string;
  baseRevision: string;
  author: { kind: "human" | "agent"; id: string };
  intent: string;
  operations: TimelineOperation[];
  preconditions: Predicate[];
  evidenceIds: string[];
  alternatives?: TimelinePatch[];
};

type Constraint = {
  id: string;
  severity: "hard" | "soft" | "warning";
  predicate: Predicate;
  weight?: number;
  scope?: TimeRange | string[];
  source: "user" | "template" | "delivery" | "inferred";
};
```

### Timeline invariants

- Use half-open ranges `[start, end)` everywhere. Adjacent ranges then share no sample/frame.
- Quantize video edits to the chosen sequence frame grid and audio edits to sample boundaries. Preserve the pre-quantized model estimate for diagnostics.
- A trim changes `sourceRange`; a move changes timeline placement; a slip changes the source mapping without changing timeline placement. Do not conflate them.
- Transitions consume handles. The verifier must prove both clips have enough source media before adding a transition.
- Ripple operations declare affected tracks; linked A/V remains synchronized unless the user explicitly requests an L/J cut or unlink.
- Store immutable revisions and inverse patches. Agent suggestions should never overwrite the accepted cut.

OpenTimelineIO (OTIO) is a suitable interchange layer: it models timelines, stacks/tracks, clips, transitions, markers, metadata, external media references, `RationalTime`, and `TimeRange`, and supplies adapters for other editorial formats [S1]. It does not embed media. Treat legacy EDL export as a deliberately lossy delivery adapter and emit a compatibility report for unsupported effects, transforms, nested structures, speed changes, metadata, or track complexity.

## Methodologies by subsystem

### 1. Transcription and forced alignment

**Pipeline**

1. Preserve the original mix, but create analysis audio with known sample rate/channel mapping.
2. Run voice activity detection (VAD) and retain speech probability, not just regions.
3. Transcribe sufficiently long contextual windows; keep tokens, language probabilities, segment log-probability, no-speech probability, and decoding diagnostics.
4. Force-align the known transcript to audio with a language-compatible acoustic/phoneme model to obtain word or phoneme boundaries. WhisperX combines VAD, batched transcription, and forced phoneme alignment specifically to improve long-form word timing [S2].
5. Punctuate and form edit-safe phrases from pauses, syntax, speaker turns, and maximum reading duration. Preserve word IDs so text edits map to media ranges.
6. Join transcript words to diarization intervals by overlap, but represent ambiguous/overlapping attribution rather than forcing one speaker.

**Editing use**

- Text-based deletion maps selected word IDs to a source interval, expands to an acoustic boundary, adds small configurable handles, and previews the splice.
- Filler-word removal is a candidate operation, not an automatic deletion. Reject candidates where the word is semantically necessary, overlaps another speaker, alignment is weak, or the remaining audio creates an implausibly short gap.
- Use phrase or breath boundaries for primary edits. Word boundaries are useful indexes, but are often poor audible cut points.

**Confidence and fallback**

- Maintain separate confidences for recognition, alignment, language, and timing; do not multiply them into an opaque score.
- If a word cannot be aligned, interpolate only for display. Block frame-accurate word deletion and fall back to the containing utterance/phrase.
- When ASR conflicts with a user-corrected transcript, preserve the user text and rerun forced alignment; never silently replace confirmed text.
- For music, cross-talk, accents, code-switching, and names, flag low-confidence spans and show waveform/video handles.
- Before committing a speech cut, search a small neighborhood for low energy/zero crossing and avoid cutting phonemes; keep the edit's semantic anchor separately from its final acoustic cut time.

**Evaluation**

- Text: word error rate (WER), plus entity/name error rate for editorial search.
- Timing: mean/median and P90 absolute start/end error; percentage of word boundaries within 20/50/100/200 ms; phrase-boundary error.
- Product: accepted text-edit rate, manual timing correction in frames, audible-splice defect rate, and time saved.

### 2. Speaker diarization and identity

Diarization answers “who spoke when”; it does not necessarily identify a real person. A practical pipeline combines speech activity, speaker-change detection, embeddings, clustering, overlap detection, and optional enrollment for known identities. `pyannote.audio` exposes modular neural building blocks for speech activity, change, overlap, embeddings, and diarization [S3].

Represent a diarization region as a set of active speaker hypotheses. This matters because overlap is real and a single `speakerId` field destroys it. Keep anonymous cluster identity (`spk_03`) separate from a user-confirmed person identity (`person_alex`).

**Confidence and fallback**

- Treat short turns near a change point, laughter, backchannels, and overlapped speech as ambiguous.
- Do not merge speaker clusters solely because their names were guessed to match. Name assignment and acoustic clustering are separate evidence.
- If the number of speakers is unstable, expose alternatives and allow pin/merge/split corrections. Persist corrections as constraints for reruns.
- A low-confidence diarization span may still be valid speech; use “unknown speaker,” never “no speech.”

**Evaluation**

- Diarization Error Rate (DER) comprises missed speech, false-alarm speech, and speaker assignment error after optimal reference/hypothesis mapping. Report collar and overlap policy explicitly; otherwise DER values are not comparable [S4].
- Also report Jaccard Error Rate, speaker-count error, word diarization error, and per-speaker results; DER can hide poor treatment of short speakers.

### 3. Shot-boundary detection

Separate **hard cuts** from **gradual transitions** (dissolve, fade, wipe). Classical histogram/content thresholds are a fast CPU baseline; learned temporal models such as TransNet/TransNetV2 use windows of resized frames and are more robust to common transitions [S5]. PySceneDetect is a practical implementation that returns start/end timecode pairs and supports content-based detectors and tunable thresholds [S6].

**Post-processing**

- Store a boundary posterior curve and transition interval, not only a frame number.
- Apply hysteresis/non-maximum suppression, a configurable minimum shot length, and special handling for flash frames.
- Snap a hard cut to the most likely frame. Represent a gradual transition as an interval; downstream scene grouping should not treat every high-scoring frame as a boundary.
- Preserve detected boundaries as markers even if the user later joins shots.

**Fallbacks**

- If confidence is low, generate two candidate segmentations (“sensitive” and “conservative”).
- Very short alternating shots may be intentional; minimum-length rules should warn, not blindly merge.
- Still-image motion, strobes, rapid camera motion, compression errors, and graphic overlays are common false positives. Confirm boundaries using temporal context and audio/transcript continuity.

**Evaluation**

Report precision, recall, and F1 separately for hard and gradual transitions, plus boundary timing tolerance and transition-interval overlap. NIST TRECVID evaluated all-transition precision/recall and frame precision/recall for gradual transitions [S7]. Product metrics should also measure downstream segmentation corrections per minute.

### 4. Scene and semantic segmentation

A shot is a continuous camera take; a semantic scene is a higher-level unit that may contain many shots. Build scenes over the shot graph rather than raw frames:

1. Compute shot-level visual embeddings, people/face identity sets, location/object/text features, transcript/topic embeddings, audio ambience/music, and time gaps.
2. Score boundaries between adjacent shots using changes in these signals and longer-range neighborhood context.
3. Partition with change-point detection, dynamic programming, graph clustering constrained to temporal adjacency, or a learned scene-boundary model.
4. Label the resulting segment with entities, topics, location, dominant speakers, representative keyframes, and confidence.

MovieNet provides movie-scale annotations including tens of thousands of scene boundaries, while recent scene-boundary methods explicitly operate over shot feature sequences and neighboring relations [S8, S9].

**Rules and fallbacks**

- A hard shot cut is evidence, not proof, of a scene change.
- Prefer under-segmentation when confidence is low; users can split a broad chapter more easily than repair many incoherent fragments.
- Keep several hierarchy levels (`shot → beat/topic segment → scene/chapter`) rather than forcing one segmentation to serve search, summarization, and editing.
- Let user merges/splits pin boundaries, then recompute only unpinned neighborhoods.

**Evaluation:** boundary F1 with a tolerance window, mean Intersection-over-Union of segments, over/under-segmentation rates, and human judgments of coherence. Evaluate hierarchy levels separately.

### 5. Highlight detection and summarization

“Highlight” is conditional on a **query, audience, duration, and style**. Avoid a universal-interest score. QVHighlights formalizes query-conditioned moment retrieval and supplies graded saliency labels [S10].

**Candidate scoring**

- Candidate units: sentences/utterances, shots, or merged shot groups—not arbitrary isolated frames.
- Signals: query/text similarity, visual-semantic similarity, named entities, novelty, face/pose/emotion/activity, audio energy/crowd reaction, speech prosody, user-selected exemplars, and existing edit patterns.
- Normalize scores per source/domain. Raw excitement in a sports clip is not comparable to a quiet interview.
- Select a subset under duration and continuity constraints, rewarding relevance, coverage/representativeness, diversity, and narrative order while penalizing repetition and contextless fragments.

Multimodal methods have used faces, gaze, voices, pose, and gestures for human-centric highlight scoring [S11]. CLIP-style query/video representations and saliency pooling are a strong baseline for open-domain query-conditioned highlights [S12].

**Fallbacks and UI**

- Generate 2–3 alternatives such as “most relevant,” “most energetic,” and “balanced story.”
- Show why each segment was chosen and what was omitted due to the duration budget.
- If scores are flat or disagree across modalities, ask for an exemplar/query refinement; do not fabricate a precise ranking.
- Preserve lead-in/lead-out context and complete speech phrases. Never cut solely at the saliency peak.

**Evaluation:** mAP/nDCG for graded highlight ranking, Recall@K or Hit@1, temporal IoU for retrieved moments, duration-budget adherence, diversity/coverage, pairwise human preference, and downstream acceptance/edit distance.

### 6. Music analysis and beat-synchronized editing

Detect onset strength, beats, downbeats, tempo, meter, bars, musical sections, energy, and confidence. BeatNet demonstrates joint beat/downbeat/tempo/meter tracking with causal and offline modes [S13].

**Method**

1. Create candidate semantic cut windows first (shot boundary, phrase gap, action completion).
2. Create rhythmic targets at multiple strengths: section boundary > downbeat > strong beat > subdivision.
3. Match candidates to rhythmic targets within a maximum displacement window. Optimize globally rather than greedily snapping every cut.
4. Use elastic rhythm: faster shot cadence in high-energy sections and longer shots in quiet passages. Not every beat needs a cut.
5. Penalize semantic truncation, too-short shots, repeated shot scale, and large displacement from the natural visual/audio boundary.

Music-driven montage research frames the problem as joint selection and synchronization rather than a final snapping pass [S14].

**Fallbacks**

- Low beat confidence, rubato, speech-led audio, or changing meter: align to reliable downbeats/sections only, or disable snapping.
- Never move dialogue edits merely to hit a beat unless the user prioritizes rhythm over speech integrity.
- Preserve the unsnapped candidate and record `snapDelta`; let users adjust snap strength.

**Evaluation:** beat/downbeat F-measure with tolerance, median cut-to-nearest-target distance, percentage within tolerance, semantic-boundary displacement, shot-duration distribution by music energy, and human preference.

### 7. Active-speaker detection and multicamera selection

Active-speaker detection (ASD) associates audible speech with a visible face track using synchronized audio and mouth/face dynamics. AVA-ActiveSpeaker labels face tracks as speaking/not speaking and audible/not audible [S15]; TalkNet uses both short- and long-term audio-visual context [S16].

For multicamera editing, make ASD one feature in a sequence optimization:

- Candidate state at time `t`: available angle/clip, visible people, speaker visibility, face size, framing, focus/quality, occlusion, continuity, and sync confidence.
- Unary score: active speaker visibility, requested subject, composition, technical quality.
- Transition cost: excessive cut frequency, same-scale jump cut, large axis/eyeline change, switching during a word, flash frames, and crossing an uncertain sync region.
- Style constraints: establish wide, speaker visible, reaction cutaways, reserve close-ups for emphasis, minimum/maximum shot length, and do-not-use angles.
- Solve with dynamic programming/Viterbi or shortest path; retain top-K diverse cuts.

Computational editing of dialogue-driven scenes has demonstrated script/line alignment, structural labels, user-composable editing idioms, and optimization over multiple takes [S17]. This is a strong model for a controllable multicam feature.

**Fallback hierarchy**

1. Confident visible active speaker on a technically valid angle.
2. User-pinned preferred angle.
3. Wide/two-shot covering the conversation.
4. Previously safe angle or reaction shot, subject to duration rules.
5. Hold current camera; never rapid-switch on ambiguous ASD.

Resolve conflicts between audio diarization and visual ASD explicitly. A voice may be off-screen, dubbed, from a monitor, or overlapped. Report ASD mAP/AUC, face-track coverage, speaker-visible recall, false switch rate, cuts/minute, continuity violations, and human adjustment count.

### 8. Intelligent reframing and crop-path planning

Reframing is constrained camera-path optimization, not per-frame center cropping.

1. Detect and track faces/people/objects, active speaker, text, logos, and user-pinned regions.
2. Divide processing at shot boundaries; never smooth a crop path across a real cut.
3. Assign regions `required`, `preferred`, or `avoid`, with weights and safe margins.
4. Choose a stationary, panning, or tracking mode per shot.
5. Optimize crop center/scale over time for weighted coverage, composition, limited velocity/acceleration/jerk, and minimal mode changes.
6. Render preview overlays showing required regions and the crop path.

Google's AutoFlip describes this sequence—shot detection, salient-region analysis, selection among stationary/panning/tracking strategies, smooth path optimization, and letterbox fallback when required content cannot fit [S18].

**Hard fallback rule:** if all required regions cannot fit at the target aspect ratio, pad/letterbox or ask the editor; never silently crop a required face, caption, logo, or disclosure. Other fallbacks include widening the crop, holding the last stable path through short detector loss, and reverting to source framing on low-confidence tracks.

**Evaluation:** required-region coverage, subject-center/composition error, crop-path velocity/acceleration/jerk, detector-loss recovery, number of direction reversals, padding fraction, face/text truncation rate, and human keyframe corrections.

### 9. Human-in-the-loop planning

The agent should behave like an editorial collaborator, not a command generator:

- Parse the request into an explicit brief: audience, target length/aspect, must-use/must-not-use, tone, ordering, speaker and brand rules, music policy, caption policy, and delivery profile.
- State inferred constraints separately and let the user promote, change, or remove them.
- Produce a patch and 1–2 meaningfully different alternatives when the objective is subjective.
- Explain selections using evidence (“query match,” “speaker visible,” “downbeat within 2 frames”), not unverifiable aesthetic claims.
- Preview only affected ranges and surface uncertainty hotspots first.
- Learn local preferences from accepted/rejected suggestions without silently changing global defaults.
- Support pinning: clip, range, order, camera, crop, transcript text, beat, and do-not-touch region.

LAVE explores language-assisted video editing and reports a user study across experience levels [S19]. VideoDiff specifically exposes alternatives for rough cuts, B-roll, and text effects so creators can compare and customize recommendations [S20]. These support an interaction design centered on alternatives and revision rather than one-shot generation.

## Confidence policy

Confidence must be calibrated per model/domain when possible. Thresholds below are product-policy examples, not universal model cutoffs.

| Condition | Automatic behavior | User-visible fallback |
|---|---|---|
| High confidence; reversible; all hard checks pass | May create a suggestion patch and preview | One-click accept/undo; show evidence |
| Medium confidence or cross-model disagreement | Do not commit; rank alternatives | Highlight affected ranges and ask for choice in context |
| Low confidence affecting timing/identity/required content | Block the dependent operation | Coarser phrase/shot, wide angle, source framing, or manual marker |
| Missing analyzer/model | Degrade by capability, not by inventing data | Explain unavailable signal; use deterministic baseline |
| Hard constraint infeasible | No patch | Minimal conflict set plus repair options |
| Verification/runtime failure | Roll back preview transaction | Preserve original revision and diagnostic bundle |

Additional rules:

- Confidence is not correctness. Measure reliability diagrams/Brier score or expected calibration error on representative data.
- User-confirmed evidence outranks machine inference until explicitly invalidated.
- Combine independent signals with a documented fusion model; do not average unrelated scores ad hoc.
- Use hysteresis around thresholds so small posterior changes do not cause timeline churn.
- Cache analyzer versions and inputs. A changed model must create new evidence, not mutate old results.

## Deterministic constraint checking

Run checks after every proposed patch and again after render.

### Structural/time checks

- All referenced assets/streams exist and cover requested source ranges.
- No negative/NaN duration; all ranges are quantized and within media availability.
- No unintended same-track overlaps or gaps; transitions have sufficient handles.
- Linked sync offset remains within tolerance; speed ramps are continuous and supported.
- Output duration, aspect, frame rate, resolution, audio layout, and caption format match the brief.

### Editorial/semantic checks

- Must-use and prohibited assets/ranges; required lines/entities/disclosures.
- Complete phrases and configurable speech handles.
- Min/max shot length and cuts/minute; duplicate/repeated-source limits.
- Active speaker visibility requirements, reaction-shot allowance, and pinned angles.
- Narrative order/dependencies and spoiler/sensitivity rules.
- Required crop regions and safe-area/text-overlay collisions.

### Rights, safety, and provenance checks

- Rights/license field present for every used asset; territory/expiry constraints if supplied.
- Consent/restriction flags for people and sensitive material.
- Synthetic/generative operations labeled; model/tool/input lineage retained.
- C2PA input validation status preserved, including `absent` versus `invalid`.
- Export manifest reflects ingredients and edits; a valid signature proves manifest integrity and signer association under a trust model, not that depicted content is factually true.

C2PA Content Credentials are signed manifests containing assertions, claims, ingredients, and provenance data bound to an asset; validators assess signatures, credentials, and assertions [S21]. Keep the internal operation log richer than the public manifest, since privacy and disclosure policy may limit what is exported.

## Evaluation and quality control

### Offline benchmark suite

Create a small, rights-cleared “golden reels” corpus that reflects the product: interview/podcast, multicam dialogue, tutorial/screen recording, music montage, sports/action, vertical reframe, multilingual speech, noisy audio, overlapping speakers, variable-frame-rate phone footage, and edited material with dissolves/graphics.

Pin ground truth and evaluate every analyzer version. Report results by domain and difficulty, not only a global average.

| Subsystem | Core technical metrics | Product/editorial metrics |
|---|---|---|
| ASR/alignment | WER, entity error, boundary MAE/P90, within-tolerance rate | corrected words/minute, timing nudges, audible splice defects |
| Diarization | DER/JER with collar+overlap policy, speaker count | speaker relabel/merge/split actions |
| Shot/scene | precision/recall/F1, gradual-transition IoU, boundary F1 | boundaries corrected/minute, coherent segment rating |
| Highlights | mAP/nDCG, Recall@K, temporal IoU, diversity/coverage | acceptance, pairwise preference, edit distance to final |
| Beats | beat/downbeat F1, cut-target offset | snap overrides, rhythm preference |
| ASD/multicam | mAP/AUC, face-track coverage | false switches, speaker-visible recall, cuts adjusted |
| Reframing | required-region coverage, path motion, truncation | crop keyframes corrected, padding acceptance |
| Planner | executable-patch rate, hard-constraint pass, duration error | acceptance, undo rate, time-to-final, user trust |

Always measure runtime, real-time factor, peak memory/VRAM, cache hit rate, and cost per source minute. A slightly less accurate analyzer that returns an editable proxy quickly may be the better interactive tier; a slower pass can refine before export.

### Render and delivery QC

- Decode the complete render; verify duration, stream count, timestamps, frame/sample counts, and absence of decode errors.
- Detect black/frozen/single-frame flashes, unintended silence, clipping/true peak, A/V drift, dropped/duplicated frames, and transition discontinuities.
- Re-run face/text required-region coverage on the rendered pixels, not just transform parameters.
- Validate captions for timing order, reading duration/speed, line length, safe area, and overlap with burned-in graphics.
- Compare the rendered timeline against the verified plan: asset/range fingerprints, expected cuts, and audio mapping.
- Validate the output C2PA manifest and ingredient chain.

Delivery loudness targets are profile-specific. For a broadcast profile, EBU R128 defines programme-loudness and true-peak practices; do not hard-code those values as a universal web target [S22].

### Human evaluation

Use blind A/B preference against a deterministic baseline and, where feasible, an experienced-editor cut. Measure task completion time and the patch distance from suggestion to accepted/final timeline. Ask separate questions for relevance, coherence, pacing, continuity, audio quality, framing, controllability, and trust; a single “quality” score is difficult to diagnose.

## Failure modes and mitigations

| Failure | Why it happens | Mitigation |
|---|---|---|
| Text cut clips consonant/breath | ASR timestamp is not an acoustic edit point | Forced alignment, energy/zero-crossing search, handles, preview |
| Transcript drifts or hallucinates | Long-form windows, silence/music, weak language support | VAD segmentation, alignment diagnostics, phrase fallback, manual correction |
| Speaker names swap | Cluster IDs are session-local; overlap/short turns | Separate cluster/person identity, enrollment evidence, user pinning |
| Cut detector fires on flash/motion | Large frame difference mimics edit | Temporal model/context, flash rule, posterior+NMS, conservative alternative |
| Scene segmentation fragments montage | Adjacent shots are visually different by design | Fuse audio/topic/identity and long context; hierarchical scenes |
| Highlights are exciting but irrelevant | Generic salience dominates intent | Require query/audience/duration; relevance constraint; alternatives |
| Beat snapping harms meaning | Greedy nearest-beat movement | Candidate windows first, bounded global matching, store snap delta |
| Multicam chatters | ASD uncertainty near turns/backchannels | Hysteresis, min hold, transition cost, wide-angle fallback |
| Wrong face chosen | Off-screen/dubbed/overlap or A/V desync | Cross-check diarization, sync uncertainty, “unknown/off-screen” state |
| Reframe jitters | Noisy detections become crop centers | Track smoothing and shot-level path optimization |
| Required content cropped | Target aspect cannot contain all regions | Hard coverage constraint; widen/pad/letterbox; ask user |
| Planner creates valid but bad cut | Constraints omit taste/context | Preview, top-K alternatives, editable rationale, local preference learning |
| Old suggestion applies to new timeline | Concurrent revision changed ranges | Base revision + preconditions; rebase or reject, never blind apply |
| EDL round-trip loses structure | Legacy format cannot encode rich timeline | OTIO master, adapter capability report, flatten/render where approved |
| Provenance shown as “truth” | Signature validates lineage, not reality | Precise UI language; show validation, signer, assertions, and gaps separately |
| Analyzer update changes old project | Mutable derived data/thresholds | Versioned immutable evidence and reproducible parameter hashes |

## Hackathon implementation order

1. **Foundation:** canonical rational time, asset hashes, immutable timeline revisions, typed patches, undo, and verifier.
2. **Fast useful loop:** proxy generation; VAD + transcript + forced alignment; shot boundaries; transcript/shot search; suggestion-only text cuts.
3. **Rough-cut planner:** explicit brief and constraint ledger; phrase/shot candidates; relevance ranking; duration optimization; preview and alternatives.
4. **Multicam:** sync map, diarization, face tracks/ASD, conservative speaker-visible selection with wide-angle fallback.
5. **Reframing and rhythm:** required-region crop paths and bounded beat snapping.
6. **Interchange/QC:** OTIO export/import, adapter capability report, full-render checks, provenance validation/export.

For the hackathon, prefer transparent baselines with good fallbacks over an opaque end-to-end model. The differentiator is an editor that can safely execute, explain, and revise machine suggestions.

## Sources

All sources below were accessed 2026-07-25. Technical sources are original papers, official project documentation, or primary specifications.

- **[S1]** Academy Software Foundation, [OpenTimelineIO documentation](https://opentimelineio.readthedocs.io/en/latest/index.html) and [serialized schema](https://opentimelineio.readthedocs.io/en/v0.15/tutorials/otio-serialized-schema.html).
- **[S2]** Bain et al., [“WhisperX: Time-Accurate Speech Transcription of Long-Form Audio”](https://arxiv.org/abs/2303.00747), INTERSPEECH 2023.
- **[S3]** Bredin et al., [“pyannote.audio: Neural Building Blocks for Speaker Diarization”](https://arxiv.org/abs/1911.01255), ICASSP 2020.
- **[S4]** DIHARD, [Challenge overview and diarization error-rate definition](https://dihardchallenge.github.io/dihard1/overview.html).
- **[S5]** Souček, Lokoč, and Moravec, [“TransNet V2: An Effective Deep Network Architecture for Fast Shot Transition Detection”](https://arxiv.org/abs/2008.04838).
- **[S6]** Breakthrough, [PySceneDetect official documentation](https://www.scenedetect.com/docs/latest/api/scene_manager.html).
- **[S7]** NIST, [TRECVID 2003 shot-boundary evaluation guidelines](https://www-nlpir.nist.gov/projects/tv2003/index.html).
- **[S8]** Huang et al., [MovieNet dataset and tools](https://movienet.github.io/index.html), ECCV 2020.
- **[S9]** Tan et al., [“Neighbor Relations Matter in Video Scene Detection”](https://openaccess.thecvf.com/content/CVPR2024/papers/Tan_Neighbor_Relations_Matter_in_Video_Scene_Detection_CVPR_2024_paper.pdf), CVPR 2024.
- **[S10]** Lei et al., [“QVHighlights: Detecting Moments and Highlights in Videos via Natural Language Queries”](https://arxiv.org/abs/2107.09609), NeurIPS 2021.
- **[S11]** Bhattacharya et al., [“HighlightMe: Detecting Highlights from Human-Centric Videos”](https://openaccess.thecvf.com/content/ICCV2021/papers/Bhattacharya_HighlightMe_Detecting_Highlights_From_Human-Centric_Videos_ICCV_2021_paper.pdf), ICCV 2021.
- **[S12]** Han et al., [“Unleash the Potential of CLIP for Video Highlight Detection”](https://openaccess.thecvf.com/content/CVPR2024W/ELVM/html/Han_Unleash_the_Potential_of_CLIP_for_Video_Highlight_Detection_CVPRW_2024_paper.html), CVPR Workshops 2024.
- **[S13]** Heydari, McCallum, and Ehmann, [BeatNet official implementation and paper links](https://github.com/mjhydri/BeatNet), ISMIR 2021.
- **[S14]** Yu et al., [“Audeosynth: Music-Driven Video Montage”](https://i.cs.hku.hk/~yzyu/publication/audeosynth-sig2015.pdf), ACM Transactions on Graphics/SIGGRAPH 2015.
- **[S15]** Roth et al., [“AVA-ActiveSpeaker: An Audio-Visual Dataset for Active Speaker Detection”](https://arxiv.org/abs/1901.01342), ICASSP 2020.
- **[S16]** Tao et al., [“Is Someone Speaking? Exploring Long-Term Temporal Features for Audio-Visual Active Speaker Detection”](https://arxiv.org/abs/2107.06592), ACM Multimedia 2021.
- **[S17]** Leake et al., [“Computational Video Editing for Dialogue-Driven Scenes”](https://graphics.stanford.edu/papers/roughcut/), ACM Transactions on Graphics/SIGGRAPH 2017.
- **[S18]** Google Research, [“AutoFlip: An Open Source Framework for Intelligent Video Reframing”](https://research.google/blog/autoflip-an-open-source-framework-for-intelligent-video-reframing/), 2020.
- **[S19]** Wang et al., [“LAVE: LLM-Powered Agent Assistance and Language Augmentation for Video Editing”](https://arxiv.org/abs/2402.10294), IUI 2024.
- **[S20]** Ma et al., [“VideoDiff: Human-AI Video Co-Creation with Alternatives”](https://arxiv.org/abs/2502.10190), 2025.
- **[S21]** Coalition for Content Provenance and Authenticity, [C2PA Technical Specification 2.2](https://spec.c2pa.org/specifications/specifications/2.2/specs/C2PA_Specification).
- **[S22]** European Broadcasting Union, [EBU R 128 loudness recommendation](https://tech.ebu.ch/publications/r128).
- **[S23]** RefineCut authors, [“Plans You Can Check: Verifier-Grounded Learning of an Open-Weight Planner for Executable Video-Editing”](https://openreview.net/forum?id=uBD1X4u4AD), ACL ARR submission, 2026.
