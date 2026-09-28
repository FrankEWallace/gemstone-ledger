import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown } from "lucide-react";
import { fmtCompact } from "@/lib/formatCurrency";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  /** Pre-formatted value. Provide this or `rawValue`. */
  value?: string;
  /** Numeric value, formatted compactly when `value` is not given. */
  rawValue?: number;
  /** Small caption under the value. */
  sub?: string;
  /** Optional leading icon shown next to the label. */
  icon?: ReactNode;
  /** Inline color for the value (e.g. a chart color for net/loss). */
  color?: string;
  /** Class applied to the value text (e.g. a semantic token like text-success). */
  valueClassName?: string;
  /** When set, the card renders as a link and gains a hover affordance. */
  href?: string;
  /** Percent change badge. */
  trendPct?: number | null;
  /** Small muted label beside the trend badge. */
  vsLabel?: string;
  /** Which direction of `trendPct` is good news (expenses: "down"). */
  trendGoodWhen?: "up" | "down";
  /** Bar sparkline; the first `dimFirst` bars (the previous period) are drawn faded. */
  spark?: { values: number[]; dimFirst?: number; tone?: "primary" | "muted" };
  className?: string;
}

function Sparkline({ values, dimFirst = 0, tone = "primary" }: NonNullable<StatCardProps["spark"]>) {
  const max = Math.max(...values.map(Math.abs), 1);
  return (
    <div className="flex h-6 items-end gap-1" aria-hidden="true">
      {values.map((v, i) => (
        <span
          key={i}
          className={cn(
            "w-full max-w-2 rounded-sm",
            v < 0 ? "bg-destructive" : tone === "muted" ? "bg-muted-foreground/60" : "bg-primary",
            i < dimFirst && "opacity-30",
          )}
          style={{ height: `${Math.max(8, (Math.abs(v) / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

export default function StatCard({
  label,
  value,
  rawValue,
  sub,
  icon,
  color,
  valueClassName,
  href,
  trendPct,
  vsLabel,
  trendGoodWhen = "up",
  spark,
  className,
}: StatCardProps) {
  const hasTrend = trendPct != null;
  const up = (trendPct ?? 0) >= 0;
  const flat = trendPct === 0;
  const good = trendGoodWhen === "up" ? up : !up;
  const display = value ?? (rawValue != null ? fmtCompact(rawValue) : "—");

  const content = (
    <>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <p
        className={cn(
          "font-display text-2xl font-medium tracking-tight tabular-nums leading-none",
          valueClassName,
        )}
        style={color ? { color } : undefined}
      >
        {display}
      </p>
      {(hasTrend || vsLabel) && (
        <div className="flex items-center gap-2 flex-wrap">
          {hasTrend && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums",
                flat
                  ? "bg-muted text-muted-foreground"
                  : good
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive",
              )}
            >
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {up ? "+" : ""}
              {trendPct!.toFixed(1)}%
            </span>
          )}
          {vsLabel && <span className="text-xs text-muted-foreground">{vsLabel}</span>}
        </div>
      )}
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      {spark && spark.values.length > 0 && <Sparkline {...spark} />}
    </>
  );

  const base = "rounded-lg border border-border bg-card shadow-card p-4 flex flex-col gap-3";

  if (href) {
    return (
      <Link to={href} className={cn(base, "group hover:border-input hover:bg-accent/40 transition-colors", className)}>
        {content}
      </Link>
    );
  }

  return <div className={cn(base, className)}>{content}</div>;
}
