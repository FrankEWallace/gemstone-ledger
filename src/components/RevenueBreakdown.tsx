import { Sparkles } from "lucide-react";

const categories = [
  { label: "Diesel & Fuel", pct: 35, color: "bg-foreground" },
  { label: "Equipment Rental", pct: 25, color: "bg-foreground/60" },
  { label: "Labor Costs", pct: 20, color: "bg-foreground/40" },
  { label: "Supplies", pct: 12, color: "bg-foreground/25" },
  { label: "Other", pct: 8, color: "bg-foreground/15" },
];

export default function RevenueBreakdown() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 lg:p-6 flex flex-col">
      <h3 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-1">
        Expense Breakdown
      </h3>
      <div className="flex items-center justify-between mb-4">
        <p className="font-display text-2xl font-bold">$148,500</p>
        <span className="text-xs text-muted-foreground">Jan 1 - Mar 24</span>
      </div>

      <button className="mb-4 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent transition-colors">
        <Sparkles className="h-4 w-4 text-primary" />
        Get AI insight for better analysis
      </button>

      <div className="space-y-3 flex-1">
        {categories.map((c) => (
          <div key={c.label}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span>{c.label}</span>
              <span className="text-muted-foreground">{c.pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${c.color} transition-all`}
                style={{ width: `${c.pct}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
