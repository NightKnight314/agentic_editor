# Edit-pattern systems reference

Use this reference to formalize reusable editorial idioms and layered style recipes. The extended research note is at `../../../notes/edit-pattern-and-style-systems.md`.

## Evidence behind the approach

Computational dialogue editing has represented reusable cinematographic idioms as structured constraints over takes and lines rather than fixed sequences. The AVE benchmark separately identifies recurring shot-sequence patterns such as an insert between surrounding shots and an “intensify” progression toward closer shot sizes. These support storing edit logic explicitly while leaving source selection contextual.

Professional motion-template systems expose selected controls while preserving authored behavior. Adobe Motion Graphics templates package elements and dependencies with customizable controls; Responsive Design–Time protects intro/outro or other timing regions while stretching eligible regions. For Nighthack, the analog is a recipe with protected semantic steps, adaptable intervals, and bounded user-facing parameters.

## Full recipe schema

```ts
type EditPattern = {
  id: string;
  version: number;
  name: string;
  category: "beat" | "cut" | "layout" | "information" | "finish" | "composite";
  intent: string;
  audienceEffect: string;
  evidenceQueries: EvidenceQuery[];
  appliesWhen: Predicate[];
  forbidsWhen: Predicate[];
  capabilities: string[];
  parameters: Record<string, ParameterDefinition>;
  steps: PatternStep[];
  reads: ResourceSelector[];
  writes: ResourceSelector[];
  constraints: Constraint[];
  effectBudget?: EffectBudget;
  protectedRegions?: ProtectedRegion[];
  fallback: FallbackOption[];
  review: ReviewCriterion[];
  provenance: PatternProvenance;
};

type PatternStep = {
  id: string;
  intent: string;
  operation: string;
  inputBindings: Record<string, string>;
  parameterBindings: Record<string, string | number | boolean>;
  preconditions: Predicate[];
  postconditions: Predicate[];
  optional: boolean;
};
```

Use stable IDs and semantic bindings. Keep example timelines as test fixtures, never the recipe's sole definition.

## Parameter rules

Every parameter needs:

- type and unit (`frames`, rational time, dB, LUFS, percent, normalized coordinates, enum);
- default source (`profile`, style map, media analysis, user, or none);
- valid range and quantization;
- whether it can animate and its interpolation;
- whether it is safe to expose or requires expert mode;
- interaction with duration, aspect ratio, frame rate, or source handles;
- serialization and migration behavior.

Never encode units in a label alone. Reject implicit “amount: 0.7” when the effect does not define what 0.7 means.

## Protected and adaptable regions

Mark steps/regions as:

- `fixed`: semantic/timing integrity cannot change;
- `protected_intro` / `protected_outro`: preserve authored entry/exit behavior;
- `elastic`: may stretch within bounds;
- `repeatable`: may add/remove whole semantic units;
- `optional`: omit if evidence is absent;
- `replaceable`: substitute an equivalent evidence role;
- `user_locked`: never regenerate without confirmation.

For a title, intro/outro animation can be protected while the hold is elastic. For dialogue, words remain fixed to source while pre/post handles can adapt. For montage, whole shots may be repeatable while the payoff remains fixed.

## Composition and conflicts

Build a dependency DAG. Add edges for:

- data dependency: captions depend on conformed dialogue timing;
- spatial dependency: caption placement depends on reframe and graphics;
- color dependency: creative look depends on input normalization;
- audio dependency: loudness measurement follows the final mix;
- handle dependency: transitions depend on neighboring source availability;
- review dependency: generated frames require explicit preview.

Detect:

- two patterns writing incompatible timing or transforms;
- a later pattern invalidating analysis used by an earlier pattern;
- cycles in dependencies;
- accumulated effects exceeding a budget;
- one pattern violating another's protected region;
- composite patterns suppressing child warnings.

Conflict policies should be explicit: reject, prioritize by severity, merge parameters through a defined rule, or present alternatives. Never let array order decide silently.

## Extracting a pattern from references

1. Describe the audience effect and editorial function.
2. Segment the reference into beats, cuts, layout, information, audio, and finishing layers.
3. Identify invariants across multiple examples; separate content-specific accidents.
4. Convert observations to evidence queries, parameters, constraints, and budgets.
5. Record negative examples and contexts where the pattern is inappropriate.
6. Replace proprietary/signature assets with abstract roles or licensed project assets.
7. Build at least two implementations using different source material.
8. Verify that the result preserves intent without copying identity or exact expression.

One example is insufficient to distinguish a general method from an accidental detail. Mark single-example inferences as hypotheses.

## Useful pattern primitives

### Insert

Place a detail/evidence shot between surrounding shots while preserving the audio or action spine. Require semantic relevance, source handles, and return continuity. Fallback to holding the primary shot.

### Intensify

Progress toward closer framing or increasing detail as emotional/information stakes rise. Require compatible subject/action and a reason for escalation. Do not force monotonic scale changes when performance or continuity is stronger.

### Responsive identity card

Protect entry and exit animation; adapt the hold to verified text length and reading profile. Expose text, theme tokens, alignment, and bounded timing. Re-layout for target aspect and collision regions.

### Dialogue split edit

Protect complete words/phrases; adapt audio overlap to acoustic boundaries and available handles. Verify no competing dialogue, sync break, or misleading reaction.

### Proof montage

Bind shots to evidence roles (`setup`, `action`, `result`), not filenames. Select diverse, readable shots under a duration budget; align only compatible semantic boundaries to music accents.

## Effect budgets

Model budgets per window and per semantic role:

```yaml
window: 10s
limits:
  punch_in: {min: 0, max: 2, cooldown: 2s}
  accent_transition: {min: 0, max: 1, cooldown: 4s}
  simultaneous_decorative_effects: {max: 2}
protected:
  - testimony
  - legal_disclosure
diversity:
  transition_repeat_penalty: 0.7
```

Budgets are review signals except where accessibility, safety, or delivery makes them hard constraints.

## Testing matrix

Test:

- ideal evidence and ample handles;
- minimum and maximum duration;
- longest/shortest text and alternate languages;
- multiple aspect ratios and frame rates;
- missing evidence/capability;
- low-confidence evidence;
- no transition handles;
- conflicting patterns;
- protected/locked material;
- replay after timeline revision;
- undo and deterministic reapply;
- contexts where the pattern must decline.

Record whether failure is schema, applicability, infeasible constraints, compilation, render, or editorial review.

## Interaction

Show selected pattern, intent, evidence bindings, parameters, affected range, warnings, and before/after preview. Permit direct manipulation after application without losing provenance. Present structural alternatives before superficial parameter variants.

Do not hide a large operation batch behind one decorative pattern name.

## Primary and official sources

- [Computational Video Editing for Dialogue-Driven Scenes](https://graphics.stanford.edu/papers/roughcut/)
- [The Anatomy of Video Editing dataset and benchmarks](https://arxiv.org/abs/2207.09812)
- [OpenTimelineIO schema reference](https://opentimelineio.readthedocs.io/en/latest/api/python/opentimelineio.schema.html)
- [Adobe Motion Graphics templates](https://helpx.adobe.com/uk/after-effects/using/creating-motion-graphics-templates.html)
- [Adobe Responsive Design–Time](https://helpx.adobe.com/uk/after-effects/using/responsive-design.html)
- [VideoDiff: Human-AI Video Co-Creation with Alternatives](https://doi.org/10.1145/3706598.3713417)

Sources accessed 2026-07-25.
