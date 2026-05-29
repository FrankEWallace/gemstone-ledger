import type { Session, User } from "@supabase/supabase-js";
import type { UserProfile, Site, UserRole, OrgRole } from "@/lib/supabaseTypes";

export interface SiteWithRole extends Site {
  role: UserRole;
}

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  userProfile: UserProfile | null;
  orgId: string | null;
  /** Org-level role: owner | admin | member. Distinct from per-site `activeRole`. */
  orgRole: OrgRole | null;
  sites: SiteWithRole[];
  activeSiteId: string | null;
  activeRole: UserRole | null;
  isLoading: boolean;
  isInvitePending: boolean;
  setActiveSite: (siteId: string) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Patch the cached profile locally without a server round-trip. */
  setProfile: (profile: UserProfile) => void;
}
