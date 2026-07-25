import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";

const sourcePath = process.argv[2] ?? "videos/kiro_sample_video.mp4";
const endpoint = process.env.ANALYZE_URL ?? "http://127.0.0.1:3000/api/analyze";
const frameCount = 12;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}: ${stderr.slice(-2_000)}`)));
  });
}

async function probeDuration(path) {
  const chunks = [];
  await new Promise((resolve, reject) => {
    const child = spawn(ffprobe.path, ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path]);
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`ffprobe exited ${code}`)));
  });
  return Number(Buffer.concat(chunks).toString().trim());
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), "nighthack-analysis-"));
try {
  const duration = await probeDuration(sourcePath);
  const audioPath = join(temporaryDirectory, "analysis-audio.mp3");
  const framesPattern = join(temporaryDirectory, "frame-%02d.jpg");
  process.stdout.write(`Preparing ${duration.toFixed(1)}s source locally...\n`);

  await run(ffmpegPath, ["-y", "-i", sourcePath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "32k", audioPath]);
  await run(ffmpegPath, ["-y", "-i", sourcePath, "-vf", `fps=${frameCount}/${duration},scale=420:-1`, "-frames:v", String(frameCount), "-q:v", "4", framesPattern]);

  const frames = [];
  for (let index = 1; index <= frameCount; index += 1) {
    const path = join(temporaryDirectory, `frame-${String(index).padStart(2, "0")}.jpg`);
    const data = await readFile(path);
    frames.push({
      time: duration * ((index - 0.5) / frameCount),
      dataUrl: `data:image/jpeg;base64,${data.toString("base64")}`
    });
  }

  const audio = await readFile(audioPath);
  const form = new FormData();
  form.set("audio", new File([audio], "analysis-audio.mp3", { type: "audio/mpeg" }));
  form.set("frames", JSON.stringify(frames));
  form.set("duration", String(duration));
  form.set("name", sourcePath.split("/").at(-1) ?? "sample.mp4");
  form.set("brief", "Create a catchy, cinematic 30 to 60 second short in the Kumar Method style. Prioritize a strong character-led hook, clear escalation, proof, a humanizing beat, and a clean open-loop ending.");

  process.stdout.write(`Sending ${(audio.byteLength / 1024 / 1024).toFixed(2)} MB audio and ${frames.length} frames to ${endpoint}...\n`);
  const response = await fetch(endpoint, { method: "POST", body: form });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `Analysis request failed with ${response.status}`);

  await mkdir("analysis", { recursive: true });
  const outputPath = "analysis/kiro_sample_video.json";
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
  process.stdout.write(`Saved ${payload.analysis.events.length} events and ${payload.analysis.timeline.segments.length} timeline clips to ${outputPath}.\n`);
  process.stdout.write(`Estimated OpenAI cost: $${payload.usage.estimatedCostUsd.toFixed(4)}\n`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
