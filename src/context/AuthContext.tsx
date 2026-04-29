import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import type { UserProfile } from "@/lib/supabaseTypes";
import type { AuthContextValue, SiteWithRole } from "@/types/auth";
import { isDemoMode, exitDemoMode, DEMO_USER_ID, DEMO_SITE_ID, DEMO_ORG_ID } from "@/lib/demo";
import { DEMO_USER_PROFILE, DEMO_SITE } from "@/lib/demo/data";
import { offlineDB } from "@/lib/offline/db";

// ─── Dev-only logger ──────────────────────────────────────────────────────────

const log = {
  info:  (...args: unknown[]) => import.meta.env.DEV && console.info("[Auth]",  ...args),
  warn:  (...args: unknown[]) => import.meta.env.DEV && console.warn("[Auth]",  ...args),
  error: (...args: unknown[]) => console.error("[Auth]", ...args),
};

// ─── Cache helpers ────────────────────────────────────────────────────────────

/**
 * Wipes every layer of cached state:
 *  1. React Query in-memory cache
 *  2. Persisted IndexedDB rq-cache
 *  3. Service Worker Supabase API response cache
 */
async function clearAllCaches(): Promise<void> {
  queryClient.clear();
  log.info("queryClient cleared");

  try {
    await offlineDB.kv_store.delete("rq-cache");
    log.info("IndexedDB rq-cache cleared");
  } catch (err) {
    log.warn("Could not clear IndexedDB rq-cache:", err);
  }

  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      reg?.active?.postMessage({ type: "CLEAR_SUPABASE_CACHE" });
      log.info("CLEAR_SUPABASE_CACHE sent to SW");
    } catch (err) {
      log.warn("Could not message SW:", err);
    }
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [sites, setSites] = useState<SiteWithRole[]>([]);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Load profile + site list ────────────────────────────────────────────────

  const loadUserData = useCallback(async (userId: string) => {
    // Detect user switch — clear all stale caches before loading new user's data
    const lastUserId = localStorage.getItem("lastUserId");
    if (lastUserId && lastUserId !== userId) {
      log.info(`User switched (${lastUserId} → ${userId}) — clearing all caches`);
      await clearAllCaches();
    }
    localStorage.setItem("lastUserId", userId);

    const [profileResult, roleResult] = await Promise.all([
      supabase.from("user_profiles").select("*").eq("id", userId).single(),
      supabase.from("user_site_roles").select("site_id, role, sites(*)").eq("user_id", userId),
    ]);

    // Only update state on success — a network failure must not overwrite
    // valid cached state with nulls, which would blank the UI.
    if (!profileResult.error) {
      setUserProfile(profileResult.data);
    } else {
      log.warn("Profile fetch failed (keeping existing):", profileResult.error.message);
    }

    if (!roleResult.error && roleResult.data) {
      const siteList: SiteWithRole[] = roleResult.data.map((r: any) => ({
        ...r.sites,
        role: r.role,
      }));
      setSites(siteList);

      const stored = localStorage.getItem("activeSiteId");
      const valid  = siteList.find((s) => s.id === stored);
      setActiveSiteId(valid ? valid.id : siteList[0]?.id ?? null);
    } else if (roleResult.error) {
      log.warn("Site roles fetch failed (keeping existing):", roleResult.error.message);
    }
  }, []);

  // ── Auth state machine ──────────────────────────────────────────────────────
  //
  // We rely solely on onAuthStateChange rather than calling getSession() in
  // parallel. Supabase v2 fires INITIAL_SESSION as the very first event when
  // the subscription is set up — it carries the stored session (or null) and
  // replaces the need for a separate getSession() call. Using a single event
  // source eliminates the race where both getSession() and INITIAL_SESSION
  // would concurrently invoke loadUserData() for the same user.

  useEffect(() => {
    let cancelled = false;

    // Safety net: if INITIAL_SESSION never fires (Supabase SDK bug or
    // catastrophic network failure), unblock the UI after 8 s.
    const loadingTimeout = setTimeout(() => {
      if (!cancelled) {
        log.warn("INITIAL_SESSION timed out — treating as signed-out");
        setIsLoading(false);
      }
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return;

        log.info(`onAuthStateChange: ${event}`, session ? `user=${session.user.email}` : "no session");

        if (event === "INITIAL_SESSION") {
          // Startup check — fires once, immediately after subscription is set up.
          // Treat exactly like a getSession() call: resolve initial loading state.
          clearTimeout(loadingTimeout);
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            try {
              await loadUserData(session.user.id);
            } catch (err) {
              log.error("loadUserData failed on INITIAL_SESSION:", err);
            }
          }
          if (!cancelled) setIsLoading(false);
          return;
        }

        // ── Subsequent events ───────────────────────────────────────────────

        setSession(session);
        setUser(session?.user ?? null);

        if (event === "SIGNED_OUT") {
          // Caches already cleared by signOut(); just reset React state.
          setUserProfile(null);
          setSites([]);
          setActiveSiteId(null);
        } else if (session?.user) {
          // SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED, MFA_CHALLENGE_VERIFIED
          try {
            await loadUserData(session.user.id);
          } catch (err) {
            log.error(`loadUserData failed on ${event}:`, err);
          }
        }

        if (!cancelled) setIsLoading(false);
      }
    );

    return () => {
      cancelled = true;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  // ── Global REST 401 listener ───────────────────────────────────────────────
  // The REST client dispatches auth:unauthorized on HTTP 401.
  // QueryCache dispatches the same event on Supabase JWT auth errors.
  // Both are routed here so the sign-out path is always the same.

  useEffect(() => {
    function handleUnauthorized(e: Event) {
      const source = (e as CustomEvent).detail?.source ?? "unknown";
      log.warn(`auth:unauthorized from ${source} — forcing sign-out`);
      signOut();
    }
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // signOut reference is stable

  // ── Actions ────────────────────────────────────────────────────────────────

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

    log.info("signOut — clearing all session state");
    await supabase.auth.signOut();

    localStorage.removeItem("activeSiteId");
    localStorage.removeItem("lastUserId");
    sessionStorage.removeItem("fwmining_rest_token");
    sessionStorage.clear();

    await clearAllCaches();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (isDemoMode() || !user) return;
    await loadUserData(user.id);
  }, [user, loadUserData]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const activeRole      = sites.find((s) => s.id === activeSiteId)?.role ?? null;
  const orgId           = userProfile?.org_id ?? null;
  // True when an invited user has a session but hasn't completed their profile yet.
  const isInvitePending = !isLoading && !!user && !userProfile && !!user.user_metadata?.org_id;

  // ── Demo mode ─────────────────────────────────────────────────────────────

  const demoSiteWithRole: SiteWithRole = { ...DEMO_SITE, role: "admin" as const };
  const demoContextValue: AuthContextValue = {
    session:         null,
    user:            { id: DEMO_USER_ID, email: "demo@fwmining.app" } as User,
    userProfile:     DEMO_USER_PROFILE as UserProfile,
    orgId:           DEMO_ORG_ID,
    sites:           [demoSiteWithRole],
    activeSiteId:    DEMO_SITE_ID,
    activeRole:      "admin",
    isLoading:       false,
    isInvitePending: false,
    setActiveSite:   () => {},
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
        isInvitePending,
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
