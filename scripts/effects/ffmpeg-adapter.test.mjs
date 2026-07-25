import assert from "node:assert/strict";
import test from "node:test";

import {buildFfmpegPlan} from "./ffmpeg-adapter.mjs";

const basePlan = () => ({
  width: 1080,
  height: 1920,
  fps: 30,
  durationFrames: 300,
  effects: []
});

test("builds the minimal deterministic video/audio graph", () => {
  const plan = basePlan();
  const first = buildFfmpegPlan(plan);
  const second = buildFfmpegPlan(plan);

  assert.deepEqual(first, second);
  assert.equal(first.filterComplex,
    "[0:v]setpts=PTS-STARTPTS,fps=30,scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920[vout];[0:a]anull[aout]");
  assert.deepEqual(first.args, [
    "-filter_complex", first.filterComplex,
    "-map", "[vout]",
    "-map", "[aout]"
  ]);
  assert.equal(first.videoLabel, "vout");
  assert.equal(first.audioLabel, "aout");
  assert.deepEqual(first.diagnostics, []);
});

test("lowers the narrow P0 stack in canonical stage order", () => {
  const plan = {
    ...basePlan(),
    streams: {videoInput: 2, audioInput: 3},
    effects: [
      {
        id: "duck",
        type: "mix.music_duck@1",
        startFrame: 30,
        durationFrames: 90,
        keyframes: [
          {frame: 0, gainDb: 0},
          {frame: 10, gainDb: -12},
          {frame: 70, gainDb: 0}
        ]
      },
      {id: "look", type: "look.vignette@1", amount: 0.3, softness: 0.7},
      {
        id: "push",
        type: "transform.push@1",
        startFrame: 0,
        durationFrames: 120,
        keyframes: [
          {frame: 0, scale: 1, x: 0, y: 0},
          {frame: 119, scale: 1.1, x: 0.04, y: -0.03}
        ]
      },
      {id: "rate", type: "time.constant_rate@1", rate: 1.25, audioPolicy: "linked_pitch_preserve"},
      {
        id: "blur",
        type: "filter.blur@1",
        startFrame: 15,
        durationFrames: 20,
        keyframes: [
          {frame: 0, radiusPx: 8},
          {frame: 4, radiusPx: 2},
          {frame: 8, radiusPx: 0}
        ]
      },
      {id: "grade", type: "color.basic@1", brightness: 0.03, contrast: 1.1, saturation: 0.9, warmth: 0.2},
      {
        id: "gain",
        type: "audio.gain_fade@1",
        gainDb: -3,
        fadeInFrames: 6,
        fadeOutFrames: 12
      }
    ]
  };

  const result = buildFfmpegPlan(plan);
  assert.equal(result.diagnostics.some((item) => item.severity === "error"), false);
  assert.match(result.filterComplex, /^\[2:v\]setpts=\(PTS-STARTPTS\)\/1\.25,fps=30,/);
  assert.match(result.filterComplex, /zoompan=z='/);
  assert.match(result.filterComplex, /gblur=sigma=8:steps=2/);
  assert.match(result.filterComplex, /eq=brightness=0\.03:contrast=1\.1:saturation=0\.9/);
  assert.match(result.filterComplex, /colorbalance=rs=0\.03/);
  assert.match(result.filterComplex, /vignette=angle=/);
  assert.match(result.filterComplex, /\[3:a\]atrim=start=0,asetpts=PTS-STARTPTS,atempo=1\.25,volume=-3dB/);
  assert.match(result.filterComplex, /afade=t=in:st=0:d=0\.2/);
  assert.match(result.filterComplex, /volume='if\(between\(t\\,1\\,1\.333333\)/);

  const zoom = result.filterComplex.indexOf("zoompan=");
  const blur = result.filterComplex.indexOf("gblur=");
  const color = result.filterComplex.indexOf("eq=brightness");
  const vignette = result.filterComplex.indexOf("vignette=");
  assert.ok(zoom < blur && blur < color && color < vignette);
  assert.deepEqual(result.diagnostics.map((item) => item.code), [
    "APPROXIMATE_BLUR_BINDING",
    "APPROXIMATE_COLOR_BINDING",
    "APPROXIMATE_VIGNETTE_BINDING"
  ]);
});

test("effect array order does not change stage-sorted filter output", () => {
  const color = {id: "color", type: "color.basic@1", brightness: 0, contrast: 1.1, saturation: 1, warmth: 0};
  const blur = {id: "blur", type: "filter.blur@1", keyframes: [{frame: 0, radiusPx: 3}]};
  const first = buildFfmpegPlan({...basePlan(), effects: [color, blur]});
  const second = buildFfmpegPlan({...basePlan(), effects: [blur, color]});

  assert.equal(first.filterComplex, second.filterComplex);
  assert.ok(first.filterComplex.indexOf("gblur=") < first.filterComplex.indexOf("eq=brightness"));
});

test("does not mutate deeply frozen input", () => {
  const plan = deepFreeze({
    ...basePlan(),
    effects: [{
      id: "punch",
      type: "transform.punch@1",
      durationFrames: 12,
      keyframes: [
        {frame: 0, scale: 1, x: 0, y: 0},
        {frame: 5, scale: 1.12, x: 0.03, y: 0},
        {frame: 11, scale: 1.06, x: 0, y: 0}
      ]
    }]
  });

  const result = buildFfmpegPlan(plan);
  assert.equal(result.diagnostics.some((item) => item.severity === "error"), false);
  assert.match(result.filterComplex, /zoompan=/);
});

test("rejects unknown fields and expression injection without executable args", () => {
  const result = buildFfmpegPlan({
    ...basePlan(),
    effects: [{
      id: "grade",
      type: "color.basic@1",
      brightness: 0,
      contrast: 1,
      saturation: 1,
      warmth: 0,
      filter: "movie=secret.mp4"
    }]
  });

  assert.equal(result.filterComplex, "");
  assert.deepEqual(result.args, []);
  assert.ok(result.diagnostics.some((item) => item.code === "UNKNOWN_FIELD" && item.path.endsWith(".filter")));
});

test("rejects non-monotonic keyframes, rotation, and insufficient overscan", () => {
  const result = buildFfmpegPlan({
    ...basePlan(),
    effects: [{
      id: "shake",
      type: "transform.shake@1",
      durationFrames: 10,
      keyframes: [
        {frame: 0, scale: 1, x: 0.1, y: 0, rotationDeg: 1},
        {frame: 0, scale: 1.1, x: 0, y: 0}
      ]
    }]
  });

  const codes = new Set(result.diagnostics.map((item) => item.code));
  assert.ok(codes.has("ROTATION_UNSUPPORTED"));
  assert.ok(codes.has("TRANSFORM_EXPOSES_EDGE"));
  assert.ok(codes.has("NON_MONOTONIC_KEYFRAMES"));
  assert.deepEqual(result.args, []);
});

test("supports silent video-only output and reports audio-target mistakes", () => {
  const videoOnly = buildFfmpegPlan({...basePlan(), streams: {audioInput: null}});
  assert.equal(videoOnly.audioLabel, null);
  assert.doesNotMatch(videoOnly.filterComplex, /aout|\[0:a\]/);
  assert.deepEqual(videoOnly.args.slice(-2), ["-map", "[vout]"]);

  const invalid = buildFfmpegPlan({
    ...basePlan(),
    streams: {audioInput: null},
    effects: [{id: "gain", type: "audio.gain_fade@1", gainDb: -2, fadeInFrames: 0, fadeOutFrames: 0}]
  });
  assert.ok(invalid.diagnostics.some((item) => item.code === "MISSING_AUDIO_STREAM"));
  assert.deepEqual(invalid.args, []);
});

test("rate policies are bounded and explicit", () => {
  const muted = buildFfmpegPlan({
    ...basePlan(),
    effects: [{id: "rate", type: "time.constant_rate@1", rate: 3, audioPolicy: "mute"}]
  });
  assert.equal(muted.diagnostics.some((item) => item.severity === "error"), false);
  assert.match(muted.filterComplex, /atrim=start=0:duration=10,asetpts=PTS-STARTPTS,volume=0/);

  const pitchPreserved = buildFfmpegPlan({
    ...basePlan(),
    effects: [{id: "rate", type: "time.constant_rate@1", rate: 3, audioPolicy: "linked_pitch_preserve"}]
  });
  assert.ok(pitchPreserved.diagnostics.some((item) => item.code === "AUDIO_RATE_UNSUPPORTED"));
  assert.deepEqual(pitchPreserved.args, []);

  const detached = buildFfmpegPlan({
    ...basePlan(),
    effects: [{id: "rate", type: "time.constant_rate@1", rate: 1.5, audioPolicy: "detach"}]
  });
  assert.ok(detached.diagnostics.some((item) => item.code === "DETACHED_AUDIO_RETIME" && item.severity === "warning"));
});

function deepFreeze(value) {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}
