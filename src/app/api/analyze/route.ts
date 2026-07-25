import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import kumarStyle from "@styles/kumar.json";
import { AnalysisResultSchema, type SampledFrame, type TranscriptSegment, type TranscriptWord } from "@/lib/analysis/schema";
import { sanitizeAnalysis } from "@/lib/analysis/sanitize";
import { estimateAnalysisCost } from "@/lib/analysis/cost";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_AUDIO_BYTES = 24 * 1024 * 1024;
const MAX_FRAMES = 12;

function asNumber(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
    }

    const form = await request.formData();
    const audio = form.get("audio");
    const sourceDuration = asNumber(form.get("duration"));
    const sourceName = String(form.get("name") ?? "source-video");
    const brief = String(form.get("brief") ?? "Create a catchy 30 to 60 second Kumar-style short.").slice(0, 2_000);

    if (!(audio instanceof File)) return Response.json({ error: "Audio file is required." }, { status: 400 });
    if (audio.size > MAX_AUDIO_BYTES) return Response.json({ error: "Extracted audio must be under 24 MB." }, { status: 413 });
    if (!sourceDuration || sourceDuration > 60 * 60) return Response.json({ error: "Source duration is invalid or exceeds one hour." }, { status: 400 });

    let frames: SampledFrame[] = [];
    try {
      const parsed = JSON.parse(String(form.get("frames") ?? "[]")) as SampledFrame[];
      frames = parsed
        .filter((frame) => Number.isFinite(frame.time) && typeof frame.dataUrl === "string" && frame.dataUrl.startsWith("data:image/jpeg;base64,"))
        .filter((frame) => frame.dataUrl.length < 400_000)
        .slice(0, MAX_FRAMES);
    } catch {
      return Response.json({ error: "Frame payload is invalid." }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const transcriptionModel = "whisper-1";
    const analysisModel = process.env.OPENAI_ANALYSIS_MODEL || "gpt-5.6-luna";

    const transcription = await openai.audio.transcriptions.create({
      file: audio,
      model: transcriptionModel,
      response_format: "verbose_json",
      timestamp_granularities: ["segment", "word"]
    });

    const verbose = transcription as typeof transcription & {
      duration?: number;
      language?: string;
      words?: TranscriptWord[];
      segments?: TranscriptSegment[];
    };
    const segments = (verbose.segments ?? []).map((segment, index) => ({
      id: Number(segment.id ?? index),
      start: Number(segment.start),
      end: Number(segment.end),
      text: String(segment.text).trim()
    }));
    const words = (verbose.words ?? []).map((word) => ({
      word: String(word.word).trim(),
      start: Number(word.start),
      end: Number(word.end)
    }));

    const transcriptForPlanner = segments.map((segment) => `[${segment.start.toFixed(2)}-${segment.end.toFixed(2)}] ${segment.text}`).join("\n").slice(0, 80_000);
    const visualContent = frames.flatMap((frame) => [
      { type: "input_text" as const, text: `Sampled source frame at ${frame.time.toFixed(2)} seconds:` },
      { type: "input_image" as const, image_url: frame.dataUrl, detail: "low" as const }
    ]);

    const response = await openai.responses.parse({
      model: analysisModel,
      reasoning: { effort: "low" },
      input: [
        {
          role: "system",
          content: "You are the evidence-grounded editorial planner for a nonlinear video editor. Select exact source moments and a coherent beat order; deterministic application code will compile style and effects. Never invent dialogue, credentials, reactions, or visual evidence. Editorial titles are allowed only when clearly distinguishable from speech and must not strengthen a claim. Every selected range must preserve a complete intelligible phrase. Build a character-first 45-second vertical short, not a summary of the source."
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `SOURCE\nName: ${sourceName}\nDuration: ${sourceDuration.toFixed(2)} seconds\n\nUSER BRIEF\n${brief}\n\nSTYLE MAP\n${JSON.stringify({ creativeThesis: kumarStyle.creativeThesis, storyBeats: kumarStyle.storyBeats, pacing: kumarStyle.pacing, typography: kumarStyle.typography, plannerRules: kumarStyle.plannerRules, review: kumarStyle.review })}\n\nTIMESTAMPED TRANSCRIPT\n${transcriptForPlanner}\n\nReturn 8-36 useful evidence events and an 8-12 segment edit plan. Target 42-52 seconds. Every segment must be 2-8 seconds and end on a complete phrase; never cut a sentence merely to hit duration. Required arc: immediate deadline/promise, concise identity, three clearly numbered bets with concrete proof, an honest human release or explicitly missing beat, then synthesis/CTA. Spend at most 8 seconds on the opening before the first bet. Use no more than seven words per editorial title. Do not put unverified credentials, stronger claims, or generated quotations in titles. Preserve the CTA and ending before allocating exposition. Reordering is allowed when it improves clarity. Calculate the selected durations before responding and make targetDuration match their sum.`
            },
            ...visualContent
          ]
        }
      ],
      text: { format: zodTextFormat(AnalysisResultSchema, "video_edit_analysis") }
    });

    if (!response.output_parsed) return Response.json({ error: "The analysis model did not return a usable edit plan." }, { status: 502 });
    const analysis = sanitizeAnalysis(response.output_parsed, sourceDuration, segments);
    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const duration = Number(verbose.duration ?? sourceDuration);
    const estimatedCostUsd = estimateAnalysisCost({ durationSeconds: duration, analysisModel, inputTokens, outputTokens });
    const maxCost = Number(process.env.OPENAI_MAX_COST_USD ?? 5);

    if (estimatedCostUsd > maxCost) {
      return Response.json({ error: `Estimated analysis cost $${estimatedCostUsd.toFixed(2)} exceeds the configured $${maxCost.toFixed(2)} limit.` }, { status: 402 });
    }

    return Response.json({
      analysis,
      transcript: {
        text: transcription.text,
        duration,
        language: verbose.language ?? "unknown",
        words,
        segments
      },
      usage: { transcriptionModel, analysisModel, inputTokens, outputTokens, estimatedCostUsd }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analysis error";
    console.error("Video analysis failed:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
