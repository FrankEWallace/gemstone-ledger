import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { avatarSrc } from "@/lib/avatar";
import EntityAvatar from "@/components/shared/EntityAvatar";

export default function SitePicker() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/settings/profile")}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent/50 transition-colors"
    >
      <EntityAvatar
        name={userProfile?.full_name}
        seed={userProfile?.id}
        src={userProfile ? avatarSrc(userProfile.avatar_url, userProfile.id) : null}
        className="h-8 w-8 text-xs"
      />
      <div className="flex-1 text-left min-w-0">
        <p className="text-sm font-medium truncate">
          {userProfile?.full_name ?? "Profile"}
        </p>
        <p className="text-xs text-muted-foreground truncate">View profile & settings</p>
      </div>
    </button>
  );
}
