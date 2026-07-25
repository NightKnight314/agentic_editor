const STAGES = new Map([
  ["time.constant_rate@1", 0],
  ["transform.push@1", 1],
  ["transform.punch@1", 1],
  ["transform.shake@1", 1],
  ["filter.blur@1", 2],
  ["color.basic@1", 3],
  ["look.vignette@1", 4],
  ["audio.gain_fade@1", 5],
  ["mix.music_duck@1", 6]
]);

const EFFECT_FIELDS = new Map([
  ["time.constant_rate@1", new Set(["id", "type", "rate", "audioPolicy"])],
  ["transform.push@1", new Set(["id", "type", "startFrame", "durationFrames", "keyframes"])],
  ["transform.punch@1", new Set(["id", "type", "startFrame", "durationFrames", "keyframes"])],
  ["transform.shake@1", new Set(["id", "type", "startFrame", "durationFrames", "keyframes"])],
  ["filter.blur@1", new Set(["id", "type", "startFrame", "durationFrames", "keyframes"])],
  ["color.basic@1", new Set(["id", "type", "brightness", "contrast", "saturation", "warmth"])],
  ["look.vignette@1", new Set(["id", "type", "amount", "softness"])],
  ["audio.gain_fade@1", new Set(["id", "type", "gainDb", "fadeInFrames", "fadeOutFrames"])],
  ["mix.music_duck@1", new Set(["id", "type", "startFrame", "durationFrames", "keyframes"])],
]);

const number = (value) => typeof value === "number" && Number.isFinite(value);
const integer = (value) => Number.isSafeInteger(value);
const fmt = (value) => {
  const rounded = Number(value.toFixed(6));
  return Object.is(rounded, -0) ? "0" : String(rounded);
};
const seconds = (frames, fps) => fmt(frames / fps);
const diag = (code, severity, path, message) => ({ code, severity, path, message });

function allowedObjectFields(value, allowed, path, diagnostics) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) diagnostics.push(diag("UNKNOWN_FIELD", "error", `${path}.${key}`, `Unknown field ${key}`));
  }
}

function requireNumber(value, min, max, path, diagnostics) {
  if (!number(value) || value < min || value > max) diagnostics.push(diag("INVALID_NUMBER", "error", path, `Expected a finite number in ${min}..${max}`));
}

function validateKeyframes(effect, fields, diagnostics) {
  if (!Array.isArray(effect.keyframes) || effect.keyframes.length === 0) {
    diagnostics.push(diag("MISSING_KEYFRAMES", "error", `${effect.id}.keyframes`, "At least one keyframe is required"));
    return;
  }
  let previous = -1;
  for (const [index, keyframe] of effect.keyframes.entries()) {
    allowedObjectFields(keyframe, new Set(["frame", ...fields]), `${effect.id}.keyframes[${index}]`, diagnostics);
    if (!integer(keyframe.frame) || keyframe.frame < 0 || keyframe.frame <= previous) diagnostics.push(diag("NON_MONOTONIC_KEYFRAMES", "error", `${effect.id}.keyframes[${index}].frame`, "Frames must be strictly increasing non-negative integers"));
    previous = keyframe.frame;
    for (const field of fields) if (keyframe[field] !== undefined && !number(keyframe[field])) diagnostics.push(diag("INVALID_NUMBER", "error", `${effect.id}.keyframes[${index}].${field}`, "Expected a finite number"));
  }
}

function interpolateExpression(keyframes, field, fallback) {
  const points = keyframes.filter((keyframe) => keyframe[field] !== undefined);
  if (points.length === 0) return fmt(fallback);
  if (points.length === 1) return fmt(points[0][field]);
  let expression = fmt(points.at(-1)[field]);
  for (let index = points.length - 2; index >= 0; index -= 1) {
    const left = points[index];
    const right = points[index + 1];
    const span = right.frame - left.frame;
    const linear = `${fmt(left[field])}+((${fmt(right[field])})-(${fmt(left[field])}))*(on-${left.frame})/${span}`;
    expression = `if(lt(on,${right.frame}),${linear},${expression})`;
  }
  return `if(lte(on,${points[0].frame}),${fmt(points[0][field])},${expression})`;
}

