import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileDemoPlan } from "./compile-demo.mjs";

const fixture = JSON.parse(await readFile(new URL("../../fixtures/effects/demo-plan.json", import.meta.url), "utf8"));

test("compiles the demo fixture deterministically across reordered effects", () => {
  const first = compileDemoPlan(fixture);
  const reordered = structuredClone(fixture);
  reordered.clips[0].effects.reverse();
  const second = compileDemoPlan(reordered);
  assert.equal(first.ok, true);
  assert.equal(first.planId, "renderplan_e648aeae823dd4210953");
  assert.equal(first.registryHash, "a7573fae49e50b2a7eea9d60858acbecb49336c46a90e8ead5cb20d175dfd5ef");
  assert.equal(first.artifactHash, "e8fbbf219da1795948106ac1b20106ac7a62596eebaebe30ac33691e7369b31d");
  assert.equal(first.artifactHash, second.artifactHash);
  assert.equal(first.planId, second.planId);
  assert.deepEqual(first.ffmpeg.args, second.ffmpeg.args);
});

test("produces expected source timing, effect trace, ducking, and diagnostics", () => {
  const result = compileDemoPlan(fixture);
  assert.deepEqual(result.source, {
    assetId: "source-1",
    path: "videos/kiro_sample_video.mp4",
    seekSeconds: 52.3,
    inputDurationSeconds: 9.2
  });
  assert.equal(result.evaluationTrace.find((state) => state.localFrame === 124).transform.scale, 1.15);
  assert.equal(result.evaluationTrace.at(-1).sourceFrame, 1843.85);
  assert.ok(result.audioAutomation.curve.points.length >= 6);
  assert.deepEqual(result.diagnostics.map((item) => item.code), [
    "MUSIC_BUS_UNAVAILABLE",
    "APPROXIMATE_BLUR_BINDING",
    "APPROXIMATE_COLOR_BINDING",
    "APPROXIMATE_VIGNETTE_BINDING"
  ]);
  assert.match(result.ffmpeg.filterComplex, /setpts=\(PTS-STARTPTS\)\/1\.15/);
  assert.match(result.ffmpeg.filterComplex, /atempo=1\.15/);
});

test("blocks malformed plans before FFmpeg lowering", () => {
  const invalid = structuredClone(fixture);
  invalid.clips[0].effects[0].parameters.rate = 9;
  const result = compileDemoPlan(invalid);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some((item) => item.code === "FX_PARAMETER_RANGE"));
  assert.equal("ffmpeg" in result, false);
});
