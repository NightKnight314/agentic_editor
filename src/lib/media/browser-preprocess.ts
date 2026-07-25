"use client";

import type { SampledFrame } from "@/lib/analysis/schema";

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
}

export interface PreprocessResult {
  audio: File;
  frames: SampledFrame[];
  metadata: VideoMetadata;
}

export interface PreprocessProgress {
  stage: "metadata" | "frames" | "engine" | "audio" | "ready";
  progress: number;
  message: string;
}

type ProgressListener = (progress: PreprocessProgress) => void;

const CORE_VERSION = "0.12.10";
const CORE_BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`;

function waitForEvent(target: EventTarget, event: string, errorEvent = "error") {
  return new Promise<void>((resolve, reject) => {
    const done = () => {
      target.removeEventListener(event, done);
      target.removeEventListener(errorEvent, fail);
      resolve();
    };
    const fail = () => {
      target.removeEventListener(event, done);
      target.removeEventListener(errorEvent, fail);
      reject(new Error(`Media failed while waiting for ${event}.`));
    };
    target.addEventListener(event, done, { once: true });
    target.addEventListener(errorEvent, fail, { once: true });
  });
}

async function openVideo(file: File) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  await waitForEvent(video, "loadedmetadata");
  return { video, url };
}

async function sampleFrames(file: File, count: number, onProgress: ProgressListener) {
  const { video, url } = await openVideo(file);
  const metadata: VideoMetadata = {
    duration: video.duration,
    width: video.videoWidth,
    height: video.videoHeight
  };
  const targetWidth = Math.min(420, video.videoWidth || 420);
  const targetHeight = Math.max(1, Math.round(targetWidth * (video.videoHeight / video.videoWidth)));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas is unavailable for frame sampling.");

  const frames: SampledFrame[] = [];
  try {
    for (let index = 0; index < count; index += 1) {
      const time = Math.min(metadata.duration - 0.05, metadata.duration * ((index + 0.5) / count));
      video.currentTime = Math.max(0, time);
      await waitForEvent(video, "seeked");
      context.drawImage(video, 0, 0, targetWidth, targetHeight);
      frames.push({ time, dataUrl: canvas.toDataURL("image/jpeg", 0.58) });
      onProgress({ stage: "frames", progress: (index + 1) / count, message: `Sampling visual context ${index + 1}/${count}` });
    }
    return { frames, metadata };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

async function extractAudio(file: File, onProgress: ProgressListener) {
  onProgress({ stage: "engine", progress: 0, message: "Loading local media engine" });
  const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
    import("@ffmpeg/ffmpeg"),
    import("@ffmpeg/util")
  ]);
  const ffmpeg = new FFmpeg();
  await ffmpeg.load({
    classWorkerURL: new URL("/ffmpeg-worker.js", window.location.href).href,
    coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, "application/wasm")
  });

  const inputName = "source-input.mp4";
  const outputName = "analysis-audio.mp3";
  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress({ stage: "audio", progress: Math.max(0, Math.min(1, progress)), message: "Extracting compact speech audio locally" });
  };
  ffmpeg.on("progress", progressHandler);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    const exitCode = await ffmpeg.exec([
      "-i", inputName,
      "-vn",
      "-ac", "1",
      "-ar", "16000",
      "-c:a", "libmp3lame",
      "-b:a", "32k",
      outputName
    ]);
    if (exitCode !== 0) throw new Error(`Local audio extraction exited with code ${exitCode}.`);
    const output = await ffmpeg.readFile(outputName);
    if (typeof output === "string") throw new Error("Media engine returned an invalid audio payload.");
    const bytes = new Uint8Array(output);
    return new File([bytes.buffer], outputName, { type: "audio/mpeg" });
  } finally {
    ffmpeg.off("progress", progressHandler);
    await ffmpeg.deleteFile(inputName).catch(() => undefined);
    await ffmpeg.deleteFile(outputName).catch(() => undefined);
    ffmpeg.terminate();
  }
}

export async function preprocessVideo(file: File, onProgress: ProgressListener): Promise<PreprocessResult> {
  onProgress({ stage: "metadata", progress: 0, message: "Reading video metadata" });
  const maxFrames = 12;
  const { frames, metadata } = await sampleFrames(file, maxFrames, onProgress);
  const audio = await extractAudio(file, onProgress);
  onProgress({ stage: "ready", progress: 1, message: "Media prepared for agent analysis" });
  return { audio, frames, metadata };
}
