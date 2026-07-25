import test from "node:test";
import assert from "node:assert/strict";
import {
  dbToLinear,
  evaluateDbAutomation,
  generateMusicDuckingAutomation,
  mergeActivityRanges,
  padActivityRanges
} from "./audio-automation.mjs";

test("mergeActivityRanges sorts, merges overlaps, and merges bounded gaps", () => {
  assert.deepEqual(mergeActivityRanges([
    { startTick: "300", endTick: "400" },
    { startTick: "0", endTick: "100" },
    { startTick: "105", endTick: "200" },
    { startTick: "180", endTick: "250" }
  ], "5"), [
    { startTick: "0", endTick: "250" },
    { startTick: "300", endTick: "400" }
  ]);
});

test("padActivityRanges applies roll, clamps, then merges", () => {
  assert.deepEqual(padActivityRanges([
    { startTick: "100", endTick: "200" },
    { startTick: "260", endTick: "300" }
  ], {
    preRollTicks: "20",
    postRollTicks: "30",
    mergeGapTicks: "10",
    minTick: "90",
    maxTick: "310"
  }), [{ startTick: "90", endTick: "310" }]);
});

test("dbToLinear converts amplitude dB and handles negative infinity", () => {
  assert.equal(dbToLinear(0), 1);
  assert.ok(Math.abs(dbToLinear(-6) - 0.5011872336272722) < 1e-15);
  assert.equal(dbToLinear(-Infinity), 0);
  assert.throws(() => dbToLinear(Number.NaN), /finite number/);
});

test("evaluateDbAutomation uses default, exact, linear, and held values", () => {
  const linear = {
    interpolation: "linear",
    defaultValue: 0,
    points: [{ tick: "10", value: -10 }, { tick: "20", value: 0 }]
  };
  assert.equal(evaluateDbAutomation(linear, "5"), 0);
  assert.equal(evaluateDbAutomation(linear, "10"), -10);
  assert.equal(evaluateDbAutomation(linear, "15"), -5);
  assert.equal(evaluateDbAutomation(linear, "30"), 0);
  assert.equal(evaluateDbAutomation({ ...linear, interpolation: "hold" }, "15"), -10);
});

test("generateMusicDuckingAutomation pads, merges, and emits attack/release", () => {
  const result = generateMusicDuckingAutomation({
    activityRanges: [
      { startTick: "100", endTick: "200" },
      { startTick: "230", endTick: "300" }
    ],
    attenuationDb: -12,
    floorDb: -18,
    attackTicks: "20",
    releaseTicks: "40",
    preRollTicks: "10",
    postRollTicks: "10",
    mergeGapTicks: "10",
    minTick: "0",
    maxTick: "400"
  });

  assert.deepEqual(result.duckRanges, [{ startTick: "90", endTick: "310" }]);
  assert.deepEqual(result.curve.points, [
    { tick: "70", value: 0 },
    { tick: "90", value: -12 },
    { tick: "310", value: -12 },
    { tick: "350", value: 0 }
  ]);
  assert.equal(result.diagnostics.length, 0);
});

test("overlapping release and attack shapes use the lower envelope", () => {
  const result = generateMusicDuckingAutomation({
    activityRanges: [
      { startTick: "100", endTick: "200" },
      { startTick: "250", endTick: "350" }
    ],
    attenuationDb: -10,
    attackTicks: "100",
    releaseTicks: "100"
  });

  assert.equal(evaluateDbAutomation(result.curve, "225"), -7.5);
  assert.equal(evaluateDbAutomation(result.curve, "250"), -10);
});

test("floor limits attenuation", () => {
  const result = generateMusicDuckingAutomation({
    activityRanges: [{ startTick: "20", endTick: "40" }],
    baseGainDb: -8,
    attenuationDb: -20,
    floorDb: -18,
    attackTicks: "0",
    releaseTicks: "0"
  });
  assert.equal(evaluateDbAutomation(result.curve, "30"), -18);
});

test("protected manual keyframes win and produce deterministic diagnostics", () => {
  const result = generateMusicDuckingAutomation({
    activityRanges: [{ startTick: "100", endTick: "200" }],
    attenuationDb: -12,
    attackTicks: "20",
    releaseTicks: "20",
    manualKeyframes: [
      { id: "manual-b", tick: "150", value: -3, protected: true },
      { id: "manual-a", tick: "50", value: -2, protected: true }
    ]
  });

  assert.equal(evaluateDbAutomation(result.curve, "150"), -3);
  assert.deepEqual(result.diagnostics.map(({ tick, keyframeId }) => ({ tick, keyframeId })), [
    { tick: "50", keyframeId: "manual-a" },
    { tick: "150", keyframeId: "manual-b" }
  ]);
});

test("strict validation rejects malformed ticks, ranges, parameters, and curves", () => {
  assert.throws(() => mergeActivityRanges([{ startTick: "01", endTick: "2" }]), /canonical/);
  assert.throws(() => mergeActivityRanges([{ startTick: "2", endTick: "2" }]), /greater/);
  assert.throws(() => generateMusicDuckingAutomation({
    activityRanges: [], attenuationDb: 1, attackTicks: "0", releaseTicks: "0"
  }), /attenuationDb/);
  assert.throws(() => generateMusicDuckingAutomation({
    activityRanges: [], attenuationDb: -6, floorDb: 2, attackTicks: "0", releaseTicks: "0"
  }), /floorDb/);
  assert.throws(() => evaluateDbAutomation({
    defaultValue: 0,
    points: [{ tick: "1", value: 0 }, { tick: "1", value: -1 }]
  }, "1"), /duplicate/);
});

