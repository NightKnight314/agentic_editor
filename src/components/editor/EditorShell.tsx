"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { MediaPanel, type MediaAnalysisState } from "./MediaPanel";
import { PreviewMonitor } from "./PreviewMonitor";
import { AgentPanel } from "./AgentPanel";
import { TimelinePanel } from "./TimelinePanel";
import { buildAgentContext } from "@/lib/agent/context";
import { demoTimeline } from "@/lib/editor/demo-timeline";
import { applyTimelineOperation, applyTimelineOperations, updateElement } from "@/lib/editor/operations";
import type { EditorSelection, TimelineElement, TimelineOperation, TimelineTrack } from "@/lib/editor/types";
import { preprocessVideo, type PreprocessProgress } from "@/lib/media/browser-preprocess";
import { timelineFromAnalysis } from "@/lib/analysis/timeline";
import type { AnalysisResponse } from "@/lib/analysis/schema";
import { BUILTIN_GLOBAL_ASSETS, kindForFile, loadGoogleFont, type GlobalAsset } from "@/lib/assets/catalog";
import { loadWorkspaceFile, saveWorkspaceFile } from "@/lib/storage/project-store";

interface ImportedAsset {
  name: string;
  url: string;
  size: number;
  file: File;
  duration?: number;
}

const idleAnalysis: MediaAnalysisState = {
  status: "idle",
  progress: 0,
  message: "Ready to analyze"
};

const SESSION_KEY = "nightcut:active-project:v1";
const SOURCE_FILE_KEY = "project:active:source";

