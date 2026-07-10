import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Target, Save } from "lucide-react";
import { toast } from "sonner";
import { useSite } from "@/hooks/useSite";
import { fmtCurrency } from "@/lib/formatCurrency";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { getKpiTargets, upsertKpiTarget } from "@/services/kpi.service";
import { getReportSummary } from "@/services/reports.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── Live progress panel ──────────────────────────────────────────────────────

type ProgressDir = "higher" | "lower";

interface KpiRowProps {
  label: string;
  actual: number;
  target: number;
  format: (n: number) => string;
  dir?: ProgressDir;
}

function KpiProgressRow({ label, actual, target, format: fmt, dir = "higher" }: KpiRowProps) {
  const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
  const ratio = target > 0 ? actual / target : 0;

  let status: "ok" | "warn" | "bad";
  if (dir === "higher") {
    status = ratio >= 1 ? "ok" : ratio >= 0.8 ? "warn" : "bad";
  } else {
    status = ratio <= 1 ? "ok" : ratio <= 1.1 ? "warn" : "bad";
  }

  const barColor = status === "ok" ? "bg-success" : status === "warn" ? "bg-warning" : "bg-destructive";
  const textColor = status === "ok" ? "text-success" : status === "warn" ? "text-warning" : "text-destructive";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className={cn("tabular-nums font-semibold", textColor)}>
          {fmt(actual)}
          <span className="text-muted-foreground font-normal"> / {fmt(target)}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${dir === "higher" ? pct : Math.min(ratio * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

const kpiSchema = z.object({
  revenue_target:       z.coerce.number().min(0).optional(),
  expense_budget:       z.coerce.number().min(0).optional(),
  shift_target:         z.coerce.number().int().min(0).optional(),
  equipment_uptime_pct: z.coerce.number().min(0).max(100).optional(),
  ore_tonnes_target:    z.coerce.number().min(0).optional(),
});

type KpiForm = z.infer<typeof kpiSchema>;

function fmtMonth(d: Date) {
  return format(d, "yyyy-MM-dd"); // first day of month
}

function displayMonth(d: Date) {
  return format(d, "MMMM yyyy");
}

export default function KpiTargetsPage() {
  const { activeSiteId } = useSite();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(new Date()));

  // Load last 3 months + next month to show context
  const months = [-2, -1, 0, 1].map((offset) =>
    fmtMonth(addMonths(viewMonth, offset))
  );

  const { data: targets = [] } = useQuery({
    queryKey: ["kpi_targets", activeSiteId, months],
    queryFn: () => getKpiTargets(activeSiteId!, months),
    enabled: !!activeSiteId,
  });

  const currentTarget = targets.find((t) => t.month === fmtMonth(viewMonth));

  const dateFrom = fmtMonth(viewMonth);
  const dateTo   = format(endOfMonth(viewMonth), "yyyy-MM-dd");

  const { data: actuals } = useQuery({
    queryKey: ["kpi-actuals-summary", activeSiteId, dateFrom, dateTo],
    queryFn: () => getReportSummary(activeSiteId!, dateFrom, dateTo),
    enabled: !!activeSiteId,
    staleTime: 60_000,
  });

  const { data: oreActual = 0 } = useQuery({
    queryKey: ["kpi-actuals-ore", activeSiteId, dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await supabase
        .from("production_logs")
        .select("ore_tonnes")
        .eq("site_id", activeSiteId!)
        .gte("log_date", dateFrom)
        .lte("log_date", dateTo);
      return (data ?? []).reduce((sum, r) => sum + (r.ore_tonnes ?? 0), 0);
    },
    enabled: !!activeSiteId,
    staleTime: 60_000,
  });

  const form = useForm<KpiForm>({
    resolver: zodResolver(kpiSchema),
    values: {
      revenue_target:       currentTarget?.revenue_target ?? undefined,
      expense_budget:       currentTarget?.expense_budget ?? undefined,
      shift_target:         currentTarget?.shift_target ?? undefined,
      equipment_uptime_pct: currentTarget?.equipment_uptime_pct ?? undefined,
      ore_tonnes_target:    currentTarget?.ore_tonnes_target ?? undefined,
    },
  });

  const saveMutation = useMutation({
    mutationFn: (vals: KpiForm) =>
      upsertKpiTarget(
        {
          site_id:              activeSiteId!,
          month:                fmtMonth(viewMonth),
          revenue_target:       vals.revenue_target ?? null,
          expense_budget:       vals.expense_budget ?? null,
          shift_target:         vals.shift_target ?? null,
          equipment_uptime_pct: vals.equipment_uptime_pct ?? null,
          ore_tonnes_target:    vals.ore_tonnes_target ?? null,
        },
        user?.id
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kpi_targets", activeSiteId] });
      toast.success("KPI targets saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!activeSiteId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Select a site to manage KPI targets.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">KPI Targets</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewMonth((m) => subMonths(m, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium w-32 text-center">
            {displayMonth(viewMonth)}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMonth(startOfMonth(new Date()))}
          >
            Today
          </Button>
        </div>
      </div>

      {/* Live status panel — only shown when a target exists for this month */}
      {currentTarget && actuals && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
              Live Progress — {displayMonth(viewMonth)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentTarget.revenue_target != null && (
              <KpiProgressRow
                label="Revenue"
                actual={actuals.totalIncome}
                target={currentTarget.revenue_target}
                format={fmtCurrency}
                dir="higher"
              />
            )}
            {currentTarget.expense_budget != null && (
              <KpiProgressRow
                label="Expenses vs Budget"
                actual={actuals.totalExpenses}
                target={currentTarget.expense_budget}
                format={fmtCurrency}
                dir="lower"
              />
            )}
            {currentTarget.shift_target != null && (
              <KpiProgressRow
                label="Shifts Logged"
                actual={actuals.totalShiftsLogged}
                target={currentTarget.shift_target}
                format={(n) => String(Math.round(n))}
                dir="higher"
              />
            )}
            {currentTarget.ore_tonnes_target != null && (
              <KpiProgressRow
                label="Ore Extracted (t)"
                actual={oreActual}
                target={currentTarget.ore_tonnes_target}
                format={(n) => `${n.toLocaleString("en-US", { maximumFractionDigits: 1 })} t`}
                dir="higher"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Target form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Targets for {displayMonth(viewMonth)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="revenue_target"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Revenue Target ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
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
                  name="expense_budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expense Budget ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
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
                  name="shift_target"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shifts Planned</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
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
                  name="equipment_uptime_pct"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Equipment Uptime Target (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          placeholder="95"
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
                  name="ore_tonnes_target"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ore Extraction Target (t)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
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

              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="w-full sm:w-auto"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? "Saving…" : "Save Targets"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* History: last 3 months */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Recent Months
        </h2>
        <div className="space-y-2">
          {[-2, -1].map((offset) => {
            const m = addMonths(viewMonth, offset);
            const t = targets.find((x) => x.month === fmtMonth(m));
            if (!t) return null;
            return (
              <button
                key={offset}
                onClick={() => setViewMonth(m)}
                className="w-full text-left rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/40 transition-colors"
              >
                <p className="text-sm font-medium">{displayMonth(m)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t.revenue_target != null && `Revenue: ${fmtCurrency(t.revenue_target)} · `}
                  {t.ore_tonnes_target != null && `Ore: ${t.ore_tonnes_target}t · `}
                  {t.shift_target != null && `Shifts: ${t.shift_target}`}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
