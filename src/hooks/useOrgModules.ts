import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { updateOrganization } from "@/services/settings.service";
import { isDemoMode } from "@/lib/demo";

export type ModuleKey =
  | "messages"
  | "campaigns"
  | "customers"
  | "reports"
  | "team"
  | "supply_chain"
  | "operations";

export function useOrgModules() {
  const { orgId } = useAuthContext();
  const queryClient = useQueryClient();

  const { data: disabledModules = [] } = useQuery({
    queryKey: ["org-modules", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data } = await supabase
        .from("organizations")
        .select("disabled_modules")
        .eq("id", orgId)
        .single();
      return (data?.disabled_modules as string[]) ?? [];
    },
    enabled: !!orgId && !isDemoMode(),
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: (modules: string[]) =>
      updateOrganization(orgId!, { disabled_modules: modules }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["org-modules", orgId] }),
  });

  const isModuleEnabled = (key: ModuleKey) => !disabledModules.includes(key);

  const toggleModule = (key: ModuleKey) => {
    const next = disabledModules.includes(key)
      ? disabledModules.filter((k) => k !== key)
      : [...disabledModules, key];
    mutation.mutate(next);
  };

  return {
    isModuleEnabled,
    toggleModule,
    disabledModules,
    isSaving: mutation.isPending,
  };
}
