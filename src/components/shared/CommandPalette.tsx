import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import {
  Package,
  ArrowLeftRight,
  Wrench,
  ShieldAlert,
  FileText,
  Users,
  Search,
  LayoutDashboard,
  BarChart3,
  MessageSquare,
  Megaphone,
  UserCircle,
  ShoppingCart,
  CalendarDays,
  FolderOpen,
  Layers,
  Shield,
  Settings,
} from "lucide-react";
import { useSite } from "@/hooks/useSite";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  label: string;
  sub?: string;
  icon: React.ElementType;
  href: string;
  group: string;
}

// ─── Static navigation items ─────────────────────────────────────────────────

const NAV_ITEMS: SearchResult[] = [
  { id: "nav-dashboard",   label: "Dashboard",         icon: LayoutDashboard, href: "/",                      group: "Navigation" },
  { id: "nav-inventory",   label: "Inventory",         icon: Package,         href: "/inventory",             group: "Navigation" },
  { id: "nav-transactions",label: "Transactions",      icon: ArrowLeftRight,  href: "/transactions",          group: "Navigation" },
  { id: "nav-reports",     label: "Reports",           icon: BarChart3,       href: "/reports",               group: "Navigation" },
  { id: "nav-messages",    label: "Messages",          icon: MessageSquare,   href: "/messages",              group: "Navigation" },
  { id: "nav-campaigns",   label: "Campaigns",         icon: Megaphone,       href: "/campaigns",             group: "Navigation" },
  { id: "nav-equipment",   label: "Equipment",         icon: Wrench,          href: "/equipment",             group: "Navigation" },
  { id: "nav-safety",      label: "Safety Incidents",  icon: ShieldAlert,     href: "/safety",                group: "Navigation" },
  { id: "nav-schedule",    label: "Shift Schedule",    icon: CalendarDays,    href: "/team/schedule",         group: "Navigation" },
  { id: "nav-documents",   label: "Documents",         icon: FolderOpen,      href: "/documents",             group: "Navigation" },
  { id: "nav-suppliers",   label: "Suppliers",         icon: UserCircle,      href: "/supply/suppliers",      group: "Navigation" },
  { id: "nav-channels",    label: "Channels",          icon: Layers,          href: "/supply/channels",       group: "Navigation" },
  { id: "nav-orders",      label: "Orders",            icon: ShoppingCart,    href: "/supply/orders",         group: "Navigation" },
  { id: "nav-roles",       label: "Roles & Permissions",icon: Shield,         href: "/management/roles",      group: "Navigation" },
  { id: "nav-audit",       label: "Audit Log",         icon: FileText,        href: "/management/audit",      group: "Navigation" },
  { id: "nav-system",      label: "System Settings",   icon: Settings,        href: "/settings/system",       group: "Navigation" },
  { id: "nav-alerts",      label: "Alert Rules",       icon: ShieldAlert,     href: "/settings/alerts",       group: "Navigation" },
];

// ─── Command Palette ──────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { activeSiteId } = useSite();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) onClose();
        else {
          // trigger open via parent — this component only handles close
        }
      }
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || !activeSiteId) {
      setResults([]);
      return;
    }
    setIsSearching(true);

    const term = `%${q}%`;
    const [inv, equip, workers, incidents, docs] = await Promise.allSettled([
      supabase.from("inventory_items").select("id,name,category").eq("site_id", activeSiteId).ilike("name", term).limit(4),
      supabase.from("equipment").select("id,name,type").eq("site_id", activeSiteId).ilike("name", term).limit(4),
      supabase.from("workers").select("id,full_name,position").eq("site_id", activeSiteId).ilike("full_name", term).limit(4),
      supabase.from("safety_incidents").select("id,title,severity").eq("site_id", activeSiteId).ilike("title", term).limit(4),
      supabase.from("site_documents").select("id,name,category").eq("site_id", activeSiteId).ilike("name", term).limit(4),
    ]);

    const out: SearchResult[] = [];

    if (inv.status === "fulfilled" && inv.value.data) {
      inv.value.data.forEach((r) => out.push({ id: `inv-${r.id}`, label: r.name, sub: r.category ?? undefined, icon: Package, href: "/inventory", group: "Inventory" }));
    }
    if (equip.status === "fulfilled" && equip.value.data) {
      equip.value.data.forEach((r) => out.push({ id: `eq-${r.id}`, label: r.name, sub: r.type ?? undefined, icon: Wrench, href: "/equipment", group: "Equipment" }));
    }
    if (workers.status === "fulfilled" && workers.value.data) {
      workers.value.data.forEach((r) => out.push({ id: `w-${r.id}`, label: r.full_name, sub: r.position ?? undefined, icon: Users, href: "/team", group: "Team" }));
    }
    if (incidents.status === "fulfilled" && incidents.value.data) {
      incidents.value.data.forEach((r) => out.push({ id: `si-${r.id}`, label: r.title, sub: r.severity, icon: ShieldAlert, href: "/safety", group: "Safety" }));
    }
    if (docs.status === "fulfilled" && docs.value.data) {
      docs.value.data.forEach((r) => out.push({ id: `doc-${r.id}`, label: r.name, sub: r.category ?? undefined, icon: FolderOpen, href: "/documents", group: "Documents" }));
    }

    setResults(out);
    setIsSearching(false);
  }, [activeSiteId]);

  useEffect(() => {
    const t = setTimeout(() => search(query), 200);
    return () => clearTimeout(t);
  }, [query, search]);

  function go(href: string) {
    navigate(href);
    onClose();
  }

  // Nav items filtered by query (client-side)
  const filteredNav = query.trim()
    ? NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(query.toLowerCase()))
    : NAV_ITEMS;

  const groups = query.trim()
    ? [...new Set(results.map((r) => r.group))]
    : [];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-xl mx-4 rounded-xl border border-border bg-popover shadow-2xl overflow-hidden">
        <Command shouldFilter={false} className="[&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:border-border">
          <div className="flex items-center gap-2 px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search pages, inventory, equipment, workers…"
              className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden sm:inline-flex shrink-0 h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            {isSearching && (
              <Command.Loading>
                <div className="py-6 text-center text-sm text-muted-foreground">Searching…</div>
              </Command.Loading>
            )}

            {/* Live search results */}
            {!isSearching && query.trim() && results.length === 0 && filteredNav.length === 0 && (
              <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                No results for "{query}"
              </Command.Empty>
            )}

            {/* DB results grouped */}
            {groups.map((group) => (
              <Command.Group key={group} heading={group} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground">
                {results.filter((r) => r.group === group).map((r) => {
                  const Icon = r.icon;
                  return (
                    <Command.Item
                      key={r.id}
                      value={r.id}
                      onSelect={() => go(r.href)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 font-medium truncate">{r.label}</span>
                      {r.sub && <span className="text-xs text-muted-foreground capitalize">{r.sub}</span>}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}

            {/* Navigation items */}
            {filteredNav.length > 0 && (
              <Command.Group heading={query.trim() ? "Pages" : "Navigate to"} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground">
                {filteredNav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.id}
                      value={item.id}
                      onSelect={() => go(item.href)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1">{item.label}</span>
                      <span className="text-xs text-muted-foreground">↵</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
