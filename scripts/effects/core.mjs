import { createHash } from "node:crypto";

const STAGE_ORDER = [
  "time_map",
  "source_correction",
  "geometry",
  "spatial_filter",
  "color",
  "stylize",
  "boundary_transition",
  "composite",
  "audio_repair",
  "audio_tone",
  "audio_dynamics",
  "audio_level",
  "bus_mix",
  "master"
];

const finiteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const integer = (value) => Number.isSafeInteger(value);

const DEFINITIONS = [
  {
    id: "time.constant_rate",
    version: 1,
    domain: "time",
    stage: "time_map",
    targets: ["video", "audio"],
    parameters: {
      rate: { type: "number", min: 0.5, max: 4 },
      preservePitch: { type: "boolean" },
      audioPolicy: { type: "enum", values: ["linked_pitch_preserve", "linked_resample", "mute", "detach"] }
    }
  },
  {
    id: "time.freeze",
    version: 1,
    domain: "time",
    stage: "time_map",
    targets: ["video"],
    parameters: {
      sourceFrame: { type: "integer", min: 0 },
      durationFrames: { type: "integer", min: 2, max: 90 },
      audioPolicy: { type: "enum", values: ["continue_detached", "room_tone", "mute"] }
    }
  },
  {
    id: "transform.push",
    version: 1,
    domain: "video",
    stage: "geometry",
    targets: ["video", "image"],
    parameters: {
      anchorX: { type: "number", min: 0, max: 1 },
      anchorY: { type: "number", min: 0, max: 1 }
    },
    automation: {
      scale: { min: 1, max: 1.2 },
      x: { min: -1, max: 1 },
      y: { min: -1, max: 1 }
    }
  },
  {
    id: "transform.punch",
    version: 1,
    domain: "video",
    stage: "geometry",
    targets: ["video", "image"],
    parameters: {
      anchorX: { type: "number", min: 0, max: 1 },
      anchorY: { type: "number", min: 0, max: 1 }
    },
    automation: {
      scale: { min: 1, max: 1.2 },
      x: { min: -1, max: 1 },
      y: { min: -1, max: 1 }
    }
  },
  {
    id: "transform.shake",
    version: 1,
    domain: "video",
    stage: "geometry",
    targets: ["video", "image"],
    parameters: {
      overscanScale: { type: "number", min: 1, max: 1.2 }
    },
    automation: {
      x: { min: -0.04, max: 0.04 },
      y: { min: -0.04, max: 0.04 },
      rotationDeg: { min: -2.5, max: 2.5 }
    }
  },
  {
    id: "filter.blur",
    version: 1,
    domain: "video",
    stage: "spatial_filter",
    targets: ["video", "image"],
    parameters: {},
    automation: { radiusPx: { min: 0, max: 20 } }
  },
  {
    id: "color.basic",
    version: 1,
    domain: "video",
    stage: "color",
    targets: ["video", "image"],
    parameters: {
      brightness: { type: "number", min: -0.25, max: 0.25 },
      contrast: { type: "number", min: 0.5, max: 1.5 },
      saturation: { type: "number", min: 0, max: 2 },
      warmth: { type: "number", min: -1, max: 1 }
    }
  },
  {
    id: "look.vignette",
    version: 1,
    domain: "video",
    stage: "stylize",
    targets: ["video", "image"],
    parameters: {
      amount: { type: "number", min: 0, max: 1 },
      softness: { type: "number", min: 0.05, max: 1 }
    }
  },
  {
    id: "audio.gain_fade",
    version: 1,
    domain: "audio",
    stage: "audio_level",
    targets: ["audio", "bus"],
    parameters: {
      gainDb: { type: "number", min: -96, max: 24 },
      fadeInMs: { type: "number", min: 0, max: 10000 },
      fadeOutMs: { type: "number", min: 0, max: 10000 }
    }
  },
  {
    id: "mix.music_duck",
    version: 1,
    domain: "mix",
    stage: "bus_mix",
    targets: ["bus"],
    parameters: {
      attenuationDb: { type: "number", min: -30, max: 0 },
      attackMs: { type: "number", min: 5, max: 500 },
      releaseMs: { type: "number", min: 50, max: 3000 }
    }
  }
];

