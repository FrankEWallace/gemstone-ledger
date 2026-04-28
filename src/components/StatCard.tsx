import { useState, useEffect, useRef } from "react";
import { TrendArrow } from "@/components/shared/TrendArrow";
import { cn } from "@/lib/utils";

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

function useCountUp(target: string, duration = 700) {
  const [display, setDisplay] = useState(() => target.replace(/[\d,]+/, "0"));
  const rafRef = useRef<number>();

  useEffect(() => {
    const match = target.match(/^(.*?)([\d,]+(?:\.\d+)?)(.*?)$/);
    if (!match) {
      setDisplay(target);
      return;
    }
    const [, pre, numStr, post] = match;
    const end = parseFloat(numStr.replace(/,/g, ""));
    const t0 = performance.now();

    function tick(now: number) {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = Math.round(end * eased);
      setDisplay(`${pre}${cur.toLocaleString()}${post}`);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return display;
}

export default function StatCard({ title, value, subtitle, change, sparkData }: StatCardProps) {
  const display = useCountUp(value);
  const [flash, setFlash] = useState(false);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 800);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className={cn(
      "rounded-xl border border-border bg-card p-4 flex flex-col justify-between min-h-[120px] transition-all duration-300",
      flash && "ring-1 ring-primary/30 bg-primary/5"
    )}>
      <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
        {title}
      </p>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="font-display text-2xl font-bold leading-none tabular-nums">{display}</p>
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
