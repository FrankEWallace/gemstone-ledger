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
  Target,
  Clock,
  SlidersHorizontal,
  Eye,
  EyeOff,
  CloudOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SitePicker from "@/components/shared/SitePicker";
import { useSite } from "@/hooks/useSite";
import { getChannelMessageCounts } from "@/services/messages.service";
import { useNav, type NavSectionKey } from "@/context/NavContext";

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
  { label: "Timesheets",      icon: Clock,        to: "/team/timesheet" },
  { label: "Production Log",  icon: Pickaxe,      to: "/production" },
  { label: "Documents",       icon: FolderOpen,   to: "/documents" },
];

const settingsItems: NavItem[] = [
  { label: "KPI Targets",      icon: Target,    to: "/settings/targets" },
  { label: "Alert Rules",      icon: Zap,       to: "/settings/alerts" },
  { label: "Offline Sync",     icon: CloudOff,  to: "/settings/sync" },
  { label: "System Settings",  icon: Settings,  to: "/settings/system" },
  { label: "Help Center",      icon: HelpCircle,to: "/settings/help" },
  { label: "Customer Support", icon: Headphones,to: "/settings/support" },
];

// Section metadata for the customizer
const NAV_SECTIONS: { key: NavSectionKey; label: string; description: string }[] = [
  { key: "main",       label: "Main Menu",    description: "Dashboard, Inventory, Transactions, Reports…" },
  { key: "operations", label: "Operations",   description: "Equipment, Safety, Schedules, Production…" },
  { key: "supply",     label: "Supply Chain", description: "Suppliers, Channels, Orders" },
  { key: "management", label: "Management",   description: "Roles, Billing, Integrations, Audit" },
  { key: "settings",   label: "Settings",     description: "KPI Targets, Alerts, System, Help" },
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

// ─── Nav Customizer Panel ─────────────────────────────────────────────────────

function NavCustomizer({ onClose }: { onClose: () => void }) {
  const { isSectionHidden, toggleSection } = useNav();

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-2xl border border-sidebar-border bg-sidebar shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
        <div>
          <p className="text-sm font-semibold">Customize Navigation</p>
          <p className="text-xs text-muted-foreground mt-0.5">Show or hide sidebar sections</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 hover:bg-sidebar-accent transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-4 py-3 space-y-1 max-h-72 overflow-y-auto">
        {NAV_SECTIONS.map((section) => {
          const hidden = isSectionHidden(section.key);
          return (
            <button
              key={section.key}
              onClick={() => toggleSection(section.key)}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                hidden
                  ? "opacity-50 hover:opacity-70"
                  : "hover:bg-sidebar-accent/50"
              )}
            >
              <span className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md border transition-colors shrink-0",
                hidden
                  ? "border-border bg-card text-muted-foreground"
                  : "border-primary/30 bg-primary/10 text-primary"
              )}>
                {hidden
                  ? <EyeOff className="h-3.5 w-3.5" />
                  : <Eye className="h-3.5 w-3.5" />
                }
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{section.label}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{section.description}</p>
              </div>
              {/* Toggle pill */}
              <span className={cn(
                "inline-flex h-5 w-9 shrink-0 rounded-full border-2 transition-colors",
                hidden ? "border-muted bg-muted" : "border-primary bg-primary"
              )}>
                <span className={cn(
                  "h-4 w-4 rounded-full bg-white shadow transition-transform",
                  hidden ? "translate-x-0" : "translate-x-4"
                )} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="px-4 py-3 border-t border-sidebar-border">
        <p className="text-[11px] text-muted-foreground text-center">
          Preferences saved to this browser
        </p>
      </div>
    </div>
  );
}

const MESSAGES_SEEN_KEY = "messagesLastSeen";

export default function AppSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeSiteId } = useSite();
  const location = useLocation();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const { isSectionHidden } = useNav();

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
          {!isSectionHidden("main") && (
            <NavSection title="Main Menu" items={mainMenuWithBadge} onNavigate={onClose} />
          )}
          {!isSectionHidden("operations") && (
            <NavSection title="Operations" items={operations} onNavigate={onClose} />
          )}
          {!isSectionHidden("supply") && (
            <NavSection title="Supply Chain" items={supplyChain} onNavigate={onClose} />
          )}
          {!isSectionHidden("management") && (
            <NavSection title="Management" items={management} onNavigate={onClose} />
          )}
          {!isSectionHidden("settings") && (
            <NavSection title="Settings" items={settingsItems} onNavigate={onClose} />
          )}
        </nav>

        {/* Footer: Site Picker + Customize button */}
        <div className="border-t border-sidebar-border p-3 relative">
          <SitePicker />
          <button
            onClick={() => setCustomizerOpen((o) => !o)}
            title="Customize navigation"
            className={cn(
              "absolute top-3 right-3 rounded-lg p-1.5 transition-colors",
              customizerOpen
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>

          {customizerOpen && (
            <NavCustomizer onClose={() => setCustomizerOpen(false)} />
          )}
        </div>
      </aside>
    </>
  );
}
