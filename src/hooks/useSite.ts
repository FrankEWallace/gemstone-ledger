import { useAuth } from "@/hooks/useAuth";
import type { SiteWithRole } from "@/types/auth";

export function useSite(): {
  activeSiteId: string | null;
  activeSite: SiteWithRole | null;
  activeRole: string | null;
  sites: SiteWithRole[];
  setActiveSite: (siteId: string) => void;
} {
  const { activeSiteId, sites, activeRole, setActiveSite } = useAuth();
  const activeSite = sites.find((s) => s.id === activeSiteId) ?? null;

  return { activeSiteId, activeSite, activeRole, sites, setActiveSite };
}
