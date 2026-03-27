import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Database,
  Calculator,
  Cpu,
  MapPin,
  Webhook,
  BarChart3,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { IntegrationConfig, Json } from "@/lib/supabaseTypes";

// ─── Integration definitions ──────────────────────────────────────────────────

type IntegrationMeta = {
  type: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: "ERP & Finance" | "Operations" | "Analytics";
  comingSoon?: boolean;
};

const INTEGRATIONS: IntegrationMeta[] = [
  {
    type: "erp_sap",
    label: "SAP ERP",
    description: "Sync purchase orders, inventory, and financial data with SAP.",
    icon: <Database className="h-5 w-5" />,
    category: "ERP & Finance",
  },
  {
    type: "accounting_xero",
    label: "Xero",
    description: "Automatically push transactions and invoices to Xero accounting.",
    icon: <Calculator className="h-5 w-5" />,
    category: "ERP & Finance",
  },
  {
    type: "accounting_quickbooks",
    label: "QuickBooks",
    description: "Sync expenses and income to QuickBooks Online.",
    icon: <Calculator className="h-5 w-5" />,
    category: "ERP & Finance",
  },
  {
    type: "iot_sensors",
    label: "IoT Sensor Network",
    description: "Connect mine sensor arrays for real-time environmental and production data.",
    icon: <Cpu className="h-5 w-5" />,
    category: "Operations",
  },
  {
    type: "gps_tracking",
    label: "GPS Fleet Tracking",
    description: "Track heavy equipment and vehicles across site in real time.",
    icon: <MapPin className="h-5 w-5" />,
    category: "Operations",
  },
  {
    type: "webhook_generic",
    label: "Webhook (Generic)",
    description: "Send event payloads to any HTTP endpoint when key events occur.",
    icon: <Webhook className="h-5 w-5" />,
    category: "Operations",
  },
  {
    type: "analytics_powerbi",
    label: "Power BI",
    description: "Stream production and financial data into Power BI dashboards.",
    icon: <BarChart3 className="h-5 w-5" />,
    category: "Analytics",
    comingSoon: true,
  },
  {
    type: "analytics_looker",
    label: "Looker Studio",
    description: "Export reports to Google Looker Studio for advanced analytics.",
    icon: <BarChart3 className="h-5 w-5" />,
    category: "Analytics",
    comingSoon: true,
  },
];

// ─── Service ──────────────────────────────────────────────────────────────────

async function getIntegrationConfigs(orgId: string): Promise<IntegrationConfig[]> {
  const { data, error } = await supabase
    .from("integration_configs")
    .select("*")
    .eq("org_id", orgId);
  if (error) throw error;
  return data ?? [];
}

async function upsertIntegration(
  orgId: string,
  integrationType: string,
  enabled: boolean,
  config: Json = {}
): Promise<void> {
  const { error } = await supabase
    .from("integration_configs")
    .upsert(
      { org_id: orgId, integration_type: integrationType, enabled, config },
      { onConflict: "org_id,integration_type" }
    );
  if (error) throw error;
}

// ─── Integration Card ─────────────────────────────────────────────────────────

interface IntegrationCardProps {
  meta: IntegrationMeta;
  config: IntegrationConfig | undefined;
  orgId: string;
}

function IntegrationCard({ meta, config, orgId }: IntegrationCardProps) {
  const queryClient = useQueryClient();
  const isEnabled = config?.enabled ?? false;

  const { mutate: toggle, isPending } = useMutation({
    mutationFn: (enabled: boolean) =>
      upsertIntegration(orgId, meta.type, enabled, config?.config ?? {}),
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["integrations", orgId] });
      toast.success(`${meta.label} ${enabled ? "enabled" : "disabled"}.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className={`rounded-lg border p-4 space-y-3 transition-colors ${
      isEnabled ? "border-primary/30 bg-primary/5" : "border-border"
    } ${meta.comingSoon ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${isEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            {meta.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">{meta.label}</p>
              {isEnabled && !meta.comingSoon && (
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              )}
              {meta.comingSoon && (
                <Badge variant="outline" className="text-xs py-0">Soon</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{meta.category}</p>
          </div>
        </div>

        <Switch
          checked={isEnabled}
          onCheckedChange={(v) => toggle(v)}
          disabled={isPending || meta.comingSoon}
        />
      </div>

      <p className="text-sm text-muted-foreground">{meta.description}</p>

      {isEnabled && !meta.comingSoon && (
        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Integration active — configuration options coming in a future update.
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const { orgId } = useAuth();

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["integrations", orgId],
    queryFn: () => getIntegrationConfigs(orgId!),
    enabled: !!orgId,
  });

  const configMap = Object.fromEntries(configs.map((c) => [c.integration_type, c]));
  const enabledCount = configs.filter((c) => c.enabled).length;

  const categories = [...new Set(INTEGRATIONS.map((i) => i.category))];

  return (
    <div className="p-4 lg:p-6 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect FW Mining OS with your existing tools and services.
          </p>
        </div>
        {enabledCount > 0 && (
          <div className="text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-emerald-500 inline mr-1.5" />
            {enabledCount} active integration{enabledCount !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg border border-border p-4 h-28 animate-pulse bg-muted/30" />
          ))}
        </div>
      ) : (
        categories.map((category) => (
          <div key={category}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {category}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {INTEGRATIONS.filter((i) => i.category === category).map((meta) => (
                <IntegrationCard
                  key={meta.type}
                  meta={meta}
                  config={configMap[meta.type]}
                  orgId={orgId!}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
