import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  parseISO,
  differenceInDays,
} from "date-fns";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ArrowLeft, Download, ChevronRight, ChevronDown, Package, AlertTriangle } from "lucide-react";

import { useSite } from "@/hooks/useSite";
import { supabase } from "@/lib/supabase";
import { isDemoMode } from "@/lib/demo";
import { fmtCurrency, fmtTick, CURRENCY_SYMBOL } from "@/lib/formatCurrency";
import { getInventoryItems, getInventoryConsumptionRates } from "@/services/inventory.service";
import type { Tables } from "@/lib/supabaseTypes";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Types ────────────────────────────────────────────────────────────────────

type InventoryItem = Tables<"inventory_items">;

export interface InventoryUsageRow {
  id: string;
  inventoryItemId: string;
  itemName: string;
  category: string;
  unit: string;
  quantityConsumed: number;
  valueConsumed: number;
  customerId: string | null;
  customerName: string | null;
  transactionDate: string;
}

export interface WriteOffRow {
  id: string;
  itemName: string;
  category: string;
  unit: string;
  quantity: number;
  unitCost: number;
  value: number;
  reason: string;
  notes: string | null;
  writtenOffAt: string;
}

// ─── Service helpers (inline, to be moved to inventory.service later) ─────────

async function fetchInventoryUsage(
  siteId: string,
  dateFrom: string,
  dateTo: string
): Promise<InventoryUsageRow[]> {
  if (isDemoMode()) return [];

  const { data, error } = await supabase
    .from("transactions")
    .select("id, quantity, unit_price, transaction_date, inventory_item_id, customer_id, description, customers(name)")
    .eq("site_id", siteId)
    .eq("source", "inventory")
    .not("inventory_item_id", "is", null)
    .gte("transaction_date", dateFrom)
    .lte("transaction_date", dateTo);

  if (error) throw error;

  return (data ?? []).map((row: any) => {
    // Parse item name from description: "ItemName usage — N units"
    const descriptionMatch = (row.description ?? "").match(/^(.+?) usage/);
    const itemName = descriptionMatch ? descriptionMatch[1] : row.description ?? "Unknown Item";

    return {
      id: row.id,
      inventoryItemId: row.inventory_item_id,
      itemName,
      category: "",
      unit: "",
      quantityConsumed: Number(row.quantity ?? 0),
      valueConsumed: Number(row.quantity ?? 0) * Number(row.unit_price ?? 0),
      customerId: row.customer_id ?? null,
      customerName: row.customers?.name ?? null,
      transactionDate: row.transaction_date,
    };
  });
}

