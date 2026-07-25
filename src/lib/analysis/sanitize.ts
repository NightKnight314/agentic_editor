import type { AnalysisResult, TranscriptSegment } from "./schema";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function transcriptAlignedEnd(start: number, originalEnd: number, cap: number, transcript: TranscriptSegment[]) {
  const hardEnd = Math.min(originalEnd, start + cap);
  const completing = transcript
    .filter((segment) => segment.start <= start + 0.18 && segment.end >= originalEnd - 0.12 && segment.end <= start + cap + 0.08)
    .sort((a, b) => a.end - b.end);
  if (completing.length) return completing[0].end;
  const candidates = transcript
    .filter((segment) => segment.start >= start - 0.15 && segment.end <= start + cap + 0.05 && segment.end > start + 0.8)
    .sort((a, b) => a.end - b.end);
  return candidates.at(-1)?.end ?? hardEnd;
}

export function sanitizeAnalysis(result: AnalysisResult, sourceDuration: number, transcript: TranscriptSegment[] = []): AnalysisResult {
  const events = result.events
    .map((event) => ({
      ...event,
      start: clamp(event.start, 0, sourceDuration),
      end: clamp(event.end, 0, sourceDuration)
    }))
    .filter((event) => event.end - event.start >= 0.15)
    .sort((a, b) => a.start - b.start);

  const validSegments = result.timeline.segments
    .map((segment) => ({
      ...segment,
      sourceStart: clamp(segment.sourceStart, 0, sourceDuration),
      sourceEnd: clamp(segment.sourceEnd, 0, sourceDuration)
    }))
    .filter((segment) => segment.sourceEnd - segment.sourceStart >= 0.4);

  const perSegmentCap = 8;
  const segments = validSegments.map((segment) => ({
    ...segment,
    sourceEnd: transcriptAlignedEnd(segment.sourceStart, segment.sourceEnd, perSegmentCap, transcript)
  }));
  const outputDuration = segments.reduce((total, segment) => total + segment.sourceEnd - segment.sourceStart, 0);

  return {
    ...result,
    events,
    timeline: {
      targetDuration: clamp(outputDuration, 30, 60),
      segments
    }
  };
}
