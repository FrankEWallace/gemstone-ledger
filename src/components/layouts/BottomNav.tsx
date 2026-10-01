import { NavLink, Link } from "react-router-dom";
import { ArrowLeftRight, LayoutDashboard, Menu, Plus, Users, type LucideIcon } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

function Tab({ to, label, icon: Icon, end }: { to: string; label: string; icon: LucideIcon; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors",
          isActive ? "text-foreground" : "text-muted-foreground",
        )
      }
    >
      <Icon className="h-5 w-5" />
      {label}
    </NavLink>
  );
}

/** Phone-only tab bar for the main app; "More" opens the full sidebar. */
export default function BottomNav() {
  const { setOpenMobile } = useSidebar();

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-sm lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch">
        <Tab to="/" label="Home" icon={LayoutDashboard} end />
        <Tab to="/transactions" label="Ledger" icon={ArrowLeftRight} />
        <div className="flex w-16 shrink-0 items-center justify-center">
          <Link
            to="/capture?new=1"
            aria-label="New entry"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
          >
            <Plus className="h-5 w-5" />
          </Link>
        </div>
        <Tab to="/customers" label="Customers" icon={Users} />
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className="flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium text-muted-foreground transition-colors"
        >
          <Menu className="h-5 w-5" />
          More
        </button>
      </div>
    </nav>
  );
}
