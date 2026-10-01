import { useState } from "react";
import { ChevronDown, ChevronsUpDown, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";
import EntityAvatar from "@/components/shared/EntityAvatar";
import CreateSiteDialog from "@/components/shared/CreateSiteDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Active-site picker. `card` sits under the brand in the sidebar and shows the
 * site's location; `compact` is the one-line version for the phone top bar.
 */
export default function SiteSwitcher({
  variant,
  collapsed = false,
}: {
  variant: "card" | "compact";
  /** Icon-only sidebar: show just the site tile. */
  collapsed?: boolean;
}) {
  const { activeSite, sites, setActiveSite } = useSite();
  const { orgRole } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const canCreate = orgRole === "owner" || orgRole === "admin";

  if (!activeSite) return null;

  const interactive = sites.length > 1 || canCreate;
  const isCard = variant === "card";

  const face = (
    <>
      <EntityAvatar
        name={activeSite.name}
        seed={activeSite.id}
        shape="square"
        className={isCard ? "h-8 w-8 text-xs" : "h-6 w-6 text-xs"}
      />
      {collapsed ? null : isCard ? (
        <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
          <span className="truncate text-sm font-medium">{activeSite.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {activeSite.location || activeSite.role}
          </span>
        </span>
      ) : (
        <span className="max-w-40 truncate text-sm font-medium">{activeSite.name}</span>
      )}
    </>
  );

  const shell = collapsed
    ? "flex items-center justify-center rounded-md"
    : isCard
      ? "flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-background p-2"
      : "flex items-center gap-2 rounded-md px-1.5 py-1";

  if (!interactive) {
    return <div className={cn(shell, "text-foreground")}>{face}</div>;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(shell, "text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")} aria-label="Switch site">
            {face}
            {collapsed ? null : isCard ? (
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className={isCard ? "w-(--radix-dropdown-menu-trigger-width) min-w-56" : "w-56"}>
          {sites.map((s) => (
            <DropdownMenuItem
              key={s.id}
              onClick={() => setActiveSite(s.id)}
              className={cn("gap-2", s.id === activeSite.id && "font-medium text-primary")}
            >
              <EntityAvatar name={s.name} seed={s.id} shape="square" className="h-6 w-6 text-xs" />
              <span className="truncate">{s.name}</span>
            </DropdownMenuItem>
          ))}
          {canCreate && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setCreateOpen(true)} className="gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Plus className="h-3.5 w-3.5" />
                </span>
                <span>New site</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {canCreate && <CreateSiteDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </>
  );
}
