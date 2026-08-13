import { useEffect, useState } from "react";
import { NavLink, Outlet, Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutList, Tag, Users, Plus, ArrowLeft, Ellipsis } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSite } from "@/hooks/useSite";
import { OfflineBanner } from "@/components/shared/OfflineBanner";
import EntryPad from "./EntryPad";
import type { Transaction } from "@/lib/supabaseTypes";

/** Shared via <Outlet context> so capture tabs can open the pad to add or edit. */
export type CaptureContext = { openEntry: (tx?: Transaction) => void };

const TABS = [
  { to: "/capture", label: "Ledger", icon: LayoutList, end: true },
  { to: "/capture/prices", label: "Prices", icon: Tag, end: false },
  { to: "/capture/customers", label: "Customers", icon: Users, end: false },
  { to: "/capture/more", label: "More", icon: Ellipsis, end: false },
];

export default function CaptureLayout() {
  const [entryOpen, setEntryOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const { activeSite } = useSite();

  const openEntry = (tx?: Transaction) => {
    setEditTx(tx ?? null);
    setEntryOpen(true);
  };

  // Home-screen shortcut "New entry" deep-links to /capture?new=1 — open the pad.
  useEffect(() => {
    if (params.get("new") === "1") {
      setEntryOpen(true);
      params.delete("new");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  return (
    <div className="min-h-[100dvh] bg-muted dark:bg-background">
      <div className="relative flex min-h-[100dvh] w-full flex-col bg-muted dark:bg-background">
        <header
          className="flex items-center justify-between border-b px-4 pb-3"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className="truncate text-sm font-semibold">{activeSite?.name ?? "Mining OS"}</span>
          </div>
          <Link to="/" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Full app
          </Link>
        </header>

        <OfflineBanner />

        <main className="flex-1 overflow-y-auto bg-muted dark:bg-background" style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}>
          <Outlet context={{ openEntry } satisfies CaptureContext} />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-muted/95 backdrop-blur dark:bg-background/95">
          <div className="flex items-stretch" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            <Tab {...TABS[0]} />
            <Tab {...TABS[1]} />
            <div className="relative flex w-16 shrink-0 justify-center">
              <button
                aria-label="New entry"
                onClick={() => openEntry()}
                className="absolute -top-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-muted transition-transform active:scale-95 dark:ring-background"
              >
                <Plus className="h-6 w-6" />
              </button>
            </div>
            <Tab {...TABS[2]} />
            <Tab {...TABS[3]} />
          </div>
        </nav>
      </div>

      <EntryPad
        open={entryOpen}
        editTx={editTx}
        onOpenChange={(v) => {
          setEntryOpen(v);
          if (!v) setEditTx(null);
        }}
        onSaved={() => qc.invalidateQueries({ queryKey: ["capture"] })}
      />
    </div>
  );
}

function Tab({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof LayoutList; end: boolean }) {
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
