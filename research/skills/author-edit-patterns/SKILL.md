---
name: author-edit-patterns
description: Design, document, validate, or review reusable video-editing patterns and style recipes with editorial intent, evidence requirements, typed parameters, timeline steps, layer dependencies, effect budgets, fallbacks, and review criteria. Use when converting a reference edit, repeated workflow, transition, beat structure, caption treatment, audio chain, motion treatment, or style map into a safe machine-executable recipe for an AI video editor.
---

# Author Edit Patterns

Turn repeatable editorial logic into constrained recipes. Abstract the method and intent; do not copy a creator's identity, script, signature assets, or unlicensed media.

## Define the pattern contract

Record:

- stable ID, version, name, category, and editorial intent;
- what audience effect or story problem the pattern solves;
- eligible source evidence and required capabilities;
- hard preconditions and incompatible conditions;
- typed parameters with units, defaults, bounds, and whether user-facing;
- ordered semantic steps that compile to timeline operations;
- layer dependencies and source-handle requirements;
- effect frequency/intensity budget;
- deterministic checks, editorial review questions, and fallbacks;
- provenance of the abstraction and any licensing/disclosure constraints.

Read [references/pattern-systems.md](references/pattern-systems.md) for schemas, composition rules, examples, research findings, and source links.

## Start from intent, not appearance

Describe why the technique works before how it looks. For example:

- “Let the next idea motivate the picture change” → J-cut with bounded audio lead.
- “Create a human release after tension” → candid evidence selection, reduced effects, and a clear return transition.
- “Emphasize one decisive phrase” → phrase-aligned punch-in plus caption emphasis under an event budget.

Reject definitions like “make it cinematic” until decomposed into selectable evidence, framing, timing, sound, typography, grade, and review criteria.

## Use a typed recipe

```yaml
id: dialogue-j-cut
version: 1
intent: let incoming audio motivate the picture transition
applies_when:
  - two adjacent speech scenes have verified source handles
requires:
  - component_level_audio_video_timing
parameters:
  audio_lead:
    type: duration
    bounds: [0_frames, phrase_boundary]
steps:
  - select incoming acoustic phrase boundary
  - extend incoming audio earlier without moving its picture
  - add minimal boundary fades
constraints:
  - preserve intelligible dialogue
  - prevent competing speech unless interruption is intentional
fallback:
  - use a hard cut or ambience bridge
review:
  - does anticipation improve flow without confusing location or speaker?
```

Use semantic steps rather than storing one brittle example timeline. Compile steps against the current media and timeline revision.

## Separate pattern levels

- **Beat patterns:** hook, reveal, evidence, counterpoint, reaction, callback, CTA.
- **Cut patterns:** match action, J/L cut, cutaway, reaction, graphic match, montage transition.
- **Layout patterns:** reframing, split screen, comparison, picture-in-picture, stacked panels.
- **Information patterns:** identity card, lower third, captions, callout, end card.
- **Finishing patterns:** dialogue cleanup, ducking, normalization, grade/match/look, delivery/QC.
- **Composite patterns:** ordered references to smaller patterns with explicit dependency and conflict rules.

Do not let composite patterns bypass the checks of their children.

## Order layers by dependency

Default to:

1. conform and source mapping;
2. story/radio cut;
3. picture coverage and continuity;
4. dialogue/audio continuity;
5. reframe and layout;
6. captions and information graphics;
7. color normalization and look;
8. music, effects, and automation;
9. decorative motion/effects;
10. output transform, encode, and QC.

Declare which stages a pattern reads and writes. Detect write/write conflicts, stale analysis, and missing handles before compilation.

## Bound style

Use budgets rather than mandatory repetition:

- count per duration window;
- minimum recovery time;
- maximum simultaneous effects;
- intensity/range limits;
- protected intervals and do-not-touch elements;
- diversity penalty for repeated shot, transition, animation, or caption forms.

Permit deliberate exceptions with a reason and review flag.

## Provide honest fallbacks

Every recipe must define behavior when evidence or capability is missing:

- omit the optional pattern;
- use a simpler cut/layout;
- widen, pad, or request review instead of cropping required content;
- mark a beat unsupported instead of inventing dialogue, proof, or reactions;
- return a minimal conflict set and viable repair choices.

Never freeze frames, synthesize handles, generate speech, or imply causality as an invisible fallback.

## Validate the pattern

Test at four levels:

1. **Schema:** required fields, valid types/units/bounds, known operations.
2. **Compilation:** valid source ranges, handles, track compatibility, deterministic replay, undo.
3. **Editorial:** purpose achieved, comprehensible, truthful, non-repetitive, appropriate to format.
4. **Interaction:** preview explains changes, alternatives are meaningful, rejection/reversion is clean.

Forward-test on a normal case, missing-evidence case, boundary case, conflict with another pattern, and a format where the pattern should not apply.

## Capture learning without hidden drift

Log pattern version, parameter choices, proposal, accepted/rejected/modified/reverted status, human delta, reason, project context, and publish outcome. Use this data first for evaluation, retrieval, defaults, and ranking. Do not silently rewrite the recipe or train online from unreviewed behavior.

## Output

Return the recipe, examples, non-examples, compilation sketch, test cases, and unresolved design choices. Keep one source of truth for each rule; put lengthy domain research in references rather than duplicating it in the core pattern.
