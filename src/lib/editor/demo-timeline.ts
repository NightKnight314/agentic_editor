import type { TimelineDocument, TimelineTrack } from "./types";

const emptyTrack = (id: string, name: string, kind: TimelineTrack["kind"]): TimelineTrack => ({
  id,
  name,
  kind,
  elements: []
});

export const demoTimeline: TimelineDocument = {
  id: "untitled-draft",
  name: "Untitled short",
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 45,
  tracks: [
    emptyTrack("v1", "Primary video", "video"),
    emptyTrack("v2", "B-roll / accents", "video"),
    emptyTrack("g1", "Titles", "overlay"),
    emptyTrack("c1", "Captions", "caption"),
    emptyTrack("a1", "Dialogue", "audio"),
    emptyTrack("a2", "Music", "audio"),
    emptyTrack("a3", "SFX", "audio")
  ]
};
