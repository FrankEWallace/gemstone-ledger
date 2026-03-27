import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Plus,
  Trash2,
  Pickaxe,
  Droplets,
  Mountain,
  FlaskConical,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSite } from "@/hooks/useSite";
import { useAuth } from "@/hooks/useAuth";
import {
  getProductionLogs,
  upsertProductionLog,
  deleteProductionLog,
} from "@/services/production.service";
import type { ProductionLog } from "@/lib/supabaseTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
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

// ─── Schema ───────────────────────────────────────────────────────────────────

const logSchema = z.object({
  log_date:     z.string().min(1, "Date is required"),
  ore_tonnes:   z.coerce.number().min(0).optional(),
  waste_tonnes: z.coerce.number().min(0).optional(),
  grade_g_t:    z.coerce.number().min(0).optional(),
  water_m3:     z.coerce.number().min(0).optional(),
  notes:        z.string().optional(),
});

type LogForm = z.infer<typeof logSchema>;

// ─── Log modal ────────────────────────────────────────────────────────────────

function LogModal({
  open,
  onClose,
  siteId,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  siteId: string;
  existing?: ProductionLog | null;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const form = useForm<LogForm>({
    resolver: zodResolver(logSchema),
    values: {
      log_date:     existing?.log_date ?? format(new Date(), "yyyy-MM-dd"),
      ore_tonnes:   existing?.ore_tonnes ?? undefined,
      waste_tonnes: existing?.waste_tonnes ?? undefined,
      grade_g_t:    existing?.grade_g_t ?? undefined,
      water_m3:     existing?.water_m3 ?? undefined,
      notes:        existing?.notes ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (vals: LogForm) =>
      upsertProductionLog(
        {
          site_id:      siteId,
          log_date:     vals.log_date,
          ore_tonnes:   vals.ore_tonnes ?? null,
          waste_tonnes: vals.waste_tonnes ?? null,
          grade_g_t:    vals.grade_g_t ?? null,
          water_m3:     vals.water_m3 ?? null,
          notes:        vals.notes || null,
        },
        user?.id
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production_logs", siteId] });
      toast.success(existing ? "Log updated" : "Production log added");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Log" : "Log Production"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="log_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="ore_tonnes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ore Extracted (t)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="waste_tonnes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Waste Moved (t)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="grade_g_t"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grade (g/t)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.001"
                        placeholder="0.000"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="water_m3"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Water Used (m³)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.1"
                        placeholder="0"
                        {...field}
                        value={field.value ?? ""}
                      />
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
                    <Textarea
                      placeholder="Any observations for this day…"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : existing ? "Update" : "Add Log"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductionLogPage() {
  const { activeSiteId } = useSite();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductionLog | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductionLog | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["production_logs", activeSiteId],
    queryFn: () => getProductionLogs(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProductionLog(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["production_logs", activeSiteId] });
      const previous = qc.getQueryData<ProductionLog[]>(["production_logs", activeSiteId]);
      qc.setQueryData<ProductionLog[]>(["production_logs", activeSiteId],
        (old) => old?.filter((l) => l.id !== id) ?? []);
      setDeleteTarget(null);
      return { previous };
    },
    onError: (err: Error, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(["production_logs", activeSiteId], ctx.previous);
      toast.error(err.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["production_logs", activeSiteId] }),
  });

  // Totals for the displayed logs
  const totalOre   = logs.reduce((s, l) => s + (l.ore_tonnes ?? 0), 0);
  const totalWaste = logs.reduce((s, l) => s + (l.waste_tonnes ?? 0), 0);
  const avgGrade   = logs.filter((l) => l.grade_g_t != null).length > 0
    ? logs.filter((l) => l.grade_g_t != null).reduce((s, l) => s + (l.grade_g_t ?? 0), 0) /
      logs.filter((l) => l.grade_g_t != null).length
    : null;

  if (!activeSiteId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Select a site to view production logs.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pickaxe className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Production Log</h1>
        </div>
        <Button onClick={() => { setEditTarget(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Log Day
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Ore (t)", value: totalOre.toLocaleString(undefined, { maximumFractionDigits: 1 }), icon: <Pickaxe className="h-4 w-4 text-yellow-500" /> },
          { label: "Total Waste (t)", value: totalWaste.toLocaleString(undefined, { maximumFractionDigits: 1 }), icon: <Mountain className="h-4 w-4 text-muted-foreground" /> },
          { label: "Avg Grade (g/t)", value: avgGrade != null ? avgGrade.toFixed(3) : "—", icon: <FlaskConical className="h-4 w-4 text-primary" /> },
          { label: "Days Logged", value: String(logs.length), icon: <Droplets className="h-4 w-4 text-blue-500" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="rounded-lg bg-muted p-1.5">{icon}</span>
            </div>
            <p className="text-2xl font-bold font-display">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Ore (t)</th>
              <th className="px-4 py-3 text-right font-medium">Waste (t)</th>
              <th className="px-4 py-3 text-right font-medium">Grade (g/t)</th>
              <th className="px-4 py-3 text-right font-medium">Water (m³)</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Notes</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  No production logs yet. Click "Log Day" to add the first entry.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => { setEditTarget(log); setModalOpen(true); }}
                >
                  <td className="px-4 py-3 font-medium">
                    {format(new Date(log.log_date + "T00:00:00"), "EEE d MMM yyyy")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {log.ore_tonnes != null ? log.ore_tonnes.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {log.waste_tonnes != null ? log.waste_tonnes.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {log.grade_g_t != null ? log.grade_g_t.toFixed(3) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {log.water_m3 != null ? log.water_m3.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell max-w-[200px] truncate">
                    {log.notes ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(log); }}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      <LogModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        siteId={activeSiteId}
        existing={editTarget}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete production log?</AlertDialogTitle>
            <AlertDialogDescription>
              Log for {deleteTarget ? format(new Date(deleteTarget.log_date + "T00:00:00"), "d MMM yyyy") : ""} will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
