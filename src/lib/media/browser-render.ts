"use client";

import type { TimelineDocument, TimelineElement } from "@/lib/editor/types";
import { canonicalEffectId } from "@/lib/effects/catalog";
import { loadWorkspaceFile } from "@/lib/storage/project-store";

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

function generatedSfxChain(cue: TimelineElement, index: number) {
  const duration = Math.max(0.12, cue.duration);
  const delay = Math.max(0, Math.round(cue.start * 1000));
  const volume = cue.volume ?? 0.5;
  const frequency = cue.assetId?.includes("impact") ? 82 : cue.assetId?.includes("scratch") ? 1320 : 620;
  return `sine=frequency=${frequency}:sample_rate=48000:duration=${number(duration)},volume=${number(volume)},afade=t=out:st=0:d=${number(duration)},adelay=${delay}|${delay}[sfx${index}]`;
}

export async function renderTimelineMp4(file: File, timeline: TimelineDocument, onProgress: (progress: number) => void) {
  const clips = timeline.tracks.find((track) => track.id === "v1")?.elements
    .filter((element) => element.kind === "video" && element.duration > 0.1)
    .sort((left, right) => left.start - right.start) ?? [];
  if (!clips.length) throw new Error("The primary video track has no renderable clips.");
  const sfxCues = timeline.tracks.find((track) => track.id === "a3")?.elements
    .filter((element) => element.kind === "audio" && element.duration > 0.05)
    .sort((left, right) => left.start - right.start) ?? [];

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
  const extraInputs: Array<{ cue: TimelineElement; name: string; inputIndex: number }> = [];
  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    for (const cue of sfxCues) {
      if (!cue.assetId?.startsWith("global:")) continue;
      const sfxFile = await loadWorkspaceFile(cue.assetId);
      if (!sfxFile) continue;
      const extension = sfxFile.name.split(".").at(-1)?.replaceAll(/[^a-z0-9]/gi, "").toLowerCase() || "wav";
      const name = `nightcut-sfx-${extraInputs.length}.${extension}`;
      await ffmpeg.writeFile(name, await fetchFile(sfxFile));
      extraInputs.push({ cue, name, inputIndex: extraInputs.length + 1 });
    }
    const chains = clips.flatMap((clip, index) => [videoChain(clip, index), audioChain(clip, index)]);
    const concatInputs = clips.map((_, index) => `[v${index}][a${index}]`).join("");
    const hasSfx = sfxCues.length > 0;
    chains.push(`${concatInputs}concat=n=${clips.length}:v=1:a=1[vout][${hasSfx ? "dialogue" : "aout"}]`);
    const sfxLabels: string[] = [];
    sfxCues.forEach((cue, index) => {
      const imported = extraInputs.find((item) => item.cue.id === cue.id);
      const delay = Math.max(0, Math.round(cue.start * 1000));
      if (imported) {
        chains.push(`[${imported.inputIndex}:a]atrim=start=0:end=${number(cue.duration)},asetpts=PTS-STARTPTS,volume=${number(cue.volume ?? 0.5)},afade=t=out:st=0:d=${number(cue.duration)},adelay=${delay}|${delay}[sfx${index}]`);
      } else {
        chains.push(generatedSfxChain(cue, index));
      }
      sfxLabels.push(`[sfx${index}]`);
    });
    if (hasSfx) chains.push(`[dialogue]${sfxLabels.join("")}amix=inputs=${sfxLabels.length + 1}:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[aout]`);
    const inputArgs = ["-i", inputName, ...extraInputs.flatMap((item) => ["-i", item.name])];
    const exitCode = await ffmpeg.exec([
      ...inputArgs,
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
    for (const input of extraInputs) await ffmpeg.deleteFile(input.name).catch(() => undefined);
    await ffmpeg.deleteFile(outputName).catch(() => undefined);
    ffmpeg.terminate();
  }
}
