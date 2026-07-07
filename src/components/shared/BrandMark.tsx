import { cn } from "@/lib/utils";

/**
 * FW Mining OS brand mark — a faceted gem. Renders in currentColor so it
 * adapts to whatever surface it sits on (sidebar tile, auth pages, emails).
 * Keep this as the single source of truth for the glyph; the static assets
 * in /public (favicon, PWA icons, OG image) are generated from the same
 * geometry via scripts/generate-brand-assets.mjs.
 */
export default function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn("h-4 w-4", className)}
    >
      <path
        d="M9.5 6.5h13L28 13 16 26.5 4 13l5.5-6.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 13h23M9.5 6.5 12 13l4 13M22.5 6.5 20 13l-4 13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
