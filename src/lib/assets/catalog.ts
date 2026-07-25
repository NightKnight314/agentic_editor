export type GlobalAssetKind = "sfx" | "vfx" | "image" | "font" | "audio";

export interface GlobalAsset {
  id: string;
  name: string;
  kind: GlobalAssetKind;
  source: "builtin" | "imported";
  fileKey?: string;
  detail?: string;
  fontFamily?: string;
  effectId?: string;
}

export const BUILTIN_GLOBAL_ASSETS: GlobalAsset[] = [
  { id: "font-anton", name: "Anton", kind: "font", source: "builtin", detail: "Google Fonts · impact", fontFamily: "Anton" },
  { id: "font-bebas", name: "Bebas Neue", kind: "font", source: "builtin", detail: "Google Fonts · condensed", fontFamily: "Bebas Neue" },
  { id: "font-space", name: "Space Grotesk", kind: "font", source: "builtin", detail: "Google Fonts · modern", fontFamily: "Space Grotesk" },
  { id: "font-cormorant", name: "Cormorant Garamond", kind: "font", source: "builtin", detail: "Google Fonts · prestige", fontFamily: "Cormorant Garamond" },
  { id: "vfx-push", name: "Slow Push", kind: "vfx", source: "builtin", detail: "Geometry · animated", effectId: "transform.push@1" },
  { id: "vfx-punch", name: "Punch In", kind: "vfx", source: "builtin", detail: "Geometry · emphasis", effectId: "transform.punch@1" },
  { id: "vfx-blur", name: "Blur Reveal", kind: "vfx", source: "builtin", detail: "Spatial · reveal", effectId: "filter.blur@1" },
  { id: "vfx-grade", name: "Kumar Grade", kind: "vfx", source: "builtin", detail: "Color · warm contrast", effectId: "color.basic@1" },
  { id: "vfx-vignette", name: "Soft Vignette", kind: "vfx", source: "builtin", detail: "Look · focus", effectId: "look.vignette@1" },
  { id: "sfx-impact", name: "Impact Hit", kind: "sfx", source: "builtin", detail: "SFX placeholder · import audio" },
  { id: "sfx-whoosh", name: "Fast Whoosh", kind: "sfx", source: "builtin", detail: "SFX placeholder · import audio" },
  { id: "sfx-scratch", name: "Record Scratch", kind: "sfx", source: "builtin", detail: "SFX placeholder · import audio" }
];

export function kindForFile(file: File): GlobalAssetKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "sfx";
  return "vfx";
}

export function loadGoogleFont(fontFamily: string) {
  const id = `nightcut-font-${fontFamily.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replaceAll(" ", "+")}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}
