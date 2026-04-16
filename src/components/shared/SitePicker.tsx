import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";

export default function SitePicker() {
  const { userProfile } = useAuth();
  const { activeSite } = useSite();
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
    <button
      onClick={() => navigate("/settings/profile")}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent/50 transition-colors"
    >
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
    </button>
  );
}
