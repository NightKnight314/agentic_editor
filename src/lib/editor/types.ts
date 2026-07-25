export type TrackKind = "video" | "overlay" | "caption" | "audio";
export type ElementKind = "video" | "image" | "text" | "caption" | "audio";

export interface TimelineElement {
  id: string;
  trackId: string;
  kind: ElementKind;
  name: string;
  start: number;
  duration: number;
  sourceStart?: number;
  assetId?: string;
  color: string;
  text?: string;
  volume?: number;
  opacity?: number;
  fontFamily?: string;
  effects?: string[];
}

export interface TimelineTrack {
  id: string;
  name: string;
  kind: TrackKind;
  muted?: boolean;
  hidden?: boolean;
  locked?: boolean;
  elements: TimelineElement[];
}

export interface TimelineDocument {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  tracks: TimelineTrack[];
}

export interface EditorSelection {
  elementId: string | null;
  trackId: string | null;
}

export type TimelineOperation =
  | { type: "element.insert"; trackId: string; element: TimelineElement }
  | { type: "element.update"; elementId: string; patch: Partial<TimelineElement> }
  | { type: "element.remove"; elementId: string }
  | { type: "element.split"; elementId: string; at: number }
  | { type: "track.update"; trackId: string; patch: Partial<TimelineTrack> };
