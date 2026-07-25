"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import type { TimelineDocument } from "@/lib/editor/types";
import { canonicalEffectId } from "@/lib/effects/catalog";
import type { GlobalAsset } from "@/lib/assets/catalog";
import { loadWorkspaceFile } from "@/lib/storage/project-store";

interface PreviewMonitorProps {
  timeline: TimelineDocument;
  playhead: number;
  playing: boolean;
  assetUrl?: string;
  globalAssets: GlobalAsset[];
  onTogglePlaying: () => void;
  onDuration: (duration: number) => void;
}

function playGeneratedSfx(assetId: string, volume: number) {
  const AudioContextClass = window.AudioContext;
  const context = new AudioContextClass();
  const gain = context.createGain();
  gain.gain.setValueAtTime(Math.max(0.01, volume), context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + (assetId.includes("scratch") ? 0.38 : 0.22));
  gain.connect(context.destination);
  if (assetId.includes("impact")) {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(105, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(48, context.currentTime + 0.2);
    oscillator.connect(gain);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.22);
  } else {
    const length = Math.floor(context.sampleRate * (assetId.includes("scratch") ? 0.38 : 0.2));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    filter.type = assetId.includes("scratch") ? "highpass" : "bandpass";
    filter.frequency.value = assetId.includes("scratch") ? 1400 : 850;
    source.buffer = buffer;
    source.connect(filter).connect(gain);
    source.start();
  }
  window.setTimeout(() => void context.close(), 600);
}

const formatTime = (seconds: number, fps = 30) => {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const frames = Math.floor((safe % 1) * fps);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
};

