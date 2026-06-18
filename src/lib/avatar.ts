import { createAvatar } from "@dicebear/core";
import { notionists, lorelei } from "@dicebear/collection";

/**
 * Locally-generated illustrated avatars (DiceBear). No upload, no storage
 * bucket, no network — each avatar is an SVG data URI rendered in-browser from
 * a { style, seed } recipe. The recipe is persisted as JSON in the profile's
 * `avatar_url` column; absent that, we fall back to a default seeded by user id.
 */

export const AVATAR_STYLES = ["notionists", "lorelei"] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];

export const AVATAR_STYLE_LABELS: Record<AvatarStyle, string> = {
  notionists: "Sketch",
  lorelei: "Illustrated",
};

const COLLECTIONS = { notionists, lorelei };

export type AvatarConfig = { style: AvatarStyle; seed: string };

const cache = new Map<string, string>();

/** Render a { style, seed } recipe to an SVG data URI (memoized). */
export function renderAvatar({ style, seed }: AvatarConfig): string {
  const key = `${style}|${seed}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const uri = createAvatar(COLLECTIONS[style] as Parameters<typeof createAvatar>[0], {
    seed,
    radius: 50,
    backgroundColor: ["transparent"],
  }).toDataUri();
  cache.set(key, uri);
  return uri;
}

/** The default avatar for a user who hasn't chosen one. */
export function defaultAvatarConfig(userId: string): AvatarConfig {
  return { style: "notionists", seed: userId };
}

function isAvatarStyle(value: unknown): value is AvatarStyle {
  return typeof value === "string" && (AVATAR_STYLES as readonly string[]).includes(value);
}

/** Parse a persisted `avatar_url` into our recipe, or null if it isn't one. */
export function parseAvatarConfig(avatarUrl: string | null | undefined): AvatarConfig | null {
  if (!avatarUrl) return null;
  try {
    const obj = JSON.parse(avatarUrl) as Partial<AvatarConfig>;
    if (isAvatarStyle(obj.style) && typeof obj.seed === "string") {
      return { style: obj.style, seed: obj.seed };
    }
  } catch {
    // Not our JSON (e.g. a real uploaded URL) — handled by the caller.
  }
  return null;
}

/** Serialize a recipe for storage in `avatar_url`. */
export function serializeAvatarConfig(config: AvatarConfig): string {
  return JSON.stringify(config);
}

/**
 * Resolve the image src to display for a profile: a real uploaded URL if one is
 * ever stored, otherwise the generated recipe, otherwise the user-id default.
 */
export function avatarSrc(avatarUrl: string | null | undefined, userId: string): string {
  if (avatarUrl && /^https?:\/\//.test(avatarUrl)) return avatarUrl;
  const config = parseAvatarConfig(avatarUrl) ?? defaultAvatarConfig(userId);
  return renderAvatar(config);
}

/** A short random seed, for the shuffle / re-roll action. */
export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}
