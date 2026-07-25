"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { AgentEditorContext } from "@/lib/agent/context";
import type { TimelineElement, TimelineOperation } from "@/lib/editor/types";
import type { AnalysisResponse } from "@/lib/analysis/schema";
import { PREVIEW_EFFECTS } from "@/lib/effects/catalog";

interface Message {
  id: string;
  role: "agent" | "user";
  text: string;
  actions?: string[];
}

interface AgentPanelProps {
  context: AgentEditorContext;
  selectedElement: TimelineElement | null;
  analysisReport: AnalysisResponse | null;
  onOperations: (operations: TimelineOperation[]) => void;
  onElementPatch: (elementId: string, patch: Partial<TimelineElement>) => void;
}

const prompts = ["Tighten the hook", "Make captions punchier", "Clean the dialogue"];

function localPlan(prompt: string, selected: TimelineElement | null): { text: string; operations: TimelineOperation[]; actions: string[] } {
  const normalized = prompt.toLowerCase();
  if (normalized.includes("hook") || normalized.includes("tight")) {
    const operations: TimelineOperation[] = selected?.kind === "video"
      ? [{ type: "element.update", elementId: selected.id, patch: { duration: Math.max(0.8, selected.duration * 0.82), effects: [...new Set([...(selected.effects ?? []), "transform.punch@1"])] } }]
      : [];
    return {
      text: operations.length ? "I tightened the selected opening clip and added restrained emphasis." : "Select the opening video clip and I’ll tighten it without inventing new source content.",
      operations,
      actions: operations.length ? [`timeline.trim · ${selected?.name}`, "visual.transform · restrained punch"] : ["context.await · opening clip selection"]
    };
  }
  if (normalized.includes("caption") || normalized.includes("text")) {
    const operations: TimelineOperation[] = selected?.kind === "caption"
      ? [{ type: "element.update", elementId: selected.id, patch: { color: "#ef5b49", effects: [...new Set([...(selected.effects ?? []), "word-pop"])] } }]
      : [];
    return {
      text: operations.length ? "I added active-word emphasis to the selected source-aligned caption." : "Select a caption and I’ll restyle its existing transcript text.",
      operations,
      actions: operations.length ? ["visual.transform · active word emphasis", "review.safeArea · preserved"] : ["context.await · caption selection"]
    };
  }
  if (normalized.includes("audio") || normalized.includes("dialogue") || normalized.includes("clean")) {
    const operations: TimelineOperation[] = selected?.kind === "audio"
      ? [{ type: "element.update", elementId: selected.id, patch: { volume: 1, effects: [...new Set([...(selected.effects ?? []), "audio.gain_fade@1"])] } }]
      : [];
    return {
      text: operations.length ? "I applied a restrained, non-destructive cleanup pass to the selected audio." : "Select a dialogue or music element and I’ll clean that source.",
      operations,
      actions: operations.length ? ["audio.clean · selected source", "review.loudness · protected"] : ["context.await · audio selection"]
    };
  }
  if (selected) {
    return {
      text: `I made a focused visual pass on “${selected.name}” while keeping the surrounding rhythm unchanged.`,
      operations: [{ type: "element.update", elementId: selected.id, patch: { effects: [...(selected.effects ?? []), "agent-polish"] } }],
      actions: [`video.filter · ${selected.name}`, "review.styleMap · no conflicts"]
    };
  }
  return {
    text: "I mapped that direction to the current story beats. Select a clip if you want the next pass constrained to one element.",
    operations: [],
    actions: ["context.read · current edit neighborhood", "styleMap.compare · Kumar Method"]
  };
}

