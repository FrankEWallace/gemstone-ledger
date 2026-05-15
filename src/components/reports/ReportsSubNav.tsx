import { NavLink, useSearchParams } from "react-router-dom";
import { BarChart3, TrendingDown, TrendingUp, Users, Package } from "lucide-react";
import { DEFAULT_FROM, DEFAULT_TO } from "@/hooks/useReportDateRange";

const LINKS = [
  { to: "/reports/overview",  label: "Overview",  icon: BarChart3 },
  { to: "/reports/expenses",  label: "Expenses",  icon: TrendingDown },
  { to: "/reports/income",    label: "Income",    icon: TrendingUp },
  { to: "/reports/customers", label: "Customers", icon: Users },
  { to: "/reports/inventory", label: "Inventory", icon: Package },
];

export default function ReportsSubNav() {
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from") ?? DEFAULT_FROM;
  const to   = searchParams.get("to")   ?? DEFAULT_TO;
  const dateQuery = `?from=${from}&to=${to}`;

  return (
    <div className="sticky top-0 z-10 -mx-4 lg:-mx-6 border-b border-border bg-background/90 backdrop-blur-sm">
      <nav className="flex items-center overflow-x-auto scrollbar-none px-4 lg:px-6">
        {LINKS.map(({ to: href, label, icon: Icon }) => (
          <NavLink
            key={href}
            to={`${href}${dateQuery}`}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
