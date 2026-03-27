import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Wrench, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, isPast, parseISO, differenceInDays } from "date-fns";

import { useSite } from "@/hooks/useSite";
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

import type { Equipment, EquipmentStatus } from "@/lib/supabaseTypes";
import {
  getEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  type EquipmentPayload,
} from "@/services/equipment.service";

// ─── Schema ──────────────────────────────────────────────────────────────────

const equipSchema = z.object({
  name:              z.string().min(1, "Name is required"),
  type:              z.string().optional(),
  serial_number:     z.string().optional(),
  status:            z.enum(["operational", "maintenance", "retired"]),
  last_service_date: z.string().optional(),
  next_service_date: z.string().optional(),
  notes:             z.string().optional(),
});

type EquipFormValues = z.infer<typeof equipSchema>;

const STATUS_LABELS: Record<EquipmentStatus, string> = {
  operational: "Operational",
  maintenance: "Maintenance",
  retired:     "Retired",
};

const STATUS_COLORS: Record<EquipmentStatus, string> = {
  operational: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  maintenance: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  retired:     "bg-muted text-muted-foreground",
};

// ─── Modal ────────────────────────────────────────────────────────────────────

function EquipmentModal({
  open, onClose, siteId, editing,
}: {
  open: boolean;
  onClose: () => void;
  siteId: string;
  editing: Equipment | null;
}) {
  const queryClient = useQueryClient();

  const form = useForm<EquipFormValues>({
    resolver: zodResolver(equipSchema),
    values: editing
      ? {
          name:              editing.name,
          type:              editing.type ?? "",
          serial_number:     editing.serial_number ?? "",
          status:            editing.status,
          last_service_date: editing.last_service_date ?? "",
          next_service_date: editing.next_service_date ?? "",
          notes:             editing.notes ?? "",
        }
      : { name: "", type: "", serial_number: "", status: "operational", last_service_date: "", next_service_date: "", notes: "" },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: EquipFormValues) => {
      const payload: EquipmentPayload = {
        name:              values.name,
        type:              values.type || undefined,
        serial_number:     values.serial_number || undefined,
        status:            values.status,
        last_service_date: values.last_service_date || null,
        next_service_date: values.next_service_date || null,
        notes:             values.notes || undefined,
      };
      return editing ? updateEquipment(editing.id, payload) : createEquipment(siteId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment", siteId] });
      toast.success(editing ? "Equipment updated." : "Equipment added.");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Equipment" : "Add Equipment"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Name *</FormLabel>
                  <FormControl><Input placeholder="e.g. Excavator CAT 320" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <FormControl><Input placeholder="e.g. Excavator" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="serial_number" render={({ field }) => (
                <FormItem>
                  <FormLabel>Serial Number</FormLabel>
                  <FormControl><Input placeholder="e.g. CAT-320-001" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Status *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(["operational", "maintenance", "retired"] as EquipmentStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="last_service_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Serviced</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="next_service_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Next Service Due</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Input placeholder="Condition notes, location, etc." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : editing ? "Save Changes" : "Add Equipment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EquipmentPage() {
  const { activeSiteId } = useSite();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | "all">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Equipment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Equipment | null>(null);

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ["equipment", activeSiteId],
    queryFn: () => getEquipment(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const { mutate: doDelete, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => deleteEquipment(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["equipment", activeSiteId] });
      const previous = queryClient.getQueryData<Equipment[]>(["equipment", activeSiteId]);
      queryClient.setQueryData<Equipment[]>(["equipment", activeSiteId], (old) => old?.filter((e) => e.id !== id) ?? []);
      setDeleteTarget(null);
      return { previous };
    },
    onError: (err: Error, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["equipment", activeSiteId], ctx.previous);
      toast.error(err.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment", activeSiteId] });
      toast.success("Equipment deleted.");
    },
  });

  const filtered = statusFilter === "all" ? equipment : equipment.filter((e) => e.status === statusFilter);

  const maintenanceDue = equipment.filter(
    (e) => e.next_service_date && isPast(parseISO(e.next_service_date)) && e.status !== "retired"
  ).length;

  const statCounts: Record<EquipmentStatus | "all", number> = {
    all:         equipment.length,
    operational: equipment.filter((e) => e.status === "operational").length,
    maintenance: equipment.filter((e) => e.status === "maintenance").length,
    retired:     equipment.filter((e) => e.status === "retired").length,
  };

  const columns: DataTableColumn<Equipment>[] = [
    {
      key: "name",
      header: "Asset",
      sortable: true,
      render: (_, row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          {row.type && <p className="text-xs text-muted-foreground">{row.type}</p>}
        </div>
      ),
    },
    { key: "serial_number", header: "Serial #", render: (v) => v ? <span className="font-mono text-xs">{String(v)}</span> : <span className="text-muted-foreground">—</span> },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (val) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[val as EquipmentStatus]}`}>
          {STATUS_LABELS[val as EquipmentStatus]}
        </span>
      ),
    },
    {
      key: "next_service_date",
      header: "Next Service",
      sortable: true,
      render: (val) => {
        if (!val) return <span className="text-muted-foreground">—</span>;
        const date = parseISO(String(val));
        const overdue = isPast(date);
        const daysLeft = differenceInDays(date, new Date());
        return (
          <span className={overdue ? "text-destructive font-medium" : daysLeft <= 7 ? "text-yellow-600 font-medium" : ""}>
            {format(date, "MMM d, yyyy")}
            {overdue && <span className="ml-1 text-xs">(overdue)</span>}
            {!overdue && daysLeft <= 7 && <span className="ml-1 text-xs">({daysLeft}d)</span>}
          </span>
        );
      },
    },
    {
      key: "last_service_date",
      header: "Last Serviced",
      render: (val) => val ? format(parseISO(String(val)), "MMM d, yyyy") : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "notes",
      header: "Notes",
      render: (val) => val ? <span className="text-sm text-muted-foreground truncate max-w-xs block">{String(val)}</span> : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "id",
      header: "",
      className: "w-20 text-right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(row); setModalOpen(true); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(row)}>
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
        <div>
          <h1 className="font-display text-2xl font-bold">Equipment</h1>
          {maintenanceDue > 0 && (
            <p className="text-sm text-destructive mt-0.5 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              {maintenanceDue} asset{maintenanceDue !== 1 ? "s" : ""} overdue for service
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Equipment
        </Button>
      </div>

      {/* Stat pills */}
      <div className="flex flex-wrap gap-2">
        {(["all", "operational", "maintenance", "retired"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
              statusFilter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {s === "all" ? <Wrench className="h-3.5 w-3.5" /> : null}
            {s === "all" ? "All" : STATUS_LABELS[s]}
            <Badge variant="secondary" className="text-xs px-1.5 py-0">{statCounts[s]}</Badge>
          </button>
        ))}
      </div>

      <DataTable
        data={filtered as unknown as Record<string, unknown>[]}
        columns={columns as DataTableColumn<Record<string, unknown>>[]}
        keyField="id"
        searchable
        searchPlaceholder="Search by name, type, or serial…"
        searchKeys={["name", "type", "serial_number"]}
        pageSize={15}
        isLoading={isLoading}
        emptyMessage="No equipment found. Add your first asset."
      />

      {modalOpen && (
        <EquipmentModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          siteId={activeSiteId!}
          editing={editing}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the asset record.</AlertDialogDescription>
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