export function AgentPanel({ context, selectedElement, analysisReport, onOperations, onElementPatch }: AgentPanelProps) {
  const [tab, setTab] = useState<"agent" | "inspect">("agent");
  const [input, setInput] = useState("");
  const [working, setWorking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: "welcome", role: "agent", text: "Import source media and I’ll build a story from that material only, then apply the active style map." }
  ]);
  const reportedAnalysis = useRef<string | null>(null);
  const estimatedTokens = useMemo(() => Math.max(680, context.nearbyElements.length * 170), [context.nearbyElements.length]);

  useEffect(() => {
    if (!analysisReport) return;
    const reportKey = `${analysisReport.analysis.recommendedTitle}-${analysisReport.usage.inputTokens}-${analysisReport.usage.outputTokens}`;
    if (reportedAnalysis.current === reportKey) return;
    reportedAnalysis.current = reportKey;
    setMessages((items) => [...items, {
      id: `analysis-${Date.now()}`,
      role: "agent",
      text: `${analysisReport.analysis.summary} I assembled a ${analysisReport.analysis.timeline.targetDuration.toFixed(1)} second first draft and scored it ${Math.round(analysisReport.analysis.review.score)}/100 against the active style map.`,
      actions: [
        `events.index · ${analysisReport.analysis.events.length} source events`,
        `timeline.compose · ${analysisReport.analysis.timeline.segments.length} selected clips`,
        `budget.track · $${analysisReport.usage.estimatedCostUsd.toFixed(3)} estimated`
      ]
    }]);
  }, [analysisReport]);

  const send = (value = input) => {
    const clean = value.trim();
    if (!clean || working) return;
    setMessages((items) => [...items, { id: `u-${Date.now()}`, role: "user", text: clean }]);
    setInput("");
    setWorking(true);
    window.setTimeout(() => {
      const plan = localPlan(clean, selectedElement);
      onOperations(plan.operations);
      setMessages((items) => [...items, { id: `a-${Date.now()}`, role: "agent", text: plan.text, actions: plan.actions }]);
      setWorking(false);
    }, 650);
  };

  return (
    <aside className="agent-panel panel-surface">
      <div className="agent-head">
        <div className="panel-tabs compact">
          <button className={tab === "agent" ? "active" : ""} onClick={() => setTab("agent")}><Icon name="sparkle" size={14} /> Agent</button>
          <button className={tab === "inspect" ? "active" : ""} onClick={() => setTab("inspect")}>Inspect</button>
        </div>
        <span className="agent-online"><i /> READY</span>
      </div>

      {tab === "agent" ? (
        <>
          <div className="agent-context-bar">
            <div><Icon name="layers" size={14} /><span>{context.nearbyElements.length} nearby elements</span></div>
            <small>~{(estimatedTokens / 1000).toFixed(1)}k context</small>
          </div>
          <div className="message-list">
            {messages.map((message) => (
              <div className={`message ${message.role}`} key={message.id}>
                {message.role === "agent" && <span className="agent-avatar"><Icon name="sparkle" size={13} /></span>}
                <div className="message-body">
                  <p>{message.text}</p>
                  {message.actions && (
                    <div className="agent-actions">
                      <small>TIMELINE ACTIONS</small>
                      {message.actions.map((action) => <div key={action}><Icon name="check" size={11} />{action}</div>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {working && <div className="message agent"><span className="agent-avatar"><Icon name="sparkle" size={13} /></span><div className="thinking"><i /><i /><i /></div></div>}
          </div>
          <div className="prompt-suggestions">
            {prompts.map((prompt) => <button key={prompt} onClick={() => send(prompt)}>{prompt}</button>)}
          </div>
          <div className="agent-composer">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder="Ask the agent to edit the timeline…"
              rows={2}
            />
            <div className="composer-foot"><span><Icon name="command" size={12} /> Enter to run</span><button onClick={() => send()} disabled={!input.trim() || working}><Icon name="send" size={15} /></button></div>
          </div>
        </>
      ) : (
        <div className="inspector-body">
          {selectedElement ? (
            <>
              <div className="inspector-title"><span style={{ background: selectedElement.color }} /><div><small>{selectedElement.kind.toUpperCase()}</small><strong>{selectedElement.name}</strong></div></div>
              <div className="property-group"><label>Timing</label><div className="property-grid"><span><small>START</small>{selectedElement.start.toFixed(2)}s</span><span><small>DURATION</small>{selectedElement.duration.toFixed(2)}s</span></div></div>
              <div className="property-group"><label>Transform</label><div className="property-grid"><span><small>SCALE</small>100%</span><span><small>OPACITY</small>{Math.round((selectedElement.opacity ?? 1) * 100)}%</span></div></div>
              {selectedElement.volume !== undefined && <div className="property-group"><label>Audio level</label><input type="range" min="0" max="1" step="0.01" value={selectedElement.volume} onChange={(event) => onElementPatch(selectedElement.id, { volume: Number(event.target.value) })} /></div>}
              <div className="property-group"><label>Effect stack</label><div className="effect-list">{(selectedElement.effects?.length ? selectedElement.effects : ["No effects"]).map((effect) => <div key={effect}><Icon name="wand" size={13} /><span>{effect}</span><i /></div>)}</div></div>
              <div className="property-group">
                <label>Effect registry</label>
                <div className="effect-palette">
                  {PREVIEW_EFFECTS.filter((effect) => effect.targets.includes(selectedElement.kind as "video" | "image" | "audio")).map((effect) => (
                    <button key={effect.id} onClick={() => onElementPatch(selectedElement.id, { effects: [...new Set([...(selectedElement.effects ?? []), effect.id])] })}>
                      <Icon name="plus" size={11} />{effect.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : <div className="empty-inspector"><Icon name="cursor" size={22} /><strong>No element selected</strong><p>Select a timeline element to inspect its timing, transforms, and effects.</p></div>}
        </div>
      )}
    </aside>
  );
}
