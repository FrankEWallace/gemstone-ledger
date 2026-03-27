import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, CheckCircle2, ShieldAlert, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { useSite } from "@/hooks/useSite";
import { useAuth } from "@/hooks/useAuth";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { SafetyIncident, IncidentSeverity, IncidentType } from "@/lib/supabaseTypes";
import {
  getSafetyIncidents,
  createSafetyIncident,
  resolveSafetyIncident,
  deleteSafetyIncident,
} from "@/services/safety.service";

// ─── Config ───────────────────────────────────────────────────────────────────

const SEVERITIES: IncidentSeverity[] = ["low", "medium", "high", "critical"];
const TYPES: IncidentType[] = ["near-miss", "injury", "equipment", "environmental", "other"];

const SEVERITY_STYLES: Record<IncidentSeverity, string> = {
  low:      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  medium:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  high:     "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

// ─── Schema ──────────────────────────────────────────────────────────────────

const incidentSchema = z.object({
  title:         z.string().min(1, "Title is required"),
  severity:      z.enum(["low", "medium", "high", "critical"]),
  type:          z.enum(["near-miss", "injury", "equipment", "environmental", "other"]),
  description:   z.string().optional(),
  actions_taken: z.string().optional(),
});

type IncidentFormValues = z.infer<typeof incidentSchema>;

// ─── Modal ────────────────────────────────────────────────────────────────────

function IncidentModal({
  open, onClose, siteId,
}: {
  open: boolean;
  onClose: () => void;
  siteId: string;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<IncidentFormValues>({
    resolver: zodResolver(incidentSchema),
    defaultValues: { title: "", severity: "low", type: "near-miss", description: "", actions_taken: "" },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: IncidentFormValues) =>
      createSafetyIncident(siteId, {
        title:         values.title,
        severity:      values.severity,
        type:          values.type,
        description:   values.description || undefined,
        actions_taken: values.actions_taken || undefined,
      }, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safety-incidents", siteId] });
      toast.success("Incident logged.");
      onClose();
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Safety Incident</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Title *</FormLabel>
                <FormControl><Input placeholder="Brief incident title" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="severity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Severity *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SEVERITIES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="What happened? Include location, time, people involved…" rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="actions_taken" render={({ field }) => (
              <FormItem>
                <FormLabel>Actions Taken</FormLabel>
                <FormControl>
                  <Textarea placeholder="Immediate response, corrective actions, follow-up…" rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Log Incident"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SafetyPage() {
  const { activeSiteId } = useSite();
  const queryClient = useQueryClient();

  const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | "all">("all");
  const [showOpen, setShowOpen] = useState<"all" | "open" | "resolved">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SafetyIncident | null>(null);

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["safety-incidents", activeSiteId],
    queryFn: () => getSafetyIncidents(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const { mutate: doResolve } = useMutation({
    mutationFn: (id: string) => resolveSafetyIncident(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safety-incidents", activeSiteId] });
      toast.success("Incident marked as resolved.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: doDelete, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => deleteSafetyIncident(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["safety-incidents", activeSiteId] });
      const prev = queryClient.getQueryData<SafetyIncident[]>(["safety-incidents", activeSiteId]);
      queryClient.setQueryData<SafetyIncident[]>(["safety-incidents", activeSiteId], (old) => old?.filter((i) => i.id !== id) ?? []);
      setDeleteTarget(null);
      return { prev };
    },
    onError: (err: Error, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["safety-incidents", activeSiteId], ctx.prev);
      toast.error(err.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safety-incidents", activeSiteId] });
      toast.success("Incident deleted.");
    },
  });

  const openIncidents     = incidents.filter((i) => !i.resolved_at);
  const criticalIncidents = incidents.filter((i) => i.severity === "critical" && !i.resolved_at);
  const thisMonth         = incidents.filter((i) => {
    const d = new Date(i.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const filtered = incidents
    .filter((i) => severityFilter === "all" || i.severity === severityFilter)
    .filter((i) => showOpen === "all" || (showOpen === "open" ? !i.resolved_at : !!i.resolved_at));

  const columns: DataTableColumn<SafetyIncident>[] = [
    {
      key: "title",
      header: "Incident",
      sortable: true,
      render: (_, row) => (
        <div>
          <p className="font-medium">{row.title}</p>
          {row.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      key: "severity",
      header: "Severity",
      sortable: true,
      render: (val) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_STYLES[val as IncidentSeverity]}`}>
          {String(val)}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      render: (val) => <span className="capitalize text-sm">{String(val)}</span>,
    },
    {
      key: "created_at",
      header: "Reported",
      sortable: true,
      render: (val) => format(new Date(String(val)), "MMM d, yyyy"),
    },
    {
      key: "resolved_at",
      header: "Status",
      render: (val) => val ? (
        <Badge variant="secondary" className="gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20">
          <CheckCircle2 className="h-3 w-3" /> Resolved
        </Badge>
      ) : (
        <Badge variant="secondary" className="gap-1 text-orange-600 bg-orange-50 dark:bg-orange-900/20">
          <AlertTriangle className="h-3 w-3" /> Open
        </Badge>
      ),
    },
    {
      key: "id",
      header: "",
      className: "w-24 text-right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          {!row.resolved_at && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              onClick={() => doResolve(row.id)}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Resolve
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(row)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Safety Incidents</h1>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Log Incident
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Open Incidents", value: openIncidents.length, icon: <AlertTriangle className="h-4 w-4 text-orange-500" />, color: openIncidents.length > 0 ? "text-orange-600" : "" },
          { label: "Critical (Open)", value: criticalIncidents.length, icon: <ShieldAlert className="h-4 w-4 text-red-500" />, color: criticalIncidents.length > 0 ? "text-red-600" : "" },
          { label: "This Month", value: thisMonth.length, icon: <Info className="h-4 w-4 text-muted-foreground" />, color: "" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              {stat.icon} {stat.label}
            </div>
            <p className={`text-3xl font-bold font-display ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as IncidentSeverity | "all")}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            {SEVERITIES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={showOpen} onValueChange={(v) => setShowOpen(v as "all" | "open" | "resolved")}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open only</SelectItem>
            <SelectItem value="resolved">Resolved only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data={filtered as unknown as Record<string, unknown>[]}
        columns={columns as DataTableColumn<Record<string, unknown>>[]}
        keyField="id"
        searchable
        searchPlaceholder="Search incidents…"
        searchKeys={["title", "description", "type"]}
        pageSize={15}
        isLoading={isLoading}
        emptyMessage="No incidents logged. Keep up the safe work!"
      />

      {modalOpen && (
        <IncidentModal open={modalOpen} onClose={() => setModalOpen(false)} siteId={activeSiteId!} />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete incident?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" will be permanently removed.
            </AlertDialogDescription>
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
