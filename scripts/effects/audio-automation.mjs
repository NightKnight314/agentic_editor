const TICK_PATTERN = /^(0|[1-9]\d*)$/;

function fail(name, message) {
  throw new TypeError(`${name}: ${message}`);
}

function tick(value, name) {
  if (typeof value === "bigint") {
    if (value < 0n) fail(name, "must be non-negative");
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) fail(name, "must be a non-negative safe integer");
    return BigInt(value);
  }
  if (typeof value === "string" && TICK_PATTERN.test(value)) return BigInt(value);
  fail(name, "must be a canonical non-negative integer tick");
}

function finiteNumber(value, name, min = -Infinity, max = Infinity) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    fail(name, `must be a finite number in [${min}, ${max}]`);
  }
  return value;
}

function normalizeRanges(ranges, name = "ranges") {
  if (!Array.isArray(ranges)) fail(name, "must be an array");
  return ranges.map((range, index) => {
    if (!range || typeof range !== "object" || Array.isArray(range)) fail(`${name}[${index}]`, "must be an object");
    const start = tick(range.startTick, `${name}[${index}].startTick`);
    const end = tick(range.endTick, `${name}[${index}].endTick`);
    if (end <= start) fail(`${name}[${index}]`, "endTick must be greater than startTick");
    return { start, end };
  }).sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : a.end < b.end ? -1 : a.end > b.end ? 1 : 0);
}

function serializeRanges(ranges) {
  return ranges.map(({ start, end }) => ({ startTick: start.toString(), endTick: end.toString() }));
}

/** Sort and union overlapping ranges and gaps no larger than mergeGapTicks. */
export function mergeActivityRanges(activityRanges, mergeGapTicks = "0") {
  const gap = tick(mergeGapTicks, "mergeGapTicks");
  const sorted = normalizeRanges(activityRanges, "activityRanges");
  const merged = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (!previous || range.start > previous.end + gap) {
      merged.push({ ...range });
    } else if (range.end > previous.end) {
      previous.end = range.end;
    }
  }
  return serializeRanges(merged);
}

/** Expand activity by pre/post roll, clamp to bounds, then merge again. */
export function padActivityRanges(activityRanges, options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) fail("options", "must be an object");
  const pre = tick(options.preRollTicks ?? "0", "preRollTicks");
  const post = tick(options.postRollTicks ?? "0", "postRollTicks");
  const min = tick(options.minTick ?? "0", "minTick");
  const max = options.maxTick === undefined ? null : tick(options.maxTick, "maxTick");
  const mergeGap = tick(options.mergeGapTicks ?? "0", "mergeGapTicks");
  if (max !== null && max <= min) fail("maxTick", "must be greater than minTick");

  const padded = normalizeRanges(activityRanges, "activityRanges").map(({ start, end }) => {
    const paddedStart = start > pre ? start - pre : 0n;
    return {
      start: paddedStart < min ? min : paddedStart,
      end: max !== null && end + post > max ? max : end + post
    };
  }).filter(({ start, end }) => end > start);

  return mergeActivityRanges(serializeRanges(padded), mergeGap.toString());
}

export function dbToLinear(db) {
  if (db === -Infinity) return 0;
  finiteNumber(db, "db");
  return 10 ** (db / 20);
}

function normalizePoints(points, name = "points") {
  if (!Array.isArray(points)) fail(name, "must be an array");
  const normalized = points.map((point, index) => {
    if (!point || typeof point !== "object" || Array.isArray(point)) fail(`${name}[${index}]`, "must be an object");
    return {
      tick: tick(point.tick, `${name}[${index}].tick`),
      value: finiteNumber(point.value, `${name}[${index}].value`, -96, 24),
      protected: point.protected === true,
      id: point.id === undefined ? null : String(point.id)
    };
  }).sort((a, b) => a.tick < b.tick ? -1 : a.tick > b.tick ? 1 : 0);

  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index - 1].tick === normalized[index].tick) fail(name, "must not contain duplicate ticks");
  }
  return normalized;
}

/** Evaluate a hold or linear dB curve at an integer tick. */
export function evaluateDbAutomation(curve, atTick) {
  if (!curve || typeof curve !== "object" || Array.isArray(curve)) fail("curve", "must be an object");
  const interpolation = curve.interpolation ?? "linear";
  if (interpolation !== "linear" && interpolation !== "hold") fail("curve.interpolation", "must be linear or hold");
  const defaultValue = finiteNumber(curve.defaultValue, "curve.defaultValue", -96, 24);
  const points = normalizePoints(curve.points, "curve.points");
  const at = tick(atTick, "atTick");
  if (points.length === 0 || at < points[0].tick) return defaultValue;

  let low = 0;
  let high = points.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle].tick === at) return points[middle].value;
    if (points[middle].tick < at) low = middle + 1;
    else high = middle - 1;
  }

  const left = points[high];
  const right = points[low];
  if (!right || interpolation === "hold") return left.value;
  const numerator = Number(at - left.tick);
  const denominator = Number(right.tick - left.tick);
  return left.value + (right.value - left.value) * (numerator / denominator);
}

