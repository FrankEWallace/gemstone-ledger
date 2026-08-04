import { cn } from "@/lib/utils";

/** First letter of the first two words, e.g. "Ruben Mtengi" -> "RM". Mirrors the iOS CustomerRow. */
function initialsOf(name: string): string {
  const parts = (name || "").trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((p) => p.charAt(0)).join("");
  return (letters || name.charAt(0) || "?").toUpperCase();
}

/** Teal-tint circle with initials — same avatar the native app draws for customers. */
export function CustomerAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary",
        className,
      )}
      aria-hidden
    >
      {initialsOf(name)}
    </div>
  );
}

/** Internal (warning) / External (primary) capsule, matching the app's TypeBadge. */
export function TypeBadge({ type }: { type?: string | null }) {
  const isInternal = type === "internal";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
        isInternal ? "bg-warning/12 text-warning" : "bg-primary/12 text-primary",
      )}
    >
      {isInternal ? "Internal" : "External"}
    </span>
  );
}
