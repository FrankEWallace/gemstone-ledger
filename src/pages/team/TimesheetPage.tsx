import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, Download, FileText, Clock } from "lucide-react";
import { useSite } from "@/hooks/useSite";
import { getWorkers, getShiftRecords } from "@/services/team.service";
import type { Worker, ShiftRecord } from "@/lib/supabaseTypes";
import { Button } from "@/components/ui/button";

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCsv(
  workers: Worker[],
  records: ShiftRecord[],
  weekStart: Date,
  weekEnd: Date
) {
  const workerMap = Object.fromEntries(workers.map((w) => [w.id, w]));
  const weekRecords = records.filter(
    (r) => r.shift_date >= format(weekStart, "yyyy-MM-dd") && r.shift_date <= format(weekEnd, "yyyy-MM-dd")
  );

  const rows = weekRecords.map((r) => {
    const w = workerMap[r.worker_id];
    return [
      r.shift_date,
      w?.full_name ?? r.worker_id,
      w?.department ?? "",
      r.hours_worked ?? "",
      r.output_metric ?? "",
      r.metric_unit ?? "",
      (r.notes ?? "").replace(/,/g, " "),
    ].join(",");
  });

  const csv = [
    "Date,Worker,Department,Hours Worked,Output,Unit,Notes",
    ...rows,
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `timesheet_${format(weekStart, "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── PDF export ───────────────────────────────────────────────────────────────

async function exportPdf(
  workers: Worker[],
  records: ShiftRecord[],
  weekStart: Date,
  weekEnd: Date,
  siteName: string
) {
  const { pdf, Document, Page, Text, View, StyleSheet } = await import("@react-pdf/renderer");

  const workerMap = Object.fromEntries(workers.map((w) => [w.id, w]));
  const weekRecords = records.filter(
    (r) => r.shift_date >= format(weekStart, "yyyy-MM-dd") && r.shift_date <= format(weekEnd, "yyyy-MM-dd")
  );

  const styles = StyleSheet.create({
    page:    { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
    title:   { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
    sub:     { fontSize: 10, color: "#666", marginBottom: 16 },
    header:  { flexDirection: "row", borderBottomWidth: 1, borderColor: "#ccc", paddingBottom: 4, marginBottom: 4 },
    row:     { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderColor: "#eee" },
    col:     { flex: 1 },
    colSm:   { width: 60 },
    bold:    { fontWeight: "bold" },
    total:   { flexDirection: "row", paddingTop: 8, fontWeight: "bold" },
  });

  const totalHours = weekRecords.reduce((s, r) => s + (r.hours_worked ?? 0), 0);

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Weekly Timesheet</Text>
        <Text style={styles.sub}>
          {siteName} · {format(weekStart, "d MMM")} – {format(weekEnd, "d MMM yyyy")}
        </Text>

        <View style={styles.header}>
          <Text style={[styles.col, styles.bold]}>Worker</Text>
          <Text style={[styles.col, styles.bold]}>Department</Text>
          <Text style={[styles.colSm, styles.bold]}>Date</Text>
          <Text style={[styles.colSm, styles.bold]}>Hours</Text>
          <Text style={[styles.colSm, styles.bold]}>Output</Text>
          <Text style={[styles.col, styles.bold]}>Notes</Text>
        </View>

        {weekRecords.map((r) => {
          const w = workerMap[r.worker_id];
          return (
            <View key={r.id} style={styles.row}>
              <Text style={styles.col}>{w?.full_name ?? "—"}</Text>
              <Text style={styles.col}>{w?.department ?? "—"}</Text>
              <Text style={styles.colSm}>{r.shift_date}</Text>
              <Text style={styles.colSm}>{r.hours_worked ?? "—"}</Text>
              <Text style={styles.colSm}>
                {r.output_metric != null ? `${r.output_metric} ${r.metric_unit ?? ""}` : "—"}
              </Text>
              <Text style={styles.col}>{r.notes ?? ""}</Text>
            </View>
          );
        })}

        <View style={styles.total}>
          <Text style={styles.col}>Total hours</Text>
          <Text>{totalHours}</Text>
        </View>
      </Page>
    </Document>
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `timesheet_${format(weekStart, "yyyy-MM-dd")}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TimesheetPage() {
  const { activeSiteId, sites } = useSite();
  const [weekAnchor, setWeekAnchor] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [pdfLoading, setPdfLoading] = useState(false);

  const weekStart = startOfWeek(weekAnchor, { weekStartsOn: 1 });
  const weekEnd   = endOfWeek(weekAnchor, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: workers = [] } = useQuery({
    queryKey: ["workers", activeSiteId],
    queryFn: () => getWorkers(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["shift_records", activeSiteId],
    queryFn: () => getShiftRecords(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const workerMap = useMemo(
    () => Object.fromEntries(workers.map((w) => [w.id, w])),
    [workers]
  );

  // Build matrix: workerId → date → record
  const weekFromStr = format(weekStart, "yyyy-MM-dd");
  const weekToStr   = format(weekEnd, "yyyy-MM-dd");
  const weekRecords = records.filter(
    (r) => r.shift_date >= weekFromStr && r.shift_date <= weekToStr
  );

  // Per-worker row summaries
  const workerTotals = useMemo(() => {
    const map: Record<string, { worker: Worker; records: Record<string, ShiftRecord>; totalHours: number }> = {};
    for (const r of weekRecords) {
      if (!map[r.worker_id]) {
        const w = workerMap[r.worker_id];
        if (!w) continue;
        map[r.worker_id] = { worker: w, records: {}, totalHours: 0 };
      }
      map[r.worker_id].records[r.shift_date] = r;
      map[r.worker_id].totalHours += r.hours_worked ?? 0;
    }
    return Object.values(map).sort((a, b) =>
      a.worker.full_name.localeCompare(b.worker.full_name)
    );
  }, [weekRecords, workerMap]);

  const grandTotal = workerTotals.reduce((s, wt) => s + wt.totalHours, 0);

  const siteName = sites.find((s) => s.id === activeSiteId)?.name ?? "Site";

  const handleCsvExport = () => {
    exportCsv(workers, records, weekStart, weekEnd);
  };

  const handlePdfExport = async () => {
    setPdfLoading(true);
    try {
      await exportPdf(workers, records, weekStart, weekEnd, siteName);
    } finally {
      setPdfLoading(false);
    }
  };

  if (!activeSiteId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Select a site to view timesheets.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Timesheets</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Week navigation */}
          <Button variant="outline" size="icon" onClick={() => setWeekAnchor((d) => subWeeks(d, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium w-44 text-center tabular-nums">
            {format(weekStart, "d MMM")} – {format(weekEnd, "d MMM yyyy")}
          </span>
          <Button variant="outline" size="icon" onClick={() => setWeekAnchor((d) => addWeeks(d, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWeekAnchor(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            This week
          </Button>

          {/* Exports */}
          <Button variant="outline" size="sm" onClick={handleCsvExport}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePdfExport}
            disabled={pdfLoading}
          >
            <FileText className="h-4 w-4 mr-1" />
            {pdfLoading ? "Generating…" : "PDF"}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Hours</p>
          <p className="text-2xl font-bold font-display mt-1">{grandTotal}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Workers Active</p>
          <p className="text-2xl font-bold font-display mt-1">{workerTotals.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Shift Records</p>
          <p className="text-2xl font-bold font-display mt-1">{weekRecords.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Avg Hours / Worker</p>
          <p className="text-2xl font-bold font-display mt-1">
            {workerTotals.length > 0
              ? (grandTotal / workerTotals.length).toFixed(1)
              : "—"}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium w-40">Worker</th>
              <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Dept.</th>
              {days.map((day) => (
                <th key={day.toISOString()} className="px-3 py-3 text-center font-medium">
                  <div>{format(day, "EEE")}</div>
                  <div className="text-[10px] text-muted-foreground/70">{format(day, "d")}</div>
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium">Total hrs</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 10 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : workerTotals.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  No shift records for this week.
                </td>
              </tr>
            ) : (
              workerTotals.map(({ worker, records: wRecs, totalHours }) => (
                <tr
                  key={worker.id}
                  className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 font-medium truncate max-w-[160px]">
                    {worker.full_name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden sm:table-cell">
                    {worker.department ?? "—"}
                  </td>
                  {days.map((day) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const rec = wRecs[dateStr];
                    return (
                      <td key={dateStr} className="px-3 py-3 text-center tabular-nums">
                        {rec ? (
                          <span className="text-xs font-medium" title={rec.notes ?? ""}>
                            {rec.hours_worked ?? "✓"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30 text-xs">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    {totalHours || "—"}
                  </td>
                </tr>
              ))
            )}
            {!isLoading && workerTotals.length > 0 && (
              <tr className="border-t border-border bg-muted/20 font-semibold">
                <td className="px-4 py-3" colSpan={2}>Total</td>
                {days.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const dayHours = weekRecords
                    .filter((r) => r.shift_date === dateStr)
                    .reduce((s, r) => s + (r.hours_worked ?? 0), 0);
                  return (
                    <td key={dateStr} className="px-3 py-3 text-center tabular-nums text-xs">
                      {dayHours || "—"}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-right tabular-nums">{grandTotal}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
