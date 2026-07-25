export interface PreviewEffect {
  id: string;
  label: string;
  stage: "geometry" | "spatial" | "color" | "stylize" | "audio";
  targets: Array<"video" | "image" | "audio">;
}

// Browser-facing projection of scripts/effects/core.mjs. Keep IDs versioned so
// preview, timeline intent, and FFmpeg lowering refer to the same definitions.
export const PREVIEW_EFFECTS: PreviewEffect[] = [
  { id: "transform.push@1", label: "Slow Push", stage: "geometry", targets: ["video", "image"] },
  { id: "transform.punch@1", label: "Punch In", stage: "geometry", targets: ["video", "image"] },
  { id: "transform.shake@1", label: "Camera Shake", stage: "geometry", targets: ["video", "image"] },
  { id: "filter.blur@1", label: "Blur Reveal", stage: "spatial", targets: ["video", "image"] },
  { id: "color.basic@1", label: "Kumar Grade", stage: "color", targets: ["video", "image"] },
  { id: "look.vignette@1", label: "Vignette", stage: "stylize", targets: ["video", "image"] },
  { id: "audio.gain_fade@1", label: "Gain + Fade", stage: "audio", targets: ["audio"] }
];

const ALIASES: Record<string, string> = {
  slow_push: "transform.push@1",
  "slow-push": "transform.push@1",
  punch_in: "transform.punch@1",
  "punch-in": "transform.punch@1",
  contrast_grade: "color.basic@1",
  "contrast-grade": "color.basic@1",
  vignette: "look.vignette@1"
};

export function canonicalEffectId(id: string) {
  return ALIASES[id] ?? id;
}
