import type { Session, User } from "@supabase/supabase-js";
import type { UserProfile, Site, UserRole } from "@/lib/supabaseTypes";

export interface SiteWithRole extends Site {
  role: UserRole;
}

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  orgId: string | null;
  sites: SiteWithRole[];
  activeSiteId: string | null;
  activeRole: UserRole | null;
  isLoading: boolean;
  setActiveSite: (siteId: string) => void;
  signOut: () => Promise<void>;
}
