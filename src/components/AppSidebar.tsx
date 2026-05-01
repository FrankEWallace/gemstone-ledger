import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Users,
  BarChart3,
  MessageSquare,
  TrendingUp,
  Megaphone,
  UserCircle,
  Layers,
  ShoppingCart,
  Shield,
  Settings,
  X,
  Pickaxe,
  Wrench,
  ShieldAlert,
  CalendarDays,
  FolderOpen,
  FileText,
  Activity,
  Clock,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Puzzle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SitePicker from "@/components/shared/SitePicker";
import { useSite } from "@/hooks/useSite";
import { getChannelMessageCounts } from "@/services/messages.service";
import { useNav, type NavSectionKey } from "@/context/NavContext";
import { useOrgModules, type ModuleKey } from "@/hooks/useOrgModules";
import { useSystemAlerts } from "@/hooks/useSystemAlerts";

interface NavItem {
  label: string;
  icon: React.ElementType;
  to: string;
  badge?: number;
  module?: ModuleKey;
}

// ─── Nav groups ───────────────────────────────────────────────────────────────

const coreItems: NavItem[] = [
  { label: "Dashboard",    icon: LayoutDashboard, to: "/" },
  { label: "Activity",     icon: Activity,        to: "/activity" },
  { label: "Customers",    icon: Users,           to: "/customers",     module: "customers" },
  { label: "Transactions", icon: ArrowLeftRight,  to: "/transactions" },
  { label: "Inventory",    icon: Package,         to: "/inventory" },
  { label: "Reports",      icon: BarChart3,       to: "/reports",       module: "reports" },
];

const operationsItems: NavItem[] = [
  { label: "Suppliers", icon: UserCircle,   to: "/supply/suppliers", module: "supply_chain" },
  { label: "Orders",    icon: ShoppingCart, to: "/supply/orders",    module: "supply_chain" },
];

const teamItems: NavItem[] = [
  { label: "Team",        icon: TrendingUp, to: "/team",              module: "team" },
  { label: "Roles",       icon: Shield,     to: "/management/roles" },
  { label: "Audit Log",   icon: FileText,   to: "/management/audit" },
];

const extensionItems: NavItem[] = [
  { label: "Equipment",  icon: Wrench,        to: "/equipment",        module: "operations" },
  { label: "Safety",     icon: ShieldAlert,   to: "/safety",           module: "operations" },
  { label: "Schedules",  icon: CalendarDays,  to: "/team/schedule",    module: "team" },
  { label: "Timesheets", icon: Clock,         to: "/team/timesheet",   module: "team" },
  { label: "Production", icon: Pickaxe,       to: "/production",       module: "operations" },
  { label: "Documents",  icon: FolderOpen,    to: "/documents",        module: "operations" },
  { label: "Messages",   icon: MessageSquare, to: "/messages",         module: "messages" },
  { label: "Campaigns",  icon: Megaphone,     to: "/campaigns",        module: "campaigns" },
  { label: "Channels",   icon: Layers,        to: "/supply/channels",  module: "supply_chain" },
];

const TOGGLEABLE_SECTIONS: { key: NavSectionKey; label: string; description: string }[] = [
  { key: "operations", label: "Operations",    description: "Suppliers and order management" },
  { key: "team",       label: "Team & System", description: "Team, roles, and audit log" },
  { key: "extensions", label: "Extensions",    description: "Equipment, production, messages…" },
];

// ─── NavSection ───────────────────────────────────────────────────────────────

function NavSection({
  title,
  items,
  onNavigate,
  badge,
}: {
  title?: string;
  items: NavItem[];
  onNavigate: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      {title && (
        <div className="flex items-center gap-1.5 px-3 mb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            {title}
          </p>
          {badge}
        </div>
      )}
      <ul className="space-y-px">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === "/"}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "relative flex w-full items-center gap-2.5 rounded-md px-3 py-[7px] text-sm transition-all duration-150",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )
              }
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-sidebar-primary" />
                  )}
                  <item.icon
                    className={cn(
                      "h-[15px] w-[15px] shrink-0 transition-opacity",
                      isActive ? "opacity-80" : "opacity-45"
                    )}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-sidebar-primary text-[10px] font-bold text-sidebar-primary-foreground px-1">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── NavCustomizer ────────────────────────────────────────────────────────────

