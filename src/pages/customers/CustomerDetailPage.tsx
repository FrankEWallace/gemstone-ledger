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
import StatCard from "@/components/shared/StatCard";
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
import { CHART_H } from "@/lib/chartHeights";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import SharedStatusBadge from "@/components/shared/StatusBadge";
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
import * as SelectPrimitive from "@radix-ui/react-select";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";

import type { Transaction, TransactionType, TransactionStatus } from "@/lib/supabaseTypes";
import { getCustomers } from "@/services/customers.service";
import { getCustomerDetail } from "@/services/reports.service";
import { getTransactions, getTransactionCategories, createTransaction, updateTransactionStatus, type TransactionPayload } from "@/services/transactions.service";
import { getCustomerMonthlyTrend } from "@/services/contract.service";
import { UseInventoryModal } from "@/pages/transactions/TransactionActions";
import TransactionEditSheet from "@/pages/transactions/TransactionEditSheet";

// ─── Constants ────────────────────────────────────────────────────────────────

const PIE_COLORS = [
  "var(--chart-4)",  "var(--chart-3)",  "var(--chart-6)",  "var(--chart-7)",
  "var(--chart-8)",  "var(--chart-5)",  "var(--chart-10)", "var(--chart-9)",
];

const C = {
  income:  "var(--chart-income)",
  expense: "var(--chart-expense)",
  net:     "var(--chart-net)",
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
  return <SharedStatusBadge status={status} className="capitalize" />;
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
              <Label className="text-xs">Amount *</Label>
              <MoneyInput
                placeholder="0"
                value={amount}
                onValueChange={setAmount}
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
    <div className="h-chart-md flex items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

// ─── Inline status editor ─────────────────────────────────────────────────────
// Mirrors the Transactions page: click the status badge to flip
// pending → success/refunded straight from the row, no edit sheet needed.

const TX_STATUSES: TransactionStatus[] = ["success", "pending", "refunded", "cancelled"];

function StatusSelect({ tx, onChanged }: { tx: Transaction; onChanged?: () => void }) {
  const queryClient = useQueryClient();
  const { activeSiteId } = useSite();

  const { mutate } = useMutation<
    void,
    Error,
    TransactionStatus,
    { snapshots: { key: readonly unknown[]; data: unknown }[] }
  >({
    mutationFn: async (status) => {
      if (isDemoMode()) return;
      await updateTransactionStatus(tx.id, status);
    },
    onMutate: async (newStatus: TransactionStatus) => {
      await queryClient.cancelQueries({ queryKey: ["transactions", activeSiteId] });
      const keys = queryClient.getQueryCache().findAll({ queryKey: ["transactions", activeSiteId] });
      const snapshots = keys.map((q) => ({ key: q.queryKey, data: q.state.data }));
      keys.forEach((q) => {
        queryClient.setQueryData<Transaction[]>(q.queryKey, (old) =>
          old?.map((t) => (t.id === tx.id ? { ...t, status: newStatus } : t)) ?? []
        );
      });
      return { snapshots };
    },
    onError: (err: Error, _s, context) => {
      context?.snapshots.forEach(({ key, data }) => queryClient.setQueryData(key, data));
      toast.error(err.message);
    },
    onSuccess: () => {
      if (!isDemoMode()) {
        queryClient.invalidateQueries({ queryKey: ["transactions", activeSiteId] });
        onChanged?.();
      }
      toast.success("Status updated.");
    },
  });

  return (
    <Select value={tx.status} onValueChange={(v) => mutate(v as TransactionStatus)}>
      {/* Bare trigger: reads like a plain badge (no chevron/border), still opens inline */}
      <SelectPrimitive.Trigger
        aria-label="Change status"
        className="inline-flex items-center rounded-md p-0.5 -m-0.5 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring [&>svg]:hidden"
      >
        <SelectValue>
          <SharedStatusBadge status={tx.status} className="capitalize" />
        </SelectValue>
      </SelectPrimitive.Trigger>
      <SelectContent>
        {TX_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            <SharedStatusBadge status={s} className="capitalize" />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { activeSiteId } = useSite();
  const { user, activeRole } = useAuth();
  const queryClient = useQueryClient();

  const canEdit = activeRole === "admin";

  const [dateFrom, setDateFrom] = useState(DEFAULT_FROM);
  const [dateTo,   setDateTo]   = useState(DEFAULT_TO);
  const [addTxType, setAddTxType] = useState<"income" | "expense" | null>(null);
  const [useInventoryOpen, setUseInventoryOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);

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

  const { data: categories = [] } = useQuery({
    queryKey: ["tx-categories", activeSiteId],
    queryFn: () => getTransactionCategories(activeSiteId!),
    enabled: canEdit && !!activeSiteId,
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
      render: (val, row) =>
        canEdit ? (
          <div onClick={(e) => e.stopPropagation()}>
            <StatusSelect
              tx={row as unknown as Transaction}
              onChanged={() => {
                queryClient.invalidateQueries({ queryKey: ["customer-detail", activeSiteId] });
                queryClient.invalidateQueries({ queryKey: ["customer-trend", activeSiteId] });
                queryClient.invalidateQueries({ queryKey: ["customerSummaries", activeSiteId] });
              }}
            />
          </div>
        ) : (
          <SharedStatusBadge status={String(val)} className="capitalize" />
        ),
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
            style={{ color: C.income, borderColor: "oklch(from var(--chart-income) l c h / 0.4)" }}
            onClick={() => setAddTxType("income")}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Income
          </Button>
          <Button
            size="sm" variant="outline"
            className="h-8 text-xs gap-1.5"
            style={{ color: C.expense, borderColor: "oklch(from var(--chart-expense) l c h / 0.4)" }}
            onClick={() => setAddTxType("expense")}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Expense
          </Button>
          <Button
            size="sm" variant="outline"
            className="h-8 text-xs gap-1.5 text-info border-info/20"
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
              customer.status === "active"    ? "bg-success/10 text-success" :
              customer.status === "prospect"  ? "bg-info/10 text-info"       :
              customer.status === "completed" ? "bg-info/10 text-info"       :
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
                  className={customer.type === "external" ? "text-info border-info/20" : "text-muted-foreground"}
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
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
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
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground self-center mr-2">
          Period
        </p>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-38 h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-38 h-8 text-xs" />
        </div>
      </div>

      {/* ── KPI strip ── */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 animate-pulse bg-muted rounded-xl" />)}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total Income"
            value={fmt(summary.totalIncome)}
            sub={`${summary.transactionCount} transactions`}
            color={C.income}
          />
          <StatCard
            label="Total Expenses"
            value={fmt(summary.totalExpenses)}
            sub={expenseByCategory.length > 0 ? `${expenseByCategory[0].category} is largest` : "No expenses"}
            color={C.expense}
          />
          <StatCard
            label="Net Profit"
            value={fmt(summary.netProfit)}
            sub={summary.totalIncome > 0 ? `${Math.round((summary.netProfit / summary.totalIncome) * 100)}% margin` : undefined}
            color={summary.netProfit >= 0 ? C.income : C.expense}
          />
          <StatCard
            label="Days Worked"
            value={daysWorked > 0 ? String(daysWorked) : "—"}
            sub={daysWorked > 0 ? "days with income" : "no income recorded"}
          />
        </div>
      ) : null}

      {/* ── Breakdown charts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Expense breakdown */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
              Expense Breakdown
            </p>
            <Link
              to={`/customers/${id}/expenses`}
              className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View detail <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {expenseByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={CHART_H.md}>
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
                  wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty message="No expense data for this period" />
          )}
        </div>

        {/* Income breakdown */}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-4">
            Income Breakdown
          </p>
          {incomeByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={CHART_H.md}>
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
                  wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : monthlyTrend.length > 1 ? (
            /* Fall back to monthly trend if income has no categories */
            <ResponsiveContainer width="100%" height={CHART_H.md}>
              <BarChart data={monthlyTrend} barGap={3} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => format(parseISO(v + "-01"), "MMM yy")}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => fmtTick(v)}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                />
                <Tooltip content={<BarTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
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
      {canEdit && txRows.length > 0 && (
        <p className="text-xs text-muted-foreground -mb-2">
          Tap a row to edit, or tap its status to change it directly.
        </p>
      )}
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
        onRowClick={canEdit ? (row) => setEditTarget(row as unknown as Transaction) : undefined}
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
      {canEdit && (
        <TransactionEditSheet
          transaction={editTarget}
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          customers={customers}
          categories={categories}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["customer-detail", activeSiteId] });
            queryClient.invalidateQueries({ queryKey: ["customer-trend", activeSiteId] });
            queryClient.invalidateQueries({ queryKey: ["customerSummaries", activeSiteId] });
          }}
        />
      )}
    </div>
  );
}
