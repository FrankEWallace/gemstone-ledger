import { Calendar, Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import StatCard from "@/components/StatCard";
import SalesTrendChart from "@/components/SalesTrendChart";
import RevenueBreakdown from "@/components/RevenueBreakdown";
import RecentTransactions from "@/components/RecentTransactions";

const stats = [
  { title: "Total Revenue", value: "$420,320", change: "+12.5% last month", sparkData: [3, 5, 4, 7, 6, 8, 7] },
  { title: "Total Expenses", value: "$148,500", subtitle: "This Quarter", change: "-3.2% last month", sparkData: [6, 5, 7, 4, 5, 3, 4] },
  { title: "Active Workers", value: "1,205", subtitle: "On Site", change: "+8 this week", sparkData: [4, 5, 5, 6, 5, 7, 6] },
  { title: "Production Rate", value: "94.2%", change: "+2.1% last month", sparkData: [5, 6, 7, 6, 8, 7, 9] },
];

export default function Dashboard() {
  const { userProfile } = useAuth();
  const firstName = userProfile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Welcome back, {firstName}</h1>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">
              {new Date().toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:bg-foreground/90">
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SalesTrendChart />
        </div>
        <RevenueBreakdown />
      </div>

      {/* Transactions */}
      <RecentTransactions />
    </div>
  );
}
