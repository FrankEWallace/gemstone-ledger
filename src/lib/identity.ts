export const TINTS = ["clay", "slate", "plum", "teal", "sand", "rose"] as const;
export type Tint = (typeof TINTS)[number];

// djb2 — stable across devices and sessions, so a seed always maps to the same tint.
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

export function tintFor(seed: string): Tint {
  return TINTS[hash(seed) % TINTS.length];
}

/** "Rehema Mushi" → "RM", "Merelani" → "ME", "" → "?" */
export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
