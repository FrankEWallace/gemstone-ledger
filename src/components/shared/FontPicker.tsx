import { useFontPreference, FONT_OPTIONS, type FontKey } from "@/hooks/useFontPreference";
import { cn } from "@/lib/utils";

const FONT_FAMILY: Record<FontKey, string> = {
  "nunito-sans": "'Nunito Sans', sans-serif",
  "figtree":     "'Figtree', sans-serif",
  "inter":       "'Inter', sans-serif",
  "geist":       "'Geist Variable', sans-serif",
};

export default function FontPicker() {
  const { font, setFont } = useFontPreference();

  return (
    <div className="flex flex-wrap gap-2">
      {FONT_OPTIONS.map((opt) => {
        const active = font === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => setFont(opt.key)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl border px-4 py-3 min-w-[80px] transition-all",
              active
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-border bg-card hover:border-foreground/20 hover:bg-muted/30"
            )}
          >
            <span
              className="text-2xl font-semibold leading-none tabular-nums"
              style={{ fontFamily: FONT_FAMILY[opt.key] }}
            >
              {opt.sample}
            </span>
            <span
              className="text-[11px] text-muted-foreground leading-none"
              style={{ fontFamily: FONT_FAMILY[opt.key] }}
            >
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
