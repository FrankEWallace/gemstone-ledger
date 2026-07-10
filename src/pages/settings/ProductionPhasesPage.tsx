import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";
import { isDemoMode } from "@/lib/demo";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
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

import type { ProductionPhase } from "@/lib/supabaseTypes";
import {
  getProductionPhases,
  createProductionPhase,
  updateProductionPhase,
  deleteProductionPhase,
  type ProductionPhasePayload,
} from "@/services/production-phases.service";
import { getTransactions } from "@/services/transactions.service";

// ─── Schema ──────────────────────────────────────────────────────────────────

const phaseSchema = z.object({
  name: z.string().min(1, "Name is required"),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  notes: z.string().optional(),
});

type PhaseFormValues = z.infer<typeof phaseSchema>;

// ─── Modal ────────────────────────────────────────────────────────────────────

interface PhaseModalProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  orgId: string;
  editing: ProductionPhase | null;
}

function PhaseModal({ open, onClose, siteId, orgId, editing }: PhaseModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<PhaseFormValues>({
    resolver: zodResolver(phaseSchema),
    values: editing
      ? {
          name: editing.name,
          start_date: editing.start_date ?? "",
          end_date: editing.end_date ?? "",
          notes: editing.notes ?? "",
        }
      : { name: "", start_date: "", end_date: "", notes: "" },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: PhaseFormValues) => {
      if (isDemoMode()) {
        toast.info("Demo mode — changes are not persisted.");
        return Promise.resolve({} as ProductionPhase);
      }
      const payload: ProductionPhasePayload = {
        name: values.name,
        start_date: values.start_date || null,
        end_date: values.end_date || null,
        notes: values.notes || undefined,
      };
      return editing
        ? updateProductionPhase(editing.id, payload)
        : createProductionPhase(siteId, orgId, payload);
    },
    onSuccess: () => {
      if (!isDemoMode()) {
        queryClient.invalidateQueries({ queryKey: ["production-phases", siteId] });
        toast.success(editing ? "Phase updated." : "Phase added.");
      }
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Phase" : "Add Phase"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Awamu ya Pili (Phase 2)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Optional notes…" rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : editing ? "Save Changes" : "Add Phase"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductionPhasesPage() {
  const { orgId } = useAuth();
  const { activeSiteId } = useSite();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductionPhase | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductionPhase | null>(null);

  const { data: phases = [], isLoading } = useQuery({
    queryKey: ["production-phases", activeSiteId],
    queryFn: () => getProductionPhases(activeSiteId!),
    enabled: !!activeSiteId,
  });

  // Pull all transactions once to compute a per-phase expense total client-side.
  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", activeSiteId, "for-phase-totals"],
    queryFn: () => getTransactions(activeSiteId!, { limit: 5000 }),
    enabled: !!activeSiteId,
  });

  const totalsByPhase = new Map<string, number>();
  for (const t of transactions) {
    const phaseId = (t as { phase_id?: string | null }).phase_id;
    if (!phaseId || t.type !== "expense") continue;
    totalsByPhase.set(phaseId, (totalsByPhase.get(phaseId) ?? 0) + t.quantity * t.unit_price);
  }

  const { mutate: doDelete, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => {
      if (isDemoMode()) {
        toast.info("Demo mode — changes are not persisted.");
        return Promise.resolve();
      }
      return deleteProductionPhase(id);
    },
    onSuccess: () => {
      if (!isDemoMode()) {
        queryClient.invalidateQueries({ queryKey: ["production-phases", activeSiteId] });
        toast.success("Phase deleted.");
      }
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: toggleStatus } = useMutation({
    mutationFn: (phase: ProductionPhase) => {
      if (isDemoMode()) {
        toast.info("Demo mode — changes are not persisted.");
        return Promise.resolve({} as ProductionPhase);
      }
      return updateProductionPhase(phase.id, {
        status: phase.status === "open" ? "closed" : "open",
      });
    },
    onSuccess: () => {
      if (!isDemoMode()) {
        queryClient.invalidateQueries({ queryKey: ["production-phases", activeSiteId] });
        toast.success("Phase status updated.");
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const columns: DataTableColumn<ProductionPhase>[] = [
    {
      key: "name",
      header: "Phase",
      sortable: true,
      render: (_, row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (_, row) => (
        <Badge
          variant="outline"
          className={
            row.status === "open"
              ? "border-success text-success"
              : "border-muted-foreground text-muted-foreground"
          }
        >
          {row.status === "open" ? "Open" : "Closed"}
        </Badge>
      ),
    },
    {
      key: "start_date",
      header: "Date range",
      render: (_, row) => (
        <span className="text-sm text-muted-foreground">
          {row.start_date ?? "—"} → {row.end_date ?? "ongoing"}
        </span>
      ),
    },
    {
      key: "id",
      header: "Expense total",
      className: "text-right",
      render: (_, row) => (
        <span className="font-medium tabular-nums">
          {(totalsByPhase.get(row.id) ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: "id" as keyof ProductionPhase,
      header: "",
      className: "w-28 text-right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title={row.status === "open" ? "Close phase" : "Reopen phase"}
            onClick={() => toggleStatus(row)}
          >
            {row.status === "open" ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => { setEditing(row); setModalOpen(true); }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(row)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-display">Production Phases</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Group costs into named production runs (batches / campaigns) to see per-phase totals.
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Phase
        </Button>
      </div>

      <DataTable
        data={phases as unknown as Record<string, unknown>[]}
        columns={columns as DataTableColumn<Record<string, unknown>>[]}
        keyField="id"
        searchable
        searchPlaceholder="Search phases…"
        searchKeys={["name", "notes"]}
        pageSize={20}
        isLoading={isLoading}
        emptyMessage="No production phases yet. Add your first phase to start grouping costs by run."
      />

      {modalOpen && (
        <PhaseModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          siteId={activeSiteId!}
          orgId={orgId!}
          editing={editing}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing transactions linked to this phase will lose their phase reference.
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
