import { Navigate } from "react-router-dom";
import { REPORTS_LAST_VIEWED_KEY } from "@/components/reports/ReportsTopNav";

const BUCKET_ROUTES: Record<string, string> = {
  production: "/reports/production",
  overview: "/reports/overview",
  inventory: "/reports/inventory",
};

export default function ReportsPage() {
  let bucket = "overview";
  try {
    bucket = localStorage.getItem(REPORTS_LAST_VIEWED_KEY) ?? "overview";
  } catch {
    // storage unavailable — fall back to the default
  }

  return <Navigate to={BUCKET_ROUTES[bucket] ?? "/reports/overview"} replace />;
}
