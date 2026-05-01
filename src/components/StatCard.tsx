import { useState, useEffect, useRef } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: string;
  sparkData?: number[];
  icon?: React.ReactNode;
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

export default function StatCard({ title, value, subtitle, change, sparkData, icon }: StatCardProps) {
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

  const isDown = change?.trimStart().startsWith("-") ?? false;

  return (
    <div className={cn(
      "rounded-xl ring-1 ring-foreground/10 bg-gradient-to-t from-primary/5 to-card dark:from-card shadow-[var(--card-shadow)] p-4 flex flex-col justify-between min-h-[120px] transition-all duration-300",
      flash && "ring-primary/40 bg-primary/5"
    )}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
        {icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border bg-muted text-muted-foreground shrink-0">
            {icon}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-2 mt-2">
        <div>
          <p className="font-display text-2xl font-bold leading-none tabular-nums">{display}</p>
          {subtitle && <span className="text-xs text-muted-foreground mt-1 block">{subtitle}</span>}
        </div>
        {sparkData && <MiniSpark data={sparkData} />}
      </div>

      {change && (
        <div className={cn(
          "mt-2 flex items-center gap-1 text-xs font-semibold",
          isDown ? "text-destructive" : "text-success"
        )}>
          {isDown
            ? <TrendingDown className="h-3 w-3" />
            : <TrendingUp className="h-3 w-3" />
          }
          <span>{change}</span>
        </div>
      )}
    </div>
  );
}
