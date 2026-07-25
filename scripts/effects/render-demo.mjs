#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ffmpegPath from "ffmpeg-static";
import { compileDemoPlan } from "./compile-demo.mjs";

async function ensureAbsent(path) {
  try {
    await access(path, constants.F_OK);
    throw new Error(`Refusing to overwrite existing output: ${path}`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

export async function renderDemo(fixturePath, outputPath) {
  const input = JSON.parse(await readFile(fixturePath, "utf8"));
  const compiled = compileDemoPlan(input);
  if (!compiled.ok) throw new Error(`Effect plan did not compile: ${JSON.stringify(compiled.diagnostics)}`);

  const absoluteOutput = resolve(outputPath);
  await ensureAbsent(absoluteOutput);
  const sourcePath = resolve(compiled.source.path);
  const args = [
    "-hide_banner",
    "-loglevel", "error",
    "-n",
    "-ss", String(compiled.source.seekSeconds),
    "-t", String(compiled.source.inputDurationSeconds),
    "-i", sourcePath,
    ...compiled.ffmpeg.args,
    "-frames:v", String(compiled.normalizedPlan.clips[0].durationFrames),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "22",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "160k",
    "-movflags", "+faststart",
    "-shortest",
    absoluteOutput
  ];

  await new Promise((accept, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "inherit", "inherit"] });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? accept() : reject(new Error(`FFmpeg exited with ${code ?? signal}`)));
  });
  return { outputPath: absoluteOutput, planId: compiled.planId, artifactHash: compiled.artifactHash };
}

async function main() {
  const fixturePath = process.argv[2] ?? "fixtures/effects/demo-plan.json";
  const outputPath = process.argv[3];
  if (!outputPath) throw new Error("Usage: node scripts/effects/render-demo.mjs <fixture.json> <new-output.mp4>");
  const result = await renderDemo(fixturePath, outputPath);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