async function fetchInventoryWriteOffs(
  siteId: string,
  dateFrom: string,
  dateTo: string
): Promise<WriteOffRow[]> {
  if (isDemoMode()) return [];

  const { data, error } = await supabase
    .from("inventory_write_offs" as any)
    .select("id, quantity, reason, notes, written_off_at, inventory_items(name, category, unit, unit_cost)")
    .eq("site_id", siteId)
    .gte("written_off_at", dateFrom)
    .lte("written_off_at", dateTo);

  if (error) {
    // Table may not exist yet in all environments — return empty gracefully
    console.warn("inventory_write_offs query failed:", error.message);
    return [];
  }

  return (data ?? []).map((row: any) => {
    const item = row.inventory_items ?? {};
    const qty = Number(row.quantity ?? 0);
    const unitCost = Number(item.unit_cost ?? 0);
    return {
      id: row.id,
      itemName: item.name ?? "Unknown",
      category: item.category ?? "",
      unit: item.unit ?? "",
      quantity: qty,
      unitCost,
      value: qty * unitCost,
      reason: row.reason ?? "Other",
      notes: row.notes ?? null,
      writtenOffAt: row.written_off_at,
    };
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CAT_COLORS = [
  "var(--chart-cat-1)",
  "var(--chart-cat-2)",
  "var(--chart-cat-3)",
  "var(--chart-cat-4)",
  "var(--chart-cat-5)",
];

const REASON_BADGE: Record<string, { label: string; className: string }> = {
  Damaged:   { label: "Damaged",   className: "bg-orange-100 text-orange-700 border-orange-200" },
  Expired:   { label: "Expired",   className: "bg-purple-100 text-purple-700 border-purple-200" },
  Theft:     { label: "Theft",     className: "bg-red-100 text-red-700 border-red-200" },
  Stocktake: { label: "Stocktake", className: "bg-blue-100 text-blue-700 border-blue-200" },
};

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground mb-4">
      {children}
    </p>
  );
}

function EmptyState({ message = "No data for this period." }: { message?: string }) {
  return (
    <div className="text-center text-sm text-muted-foreground py-8">{message}</div>
  );
}

function ChartTooltipCustom({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: p.fill ?? p.stroke }}
          />
          {p.name}:&nbsp;
          <span className="font-semibold text-foreground">{fmtCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 flex flex-col gap-1 min-w-0 overflow-hidden relative">
      {color && (
        <div
          className="absolute inset-x-0 top-0 h-[3px] rounded-t-lg"
          style={{ backgroundColor: color }}
        />
      )}
      <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground truncate pt-0.5">
        {label}
      </p>
      <p
        className="text-lg font-bold tracking-tight leading-none tabular-nums font-display truncate"
        style={color ? { color } : undefined}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}

// ─── Customer row (expandable) ────────────────────────────────────────────────

function CustomerRow({
  customerName,
  totalValue,
  lines,
  isOpen,
  onToggle,
}: {
  customerName: string;
  totalValue: number;
  lines: { itemName: string; quantityConsumed: number; unit: string; valueConsumed: number }[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold truncate">{customerName}</span>
            <span className="text-sm font-bold tabular-nums shrink-0">{fmtCurrency(totalValue)}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {lines.length} item{lines.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[420px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-5 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">
                    Item
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">
                    Qty
                  </th>
                  <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground hidden sm:table-cell">
                    Unit
                  </th>
                  <th className="px-5 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.map((l, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 font-medium truncate max-w-[200px]">{l.itemName}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                      {l.quantityConsumed}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell">{l.unit || "—"}</td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold">
                      {fmtCurrency(l.valueConsumed)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/20">
                  <td colSpan={3} className="px-5 py-2.5 text-xs font-semibold text-muted-foreground">
                    Customer total
                  </td>
                  <td className="px-5 py-2.5 text-right text-sm font-bold tabular-nums">
                    {fmtCurrency(totalValue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryReportPage() {
  const { activeSiteId, activeSite } = useSite();
  const today = new Date();

  // ── Date range state ──────────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState(
    format(startOfMonth(today), "yyyy-MM-dd")
  );
  const [dateTo, setDateTo] = useState(format(today, "yyyy-MM-dd"));
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // ── Customer row expand map ───────────────────────────────────────────────
  const [openCustomers, setOpenCustomers] = useState<Record<string, boolean>>({});

  // ── Date presets ─────────────────────────────────────────────────────────
  const PRESETS = [
    {
      label: "This month",
      from: format(startOfMonth(today), "yyyy-MM-dd"),
      to: format(today, "yyyy-MM-dd"),
    },
    {
      label: "Last month",
      from: format(startOfMonth(subMonths(today, 1)), "yyyy-MM-dd"),
      to: format(endOfMonth(subMonths(today, 1)), "yyyy-MM-dd"),
    },
    {
      label: "3M",
      from: format(startOfMonth(subMonths(today, 2)), "yyyy-MM-dd"),
      to: format(today, "yyyy-MM-dd"),
    },
    {
      label: "6M",
      from: format(startOfMonth(subMonths(today, 5)), "yyyy-MM-dd"),
      to: format(today, "yyyy-MM-dd"),
    },
  ];

  // Determine if period is > 3 months (for chart granularity)
  const periodDays = useMemo(() => {
    const a = parseISO(dateFrom);
    const b = parseISO(dateTo);
    return differenceInDays(b, a);
  }, [dateFrom, dateTo]);

  const groupByMonth = periodDays > 90;

  // ── Queries ───────────────────────────────────────────────────────────────
  const queryOpts = { enabled: !!activeSiteId, staleTime: 0 };

  const { data: inventoryItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ["inventory-items", activeSiteId],
    queryFn: () => getInventoryItems(activeSiteId!),
    ...queryOpts,
  });

  const { data: consumptionRates = {}, isLoading: loadingRates } = useQuery({
    queryKey: ["inventory-consumption-rates", activeSiteId],
    queryFn: () => getInventoryConsumptionRates(activeSiteId!),
    ...queryOpts,
  });

  const { data: usageRows = [], isLoading: loadingUsage } = useQuery({
    queryKey: ["inventory-usage-report", activeSiteId, dateFrom, dateTo],
    queryFn: () => fetchInventoryUsage(activeSiteId!, dateFrom, dateTo),
    ...queryOpts,
  });

  const { data: writeOffRows = [], isLoading: loadingWriteOffs } = useQuery({
    queryKey: ["inventory-writeoffs-report", activeSiteId, dateFrom, dateTo],
    queryFn: () => fetchInventoryWriteOffs(activeSiteId!, dateFrom, dateTo),
    ...queryOpts,
  });

  const isLoading = loadingItems || loadingRates || loadingUsage || loadingWriteOffs;

  // ── Enrich usage rows with category/unit from inventory items ─────────────
  const itemMap = useMemo(() => {
    const map: Record<string, InventoryItem> = {};
    for (const item of inventoryItems) map[item.id] = item;
    return map;
  }, [inventoryItems]);

  const enrichedUsage = useMemo<InventoryUsageRow[]>(() => {
    return usageRows.map((row) => {
      const item = itemMap[row.inventoryItemId];
      return {
        ...row,
        category: item?.category ?? row.category ?? "",
        unit: item?.unit ?? row.unit ?? "",
      };
    });
  }, [usageRows, itemMap]);

  // ── KPI calculations ──────────────────────────────────────────────────────
  const totalItems = inventoryItems.length;

  const stockValue = useMemo(
    () =>
      inventoryItems.reduce(
        (sum, item) => sum + item.quantity * Number(item.unit_cost ?? 0),
        0
      ),
    [inventoryItems]
  );

  const lowOrOutItems = useMemo(
    () =>
      inventoryItems.filter(
        (item) =>
          item.reorder_level != null && item.quantity <= item.reorder_level
      ),
    [inventoryItems]
  );

  const consumptionValue = useMemo(
    () => enrichedUsage.reduce((sum, row) => sum + row.valueConsumed, 0),
    [enrichedUsage]
  );

  // ── Consumption by item ───────────────────────────────────────────────────
  const consumptionByItem = useMemo(() => {
    const map: Record<
      string,
      {
        itemName: string;
        category: string;
        unit: string;
        quantityConsumed: number;
        valueConsumed: number;
      }
    > = {};
    for (const row of enrichedUsage) {
      if (!map[row.inventoryItemId]) {
        map[row.inventoryItemId] = {
          itemName: row.itemName,
          category: row.category,
          unit: row.unit,
          quantityConsumed: 0,
          valueConsumed: 0,
        };
      }
      map[row.inventoryItemId].quantityConsumed += row.quantityConsumed;
      map[row.inventoryItemId].valueConsumed += row.valueConsumed;
    }
    return Object.values(map).sort((a, b) => b.valueConsumed - a.valueConsumed);
  }, [enrichedUsage]);

  // ── Consumption over time ─────────────────────────────────────────────────
  const consumptionOverTime = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of enrichedUsage) {
      const key = groupByMonth
        ? row.transactionDate.slice(0, 7) // YYYY-MM
        : row.transactionDate.slice(0, 10); // YYYY-MM-DD
      map[key] = (map[key] ?? 0) + row.valueConsumed;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        date: groupByMonth
          ? format(parseISO(date + "-01"), "MMM yy")
          : format(parseISO(date), "d MMM"),
        value,
      }));
  }, [enrichedUsage, groupByMonth]);

  // ── Consumption by customer ───────────────────────────────────────────────
  const consumptionByCustomer = useMemo(() => {
    const map: Record<
      string,
      {
        customerName: string;
        totalValue: number;
        lines: {
          itemName: string;
          quantityConsumed: number;
          unit: string;
          valueConsumed: number;
        }[];
      }
    > = {};

    for (const row of enrichedUsage) {
      const key = row.customerId ?? "__unattributed__";
      const name = row.customerId ? (row.customerName ?? "Unknown Customer") : "Unattributed";
      if (!map[key]) {
        map[key] = { customerName: name, totalValue: 0, lines: [] };
      }
      map[key].totalValue += row.valueConsumed;
      const existing = map[key].lines.find((l) => l.itemName === row.itemName);
      if (existing) {
        existing.quantityConsumed += row.quantityConsumed;
        existing.valueConsumed += row.valueConsumed;
      } else {
        map[key].lines.push({
          itemName: row.itemName,
          quantityConsumed: row.quantityConsumed,
          unit: row.unit,
          valueConsumed: row.valueConsumed,
        });
      }
    }

    return Object.entries(map)
      .sort(([, a], [, b]) => b.totalValue - a.totalValue)
      .map(([key, val]) => ({ key, ...val }));
  }, [enrichedUsage]);

  // ── Low stock items ───────────────────────────────────────────────────────
  const lowStockItems = useMemo(
    () =>
      lowOrOutItems.map((item) => {
        const rate = consumptionRates[item.id] ?? 0;
        const daysLeft =
          rate > 0 ? Math.max(0, Math.floor(item.quantity / rate)) : null;
        const isOut = item.quantity <= 0;
        return { item, daysLeft, isOut };
      }),
    [lowOrOutItems, consumptionRates]
  );

  // ── CSV export ────────────────────────────────────────────────────────────
  function handleExportCSV() {
    const sections: string[][] = [];

    // Stock overview
    sections.push(["=== STOCK OVERVIEW ==="], ["Item", "Category", "Qty", "Unit Cost", "Stock Value", "Reorder At"]);
    for (const item of inventoryItems) {
      sections.push([
        item.name,
        item.category ?? "",
        String(item.quantity),
        String(item.unit_cost ?? 0),
        String(item.quantity * Number(item.unit_cost ?? 0)),
        String(item.reorder_level ?? ""),
      ]);
    }

    sections.push([]);

    // Consumption by item
    sections.push(["=== CONSUMPTION BY ITEM ==="], ["Item", "Category", "Unit", "Qty Consumed", "Value"]);
    for (const row of consumptionByItem) {
      sections.push([
        row.itemName,
        row.category,
        row.unit,
        String(row.quantityConsumed),
        String(row.valueConsumed.toFixed(2)),
      ]);
    }

    sections.push([]);

    // Consumption by customer (flat)
    sections.push(["=== CONSUMPTION BY CUSTOMER ==="], ["Customer", "Item", "Qty Consumed", "Unit", "Value"]);
    for (const cust of consumptionByCustomer) {
      for (const line of cust.lines) {
        sections.push([
          cust.customerName,
          line.itemName,
          String(line.quantityConsumed),
          line.unit,
          String(line.valueConsumed.toFixed(2)),
        ]);
      }
    }

    sections.push([]);

    // Low stock
    sections.push(["=== LOW STOCK ALERTS ==="], ["Item", "Category", "Current Qty", "Reorder At", "Status", "Est. Days Left"]);
    for (const { item, daysLeft, isOut } of lowStockItems) {
      sections.push([
        item.name,
        item.category ?? "",
        String(item.quantity),
        String(item.reorder_level ?? ""),
        isOut ? "Out of Stock" : "Low Stock",
        daysLeft != null ? String(daysLeft) : "—",
      ]);
    }

    sections.push([]);

    // Write-offs
    sections.push(["=== WRITE-OFFS ==="], ["Date", "Item", "Category", "Qty", "Reason", "Value", "Notes"]);
    for (const row of writeOffRows) {
      sections.push([
        row.writtenOffAt,
        row.itemName,
        row.category,
        String(row.quantity),
        row.reason,
        String(row.value.toFixed(2)),
        row.notes ?? "",
      ]);
    }

    const csv = sections
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-report-${dateFrom}-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── PDF export ────────────────────────────────────────────────────────────
  async function handleExportPDF() {
    setIsExportingPDF(true);
    try {
      const { pdf, Document, Page, Text, View, StyleSheet } =
        await import("@react-pdf/renderer");

      const s = StyleSheet.create({
        page:              { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#111" },
        title:             { fontSize: 20, fontWeight: "bold", marginBottom: 4 },
        subtitle:          { fontSize: 10, color: "#666", marginBottom: 28 },
        section:           { marginBottom: 22 },
        sectionTitle:      { fontSize: 8, fontWeight: "bold", textTransform: "uppercase", letterSpacing: 1.5, color: "#888", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingBottom: 5, marginBottom: 10 },
        row:               { flexDirection: "row", marginBottom: 6 },
        statBox:           { flex: 1, padding: 10, backgroundColor: "#f9fafb", borderRadius: 4, marginRight: 8 },
        statLabel:         { fontSize: 7, color: "#999", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
        statValue:         { fontSize: 15, fontWeight: "bold" },
        tableHeader:       { flexDirection: "row", backgroundColor: "#f3f4f6", padding: "6 8", borderRadius: 3, marginBottom: 2 },
        tableRow:          { flexDirection: "row", padding: "5 8", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
        tableCell:         { flex: 1, fontSize: 9, color: "#555" },
        tableCellBold:     { flex: 1, fontSize: 9, fontWeight: "bold", color: "#111" },
        tableCellRight:    { flex: 1, fontSize: 9, textAlign: "right", color: "#555" },
        tableCellRightBold:{ flex: 1, fontSize: 9, textAlign: "right", fontWeight: "bold", color: "#111" },
      });

      const siteName = activeSite?.name ?? "Site";

      const blob = await pdf(
        <Document>
          <Page size="A4" style={s.page}>
            <Text style={s.title}>Inventory Report</Text>
            <Text style={s.subtitle}>
              {siteName} · {dateFrom} → {dateTo} · Generated {format(new Date(), "d MMM yyyy")}
            </Text>

            {/* KPI summary */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Summary</Text>
              <View style={s.row}>
                {[
                  { label: "Total Items",        val: String(totalItems) },
                  { label: "Stock Value",         val: fmtCurrency(stockValue) },
                  { label: "Low / Out of Stock",  val: String(lowOrOutItems.length) },
                  { label: "Consumption Value",   val: fmtCurrency(consumptionValue) },
                ].map((item) => (
                  <View key={item.label} style={s.statBox}>
                    <Text style={s.statLabel}>{item.label}</Text>
                    <Text style={s.statValue}>{item.val}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Top consumed items */}
            {consumptionByItem.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Top Consumed Items</Text>
                <View style={s.tableHeader}>
                  <Text style={s.tableCellBold}>Item</Text>
                  <Text style={s.tableCell}>Category</Text>
                  <Text style={s.tableCellRight}>Qty</Text>
                  <Text style={s.tableCellRightBold}>Value</Text>
                </View>
                {consumptionByItem.slice(0, 15).map((row, i) => (
                  <View key={i} style={s.tableRow}>
                    <Text style={s.tableCell}>{row.itemName}</Text>
                    <Text style={s.tableCell}>{row.category || "—"}</Text>
                    <Text style={s.tableCellRight}>{row.quantityConsumed}</Text>
                    <Text style={s.tableCellRightBold}>{fmtCurrency(row.valueConsumed)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Low stock alerts */}
            {lowStockItems.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Low Stock Alerts</Text>
                <View style={s.tableHeader}>
                  <Text style={s.tableCellBold}>Item</Text>
                  <Text style={s.tableCell}>Category</Text>
                  <Text style={s.tableCellRight}>Qty</Text>
                  <Text style={s.tableCellRight}>Reorder At</Text>
                  <Text style={s.tableCellRight}>Status</Text>
                  <Text style={s.tableCellRight}>Days Left</Text>
                </View>
                {lowStockItems.map(({ item, daysLeft, isOut }) => (
                  <View key={item.id} style={s.tableRow}>
                    <Text style={s.tableCell}>{item.name}</Text>
                    <Text style={s.tableCell}>{item.category || "—"}</Text>
                    <Text style={s.tableCellRight}>{item.quantity}</Text>
                    <Text style={s.tableCellRight}>{item.reorder_level ?? "—"}</Text>
                    <Text style={s.tableCellRight}>{isOut ? "Out of Stock" : "Low Stock"}</Text>
                    <Text style={s.tableCellRight}>{daysLeft != null ? String(daysLeft) : "—"}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Write-offs */}
            {writeOffRows.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Write-offs</Text>
                <View style={s.tableHeader}>
                  <Text style={s.tableCell}>Date</Text>
                  <Text style={s.tableCellBold}>Item</Text>
                  <Text style={s.tableCell}>Category</Text>
                  <Text style={s.tableCellRight}>Qty</Text>
                  <Text style={s.tableCell}>Reason</Text>
                  <Text style={s.tableCellRightBold}>Value</Text>
                </View>
                {writeOffRows.map((row) => (
                  <View key={row.id} style={s.tableRow}>
                    <Text style={s.tableCell}>{row.writtenOffAt}</Text>
                    <Text style={s.tableCell}>{row.itemName}</Text>
                    <Text style={s.tableCell}>{row.category || "—"}</Text>
                    <Text style={s.tableCellRight}>{row.quantity}</Text>
                    <Text style={s.tableCell}>{row.reason}</Text>
                    <Text style={s.tableCellRightBold}>{fmtCurrency(row.value)}</Text>
                  </View>
                ))}
              </View>
            )}
          </Page>
        </Document>
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventory-report-${dateFrom}-${dateTo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingPDF(false);
    }
  }

  // ── No site guard ─────────────────────────────────────────────────────────
  if (!activeSiteId) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select a site to view the inventory report.
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[960px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <Link
          to="/reports"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mb-1"
        >
          <ArrowLeft className="h-3 w-3" /> Reports
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Inventory Report</h1>
            <p className="text-sm text-muted-foreground">Stock levels, consumption, low stock alerts and write-offs</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleExportCSV}
              disabled={isLoading}
            >
              <Download className="h-3 w-3" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleExportPDF}
              disabled={isExportingPDF || isLoading}
            >
              <Download className="h-3 w-3" />
              {isExportingPDF ? "Generating…" : "Export PDF"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Period filter ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const active = dateFrom === p.from && dateTo === p.to;
            return (
              <button
                key={p.label}
                onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                  active
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-end gap-3 shrink-0">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
        </div>
      </div>

      {/* ── Section 1: KPI row ─────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Total Items"
            value={String(totalItems)}
            sub={`${inventoryItems.filter((i) => i.quantity > 0).length} in stock`}
            color="var(--chart-cat-1)"
          />
          <StatCard
            label="Stock Value"
            value={fmtCurrency(stockValue)}
            sub={`${CURRENCY_SYMBOL} unit cost × qty`}
            color="var(--chart-cat-2)"
          />
          <StatCard
            label="Low / Out of Stock"
            value={String(lowOrOutItems.length)}
            sub={
              lowOrOutItems.length === 0
                ? "All items healthy"
                : `${lowOrOutItems.filter((i) => i.quantity <= 0).length} out of stock`
            }
            color={lowOrOutItems.length > 0 ? "var(--chart-expense)" : "var(--chart-income)"}
          />
          <StatCard
            label="Consumption Value"
            value={fmtCurrency(consumptionValue)}
            sub={`${enrichedUsage.length} usage transactions`}
            color="var(--chart-cat-3)"
          />
        </div>
      )}

      {/* ── Section 2: Consumption (tabbed) ───────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <SectionLabel>Consumption</SectionLabel>
        <Tabs defaultValue="by-item">
          <TabsList className="mb-4">
            <TabsTrigger value="by-item">By Item</TabsTrigger>
            <TabsTrigger value="over-time">Over Time</TabsTrigger>
          </TabsList>

          {/* By Item */}
          <TabsContent value="by-item" className="space-y-4">
            {loadingUsage ? (
              <div className="h-48 animate-pulse bg-muted rounded-lg" />
            ) : consumptionByItem.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {/* Horizontal bar chart — top 10 */}
                <ResponsiveContainer width="100%" height={Math.max(160, Math.min(consumptionByItem.length, 10) * 36)}>
                  <BarChart
                    layout="vertical"
                    data={consumptionByItem.slice(0, 10).map((r, i) => ({
                      name: r.itemName,
                      Value: r.valueConsumed,
                      fill: CAT_COLORS[i % CAT_COLORS.length],
                    }))}
                    margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
                    barCategoryGap="22%"
                  >
                    <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => fmtTick(v)}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={120}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltipCustom />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
                    <Bar
                      dataKey="Value"
                      name="Consumption Value"
                      radius={[0, 3, 3, 0]}
                      fill="var(--chart-cat-1)"
                    />
                  </BarChart>
                </ResponsiveContainer>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[480px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-4 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Item</th>
                        <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground hidden sm:table-cell">Category</th>
                        <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground hidden sm:table-cell">Unit</th>
                        <th className="px-3 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Qty Used</th>
                        <th className="px-4 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {consumptionByItem.map((row, i) => (
                        <tr key={i} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium truncate max-w-[180px]">{row.itemName}</td>
                          <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell">{row.category || "—"}</td>
                          <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell">{row.unit || "—"}</td>
                          <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{row.quantityConsumed}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmtCurrency(row.valueConsumed)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/20">
                        <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Total</td>
                        <td className="px-4 py-2.5 text-right text-sm font-bold tabular-nums">{fmtCurrency(consumptionValue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </TabsContent>

          {/* Over Time */}
          <TabsContent value="over-time">
            {loadingUsage ? (
              <div className="h-56 animate-pulse bg-muted rounded-lg" />
            ) : consumptionOverTime.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <AreaChart data={consumptionOverTime} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
                  <defs>
                    <linearGradient id="consumptionGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-cat-1)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--chart-cat-1)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={(v) => fmtTick(v)}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip content={<ChartTooltipCustom />} cursor={{ stroke: "var(--border)" }} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="Consumption"
                    stroke="var(--chart-cat-1)"
                    strokeWidth={2}
                    fill="url(#consumptionGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: "var(--chart-cat-1)", strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Section 3: By Customer ─────────────────────────────────────────── */}
      <div>
        <SectionLabel>By Customer</SectionLabel>
        {loadingUsage ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : consumptionByCustomer.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6">
            <EmptyState />
          </div>
        ) : (
          <div className="space-y-3">
            {consumptionByCustomer.map(({ key, customerName, totalValue, lines }) => (
              <CustomerRow
                key={key}
                customerName={customerName}
                totalValue={totalValue}
                lines={lines}
                isOpen={!!openCustomers[key]}
                onToggle={() =>
                  setOpenCustomers((prev) => ({ ...prev, [key]: !prev[key] }))
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Section 4: Low Stock Alerts ────────────────────────────────────── */}
      <div>
        <SectionLabel>Low Stock Alerts</SectionLabel>
        {loadingItems || loadingRates ? (
          <div className="h-32 animate-pulse rounded-xl bg-muted" />
        ) : lowStockItems.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center gap-2 text-center">
            <Package className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">All items are adequately stocked.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[520px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-5 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Item</th>
                    <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground hidden sm:table-cell">Category</th>
                    <th className="px-3 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Current Qty</th>
                    <th className="px-3 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground hidden md:table-cell">Reorder At</th>
                    <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Status</th>
                    <th className="px-5 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Days Left</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lowStockItems.map(({ item, daysLeft, isOut }) => (
                    <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 font-medium">
                        <span className="flex items-center gap-2">
                          <AlertTriangle
                            className={`h-3.5 w-3.5 shrink-0 ${isOut ? "text-red-500" : "text-amber-500"}`}
                          />
                          {item.name}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell">
                        {item.category || "—"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-semibold">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                        {item.reorder_level ?? "—"}
                      </td>
                      <td className="px-3 py-3">
                        {isOut ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">
                            Out of Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                            Low Stock
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                        {daysLeft != null ? (
                          <span className={daysLeft <= 3 ? "text-red-600 font-semibold" : ""}>
                            {daysLeft}d
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 5: Write-offs ──────────────────────────────────────────── */}
      <div>
        <SectionLabel>Write-offs (Loss Report)</SectionLabel>
        {loadingWriteOffs ? (
          <div className="h-32 animate-pulse rounded-xl bg-muted" />
        ) : writeOffRows.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <EmptyState message="No write-offs recorded for this period." />
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[560px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-5 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Date</th>
                    <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Item</th>
                    <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground hidden sm:table-cell">Category</th>
                    <th className="px-3 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Qty</th>
                    <th className="px-3 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Reason</th>
                    <th className="px-3 py-2.5 text-right font-semibold tracking-wider uppercase text-[10px] text-muted-foreground">Value</th>
                    <th className="px-5 py-2.5 text-left font-semibold tracking-wider uppercase text-[10px] text-muted-foreground hidden md:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {writeOffRows.map((row) => {
                    const reasonStyle = REASON_BADGE[row.reason] ?? {
                      label: row.reason,
                      className: "bg-muted text-muted-foreground border-border",
                    };
                    return (
                      <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
                          {format(parseISO(row.writtenOffAt.slice(0, 10)), "d MMM yyyy")}
                        </td>
                        <td className="px-3 py-3 font-medium truncate max-w-[160px]">{row.itemName}</td>
                        <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell">{row.category || "—"}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{row.quantity}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${reasonStyle.className}`}
                          >
                            {reasonStyle.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-semibold">
                          {fmtCurrency(row.value)}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground truncate max-w-[200px] hidden md:table-cell">
                          {row.notes || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/20">
                    <td colSpan={5} className="px-5 py-2.5 text-xs font-semibold text-muted-foreground">Total write-off value</td>
                    <td className="px-3 py-2.5 text-right text-sm font-bold tabular-nums">
                      {fmtCurrency(writeOffRows.reduce((s, r) => s + r.value, 0))}
                    </td>
                    <td className="hidden md:table-cell" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
