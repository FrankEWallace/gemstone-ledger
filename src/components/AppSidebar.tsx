import { NavLink } from "react-router-dom";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import SitePicker from "@/components/shared/SitePicker";

interface NavItem {
  label: string;
  icon: React.ElementType;
  to: string;
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
  { label: "Roles & Permissions", icon: Shield, to: "/management/roles" },
  { label: "Billing & Subscription", icon: CreditCard, to: "/management/billing" },
  { label: "Integrations", icon: Plug, to: "/management/integrations" },
];

const settingsItems: NavItem[] = [
  { label: "Customer Support", icon: Headphones, to: "/settings/support" },
  { label: "Help Center", icon: HelpCircle, to: "/settings/help" },
  { label: "System Settings", icon: Settings, to: "/settings/system" },
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
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AppSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <NavSection title="Main Menu" items={mainMenu} onNavigate={onClose} />
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