function validatePlan(plan) {
  const diagnostics = [];
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return [diag("INVALID_PLAN", "error", "$", "Plan must be an object")];
  allowedObjectFields(plan, new Set(["width", "height", "fps", "durationFrames", "effects", "streams"]), "$", diagnostics);
  if (!integer(plan.width) || plan.width <= 0) diagnostics.push(diag("INVALID_DIMENSION", "error", "width", "width must be a positive integer"));
  if (!integer(plan.height) || plan.height <= 0) diagnostics.push(diag("INVALID_DIMENSION", "error", "height", "height must be a positive integer"));
  if (!integer(plan.fps) || plan.fps <= 0) diagnostics.push(diag("INVALID_FPS", "error", "fps", "fps must be a positive integer"));
  if (!integer(plan.durationFrames) || plan.durationFrames <= 0) diagnostics.push(diag("INVALID_DURATION", "error", "durationFrames", "durationFrames must be a positive integer"));
  if (plan.streams !== undefined) {
    allowedObjectFields(plan.streams, new Set(["videoInput", "audioInput"]), "streams", diagnostics);
    if (plan.streams.videoInput !== undefined && (!integer(plan.streams.videoInput) || plan.streams.videoInput < 0)) diagnostics.push(diag("INVALID_STREAM", "error", "streams.videoInput", "videoInput must be non-negative"));
    if (plan.streams.audioInput !== undefined && plan.streams.audioInput !== null && (!integer(plan.streams.audioInput) || plan.streams.audioInput < 0)) diagnostics.push(diag("INVALID_STREAM", "error", "streams.audioInput", "audioInput must be non-negative or null"));
  }
  if (!Array.isArray(plan.effects)) diagnostics.push(diag("INVALID_EFFECTS", "error", "effects", "effects must be an array"));

  const audioInput = plan.streams?.audioInput === undefined ? 0 : plan.streams.audioInput;
  for (const [index, effect] of (plan.effects ?? []).entries()) {
    const path = `effects[${index}]`;
    if (!effect || typeof effect !== "object" || Array.isArray(effect)) {
      diagnostics.push(diag("INVALID_EFFECT", "error", path, "Effect must be an object"));
      continue;
    }
    const fields = EFFECT_FIELDS.get(effect.type);
    if (!fields) {
      diagnostics.push(diag("UNKNOWN_EFFECT", "error", `${path}.type`, `Unknown effect ${effect.type}`));
      continue;
    }
    allowedObjectFields(effect, fields, path, diagnostics);
    if (typeof effect.id !== "string" || !effect.id) diagnostics.push(diag("MISSING_EFFECT_ID", "error", `${path}.id`, "Effect ID is required"));
    if (effect.type === "time.constant_rate@1") {
      requireNumber(effect.rate, 0.5, 4, `${path}.rate`, diagnostics);
      if (!["linked_pitch_preserve", "mute", "detach"].includes(effect.audioPolicy)) diagnostics.push(diag("INVALID_AUDIO_POLICY", "error", `${path}.audioPolicy`, "Unknown audio policy"));
      if (effect.audioPolicy === "linked_pitch_preserve" && effect.rate > 2) diagnostics.push(diag("AUDIO_RATE_UNSUPPORTED", "error", `${path}.rate`, "Pitch-preserved P0 audio is limited to 2x"));
      if (effect.audioPolicy === "detach") diagnostics.push(diag("DETACHED_AUDIO_RETIME", "warning", path, "Picture retimes while detached audio remains at 1x"));
    } else if (effect.type.startsWith("transform.")) {
      validateKeyframes(effect, ["scale", "x", "y", "rotationDeg"], diagnostics);
      const hasRotation = effect.keyframes?.some((keyframe) => Math.abs(keyframe.rotationDeg ?? 0) > 1e-9);
      if (hasRotation) diagnostics.push(diag("ROTATION_UNSUPPORTED", "error", path, "The P0 zoompan binding does not implement rotation"));
      const exposesEdge = effect.keyframes?.some((keyframe) => {
        const scale = keyframe.scale ?? 1;
        return scale < 1 + (2 * Math.max(Math.abs(keyframe.x ?? 0), Math.abs(keyframe.y ?? 0)));
      });
      if (exposesEdge) diagnostics.push(diag("TRANSFORM_EXPOSES_EDGE", "error", path, "Transform needs more scale overscan"));
    } else if (effect.type === "filter.blur@1") {
      validateKeyframes(effect, ["radiusPx"], diagnostics);
      if (effect.keyframes?.some((keyframe) => (keyframe.radiusPx ?? 0) < 0 || (keyframe.radiusPx ?? 0) > 20)) diagnostics.push(diag("BLUR_RANGE", "error", path, "Blur radius must be 0..20"));
      if (new Set(effect.keyframes?.map((keyframe) => keyframe.radiusPx ?? 0)).size > 1) diagnostics.push(diag("APPROXIMATE_BLUR_BINDING", "warning", path, "P0 FFmpeg lowering uses the maximum animated blur radius over the declared interval"));
    } else if (effect.type === "color.basic@1") {
      requireNumber(effect.brightness, -0.25, 0.25, `${path}.brightness`, diagnostics);
      requireNumber(effect.contrast, 0.5, 1.5, `${path}.contrast`, diagnostics);
      requireNumber(effect.saturation, 0, 2, `${path}.saturation`, diagnostics);
      requireNumber(effect.warmth, -1, 1, `${path}.warmth`, diagnostics);
      diagnostics.push(diag("APPROXIMATE_COLOR_BINDING", "warning", path, "FFmpeg EQ/colorbalance is an approximation of the renderer-neutral color model"));
    } else if (effect.type === "look.vignette@1") {
      requireNumber(effect.amount, 0, 1, `${path}.amount`, diagnostics);
      requireNumber(effect.softness, 0.05, 1, `${path}.softness`, diagnostics);
      diagnostics.push(diag("APPROXIMATE_VIGNETTE_BINDING", "warning", path, "FFmpeg vignette parameters approximate the renderer-neutral model"));
    } else if (effect.type === "audio.gain_fade@1") {
      if (audioInput === null) diagnostics.push(diag("MISSING_AUDIO_STREAM", "error", path, "Audio effect requires an audio stream"));
      requireNumber(effect.gainDb, -96, 24, `${path}.gainDb`, diagnostics);
      if (!integer(effect.fadeInFrames) || effect.fadeInFrames < 0) diagnostics.push(diag("INVALID_FADE", "error", `${path}.fadeInFrames`, "fadeInFrames must be non-negative"));
      if (!integer(effect.fadeOutFrames) || effect.fadeOutFrames < 0) diagnostics.push(diag("INVALID_FADE", "error", `${path}.fadeOutFrames`, "fadeOutFrames must be non-negative"));
    } else if (effect.type === "mix.music_duck@1") {
      if (audioInput === null) diagnostics.push(diag("MISSING_AUDIO_STREAM", "error", path, "Ducking requires an audio stream"));
      validateKeyframes(effect, ["gainDb"], diagnostics);
    }
  }
  diagnostics.sort((left, right) => left.code.localeCompare(right.code) || left.path.localeCompare(right.path));
  return diagnostics;
}

