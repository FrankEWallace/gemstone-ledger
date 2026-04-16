import { MapPin, ChevronDown, LogOut, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function SitePicker() {
  const { userProfile, signOut } = useAuth();
  const { activeSite, sites, setActiveSite } = useSite();
  const navigate = useNavigate();

  const initials = userProfile?.full_name
    ? userProfile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent/50 transition-colors">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {initials}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium truncate">
              {userProfile?.full_name ?? "Loading..."}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {activeSite?.name ?? "No site selected"}
            </p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="top" className="w-56">
        {sites.length > 1 && (
          <>
            <DropdownMenuLabel className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
              <MapPin className="h-3 w-3" />
              Switch site
            </DropdownMenuLabel>
            {sites.map((site) => (
              <DropdownMenuItem
                key={site.id}
                onClick={() => setActiveSite(site.id)}
                className="flex items-center justify-between"
              >
                <span className="truncate">{site.name}</span>
                {site.id === activeSite?.id && (
                  <span className="ml-2 h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => navigate("/settings/profile")}>
          <User className="mr-2 h-4 w-4" />
          Profile settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
