import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Label, Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { useBreakdownCard, PERIOD_LABEL } from "./useBreakdownCard";
import { fmtCurrency, fmtCompact } from "@/lib/formatCurrency";
import type { DashboardPeriod } from "./useBreakdownCard";

interface BreakdownCardProps {
  type: "expense" | "income";
  siteId: string;
  period: DashboardPeriod;
  selectedCustomerId?: string | null;
}

export default function BreakdownCard({ type, siteId, period, selectedCustomerId }: BreakdownCardProps) {
  const { items, periodTotal, todayTotal, yesterdayTotal, isLoading } = useBreakdownCard({
    type, siteId, period, selectedCustomerId,
  });

  const isExpense = type === "expense";
  const href = isExpense ? "/reports/expenses" : "/reports/income";
  const title = isExpense ? "Expense Breakdown" : "Income Breakdown";

  // Show delta whenever there's a yesterday baseline — even if today is zero (that's the most alarming signal)
  const todayDelta =
    yesterdayTotal > 0
      ? Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 100)
      : null;
  const deltaUp = (todayDelta ?? 0) >= 0;
  // for expenses, down is good; for income, up is good
  const deltaGood = isExpense ? !deltaUp : deltaUp;

  const chartConfig = Object.fromEntries(
    items.map((i) => [i.label, { label: i.label, color: i.color }])
  );

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-5 h-full">
      {/* Header */}
      <Link
        to={href}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors self-start"
      >
        {title} <ChevronRight className="h-3.5 w-3.5" />
      </Link>

      {/* Hero number */}
      <div>
        <p className="font-display text-3xl font-semibold tracking-tight tabular-nums leading-none">
          {fmtCompact(periodTotal)}
        </p>
        <p className="text-sm text-muted-foreground mt-1.5">
          over {PERIOD_LABEL[period]}
          {(todayTotal > 0 || yesterdayTotal > 0) && (
            <>
              {" · "}
              <span className="tabular-nums">{fmtCompact(todayTotal)} today</span>
              {todayDelta !== null && (
                <span className={`ml-1 font-medium ${deltaGood ? "text-success" : "text-destructive"}`}>
                  {deltaUp ? "↑" : "↓"}{Math.abs(todayDelta)}%
                </span>
              )}
            </>
          )}
        </p>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div className="h-44 animate-pulse rounded-lg bg-muted" />
      ) : !items.length ? (
        <div className="h-44 rounded-lg bg-muted/30 flex items-center justify-center">
          <span className="text-sm text-muted-foreground">No data for this period</span>
        </div>
      ) : (
        <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
          <ChartContainer config={chartConfig} className="mx-auto aspect-square h-44">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel className="w-44" nameKey="label" />}
              />
              <Pie
                data={items.map((i) => ({ ...i, fill: i.color }))}
                dataKey="value"
                nameKey="label"
                innerRadius={55}
                outerRadius={80}
                cornerRadius={4}
                paddingAngle={2}
                strokeWidth={4}
              >
                <Label
                  content={({ viewBox }) => {
                    if (!(viewBox && "cx" in viewBox && "cy" in viewBox)) return null;
                    return (
                      <text dominantBaseline="middle" textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
                        <tspan
                          className="fill-muted-foreground"
                          fontSize={10}
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) - 8}
                        >
                          Total
                        </tspan>
                        <tspan
                          className="fill-foreground font-semibold"
                          fontSize={13}
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) + 10}
                        >
                          {fmtCompact(periodTotal)}
                        </tspan>
                      </text>
                    );
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>

          <div className="flex flex-col gap-2.5 min-w-0">
            {items.map((item) => (
              <div key={item.label} className="grid grid-cols-[1fr_auto] items-center gap-2">
                <div className="min-w-0 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <p className="truncate text-sm text-muted-foreground">{item.label}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-medium text-sm tabular-nums">{item.pct}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