export function PreviewMonitor({ timeline, playhead, playing, assetUrl, globalAssets, onTogglePlaying, onDuration }: PreviewMonitorProps) {
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const activeBufferRef = useRef<0 | 1>(0);
  const preparedClipIdsRef = useRef<Array<string | null>>([null, null]);
  const previousClipIdRef = useRef<string | null>(null);
  const [activeBuffer, setActiveBuffer] = useState<0 | 1>(0);
  const previousPlayheadRef = useRef(playhead);
  const lastSfxRef = useRef<string | null>(null);
  const activeText = useMemo(
    () => timeline.tracks.flatMap((track) => track.elements).filter((element) => element.kind === "text").find((element) => playhead >= element.start && playhead < element.start + element.duration),
    [timeline, playhead]
  );
  const activeCaption = useMemo(
    () => timeline.tracks.flatMap((track) => track.elements).filter((element) => element.kind === "caption").find((element) => playhead >= element.start && playhead < element.start + element.duration),
    [timeline, playhead]
  );
  const primaryClips = useMemo(
    () => timeline.tracks.find((track) => track.id === "v1")?.elements.filter((element) => element.kind === "video").sort((a, b) => a.start - b.start) ?? [],
    [timeline]
  );
  const activeClip = useMemo(
    () => primaryClips.find((element) => playhead >= element.start && playhead < element.start + element.duration),
    [playhead, primaryClips]
  );
  const sfxCues = useMemo(
    () => timeline.tracks.find((track) => track.id === "a3")?.elements.filter((element) => element.kind === "audio").sort((a, b) => a.start - b.start) ?? [],
    [timeline]
  );
  const previewStyle = useMemo<CSSProperties>(() => {
    if (!activeClip) return {};
    const effects = new Set((activeClip.effects ?? []).map(canonicalEffectId));
    const progress = Math.max(0, Math.min(1, (playhead - activeClip.start) / Math.max(0.01, activeClip.duration)));
    let scale = 1;
    let x = 0;
    let rotation = 0;
    if (effects.has("transform.push@1")) scale *= 1 + progress * 0.08;
    if (effects.has("transform.punch@1")) scale *= 1 + Math.max(0, 1 - Math.abs(progress - 0.18) / 0.18) * 0.075;
    if (effects.has("transform.shake@1")) {
      x = Math.sin(playhead * 48) * 2.5;
      rotation = Math.sin(playhead * 31) * 0.35;
      scale *= 1.025;
    }
    const filters = [];
    if (effects.has("filter.blur@1")) filters.push(`blur(${Math.max(0, 8 - progress * 32)}px)`);
    if (effects.has("color.basic@1")) filters.push("contrast(1.12) saturate(.92) sepia(.07)");
    return { transform: `translateX(${x}px) rotate(${rotation}deg) scale(${scale})`, filter: filters.join(" ") || undefined };
  }, [activeClip, playhead]);
  const hasVignette = useMemo(() => (activeClip?.effects ?? []).map(canonicalEffectId).includes("look.vignette@1"), [activeClip]);
  const videos = () => [videoARef.current, videoBRef.current] as const;

  const seekWhenReady = (video: HTMLVideoElement, time: number, shouldPlay = false) => {
    const seek = () => {
      video.currentTime = Math.max(0, time);
      if (shouldPlay) void video.play().catch(() => undefined);
    };
    if (video.readyState >= 1) seek();
    else video.addEventListener("loadedmetadata", seek, { once: true });
  };

  const warmBuffer = (video: HTMLVideoElement, time: number) => {
    const warm = () => {
      video.muted = true;
      video.currentTime = Math.max(0, time);
      const hold = () => {
        video.pause();
        if (Math.abs(video.currentTime - time) > 0.08) video.currentTime = time;
      };
      if (video.readyState >= 3) hold();
      else {
        video.addEventListener("canplay", hold, { once: true });
        void video.play().catch(() => undefined);
      }
    };
    if (video.readyState >= 1) warm();
    else video.addEventListener("loadedmetadata", warm, { once: true });
  };

  useEffect(() => {
    const previous = previousPlayheadRef.current;
    previousPlayheadRef.current = playhead;
    if (!playing || playhead < previous || playhead - previous > 1) return;
    const cue = sfxCues.find((item) => item.start >= previous - 0.015 && item.start < playhead + 0.015 && item.id !== lastSfxRef.current);
    if (!cue?.assetId) return;
    lastSfxRef.current = cue.id;
    const asset = globalAssets.find((item) => item.id === cue.assetId || item.fileKey === cue.assetId);
    if (asset?.fileKey) {
      void loadWorkspaceFile(asset.fileKey).then((file) => {
        if (!file) return playGeneratedSfx(cue.assetId!, cue.volume ?? 0.5);
        const url = URL.createObjectURL(file);
        const audio = new Audio(url);
        audio.volume = cue.volume ?? 0.5;
        audio.onended = () => URL.revokeObjectURL(url);
        void audio.play().catch(() => URL.revokeObjectURL(url));
      });
    } else {
      playGeneratedSfx(cue.assetId, cue.volume ?? 0.5);
    }
  }, [globalAssets, playhead, playing, sfxCues]);

  useEffect(() => {
    if (!assetUrl || !activeClip) return;
    const buffers = videos();
    const previousClipId = previousClipIdRef.current;
    let targetBuffer = activeBufferRef.current;
    if (previousClipId && previousClipId !== activeClip.id) targetBuffer = (1 - activeBufferRef.current) as 0 | 1;
    const video = buffers[targetBuffer];
    const oldVideo = buffers[activeBufferRef.current];
    if (!video) return;
    const targetSourceTime = (activeClip.sourceStart ?? 0) + Math.max(0, playhead - activeClip.start);
    if (preparedClipIdsRef.current[targetBuffer] !== activeClip.id || Math.abs(video.currentTime - targetSourceTime) > 0.12) {
      seekWhenReady(video, targetSourceTime, playing);
    } else if (playing) {
      void video.play().catch(() => undefined);
    }
    preparedClipIdsRef.current[targetBuffer] = activeClip.id;
    if (targetBuffer !== activeBufferRef.current) {
      if (oldVideo) {
        oldVideo.muted = true;
        oldVideo.pause();
      }
      video.muted = false;
      activeBufferRef.current = targetBuffer;
      setActiveBuffer(targetBuffer);
    } else {
      video.muted = false;
    }
    previousClipIdRef.current = activeClip.id;

    const activeIndex = primaryClips.findIndex((clip) => clip.id === activeClip.id);
    const nextClip = primaryClips[activeIndex + 1];
    const preloadBuffer = (1 - targetBuffer) as 0 | 1;
    const preloadVideo = buffers[preloadBuffer];
    if (nextClip && preloadVideo) {
      preloadVideo.muted = true;
      preloadVideo.pause();
      preparedClipIdsRef.current[preloadBuffer] = nextClip.id;
      warmBuffer(preloadVideo, nextClip.sourceStart ?? 0);
    }
    // Switch buffers once at each edit boundary. The next clip is pre-seeked during the current clip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClip?.id, assetUrl]);

  useEffect(() => {
    const video = videos()[activeBufferRef.current];
    if (!video || !assetUrl || !activeClip || playing) return;
    const targetSourceTime = (activeClip.sourceStart ?? 0) + Math.max(0, playhead - activeClip.start);
    if (Math.abs(video.currentTime - targetSourceTime) > 0.04) video.currentTime = targetSourceTime;
  }, [activeClip, assetUrl, playhead, playing]);

  useEffect(() => {
    const buffers = videos();
    const video = buffers[activeBufferRef.current];
    const standby = buffers[(1 - activeBufferRef.current) as 0 | 1];
    if (!video || !assetUrl) return;
    video.muted = false;
    if (standby) standby.muted = true;
    if (playing) {
      void video.play().catch(() => undefined);
      const activeIndex = primaryClips.findIndex((clip) => clip.id === activeClip?.id);
      const nextClip = primaryClips[activeIndex + 1];
      if (standby && nextClip) warmBuffer(standby, nextClip.sourceStart ?? 0);
    } else {
      video.pause();
      standby?.pause();
    }
    // warmBuffer and the clip list are intentionally read when the transport state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetUrl, playing]);

  useEffect(() => {
    preparedClipIdsRef.current = [null, null];
    previousClipIdRef.current = null;
  }, [assetUrl]);

  return (
    <section className="preview-column">
      <div className="preview-toolbar">
        <div className="breadcrumb"><span>Projects</span><b>/</b><strong>{timeline.name}</strong></div>
        <div className="preview-options">
          <button>Fit <Icon name="chevron" size={13} /></button>
          <span className="toolbar-divider" />
          <button><Icon name="filter" size={15} /> Quality</button>
        </div>
      </div>

      <div className="stage-wrap">
        <div className="video-canvas" aria-label="Video preview">
          {assetUrl ? (
            <>
              <video
                ref={videoARef}
                className={`source-preview ${activeBuffer === 0 ? "active" : "standby"}`}
                src={assetUrl}
                style={activeBuffer === 0 ? previewStyle : undefined}
                preload="auto"
                muted={activeBuffer !== 0}
                playsInline
                onSeeked={(event) => { if (playing && activeBufferRef.current === 0 && event.currentTarget.paused) void event.currentTarget.play().catch(() => undefined); }}
                onLoadedMetadata={(event) => onDuration(event.currentTarget.duration)}
              />
              <video
                ref={videoBRef}
                className={`source-preview ${activeBuffer === 1 ? "active" : "standby"}`}
                src={assetUrl}
                style={activeBuffer === 1 ? previewStyle : undefined}
                preload="auto"
                muted={activeBuffer !== 1}
                playsInline
                onSeeked={(event) => { if (playing && activeBufferRef.current === 1 && event.currentTarget.paused) void event.currentTarget.play().catch(() => undefined); }}
              />
            </>
          ) : (
            <div className="mock-cinematic-frame">
              <span className="red-halo" />
              <span className="portrait-body" />
              <span className="portrait-neck" />
              <span className="portrait-head" />
              <span className="portrait-glasses" />
              <span className="frame-grain" />
              <div className="mock-kicker">AN ORIGINAL STORY</div>
            </div>
          )}
          <div className={`canvas-vignette ${hasVignette ? "effect-active" : ""}`} />
          {activeText && <div className="hero-title" key={activeText.id} style={{ fontFamily: activeText.fontFamily }}>{activeText.text}</div>}
          {activeCaption && (
            <div className="preview-caption" key={activeCaption.id} style={{ fontFamily: activeCaption.fontFamily }}>
              {(activeCaption.text ?? "").split(" ").map((word, index) => <span className={index === 1 ? "accent-word" : ""} key={`${word}-${index}`}>{word}</span>)}
            </div>
          )}
          <span className="safe-area" />
        </div>
      </div>

      <div className="transport-bar">
        <div className="transport-spacer" />
        <div className="transport-controls">
          <button aria-label="Previous edit"><Icon name="back" size={17} /></button>
          <button className="play-button" aria-label={playing ? "Pause" : "Play"} onClick={onTogglePlaying}><Icon name={playing ? "pause" : "play"} size={17} /></button>
          <button aria-label="Next edit"><Icon name="forward" size={17} /></button>
        </div>
        <div className="timecode"><strong>{formatTime(playhead, timeline.fps)}</strong><span>/</span><span>{formatTime(timeline.duration, timeline.fps)}</span></div>
      </div>
    </section>
  );
}
