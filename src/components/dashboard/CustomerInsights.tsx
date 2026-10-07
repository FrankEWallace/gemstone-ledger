import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { fmtCompact } from "@/lib/formatCurrency";
import EntityAvatar from "@/components/shared/EntityAvatar";
import type { CustomerSummary } from "@/services/reports.service";

interface CustomerInsightsProps {
  summaries: CustomerSummary[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function CustomerInsights({ summaries, selectedId, onSelect }: CustomerInsightsProps) {
  // Collapsed by default; auto-open when a customer filter is already active.
  const [open, setOpen] = useState(selectedId != null);

  if (!summaries.length) return null;
  const sorted = [...summaries].sort((a, b) => b.netProfit - a.netProfit);

  return (
    <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
      <div className={`flex items-center justify-between gap-3 px-4 py-3 ${open ? "border-b border-border" : ""}`}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-sm font-semibold hover:text-foreground/80 transition-colors"
        >
          <ChevronRight
            className={`h-4 w-4 text-muted-foreground transition-transform duration-[var(--duration-base)] ease-standard ${open ? "rotate-90" : ""}`}
          />
          Client Profitability
          <span className="text-xs font-normal text-muted-foreground">({sorted.length})</span>
        </button>
        <div className="flex items-center gap-3">
          <Link
            to="/clients"
            className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            All clients <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
      {open && (
      <div className="divide-y divide-border">
        {sorted.slice(0, 5).map((cs) => (
          <button
            key={cs.customerId}
            onClick={() => onSelect(selectedId === cs.customerId ? null : cs.customerId)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors ${
              selectedId === cs.customerId ? "bg-muted/50" : ""
            }`}
          >
            <EntityAvatar name={cs.customerName} seed={cs.customerId} className="h-9 w-9 text-xs" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{cs.customerName}</p>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">{cs.customerType}</p>
            </div>
            <div className="text-right shrink-0">
              <p
                className={`text-sm font-semibold tabular-nums ${cs.netProfit >= 0 ? "text-success" : "text-destructive"}`}
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
      )}
    </div>
  );
}
