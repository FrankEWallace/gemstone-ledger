import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function generateData() {
  return months.map((m) => ({
    month: m,
    newUser: Math.floor(Math.random() * 40000 + 10000),
    existingUser: Math.floor(Math.random() * 25000 + 5000),
  }));
}

const data = generateData();

export default function SalesTrendChart() {
  const [period, setPeriod] = useState<"Weekly" | "Monthly" | "Yearly">("Monthly");

  const total = data.reduce((s, d) => s + d.newUser + d.existingUser, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Production Trend
            </h3>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-sm text-muted-foreground">Total Revenue:</span>
            <span className="font-display text-2xl font-bold">
              ${(total / 1000).toFixed(0)}k
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-foreground/70" />
              EXPENSES
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-foreground/30" />
              INCOME
            </span>
          </div>
          <div className="flex rounded-lg border border-border text-xs overflow-hidden">
            {(["Weekly", "Monthly", "Yearly"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  period === p
                    ? "bg-card-foreground text-card"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={1} barSize={6}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v / 1000}k`}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "13px",
              }}
              formatter={(value: number, name: string) => [
                `${(value / 1000).toFixed(0)}k`,
                name === "newUser" ? "Expenses" : "Income",
              ]}
            />
            <Bar dataKey="newUser" fill="hsl(var(--foreground))" radius={[2, 2, 0, 0]} />
            <Bar dataKey="existingUser" fill="hsl(var(--foreground)/0.25)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
