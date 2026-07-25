import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  canonicalJson,
  contentHash,
  evaluateClipAt,
  evaluateCurve,
  normalizeEffectPlan,
  sourceFrameAt,
  validateEffectPlan
} from "./core.mjs";

const fixtureUrl = new URL("../../fixtures/effects/demo-plan.json", import.meta.url);
const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));

test("canonical JSON and hashes ignore object key order", () => {
  assert.equal(canonicalJson({ z: 1, a: { y: 2, x: 3 } }), canonicalJson({ a: { x: 3, y: 2 }, z: 1 }));
  assert.equal(contentHash({ z: 1, a: 2 }), contentHash({ a: 2, z: 1 }));
});

test("curve evaluation clamps and uses deterministic easing", () => {
  const curve = { keyframes: [
    { frame: 0, value: 1, easing: "ease_in_out" },
    { frame: 10, value: 1.1, easing: "linear" }
  ] };
  assert.equal(evaluateCurve(curve, -3), 1);
  assert.equal(evaluateCurve(curve, 5), 1.05);
  assert.equal(evaluateCurve(curve, 20), 1.1);
});

test("valid fixture normalizes to stable content-derived plan ID", () => {
  const first = normalizeEffectPlan(fixture);
  const reordered = structuredClone(fixture);
  reordered.clips[0].effects.reverse();
  const second = normalizeEffectPlan(reordered);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.plan.planId, second.plan.planId);
  assert.deepEqual(first.plan, second.plan);
});

test("constant rate maps composition frames to source frames", () => {
  const clip = fixture.clips[0];
  assert.equal(sourceFrameAt(clip, 0), 1569);
  assert.equal(sourceFrameAt(clip, 100), 1684);
});

test("clip evaluation composes stage-ordered visual state", () => {
  const atStart = evaluateClipAt(fixture, "clip-hook", 0);
  const atPunch = evaluateClipAt(fixture, "clip-hook", 124);
  const afterPunch = evaluateClipAt(fixture, "clip-hook", 140);
  assert.equal(atStart.blurRadiusPx, 12);
  assert.equal(atStart.transform.scale, 1);
  assert.ok(atPunch.transform.scale > 1.08);
  assert.equal(afterPunch.transform.scale, 1.08);
  assert.equal(atPunch.color.saturation, 0.92);
  assert.deepEqual(atPunch.vignette, { amount: 0.32, softness: 0.72 });
});

test("unknown effects and bad source consumption are blocking", () => {
  const invalid = structuredClone(fixture);
  invalid.clips[0].sourceDurationFrames = 20;
  invalid.clips[0].effects.push({
    id: "mystery",
    definition: { id: "agent.polish", version: 1 },
    enabled: true,
    range: { startFrame: 0, durationFrames: 2 },
    parameters: {}
  });
  const codes = validateEffectPlan(invalid).map((item) => item.code);
  assert.ok(codes.includes("FX_TIME_MAP_CONSUMPTION"));
  assert.ok(codes.includes("FX_UNKNOWN_DEFINITION"));
});
