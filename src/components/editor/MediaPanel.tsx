"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { GlobalAsset } from "@/lib/assets/catalog";

interface ImportedAsset {
  name: string;
  url: string;
  size: number;
  duration?: number;
}

export interface MediaAnalysisState {
  status: "idle" | "preparing" | "analyzing" | "done" | "error";
  progress: number;
  message: string;
  cost?: number;
  eventCount?: number;
}

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 MB";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export function MediaPanel({ asset, analysis, creativeBrief, onCreativeBriefChange, onImport, onAnalyze, globalAssets, onGlobalImport, onApplyAsset, onRebuildStyle }: {
  asset: ImportedAsset | null;
  analysis: MediaAnalysisState;
  creativeBrief: string;
  onCreativeBriefChange: (brief: string) => void;
  onImport: (file: File) => void;
  onAnalyze: () => void;
  globalAssets: GlobalAsset[];
  onGlobalImport: (files: FileList) => void;
  onApplyAsset: (asset: GlobalAsset) => void;
  onRebuildStyle: () => void;
}) {
  const [tab, setTab] = useState<"media" | "assets" | "styles">("media");
  const inputRef = useRef<HTMLInputElement>(null);
  const globalInputRef = useRef<HTMLInputElement>(null);

  return (
    <aside className="media-panel panel-surface">
      <div className="panel-tabs">
        <button className={tab === "media" ? "active" : ""} onClick={() => setTab("media")}>Media</button>
        <button className={tab === "assets" ? "active" : ""} onClick={() => setTab("assets")}>Assets</button>
        <button className={tab === "styles" ? "active" : ""} onClick={() => setTab("styles")}>Styles</button>
      </div>

      {tab === "media" ? (
        <div className="media-panel-content">
          <button className="import-drop" onClick={() => inputRef.current?.click()}>
            <span className="import-icon"><Icon name="upload" size={18} /></span>
            <span>Import source media</span>
            <small>MP4, MOV, WebM</small>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="video/*,audio/*,image/*"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImport(file);
            }}
          />

          <div className="section-heading">
            <span>PROJECT MEDIA</span>
            <button aria-label="More options"><Icon name="more" size={16} /></button>
          </div>

          {asset ? (
            <>
              <div className="asset-card selected">
                <div className="asset-thumb asset-thumb-video">
                  <video src={asset.url} muted preload="metadata" />
                  <span><Icon name="play" size={13} /></span>
                </div>
                <div className="asset-copy">
                  <strong>{asset.name}</strong>
                  <small>{formatBytes(asset.size)} · SOURCE</small>
                </div>
              </div>
              <label className="creative-brief-box">
                <span><Icon name="sparkle" size={12} /> STYLE DIRECTION <small>OPTIONAL</small></span>
                <textarea
                  aria-label="Style direction"
                  value={creativeBrief}
                  maxLength={1200}
                  rows={3}
                  placeholder="e.g. Open on the strongest contrarian claim, feel urgent, use dry humor, keep the CTA conversational…"
                  onChange={(event) => onCreativeBriefChange(event.target.value)}
                />
                <small>{creativeBrief.length}/1200 · saved with project</small>
              </label>
              <button className="analyze-source-button" disabled={analysis.status === "preparing" || analysis.status === "analyzing"} onClick={onAnalyze}>
                <Icon name={analysis.status === "done" ? "check" : "sparkle"} size={14} />
                {analysis.status === "done" ? "Analyze again" : analysis.status === "preparing" || analysis.status === "analyzing" ? "Agent working…" : "Analyze & build draft"}
              </button>
              {analysis.status !== "idle" && (
                <div className={`analysis-progress-card ${analysis.status}`}>
                  <div><span>{analysis.message}</span><small>{Math.round(analysis.progress * 100)}%</small></div>
                  <div className="analysis-progress-track"><i style={{ width: `${Math.max(3, analysis.progress * 100)}%` }} /></div>
                  {analysis.status === "done" && <p>{analysis.eventCount} source events · ${analysis.cost?.toFixed(3)} estimated</p>}
                </div>
              )}
            </>
          ) : (
            <div className="asset-card selected">
              <div className="asset-thumb score-thumb"><Icon name="upload" size={18} /></div>
              <div className="asset-copy">
                <strong>No source imported</strong>
                <small>ADD MEDIA TO BEGIN</small>
              </div>
            </div>
          )}

          <div className="asset-card">
            <div className="asset-thumb score-thumb"><Icon name="audio" size={20} /></div>
            <div className="asset-copy">
              <strong>dark_pulse_92bpm.wav</strong>
              <small>00:47 · AUDIO</small>
            </div>
          </div>
        </div>
      ) : tab === "assets" ? (
        <div className="media-panel-content">
          <button className="import-drop compact-drop" onClick={() => globalInputRef.current?.click()}>
            <span className="import-icon"><Icon name="plus" size={16} /></span>
            <span>Add global assets</span>
            <small>SFX, images, overlays</small>
          </button>
          <input
            ref={globalInputRef}
            type="file"
            accept="audio/*,image/*,video/*"
            multiple
            hidden
            onChange={(event) => {
              if (event.target.files?.length) onGlobalImport(event.target.files);
              event.target.value = "";
            }}
          />
          {(["font", "sfx", "vfx", "image"] as const).map((kind) => {
            const items = globalAssets.filter((item) => item.kind === kind || (kind === "sfx" && item.kind === "audio"));
            if (!items.length) return null;
            return (
              <div className="library-group" key={kind}>
                <div className="section-heading"><span>{kind.toUpperCase()}</span></div>
                {items.map((item) => (
                  <button className="library-asset" key={item.id} onClick={() => onApplyAsset(item)}>
                    <span className={`library-icon kind-${kind}`}><Icon name={kind === "font" ? "text" : kind === "sfx" ? "audio" : "wand"} size={14} /></span>
                    <span><strong style={item.fontFamily ? { fontFamily: item.fontFamily } : undefined}>{item.name}</strong><small>{item.detail ?? item.source}</small></span>
                    <i>{item.source === "builtin" ? "+" : "LOCAL"}</i>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="media-panel-content">
          <div className="active-style-card">
            <div className="style-card-art">
              <span>K</span>
              <small>01 / 06</small>
            </div>
            <div className="style-card-head">
              <div><small>ACTIVE STYLE MAP</small><strong>Kumar Method</strong></div>
              <span className="status-dot" />
            </div>
            <p>Prestige-thriller pacing with an unexpected character and humanizing release.</p>
            <div className="style-tags"><span>6 story beats</span><span>92 BPM</span><span>9:16</span></div>
          </div>
          <button className="analyze-source-button" disabled={analysis.status !== "done"} onClick={onRebuildStyle}><Icon name="sparkle" size={14} /> Rebuild Kumar draft</button>
          <button className="secondary-button wide"><Icon name="plus" size={15} /> Add style map</button>
        </div>
      )}

      <div className="panel-footnote">
        <Icon name="cloud" size={14} />
        <span>{tab === "assets" ? "Global library saved on this device" : "Media stays local until analysis"}</span>
      </div>
    </aside>
  );
}
