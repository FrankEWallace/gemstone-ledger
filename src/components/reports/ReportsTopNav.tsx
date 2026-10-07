import { NavLink, useLocation, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { BarChart3, Package, Pickaxe } from "lucide-react";
import { DEFAULT_FROM, DEFAULT_TO } from "@/hooks/useReportDateRange";

export const REPORTS_LAST_VIEWED_KEY = "reports:lastViewed";

type Bucket = "production" | "overview" | "inventory";

const TABS: { to: string; label: string; icon: React.ElementType; bucket: Bucket }[] = [
  { to: "/reports/production", label: "Production",        icon: Pickaxe,   bucket: "production" },
  { to: "/reports/overview",   label: "Finance Overview",   icon: BarChart3, bucket: "overview" },
  { to: "/reports/inventory",  label: "Inventory Overview", icon: Package,   bucket: "inventory" },
];

function bucketForPath(pathname: string): Bucket {
  if (pathname.startsWith("/reports/production")) return "production";
  if (pathname.startsWith("/reports/inventory")) return "inventory";
  return "overview";
}

export default function ReportsTopNav() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from") ?? DEFAULT_FROM;
  const to   = searchParams.get("to")   ?? DEFAULT_TO;
  const dateQuery = `?from=${from}&to=${to}`;
  const activeBucket = bucketForPath(location.pathname);

  useEffect(() => {
    try {
      localStorage.setItem(REPORTS_LAST_VIEWED_KEY, activeBucket);
    } catch {
      // storage unavailable (e.g. private browsing) — redirect just falls back to the default
    }
  }, [activeBucket]);

  return (
    <div className="sticky top-0 z-20 -mx-4 lg:-mx-6 border-b border-border bg-background/90 backdrop-blur-sm">
      <nav className="flex items-center overflow-x-auto scrollbar-none px-4 lg:px-6">
        {TABS.map(({ to: href, label, icon: Icon, bucket }) => {
          const isActive = bucket === activeBucket;
          return (
            <NavLink
              key={href}
              to={`${href}${dateQuery}`}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
