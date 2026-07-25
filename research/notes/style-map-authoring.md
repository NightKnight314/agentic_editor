# Authoring machine-actionable editing style maps

Date: 2026-07-25

A style map should describe editorial decision logic, not merely visual adjectives. It must help a planner select material, order beats, choose cuts, budget effects, and review the result without forcing every source into the same template.

## Separate four kinds of rule

1. **Hard constraints** — source bounds, duration limits, platform delivery, legal/consent requirements, required claims, no fabricated speech.
2. **Structural preferences** — beat purposes, ordering, optionality, target ranges, escalation/release, callback behavior.
3. **Stylistic preferences** — shot scale, pace, transitions, typography, grade, sound vocabulary, effect budgets.
4. **Review questions** — evidence-bearing criteria a human or model can score after preview.

Do not hide a hard constraint inside prose. Give every rule an ID, severity, scope, and a machine-readable value when possible.

## Recommended schema

```json
{
  "id": "style-id",
  "version": 1,
  "output": {},
  "thesis": {
    "intent": "the central audience effect",
    "mustFeel": [],
    "avoid": []
  },
  "beats": [
    {
      "id": "hook",
      "purpose": "what changes for the viewer",
      "required": true,
      "targetRange": [0, 0.08],
      "selectionSignals": [],
      "negativeSignals": [],
      "rules": [],
      "fallback": "what to do when source evidence is absent"
    }
  ],
  "pacing": {},
  "picture": {},
  "typography": {},
  "audio": {},
  "constraints": [],
  "review": { "criteria": [] }
}
```

Use normalized beat ranges as targets, not mandatory cut points. Let the planner solve exact timing from the material and target duration.

## Write selection rules against evidence

Good selection signals are detectable or reviewable:

- transcript concepts: claim, contradiction, credential, result, question, call to action;
- performance cues: pause, laughter, interruption, emphasis, uncertainty;
- picture cues: face, detail insert, action, reaction, location, product, text, motion;
- audio cues: onset, silence, impact, music section, applause, environmental sound;
- quality cues: focus, exposure, clipping, occlusion, camera shake, background noise.

Avoid rules such as “make it cinematic” unless decomposed into framing, contrast, pacing, sound, and transition choices.

## Define fallbacks

Every required beat needs an honest fallback:

- mark the beat missing and ask for more media;
- use an editorial title card that does not imply the speaker said generated copy;
- choose an adjacent beat and rebalance duration;
- provide alternative structures with lower confidence.

Never force the planner to hallucinate evidence to satisfy a template.

## Treat numeric values as budgets and bounds

Prefer ranges and maximums:

- median/maximum unchanged shot duration;
- number of emphasis events per time window;
- transition duration bounds and maximum frequency;
- caption words/lines and safe-area margins;
- music ducking and delivery loudness tied to a declared context;
- target beat proportions and overall duration.

Averages alone can create monotonous edits. Measure distributions and outliers, and preserve deliberate exceptions.

## Compile style into planner components

```text
style map
  -> hard constraint validator
  -> candidate scoring features
  -> beat coverage objective
  -> operation parameter bounds
  -> review rubric
  -> explanation vocabulary
```

Candidate score example:

```text
score = relevance_to_beat
      + performance_quality
      + visual_or_audio_novelty
      + proof_strength
      + continuity_fit
      - redundancy
      - technical_risk
      - truth_or_context_risk
```

Keep feature values visible. Do not let the weighted sum erase a hard failure or conceal why a moment was selected.

## Preserve variation

- Define a palette of valid choices, not one fixed sequence of effects.
- Budget accents over time and enforce recovery periods.
- Allow several beat structures for the same thesis.
- Penalize repeated source ranges, identical shot scales, uniform caption animation, and repeated transition patterns.
- Seed stochastic choices for reproducible variants.

## Review methodology

Use a two-stage review:

1. **Deterministic checks:** source bounds, duration, collision, caption coverage, effect count, safe placement, required evidence.
2. **Editorial review:** clarity, emotion, story progression, rhythm, credibility, accessibility, and fit to the thesis.

For subjective scoring, require a short rationale and cite the relevant time range. Compare variants pairwise where possible. A weighted rubric supports prioritization but is not an objective measure of artistic quality.

## Style-reference ethics

- Abstract principles—contrast, pacing, structure, palette, typographic density—rather than copying a living creator's identity, script, watermark, or signature assets.
- Record which traits came from user direction, reference analysis, brand rules, or model inference.
- Use licensed/original audio and assets in exports.
- Label synthetic or reconstructed content when it could be mistaken for captured reality.

## Applying this to `styles/kumar.json`

The existing map is strong because it includes a thesis, beats, measurable budgets, planner rules, and review criteria. High-value additions would be:

- `required`, `fallback`, and `negativeSignals` on each beat;
- stable rule IDs and severity levels;
- delivery-context IDs for loudness and safe-area targets;
- explicit transition handle requirements;
- scoring-feature weights separated from hard constraints;
- evidence references and time-ranged rationales in review results;
- multiple allowed structural variants so edits do not converge on one template.

## Related primary/authoritative sources

- Non-destructive timelines preserve original media while clips are trimmed and moved: [Adobe Premiere editing overview](https://helpx.adobe.com/uk/premiere/desktop/edit-projects/intro-to-editing/edit-video-in-premiere.html).
- Transitions have story functions and some require additional source frames: [Adobe transition guidance](https://www.adobe.com/learn/premiere-pro/web/add-transitions).
- Retention signals should drive experiments and can be ambiguous—for example, spikes may mean rewatching or confusion: [YouTube audience retention](https://support.google.com/youtube/answer/9314415?hl=en-GB).
- Signed provenance can record standardized actions without judging whether an edit is good or truthful: [C2PA specifications](https://spec.c2pa.org/specifications/).

All web sources accessed 2026-07-25.
