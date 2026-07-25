---
name: test-nightcut-app
description: Test and diagnose the Nightcut agent-driven video editor with static checks, headless-browser upload/UI smoke tests, optional paid OpenAI analysis, timeline verification, and export/QC checks. Use when an agent is asked to test the app, verify a change, reproduce an upload or analysis failure, assess demo readiness, or produce an evidence-backed QA report for this repository.
---

# Test Nightcut App

Test from the user-visible boundary inward. Preserve logs, screenshots, request status, and exact failure phases; do not report a pass from source inspection alone.

## Select a profile

- `free-smoke`: Run lint, type checks, app boot, page/UI assertions, local video upload, worker availability, and screenshots. Default to this profile.
- `paid-analysis`: Add browser preprocessing, `POST /api/analyze`, generated-timeline checks, and preview playback. Run only when the user explicitly authorizes API spend and pass `--allow-paid-analysis`.
- `export-qc`: Add MP4 download, `ffprobe`, duration/stream checks, and playback review. If export is not implemented, record a blocked capability rather than a failed test.

Read [references/test-matrix.md](references/test-matrix.md) for acceptance criteria. Read [references/failure-triage.md](references/failure-triage.md) when a test fails or stalls.

## Run the deterministic harness

From the repository root:

```bash
node skills/test-nightcut-app/scripts/test-nightcut.mjs \
  --start-server \
  --url http://localhost:4180 \
  --video videos/kiro_sample_video.mp4
```

The harness uses the installed system Chrome through the DevTools protocol and writes evidence under `/tmp`. It has no browser-library dependency.

For an explicitly authorized paid run:

```bash
node skills/test-nightcut-app/scripts/test-nightcut.mjs \
  --start-server \
  --url http://localhost:4180 \
  --video videos/kiro_sample_video.mp4 \
  --allow-paid-analysis
```

For a local render/download check that does not call OpenAI, add `--test-export`.

Use `--skip-static` only when lint and type checks were already run against the same working tree. Use `--artifacts <directory>` to retain evidence somewhere other than `/tmp`.

## Guardrails

1. Never print `.env`, API keys, request authorization headers, or full OpenAI payloads.
2. Never enable paid analysis implicitly. One authorized run at a time; stop after one charge-producing request unless the user requests variants.
3. Do not run multiple Next dev servers against the same `.next` directory. Reuse a reachable server or let the harness own one server lifecycle.
4. Preserve user changes. Diagnose first; do not edit application code unless the user asks for a fix or the testing request clearly includes fixes.
5. Treat browser preprocessing, API analysis, timeline compilation, preview, rendering, and encoded-file QC as separate boundaries.
6. Use cached analysis fixtures for deterministic UI tests when the application exposes them. Do not claim cached-fixture success proves the live model path.

## Interpret results

The harness exits nonzero when required assertions fail. Inspect:

- `report.json` for assertions, browser exceptions, failed requests, and response status;
- `before-analysis.png` for the imported-media state;
- `after-analysis.png` for paid-run results;
- captured server output for compilation and route failures.

Classify every finding as `pass`, `fail`, `warning`, or `blocked`. Include reproduction steps and artifact paths. Distinguish observed facts from likely causes.

## Report

Return:

1. profile, commit/worktree context, URL, browser, and sample media;
2. passed and failed boundaries;
3. exact first failure with evidence;
4. API request count and estimated cost when applicable;
5. demo risk and the smallest recommended next action.

Do not say “works” when only lint/typecheck pass. Do not say export works until an MP4 is downloaded and probed.
