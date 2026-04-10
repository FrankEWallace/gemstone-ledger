import { TrendArrow } from "@/components/shared/TrendArrow";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: string;
  sparkData?: number[];
}

function MiniSpark({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 28;
  const w = 48;
  const barW = w / data.length - 1;

  return (
    <svg width={w} height={h} className="text-foreground/20">
      {data.map((v, i) => {
        const barH = ((v - min) / range) * h * 0.8 + h * 0.2;
        return (
          <rect
            key={i}
            x={i * (barW + 1)}
            y={h - barH}
            width={barW}
            height={barH}
            rx={1}
            fill="currentColor"
          />
        );
      })}
    </svg>
  );
}

export default function StatCard({ title, value, subtitle, change, sparkData }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col justify-between min-h-[120px]">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        {title}
      </p>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="font-display text-2xl font-bold leading-none">{value}</p>
          {subtitle && <span className="text-sm text-muted-foreground ml-1">{subtitle}</span>}
        </div>
        {sparkData && <MiniSpark data={sparkData} />}
      </div>
      {change && (() => {
        const down = change.trimStart().startsWith("-");
        return (
          <div className={`mt-2 flex items-center gap-1 text-xs ${down ? "text-red-500" : "text-emerald-500"}`}>
            <TrendArrow direction={down ? "down" : "up"} className="h-2.5 w-2.5" />
            <span>{change}</span>
          </div>
        );
      })()}
    </div>
  );
}
