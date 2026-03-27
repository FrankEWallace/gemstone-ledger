import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, startOfMonth, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Target, Save } from "lucide-react";
import { toast } from "sonner";
import { useSite } from "@/hooks/useSite";
import { useAuth } from "@/hooks/useAuth";
import { getKpiTargets, upsertKpiTarget } from "@/services/kpi.service";
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
                  {t.revenue_target != null && `Revenue: $${t.revenue_target.toLocaleString()} · `}
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
