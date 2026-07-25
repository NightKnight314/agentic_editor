# Scripting pipeline: Kiro worked fixture

Status: design fixture, not an app implementation. This document is a normative acceptance test for compiling source analysis plus a style map into a reviewable edit proposal.

Inputs:

- Asset: `videos/kiro_sample_video.mp4`
- Analysis: `analysis/kiro_sample_video.json`
- Style: `styles/kumar.json` (`kumar-method@1`)
- Output: 1080x1920, 30 fps, H.264/AAC
- Duration policy: prefer 45 seconds, allow 30–60 seconds

The important contract is that the script describes editorial intent and evidence requirements. It does not directly mutate a timeline. A resolver binds that intent to source ranges, a compiler emits deterministic operations, validators produce diagnostics, and only an approved proposal becomes a timeline revision.

## 1. Known input defects

An implementation should detect these rather than silently treating the current analysis as ground truth:

| ID | Input inconsistency | Required behavior |
|---|---|---|
| `I001` | The analysis summary calls the result a “41-second” short, while `timeline.targetDuration` is 60 and its six listed ranges total exactly 60 seconds. | Do not use prose duration as a timing source. Calculate duration from integer frames. Warn on disagreement. |
| `I002` | The current six-segment timeline ends at source `251.61999999999998`, in the middle of the shovel analogy, and contains no candid beat, synthesis, or CTA. Its review nevertheless praises all three. | Review the compiled timeline, not the event inventory or intended plan. A missing compiled beat must lower the review score. |
| `I003` | `s02` titles Kiro as an “MIT student founder,” but its selected transcript only establishes Kiro, startup building, founder conversations, and San Francisco. | Reject the `MIT` title unless another selected source interval or external metadata supplies evidence. This fixture uses `KIRO / FOUNDER`. |
| `I004` | The recommended title adds “Next,” while the hook says the markets will “show up the most.” The summary further changes this to “dominate the next YC batch,” although the source refers to YC Startup School. | Keep editorial copy distinguishable from quotations and avoid increasing claim strength. This fixture uses `3 MARKETS I'D BET ON`. |
| `I005` | Event `e10` claims “Clerc, oh my god. Stripe has a similar idea” at `276.86–281.48`, but the word array contains only “Stripe has a similar idea” at `279.66–281.50`. | Mark the event `media_verification_required`; never generate captions for unaligned words. Preview or re-transcribe before approval. |
| `I006` | The transcript alternates `Clerc` and `Clerk`; the likely company name is not deterministically established by the analysis. | Preserve spoken audio, but flag spelling for human verification before rendering captions or brand cards. |
| `I007` | Word timings contain zero-length words and binary float artifacts. | Quantize once to integer source frames. For a selected interval, use `floor(start * fps)` and `ceil(end * fps)` so boundary speech is not clipped. Never compare raw floats for equality. |
| `I008` | `e07` starts with “They,” even though its summary names Mercor; selecting only the event range removes the spoken antecedent. | Resolve enough preceding source to establish the referent. This fixture begins at `186.50`, not `188.64`. |
| `I009` | Media metadata reports 533.000 seconds at 30 fps, while `transcript.duration` reports `533.010009765625`. | Use probed media metadata for asset bounds and keep transcript duration as analyzer provenance. Warn, but tolerate this 10 ms difference. |

## 2. Compact evidence model

Only evidence used by this fixture is shown. Times are source seconds; words remain observations, while events are interpretations over observations.

