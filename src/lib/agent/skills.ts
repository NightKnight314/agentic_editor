export interface AgentSkill {
  name: string;
  module: "timeline" | "video" | "transform" | "text" | "audio";
  description: string;
  writesTimeline: boolean;
  parameters: string[];
}

export const agentSkills: AgentSkill[] = [
  { name: "timeline.trim", module: "timeline", description: "Change an element's in/out points while preserving source timing.", writesTimeline: true, parameters: ["elementId", "start", "duration"] },
  { name: "timeline.move", module: "timeline", description: "Move an element in composition time or between compatible tracks.", writesTimeline: true, parameters: ["elementId", "start", "trackId"] },
  { name: "timeline.split", module: "timeline", description: "Split an element at an exact composition timestamp.", writesTimeline: true, parameters: ["elementId", "at"] },
  { name: "video.filter", module: "video", description: "Apply a named, bounded visual filter or grade.", writesTimeline: true, parameters: ["elementId", "filter", "amount"] },
  { name: "visual.transform", module: "transform", description: "Animate crop, scale, position, rotation, or opacity.", writesTimeline: true, parameters: ["elementId", "property", "keyframes"] },
  { name: "text.compose", module: "text", description: "Create or update titles, captions, fonts, and text animation.", writesTimeline: true, parameters: ["trackId", "text", "style", "start", "duration"] },
  { name: "audio.clean", module: "audio", description: "Apply dialogue noise reduction, EQ, compression, and normalization.", writesTimeline: true, parameters: ["elementId", "preset", "amount"] },
  { name: "audio.mix", module: "audio", description: "Set levels, fades, ducking, and beat-aligned cues.", writesTimeline: true, parameters: ["elementId", "volume", "ducking", "fade"] }
];
