import { MoreHorizontal } from "lucide-react";

const C = {
  income:  "var(--chart-income)",
  expense: "var(--chart-expense)",
} as const;

interface Transaction {
  id: string;
  description: string;
  category: string;
  type: "income" | "expense";
  status: "Success" | "Pending" | "Refunded";
  qty: number;
  unitPrice: number;
  total: number;
}

const transactions: Transaction[] = [
  { id: "#04910", description: "Ryan Korsgaard", category: "Gemstone Sale", type: "income", status: "Success", qty: 12, unitPrice: 3450, total: 41400 },
  { id: "#04911", description: "Madelyn Lubin", category: "Explosives Supply", type: "expense", status: "Success", qty: 20, unitPrice: 2980, total: 89200 },
  { id: "#04912", description: "Abram Bergson", category: "Safety Equipment", type: "expense", status: "Pending", qty: 22, unitPrice: 1750, total: 75900 },
  { id: "#04913", description: "Phillip Mango", category: "Excavator Rental", type: "expense", status: "Refunded", qty: 24, unitPrice: 1950, total: 19500 },
  { id: "#04914", description: "Sarah Chen", category: "Ruby Export", type: "income", status: "Success", qty: 50, unitPrice: 420, total: 21000 },
];

const statusColors: Record<string, string> = {
  Success: "bg-success/10 text-success",
  Pending: "bg-warning/10 text-warning",
  Refunded: "bg-muted text-muted-foreground",
};

export default function RecentTransactions() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Recent Transactions
        </h3>
        <div className="flex items-center gap-2">
          <input
            placeholder="Search transactions..."
            className="hidden sm:block rounded-lg border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button className="rounded-lg border border-border bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            + Add Transaction
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-3 pr-4 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">ID</th>
              <th className="pb-3 pr-4 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Description</th>
              <th className="pb-3 pr-4 text-[11px] font-medium uppercase tracking-widest text-muted-foreground hidden md:table-cell">Category</th>
              <th className="pb-3 pr-4 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Status</th>
              <th className="pb-3 pr-4 text-[11px] font-medium uppercase tracking-widest text-muted-foreground hidden lg:table-cell text-right">Qty</th>
              <th className="pb-3 pr-4 text-[11px] font-medium uppercase tracking-widest text-muted-foreground hidden lg:table-cell text-right">Unit Price</th>
              <th className="pb-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const typeColor = t.type === "income" ? C.income : C.expense;
              return (
                <tr key={t.id} className="border-b border-border/50 last:border-0">
                  <td className="py-3 pr-4 font-medium">{t.id}</td>
                  <td className="py-3 pr-4 font-medium" style={{ color: typeColor }}>{t.description}</td>
                  <td className="py-3 pr-4 hidden md:table-cell text-muted-foreground">{t.category}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[t.status]}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {t.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 hidden lg:table-cell text-right">{t.qty}</td>
                  <td className="py-3 pr-4 hidden lg:table-cell text-right">${t.unitPrice.toLocaleString()}</td>
                  <td className="py-3 text-right font-medium" style={{ color: typeColor }}>${t.total.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
