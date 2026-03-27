import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  BarChart3,
  MessageSquare,
  TrendingUp,
  Megaphone,
  UserCircle,
  Layers,
  ShoppingCart,
  Shield,
  CreditCard,
  Plug,
  Headphones,
  HelpCircle,
  Settings,
  X,
  Pickaxe,
  Wrench,
  ShieldAlert,
  CalendarDays,
  FolderOpen,
  FileText,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SitePicker from "@/components/shared/SitePicker";
import { useSite } from "@/hooks/useSite";
import { getChannelMessageCounts } from "@/services/messages.service";

interface NavItem {
  label: string;
  icon: React.ElementType;
  to: string;
  badge?: number;
}

const mainMenu: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/" },
  { label: "Inventory", icon: Package, to: "/inventory" },
  { label: "Transactions", icon: ArrowLeftRight, to: "/transactions" },
  { label: "Reports & Analytics", icon: BarChart3, to: "/reports" },
  { label: "Messages", icon: MessageSquare, to: "/messages" },
  { label: "Team Performance", icon: TrendingUp, to: "/team" },
  { label: "Campaigns", icon: Megaphone, to: "/campaigns" },
];

const supplyChain: NavItem[] = [
  { label: "Supplier List", icon: UserCircle, to: "/supply/suppliers" },
  { label: "Channels", icon: Layers, to: "/supply/channels" },
  { label: "Order Management", icon: ShoppingCart, to: "/supply/orders" },
];

const management: NavItem[] = [
  { label: "Roles & Permissions", icon: Shield,    to: "/management/roles" },
  { label: "Billing & Subscription", icon: CreditCard, to: "/management/billing" },
  { label: "Integrations",        icon: Plug,      to: "/management/integrations" },
  { label: "Audit Log",           icon: FileText,  to: "/management/audit" },
];

const operations: NavItem[] = [
  { label: "Equipment",       icon: Wrench,       to: "/equipment" },
  { label: "Safety",          icon: ShieldAlert,  to: "/safety" },
  { label: "Shift Schedule",  icon: CalendarDays, to: "/team/schedule" },
  { label: "Documents",       icon: FolderOpen,   to: "/documents" },
];

const settingsItems: NavItem[] = [
  { label: "Alert Rules",      icon: Zap,       to: "/settings/alerts" },
  { label: "System Settings",  icon: Settings,  to: "/settings/system" },
  { label: "Help Center",      icon: HelpCircle,to: "/settings/help" },
  { label: "Customer Support", icon: Headphones,to: "/settings/support" },
];

function NavSection({ title, items, onNavigate }: { title?: string; items: NavItem[]; onNavigate: () => void }) {
  return (
    <div className="mb-4">
      {title && (
        <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      )}
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === "/"}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

const MESSAGES_SEEN_KEY = "messagesLastSeen";

export default function AppSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeSiteId } = useSite();
  const location = useLocation();
  const [unreadMessages, setUnreadMessages] = useState(0);

  // When user visits /messages, record the timestamp
  useEffect(() => {
    if (location.pathname === "/messages") {
      localStorage.setItem(MESSAGES_SEEN_KEY, new Date().toISOString());
      setUnreadMessages(0);
    }
  }, [location.pathname]);

  // Poll for new messages since last seen (every 60s when not on messages page)
  useEffect(() => {
    if (!activeSiteId || location.pathname === "/messages") return;
    const since = localStorage.getItem(MESSAGES_SEEN_KEY) ?? new Date(0).toISOString();

    getChannelMessageCounts(activeSiteId, since).then((counts) => {
      const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
      setUnreadMessages(total);
    });

    const interval = setInterval(async () => {
      const s = localStorage.getItem(MESSAGES_SEEN_KEY) ?? new Date(0).toISOString();
      const counts = await getChannelMessageCounts(activeSiteId, s);
      setUnreadMessages(Object.values(counts).reduce((sum, n) => sum + n, 0));
    }, 60_000);

    return () => clearInterval(interval);
  }, [activeSiteId, location.pathname]);

  const mainMenuWithBadge: NavItem[] = mainMenu.map((item) =>
    item.to === "/messages" ? { ...item, badge: unreadMessages } : item
  );

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-foreground/20 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Pickaxe className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Mining Co.</p>
            <p className="font-display font-semibold text-sm truncate">FW Mining OS</p>
          </div>
          <button className="lg:hidden" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <NavSection title="Main Menu" items={mainMenuWithBadge} onNavigate={onClose} />
          <NavSection title="Operations" items={operations} onNavigate={onClose} />
          <NavSection title="Supply Chain" items={supplyChain} onNavigate={onClose} />
          <NavSection title="Management" items={management} onNavigate={onClose} />
          <NavSection title="Settings" items={settingsItems} onNavigate={onClose} />
        </nav>

        {/* User / Site Picker */}
        <div className="border-t border-sidebar-border p-3">
          <SitePicker />
        </div>
      </aside>
    </>
  );
}
