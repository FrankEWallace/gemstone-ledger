import { cn } from "@/lib/utils";

/**
 * Single filled triangle icon used for all up/down trend indicators.
 * Direction is expressed via rotation only — same shape, same component.
 * Size and color are controlled via className (e.g. "h-2.5 w-2.5 text-emerald-500").
 */
export function TrendArrow({
  direction,
  className,
}: {
  direction: "up" | "down";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 7 7"
      fill="currentColor"
      aria-hidden
      className={cn(
        "shrink-0 transition-transform duration-300",
        direction === "down" && "rotate-180",
        className
      )}
    >
      <polygon points="3.5,0 7,7 0,7" />
    </svg>
  );
}
