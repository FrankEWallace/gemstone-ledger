import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { isDemoMode } from "@/lib/demo";

export default function ProtectedRoute() {
  const { session, isLoading, isInvitePending } = useAuth();
  const location = useLocation();

  // Demo mode bypasses real auth — AuthContext already provides fake data
  if (isDemoMode()) return <Outlet />;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  // Invited user is authenticated but hasn't completed their profile yet
  if (isInvitePending) {
    return <Navigate to="/accept-invite" replace />;
  }

  return <Outlet />;
}
