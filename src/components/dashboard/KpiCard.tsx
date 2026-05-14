import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown } from "lucide-react";
import { fmtCompact } from "@/lib/formatCurrency";

interface KpiCardProps {
  label: string;
  rawValue: number;
  trendPct?: number | null;
  vsLabel?: string;
  href: string;
  valueColor?: string;
  prominent?: boolean;
}

export default function KpiCard({ label, rawValue, trendPct, vsLabel, href, valueColor, prominent }: KpiCardProps) {
  const up = (trendPct ?? 0) >= 0;
  const hasTrend = trendPct != null;

  return (
    <Link
      to={href}
      className="group rounded-xl border border-border bg-card p-4 flex flex-col gap-2 hover:border-foreground/20 transition-colors"
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`font-display ${prominent ? "text-3xl" : "text-2xl"} font-semibold tracking-tight tabular-nums leading-none`}
        style={valueColor ? { color: valueColor } : undefined}
      >
        {fmtCompact(rawValue)}
      </p>
      {(hasTrend || vsLabel) && (
        <div className="flex items-center gap-2 flex-wrap">
          {hasTrend && (
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                up ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              }`}
            >
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {up ? "+" : ""}{trendPct!.toFixed(1)}%
            </span>
          )}
          {vsLabel && <span className="text-xs text-muted-foreground">{vsLabel}</span>}
        </div>
      )}
    </Link>
  );
}
