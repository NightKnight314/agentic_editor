---
name: plan-video-edit
description: Convert raw-footage analysis, transcripts, briefs, or rough timelines into coherent video edit plans and explicit timeline operations. Use for narrative, documentary, interview, multicamera, montage, short-form, social, dialogue, pacing, continuity, b-roll, hook, or retention-focused editing tasks, and when reviewing an edit's story and rhythm.
---

# Plan Video Edit

Plan meaning before polish. Preserve what speakers actually said and keep every proposed source range valid.

## Gather the contract

Collect or infer:

- audience, platform, aspect ratio, target duration, and call to action;
- source inventory with durations, transcripts, speakers, shot/scene boundaries, and quality flags;
- required claims, moments, people, branding, and legal constraints;
- desired style, reference vocabulary, and tolerance for discontinuity or effects.

State assumptions. Mark missing evidence instead of fabricating dialogue, reactions, continuity, or coverage.

## Build the edit in passes

1. **Select.** Rank moments for story function, clarity, emotion, novelty, proof, and technical usability. Preserve complete thoughts and handles around candidate ranges.
2. **Structure.** Express the story as beats with purpose, required evidence, target duration/range, and transition logic. Make every beat change knowledge, emotion, stakes, or direction.
3. **Radio cut.** Construct intelligible dialogue/narration first. Remove redundancy and throat-clearing without changing meaning.
4. **Picture cut.** Choose shots for information, emotion, continuity, contrast, and performance. Use b-roll to add evidence or context—not merely hide cuts.
5. **Rhythm pass.** Adjust cut timing to speech cadence, motion, reaction, music, and intentional silence. Vary shot duration; do not optimize for cuts per minute alone.
6. **Clarity pass.** Add only the titles, captions, graphics, and callbacks needed to understand or remember the piece.
7. **Review.** Watch the opening, each cut boundary, audio-only, picture-only, and the ending. Score against the brief before adding polish.

Read [references/editorial-methods.md](references/editorial-methods.md) for method selection, practical heuristics, failure modes, and source links.

## Choose cuts deliberately

- Use a hard cut when the new shot advances the same idea cleanly.
- Use a J-cut to introduce incoming sound before its picture; use an L-cut to let outgoing sound bridge into the next picture.
- Cut on compatible motion to reduce discontinuity, or against motion to create intentional impact.
- Prefer reactions when they reveal consequence; never imply a reaction happened at a misleading time.
- Preserve screen direction, eyelines, and spatial anchors when comprehension matters. Break them only with a re-establishing shot or a deliberate discontinuity.
- Treat transitions as semantic punctuation. Default to cuts; use dissolves, wipes, or stylized transitions only when they communicate time, place, comparison, memory, or tone.

## Adapt by format

- **Dialogue/interview:** prioritize truth, complete thoughts, performance, reactions, and smooth split edits.
- **Documentary:** maintain an evidence ledger tying claims and reactions to sources; label reconstruction or generated material.
- **Montage:** define the organizing idea, progression, and audio spine before choosing attractive shots.
- **Short-form:** deliver the promised value immediately, remove greetings, and test alternate openings. Treat retention data as feedback, not a universal creative law.
- **Multicam:** select for speaker, listener response, performance, and usable framing; avoid switching on every utterance.

## Emit an executable plan

Return:

1. assumptions and constraints;
2. beat sheet with composition time ranges;
3. ordered source selections with `assetId`, `sourceStart`, `sourceEnd`, speaker/shot, and rationale;
4. explicit operations such as insert, trim/update, move, split, remove, text, transform, and audio changes;
5. unresolved choices and confidence;
6. review checklist and acceptance criteria.

For every operation, include stable IDs, composition timing, source timing, affected tracks, and the editorial intent. Keep the plan reversible; separate proposals from committed changes.

## Guardrails

- Never invent spoken words or silently reorder words so their meaning changes.
- Never exceed asset bounds or cut away required syllables, breaths, action handles, or transition media.
- Never infer causality, chronology, or reaction timing without evidence.
- Avoid repetitive punch-ins, arbitrary b-roll, effect spam, and uniform shot lengths.
- Preserve a human approval point for high-impact deletions, synthetic media, sensitive claims, and final publish.
