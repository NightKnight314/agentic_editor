#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  contentHash,
  evaluateClipAt,
  evaluateCurve,
  normalizeEffectPlan,
  registryManifest
} from "./core.mjs";
import { generateMusicDuckingAutomation } from "./audio-automation.mjs";
import { buildFfmpegPlan } from "./ffmpeg-adapter.mjs";

const millisecondsToTicks = (milliseconds, sampleRate) => String(Math.round((milliseconds / 1000) * sampleRate));
const ticksToFrame = (ticks, sampleRate, fps) => Math.round((Number(ticks) / sampleRate) * fps);

function effectKeyframes(effect, fields, defaults) {
  const frames = new Set([0, effect.range.durationFrames - 1]);
  for (const curve of Object.values(effect.automation ?? {})) {
    for (const keyframe of curve.keyframes ?? []) frames.add(keyframe.frame);
  }
  return [...frames].sort((left, right) => left - right).map((frame) => Object.fromEntries([
    ["frame", frame],
    ...fields.map((field) => [field, effect.automation?.[field] ? evaluateCurve(effect.automation[field], frame) : defaults[field]])
  ]));
}

function flattenClipEffects(plan, clip, ducking) {
  const effects = [];
  for (const effect of clip.effects ?? []) {
    const base = { id: effect.id, type: `${effect.definition.id}@${effect.definition.version}` };
    if (effect.definition.id === "time.constant_rate") {
      effects.push({ ...base, rate: effect.parameters.rate, audioPolicy: effect.parameters.audioPolicy });
    } else if (effect.definition.id.startsWith("transform.")) {
      effects.push({
        ...base,
        startFrame: effect.range.startFrame,
        durationFrames: effect.range.durationFrames,
        keyframes: effectKeyframes(effect, ["scale", "x", "y", "rotationDeg"], { scale: effect.parameters.overscanScale ?? 1, x: 0, y: 0, rotationDeg: 0 })
      });
    } else if (effect.definition.id === "filter.blur") {
      effects.push({
        ...base,
        startFrame: effect.range.startFrame,
        durationFrames: effect.range.durationFrames,
        keyframes: effectKeyframes(effect, ["radiusPx"], { radiusPx: 0 })
      });
    } else if (effect.definition.id === "color.basic" || effect.definition.id === "look.vignette") {
      effects.push({ ...base, ...effect.parameters });
    }
  }

  if (ducking?.curve?.points?.length) {
    const keyframes = ducking.curve.points.map((point) => ({
      frame: ticksToFrame(point.tick, plan.project.sampleRate, plan.project.fps),
      gainDb: point.value
    })).filter((point, index, all) => index === 0 || point.frame !== all[index - 1].frame);
    effects.push({
      id: "fx-music-duck-demo",
      type: "mix.music_duck@1",
      startFrame: 0,
      durationFrames: clip.durationFrames,
      keyframes
    });
  }
  return effects;
}

export function compileDemoPlan(input) {
  const normalized = normalizeEffectPlan(input);
  if (!normalized.ok) return { ok: false, diagnostics: normalized.diagnostics };
  if (normalized.plan.clips.length !== 1) {
    return { ok: false, diagnostics: [{ code: "DEMO_REQUIRES_ONE_CLIP", severity: "error", path: "clips", message: "The standalone FFmpeg demo supports exactly one clip" }] };
  }

  const clip = normalized.plan.clips[0];
  const audio = normalized.plan.audio;
  const sampleRate = normalized.plan.project.sampleRate;
  const ducking = audio ? generateMusicDuckingAutomation({
    activityRanges: audio.dialogueActivity,
    attenuationDb: audio.musicDuck.attenuationDb,
    floorDb: -30,
    attackTicks: millisecondsToTicks(audio.musicDuck.attackMs, sampleRate),
    releaseTicks: millisecondsToTicks(audio.musicDuck.releaseMs, sampleRate),
    preRollTicks: millisecondsToTicks(audio.musicDuck.preRollMs, sampleRate),
    postRollTicks: millisecondsToTicks(audio.musicDuck.postRollMs, sampleRate),
    mergeGapTicks: millisecondsToTicks(audio.musicDuck.mergeGapMs, sampleRate),
    minTick: "0",
    maxTick: String(audio.durationTicks)
  }) : null;

  const loweringDiagnostics = ducking ? [{
    code: "MUSIC_BUS_UNAVAILABLE",
    severity: "warning",
    path: "audio.musicDuck",
    message: "Ducking automation was generated but not applied because the fixture has no licensed music-bus asset"
  }] : [];
  const ffmpegInput = {
    width: normalized.plan.project.width,
    height: normalized.plan.project.height,
    fps: normalized.plan.project.fps,
    durationFrames: clip.durationFrames,
    streams: { videoInput: 0, audioInput: 0 },
    effects: flattenClipEffects(normalized.plan, clip, null)
  };
  const ffmpeg = buildFfmpegPlan(ffmpegInput);
  const traceFrames = [...new Set([0, 17, 119, 120, 124, 139, 140, clip.durationFrames - 1])]
    .filter((frame) => frame >= 0 && frame < clip.durationFrames)
    .sort((left, right) => left - right);
  const trace = traceFrames.map((frame) => evaluateClipAt(normalized.plan, clip.id, clip.startFrame + frame));
  const asset = normalized.plan.assets[clip.assetId];
  const source = {
    assetId: clip.assetId,
    path: asset.path,
    seekSeconds: clip.sourceStartFrame / normalized.plan.project.fps,
    inputDurationSeconds: clip.sourceDurationFrames / normalized.plan.project.fps
  };
  const diagnostics = [...normalized.diagnostics, ...(ducking?.diagnostics ?? []), ...loweringDiagnostics, ...ffmpeg.diagnostics];
  const payload = {
    ok: !diagnostics.some((item) => item.severity === "error"),
    planId: normalized.plan.planId,
    registryHash: registryManifest().registryHash,
    source,
    normalizedPlan: normalized.plan,
    audioAutomation: ducking,
    evaluationTrace: trace,
    ffmpeg,
    diagnostics
  };
  return { ...payload, artifactHash: contentHash(payload) };
}

async function main() {
  const fixturePath = process.argv[2] ?? "fixtures/effects/demo-plan.json";
  const input = JSON.parse(await readFile(fixturePath, "utf8"));
  const result = compileDemoPlan(input);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
