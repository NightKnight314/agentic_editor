import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { timelineFromAnalysis } from "../src/lib/analysis/timeline.ts";

const analysis = JSON.parse(await readFile("analysis/kiro_sample_video.json", "utf8"));
const timeline = timelineFromAnalysis(analysis);
const primary = timeline.tracks.find((track) => track.id === "v1").elements;
const titles = timeline.tracks.find((track) => track.id === "g1").elements;
const sfx = timeline.tracks.find((track) => track.id === "a3").elements;
const sourceTitles = analysis.analysis.timeline.segments
  .map((segment) => segment.title?.replace(/\s+/g, " ").trim().split(" ").slice(0, 7).join(" ").toUpperCase())
  .filter(Boolean);

assert.ok(timeline.duration >= 30 && timeline.duration <= 60, "Kumar draft must be 30–60 seconds");
assert.equal(primary[0].start, 0, "Hook must start at frame zero");
assert.deepEqual(titles.map((title) => title.text), sourceTitles, "Compiler must not inject titles absent from the analysis");
assert.ok(primary.every((clip) => clip.sourceStart >= 0 && clip.sourceStart + clip.duration <= analysis.transcript.duration + 0.1), "All clips must stay in source bounds");
assert.ok(primary.every((clip) => clip.effects.length <= 3), "Effect budget is capped at three effects per primary clip");
assert.ok(primary.length >= 18, "Silence removal must create enough semantic jump cuts");
assert.ok(sfx.length >= 4, "Major story beats must receive SFX cues");

process.stdout.write(`${JSON.stringify({
  duration: timeline.duration,
  primaryClips: primary.length,
  sfxCues: sfx.length,
  captions: timeline.tracks.find((track) => track.id === "c1").elements.length,
  titles: titles.map((title) => title.text)
}, null, 2)}\n`);
