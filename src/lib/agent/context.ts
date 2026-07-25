import type { EditorSelection, TimelineDocument } from "@/lib/editor/types";

export interface AgentEditorContext {
  project: Pick<TimelineDocument, "id" | "name" | "width" | "height" | "fps" | "duration">;
  playhead: number;
  selectedElement: Record<string, unknown> | null;
  nearbyElements: Array<Record<string, unknown>>;
  activeStyle: string;
  constraints: string[];
}

export function buildAgentContext(
  timeline: TimelineDocument,
  playhead: number,
  selection: EditorSelection
): AgentEditorContext {
  const elements = timeline.tracks.flatMap((track) =>
    track.elements.map((element) => ({ ...element, trackName: track.name, trackKind: track.kind }))
  );
  const selectedElement = elements.find((element) => element.id === selection.elementId) ?? null;
  const nearbyElements = elements
    .filter((element) => element.start < playhead + 6 && element.start + element.duration > playhead - 6)
    .slice(0, 12);

  return {
    project: {
      id: timeline.id,
      name: timeline.name,
      width: timeline.width,
      height: timeline.height,
      fps: timeline.fps,
      duration: timeline.duration
    },
    playhead,
    selectedElement,
    nearbyElements,
    activeStyle: "kumar-method@1",
    constraints: [
      "Only use valid source ranges",
      "Preserve intelligible dialogue",
      "Keep output between 30 and 60 seconds",
      "Return explicit timeline operations"
    ]
  };
}