```yaml
asset:
  id: kiro_sample
  media_duration_seconds: 533.000
  transcript_duration_seconds: 533.010009765625
  source_fps_probed: 30
  source_dimensions_probed: [480, 848]
  output_fps: 30

observations:
  - { id: o_hook_deadline, range: [52.30, 54.54], text: "With just four days until YC Startup School" }
  - { id: o_hook_promise,  range: [56.66, 59.32], text: "here's the top three markets that I bet will show up the most" }
  - { id: o_identity_a,    range: [66.40, 67.50], text: "Hi, I'm Kiro" }
  - { id: o_identity_b,    range: [68.92, 71.10], text: "I've been building startups, talking to founders" }
  - { id: o_physical_a,    range: [82.38, 84.16], text: "Number one is physical AI" }
  - { id: o_physical_b,    range: [84.86, 89.08], text: "When we think of AI, we think of like a chatbot. It's moving way beyond that." }
  - { id: o_physical_examples, range: [89.36, 95.12], text: "People are working on creating autonomous drones, physical robots, being able to manufacture products, speak with people." }
  - { id: o_data,          range: [122.40, 126.16], text: "Second, my favorite one is data. Data is truly king." }
  - { id: o_mercor_a,      range: [186.50, 188.24], text: "And companies like Mercor are betting on that data." }
  - { id: o_mercor_b,      range: [188.70, 195.08], text: "They are taking data from experts every single day and creating this massive database that agents can use." }
  - { id: o_infra_a,       range: [246.34, 248.52], text: "The third one is infrastructure." }
  - { id: o_infra_b,       range: [249.10, 252.74], text: "You know the saying that's like don't dig for gold, sell the shovels instead." }
  - { id: o_human_event,   range: [276.86, 281.48], text_from_event_only: "Clerc, oh my god. Stripe has a similar idea.", verification: required }
  - { id: o_synthesis_a,   range: [389.60, 392.34], text: "Across all three markets, there's one thing that's clear." }
  - { id: o_synthesis_b,   range: [396.68, 404.80], text: "There's a massive shift towards automating a lot of work that used to be seemingly impossible to do with just code." }
  - { id: o_cta,           range: [507.44, 511.14], text: "Where do you think the market is heading, and where are you building? Let me know in the comments." }

events:
  - { id: ev_hook, kind: hook, evidence: [o_hook_deadline, o_hook_promise], confidence: 0.98 }
  - { id: ev_identity, kind: identity, evidence: [o_identity_a, o_identity_b], unsupported_attributes: [MIT] }
  - { id: ev_physical, kind: claim_and_examples, evidence: [o_physical_a, o_physical_b, o_physical_examples] }
  - { id: ev_data, kind: claim_and_proof, evidence: [o_data, o_mercor_a, o_mercor_b] }
  - { id: ev_infra, kind: claim_and_analogy, evidence: [o_infra_a, o_infra_b] }
  - { id: ev_human, kind: candid_release, evidence: [o_human_event], confidence: null, state: unverified }
  - { id: ev_callback, kind: synthesis_and_cta, evidence: [o_synthesis_a, o_synthesis_b, o_cta] }
```

## 3. Script / beat plan

This is an example of the author-facing layer. It names purpose and constraints, not edit operations.

```yaml
script_id: kiro-three-markets-v1
style: kumar-method@1
duration: { preferred_seconds: 45, hard_max_seconds: 60 }
truth_policy:
  spoken_copy: source_only
  editorial_copy: label_as_editorial
  unsupported_claims: reject
beats:
  - id: b01
    role: pattern_interrupt
    say: deadline plus three-market promise
    resolve: { event: ev_hook, trim_pauses: true, preserve_order: true }
    overlay: { text: "3 MARKETS I'D BET ON", provenance: editorial }
  - id: b02
    role: identity_authority
    say: Kiro has recent founder exposure
    resolve: { event: ev_identity, exclude_claims: [MIT], concise: true }
    overlay: { text: "KIRO / FOUNDER", provenance: editorial_inference }
  - id: b03
    role: ambition_conflict
    say: first bet moves AI beyond chatbots into the physical world
    resolve: { event: ev_physical, preserve_complete_phrases: true }
    overlay: { text: "01 / PHYSICAL AI", provenance: source_paraphrase }
  - id: b04
    role: proof_escalation
    say: second bet is data, with Mercor as the concrete example
    resolve: { event: ev_data, require_spoken_antecedent_for_pronouns: true }
    overlay: { text: "02 / DATA", provenance: source_paraphrase }
  - id: b05
    role: proof_escalation
    say: third bet is infrastructure, framed by the shovel analogy
    resolve: { event: ev_infra, preserve_complete_phrases: true }
    overlay: { text: "03 / INFRASTRUCTURE", provenance: source_paraphrase }
  - id: b06
    role: human_record_scratch
    say: candid correction releases the prestige tone
    resolve: { event: ev_human, require_media_verification: true }
    fallback: human_release_card
  - id: b07
    role: callback_cta
    say: synthesize the automation shift, then ask builders a question
    resolve: { event: ev_callback, preserve_complete_phrases: true }
    ending: hard_cut_after_complete_phrase
```

