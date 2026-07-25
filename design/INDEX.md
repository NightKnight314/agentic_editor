# Design handoff

This folder contains implementation-facing design work for the Nighthack editor. It does not modify application code.

## Scripting pipeline

- [`scripting-pipeline.md`](scripting-pipeline.md) — canonical architecture, decisions, boundaries, migration, and P0 build order.
- [`scripting-pipeline-script-language.md`](scripting-pipeline-script-language.md) — declarative script schema, selectors, beats, patterns, constraints, and examples.
- [`scripting-pipeline-compiler.md`](scripting-pipeline-compiler.md) — deterministic resolution, compilation, validation, proposals, revisions, and runtime behavior.
- [`scripting-pipeline-example.md`](scripting-pipeline-example.md) — Kiro/Kumar worked fixture and acceptance tests.

The canonical design decision is: **models may author an edit script, but only deterministic code may compile, validate, and apply timeline operations.**

For the hackathon, implement the narrow vertical slice first:

1. Wrap the current timeline in a hashed revision and make agent edits produce a proposal rather than mutate it.
2. Strictly simulate an atomic batch of the five existing operation types; reject clamps, missing targets, partial batches, and stale bases.
3. Migrate today's `AnalysisResult.timeline.segments` into a locked legacy `EditScript` without rewriting the analyzer.
4. Compile that script back to current timeline semantics with deterministic IDs and evidence-linked diagnostics.
5. Show the structural diff and Apply/Reject; Apply creates one reversible descendant revision.

Only after that seam works should the app enable open-ended selectors, additional recipes, richer transitions, or finishing passes.

## Effects

- [`effects-system.md`](effects-system.md) — canonical typed-effects architecture, time mapping, preview/export adapters, P0 registry, migration, and build order.
- [`effects-visual-temporal.md`](effects-visual-temporal.md) — visual and temporal effect definitions and rendering details.
- [`effects-audio.md`](effects-audio.md) — dialogue, music, SFX, mixing, and loudness design.

Executable reference: [`../scripts/effects/README.md`](../scripts/effects/README.md) contains the standalone registry, deterministic evaluator, ducking automation, FFmpeg adapter, fixture compiler, renderer, and golden tests. It is isolated from React/editor state so it can be integrated without adopting a second authority path.
