import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  format,
  startOfMonth,
  endOfMonth,
  subMonths,
  parseISO,
} from "date-fns";
import {
  ArrowLeft,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Mail,
  Phone,
  CalendarDays,
  CheckCircle2,
  Clock,
  Plus,
  ChevronRight,
  Package,
} from "lucide-react";
import { TrendArrow } from "@/components/shared/TrendArrow";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";

import { useSite } from "@/hooks/useSite";
import { useAuth } from "@/hooks/useAuth";
import { isDemoMode } from "@/lib/demo";
import { fmtCurrency, fmtTick } from "@/lib/formatCurrency";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";

import type { Transaction, TransactionType } from "@/lib/supabaseTypes";
import { getCustomers } from "@/services/customers.service";
import { getCustomerDetail } from "@/services/reports.service";
import { getTransactions, createTransaction, type TransactionPayload } from "@/services/transactions.service";
import { getCustomerMonthlyTrend } from "@/services/contract.service";
import { UseInventoryModal } from "@/pages/transactions/TransactionActions";

// ─── Constants ────────────────────────────────────────────────────────────────

// Palette-aligned (matches chart-cat-1..5 tokens + extras)
const PIE_COLORS = [
  "#3b82f6", "#7c3aed", "#0d9488", "#f59e0b",
  "#ea580c", "#6366f1", "#0ea5e9", "#a855f7",
];

const C = {
  income:  "hsl(var(--chart-income))",
  expense: "hsl(var(--chart-expense))",
  net:     "hsl(var(--chart-net))",
} as const;

const DEFAULT_FROM = format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd");
const DEFAULT_TO   = format(endOfMonth(new Date()), "yyyy-MM-dd");

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt = fmtCurrency;

function typeIcon(type: TransactionType) {
  if (type === "income")  return <ArrowUpCircle className="h-3.5 w-3.5" style={{ color: C.income }} />;
  if (type === "expense") return <ArrowDownCircle className="h-3.5 w-3.5" style={{ color: C.expense }} />;
  return <RefreshCw className="h-3.5 w-3.5" style={{ color: C.net }} />;
}

// ─── Spark bars ───────────────────────────────────────────────────────────────

function SparkBars({ values, color }: { values: number[]; color?: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-[2px] h-7 opacity-60 shrink-0">
      {values.map((v, i) => (
        <div
          key={i}
          className="w-[4px] rounded-[2px]"
          style={{ height: `${Math.max(12, (v / max) * 100)}%`, backgroundColor: color ?? "hsl(var(--foreground))" }}
        />
      ))}
    </div>
  );
}

// ─── Tooltips ─────────────────────────────────────────────────────────────────

function PieTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-0.5">{payload[0].name}</p>
      <p className="tabular-nums text-muted-foreground">{fmt(payload[0].value)}</p>
    </div>
  );
}

function BarTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold mb-1">
        {label ? format(parseISO(String(label) + "-01"), "MMMM yyyy") : ""}
      </p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.fill }} />
          {p.name}:{" "}
          <span className="font-semibold text-foreground">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    prospect:  "text-violet-600 border-violet-200",
    active:    "text-blue-600 border-blue-200",
    inactive:  "text-muted-foreground",
    completed: "text-blue-500 border-blue-100",
  };
  return (
    <Badge variant="outline" className={`${map[status] ?? "text-muted-foreground"} capitalize`}>
      {status}
    </Badge>
  );
}

// ─── Quick Add Transaction Modal ─────────────────────────────────────────────

interface QuickAddTxModalProps {
  open: boolean;
  onClose: () => void;
  type: "income" | "expense";
  customerId: string;
  siteId: string;
  userId?: string;
}