The resolver should prefer a coherent source sentence over the mathematically shortest range. It may make jump cuts only at phrase boundaries, must retain source order within a beat, and cannot join words to create a sentence the speaker did not say.

## 4. Resolved selections

At 30 fps, the resolver expands fractional boundaries outward and stores frames. Composition ranges are half-open: `[in, out)`. No transition overlaps are used, so durations add deterministically.

| Selection | Beat | Source seconds requested | Source frames resolved | Frames | Transcript purpose |
|---|---:|---:|---:|---:|---|
| `r01a` | `b01` | 52.30–54.54 | 1569–1637 | 68 | deadline |
| `r01b` | `b01` | 56.66–59.32 | 1699–1780 | 81 | promise |
| `r02a` | `b02` | 66.40–67.50 | 1992–2025 | 33 | name |
| `r02b` | `b02` | 68.92–71.10 | 2067–2133 | 66 | experience, without unsupported MIT claim |
| `r03a` | `b03` | 82.38–84.16 | 2471–2525 | 54 | physical AI claim |
| `r03b` | `b03` | 84.86–89.08 | 2545–2673 | 128 | beyond chatbots |
| `r03c` | `b03` | 89.36–95.12 | 2680–2854 | 174 | physical examples |
| `r04a` | `b04` | 122.40–126.16 | 3672–3785 | 113 | data claim |
| `r04b` | `b04` | 186.50–188.24 | 5595–5648 | 53 | names Mercor |
| `r04c` | `b04` | 188.70–195.08 | 5661–5853 | 192 | explains expert-data use |
| `r05a` | `b05` | 246.34–248.52 | 7390–7456 | 66 | infrastructure claim |
| `r05b` | `b05` | 249.10–252.74 | 7473–7583 | 110 | complete shovel analogy |
| `r06a` | `b06` | 276.86–281.48 | 8305–8445 | 140 | candid correction; conditional |
| `r07a` | `b07` | 389.60–392.34 | 11688–11771 | 83 | synthesis setup |
| `r07b` | `b07` | 396.68–404.80 | 11900–12144 | 244 | automation thesis |
| `r07c` | `b07` | 507.44–511.14 | 15223–15335 | 112 | question plus comments CTA |

Primary duration is 1,717 frames, or 57.233 seconds. This is below the style's 60-second hard maximum. The 45-second target is a preference, not permission to clip sentences or drop required beats silently.

## 5. Compiled proposal

The proposal is immutable, inspectable, and based on a known revision. It has not yet changed the active timeline.

The readable operations below are **domain-command IR**, not literal members of the editor's current `TimelineOperation` union. The compiler must capability-check them, expand compound commands, and lower supported behavior to today's insert/update/remove/split/track-update operations before strict simulation. For example, `append_source_sequence` expands to deterministic A/V inserts; titles, music, and SFX lower to typed elements on existing compatible tracks. Track creation, freeze frames, link groups, and first-class effects remain unavailable unless the active capability manifest explicitly supports them. No command may be passed straight to the current reducer.

IDs are shortened semantic labels in this fixture so it remains readable. Executable proposal, command, and element IDs use the content-derived hashes specified in the language and compiler documents; `deterministic_seed` below is fixture metadata and never licenses random compilation.

