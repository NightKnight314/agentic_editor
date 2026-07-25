import type { AnalysisResponse, TranscriptWord } from "./schema";
import type { TimelineDocument, TimelineElement } from "@/lib/editor/types";
import { BUILTIN_GLOBAL_ASSETS, type GlobalAsset } from "@/lib/assets/catalog";

const beatColors: Record<string, string> = {
  pattern_interrupt: "#e55745",
  identity_authority: "#7769ed",
  ambition_conflict: "#6b5fe1",
  proof_escalation: "#5d54ca",
  human_record_scratch: "#bd5b78",
  callback_cta: "#805fe6"
};

const beatEffects: Record<string, string[]> = {
  pattern_interrupt: ["filter.blur@1", "transform.punch@1", "color.basic@1"],
  identity_authority: ["transform.push@1", "color.basic@1"],
  ambition_conflict: ["transform.punch@1", "color.basic@1"],
  proof_escalation: ["transform.push@1", "color.basic@1"],
  human_record_scratch: ["raw-cut"],
  callback_cta: ["transform.push@1", "color.basic@1", "look.vignette@1"]
};

function alignedSourceEnd(sourceStart: number, sourceEnd: number, transcript: AnalysisResponse["transcript"]["segments"]) {
  const completing = transcript
    .filter((segment) => segment.start <= sourceStart + 0.18 && segment.end >= sourceEnd - 0.12 && segment.end <= sourceStart + 8.08)
    .sort((left, right) => left.end - right.end);
  return completing[0]?.end ?? sourceEnd;
}

function editorialTitle(storyBeat: string, title: string | null, ambitionIndex: number) {
  if (storyBeat === "pattern_interrupt") return "3 MARKETS I'D BET ON";
  if (storyBeat === "identity_authority") return "KIRO / FOUNDER";
  if (storyBeat === "human_record_scratch") return "WHAT I ACTUALLY USE";
  if (storyBeat === "callback_cta") return "WHAT ARE YOU BUILDING?";
  const cleaned = (title ?? "")
    .replace(/MIT\s+STUDENT\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned) return cleaned.split(" ").slice(0, 7).join(" ").toUpperCase();
  return storyBeat === "ambition_conflict" ? `${String(ambitionIndex).padStart(2, "0")} / THE BET` : null;
}

function sourceSlices(storyBeat: string, sourceStart: number, sourceEnd: number, words: TranscriptWord[], allWords: TranscriptWord[]) {
  if (storyBeat === "identity_authority") {
    for (const [index, word] of allWords.entries()) {
      if (word.word.toLowerCase().replace(/[^a-z]/g, "") !== "kiro") continue;
      const nearbyBefore = allWords.slice(Math.max(0, index - 4), index + 1);
      const nearbyAfter = allWords.slice(index + 1, index + 18);
      const hi = nearbyBefore.find((item) => item.word.toLowerCase().replace(/[^a-z]/g, "") === "hi");
      const experienceStart = nearbyAfter.find((item) => ["ive", "i"].includes(item.word.toLowerCase().replace(/[^a-z]/g, "")));
      const founders = nearbyAfter.find((item) => item.word.toLowerCase().replace(/[^a-z]/g, "") === "founders");
      if (hi && experienceStart && founders && founders.end - experienceStart.start <= 4) {
        return [{ start: hi.start, end: word.end }, { start: experienceStart.start, end: founders.end }];
      }
    }
  }
  if (storyBeat !== "pattern_interrupt") return [{ start: sourceStart, end: sourceEnd }];
  const selected = words.filter((word) => word.start >= sourceStart - 0.08 && word.end <= sourceEnd + 0.08);
  const deadlineEnd = selected.find((word) => word.word.toLowerCase().replace(/[^a-z]/g, "") === "school")?.end;
  const promiseStart = selected.find((word) => word.start > (deadlineEnd ?? sourceStart) && word.word.toLowerCase().replace(/[^a-z]/g, "") === "heres")?.start;
  if (!deadlineEnd || !promiseStart || deadlineEnd - sourceStart < 1 || sourceEnd - promiseStart < 1) return [{ start: sourceStart, end: sourceEnd }];
  return [{ start: sourceStart, end: deadlineEnd }, { start: promiseStart, end: sourceEnd }];
}

function removeEmptySpace(slices: Array<{ start: number; end: number }>, allWords: TranscriptWord[]) {
  return slices.flatMap((slice) => {
    const words = allWords.filter((word) => word.end >= slice.start - 0.04 && word.start <= slice.end + 0.04);
    if (!words.length) return [slice];
    const groups: TranscriptWord[][] = [];
    let group: TranscriptWord[] = [];
    words.forEach((word) => {
      const previous = group.at(-1);
      if (previous && word.start - previous.end >= 0.32 && previous.end - group[0].start >= 0.55) {
        groups.push(group);
        group = [];
      }
      group.push(word);
    });
    if (group.length) groups.push(group);
    return groups
      .map((items) => ({
        start: Math.max(slice.start, items[0].start - 0.025),
        end: Math.min(slice.end, items.at(-1)!.end + 0.045)
      }))
      .filter((item) => item.end - item.start >= 0.24);
  });
}

function findAsset(assets: GlobalAsset[], preferred: string, fallbackIndex: number) {
  const usable = assets.filter((asset) => asset.kind === "sfx" || asset.kind === "audio");
  return usable.find((asset) => asset.name.toLowerCase().includes(preferred)) ?? usable[fallbackIndex % Math.max(1, usable.length)];
}

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
      fontFamily: "Anton",
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