function videoFilters(plan, effects) {
  const rate = effects.find((effect) => effect.type === "time.constant_rate@1");
  const filters = [rate ? `setpts=(PTS-STARTPTS)/${fmt(rate.rate)}` : "setpts=PTS-STARTPTS", `fps=${plan.fps}`];
  filters.push(`scale=${plan.width}:${plan.height}:force_original_aspect_ratio=increase:flags=lanczos`, `crop=${plan.width}:${plan.height}`);

  const transforms = effects.filter((effect) => effect.type.startsWith("transform."));
  if (transforms.length) {
    const frames = [];
    for (let frame = 0; frame < plan.durationFrames; frame += 1) {
      let scale = 1;
      let x = 0;
      let y = 0;
      for (const effect of transforms) {
        const start = effect.startFrame ?? 0;
        const duration = effect.durationFrames ?? plan.durationFrames;
        if (frame < start || frame >= start + duration) continue;
        const local = frame - start;
        scale *= numericAt(effect.keyframes, "scale", local, 1);
        x += numericAt(effect.keyframes, "x", local, 0);
        y += numericAt(effect.keyframes, "y", local, 0);
      }
      frames.push({ frame, scale, x, y });
    }
    const scaleExpression = interpolateExpression(compressField(frames, "scale").map(({ frame, value }) => ({ frame, value })), "value", 1);
    const xExpression = interpolateExpression(compressField(frames, "x").map(({ frame, value }) => ({ frame, value })), "value", 0);
    const yExpression = interpolateExpression(compressField(frames, "y").map(({ frame, value }) => ({ frame, value })), "value", 0);
    filters.push(`zoompan=z='${scaleExpression}':x='iw/2-(iw/zoom/2)+(${xExpression})*ow':y='ih/2-(ih/zoom/2)+(${yExpression})*oh':d=1:s=${plan.width}x${plan.height}:fps=${plan.fps}`);
  }

  for (const effect of effects.filter((item) => item.type === "filter.blur@1")) {
    const maximum = Math.max(...effect.keyframes.map((keyframe) => keyframe.radiusPx ?? 0));
    if (maximum > 0) {
      const start = effect.startFrame ?? 0;
      const end = start + (effect.durationFrames ?? plan.durationFrames) - 1;
      filters.push(`gblur=sigma=${fmt(maximum)}:steps=2:enable='between(n,${start},${end})'`);
    }
  }
  for (const effect of effects.filter((item) => item.type === "color.basic@1")) {
    filters.push(`eq=brightness=${fmt(effect.brightness)}:contrast=${fmt(effect.contrast)}:saturation=${fmt(effect.saturation)}`);
    if (effect.warmth !== 0) {
      const shift = effect.warmth * 0.15;
      filters.push(`colorbalance=rs=${fmt(shift)}:bs=${fmt(-shift)}`);
    }
  }
  for (const effect of effects.filter((item) => item.type === "look.vignette@1")) {
    const angle = (Math.PI / 5) + (effect.amount * Math.PI / 8);
    filters.push(`vignette=angle=${fmt(angle)}:aspect=${fmt(plan.width / plan.height)}`);
  }
  return filters;
}

