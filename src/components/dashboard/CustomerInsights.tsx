import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { fmtCompact } from "@/lib/formatCurrency";
import type { CustomerSummary } from "@/services/reports.service";

const income = "var(--chart-1)";
const expense = "var(--chart-2)";

interface CustomerInsightsProps {
  summaries: CustomerSummary[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function CustomerInsights({ summaries, selectedId, onSelect }: CustomerInsightsProps) {
  if (!summaries.length) return null;
  const sorted = [...summaries].sort((a, b) => b.netProfit - a.netProfit);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <p className="text-sm font-medium">Customer Profitability</p>
        <div className="flex items-center gap-3">
          <Link
            to="/activity"
            className="inline-flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Follow-up <ChevronRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            to="/customers"
            className="inline-flex items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            All customers <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
      <div className="divide-y divide-border">
        {sorted.slice(0, 5).map((cs, idx) => (
          <button
            key={cs.customerId}
            onClick={() => onSelect(selectedId === cs.customerId ? null : cs.customerId)}
            className={`w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-muted/30 transition-colors ${
              selectedId === cs.customerId ? "bg-muted/50" : ""
            }`}
          >
            <span className="text-xs font-medium tabular-nums text-muted-foreground w-4 shrink-0">
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{cs.customerName}</p>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">{cs.customerType}</p>
            </div>
            <div className="text-right shrink-0">
              <p
                className="text-sm font-semibold tabular-nums"
                style={{ color: cs.netProfit >= 0 ? income : expense }}
              >
                {cs.netProfit >= 0 ? "+" : "−"}
                {fmtCompact(Math.abs(cs.netProfit))}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {fmtCompact(cs.totalIncome)} rev
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