export const EFFECT_REGISTRY = new Map(DEFINITIONS.map((definition) => [`${definition.id}@${definition.version}`, Object.freeze(definition)]));

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical values must be finite");
    return Object.is(value, -0) ? 0 : Number(value.toFixed(6));
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function contentHash(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function stableId(prefix, value) {
  return `${prefix}_${contentHash(value).slice(0, 20)}`;
}

function diagnostic(code, message, path, severity = "error") {
  return { code, severity, message, path };
}

function validateParameter(value, rule, path, diagnostics) {
  if (rule.type === "number" && !finiteNumber(value)) diagnostics.push(diagnostic("FX_PARAMETER_TYPE", "Expected a finite number", path));
  if (rule.type === "integer" && !integer(value)) diagnostics.push(diagnostic("FX_PARAMETER_TYPE", "Expected a safe integer", path));
  if (rule.type === "boolean" && typeof value !== "boolean") diagnostics.push(diagnostic("FX_PARAMETER_TYPE", "Expected a boolean", path));
  if (rule.type === "enum" && !rule.values.includes(value)) diagnostics.push(diagnostic("FX_PARAMETER_ENUM", `Expected one of ${rule.values.join(", ")}`, path));
  if ((rule.type === "number" || rule.type === "integer") && finiteNumber(value)) {
    if (rule.min !== undefined && value < rule.min) diagnostics.push(diagnostic("FX_PARAMETER_RANGE", `Value is below ${rule.min}`, path));
    if (rule.max !== undefined && value > rule.max) diagnostics.push(diagnostic("FX_PARAMETER_RANGE", `Value is above ${rule.max}`, path));
  }
}

function validateCurve(curve, bounds, path, diagnostics) {
  if (!curve || !Array.isArray(curve.keyframes) || curve.keyframes.length === 0) {
    diagnostics.push(diagnostic("FX_CURVE_EMPTY", "Curve needs at least one keyframe", path));
    return;
  }
  let previous = -1;
  for (let index = 0; index < curve.keyframes.length; index += 1) {
    const keyframe = curve.keyframes[index];
    const keyPath = `${path}.keyframes[${index}]`;
    if (!integer(keyframe.frame) || keyframe.frame < 0) diagnostics.push(diagnostic("FX_KEYFRAME_TIME", "Keyframe frame must be a non-negative safe integer", `${keyPath}.frame`));
    if (integer(keyframe.frame) && keyframe.frame <= previous) diagnostics.push(diagnostic("FX_KEYFRAME_ORDER", "Keyframe frames must be strictly increasing", `${keyPath}.frame`));
    previous = keyframe.frame;
    if (!finiteNumber(keyframe.value)) diagnostics.push(diagnostic("FX_KEYFRAME_VALUE", "Keyframe value must be finite", `${keyPath}.value`));
    if (finiteNumber(keyframe.value) && (keyframe.value < bounds.min || keyframe.value > bounds.max)) diagnostics.push(diagnostic("FX_KEYFRAME_RANGE", `Value must be in ${bounds.min}..${bounds.max}`, `${keyPath}.value`));
    if (!["hold", "linear", "ease_in", "ease_out", "ease_in_out"].includes(keyframe.easing)) diagnostics.push(diagnostic("FX_KEYFRAME_EASING", "Unknown easing", `${keyPath}.easing`));
  }
}

export function validateEffectPlan(plan) {
  const diagnostics = [];
  if (plan?.schemaVersion !== "nighthack.effects-demo/1") diagnostics.push(diagnostic("FX_SCHEMA_VERSION", "Expected nighthack.effects-demo/1", "schemaVersion"));
  if (!integer(plan?.project?.fps) || plan.project.fps <= 0) diagnostics.push(diagnostic("FX_PROJECT_FPS", "Project fps must be a positive integer", "project.fps"));
  if (!integer(plan?.project?.width) || plan.project.width <= 0) diagnostics.push(diagnostic("FX_PROJECT_WIDTH", "Project width must be a positive integer", "project.width"));
  if (!integer(plan?.project?.height) || plan.project.height <= 0) diagnostics.push(diagnostic("FX_PROJECT_HEIGHT", "Project height must be a positive integer", "project.height"));
  if (!Array.isArray(plan?.clips)) diagnostics.push(diagnostic("FX_CLIPS_TYPE", "clips must be an array", "clips"));

  for (const [clipIndex, clip] of (plan?.clips ?? []).entries()) {
    const clipPath = `clips[${clipIndex}]`;
    if (!clip.id) diagnostics.push(diagnostic("FX_CLIP_ID", "Clip ID is required", `${clipPath}.id`));
    if (!integer(clip.startFrame) || clip.startFrame < 0) diagnostics.push(diagnostic("FX_CLIP_START", "startFrame must be a non-negative integer", `${clipPath}.startFrame`));
    if (!integer(clip.durationFrames) || clip.durationFrames <= 0) diagnostics.push(diagnostic("FX_CLIP_DURATION", "durationFrames must be a positive integer", `${clipPath}.durationFrames`));
    if (!integer(clip.sourceStartFrame) || clip.sourceStartFrame < 0) diagnostics.push(diagnostic("FX_SOURCE_START", "sourceStartFrame must be a non-negative integer", `${clipPath}.sourceStartFrame`));
    if (!integer(clip.sourceDurationFrames) || clip.sourceDurationFrames <= 0) diagnostics.push(diagnostic("FX_SOURCE_DURATION", "sourceDurationFrames must be a positive integer", `${clipPath}.sourceDurationFrames`));
    const seenStages = new Set();
    for (const [effectIndex, effect] of (clip.effects ?? []).entries()) {
      const effectPath = `${clipPath}.effects[${effectIndex}]`;
      const key = `${effect.definition?.id}@${effect.definition?.version}`;
      const definition = EFFECT_REGISTRY.get(key);
      if (!definition) {
        diagnostics.push(diagnostic("FX_UNKNOWN_DEFINITION", `Unknown effect ${key}`, `${effectPath}.definition`));
        continue;
      }
      if (!definition.targets.includes(clip.kind)) diagnostics.push(diagnostic("FX_TARGET_KIND", `${key} does not accept ${clip.kind}`, effectPath));
      if (!integer(effect.range?.startFrame) || effect.range.startFrame < 0 || !integer(effect.range?.durationFrames) || effect.range.durationFrames <= 0 || effect.range.startFrame + effect.range.durationFrames > clip.durationFrames) {
        diagnostics.push(diagnostic("FX_RANGE", "Effect range must be a positive local half-open range inside the clip", `${effectPath}.range`));
      }
      if (definition.stage === "time_map" && (effect.range?.startFrame !== 0 || effect.range?.durationFrames !== clip.durationFrames)) {
        diagnostics.push(diagnostic("FX_P0_TIME_MAP_RANGE", "P0 time maps must cover the whole clip", `${effectPath}.range`));
      }
      for (const [name, rule] of Object.entries(definition.parameters ?? {})) {
        if (!(name in (effect.parameters ?? {}))) diagnostics.push(diagnostic("FX_PARAMETER_MISSING", `Missing ${name}`, `${effectPath}.parameters.${name}`));
        else validateParameter(effect.parameters[name], rule, `${effectPath}.parameters.${name}`, diagnostics);
      }
      for (const name of Object.keys(effect.parameters ?? {})) {
        if (!(name in (definition.parameters ?? {}))) diagnostics.push(diagnostic("FX_PARAMETER_UNKNOWN", `Unknown parameter ${name}`, `${effectPath}.parameters.${name}`));
      }
      for (const [name, curve] of Object.entries(effect.automation ?? {})) {
        const bounds = definition.automation?.[name];
        if (!bounds) diagnostics.push(diagnostic("FX_AUTOMATION_UNKNOWN", `Parameter ${name} is not automatable`, `${effectPath}.automation.${name}`));
        else validateCurve(curve, bounds, `${effectPath}.automation.${name}`, diagnostics);
      }
      if (definition.stage === "time_map" && seenStages.has("time_map")) diagnostics.push(diagnostic("FX_EXCLUSIVE_TIME_MAP", "Only one P0 time map may target a clip", effectPath));
      seenStages.add(definition.stage);
    }

    const rateEffect = (clip.effects ?? []).find((effect) => effect.definition?.id === "time.constant_rate");
    if (rateEffect && integer(clip.durationFrames) && integer(clip.sourceDurationFrames)) {
      const expected = clip.durationFrames * rateEffect.parameters.rate;
      if (Math.abs(expected - clip.sourceDurationFrames) > 1) diagnostics.push(diagnostic("FX_TIME_MAP_CONSUMPTION", `Rate consumes ${expected} source frames but clip declares ${clip.sourceDurationFrames}`, clipPath));
      if (rateEffect.parameters.preservePitch && rateEffect.parameters.rate > 2) diagnostics.push(diagnostic("FX_AUDIO_RATE_UNSUPPORTED", "P0 pitch-preserved audio is limited to 2x", `${clipPath}.effects`, "error"));
      if (rateEffect.parameters.preservePitch && rateEffect.parameters.rate > 1.25) diagnostics.push(diagnostic("FX_SPEECH_RATE_REVIEW", "Rates above 1.25x require review for intelligible speech", `${clipPath}.effects`, "warning"));
    }
  }

  diagnostics.sort((left, right) => `${left.path}:${left.code}`.localeCompare(`${right.path}:${right.code}`));
  return diagnostics;
}

function ease(kind, value) {
  if (kind === "hold") return 0;
  if (kind === "ease_in") return value * value;
  if (kind === "ease_out") return 1 - ((1 - value) * (1 - value));
  if (kind === "ease_in_out") return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
  return value;
}

export function evaluateCurve(curve, frame) {
  if (!curve?.keyframes?.length) return curve?.defaultValue;
  const keyframes = curve.keyframes;
  if (frame <= keyframes[0].frame) return keyframes[0].value;
  const last = keyframes[keyframes.length - 1];
  if (frame >= last.frame) return last.value;
  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const left = keyframes[index];
    const right = keyframes[index + 1];
    if (frame < right.frame) {
      if (left.easing === "hold") return left.value;
      const progress = (frame - left.frame) / (right.frame - left.frame);
      const amount = ease(left.easing, progress);
      return Number((left.value + ((right.value - left.value) * amount)).toFixed(6));
    }
  }
  return last.value;
}

