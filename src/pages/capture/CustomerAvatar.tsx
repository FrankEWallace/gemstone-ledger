import { cn } from "@/lib/utils";

/** Internal (warning) / External (primary) capsule, matching the app's TypeBadge. */
export function TypeBadge({ type }: { type?: string | null }) {
  const isInternal = type === "internal";
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        isInternal ? "bg-warning/12 text-warning" : "bg-primary/12 text-primary",
      )}
    >
      {isInternal ? "Internal" : "External"}
    </span>
  );
}
