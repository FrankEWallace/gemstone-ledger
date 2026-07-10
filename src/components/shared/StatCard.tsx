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
  /** Larger value type for the hero stat in a row. */
  prominent?: boolean;
  className?: string;
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
  prominent,
  className,
}: StatCardProps) {
  const hasTrend = trendPct != null;
  const up = (trendPct ?? 0) >= 0;
  const display = value ?? (rawValue != null ? fmtCompact(rawValue) : "—");

  const content = (
    <>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <p
        className={cn(
          "font-display font-semibold tracking-tight tabular-nums leading-none",
          prominent ? "text-3xl" : "text-2xl",
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
                "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full",
                up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
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
    </>
  );

  const base = "rounded-xl border border-border bg-card p-4 flex flex-col gap-2";

  if (href) {
    return (
      <Link to={href} className={cn(base, "group hover:border-foreground/20 transition-colors", className)}>
        {content}
      </Link>
    );
  }

  return <div className={cn(base, className)}>{content}</div>;
}
