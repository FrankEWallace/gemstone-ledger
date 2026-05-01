import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, ClipboardList, Users, Clock, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { useSite } from "@/hooks/useSite";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { Worker, ShiftRecord, WorkerStatus } from "@/lib/supabaseTypes";
import {
  getWorkers,
  getShiftRecords,
  createWorker,
  updateWorker,
  deleteWorker,
  logShift,
  deleteShift,
} from "@/services/team.service";

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKER_STATUSES: WorkerStatus[] = ["active", "on_leave", "terminated"];

// ─── Schemas ──────────────────────────────────────────────────────────────────

const workerSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  position: z.string().optional(),
  department: z.string().optional(),
  hire_date: z.string().optional(),
  status: z.enum(["active", "on_leave", "terminated"]),
});

const shiftSchema = z.object({
  worker_id: z.string().min(1, "Worker is required"),
  shift_date: z.string().min(1, "Date is required"),
  hours_worked: z.coerce.number().min(0).max(24).optional().or(z.literal("")),
  output_metric: z.coerce.number().min(0).optional().or(z.literal("")),
  metric_unit: z.string().optional(),
  notes: z.string().optional(),
});

type WorkerFormValues = z.infer<typeof workerSchema>;
type ShiftFormValues = z.infer<typeof shiftSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(status: WorkerStatus) {
  const map: Record<WorkerStatus, string> = {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    on_leave: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    terminated: "bg-muted text-muted-foreground",
  };
  const labels: Record<WorkerStatus, string> = {
    active: "Active",
    on_leave: "On Leave",
    terminated: "Terminated",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

// ─── Worker Modal ─────────────────────────────────────────────────────────────

interface WorkerModalProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  editing: Worker | null;
}

function WorkerModal({ open, onClose, siteId, editing }: WorkerModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<WorkerFormValues>({
    resolver: zodResolver(workerSchema),
    values: editing
      ? {
          full_name: editing.full_name,
          position: editing.position ?? "",
          department: editing.department ?? "",
          hire_date: editing.hire_date ?? "",
          status: editing.status,
        }
      : { full_name: "", position: "", department: "", hire_date: "", status: "active" },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: WorkerFormValues) => {
      const payload = {
        full_name: values.full_name,
        position: values.position || undefined,
        department: values.department || undefined,
        hire_date: values.hire_date || undefined,
        status: values.status,
      };
      return editing
        ? updateWorker(editing.id, payload)
        : createWorker(siteId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers", siteId] });
      toast.success(editing ? "Worker updated." : "Worker added.");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Worker" : "Add Worker"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Drill Operator" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Extraction" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hire_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hire Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WORKER_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {statusBadge(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : editing ? "Save Changes" : "Add Worker"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Log Shift Modal ──────────────────────────────────────────────────────────

interface ShiftModalProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  workers: Worker[];
  preselectedWorkerId?: string;
}

function LogShiftModal({ open, onClose, siteId, workers, preselectedWorkerId }: ShiftModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftSchema),
    defaultValues: {
      worker_id: preselectedWorkerId ?? "",
      shift_date: format(new Date(), "yyyy-MM-dd"),
      hours_worked: "",
      output_metric: "",
      metric_unit: "",
      notes: "",
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: ShiftFormValues) =>
      logShift(siteId, {
        worker_id: values.worker_id,
        shift_date: values.shift_date,
        hours_worked: values.hours_worked === "" ? undefined : Number(values.hours_worked),
        output_metric: values.output_metric === "" ? undefined : Number(values.output_metric),
        metric_unit: values.metric_unit || undefined,
        notes: values.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts", siteId] });
      toast.success("Shift logged.");
      onClose();
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Shift</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="worker_id"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Worker *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select worker" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {workers
                          .filter((w) => w.status === "active")
                          .map((w) => (
                            <SelectItem key={w.id} value={w.id}>
                              {w.full_name}
                              {w.position && ` — ${w.position}`}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shift_date"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Shift Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hours_worked"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hours Worked</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={24} step="0.5" placeholder="e.g. 8" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="output_metric"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Output</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" placeholder="e.g. 12.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="metric_unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Output Unit</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. tonnes, carats" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optional notes about this shift…" rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Log Shift"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const { activeSiteId } = useSite();
  const queryClient = useQueryClient();

  const [workerModal, setWorkerModal] = useState(false);
  const [shiftModal, setShiftModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [deleteWorkerTarget, setDeleteWorkerTarget] = useState<Worker | null>(null);
  const [deleteShiftTarget, setDeleteShiftTarget] = useState<ShiftRecord | null>(null);
  const [preselectedWorkerId, setPreselectedWorkerId] = useState<string | undefined>();

  const { data: workers = [], isLoading: loadingWorkers } = useQuery({
    queryKey: ["workers", activeSiteId],
    queryFn: () => getWorkers(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const { data: shifts = [], isLoading: loadingShifts } = useQuery({
    queryKey: ["shifts", activeSiteId],
    queryFn: () => getShiftRecords(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const { mutate: doDeleteWorker, isPending: isDeletingWorker } = useMutation({
    mutationFn: (id: string) => deleteWorker(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workers", activeSiteId] });
      toast.success("Worker removed.");
      setDeleteWorkerTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: doDeleteShift, isPending: isDeletingShift } = useMutation({
    mutationFn: (id: string) => deleteShift(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts", activeSiteId] });
      toast.success("Shift record deleted.");
      setDeleteShiftTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Aggregate stats ──────────────────────────────────────────────────────

  const activeCount = workers.filter((w) => w.status === "active").length;
  const totalHours = shifts.reduce((sum, s) => sum + (s.hours_worked ?? 0), 0);
  const avgHours = shifts.length > 0 ? (totalHours / shifts.length).toFixed(1) : "0";

  // Top 5 workers by total hours in recent shifts
  const workerHoursMap: Record<string, { name: string; hours: number }> = {};
  for (const s of shifts) {
    const w = workers.find((w) => w.id === s.worker_id);
    if (!workerHoursMap[s.worker_id]) {
      workerHoursMap[s.worker_id] = { name: w?.full_name ?? "Unknown", hours: 0 };
    }
    workerHoursMap[s.worker_id].hours += s.hours_worked ?? 0;
  }
  const chartData = Object.values(workerHoursMap)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 8);

  // ── Worker columns ───────────────────────────────────────────────────────

  const workerColumns: DataTableColumn<Worker>[] = [
    {
      key: "full_name",
      header: "Name",
      sortable: true,
      render: (_, row) => (
        <div>
          <p className="font-medium">{row.full_name}</p>
          {row.position && <p className="text-xs text-muted-foreground">{row.position}</p>}
        </div>
      ),
    },
    { key: "department", header: "Department", sortable: true, render: (val) => String(val || "—") },
    {
      key: "hire_date",
      header: "Hired",
      render: (val) => (val ? format(new Date(String(val)), "MMM d, yyyy") : "—"),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (val) => statusBadge(val as WorkerStatus),
    },
    {
      key: "id",
      header: "",
      className: "w-28 text-right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => {
              setPreselectedWorkerId(row.id);
              setShiftModal(true);
            }}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Log
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => { setEditingWorker(row); setWorkerModal(true); }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => setDeleteWorkerTarget(row)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  // ── Shift columns ────────────────────────────────────────────────────────

  const shiftColumns: DataTableColumn<ShiftRecord>[] = [
    {
      key: "shift_date",
      header: "Date",
      sortable: true,
      render: (val) => format(new Date(String(val)), "MMM d, yyyy"),
    },
    {
      key: "worker_id",
      header: "Worker",
      sortable: true,
      render: (val) => workers.find((w) => w.id === val)?.full_name ?? "—",
    },
    {
      key: "hours_worked",
      header: "Hours",
      sortable: true,
      className: "text-right",
      render: (val) => (val != null ? `${val}h` : "—"),
    },
    {
      key: "output_metric",
      header: "Output",
      className: "text-right",
      render: (_, row) =>
        row.output_metric != null
          ? `${row.output_metric} ${row.metric_unit ?? ""}`
          : "—",
    },
    {
      key: "notes",
      header: "Notes",
      render: (val) => (
        <span className="text-sm text-muted-foreground truncate max-w-48 block">
          {String(val || "—")}
        </span>
      ),
    },
    {
      key: "id",
      header: "",
      className: "w-10 text-right",
      render: (_, row) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => setDeleteShiftTarget(row as unknown as ShiftRecord)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Team Performance</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setPreselectedWorkerId(undefined); setShiftModal(true); }}>
            <ClipboardList className="h-4 w-4 mr-1.5" />
            Log Shift
          </Button>
          <Button size="sm" onClick={() => { setEditingWorker(null); setWorkerModal(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Worker
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border p-4 flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Active Workers</p>
            <p className="text-2xl font-bold">{activeCount}</p>
          </div>
        </div>
        <div className="rounded-lg border border-border p-4 flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Hours / Shift</p>
            <p className="text-2xl font-bold">{avgHours}h</p>
          </div>
        </div>
        <div className="rounded-lg border border-border p-4 flex items-start gap-3 col-span-2 sm:col-span-1">
          <div className="rounded-md bg-primary/10 p-2">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Shifts Logged</p>
            <p className="text-2xl font-bold">{shifts.length}</p>
          </div>
        </div>
      </div>

      {/* Top workers chart */}
      {chartData.length > 0 && (
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium mb-4">Hours by Worker (all-time)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval={0}
              />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(v: number) => [`${v}h`, "Hours"]}
              />
              <Bar dataKey="hours" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="workers">
        <TabsList>
          <TabsTrigger value="workers">Workers ({workers.length})</TabsTrigger>
          <TabsTrigger value="shifts">Shift Records ({shifts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="workers" className="mt-4">
          <DataTable
            data={workers as unknown as Record<string, unknown>[]}
            columns={workerColumns as DataTableColumn<Record<string, unknown>>[]}
            keyField="id"
            searchable
            searchPlaceholder="Search by name or department…"
            searchKeys={["full_name", "position", "department"]}
            pageSize={15}
            isLoading={loadingWorkers}
            emptyMessage="No workers added yet. Add your first worker to get started."
          />
        </TabsContent>

        <TabsContent value="shifts" className="mt-4">
          <DataTable
            data={shifts as unknown as Record<string, unknown>[]}
            columns={shiftColumns as DataTableColumn<Record<string, unknown>>[]}
            keyField="id"
            searchable={false}
            pageSize={20}
            isLoading={loadingShifts}
            emptyMessage="No shift records yet. Log a shift to get started."
          />
        </TabsContent>
      </Tabs>

      {/* Worker Modal */}
      {workerModal && (
        <WorkerModal
          open={workerModal}
          onClose={() => { setWorkerModal(false); setEditingWorker(null); }}
          siteId={activeSiteId!}
          editing={editingWorker}
        />
      )}

      {/* Log Shift Modal */}
      {shiftModal && (
        <LogShiftModal
          open={shiftModal}
          onClose={() => { setShiftModal(false); setPreselectedWorkerId(undefined); }}
          siteId={activeSiteId!}
          workers={workers}
          preselectedWorkerId={preselectedWorkerId}
        />
      )}

      {/* Delete Worker */}
      <AlertDialog open={!!deleteWorkerTarget} onOpenChange={(o) => !o && setDeleteWorkerTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{deleteWorkerTarget?.full_name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the worker and cannot be undone. Shift records for this worker will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteWorkerTarget && doDeleteWorker(deleteWorkerTarget.id)}
              disabled={isDeletingWorker}
            >
              {isDeletingWorker ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Shift */}
      <AlertDialog open={!!deleteShiftTarget} onOpenChange={(o) => !o && setDeleteShiftTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this shift record?</AlertDialogTitle>
            <AlertDialogDescription>
              Shift on {deleteShiftTarget?.shift_date} — this cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteShiftTarget && doDeleteShift(deleteShiftTarget.id)}
              disabled={isDeletingShift}
            >
              {isDeletingShift ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