export function timelineFromAnalysis(response: AnalysisResponse, assetId = "source-1", assets: GlobalAsset[] = BUILTIN_GLOBAL_ASSETS): TimelineDocument {
  let cursor = 0;
  const primary: TimelineElement[] = [];
  const broll: TimelineElement[] = [];
  const titles: TimelineElement[] = [];
  const captions: TimelineElement[] = [];
  const dialogue: TimelineElement[] = [];
  const sfx: TimelineElement[] = [];
  const availableEffects = new Set(assets.flatMap((asset) => asset.effectId ? [asset.effectId] : []));
  const titleFont = assets.find((asset) => asset.fontFamily === "Anton")?.fontFamily ?? assets.find((asset) => asset.fontFamily)?.fontFamily ?? "Anton";

  let ambitionIndex = 0;
  response.analysis.timeline.segments.forEach((segment, index) => {
    const sourceEnd = alignedSourceEnd(segment.sourceStart, segment.sourceEnd, response.transcript.segments);
    const segmentWords = response.transcript.words.filter((word) => word.start >= segment.sourceStart - 0.08 && word.end <= sourceEnd + 0.08);
    const slices = removeEmptySpace(sourceSlices(segment.storyBeat, segment.sourceStart, sourceEnd, segmentWords, response.transcript.words), response.transcript.words);
    const segmentStart = cursor;
    const color = beatColors[segment.storyBeat] ?? "#6657e8";
    if (segment.storyBeat === "ambition_conflict") ambitionIndex += 1;
    const title = editorialTitle(segment.storyBeat, segment.title, ambitionIndex);
    slices.forEach((slice, sliceIndex) => {
      const sliceDuration = Math.ceil((slice.end - slice.start) * 30) / 30;
      const sliceId = slices.length === 1 ? segment.id || `clip-${index}` : `${segment.id || `clip-${index}`}-${sliceIndex + 1}`;
      primary.push({
        id: sliceId,
        trackId: "v1",
        kind: "video",
        name: slices.length === 1 ? segment.rationale : `${segment.rationale} · ${sliceIndex === 0 ? "deadline" : "promise"}`,
        start: cursor,
        duration: sliceDuration,
        sourceStart: slice.start,
        assetId,
        color,
        effects: (beatEffects[segment.storyBeat] ?? segment.effects).filter((effect) => effect === "raw-cut" || availableEffects.size === 0 || availableEffects.has(effect))
      });
      dialogue.push({
        id: `dialogue-${sliceId}`,
        trackId: "a1",
        kind: "audio",
        name: `Dialogue · ${segment.storyBeat.replaceAll("_", " ")}`,
        start: cursor,
        duration: sliceDuration,
        sourceStart: slice.start,
        assetId,
        color: "#3e9f78",
        volume: 1,
        effects: ["audio.gain_fade@1"]
      });
      const sliceWords = segmentWords.filter((word) => word.start >= slice.start - 0.08 && word.end <= slice.end + 0.08);
      captions.push(...groupCaptionWords(sliceWords, cursor, slice.start, sliceId));
      cursor += sliceDuration;
    });
    const duration = cursor - segmentStart;

    if (title) {
      titles.push({
        id: `title-${segment.id || index}`,
        trackId: "g1",
        kind: "text",
        name: `${segment.storyBeat.replaceAll("_", " ")} title`,
        text: title,
        start: segment.storyBeat === "pattern_interrupt" ? segmentStart : segmentStart + Math.min(0.14, duration * 0.05),
        duration: Math.min(2.4, Math.max(1.15, duration * 0.52)),
        color: "#e55745",
      fontFamily: titleFont,
        effects: ["hard-reveal"]
      });
    }

    if (segment.storyBeat === "proof_escalation" && segment.energy >= 4 && duration >= 1.5) {
      broll.push({
        id: `accent-${segment.id || index}`,
        trackId: "v2",
        kind: "video",
        name: `${segment.transition.replaceAll("_", " ")} accent`,
        start: segmentStart + duration * 0.55,
        duration: Math.min(0.8, duration * 0.25),
        sourceStart: segment.sourceStart + duration * 0.55,
        assetId,
        color: "#c94e69",
        effects: ["transform.punch@1"]
      });
    }

    const sfxChoice = segment.storyBeat === "pattern_interrupt"
      ? findAsset(assets, "impact", 0)
      : segment.storyBeat === "human_record_scratch"
        ? findAsset(assets, "scratch", 2)
        : ["ambition_conflict", "proof_escalation", "callback_cta"].includes(segment.storyBeat)
          ? findAsset(assets, "whoosh", index)
          : undefined;
    if (sfxChoice) {
      sfx.push({
        id: `sfx-${segment.id || index}`,
        trackId: "a3",
        kind: "audio",
        name: `${sfxChoice.name} · ${segment.storyBeat.replaceAll("_", " ")}`,
        start: segmentStart,
        duration: segment.storyBeat === "human_record_scratch" ? 0.42 : 0.24,
        sourceStart: 0,
        assetId: sfxChoice.fileKey ?? sfxChoice.id,
        color: "#d28a36",
        volume: segment.storyBeat === "pattern_interrupt" ? 0.72 : 0.5,
        effects: ["mix.sfx@1"]
      });
    }

  });

  const duration = Number(cursor.toFixed(3));
  return {
    id: "kumar-draft-01",
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
      { id: "a3", name: "SFX", kind: "audio", elements: sfx },
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
          effects: ["mix.music_duck@1"]
        }]
      }
    ]
  };
}
