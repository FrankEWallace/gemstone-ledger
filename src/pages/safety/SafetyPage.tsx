import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, ShieldAlert, AlertTriangle, Info, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { useSite } from "@/hooks/useSite";
import { useAuth } from "@/hooks/useAuth";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import StatusBadge from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";

import type { SafetyIncident, IncidentSeverity, IncidentType } from "@/lib/supabaseTypes";
import {
  getSafetyIncidents,
  createSafetyIncident,
  updateIncidentStatus,
  deleteSafetyIncident,
  type ResolutionStatus,
} from "@/services/safety.service";

// ─── Config ───────────────────────────────────────────────────────────────────

const SEVERITIES: IncidentSeverity[] = ["low", "medium", "high", "critical"];
const TYPES: IncidentType[] = ["near-miss", "injury", "equipment", "environmental", "other"];

const STATUS_CONFIG: Record<ResolutionStatus, { label: string; className: string }> = {
  open:         { label: "Open",         className: "bg-destructive/10 text-destructive border-destructive/20" },
  under_review: { label: "Under Review", className: "bg-warning/10 text-warning border-warning/20" },
  resolved:     { label: "Resolved",     className: "bg-success/10 text-success border-success/20" },
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

// ─── Inline Status Select ─────────────────────────────────────────────────────

function StatusSelect({ incident, siteId }: { incident: SafetyIncident; siteId: string }) {
  const queryClient = useQueryClient();
  const status = (incident as any).resolution_status as ResolutionStatus ?? (incident.resolved_at ? "resolved" : "open");
  const config = STATUS_CONFIG[status];

  const { mutate } = useMutation({
    mutationFn: (newStatus: ResolutionStatus) => updateIncidentStatus(incident.id, newStatus),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["safety-incidents", siteId] }),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Select value={status} onValueChange={(v) => mutate(v as ResolutionStatus)}>
      <SelectTrigger className={`h-7 w-36 text-xs border font-medium focus:ring-0 ${config.className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.entries(STATUS_CONFIG) as [ResolutionStatus, typeof STATUS_CONFIG[ResolutionStatus]][]).map(([val, cfg]) => (
          <SelectItem key={val} value={val} className="text-xs">{cfg.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Resolution Notes Modal ───────────────────────────────────────────────────

function ResolutionNotesModal({
  incident,
  siteId,
  onClose,
}: {
  incident: SafetyIncident;
  siteId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const currentStatus = (incident as any).resolution_status as ResolutionStatus ?? "open";
  const [status, setStatus] = useState<ResolutionStatus>(currentStatus);
  const [notes, setNotes] = useState<string>((incident as any).resolution_notes ?? "");

  const { mutate, isPending } = useMutation({
    mutationFn: () => updateIncidentStatus(incident.id, status, notes || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["safety-incidents", siteId] });
      toast.success("Incident updated.");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Resolution — {incident.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ResolutionStatus)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(STATUS_CONFIG) as [ResolutionStatus, typeof STATUS_CONFIG[ResolutionStatus]][]).map(([val, cfg]) => (
                  <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Resolution Notes</Label>
            <Textarea
              placeholder="Describe corrective actions, investigation findings, or closure notes…"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-sm"
            />
          </div>
          {(incident as any).resolution_notes && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Last saved: {(incident as any).resolution_notes}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Log Incident Modal ───────────────────────────────────────────────────────

function IncidentModal({ open, onClose, siteId }: { open: boolean; onClose: () => void; siteId: string }) {
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
        resolution_status: "open",
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
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                <FormLabel>Immediate Actions Taken</FormLabel>
                <FormControl>
                  <Textarea placeholder="Immediate response, first aid, area secured…" rows={2} {...field} />
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
  const [statusFilter, setStatusFilter] = useState<ResolutionStatus | "all">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SafetyIncident | null>(null);
  const [notesTarget, setNotesTarget] = useState<SafetyIncident | null>(null);

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["safety-incidents", activeSiteId],
    queryFn: () => getSafetyIncidents(activeSiteId!),
    enabled: !!activeSiteId,
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

  const getStatus = (i: SafetyIncident): ResolutionStatus =>
    (i as any).resolution_status ?? (i.resolved_at ? "resolved" : "open");

  const openCount     = incidents.filter((i) => getStatus(i) === "open").length;
  const reviewCount   = incidents.filter((i) => getStatus(i) === "under_review").length;
  const criticalOpen  = incidents.filter((i) => i.severity === "critical" && getStatus(i) !== "resolved").length;
  const thisMonthCount = incidents.filter((i) => {
    const d = new Date(i.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const filtered = incidents
    .filter((i) => severityFilter === "all" || i.severity === severityFilter)
    .filter((i) => statusFilter === "all" || getStatus(i) === statusFilter);

  const columns: DataTableColumn<SafetyIncident>[] = [
    {
      key: "title",
      header: "Incident",
      sortable: true,
      render: (_, row) => (
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium">{row.title}</p>
            {/* Severity shown inline on mobile only */}
            <StatusBadge status={String(row.severity)} className="sm:hidden" />
          </div>
          {row.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{row.description}</p>
          )}
          {(row as any).resolution_notes && (
            <p className="text-xs text-info mt-0.5 line-clamp-1 italic">
              Note: {(row as any).resolution_notes}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "severity",
      header: "Severity",
      className: "hidden sm:table-cell",
      sortable: true,
      render: (val) => <StatusBadge status={String(val)} />,
    },
    {
      key: "type",
      header: "Type",
      className: "hidden sm:table-cell",
      sortable: true,
      render: (val) => <span className="capitalize text-sm">{String(val)}</span>,
    },
    {
      key: "created_at",
      header: "Reported",
      className: "hidden md:table-cell",
      sortable: true,
      render: (val) => format(new Date(String(val)), "MMM d, yyyy"),
    },
    {
      key: "id",
      header: "Status",
      render: (_, row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <StatusSelect incident={row as unknown as SafetyIncident} siteId={activeSiteId!} />
        </div>
      ),
    },
    {
      key: "id",
      header: "",
      className: "w-24 text-right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 sm:h-7 sm:w-7 text-muted-foreground hover:text-foreground"
            title="Resolution notes"
            onClick={() => setNotesTarget(row as unknown as SafetyIncident)}
          >
            <FileText className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 sm:h-7 sm:w-7 text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(row as unknown as SafetyIncident)}
          >
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Open",         value: openCount,      icon: <AlertTriangle className="h-4 w-4 text-destructive" />, color: openCount > 0 ? "text-destructive" : "" },
          { label: "Under Review", value: reviewCount,    icon: <ShieldAlert className="h-4 w-4 text-warning" />,      color: reviewCount > 0 ? "text-warning" : "" },
          { label: "Critical",     value: criticalOpen,   icon: <ShieldAlert className="h-4 w-4 text-destructive" />,  color: criticalOpen > 0 ? "text-destructive" : "" },
          { label: "This Month",   value: thisMonthCount, icon: <Info className="h-4 w-4 text-muted-foreground" />,   color: "" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {stat.icon} {stat.label}
            </div>
            <p className={`font-display text-2xl font-semibold tabular-nums leading-none ${stat.color}`}>{stat.value}</p>
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

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ResolutionStatus | "all")}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.entries(STATUS_CONFIG) as [ResolutionStatus, typeof STATUS_CONFIG[ResolutionStatus]][]).map(([val, cfg]) => (
              <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
            ))}
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

      {notesTarget && (
        <ResolutionNotesModal
          incident={notesTarget}
          siteId={activeSiteId!}
          onClose={() => setNotesTarget(null)}
        />
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
