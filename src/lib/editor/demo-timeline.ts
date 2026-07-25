import type { TimelineDocument } from "./types";

export const demoTimeline: TimelineDocument = {
  id: "draft-01",
  name: "Kumar launch cut",
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 40,
  tracks: [
    {
      id: "v1",
      name: "Primary video",
      kind: "video",
      elements: [
        { id: "clip-hook", trackId: "v1", kind: "video", name: "Cold open", start: 0, duration: 7.4, sourceStart: 12.2, assetId: "source-1", color: "#6657e8", effects: ["vertical-reframe", "slow-push"] },
        { id: "clip-reveal", trackId: "v1", kind: "video", name: "The reveal", start: 7.4, duration: 8.6, sourceStart: 44.8, assetId: "source-1", color: "#6657e8", effects: ["contrast-grade"] },
        { id: "clip-proof", trackId: "v1", kind: "video", name: "Proof point", start: 16, duration: 9.2, sourceStart: 81.4, assetId: "source-1", color: "#6657e8", effects: ["punch-in"] },
        { id: "clip-human", trackId: "v1", kind: "video", name: "Human beat", start: 25.2, duration: 6.8, sourceStart: 108.2, assetId: "source-1", color: "#6657e8", effects: ["raw-cut"] },
        { id: "clip-close", trackId: "v1", kind: "video", name: "Final callback", start: 32, duration: 8, sourceStart: 133.1, assetId: "source-1", color: "#6657e8", effects: ["slow-push", "vignette"] }
      ]
    },
    {
      id: "v2",
      name: "B-roll",
      kind: "video",
      elements: [
        { id: "broll-ledger", trackId: "v2", kind: "video", name: "Detail / hands", start: 3.8, duration: 1.4, sourceStart: 20, assetId: "source-1", color: "#c94e69", effects: ["rgb-split"] },
        { id: "broll-walk", trackId: "v2", kind: "video", name: "Hero walk", start: 10.1, duration: 2.1, sourceStart: 59.2, assetId: "source-1", color: "#c94e69", effects: ["speed-ramp"] },
        { id: "broll-stack", trackId: "v2", kind: "image", name: "3-panel stack", start: 17.8, duration: 2.7, assetId: "frame-stack", color: "#c94e69", effects: ["panel-reveal"] },
        { id: "broll-reaction", trackId: "v2", kind: "video", name: "Reaction insert", start: 27.2, duration: 1.6, sourceStart: 111.4, assetId: "source-1", color: "#c94e69" }
      ]
    },
    {
      id: "g1",
      name: "Titles",
      kind: "overlay",
      elements: [
        { id: "title-name", trackId: "g1", kind: "text", name: "Identity card", text: "THE QUIET OPERATOR", start: 0.7, duration: 2.7, color: "#e55745", opacity: 1, effects: ["hard-reveal"] },
        { id: "title-method", trackId: "g1", kind: "text", name: "Mission statement", text: "I'M BUILDING THE FUTURE", start: 8.1, duration: 2.9, color: "#e55745", opacity: 1, effects: ["tracking-snap"] },
        { id: "title-cta", trackId: "g1", kind: "text", name: "End card", text: "WATCH WHAT HAPPENS NEXT", start: 36.2, duration: 3.2, color: "#e55745", opacity: 1, effects: ["scale-settle"] }
      ]
    },
    {
      id: "c1",
      name: "Captions",
      kind: "caption",
      elements: Array.from({ length: 10 }, (_, index) => ({
        id: `caption-${index + 1}`,
        trackId: "c1",
        kind: "caption" as const,
        name: `Caption ${index + 1}`,
        text: ["I DIDN'T COME", "TO FIT IN", "I CAME TO", "CHANGE THE GAME", "THEY SAID", "IT WAS IMPOSSIBLE", "SO I BUILT IT", "ANYWAY", "THIS IS ONLY", "THE BEGINNING"][index],
        start: index * 4,
        duration: 3.6,
        color: "#d2a83e"
      }))
    },
    {
      id: "a1",
      name: "Dialogue",
      kind: "audio",
      elements: [
        { id: "audio-dialogue", trackId: "a1", kind: "audio", name: "Clean dialogue", start: 0, duration: 40, sourceStart: 12.2, assetId: "source-1", color: "#3e9f78", volume: 1, effects: ["noise-reduction", "compressor"] }
      ]
    },
    {
      id: "a2",
      name: "Music",
      kind: "audio",
      elements: [
        { id: "audio-score", trackId: "a2", kind: "audio", name: "Dark pulse — 92 BPM", start: 0, duration: 40, assetId: "score-1", color: "#298a75", volume: 0.28, effects: ["duck-under-dialogue"] }
      ]
    },
    {
      id: "a3",
      name: "SFX",
      kind: "audio",
      elements: [
        { id: "sfx-demo-impact", trackId: "a3", kind: "audio", name: "Impact Hit · hook", start: 0, duration: 0.24, assetId: "sfx-impact", color: "#d28a36", volume: 0.72 },
        { id: "sfx-demo-whoosh-1", trackId: "a3", kind: "audio", name: "Fast Whoosh · reveal", start: 7.4, duration: 0.24, assetId: "sfx-whoosh", color: "#d28a36", volume: 0.5 },
        { id: "sfx-demo-whoosh-2", trackId: "a3", kind: "audio", name: "Fast Whoosh · proof", start: 16, duration: 0.24, assetId: "sfx-whoosh", color: "#d28a36", volume: 0.5 },
        { id: "sfx-demo-scratch", trackId: "a3", kind: "audio", name: "Record Scratch · human beat", start: 25.2, duration: 0.42, assetId: "sfx-scratch", color: "#d28a36", volume: 0.55 }
      ]
    }
  ]
};
