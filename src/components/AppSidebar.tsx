import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  BarChart3,
  MessageSquare,
  Users as UsersIcon,
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
  ChevronDown,
  Menu,
  X,
  Pickaxe,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  icon: React.ElementType;
  active?: boolean;
}

const mainMenu: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Inventory", icon: Package },
  { label: "Transactions", icon: ArrowLeftRight },
  { label: "Reports & Analytics", icon: BarChart3 },
  { label: "Messages", icon: MessageSquare },
  { label: "Team Performance", icon: TrendingUp },
  { label: "Campaigns", icon: Megaphone },
];

const supplyChain: NavItem[] = [
  { label: "Supplier List", icon: UserCircle },
  { label: "Channels", icon: Layers },
  { label: "Order Management", icon: ShoppingCart },
];

const management: NavItem[] = [
  { label: "Roles & Permissions", icon: Shield },
  { label: "Billing & Subscription", icon: CreditCard },
  { label: "Integrations", icon: Plug },
];

const settings: NavItem[] = [
  { label: "Customer Support", icon: Headphones },
  { label: "Help Center", icon: HelpCircle },
  { label: "System Settings", icon: Settings },
];

function NavSection({ title, items }: { title?: string; items: NavItem[] }) {
  return (
    <div className="mb-4">
      {title && (
        <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      )}
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.label}>
            <button
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                item.active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
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

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <NavSection title="Main Menu" items={mainMenu} />
          <NavSection title="Supply Chain" items={supplyChain} />
          <NavSection title="Management" items={management} />
          <NavSection title="Settings" items={settings} />
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent/50">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              JD
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium truncate">John Doe</p>
              <p className="text-xs text-muted-foreground">Site Manager</p>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </aside>
    </>
  );
}