function numericAt(keyframes, field, frame, fallback) {
  const points = keyframes.filter((keyframe) => keyframe[field] !== undefined);
  if (!points.length) return fallback;
  if (frame <= points[0].frame) return points[0][field];
  if (frame >= points.at(-1).frame) return points.at(-1)[field];
  const rightIndex = points.findIndex((point) => point.frame > frame);
  const left = points[rightIndex - 1];
  const right = points[rightIndex];
  return left[field] + ((right[field] - left[field]) * ((frame - left.frame) / (right.frame - left.frame)));
}

function compressField(frames, field, tolerance = 0.00001) {
  const points = frames.map((frame) => ({ frame: frame.frame, value: frame[field] }));
  const simplify = (items) => {
    if (items.length <= 2) return items;
    const first = items[0];
    const last = items.at(-1);
    let maximumError = -1;
    let splitIndex = -1;
    for (let index = 1; index < items.length - 1; index += 1) {
      const ratio = (items[index].frame - first.frame) / (last.frame - first.frame);
      const expected = first.value + ((last.value - first.value) * ratio);
      const error = Math.abs(items[index].value - expected);
      if (error > maximumError) {
        maximumError = error;
        splitIndex = index;
      }
    }
    if (maximumError <= tolerance) return [first, last];
    const left = simplify(items.slice(0, splitIndex + 1));
    const right = simplify(items.slice(splitIndex));
    return [...left.slice(0, -1), ...right];
  };
  return simplify(points);
}

