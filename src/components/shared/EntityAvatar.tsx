import { tintFor, initialsOf } from "@/lib/identity";
import { cn } from "@/lib/utils";

interface EntityAvatarProps {
  name: string | null | undefined;
  /** Stable id for the tint; defaults to the name. Pass the record id when names can repeat. */
  seed?: string;
  /** A face (staff Notionists avatar or uploaded photo), drawn on the tint. */
  src?: string | null;
  /** Sites and other places are squares; people are circles. */
  shape?: "circle" | "square";
  /** Size and text size, e.g. "h-8 w-8 text-xs". */
  className?: string;
}

/**
 * The one avatar for people and places. Customers and sites get initials on a
 * muted tint derived from their id; staff get their face on the same tint.
 */
export default function EntityAvatar({
  name,
  seed,
  src,
  shape = "circle",
  className = "h-9 w-9 text-xs",
}: EntityAvatarProps) {
  const tint = tintFor(seed || name || "");
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden font-semibold tracking-wide",
        shape === "circle" ? "rounded-full" : "rounded-md",
        className,
      )}
      style={{ backgroundColor: `var(--tint-${tint}-bg)`, color: `var(--tint-${tint}-fg)` }}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initialsOf(name)}
    </span>
  );
}