function activeAt(effect, localFrame) {
  return effect.enabled !== false && localFrame >= effect.range.startFrame && localFrame < effect.range.startFrame + effect.range.durationFrames;
}

export function sourceFrameAt(clip, localCompositionFrame) {
  const rate = clip.effects?.find((effect) => effect.definition?.id === "time.constant_rate" && activeAt(effect, localCompositionFrame))?.parameters.rate ?? 1;
  return Number((clip.sourceStartFrame + (localCompositionFrame * rate)).toFixed(6));
}

export function evaluateClipAt(plan, clipId, compositionFrame) {
  const clip = plan.clips.find((candidate) => candidate.id === clipId);
  if (!clip) throw new Error(`Unknown clip ${clipId}`);
  const localFrame = compositionFrame - clip.startFrame;
  if (localFrame < 0 || localFrame >= clip.durationFrames) return null;

  const state = {
    clipId,
    compositionFrame,
    localFrame,
    sourceFrame: sourceFrameAt(clip, localFrame),
    transform: { scale: 1, x: 0, y: 0, rotationDeg: 0, anchorX: 0.5, anchorY: 0.5 },
    blurRadiusPx: 0,
    color: { brightness: 0, contrast: 1, saturation: 1, warmth: 0 },
    vignette: { amount: 0, softness: 0.5 },
    activeEffectIds: []
  };

  const effects = [...(clip.effects ?? [])].sort((left, right) => {
    const leftDefinition = EFFECT_REGISTRY.get(`${left.definition.id}@${left.definition.version}`);
    const rightDefinition = EFFECT_REGISTRY.get(`${right.definition.id}@${right.definition.version}`);
    return STAGE_ORDER.indexOf(leftDefinition.stage) - STAGE_ORDER.indexOf(rightDefinition.stage) || left.id.localeCompare(right.id);
  });

  for (const effect of effects) {
    if (!activeAt(effect, localFrame)) continue;
    state.activeEffectIds.push(effect.id);
    const effectFrame = localFrame - effect.range.startFrame;
    const value = (name, fallback) => effect.automation?.[name] ? evaluateCurve(effect.automation[name], effectFrame) : fallback;
    if (effect.definition.id.startsWith("transform.")) {
      state.transform.scale *= value("scale", effect.parameters.overscanScale ?? 1);
      state.transform.x += value("x", 0);
      state.transform.y += value("y", 0);
      state.transform.rotationDeg += value("rotationDeg", 0);
      state.transform.anchorX = effect.parameters.anchorX ?? state.transform.anchorX;
      state.transform.anchorY = effect.parameters.anchorY ?? state.transform.anchorY;
    } else if (effect.definition.id === "filter.blur") {
      state.blurRadiusPx = value("radiusPx", 0);
    } else if (effect.definition.id === "color.basic") {
      state.color = { ...state.color, ...effect.parameters };
    } else if (effect.definition.id === "look.vignette") {
      state.vignette = { ...state.vignette, ...effect.parameters };
    }
  }
  state.transform.scale = Number(state.transform.scale.toFixed(6));
  state.transform.x = Number(state.transform.x.toFixed(6));
  state.transform.y = Number(state.transform.y.toFixed(6));
  state.transform.rotationDeg = Number(state.transform.rotationDeg.toFixed(6));
  return state;
}

export function normalizeEffectPlan(plan) {
  const diagnostics = validateEffectPlan(plan);
  if (diagnostics.some((item) => item.severity === "error")) return { ok: false, diagnostics };
  const normalized = structuredClone(plan);
  normalized.clips = normalized.clips.map((clip) => ({
    ...clip,
    effects: (clip.effects ?? [])
      .map((effect) => ({ ...effect, id: effect.id || stableId("fx", { clipId: clip.id, effect }) }))
      .sort((left, right) => {
        const leftDefinition = EFFECT_REGISTRY.get(`${left.definition.id}@${left.definition.version}`);
        const rightDefinition = EFFECT_REGISTRY.get(`${right.definition.id}@${right.definition.version}`);
        return STAGE_ORDER.indexOf(leftDefinition.stage) - STAGE_ORDER.indexOf(rightDefinition.stage) || left.id.localeCompare(right.id);
      })
  }));
  normalized.planId = stableId("renderplan", normalized);
  return { ok: true, plan: canonicalize(normalized), diagnostics };
}

export function registryManifest() {
  const definitions = [...EFFECT_REGISTRY.values()].map(canonicalize);
  return { definitions, registryHash: contentHash(definitions) };
}
