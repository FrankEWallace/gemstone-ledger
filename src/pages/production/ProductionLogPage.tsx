import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, subMonths, startOfMonth, parseISO } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Plus, Trash2, Pickaxe, Droplets, Mountain, FlaskConical, X, Scale,
} from "lucide-react";
import { toast } from "sonner";
import { useSite } from "@/hooks/useSite";
import { useAuth } from "@/hooks/useAuth";
import {
  getProductionLogs,
  upsertProductionLog,
  deleteProductionLog,
} from "@/services/production.service";
import { getCustomers } from "@/services/customers.service";
import { getTransactions } from "@/services/transactions.service";
import type { ProductionLog } from "@/lib/supabaseTypes";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ─── Schema ───────────────────────────────────────────────────────────────────

const logSchema = z.object({
  log_date:     z.string().min(1, "Date is required"),
  customer_id:  z.string().optional(),
  ore_tonnes:   z.coerce.number().min(0).optional(),
  waste_tonnes: z.coerce.number().min(0).optional(),
  grade_g_t:    z.coerce.number().min(0).optional(),
  water_m3:     z.coerce.number().min(0).optional(),
  notes:        z.string().optional(),
});

type LogForm = z.infer<typeof logSchema>;

// ─── Date presets ─────────────────────────────────────────────────────────────

const PRESETS = [
  { label: "This month",    months: 0 },
  { label: "Last 3 months", months: 2 },
  { label: "All time",      months: -1 },
] as const;

// ─── Log Modal ────────────────────────────────────────────────────────────────

