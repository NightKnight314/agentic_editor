"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { EditorSelection, TimelineDocument, TimelineElement, TimelineTrack } from "@/lib/editor/types";

interface TimelinePanelProps {
  timeline: TimelineDocument;
  playhead: number;
  selection: EditorSelection;
  zoom: number;
  playing: boolean;
  onZoom: (zoom: number) => void;
  onSeek: (time: number) => void;
  onTogglePlaying: () => void;
  onSelect: (element: TimelineElement) => void;
  onElementPatch: (elementId: string, patch: Partial<TimelineElement>) => void;
  onTrackPatch: (trackId: string, patch: Partial<TimelineTrack>) => void;
  onSplit: () => void;
}

const rowHeight = 48;
const rulerHeight = 28;

const trackIcon = (track: TimelineTrack) => track.kind === "audio" ? "audio" : track.kind === "caption" || track.kind === "overlay" ? "text" : "video";

function ClipBlock({ element, selected, pixelsPerSecond, onSelect, onPatch }: {
  element: TimelineElement;
  selected: boolean;
  pixelsPerSecond: number;
  onSelect: () => void;
  onPatch: (patch: Partial<TimelineElement>) => void;
}) {
  const drag = useRef<null | { mode: "move" | "start" | "end"; x: number; start: number; duration: number; sourceStart: number }>(null);

  const begin = (event: React.PointerEvent<HTMLElement>, mode: "move" | "start" | "end") => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { mode, x: event.clientX, start: element.start, duration: element.duration, sourceStart: element.sourceStart ?? 0 };
    onSelect();
  };

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const delta = (event.clientX - drag.current.x) / pixelsPerSecond;
    if (drag.current.mode === "move") onPatch({ start: Math.max(0, drag.current.start + delta) });
    if (drag.current.mode === "end") onPatch({ duration: Math.max(0.35, drag.current.duration + delta) });
    if (drag.current.mode === "start") {
      const change = Math.min(drag.current.duration - 0.35, Math.max(-drag.current.start, delta));
      onPatch({ start: drag.current.start + change, duration: drag.current.duration - change, sourceStart: drag.current.sourceStart + change });
    }
  };

  return (
    <div
      className={`timeline-clip kind-${element.kind} ${selected ? "selected" : ""}`}
      style={{ left: element.start * pixelsPerSecond, width: Math.max(12, element.duration * pixelsPerSecond), "--clip-color": element.color } as React.CSSProperties}
      onPointerDown={(event) => begin(event, "move")}
      onPointerMove={move}
      onPointerUp={() => { drag.current = null; }}
    >
      <span className="trim-handle start" onPointerDown={(event) => begin(event, "start")} />
      <div className="clip-label"><Icon name={element.kind === "audio" ? "audio" : element.kind === "text" || element.kind === "caption" ? "text" : "video"} size={11} /><span>{element.text ?? element.name}</span></div>
      {element.kind === "audio" && <div className="mini-wave" />}
      {element.effects?.length ? <i className="effect-badge">fx</i> : null}
      <span className="trim-handle end" onPointerDown={(event) => begin(event, "end")} />
    </div>
  );
}

export function TimelinePanel({ timeline, playhead, selection, zoom, playing, onZoom, onSeek, onTogglePlaying, onSelect, onElementPatch, onTrackPatch, onSplit }: TimelinePanelProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<"cursor" | "split">("cursor");
  const pixelsPerSecond = zoom;
  const contentWidth = Math.max(1000, timeline.duration * pixelsPerSecond + 80);
  const rulerMarks = Array.from({ length: Math.ceil(timeline.duration / 2) + 1 }, (_, index) => index * 2);

  const seek = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".timeline-clip")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const time = (event.clientX - rect.left) / pixelsPerSecond;
    onSeek(Math.max(0, Math.min(timeline.duration, time)));
  };

  return (
    <section className="timeline-panel">
      <div className="timeline-toolbar">
        <div className="timeline-title"><strong>Timeline</strong><span>Draft 01</span></div>
        <div className="timeline-tools">
          <button className={tool === "cursor" ? "active" : ""} onClick={() => setTool("cursor")} title="Selection tool"><Icon name="cursor" size={15} /></button>
          <button className={tool === "split" ? "active" : ""} onClick={() => { setTool("split"); onSplit(); }} title="Split at playhead"><Icon name="scissors" size={15} /></button>
          <span className="toolbar-divider" />
          <button title="Undo"><Icon name="undo" size={15} /></button>
          <button title="Redo"><Icon name="redo" size={15} /></button>
        </div>
        <div className="timeline-summary"><span><i /> Style map active</span><span>{timeline.tracks.length} tracks</span></div>
        <div className="timeline-zoom"><small>−</small><input aria-label="Timeline zoom" type="range" min="14" max="48" value={zoom} onChange={(event) => onZoom(Number(event.target.value))} /><small>+</small></div>
      </div>

      <div className="timeline-grid">
        <div className="track-sidebar">
          <div className="sidebar-ruler-head"><button><Icon name="plus" size={14} /> Add track</button></div>
          {timeline.tracks.map((track) => (
            <div className="track-head" key={track.id} style={{ height: rowHeight }}>
              <Icon name={trackIcon(track)} size={14} />
              <span><strong>{track.name}</strong><small>{track.kind.toUpperCase()}</small></span>
              <div className="track-actions">
                <button className={track.hidden ? "off" : ""} onClick={() => onTrackPatch(track.id, { hidden: !track.hidden })}><Icon name="eye" size={12} /></button>
                <button className={track.muted ? "off" : ""} onClick={() => onTrackPatch(track.id, { muted: !track.muted })}><Icon name="volume" size={12} /></button>
                <button className={track.locked ? "off" : ""} onClick={() => onTrackPatch(track.id, { locked: !track.locked })}><Icon name="lock" size={11} /></button>
              </div>
            </div>
          ))}
        </div>

        <div className="timeline-viewport" ref={viewportRef}>
          <div className="timeline-content" style={{ width: contentWidth, height: rulerHeight + timeline.tracks.length * rowHeight }} onPointerDown={seek}>
            <div className="ruler" style={{ height: rulerHeight }}>
              {rulerMarks.map((time) => <span key={time} style={{ left: time * pixelsPerSecond }}><i />{`00:${String(time).padStart(2, "0")}`}</span>)}
            </div>
            {timeline.tracks.map((track, trackIndex) => (
              <div className={`track-lane ${track.hidden ? "hidden" : ""}`} key={track.id} style={{ top: rulerHeight + trackIndex * rowHeight, height: rowHeight }}>
                {track.elements.map((element) => (
                  <ClipBlock
                    key={element.id}
                    element={element}
                    selected={selection.elementId === element.id}
                    pixelsPerSecond={pixelsPerSecond}
                    onSelect={() => onSelect(element)}
                    onPatch={(patch) => onElementPatch(element.id, patch)}
                  />
                ))}
              </div>
            ))}
            <div className="playhead" style={{ left: playhead * pixelsPerSecond }}><span /><i /></div>
          </div>
        </div>
      </div>

      <div className="timeline-statusbar">
        <button className="status-play" onClick={onTogglePlaying}><Icon name={playing ? "pause" : "play"} size={12} /></button>
        <strong>{playhead.toFixed(2)}s</strong>
        <span>30 fps</span><span>1080 × 1920</span><span>Rec. 709</span>
        <div className="autosave"><i /><span>Local draft saved</span></div>
      </div>
    </section>
  );
}
