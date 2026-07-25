"use client";

import type { TimelineDocument, TimelineElement } from "@/lib/editor/types";
import { canonicalEffectId } from "@/lib/effects/catalog";

const CORE_BASE_URL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm";

function number(value: number) {
  return Number(value.toFixed(3)).toString();
}

function videoChain(clip: TimelineElement, index: number) {
  const start = clip.sourceStart ?? 0;
  const end = start + clip.duration;
  const effects = new Set((clip.effects ?? []).map(canonicalEffectId));
  const filters = [
    `trim=start=${number(start)}:end=${number(end)}`,
    "setpts=PTS-STARTPTS",
    "fps=30",
    "scale=480:854:force_original_aspect_ratio=increase:flags=bilinear",
    "crop=480:854"
  ];
  if (effects.has("transform.push@1")) filters.push("scale=500:889,crop=480:854");
  if (effects.has("transform.punch@1")) filters.push("scale=518:922,crop=480:854");
  if (effects.has("color.basic@1")) filters.push("eq=brightness=-0.02:contrast=1.12:saturation=0.92", "colorbalance=rs=0.012:bs=-0.012");
  if (effects.has("look.vignette@1")) filters.push("vignette=angle=PI/4");
  return `[0:v]${filters.join(",")}[v${index}]`;
}

function audioChain(clip: TimelineElement, index: number) {
  const start = clip.sourceStart ?? 0;
  const end = start + clip.duration;
  return `[0:a]atrim=start=${number(start)}:end=${number(end)},asetpts=PTS-STARTPTS[a${index}]`;
}

export async function renderTimelineMp4(file: File, timeline: TimelineDocument, onProgress: (progress: number) => void) {
  const clips = timeline.tracks.find((track) => track.id === "v1")?.elements
    .filter((element) => element.kind === "video" && element.duration > 0.1)
    .sort((left, right) => left.start - right.start) ?? [];
  if (!clips.length) throw new Error("The primary video track has no renderable clips.");

  const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
    import("@ffmpeg/ffmpeg"),
    import("@ffmpeg/util")
  ]);
  const ffmpeg = new FFmpeg();
  const progressHandler = ({ progress }: { progress: number }) => onProgress(Math.max(0, Math.min(1, progress)));
  ffmpeg.on("progress", progressHandler);
  await ffmpeg.load({
    classWorkerURL: new URL("/ffmpeg-worker.js", window.location.href).href,
    coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm")
  });

  const inputName = "nightcut-source.mp4";
  const outputName = "nightcut-export.mp4";
  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    const chains = clips.flatMap((clip, index) => [videoChain(clip, index), audioChain(clip, index)]);
    const concatInputs = clips.map((_, index) => `[v${index}][a${index}]`).join("");
    chains.push(`${concatInputs}concat=n=${clips.length}:v=1:a=1[vout][aout]`);
    const exitCode = await ffmpeg.exec([
      "-i", inputName,
      "-filter_complex", chains.join(";"),
      "-map", "[vout]",
      "-map", "[aout]",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "24",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      outputName
    ]);
    if (exitCode !== 0) throw new Error(`Renderer exited with code ${exitCode}.`);
    const output = await ffmpeg.readFile(outputName);
    if (typeof output === "string") throw new Error("Renderer returned an invalid MP4 payload.");
    return new Blob([new Uint8Array(output)], { type: "video/mp4" });
  } finally {
    ffmpeg.off("progress", progressHandler);
    await ffmpeg.deleteFile(inputName).catch(() => undefined);
    await ffmpeg.deleteFile(outputName).catch(() => undefined);
    ffmpeg.terminate();
  }
}
