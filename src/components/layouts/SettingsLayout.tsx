import { useState, useRef, useEffect } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  UserCircle,
  Tag,
  Target,
  Zap,
  Plug,
  CreditCard,
  Settings,
  HelpCircle,
  Headphones,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Profile",      icon: UserCircle,  to: "/settings/profile" },
  { label: "Categories",   icon: Tag,         to: "/settings/expense-categories" },
  { label: "KPI Targets",  icon: Target,      to: "/settings/targets" },
  { label: "Alert Rules",  icon: Zap,         to: "/settings/alerts" },
  { label: "Integrations", icon: Plug,        to: "/settings/integrations" },
  { label: "Billing",      icon: CreditCard,  to: "/settings/billing" },
  { label: "System",       icon: Settings,    to: "/settings/system" },
  { label: "Help",         icon: HelpCircle,  to: "/settings/help" },
  { label: "Support",      icon: Headphones,  to: "/settings/support" },
];

export default function SettingsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeTab = TABS.find((t) => location.pathname === t.to) ?? TABS[0];

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky settings tab bar — sits directly below the app header (h-14 = 56px) */}
      <div className="sticky top-14 z-20 border-b border-border bg-card">

        {/* Desktop: scrollable underline tabs */}
        <nav
          className="hidden sm:flex overflow-x-auto px-4 lg:px-6"
          aria-label="Settings sections"
        >
          {TABS.map((tab) => {
            const isActive = location.pathname === tab.to;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <tab.icon className="h-3.5 w-3.5 shrink-0" />
                {tab.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Mobile: active tab name + chevron → dropdown */}
        <div className="sm:hidden px-4 py-2 relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium"
          >
            <div className="flex items-center gap-2 text-foreground">
              <activeTab.icon className="h-4 w-4 text-muted-foreground" />
              <span>{activeTab.label}</span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-150",
                dropdownOpen && "rotate-180"
              )}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute left-4 right-4 top-full mt-1 z-50 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
              {TABS.map((tab) => {
                const isActive = location.pathname === tab.to;
                return (
                  <button
                    key={tab.to}
                    onClick={() => {
                      navigate(tab.to);
                      setDropdownOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <tab.icon className="h-4 w-4 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Outlet />
    </div>
  );
}