function audioFilters(plan, effects) {
  const rate = effects.find((effect) => effect.type === "time.constant_rate@1");
  const gain = effects.find((effect) => effect.type === "audio.gain_fade@1");
  const duck = effects.find((effect) => effect.type === "mix.music_duck@1");
  if (!rate && !gain && !duck) return ["anull"];
  const filters = [];
  if (rate?.audioPolicy === "mute") {
    filters.push(`atrim=start=0:duration=${seconds(plan.durationFrames, plan.fps)}`, "asetpts=PTS-STARTPTS", "volume=0");
    return filters;
  }
  filters.push("atrim=start=0", "asetpts=PTS-STARTPTS");
  if (rate?.audioPolicy === "linked_pitch_preserve") filters.push(`atempo=${fmt(rate.rate)}`);
  if (gain) {
    filters.push(`volume=${fmt(gain.gainDb)}dB`);
    if (gain.fadeInFrames > 0) filters.push(`afade=t=in:st=0:d=${seconds(gain.fadeInFrames, plan.fps)}`);
    if (gain.fadeOutFrames > 0) filters.push(`afade=t=out:st=${seconds(plan.durationFrames - gain.fadeOutFrames, plan.fps)}:d=${seconds(gain.fadeOutFrames, plan.fps)}`);
  }
  if (duck) filters.push(`volume='${duckExpression(duck, plan.fps)}'`);
  return filters;
}

function duckExpression(effect, fps) {
  const points = effect.keyframes;
  if (points.length === 1) return `pow(10\\,${fmt(points[0].gainDb)}/20)`;
  let expression = `pow(10\\,${fmt(points.at(-1).gainDb)}/20)`;
  for (let index = points.length - 2; index >= 0; index -= 1) {
    const left = points[index];
    const right = points[index + 1];
    const start = (effect.startFrame ?? 0) + left.frame;
    const end = (effect.startFrame ?? 0) + right.frame;
    const value = `${fmt(left.gainDb)}+((${fmt(right.gainDb)})-(${fmt(left.gainDb)}))*(t-${seconds(start, fps)})/${seconds(end - start, fps)}`;
    expression = `if(between(t\\,${seconds(start, fps)}\\,${seconds(end, fps)})\\,pow(10\\,(${value})/20)\\,${expression})`;
  }
  return expression;
}

/**
 * Lower the deliberately narrow standalone P0 plan to FFmpeg arguments.
 * The returned arguments are data only; this function never spawns a process.
 */
export function buildFfmpegPlan(plan) {
  const diagnostics = validatePlan(plan);
  if (diagnostics.some((item) => item.severity === "error")) return { filterComplex: "", args: [], videoLabel: null, audioLabel: null, diagnostics };
  const effects = [...plan.effects].sort((left, right) => STAGES.get(left.type) - STAGES.get(right.type) || left.id.localeCompare(right.id));
  const videoInput = plan.streams?.videoInput ?? 0;
  const audioInput = plan.streams?.audioInput === undefined ? 0 : plan.streams.audioInput;
  const chains = [`[${videoInput}:v]${videoFilters(plan, effects).join(",")}[vout]`];
  if (audioInput !== null) chains.push(`[${audioInput}:a]${audioFilters(plan, effects).join(",")}[aout]`);
  const filterComplex = chains.join(";");
  const args = ["-filter_complex", filterComplex, "-map", "[vout]"];
  if (audioInput !== null) args.push("-map", "[aout]");
  return { filterComplex, args, videoLabel: "vout", audioLabel: audioInput === null ? null : "aout", diagnostics };
}
