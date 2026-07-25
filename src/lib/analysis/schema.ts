import { z } from "zod";

export const storyBeatIds = [
  "pattern_interrupt",
  "identity_authority",
  "ambition_conflict",
  "proof_escalation",
  "human_record_scratch",
  "callback_cta"
] as const;

export const sourceEventKinds = [
  "hook",
  "identity",
  "claim",
  "proof",
  "action",
  "reaction",
  "humor",
  "visual_change",
  "call_to_action"
] as const;

export const AnalysisResultSchema = z.object({
  summary: z.string(),
  sourceQuality: z.object({
    speechClarity: z.number().min(0).max(1),
    visualVariety: z.number().min(0).max(1),
    editability: z.number().min(0).max(1),
    notes: z.array(z.string()).max(6)
  }),
  recommendedTitle: z.string(),
  events: z.array(z.object({
    id: z.string(),
    kind: z.enum(sourceEventKinds),
    start: z.number().min(0),
    end: z.number().min(0),
    summary: z.string(),
    transcript: z.string(),
    visual: z.string(),
    tags: z.array(z.string()).max(8),
    selectionScore: z.number().min(0).max(1)
  })).min(8).max(36),
  timeline: z.object({
    targetDuration: z.number().min(30).max(60),
    segments: z.array(z.object({
      id: z.string(),
      sourceStart: z.number().min(0),
      sourceEnd: z.number().min(0),
      storyBeat: z.enum(storyBeatIds),
      rationale: z.string(),
      title: z.string().nullable(),
      transition: z.enum(["hard_cut", "beat_cut", "white_flash", "rgb_split", "glitch", "record_scratch"]),
      effects: z.array(z.enum(["vertical_reframe", "slow_push", "punch_in", "contrast_grade", "grain", "vignette", "rgb_split", "three_panel", "raw_cut"])).max(5),
      energy: z.number().int().min(1).max(5)
    })).min(5).max(18)
  }),
  review: z.object({
    score: z.number().min(0).max(100),
    strengths: z.array(z.string()).max(5),
    risks: z.array(z.string()).max(5),
    missingBeats: z.array(z.enum(storyBeatIds))
  })
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface SampledFrame {
  time: number;
  dataUrl: string;
}

export interface AnalysisResponse {
  analysis: AnalysisResult;
  transcript: {
    text: string;
    duration: number;
    language: string;
    words: TranscriptWord[];
    segments: TranscriptSegment[];
  };
  usage: {
    transcriptionModel: string;
    analysisModel: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  };
}
