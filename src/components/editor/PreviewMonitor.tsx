"use client";

import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import type { TimelineDocument } from "@/lib/editor/types";
import { canonicalEffectId } from "@/lib/effects/catalog";

interface PreviewMonitorProps {
  timeline: TimelineDocument;
  playhead: number;
  playing: boolean;
  assetUrl?: string;
  onTogglePlaying: () => void;
  onTimeChange: (time: number) => void;
  onDuration: (duration: number) => void;
}

const formatTime = (seconds: number, fps = 30) => {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const frames = Math.floor((safe % 1) * fps);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
};

export function PreviewMonitor({ timeline, playhead, playing, assetUrl, onTogglePlaying, onTimeChange, onDuration }: PreviewMonitorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
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
    () => primaryClips.find((element) => playhead >= element.start && playhead < element.start + element.duration) ?? primaryClips.at(-1),
    [playhead, primaryClips]
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !assetUrl || !activeClip) return;
    const targetSourceTime = (activeClip.sourceStart ?? 0) + Math.max(0, playhead - activeClip.start);
    if (Math.abs(video.currentTime - targetSourceTime) > 0.35) video.currentTime = targetSourceTime;
  }, [activeClip, assetUrl, playhead]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !assetUrl) return;
    if (playing) void video.play().catch(() => undefined);
    else video.pause();
  }, [assetUrl, playing]);

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
            <video
              ref={videoRef}
              className="source-preview"
              src={assetUrl}
              style={previewStyle}
              playsInline
              onTimeUpdate={(event) => {
                if (!activeClip) return onTimeChange(event.currentTarget.currentTime);
                const sourceStart = activeClip.sourceStart ?? 0;
                const sourceOffset = event.currentTarget.currentTime - sourceStart;
                if (sourceOffset >= activeClip.duration - 0.05) {
                  const activeIndex = primaryClips.findIndex((clip) => clip.id === activeClip.id);
                  const next = primaryClips[activeIndex + 1];
                  if (next) {
                    event.currentTarget.currentTime = next.sourceStart ?? 0;
                    onTimeChange(next.start);
                  }
                  return;
                }
                onTimeChange(Math.max(activeClip.start, activeClip.start + sourceOffset));
              }}
              onLoadedMetadata={(event) => onDuration(event.currentTarget.duration)}
              onEnded={onTogglePlaying}
            />
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
