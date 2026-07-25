import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { timelineFromAnalysis } from "../src/lib/analysis/timeline.ts";

const analysis = JSON.parse(await readFile("analysis/kiro_sample_video.json", "utf8"));
const timeline = timelineFromAnalysis(analysis);
const primary = timeline.tracks.find((track) => track.id === "v1").elements;
const titles = timeline.tracks.find((track) => track.id === "g1").elements;

assert.ok(timeline.duration >= 30 && timeline.duration <= 60, "Kumar draft must be 30–60 seconds");
assert.equal(primary[0].start, 0, "Hook must start at frame zero");
assert.ok(primary[1].start <= 3, "Hook promise must begin within three seconds");
assert.ok(primary.find((clip) => clip.id === "e03").start <= 8.5, "First numbered bet must arrive by 8.5 seconds");
assert.equal(titles[0].text, "3 MARKETS I'D BET ON");
assert.ok(titles.every((title) => !title.text.includes("MIT")), "Rendered titles must omit unverified MIT copy");
assert.ok(titles.some((title) => title.text === "WHAT I ACTUALLY USE"), "Human release must be visible");
assert.equal(titles.at(-1).text, "WHAT ARE YOU BUILDING?", "CTA must close the edit");
assert.ok(primary.every((clip) => clip.sourceStart >= 0 && clip.sourceStart + clip.duration <= analysis.transcript.duration + 0.1), "All clips must stay in source bounds");
assert.ok(primary.every((clip) => clip.effects.length <= 3), "Effect budget is capped at three effects per primary clip");

process.stdout.write(`${JSON.stringify({
  duration: timeline.duration,
  hookPromiseAt: primary[1].start,
  firstBetAt: primary.find((clip) => clip.id === "e03").start,
  primaryClips: primary.length,
  captions: timeline.tracks.find((track) => track.id === "c1").elements.length,
  titles: titles.map((title) => title.text)
}, null, 2)}\n`);