export function EditorShell() {
  const [timeline, setTimeline] = useState(demoTimeline);
  const [playhead, setPlayhead] = useState(1.1);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(24);
  const [asset, setAsset] = useState<ImportedAsset | null>(null);
  const [analysisState, setAnalysisState] = useState<MediaAnalysisState>(idleAnalysis);
  const [analysisReport, setAnalysisReport] = useState<AnalysisResponse | null>(null);
  const [selection, setSelection] = useState<EditorSelection>({ elementId: "title-name", trackId: "g1" });
  const [toast, setToast] = useState<string | null>(null);
  const [globalAssets, setGlobalAssets] = useState<GlobalAsset[]>(BUILTIN_GLOBAL_ASSETS);
  const [workspaceReady, setWorkspaceReady] = useState(false);

  const selectedElement = useMemo(
    () => timeline.tracks.flatMap((track) => track.elements).find((element) => element.id === selection.elementId) ?? null,
    [timeline, selection.elementId]
  );
  const agentContext = useMemo(() => buildAgentContext(timeline, playhead, selection), [timeline, playhead, selection]);

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const serialized = localStorage.getItem(SESSION_KEY);
        if (serialized) {
          const saved = JSON.parse(serialized) as {
            timeline?: typeof timeline;
            analysisReport?: AnalysisResponse | null;
            selection?: EditorSelection;
            playhead?: number;
            asset?: { name: string; size: number; duration?: number } | null;
            importedAssets?: GlobalAsset[];
          };
          if (saved.timeline) setTimeline(saved.timeline);
          if (saved.analysisReport) {
            setAnalysisReport(saved.analysisReport);
            setAnalysisState({
              status: "done",
              progress: 1,
              message: `Draft restored · review ${Math.round(saved.analysisReport.analysis.review.score)}/100`,
              cost: saved.analysisReport.usage.estimatedCostUsd,
              eventCount: saved.analysisReport.analysis.events.length
            });
          }
          if (saved.selection) setSelection(saved.selection);
          if (typeof saved.playhead === "number") setPlayhead(saved.playhead);
          if (saved.importedAssets?.length) setGlobalAssets([...BUILTIN_GLOBAL_ASSETS, ...saved.importedAssets]);
          if (saved.asset) {
            const file = await loadWorkspaceFile(SOURCE_FILE_KEY);
            if (file && !cancelled) setAsset({ ...saved.asset, file, url: URL.createObjectURL(file) });
          }
        }
      } catch (error) {
        console.warn("Workspace restore skipped", error);
      } finally {
        if (!cancelled) setWorkspaceReady(true);
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!workspaceReady) return;
    const importedAssets = globalAssets.filter((item) => item.source === "imported");
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      timeline,
      analysisReport,
      selection,
      playhead,
      asset: asset ? { name: asset.name, size: asset.size, duration: asset.duration } : null,
      importedAssets
    }));
  }, [analysisReport, asset, globalAssets, playhead, selection, timeline, workspaceReady]);

  useEffect(() => {
    if (!playing || asset) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const delta = (now - previous) / 1000;
      previous = now;
      setPlayhead((time) => time + delta >= timeline.duration ? 0 : time + delta);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, asset, timeline.duration]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.code === "Space" && !["INPUT", "TEXTAREA"].includes(target.tagName)) {
        event.preventDefault();
        setPlaying((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => () => { if (asset) URL.revokeObjectURL(asset.url); }, [asset]);

  const patchElement = useCallback((elementId: string, patch: Partial<TimelineElement>) => {
    setTimeline((current) => updateElement(current, elementId, patch));
  }, []);

  const patchTrack = useCallback((trackId: string, patch: Partial<TimelineTrack>) => {
    setTimeline((current) => applyTimelineOperation(current, { type: "track.update", trackId, patch }));
  }, []);

  const runOperations = useCallback((operations: TimelineOperation[]) => {
    if (!operations.length) return;
    setTimeline((current) => applyTimelineOperations(current, operations));
    setToast(`${operations.length} timeline ${operations.length === 1 ? "operation" : "operations"} applied`);
  }, []);

  const importFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setAsset((previous) => {
      if (previous) URL.revokeObjectURL(previous.url);
      return { name: file.name, url, size: file.size, file };
    });
    setAnalysisState(idleAnalysis);
    setAnalysisReport(null);
    setPlayhead(0);
    setPlaying(false);
    setToast("Source loaded locally");
    void saveWorkspaceFile(SOURCE_FILE_KEY, file).catch((error) => {
      console.warn("Source persistence failed", error);
      setToast("Source loaded, but this browser could not persist the file");
    });
  };

  const importGlobalFiles = (files: FileList) => {
    const additions: GlobalAsset[] = Array.from(files).map((file) => {
      const id = `asset-${crypto.randomUUID()}`;
      const fileKey = `global:${id}`;
      void saveWorkspaceFile(fileKey, file).catch((error) => console.warn("Global asset persistence failed", error));
      return { id, fileKey, name: file.name, kind: kindForFile(file), source: "imported", detail: `${(file.size / 1024 / 1024).toFixed(1)} MB · local` };
    });
    setGlobalAssets((current) => [...current, ...additions]);
    setToast(`${additions.length} global ${additions.length === 1 ? "asset" : "assets"} saved`);
  };

  const applyGlobalAsset = (item: GlobalAsset) => {
    if (item.fontFamily) {
      loadGoogleFont(item.fontFamily);
      setTimeline((current) => ({
        ...current,
        tracks: current.tracks.map((track) => ({
          ...track,
          elements: track.elements.map((element) => {
            const selected = selection.elementId ? element.id === selection.elementId : element.kind === "text" || element.kind === "caption";
            return selected && (element.kind === "text" || element.kind === "caption") ? { ...element, fontFamily: item.fontFamily } : element;
          })
        }))
      }));
      setToast(`${item.name} applied to ${selection.elementId ? "selection" : "titles and captions"}`);
      return;
    }
    if (item.effectId) {
      if (!selectedElement || !["video", "image"].includes(selectedElement.kind)) return setToast("Select a video or image clip first");
      patchElement(selectedElement.id, { effects: [...new Set([...(selectedElement.effects ?? []), item.effectId])] });
      setToast(`${item.name} added to ${selectedElement.name}`);
      return;
    }
    const targetTrack = item.kind === "image" ? "v2" : "a2";
    const kind = item.kind === "image" ? "image" as const : "audio" as const;
    const element: TimelineElement = {
      id: `library-${crypto.randomUUID()}`,
      trackId: targetTrack,
      kind,
      name: item.name,
      start: playhead,
      duration: kind === "image" ? 2.5 : 1.5,
      assetId: item.fileKey ?? item.id,
      color: kind === "image" ? "#c94e69" : "#298a75",
      volume: kind === "audio" ? 0.75 : undefined
    };
    setTimeline((current) => applyTimelineOperation(current, { type: "element.insert", trackId: targetTrack, element }));
    setToast(`${item.name} placed at ${playhead.toFixed(1)}s`);
  };

  const analyzeSource = async () => {
    if (!asset) return;
    let failurePhase = "Reading video metadata";
    setPlaying(false);
    setAnalysisState({ status: "preparing", progress: 0.01, message: "Preparing source locally" });
    const mapProgress = (progress: PreprocessProgress) => {
      failurePhase = progress.message;
      const weighted = progress.stage === "metadata" ? 0.02
        : progress.stage === "frames" ? 0.04 + progress.progress * 0.2
        : progress.stage === "engine" ? 0.27
        : progress.stage === "audio" ? 0.3 + progress.progress * 0.32
        : 0.64;
      setAnalysisState({ status: "preparing", progress: weighted, message: progress.message });
    };

    try {
      const prepared = await preprocessVideo(asset.file, mapProgress);
      setAsset((current) => current ? { ...current, duration: prepared.metadata.duration } : current);
      failurePhase = "Transcribing and planning the edit";
      setAnalysisState({ status: "analyzing", progress: 0.68, message: "Transcribing speech and finding source events" });

      const form = new FormData();
      form.set("audio", prepared.audio);
      form.set("frames", JSON.stringify(prepared.frames));
      form.set("duration", String(prepared.metadata.duration));
      form.set("name", asset.name);
      form.set("brief", "Create a catchy, cinematic 30 to 60 second short in the Kumar Method style. Prioritize a strong character-led hook, clear escalation, proof, a humanizing beat, and a clean open-loop ending.");

      const response = await fetch("/api/analyze", { method: "POST", body: form });
      const payload = await response.json() as AnalysisResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || `Analysis failed with status ${response.status}.`);

      const nextTimeline = timelineFromAnalysis(payload);
      if (!nextTimeline.tracks[0]?.elements.length) throw new Error("The planner returned no usable timeline clips.");
      setTimeline(nextTimeline);
      setAnalysisReport(payload);
      setPlayhead(0);
      setSelection({ elementId: nextTimeline.tracks[0].elements[0].id, trackId: "v1" });
      setAnalysisState({
        status: "done",
        progress: 1,
        message: `Draft ready · review ${Math.round(payload.analysis.review.score)}/100`,
        cost: payload.usage.estimatedCostUsd,
        eventCount: payload.analysis.events.length
      });
      setToast(`Agent built a ${nextTimeline.duration.toFixed(1)}s draft from ${payload.analysis.events.length} events`);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown analysis failure";
      const contextualMessage = `${failurePhase} failed: ${message}`;
      console.error("Analysis pipeline failed", { phase: failurePhase, error });
      setAnalysisState({ status: "error", progress: 1, message: contextualMessage });
      setToast(contextualMessage);
    }
  };

  const splitAtPlayhead = () => {
    if (!selection.elementId) return;
    setTimeline((current) => applyTimelineOperation(current, { type: "element.split", elementId: selection.elementId!, at: playhead }));
  };

  return (
    <div className="editor-shell">
      <header className="app-header">
        <div className="brand-mark"><span><Icon name="sparkle" size={16} /></span><strong>NIGHTCUT</strong><small>AGENT VIDEO</small></div>
        <div className="project-switcher"><span className="project-dot" /><div><small>PROJECT</small><strong>{timeline.name}</strong></div><Icon name="chevron" size={13} /></div>
        <div className="header-center-status"><span><i /> {analysisState.status === "preparing" || analysisState.status === "analyzing" ? analysisState.message : analysisReport ? `${analysisReport.analysis.events.length} events indexed` : "Draft synced"}</span></div>
        <div className="header-actions">
          <button className="icon-button" title="Undo"><Icon name="undo" size={16} /></button>
          <button className="icon-button" title="Redo"><Icon name="redo" size={16} /></button>
          <span className="header-divider" />
          <Link className="about-header-link" href="/about"><Icon name="layers" size={13} /> How it works</Link>
          <button className="share-button">Share</button>
          <button className="export-button" onClick={() => setToast("MP4 renderer is queued after this persistent edit pass")}><Icon name="export" size={15} /> Export MP4</button>
        </div>
      </header>

      <div className="workspace-top">
        <MediaPanel asset={asset} analysis={analysisState} onImport={importFile} onAnalyze={analyzeSource} globalAssets={globalAssets} onGlobalImport={importGlobalFiles} onApplyAsset={applyGlobalAsset} />
        <PreviewMonitor
          timeline={timeline}
          playhead={playhead}
          playing={playing}
          assetUrl={asset?.url}
          onTogglePlaying={() => setPlaying((value) => !value)}
          onTimeChange={setPlayhead}
          onDuration={(duration) => setAsset((current) => current ? { ...current, duration } : current)}
        />
        <AgentPanel context={agentContext} selectedElement={selectedElement} analysisReport={analysisReport} onOperations={runOperations} onElementPatch={patchElement} />
      </div>

      <TimelinePanel
        timeline={timeline}
        playhead={playhead}
        selection={selection}
        zoom={zoom}
        playing={playing}
        onZoom={setZoom}
        onSeek={setPlayhead}
        onTogglePlaying={() => setPlaying((value) => !value)}
        onSelect={(element) => setSelection({ elementId: element.id, trackId: element.trackId })}
        onElementPatch={patchElement}
        onTrackPatch={patchTrack}
        onSplit={splitAtPlayhead}
      />

      {toast && <div className="toast"><Icon name="check" size={14} />{toast}</div>}
    </div>
  );
}