function QuickAddTxModal({ open, onClose, type, customerId, siteId, userId }: QuickAddTxModalProps) {
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [description, setDescription] = useState("");
  const [amount,      setAmount]      = useState("");
  const [date,        setDate]        = useState(today);
  const [category,    setCategory]    = useState("");
  const [status,      setStatus]      = useState<"pending" | "success">("pending");

  function reset() {
    setDescription(""); setAmount(""); setDate(today); setCategory(""); setStatus("pending");
  }

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      if (isDemoMode()) {
        toast.info("Demo mode — changes are not persisted.");
        return Promise.resolve({} as any);
      }
      const payload: TransactionPayload = {
        description: description || undefined,
        category:    category    || undefined,
        customer_id: customerId,
        type,
        status,
        quantity:         1,
        unit_price:       Number(amount),
        transaction_date: date,
      };
      return createTransaction(siteId, payload, userId);
    },
    onSuccess: () => {
      if (!isDemoMode()) {
        queryClient.invalidateQueries({ queryKey: ["transactions", siteId] });
        queryClient.invalidateQueries({ queryKey: ["customer-detail", siteId] });
        queryClient.invalidateQueries({ queryKey: ["customerSummaries", siteId] });
        toast.success(`${type === "income" ? "Income" : "Expense"} recorded.`);
      }
      reset(); onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === "income"
              ? <ArrowUpCircle className="h-4 w-4" style={{ color: C.income }} />
              : <ArrowDownCircle className="h-4 w-4" style={{ color: C.expense }} />}
            Add {type === "income" ? "Income" : "Expense"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input
              placeholder={type === "income" ? "e.g. Invoice payment" : "e.g. Equipment hire"}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Amount ($) *</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date *</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <Input
              placeholder="e.g. Fuel, Labour, Rent…"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "pending" | "success")}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="success">Success (collected)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutate()}
            disabled={isPending || !amount || Number(amount) <= 0 || !date}
            style={type === "income" ? { backgroundColor: C.income, color: "#fff" } : type === "expense" ? { backgroundColor: C.expense, color: "#fff" } : {}}
          >
            {isPending ? "Saving…" : `Add ${type === "income" ? "Income" : "Expense"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Empty chart state ────────────────────────────────────────────────────────

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { activeSiteId } = useSite();
  const { user } = useAuth();

  const [dateFrom, setDateFrom] = useState(DEFAULT_FROM);
  const [dateTo,   setDateTo]   = useState(DEFAULT_TO);
  const [addTxType, setAddTxType] = useState<"income" | "expense" | null>(null);
  const [useInventoryOpen, setUseInventoryOpen] = useState(false);

  const opts = { enabled: !!activeSiteId && !!id };

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", activeSiteId],
    queryFn: () => getCustomers(activeSiteId!),
    ...opts,
  });

  const customer = customers.find((c) => c.id === id);

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["customer-detail", activeSiteId, id, dateFrom, dateTo],
    queryFn: () => getCustomerDetail(activeSiteId!, id!, dateFrom, dateTo),
    ...opts,
  });

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ["transactions", activeSiteId, "all", "all", "all", id],
    queryFn: () => getTransactions(activeSiteId!, { customerId: id, dateFrom, dateTo }),
    ...opts,
  });

  const { data: monthlyTrend = [] } = useQuery({
    queryKey: ["customer-trend", activeSiteId, id, dateFrom, dateTo],
    queryFn: () => getCustomerMonthlyTrend(activeSiteId!, id!, dateFrom, dateTo),
    ...opts,
  });

  // ── Derived data ────────────────────────────────────────────────────────────

  const sortedTx = useMemo(
    () => [...transactions].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date)),
    [transactions],
  );

  const firstActivityDate = sortedTx.length > 0 ? sortedTx[0].transaction_date : null;
  const lastActivityDate  = sortedTx.length > 0 ? sortedTx[sortedTx.length - 1].transaction_date : null;

  const daysWorked = useMemo(
    () => new Set(transactions.filter((t) => t.type === "income").map((t) => t.transaction_date)).size,
    [transactions],
  );

  const revenuePerDay = daysWorked > 0 ? (summary?.totalIncome ?? 0) / daysWorked : 0;

  // Income breakdown by category (computed client-side)
  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter((t) => t.type === "income")
      .forEach((t) => {
        const cat = t.category || "General";
        map[cat] = (map[cat] || 0) + (t.quantity as number) * (t.unit_price as number);
      });
    return Object.entries(map)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  const expenseByCategory = summary?.expensesByCategory ?? [];

  const txRows = [...sortedTx].reverse();

  // ── Table columns ───────────────────────────────────────────────────────────

  const columns: DataTableColumn<(typeof txRows)[number]>[] = [
    {
      key: "transaction_date",
      header: "Date",
      sortable: true,
      render: (val) => format(new Date(String(val)), "d MMM yyyy"),
    },
    {
      key: "reference_no",
      header: "Ref #",
      render: (val) => <span className="font-mono text-xs">{String(val || "—")}</span>,
    },
    {
      key: "description",
      header: "Description",
      sortable: true,
      render: (_, row) => (
        <div>
          <p className="font-medium">{row.description || "—"}</p>
          {row.category && (
            <p className="text-xs text-muted-foreground">{row.category}</p>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      render: (val) => (
        <div className="flex items-center gap-1.5 capitalize">
          {typeIcon(val as TransactionType)}
          {String(val)}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (val) => {
        const map: Record<string, string> = {
          success:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
          pending:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
          refunded:  "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
          cancelled: "bg-muted text-muted-foreground",
        };
        const s = String(val);
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[s] ?? ""}`}>
            {s}
          </span>
        );
      },
    },
    {
      key: "unit_price",
      header: "Amount",
      sortable: true,
      className: "text-right",
      render: (_, row) => {
        const total = (row.quantity as number) * (row.unit_price as number);
        const isIncome = row.type === "income";
        return (
          <span className="tabular-nums font-medium" style={{ color: isIncome ? C.income : C.expense }}>
            {fmt(total)}
          </span>
        );
      },
    },
  ];

  // ── KPI data ────────────────────────────────────────────────────────────────

  const incomeSpark  = monthlyTrend.map((t) => t.income);
  const expenseSpark = monthlyTrend.map((t) => t.expenses);
  const netSpark     = monthlyTrend.map((t) => Math.max(0, t.income - t.expenses));

  const kpis = summary
    ? [
        {
          label: "Total Income",
          value: fmt(summary.totalIncome),
          sub: `${summary.transactionCount} transactions`,
          color: C.income,
          spark: incomeSpark,
          sparkColor: C.income,
        },
        {
          label: "Total Expenses",
          value: fmt(summary.totalExpenses),
          sub: expenseByCategory.length > 0 ? `${expenseByCategory[0].category} is largest` : "No expenses",
          color: C.expense,
          spark: expenseSpark,
          sparkColor: C.expense,
        },
        {
          label: "Net Profit",
          value: fmt(summary.netProfit),
          sub: summary.totalIncome > 0
            ? `${Math.round((summary.netProfit / summary.totalIncome) * 100)}% margin`
            : "",
          color: summary.netProfit >= 0 ? C.income : C.expense,
          spark: netSpark,
          sparkColor: C.net,
        },
        {
          label: "Revenue / Day",
          value: daysWorked > 0 ? fmt(revenuePerDay) : "—",
          sub: daysWorked > 0 ? "avg per working day" : "no income days yet",
          color: undefined as string | undefined,
          spark: null,
          sparkColor: undefined as string | undefined,
        },
        {
          label: "Days Worked",
          value: daysWorked > 0 ? String(daysWorked) : "—",
          sub: daysWorked > 0 ? "days with income" : "no income recorded",
          color: undefined as string | undefined,
          spark: null,
          sparkColor: undefined as string | undefined,
        },
      ]
    : [];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1100px] mx-auto">

      {/* Nav + Quick actions */}
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/customers"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Customers
        </Link>
        <div className="flex items-center gap-2">
          <Button
            size="sm" variant="outline"
            className="h-8 text-xs gap-1.5"
            style={{ color: C.income, borderColor: "hsl(var(--chart-income) / 0.4)" }}
            onClick={() => setAddTxType("income")}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Income
          </Button>
          <Button
            size="sm" variant="outline"
            className="h-8 text-xs gap-1.5"
            style={{ color: C.expense, borderColor: "hsl(var(--chart-expense) / 0.4)" }}
            onClick={() => setAddTxType("expense")}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Expense
          </Button>
          <Button
            size="sm" variant="outline"
            className="h-8 text-xs gap-1.5 text-blue-600 border-blue-200"
            onClick={() => setUseInventoryOpen(true)}
          >
            <Package className="h-3.5 w-3.5" />
            Use Inventory
          </Button>
        </div>
      </div>

      {/* ── Profile header ── */}
      {customer ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
              customer.status === "active"    ? "bg-blue-100 text-blue-700"      :
              customer.status === "prospect"  ? "bg-violet-100 text-violet-700"  :
              customer.status === "completed" ? "bg-blue-100 text-blue-700"      :
              "bg-muted text-muted-foreground"
            }`}>
              <span className="text-base font-bold uppercase">
                {customer.name.slice(0, 2)}
              </span>
            </div>

            {/* Identity + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="font-display text-xl font-bold tracking-tight leading-tight">{customer.name}</h1>
                <Badge
                  variant="outline"
                  className={customer.type === "external" ? "text-blue-600 border-blue-200" : "text-muted-foreground"}
                >
                  {customer.type}
                </Badge>
                <StatusBadge status={customer.status} />
              </div>

              {/* Contact row */}
              {(customer.contact_name || customer.contact_email || customer.contact_phone) && (
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground mb-2">
                  {customer.contact_name && (
                    <span className="font-medium text-foreground">{customer.contact_name}</span>
                  )}
                  {customer.contact_email && (
                    <a href={`mailto:${customer.contact_email}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      <Mail className="h-3 w-3" />
                      {customer.contact_email}
                    </a>
                  )}
                  {customer.contact_phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {customer.contact_phone}
                    </span>
                  )}
                </div>
              )}

              {/* Activity meta */}
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                {firstActivityDate ? (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    Active since {format(new Date(firstActivityDate), "d MMM yyyy")}
                  </span>
                ) : customer.contract_start ? (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    Since {format(new Date(customer.contract_start), "d MMM yyyy")}
                  </span>
                ) : null}
                {lastActivityDate && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last activity {format(new Date(lastActivityDate), "d MMM yyyy")}
                  </span>
                )}
                {daysWorked > 0 && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" style={{ color: C.income }} />
                    {daysWorked} days worked
                  </span>
                )}
              </div>

              {customer.notes && (
                <p className="text-xs text-muted-foreground mt-2 max-w-prose border-t border-border pt-2">
                  {customer.notes}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="h-28 animate-pulse bg-muted rounded-xl" />
      )}

      {/* ── Date range filter ── */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground self-center mr-2">
          Period
        </p>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-38 h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-38 h-8 text-xs" />
        </div>
      </div>

      {/* ── KPI strip ── */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-28 animate-pulse bg-muted rounded-xl" />)}
        </div>
      ) : kpis.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {kpis.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2.5 overflow-hidden relative">
              {s.color && <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl" style={{ backgroundColor: s.color }} />}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground leading-tight">
                  {s.label}
                </p>
                {s.spark && s.spark.some((v) => v > 0)
                  ? <SparkBars values={s.spark} color={s.sparkColor} />
                  : null}
              </div>
              <p className="text-2xl font-bold tracking-tight leading-none font-display tabular-nums" style={s.color ? { color: s.color } : undefined}>
                {s.value}
              </p>
              {s.sub && (
                <p className="text-[11px] text-muted-foreground">{s.sub}</p>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Breakdown charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Expense breakdown */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
              Expense Breakdown
            </p>
            <Link
              to={`/customers/${id}/expenses`}
              className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              View detail <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {expenseByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={expenseByCategory}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  innerRadius={42}
                  paddingAngle={2}
                >
                  {expenseByCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty message="No expense data for this period" />
          )}
        </div>

        {/* Income breakdown */}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground mb-4">
            Income Breakdown
          </p>
          {incomeByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={incomeByCategory}
                  dataKey="total"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  innerRadius={42}
                  paddingAngle={2}
                >
                  {incomeByCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : monthlyTrend.length > 1 ? (
            /* Fall back to monthly trend if income has no categories */
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyTrend} barGap={3} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => format(parseISO(v + "-01"), "MMM yy")}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickFormatter={(v) => fmtTick(v)}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                />
                <Tooltip content={<BarTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
                <Bar dataKey="income" fill={C.income} radius={[3, 3, 0, 0]} name="Income" />
                <Bar dataKey="expenses" fill={C.expense} opacity={0.85} radius={[3, 3, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty message="No income data for this period" />
          )}
        </div>
      </div>

      {/* ── Transaction table ── */}
      <DataTable
        data={txRows as unknown as Record<string, unknown>[]}
        columns={columns as DataTableColumn<Record<string, unknown>>[]}
        keyField="id"
        searchable
        searchKeys={["description", "reference_no", "category"]}
        searchPlaceholder="Search transactions…"
        pageSize={15}
        isLoading={loadingTx}
        emptyMessage="No transactions in this date range."
      />

      {/* ── Modals ── */}
      {addTxType && id && (
        <QuickAddTxModal
          open={!!addTxType}
          onClose={() => setAddTxType(null)}
          type={addTxType}
          customerId={id}
          siteId={activeSiteId!}
          userId={user?.id}
        />
      )}
      {useInventoryOpen && (
        <UseInventoryModal
          open={useInventoryOpen}
          onClose={() => setUseInventoryOpen(false)}
          siteId={activeSiteId!}
          userId={user?.id}
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          defaultCustomerId={id}
        />
      )}
    </div>
  );
}
