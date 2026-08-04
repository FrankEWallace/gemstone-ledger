import { useEffect, useState } from "react";
import { NavLink, Outlet, Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollText, Tags, Users, Plus, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSite } from "@/hooks/useSite";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import EntryPad from "./EntryPad";

const TABS = [
  { to: "/capture", label: "Ledger", icon: ScrollText, end: true },
  { to: "/capture/prices", label: "Prices", icon: Tags, end: false },
  { to: "/capture/customers", label: "Customers", icon: Users, end: false },
];

export default function CaptureLayout() {
  const [entryOpen, setEntryOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const { activeSite } = useSite();

  // Home-screen shortcut "New entry" deep-links to /capture?new=1 — open the pad.
  useEffect(() => {
    if (params.get("new") === "1") {
      setEntryOpen(true);
      params.delete("new");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="relative flex min-h-[100dvh] w-full flex-col bg-background">
        <header
          className="flex items-center justify-between border-b px-4 pb-3"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold">Capture</span>
            {activeSite && <span className="truncate text-xs text-muted-foreground">· {activeSite.name}</span>}
          </div>
          <Link to="/" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Full app
          </Link>
        </header>

        <OfflineBanner />

        <main className="flex-1 overflow-y-auto bg-muted/30" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}>
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 backdrop-blur">
          <div className="flex items-stretch" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            <Tab {...TABS[0]} />
            <Tab {...TABS[1]} />
            <div className="relative flex w-16 shrink-0 justify-center">
              <button
                aria-label="New entry"
                onClick={() => setEntryOpen(true)}
                className="absolute -top-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95"
              >
                <Plus className="h-6 w-6" />
              </button>
            </div>
            <Tab {...TABS[2]} />
            <div className="w-16 shrink-0" aria-hidden />
          </div>
        </nav>
      </div>

      <EntryPad
        open={entryOpen}
        onOpenChange={setEntryOpen}
        onSaved={() => qc.invalidateQueries({ queryKey: ["capture"] })}
      />
    </div>
  );
}

function Tab({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof ScrollText; end: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px]",
          isActive ? "text-primary" : "text-muted-foreground",
        )
      }
    >
      <Icon className="h-5 w-5" />
      {label}
    </NavLink>
  );
}
