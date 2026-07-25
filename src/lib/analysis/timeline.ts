import type { AnalysisResponse, TranscriptWord } from "./schema";
import type { TimelineDocument, TimelineElement } from "@/lib/editor/types";

const beatColors: Record<string, string> = {
  pattern_interrupt: "#e55745",
  identity_authority: "#7769ed",
  ambition_conflict: "#6b5fe1",
  proof_escalation: "#5d54ca",
  human_record_scratch: "#bd5b78",
  callback_cta: "#805fe6"
};

function groupCaptionWords(words: TranscriptWord[], compositionStart: number, sourceStart: number, segmentId: string) {
  const elements: TimelineElement[] = [];
  let group: TranscriptWord[] = [];

  const flush = () => {
    if (!group.length) return;
    const first = group[0];
    const last = group[group.length - 1];
    elements.push({
      id: `caption-${segmentId}-${elements.length}`,
      trackId: "c1",
      kind: "caption",
      name: `Caption ${elements.length + 1}`,
      text: group.map((word) => word.word).join(" ").replace(/\s+([,.!?])/g, "$1").toUpperCase(),
      start: compositionStart + (first.start - sourceStart),
      duration: Math.max(0.35, last.end - first.start + 0.12),
      color: "#d2a83e",
      effects: ["word-pop"]
    });
    group = [];
  };

  words.forEach((word) => {
    const wouldBeLong = group.length > 0 && word.end - group[0].start > 1.8;
    if (group.length >= 4 || wouldBeLong) flush();
    group.push(word);
  });
  flush();
  return elements;
}

export function timelineFromAnalysis(response: AnalysisResponse, assetId = "source-1"): TimelineDocument {
  let cursor = 0;
  const primary: TimelineElement[] = [];
  const broll: TimelineElement[] = [];
  const titles: TimelineElement[] = [];
  const captions: TimelineElement[] = [];
  const dialogue: TimelineElement[] = [];

  response.analysis.timeline.segments.forEach((segment, index) => {
    const duration = segment.sourceEnd - segment.sourceStart;
    const color = beatColors[segment.storyBeat] ?? "#6657e8";
    primary.push({
      id: segment.id || `clip-${index}`,
      trackId: "v1",
      kind: "video",
      name: segment.rationale,
      start: cursor,
      duration,
      sourceStart: segment.sourceStart,
      assetId,
      color,
      effects: segment.effects
    });
    dialogue.push({
      id: `dialogue-${segment.id || index}`,
      trackId: "a1",
      kind: "audio",
      name: `Dialogue · ${segment.storyBeat.replaceAll("_", " ")}`,
      start: cursor,
      duration,
      sourceStart: segment.sourceStart,
      assetId,
      color: "#3e9f78",
      volume: 1,
      effects: ["noise-reduction", "compressor"]
    });

    if (segment.title) {
      titles.push({
        id: `title-${segment.id || index}`,
        trackId: "g1",
        kind: "text",
        name: `${segment.storyBeat.replaceAll("_", " ")} title`,
        text: segment.title.toUpperCase(),
        start: cursor + Math.min(0.25, duration * 0.08),
        duration: Math.min(2.8, Math.max(1.2, duration * 0.65)),
        color: "#e55745",
        effects: ["hard-reveal"]
      });
    }

    if (segment.energy >= 4 && duration >= 1.5) {
      broll.push({
        id: `accent-${segment.id || index}`,
        trackId: "v2",
        kind: "video",
        name: `${segment.transition.replaceAll("_", " ")} accent`,
        start: cursor + duration * 0.55,
        duration: Math.min(0.8, duration * 0.25),
        sourceStart: segment.sourceStart + duration * 0.55,
        assetId,
        color: "#c94e69",
        effects: segment.transition === "rgb_split" || segment.transition === "glitch" ? [segment.transition] : ["punch_in"]
      });
    }

    const words = response.transcript.words.filter((word) => word.start >= segment.sourceStart - 0.08 && word.end <= segment.sourceEnd + 0.08);
    captions.push(...groupCaptionWords(words, cursor, segment.sourceStart, segment.id || String(index)));
    cursor += duration;
  });

  const duration = Number(cursor.toFixed(3));
  return {
    id: `analysis-${Date.now()}`,
    name: response.analysis.recommendedTitle,
    width: 1080,
    height: 1920,
    fps: 30,
    duration,
    tracks: [
      { id: "v1", name: "Primary video", kind: "video", elements: primary },
      { id: "v2", name: "B-roll / accents", kind: "video", elements: broll },
      { id: "g1", name: "Titles", kind: "overlay", elements: titles },
      { id: "c1", name: "Captions", kind: "caption", elements: captions },
      { id: "a1", name: "Dialogue", kind: "audio", elements: dialogue },
      {
        id: "a2",
        name: "Music",
        kind: "audio",
        elements: [{
          id: "audio-score",
          trackId: "a2",
          kind: "audio",
          name: "Dark pulse — style bed",
          start: 0,
          duration,
          assetId: "score-1",
          color: "#298a75",
          volume: 0.24,
          effects: ["duck-under-dialogue-18db"]
        }]
      }
    ]
  };
}