function NavCustomizer({ onClose }: { onClose: () => void }) {
  const { isSectionHidden, toggleSection } = useNav();

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 rounded-t-xl border border-sidebar-border bg-sidebar shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
        <p className="text-sm font-semibold">Customize sidebar</p>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-3 py-2 space-y-px max-h-64 overflow-y-auto">
        {TOGGLEABLE_SECTIONS.map((section) => {
          const hidden = isSectionHidden(section.key);
          return (
            <button
              key={section.key}
              onClick={() => toggleSection(section.key)}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-sidebar-accent/50",
                hidden && "opacity-50"
              )}
            >
              <span className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md border shrink-0 transition-colors",
                hidden
                  ? "border-sidebar-border bg-sidebar text-sidebar-foreground/40"
                  : "border-sidebar-primary/30 bg-sidebar-primary/10 text-sidebar-primary"
              )}>
                {hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{section.label}</p>
                <p className="text-[11px] text-sidebar-foreground/50 truncate">{section.description}</p>
              </div>
              <span className={cn(
                "inline-flex h-5 w-9 shrink-0 rounded-full border-2 transition-colors",
                hidden ? "border-sidebar-border bg-sidebar-border" : "border-sidebar-primary bg-sidebar-primary"
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
      <div className="px-4 py-2.5 border-t border-sidebar-border">
        <p className="text-[11px] text-sidebar-foreground/40 text-center">Saved to this browser</p>
      </div>
    </div>
  );
}

// ─── AppSidebar ───────────────────────────────────────────────────────────────

const MESSAGES_SEEN_KEY = "messagesLastSeen";

export default function AppSidebar({ open, onClose, desktopOpen = true }: { open: boolean; onClose: () => void; desktopOpen?: boolean }) {
  const { activeSiteId } = useSite();
  const location = useLocation();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const { isSectionHidden } = useNav();
  const { isModuleEnabled } = useOrgModules();
  const { totalCount: alertCount } = useSystemAlerts(activeSiteId ?? null);

  const filterByModule = (items: NavItem[]) =>
    items.filter((item) => !item.module || isModuleEnabled(item.module));

  useEffect(() => {
    if (location.pathname === "/messages") {
      localStorage.setItem(MESSAGES_SEEN_KEY, new Date().toISOString());
      setUnreadMessages(0);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!activeSiteId || location.pathname === "/messages") return;
    const since = localStorage.getItem(MESSAGES_SEEN_KEY) ?? new Date(0).toISOString();

    getChannelMessageCounts(activeSiteId, since).then((counts) => {
      setUnreadMessages(Object.values(counts).reduce((sum, n) => sum + n, 0));
    });

    const interval = setInterval(async () => {
      const s = localStorage.getItem(MESSAGES_SEEN_KEY) ?? new Date(0).toISOString();
      const counts = await getChannelMessageCounts(activeSiteId, s);
      setUnreadMessages(Object.values(counts).reduce((sum, n) => sum + n, 0));
    }, 60_000);

    return () => clearInterval(interval);
  }, [activeSiteId, location.pathname]);

  const extensionsWithBadge: NavItem[] = extensionItems.map((item) =>
    item.to === "/messages" ? { ...item, badge: unreadMessages } : item
  );

  const visibleExtensions = filterByModule(extensionsWithBadge);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[1px] lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          !desktopOpen && "lg:hidden"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 py-[14px]">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shrink-0 shadow-sm">
            <Pickaxe className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-sm leading-tight truncate text-sidebar-foreground">
              FW Mining OS
            </p>
            <p className="text-[11px] text-sidebar-foreground/45 leading-tight">Mining Co.</p>
          </div>
          <button
            className="lg:hidden rounded-md p-1 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin">
          <NavSection title="Core" items={filterByModule(coreItems)} onNavigate={onClose} />

          {!isSectionHidden("operations") && (() => {
            const items = filterByModule(operationsItems);
            return items.length > 0 ? (
              <NavSection title="Operations" items={items} onNavigate={onClose} />
            ) : null;
          })()}

          {!isSectionHidden("team") && (() => {
            const items = filterByModule(teamItems);
            return items.length > 0 ? (
              <NavSection title="Team & System" items={items} onNavigate={onClose} />
            ) : null;
          })()}

          {!isSectionHidden("extensions") && visibleExtensions.length > 0 && (
            <NavSection
              title="Extensions"
              items={visibleExtensions}
              onNavigate={onClose}
              badge={
                <span className="inline-flex items-center gap-1 rounded-md bg-sidebar-accent px-1.5 py-0.5 text-[9px] font-semibold text-sidebar-foreground/50 uppercase tracking-wide">
                  <Puzzle className="h-2.5 w-2.5" />
                  optional
                </span>
              }
            />
          )}
        </nav>

        {/* Settings — pinned above footer */}
        <div className="border-t border-sidebar-border px-2 py-2">
          <NavLink
            to="/settings"
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "relative flex w-full items-center gap-2.5 rounded-md px-3 py-[7px] text-sm transition-all duration-150",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )
            }
          >
            {({ isActive }: { isActive: boolean }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-sidebar-primary" />
                )}
                <Settings className={cn("h-[15px] w-[15px] shrink-0 transition-opacity", isActive ? "opacity-80" : "opacity-45")} />
                <span>Settings</span>
              </>
            )}
          </NavLink>
        </div>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-3 relative">
          <SitePicker />
          <button
            onClick={() => setCustomizerOpen((o) => !o)}
            title="Customize sidebar"
            className={cn(
              "absolute top-3 right-3 rounded-md p-1.5 transition-colors",
              customizerOpen
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/40 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>

          {customizerOpen && (
            <NavCustomizer onClose={() => setCustomizerOpen(false)} />
          )}
        </div>
      </aside>
    </>
  );
}