```yaml
proposal:
  id: proposal_kiro_v1
  base_revision: empty_timeline@0
  source_analysis: kiro_sample_video.json
  source_style: kumar-method@1
  status: awaiting_evidence_verification
  deterministic_seed: 0
  output: { width: 1080, height: 1920, fps: 30, duration_frames: 1717 }
  operations:
    - { op: ensure_track, track: V1, kind: video }
    - { op: ensure_track, track: A1, kind: dialogue, linked_to: V1 }
    - { op: ensure_track, track: V2, kind: graphics }
    - { op: ensure_track, track: A2, kind: music }
    - { op: ensure_track, track: A3, kind: sfx }
    - op: append_source_sequence
      tracks: [V1, A1]
      asset: kiro_sample
      selections: [r01a, r01b, r02a, r02b, r03a, r03b, r03c, r04a, r04b, r04c, r05a, r05b, r06a, r07a, r07b, r07c]
      transitions: hard_cut
      link_audio_video: true
    - { op: add_title, track: V2, text: "3 MARKETS I'D BET ON", at_frame: 0, duration_frames: 90, style: display }
    - { op: add_title, track: V2, text: "KIRO / FOUNDER", at_frame: 149, duration_frames: 66, style: identity }
    - { op: add_title, track: V2, text: "01 / PHYSICAL AI", at_frame: 248, duration_frames: 54, style: display }
    - { op: add_title, track: V2, text: "02 / DATA", at_frame: 604, duration_frames: 60, style: display }
    - { op: add_title, track: V2, text: "03 / INFRASTRUCTURE", at_frame: 962, duration_frames: 66, style: display }
    - op: generate_captions
      track: V2
      from: A1
      chunks: { words: [2, 5], lines: [1, 2] }
      safe_area_percent: { left: 8, right: 8, top: 8, bottom: 12 }
      exclude_unaligned_source_frames: [8305, 8445]
    - op: apply_effects
      effects:
        - { range_frames: [0, 149], effect: punch_in, budget_group: punchZoom }
        - { range_frames: [248, 430], effect: slow_digital_push, budget_group: punchZoom }
        - { range_frames: [430, 604], effect: three_panel_stack, budget_group: splitScreen }
        - { range_frames: [604, 1138], effect: restrained_reframes }
        - { range_frames: [1138, 1278], effect: raw_phone_treatment }
        - { range_frames: [1278, 1605], effect: slow_digital_push, budget_group: punchZoom }
    - { op: add_music, track: A2, asset_requirement: licensed_dark_minimal_percussive, range_frames: [0, 1717], duck_db_under_dialogue: -18 }
    - { op: add_sfx, track: A3, cue: impact, at_frame: 149 }
    - { op: add_sfx, track: A3, cue: record_scratch_or_music_drop, at_frame: 1138, conditional_on: r06a_verified }
    - { op: set_dialogue_loudness, track: A1, target_integrated_lufs: -14 }
    - { op: hard_end, at_frame: 1717 }
```

The compiler may expand `append_source_sequence` into 16 insert operations internally. Expansion must preserve the listed order and exact frame counts. Titles, captions, music, and effects are overlays; they do not alter the calculated story duration.

## 6. Diagnostics and apply gate

Expected diagnostics for this input:

```yaml
diagnostics:
  - { code: DURATION_PROSE_MISMATCH, severity: warning, expected_from_summary_seconds: 41, compiled_seconds: 57.233 }
  - { code: UNSUPPORTED_ATTRIBUTE_REMOVED, severity: info, value: MIT, beat: b02 }
  - { code: CLAIM_STRENGTH_NORMALIZED, severity: info, removed_copy: "dominate the next YC batch" }
  - { code: SOURCE_FLOAT_QUANTIZED, severity: info, fps: 30, duration_frames: 1717 }
  - { code: BRAND_SPELLING_UNVERIFIED, severity: warning, candidates: [Clerc, Clerk], affected_event: e10 }
  - { code: EVENT_WORD_ALIGNMENT_MISMATCH, severity: needs_review, event: e10, missing_aligned_text: "Clerc, oh my god" }
  - { code: MEDIA_LICENSE_REQUIRED, severity: needs_review, operation: add_music }
```

Apply is enabled only when:

1. `r06a` has been listened to or re-transcribed and either verified or replaced by the fallback below.
2. Captions contain no text unsupported by aligned speech; unaligned candid audio may remain intentionally uncaptained.
3. The editor supplies an original/licensed music asset or explicitly chooses no music.
4. The user approves the visible timeline diff against `empty_timeline@0`.
5. The proposal's base revision is still current. A stale proposal must be recompiled, not force-applied.

## 7. Deterministic fallback for the candid beat

If media verification finds that `276.86–281.48` does not contain a usable stumble, the system must not fabricate it from the event summary. Replace `r06a` with a clearly editorial tonal break:

```yaml
fallback_id: human_release_card
replace_selection: r06a
operations:
  - { op: add_freeze_frame, source_frame: 7582, at_comp_frame: 1138, duration_frames: 24 }
  - { op: add_title, track: V2, text: "OKAY—THIRD BET.", provenance: editorial, at_frame: 1138, duration_frames: 24 }
  - { op: music_drop, track: A2, range_frames: [1138, 1162] }
remove:
  - record_scratch_or_music_drop conditioned on r06a
new_duration_frames: 1601
new_duration_seconds: 53.367
review_effect:
  humanity: partial_credit
  note: "The release is explicitly editorial; no candid speech is claimed."
```

This fallback satisfies the style map's rule to use a clearly editorial card when a story beat is absent. It does not earn full “humanity” credit because it is not evidence of a genuine candid moment.

The fallback is itself capability-gated. If freeze-frame or music-drop semantics are unsupported, the compiler must use a separately declared supported card-only fallback or omit the optional human beat and request review; it must not approximate those commands silently.

## 8. Expected review result

The review must inspect the compiled operations and expected rendered behavior, not the unused event list.

Primary branch after `r06a` and music-license verification:

| Criterion | Weight | Score earned | Reason |
|---|---:|---:|---|
| Hook | 20 | 20 | The three-market editorial title is visible at frame 0; deadline speech starts immediately and the spoken promise begins within 3 s. |
| Contrast | 20 | 18 | Cinematic graphics and restrained grade contrast with selfie footage without inventing B-roll. |
| Story | 20 | 19 | All three bets, synthesis, and CTA are present in compiled media. |
| Rhythm | 15 | 12 | Phrase-level jump cuts and reframes create escalation; source remains visually repetitive. |
| Legibility | 10 | 10 | Caption limits and safe areas come directly from the style map. |
| Humanity | 10 | 10 | Full credit only after the actual candid correction is verified in media. |
| Technical | 5 | 5 | 1,717 integer frames, complete selected phrases, under 60 seconds. |
| **Total** | **100** | **94** | **Pass after evidence and license gates clear.** |

Before verification the result is `conditional_pass`, not `pass`, regardless of numeric score. With `human_release_card`, humanity becomes 5/10 and the expected numeric result is 89/100, still a pass with an explicit fallback note.

## 9. Expected timeline

These are the observable acceptance-test outputs. Composition frames are authoritative; time is shown for convenience.

| Comp frames | Comp time | Beat / content | Source selections | Visible treatment |
|---:|---:|---|---|---|
| 0–149 | 00:00.000–00:04.967 | deadline + three-market promise | `r01a`, `r01b` | hook title, punch-in |
| 149–248 | 00:04.967–00:08.267 | Kiro + founder exposure | `r02a`, `r02b` | `KIRO / FOUNDER`; no MIT claim |
| 248–604 | 00:08.267–00:20.133 | physical AI + examples | `r03a`–`r03c` | `01`, push, then three-panel treatment |
| 604–962 | 00:20.133–00:32.067 | data + Mercor proof | `r04a`–`r04c` | `02`, keyword captions; Mercor antecedent audible |
| 962–1138 | 00:32.067–00:37.933 | infrastructure + full analogy | `r05a`, `r05b` | `03`, restrained reframe |
| 1138–1278 | 00:37.933–00:42.600 | candid correction | `r06a` | raw treatment, music drop, no generated caption for unaligned words |
| 1278–1605 | 00:42.600–00:53.500 | automation synthesis | `r07a`, `r07b` | authority framing, slow push |
| 1605–1717 | 00:53.500–00:57.233 | builder question + comments | `r07c` | clean captions, hard end |

Acceptance assertions:

- The timeline duration equals `1717 / 30`, never a sum of unrounded floats.
- Every spoken word in the edit maps to source media; every non-verbatim overlay carries explicit provenance such as `editorial` or `source_paraphrase`.
- Every requested story beat maps to at least one compiled operation or an explicit missing/fallback state.
- “MIT,” “next batch,” and “dominate” appear nowhere in rendered text or attributed speech.
- Mercor is named before the pronoun “They.”
- The shovel analogy ends after “instead,” not at the old `251.61999999999998` cutoff.
- The candid audio cannot be approved solely from `e10`'s summary.
- Re-running resolve and compile with the same inputs and seed produces the same frame ranges and operation order.
- Rejecting the proposal leaves the active timeline unchanged; applying it creates one reversible revision.
