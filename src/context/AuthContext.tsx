import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { UserProfile } from "@/lib/supabaseTypes";
import type { AuthContextValue, SiteWithRole } from "@/types/auth";
import { isDemoMode, exitDemoMode, DEMO_USER_ID, DEMO_SITE_ID, DEMO_ORG_ID } from "@/lib/demo";
import { DEMO_USER_PROFILE, DEMO_SITE } from "@/lib/demo/data";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [sites, setSites] = useState<SiteWithRole[]>([]);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserData = useCallback(async (userId: string) => {
    // Load user profile
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single();

    setUserProfile(profile);

    // Load accessible sites with roles
    const { data: roleRows } = await supabase
      .from("user_site_roles")
      .select("site_id, role, sites(*)")
      .eq("user_id", userId);

    if (roleRows) {
      const siteList: SiteWithRole[] = roleRows.map((r: any) => ({
        ...r.sites,
        role: r.role,
      }));
      setSites(siteList);

      // Restore previously selected site from localStorage, or default to first
      const stored = localStorage.getItem("activeSiteId");
      const valid = siteList.find((s) => s.id === stored);
      setActiveSiteId(valid ? valid.id : siteList[0]?.id ?? null);
    }
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadUserData(session.user.id);
        } else {
          setUserProfile(null);
          setSites([]);
          setActiveSiteId(null);
        }
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  const setActiveSite = useCallback((siteId: string) => {
    setActiveSiteId(siteId);
    localStorage.setItem("activeSiteId", siteId);
  }, []);

  const signOut = useCallback(async () => {
    if (isDemoMode()) {
      exitDemoMode();
      window.location.href = "/login";
      return;
    }
    await supabase.auth.signOut();
    localStorage.removeItem("activeSiteId");
  }, []);

  const refreshProfile = useCallback(async () => {
    if (isDemoMode() || !user) return;
    await loadUserData(user.id);
  }, [user, loadUserData]);

  const activeRole = sites.find((s) => s.id === activeSiteId)?.role ?? null;
  const orgId = userProfile?.org_id ?? null;

  // ── Demo mode: override everything with fake data ─────────────────────────
  const demoSiteWithRole: SiteWithRole = { ...DEMO_SITE, role: "admin" as const };
  const demoContextValue: AuthContextValue = {
    session: null,
    user: { id: DEMO_USER_ID, email: "demo@fwmining.app" } as User,
    userProfile: DEMO_USER_PROFILE as UserProfile,
    orgId: DEMO_ORG_ID,
    sites: [demoSiteWithRole],
    activeSiteId: DEMO_SITE_ID,
    activeRole: "admin",
    isLoading: false,
    setActiveSite: () => {},
    signOut,
    refreshProfile,
  };

  if (isDemoMode()) {
    return (
      <AuthContext.Provider value={demoContextValue}>
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        userProfile,
        orgId,
        sites,
        activeSiteId,
        activeRole,
        isLoading,
        setActiveSite,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used inside AuthProvider");
  return ctx;
}