function contributionDb(shape, at, baseGainDb, duckGainDb) {
  if (at < shape.rampInStart || at > shape.rampOutEnd) return baseGainDb;
  if (at < shape.start) {
    if (shape.start === shape.rampInStart) return duckGainDb;
    const fraction = Number(at - shape.rampInStart) / Number(shape.start - shape.rampInStart);
    return baseGainDb + (duckGainDb - baseGainDb) * fraction;
  }
  if (at <= shape.end) return duckGainDb;
  if (shape.rampOutEnd === shape.end) return baseGainDb;
  const fraction = Number(at - shape.end) / Number(shape.rampOutEnd - shape.end);
  return duckGainDb + (baseGainDb - duckGainDb) * fraction;
}

/**
 * Generate deterministic linear-dB music ducking automation.
 * Protected manual keyframes always win at their exact ticks. A diagnostic is
 * emitted when generated ducking would otherwise change that value.
 */
export function generateMusicDuckingAutomation(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) fail("options", "must be an object");
  const baseGainDb = finiteNumber(options.baseGainDb ?? 0, "baseGainDb", -96, 24);
  const attenuationDb = finiteNumber(options.attenuationDb, "attenuationDb", -30, 0);
  const floorDb = finiteNumber(options.floorDb ?? -30, "floorDb", -96, 24);
  if (floorDb > baseGainDb) fail("floorDb", "must not exceed baseGainDb");
  const duckGainDb = Math.max(floorDb, baseGainDb + attenuationDb);
  const attack = tick(options.attackTicks, "attackTicks");
  const release = tick(options.releaseTicks, "releaseTicks");
  const min = tick(options.minTick ?? "0", "minTick");
  const max = options.maxTick === undefined ? null : tick(options.maxTick, "maxTick");
  if (max !== null && max <= min) fail("maxTick", "must be greater than minTick");

  const duckRanges = padActivityRanges(options.activityRanges, {
    preRollTicks: options.preRollTicks ?? "0",
    postRollTicks: options.postRollTicks ?? "0",
    mergeGapTicks: options.mergeGapTicks ?? "0",
    minTick: min.toString(),
    ...(max === null ? {} : { maxTick: max.toString() })
  });
  const ranges = normalizeRanges(duckRanges, "duckRanges");
  const shapes = ranges.map(({ start, end }) => ({
    start,
    end,
    rampInStart: start - (start - min < attack ? start - min : attack),
    rampOutEnd: max !== null && end + release > max ? max : end + release
  }));

  const knots = new Set();
  for (const shape of shapes) {
    knots.add(shape.rampInStart);
    knots.add(shape.start);
    knots.add(shape.end);
    knots.add(shape.rampOutEnd);
  }
  // Every contribution is linear between its own knots. Add pairwise crossing
  // ticks so the sampled curve represents the lower envelope between knots,
  // rather than incorrectly interpolating across a change of controlling ramp.
  const initialKnots = [...knots].sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  for (let interval = 0; interval < initialKnots.length - 1; interval += 1) {
    const left = initialKnots[interval];
    const right = initialKnots[interval + 1];
    const width = Number(right - left);
    for (let first = 0; first < shapes.length; first += 1) {
      for (let second = first + 1; second < shapes.length; second += 1) {
        const leftDifference = contributionDb(shapes[first], left, baseGainDb, duckGainDb)
          - contributionDb(shapes[second], left, baseGainDb, duckGainDb);
        const rightDifference = contributionDb(shapes[first], right, baseGainDb, duckGainDb)
          - contributionDb(shapes[second], right, baseGainDb, duckGainDb);
        if (leftDifference * rightDifference >= 0) continue;
        const crossing = width * (leftDifference / (leftDifference - rightDifference));
        for (const offset of [Math.floor(crossing), Math.ceil(crossing)]) {
          if (offset > 0 && offset < width) knots.add(left + BigInt(offset));
        }
      }
    }
  }

  const generated = [...knots].sort((a, b) => a < b ? -1 : a > b ? 1 : 0).map((at) => ({
    tick: at,
    value: shapes.reduce(
      (lowest, shape) => Math.min(lowest, contributionDb(shape, at, baseGainDb, duckGainDb)),
      baseGainDb
    )
  }));

  const manual = normalizePoints(options.manualKeyframes ?? [], "manualKeyframes");
  const pointMap = new Map(generated.map((point) => [point.tick.toString(), point]));
  const diagnostics = [];
  const generatedCurve = {
    domain: "composition_ticks",
    interpolation: "linear",
    defaultValue: baseGainDb,
    points: generated.map((point) => ({ tick: point.tick.toString(), value: point.value }))
  };

  for (const point of manual) {
    const generatedValue = evaluateDbAutomation(generatedCurve, point.tick);
    if (point.protected && Math.abs(generatedValue - point.value) > 1e-9) {
      diagnostics.push({
        code: "audio.ducking.protected-keyframe-conflict",
        severity: "warning",
        tick: point.tick.toString(),
        keyframeId: point.id,
        generatedValueDb: generatedValue,
        preservedValueDb: point.value,
        message: "Generated ducking intersects a protected manual keyframe; the manual value was preserved."
      });
    }
    pointMap.set(point.tick.toString(), { tick: point.tick, value: point.value });
  }

  const points = [...pointMap.values()]
    .sort((a, b) => a.tick < b.tick ? -1 : a.tick > b.tick ? 1 : 0)
    .filter((point, index, all) => {
      if (index === 0 || index === all.length - 1) return true;
      return point.value !== all[index - 1].value || point.value !== all[index + 1].value;
    })
    .map((point) => ({ tick: point.tick.toString(), value: point.value }));

  return {
    curve: { domain: "composition_ticks", interpolation: "linear", defaultValue: baseGainDb, points },
    duckRanges,
    diagnostics
  };
}
