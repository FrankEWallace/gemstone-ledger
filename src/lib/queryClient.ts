import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";

// ─── Auth error detection ──────────────────────────────────────────────────────
//
// Supabase returns auth-failure errors in two shapes:
//   • PostgREST errors  — { code: "PGRST301" | "PGRST302", ... }  (JWT expired / invalid)
//   • HTTP 401 status   — { status: 401 } on fetch-level failures
//   • AuthError classes — thrown by the Supabase auth module itself
//
// We dispatch auth:unauthorized on any of these so AuthContext can sign the user
// out through a single code path, regardless of which layer detected the failure.

function isAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  // PostgREST JWT auth failures
  if ("code" in error) {
    const code = (error as Record<string, unknown>).code;
    if (code === "PGRST301" || code === "PGRST302") return true;
  }

  // HTTP 401 — covers both REST backend and direct fetch() calls
  if ("status" in error && (error as Record<string, unknown>).status === 401) return true;

  // Supabase AuthSessionMissingError and AuthInvalidJwtError
  if (error instanceof Error) {
    if (
      error.name === "AuthSessionMissingError" ||
      error.name === "AuthInvalidJwtError"
    ) return true;
  }

  return false;
}

function dispatchUnauthorized(source: string) {
  window.dispatchEvent(
    new CustomEvent("auth:unauthorized", { detail: { source } })
  );
}

// ─── Singleton QueryClient ────────────────────────────────────────────────────
//
// Exported as a module-level singleton so AuthContext can call .clear() on
// sign-out without circular imports or prop-drilling.

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError(error, query) {
      if (isAuthError(error)) {
        console.warn("[QueryCache] Auth error on query", query.queryKey, "— signing out");
        dispatchUnauthorized("supabase-query");
      }
    },
  }),
  mutationCache: new MutationCache({
    onError(error) {
      if (isAuthError(error)) {
        console.warn("[MutationCache] Auth error on mutation — signing out");
        dispatchUnauthorized("supabase-mutation");
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 min — skip refetch on every render
      retry: 1,                          // one retry on transient failure, then fail fast
      refetchOnWindowFocus: true,        // always refresh when the user returns to the tab
      gcTime: 24 * 60 * 60 * 1000,      // keep unused cache 24 h — offline-first requirement
    },
  },
});
