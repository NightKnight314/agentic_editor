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
  const frameCount = Math.max(1, Math.round(clip.duration * 30));
  const zoomParts = ["1"];
  if (effects.has("transform.push@1")) zoomParts.push(`0.08*on/${frameCount}`);
  if (effects.has("transform.punch@1")) zoomParts.push(`0.075*max(0,1-abs(on/${frameCount}-0.18)/0.18)`);
  if (effects.has("transform.shake@1")) zoomParts.push("0.025");
  if (zoomParts.length > 1) {
    const zoom = zoomParts.join("+");
    const shakeX = effects.has("transform.shake@1") ? "+sin(on*1.6)*2.5" : "";
    filters.push(`zoompan=z='${zoom}':x='iw/2-iw/zoom/2${shakeX}':y='ih/2-ih/zoom/2':d=1:s=480x854:fps=30`);
  }
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
  const envelope = `volume=${number(volume)},afade=t=out:st=0:d=${number(duration)},adelay=${delay}|${delay}[sfx${index}]`;
  if (cue.assetId?.includes("impact")) return `aevalsrc=exprs='sin(2*PI*(105*t-129.5*t*t))':s=48000:d=${number(duration)},${envelope}`;
  const filter = cue.assetId?.includes("scratch") ? "highpass=f=1400" : "bandpass=f=850:width_type=h:width=700";
  return `anoisesrc=color=white:sample_rate=48000:duration=${number(duration)},${filter},${envelope}`;
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

async function overlayPng(title?: TimelineElement, caption?: TimelineElement) {
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 854;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas overlay renderer is unavailable.");
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (title?.text) {
    const family = title.fontFamily || "Impact";
    await document.fonts.load(`800 42px "${family}"`).catch(() => undefined);
    context.font = `800 42px "${family}", Impact, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    const lines = wrapText(context, title.text.toUpperCase(), 430);
    const lineHeight = 41;
    const firstY = 375 - ((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, index) => {
      const y = firstY + index * lineHeight;
      context.fillStyle = "#e55745";
      context.fillText(line, 246, y);
      context.fillStyle = "#f0ede6";
      context.fillText(line, 240, y);
    });
  }

  if (caption?.text) {
    const family = caption.fontFamily || "Arial";
    await document.fonts.load(`800 28px "${family}"`).catch(() => undefined);
    const words = caption.text.toUpperCase().trim().split(/\s+/);
    let fontSize = 28;
    context.font = `800 ${fontSize}px "${family}", Arial, sans-serif`;
    let widths = words.map((word) => context.measureText(word).width);
    while (fontSize > 20 && widths.reduce((sum, width) => sum + width, 0) + Math.max(0, words.length - 1) * 8 > 420) {
      fontSize -= 1;
      context.font = `800 ${fontSize}px "${family}", Arial, sans-serif`;
      widths = words.map((word) => context.measureText(word).width);
    }
    const totalWidth = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, words.length - 1) * 8;
    let x = (480 - totalWidth) / 2;
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.shadowColor = "rgba(0,0,0,.9)";
    context.shadowBlur = 7;
    context.shadowOffsetY = 3;
    words.forEach((word, index) => {
      context.fillStyle = index === 1 ? "#ff5a45" : "#ffffff";
      context.fillText(word, x, 752);
      x += widths[index] + 8;
    });
    context.shadowColor = "transparent";
  }

  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Unable to encode timeline overlay.")), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

async function buildOverlaySequence(timeline: TimelineDocument) {
  const titles = timeline.tracks.flatMap((track) => track.elements).filter((element) => element.kind === "text");
  const captions = timeline.tracks.flatMap((track) => track.elements).filter((element) => element.kind === "caption");
  if (!titles.length && !captions.length) return null;
  const boundaries = [...new Set([
    0,
    timeline.duration,
    ...titles.flatMap((element) => [element.start, element.start + element.duration]),
    ...captions.flatMap((element) => [element.start, element.start + element.duration])
  ].map((time) => Math.max(0, Math.min(timeline.duration, Number(time.toFixed(3))))))].sort((left, right) => left - right);
  const files = new Map<string, Uint8Array>();
  const manifest: string[] = ["ffconcat version 1.0"];
  let lastName = "";
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    if (end - start < 0.005) continue;
    const midpoint = start + (end - start) / 2;
    const title = titles.find((element) => midpoint >= element.start && midpoint < element.start + element.duration);
    const caption = captions.find((element) => midpoint >= element.start && midpoint < element.start + element.duration);
    const key = `${title?.id ?? "none"}-${caption?.id ?? "none"}`;
    const name = `overlay-${key.replaceAll(/[^a-z0-9-]/gi, "-")}.png`;
    if (!files.has(name)) files.set(name, await overlayPng(title, caption));
    manifest.push(`file '${name}'`, `duration ${number(end - start)}`);
    lastName = name;
  }
  if (lastName) manifest.push(`file '${lastName}'`);
  return { files, manifest: new TextEncoder().encode(`${manifest.join("\n")}\n`) };
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
  const overlayFiles: string[] = [];
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
    const overlays = await buildOverlaySequence(timeline);
    let overlayInputIndex: number | null = null;
    if (overlays) {
      for (const [name, data] of overlays.files) {
        await ffmpeg.writeFile(name, data);
        overlayFiles.push(name);
      }
      await ffmpeg.writeFile("overlays.ffconcat", overlays.manifest);
      overlayFiles.push("overlays.ffconcat");
      overlayInputIndex = 1 + extraInputs.length;
    }
    const chains = clips.flatMap((clip, index) => [videoChain(clip, index), audioChain(clip, index)]);
    const concatInputs = clips.map((_, index) => `[v${index}][a${index}]`).join("");
    const hasSfx = sfxCues.length > 0;
    chains.push(`${concatInputs}concat=n=${clips.length}:v=1:a=1[videoBase][${hasSfx ? "dialogue" : "aout"}]`);
    if (overlayInputIndex !== null) chains.push(`[${overlayInputIndex}:v]fps=30,format=rgba[overlaySequence]`, `[videoBase][overlaySequence]overlay=0:0:eof_action=pass[vout]`);
    else chains.push("[videoBase]null[vout]");
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
    const inputArgs = [
      "-i", inputName,
      ...extraInputs.flatMap((item) => ["-i", item.name]),
      ...(overlayInputIndex !== null ? ["-f", "concat", "-safe", "0", "-i", "overlays.ffconcat"] : [])
    ];
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
      "-t", number(timeline.duration),
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
    for (const name of overlayFiles) await ffmpeg.deleteFile(name).catch(() => undefined);
    await ffmpeg.deleteFile(outputName).catch(() => undefined);
    ffmpeg.terminate();
  }
}
