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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

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
  { label: "Team",      icon: TrendingUp, to: "/team",            module: "team" },
  { label: "Roles",     icon: Shield,     to: "/management/roles" },
  { label: "Audit Log", icon: FileText,   to: "/management/audit" },
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

// ─── NavCustomizer ────────────────────────────────────────────────────────────

function NavCustomizer({ onClose }: { onClose: () => void }) {
  const { isSectionHidden, toggleSection } = useNav();

  return (
    <div className="absolute inset-x-0 bottom-full z-10 rounded-t-xl border border-sidebar-border bg-sidebar shadow-2xl">
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

// ─── NavItemRow ───────────────────────────────────────────────────────────────

function NavItemRow({ item }: { item: NavItem }) {
  const location = useLocation();
  const isActive =
    item.to === "/"
      ? location.pathname === "/"
      : location.pathname === item.to || location.pathname.startsWith(item.to + "/");

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
        <NavLink to={item.to} end={item.to === "/"}>
          <item.icon />
          <span>{item.label}</span>
        </NavLink>
      </SidebarMenuButton>
      {item.badge != null && item.badge > 0 && (
        <SidebarMenuBadge>{item.badge > 99 ? "99+" : item.badge}</SidebarMenuBadge>
      )}
    </SidebarMenuItem>
  );
}

// ─── NavSection ───────────────────────────────────────────────────────────────

function NavSection({
  title,
  items,
  badge,
}: {
  title?: string;
  items: NavItem[];
  badge?: React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <SidebarGroup>
      {title && (
        <SidebarGroupLabel className="flex items-center gap-1.5">
          {title}
          {badge}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <NavItemRow key={item.to} item={item} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// ─── AppSidebar ───────────────────────────────────────────────────────────────

const MESSAGES_SEEN_KEY = "messagesLastSeen";

export default function AppSidebar({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "inset" | "floating";
}) {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { activeSiteId } = useSite();
  const location = useLocation();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const { isSectionHidden } = useNav();
  const { isModuleEnabled } = useOrgModules();

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
    <Sidebar variant={variant} collapsible="icon">
      {/* Logo */}
      <SidebarHeader className="border-b border-sidebar-border py-[14px] px-4 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2">
        <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shrink-0 shadow-sm">
            <Pickaxe className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="font-display font-semibold text-sm leading-tight truncate text-sidebar-foreground">
              FW Mining OS
            </p>
            <p className="text-[11px] text-sidebar-foreground/45 leading-tight">Mining Co.</p>
          </div>
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        <NavSection title="Core" items={filterByModule(coreItems)} />

        {!isSectionHidden("operations") && (
          <NavSection title="Operations" items={filterByModule(operationsItems)} />
        )}

        {!isSectionHidden("team") && (
          <NavSection title="Team & System" items={filterByModule(teamItems)} />
        )}

        {!isSectionHidden("extensions") && visibleExtensions.length > 0 && (
          <NavSection
            title="Extensions"
            items={visibleExtensions}
            badge={
              <span className="inline-flex items-center gap-1 rounded-md bg-sidebar-accent px-1.5 py-0.5 text-[9px] font-semibold text-sidebar-foreground/50 uppercase tracking-wide group-data-[collapsible=icon]:hidden">
                <Puzzle className="h-2.5 w-2.5" />
                optional
              </span>
            }
          />
        )}

        {/* Settings pinned to bottom of nav */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItemRow item={{ label: "Settings", icon: Settings, to: "/settings" }} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer: SitePicker + customizer (hidden when icon-only) */}
      <SidebarFooter className="border-t border-sidebar-border relative">
        {!isCollapsed && (
          <>
            <div className="px-1">
              <SitePicker />
            </div>
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
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
