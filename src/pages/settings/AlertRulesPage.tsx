import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Zap, ZapOff, Play } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { useSite } from "@/hooks/useSite";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlertRule {
  id: string;
  site_id: string;
  created_by: string | null;
  name: string;
  entity_type: string;
  field: string;
  operator: string;
  threshold: number;
  notification_title: string;
  notification_body: string | null;
  enabled: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

// ─── Presets ─────────────────────────────────────────────────────────────────

const PRESETS = [
  {
    label: "Low Inventory",
    entity_type: "inventory_item",
    field: "quantity",
    operator: "lte",
    threshold: 10,
    notification_title: "Low inventory detected",
    notification_body: "One or more items have fallen below the threshold.",
  },
  {
    label: "Equipment Overdue for Service",
    entity_type: "equipment",
    field: "days_since_service",
    operator: "gte",
    threshold: 90,
    notification_title: "Equipment service overdue",
    notification_body: "One or more assets are overdue for maintenance.",
  },
  {
    label: "Open Safety Incidents",
    entity_type: "safety_incident",
    field: "open_count",
    operator: "gte",
    threshold: 1,
    notification_title: "Open safety incidents",
    notification_body: "There are unresolved safety incidents on this site.",
  },
];

const ENTITY_FIELDS: Record<string, { fields: string[]; label: string }> = {
  inventory_item:  { fields: ["quantity"],           label: "Inventory Item" },
  equipment:       { fields: ["days_since_service"],  label: "Equipment" },
  safety_incident: { fields: ["open_count"],          label: "Safety Incident" },
};

const OPERATORS = [
  { value: "lte", label: "≤ Less than or equal" },
  { value: "gte", label: "≥ Greater than or equal" },
  { value: "lt",  label: "< Less than" },
  { value: "gt",  label: "> Greater than" },
  { value: "eq",  label: "= Equal to" },
];

// ─── Schema ──────────────────────────────────────────────────────────────────

const ruleSchema = z.object({
  name:               z.string().min(1, "Name is required"),
  entity_type:        z.enum(["inventory_item", "equipment", "safety_incident"]),
  field:              z.string().min(1, "Field is required"),
  operator:           z.enum(["gte", "lte", "gt", "lt", "eq"]),
  threshold:          z.coerce.number(),
  notification_title: z.string().min(1, "Notification title is required"),
  notification_body:  z.string().optional(),
});

type RuleFormValues = z.infer<typeof ruleSchema>;

// ─── Service ─────────────────────────────────────────────────────────────────

async function getAlertRules(siteId: string): Promise<AlertRule[]> {
  const { data, error } = await supabase
    .from("alert_rules")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AlertRule[];
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function RuleModal({
  open, onClose, siteId, preset,
}: {
  open: boolean;
  onClose: () => void;
  siteId: string;
  preset?: typeof PRESETS[number];
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: preset
      ? { ...preset, name: preset.label }
      : {
          name: "",
          entity_type: "inventory_item",
          field: "quantity",
          operator: "lte",
          threshold: 10,
          notification_title: "",
          notification_body: "",
        },
  });

  const entityType = form.watch("entity_type");

  const { mutate, isPending } = useMutation({
    mutationFn: (values: RuleFormValues) =>
      supabase.from("alert_rules").insert({
        ...values,
        site_id: siteId,
        created_by: user?.id ?? null,
        enabled: true,
      }).select().single(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules", siteId] });
      toast.success("Alert rule created.");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Alert Rule</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Rule Name *</FormLabel>
                <FormControl><Input placeholder="e.g. Critical low stock" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="entity_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Entity *</FormLabel>
                  <Select value={field.value} onValueChange={(v) => {
                    field.onChange(v);
                    form.setValue("field", ENTITY_FIELDS[v].fields[0]);
                  }}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.entries(ENTITY_FIELDS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="field" render={({ field }) => (
                <FormItem>
                  <FormLabel>Field *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {ENTITY_FIELDS[entityType]?.fields.map((f) => (
                        <SelectItem key={f} value={f}>{f.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="operator" render={({ field }) => (
                <FormItem>
                  <FormLabel>Operator *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {OPERATORS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="threshold" render={({ field }) => (
                <FormItem>
                  <FormLabel>Threshold *</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="notification_title" render={({ field }) => (
              <FormItem>
                <FormLabel>Notification Title *</FormLabel>
                <FormControl><Input placeholder="e.g. Low stock alert" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="notification_body" render={({ field }) => (
              <FormItem>
                <FormLabel>Notification Body</FormLabel>
                <FormControl><Input placeholder="Additional details…" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create Rule"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AlertRulesPage() {
  const { activeSiteId } = useSite();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<typeof PRESETS[number] | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<AlertRule | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["alert-rules", activeSiteId],
    queryFn: () => getAlertRules(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const { mutate: toggleRule } = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      supabase.from("alert_rules").update({ enabled }).eq("id", id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alert-rules", activeSiteId] }),
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: doDelete, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => supabase.from("alert_rules").delete().eq("id", id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules", activeSiteId] });
      toast.success("Rule deleted.");
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function runNow() {
    setIsRunning(true);
    try {
      const { error } = await supabase.functions.invoke("evaluate-alerts");
      if (error) throw error;
      toast.success("Alert evaluation complete.");
      queryClient.invalidateQueries({ queryKey: ["alert-rules", activeSiteId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Alert Rules</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automatically notify managers when thresholds are crossed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={runNow} disabled={isRunning}>
            <Play className="h-4 w-4 mr-1.5" />
            {isRunning ? "Running…" : "Run Now"}
          </Button>
          <Button size="sm" onClick={() => { setSelectedPreset(undefined); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Rule
          </Button>
        </div>
      </div>

      {/* Presets */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Quick-add presets</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => { setSelectedPreset(p); setModalOpen(true); }}
              className="flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rules list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="h-20 rounded-xl border border-border animate-pulse bg-muted/30" />)}
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
          <Zap className="h-10 w-10 mb-3 opacity-30" />
          <p className="font-medium">No alert rules yet</p>
          <p className="text-sm mt-1">Create rules to get notified when thresholds are crossed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{rule.name}</p>
                  <Badge variant={rule.enabled ? "default" : "secondary"} className="text-xs">
                    {rule.enabled ? "Active" : "Disabled"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                  {rule.entity_type.replace(/_/g, " ")} · {rule.field.replace(/_/g, " ")} {rule.operator} {rule.threshold}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Notifies: <span className="font-medium">{rule.notification_title}</span>
                </p>
                {rule.last_triggered_at && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Last triggered: {format(new Date(rule.last_triggered_at), "MMM d, yyyy HH:mm")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title={rule.enabled ? "Disable" : "Enable"}
                  onClick={() => toggleRule({ id: rule.id, enabled: !rule.enabled })}
                >
                  {rule.enabled
                    ? <Zap className="h-4 w-4 text-primary" />
                    : <ZapOff className="h-4 w-4 text-muted-foreground" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(rule)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <RuleModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setSelectedPreset(undefined); }}
          siteId={activeSiteId!}
          preset={selectedPreset}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This alert rule will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && doDelete(deleteTarget.id)}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