function LogModal({
  open, onClose, siteId, existing, customers,
}: {
  open: boolean;
  onClose: () => void;
  siteId: string;
  existing?: ProductionLog | null;
  customers: { id: string; name: string }[];
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const form = useForm<LogForm>({
    resolver: zodResolver(logSchema),
    values: {
      log_date:     existing?.log_date ?? format(new Date(), "yyyy-MM-dd"),
      customer_id:  existing?.customer_id ?? "",
      ore_tonnes:   existing?.ore_tonnes ?? undefined,
      waste_tonnes: existing?.waste_tonnes ?? undefined,
      grade_g_t:    existing?.grade_g_t ?? undefined,
      water_m3:     existing?.water_m3 ?? undefined,
      notes:        existing?.notes ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (vals: LogForm) =>
      upsertProductionLog({
        site_id:      siteId,
        customer_id:  vals.customer_id || null,
        log_date:     vals.log_date,
        ore_tonnes:   vals.ore_tonnes ?? null,
        waste_tonnes: vals.waste_tonnes ?? null,
        grade_g_t:    vals.grade_g_t ?? null,
        water_m3:     vals.water_m3 ?? null,
        notes:        vals.notes || null,
      }, user?.id),
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
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="log_date" render={({ field }) => (
              <FormItem>
                <FormLabel>Date *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {customers.length > 0 && (
              <FormField control={form.control} name="customer_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer (optional)</FormLabel>
                  <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <FormControl><SelectTrigger><SelectValue placeholder="No customer" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">No customer</SelectItem>
                      {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="ore_tonnes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ore Extracted (t)</FormLabel>
                  <FormControl><Input type="number" min={0} step="0.01" placeholder="0" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="waste_tonnes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Waste Moved (t)</FormLabel>
                  <FormControl><Input type="number" min={0} step="0.01" placeholder="0" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="grade_g_t" render={({ field }) => (
                <FormItem>
                  <FormLabel>Grade (g/t)</FormLabel>
                  <FormControl><Input type="number" min={0} step="0.001" placeholder="0.000" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="water_m3" render={({ field }) => (
                <FormItem>
                  <FormLabel>Water Used (m³)</FormLabel>
                  <FormControl><Input type="number" min={0} step="0.1" placeholder="0" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea placeholder="Any observations for this day…" rows={3} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
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

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md text-xs">
      <p className="font-medium mb-1">{label}</p>
      <p className="text-muted-foreground">Ore: <span className="font-semibold text-foreground">{payload[0]?.value?.toLocaleString()} t</span></p>
      {payload[1]?.value > 0 && (
        <p className="text-muted-foreground">Waste: <span className="font-semibold text-foreground">{payload[1]?.value?.toLocaleString()} t</span></p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductionLogPage() {
  const { activeSiteId } = useSite();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProductionLog | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductionLog | null>(null);
  const [customerFilter, setCustomerFilter] = useState("all");
  const [preset, setPreset] = useState<0 | 2 | -1>(0);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["production_logs", activeSiteId],
    queryFn: () => getProductionLogs(activeSiteId!, 365),
    enabled: !!activeSiteId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", activeSiteId],
    queryFn: () => getCustomers(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const { data: allTransactions = [] } = useQuery({
    queryKey: ["transactions", activeSiteId],
    queryFn: () => getTransactions(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const customerMap = new Map(customers.map((c) => [c.id, c.name]));

  // Apply date + customer filter
  const dateFrom = preset === -1
    ? null
    : startOfMonth(subMonths(new Date(), preset));

  const filteredLogs = useMemo(() => {
    return logs
      .filter((l) => customerFilter === "all" || l.customer_id === customerFilter)
      .filter((l) => !dateFrom || parseISO(l.log_date) >= dateFrom);
  }, [logs, customerFilter, dateFrom]);

  // Stats
  const totalOre   = filteredLogs.reduce((s, l) => s + (l.ore_tonnes ?? 0), 0);
  const totalWaste = filteredLogs.reduce((s, l) => s + (l.waste_tonnes ?? 0), 0);
  const logsWithGrade = filteredLogs.filter((l) => l.grade_g_t != null && l.ore_tonnes != null && l.ore_tonnes > 0);
  const avgGrade = logsWithGrade.length > 0
    ? logsWithGrade.reduce((s, l) => s + (l.grade_g_t ?? 0), 0) / logsWithGrade.length
    : null;
  const containedMetalG = logsWithGrade.reduce((s, l) => s + (l.ore_tonnes ?? 0) * (l.grade_g_t ?? 0), 0);
  const stripRatio = totalOre > 0 ? totalWaste / totalOre : null;

  const relevantTx = customerFilter === "all"
    ? allTransactions
    : allTransactions.filter((t) => t.customer_id === customerFilter);
  const totalExpenses = relevantTx
    .filter((t) => t.type === "expense" && t.status === "success")
    .reduce((s, t) => s + t.unit_price * t.quantity, 0);
  const costPerTonne = totalOre > 0 ? totalExpenses / totalOre : null;

  // Chart data — daily ore + waste, sorted ascending
  const chartData = useMemo(() => {
    return [...filteredLogs]
      .sort((a, b) => a.log_date.localeCompare(b.log_date))
      .map((l) => ({
        date: format(parseISO(l.log_date), "d MMM"),
        ore:  l.ore_tonnes ?? 0,
        waste: l.waste_tonnes ?? 0,
      }));
  }, [filteredLogs]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProductionLog(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["production_logs", activeSiteId] });
      const previous = qc.getQueryData<ProductionLog[]>(["production_logs", activeSiteId]);
      qc.setQueryData<ProductionLog[]>(["production_logs", activeSiteId], (old) => old?.filter((l) => l.id !== id) ?? []);
      setDeleteTarget(null);
      return { previous };
    },
    onError: (err: Error, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(["production_logs", activeSiteId], ctx.previous);
      toast.error(err.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["production_logs", activeSiteId] }),
  });

  if (!activeSiteId) {
    return <div className="p-6 text-center text-muted-foreground">Select a site to view production logs.</div>;
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pickaxe className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl font-bold">Production Log</h1>
        </div>
        <Button className="hidden sm:inline-flex" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Log Day
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setPreset(p.months as 0 | 2 | -1)}
            className={`h-8 rounded-lg border px-3 text-xs font-medium transition-colors ${
              preset === p.months
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
        {customers.length > 0 && (
          <Select value={customerFilter} onValueChange={setCustomerFilter}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="All customers" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Ore (t)",       value: totalOre.toLocaleString(undefined, { maximumFractionDigits: 1 }),                             icon: <Pickaxe className="h-4 w-4 text-chart-7" /> },
          { label: "Total Waste (t)",     value: totalWaste.toLocaleString(undefined, { maximumFractionDigits: 1 }),                           icon: <Mountain className="h-4 w-4 text-muted-foreground" /> },
          { label: "Avg Grade (g/t)",     value: avgGrade != null ? avgGrade.toFixed(3) : "—",                                                 icon: <FlaskConical className="h-4 w-4 text-primary" /> },
          { label: "Contained Metal (g)", value: containedMetalG > 0 ? containedMetalG.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—", icon: <Scale className="h-4 w-4 text-chart-8" /> },
          { label: "Strip Ratio",         value: stripRatio != null ? stripRatio.toFixed(2) : "—",                                             icon: <Mountain className="h-4 w-4 text-chart-4" /> },
          { label: "Cost / Tonne",        value: costPerTonne != null ? `$${costPerTonne.toFixed(2)}` : "—",                                   icon: <Droplets className="h-4 w-4 text-chart-2" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground leading-tight">{label}</span>
              <span className="rounded-lg bg-muted p-1.5 shrink-0">{icon}</span>
            </div>
            <p className="font-display text-xl font-semibold tabular-nums leading-none">{value}</p>
          </div>
        ))}
      </div>

      {/* Trend chart */}
      {chartData.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4 lg:p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Ore & Waste Trend</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barGap={2} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
              <Bar dataKey="ore"   name="Ore"   fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="waste" name="Waste" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-end">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-1)]" /> Ore
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm bg-[var(--chart-2)]" /> Waste
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Customer</th>
              <th className="px-4 py-3 text-right font-medium">Ore (t)</th>
              <th className="px-4 py-3 text-right font-medium">Waste (t)</th>
              <th className="px-4 py-3 text-right font-medium">Grade (g/t)</th>
              <th className="px-4 py-3 text-right font-medium hidden md:table-cell">Metal (g)</th>
              <th className="px-4 py-3 text-right font-medium">Water (m³)</th>
              <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Notes</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                  No production logs for this period. Click "Log Day" to add the first entry.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => {
                const metalG = (log.ore_tonnes ?? 0) * (log.grade_g_t ?? 0);
                return (
                  <tr
                    key={log.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => { setEditTarget(log); setModalOpen(true); }}
                  >
                    <td className="px-4 py-3 font-medium">
                      {format(parseISO(log.log_date), "EEE d MMM yyyy")}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                      {log.customer_id ? (customerMap.get(log.customer_id) ?? "—") : "—"}
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
                    <td className="px-4 py-3 text-right tabular-nums text-chart-8 hidden md:table-cell">
                      {metalG > 0 ? metalG.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {log.water_m3 != null ? log.water_m3.toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell max-w-[180px] truncate">
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
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <LogModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditTarget(null); }}
        siteId={activeSiteId}
        existing={editTarget}
        customers={customers}
      />

      {/* Mobile FAB */}
      <button
        type="button"
        onClick={() => { setEditTarget(null); setModalOpen(true); }}
        className="sm:hidden fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform"
        aria-label="Log new day"
      >
        <Plus className="h-6 w-6" />
      </button>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete production log?</AlertDialogTitle>
            <AlertDialogDescription>
              Log for {deleteTarget ? format(parseISO(deleteTarget.log_date), "d MMM yyyy") : ""} will be permanently removed.
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
