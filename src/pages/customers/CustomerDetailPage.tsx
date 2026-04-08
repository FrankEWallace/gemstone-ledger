import { useState } from "react";
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
  Zap,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
import { Progress } from "@/components/ui/progress";
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

import type { Transaction, TransactionType, ContractSummary } from "@/lib/supabaseTypes";
import { getCustomers } from "@/services/customers.service";
import { getCustomerDetail, getCustomerSummaries } from "@/services/reports.service";
import { getTransactions, createTransaction, type TransactionPayload } from "@/services/transactions.service";
import {
  getContractSummary,
  getCustomerMonthlyTrend,
  generateContractInvoices,
  type InvoiceStrategy,
} from "@/services/contract.service";

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt = fmtCurrency;

function typeIcon(type: TransactionType) {
  if (type === "income")  return <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-500" />;
  if (type === "expense") return <ArrowDownCircle className="h-3.5 w-3.5 text-red-500" />;
  return <RefreshCw className="h-3.5 w-3.5 text-yellow-500" />;
}

// ─── Spark bars ───────────────────────────────────────────────────────────────

function SparkBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-[2px] h-8 opacity-60 shrink-0">
      {values.map((v, i) => (
        <div
          key={i}
          className="w-[5px] rounded-[2px] bg-foreground"
          style={{ height: `${Math.max(12, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
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
          <span className="font-semibold text-foreground">{fmtCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_FROM = format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd");
const DEFAULT_TO   = format(endOfMonth(new Date()), "yyyy-MM-dd");

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    prospect:  "text-violet-600 border-violet-200",
    active:    "text-emerald-600 border-emerald-200",
    inactive:  "text-muted-foreground",
    completed: "text-blue-500 border-blue-100",
  };
  return (
    <Badge variant="outline" className={map[status] ?? "text-muted-foreground capitalize"}>
      {status}
    </Badge>
  );
}

// ─── Contract progress card ───────────────────────────────────────────────────

function ContractProgressCard({
  contract,
  dailyRate,
  onGenerateClick,
}: {
  contract: ContractSummary;
  dailyRate: number;
  onGenerateClick: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" /> Contract Progress
        </p>
        <div className="flex items-center gap-2">
          {contract.isExpiringSoon && !contract.isExpired && (
            <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              Expires in {contract.daysRemaining}d
            </span>
          )}
          {contract.isExpired && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> Expired
            </span>
          )}
          {!contract.isExpired && !contract.isExpiringSoon && contract.daysRemaining > 0 && (
            <span className="text-xs text-muted-foreground">{contract.daysRemaining} days left</span>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={onGenerateClick}>
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            Auto-Invoice
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Contract period used</span>
          <span className="tabular-nums font-medium text-foreground">
            {contract.totalContractDays} total days
          </span>
        </div>
        <Progress value={contract.progressPct} className="h-2" />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{Math.round(contract.progressPct)}% elapsed</span>
          <span>{contract.daysRemaining} remaining</span>
        </div>
      </div>

      {/* Financial grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        {[
          { label: "Contract Value", value: fmt(contract.contractValue), sub: `${contract.totalContractDays} days × ${fmt(dailyRate)}/day`, color: "" },
          { label: "Total Billed",   value: fmt(contract.billedAmount),  sub: `${contract.billedDays} days billed`, color: "" },
          { label: "Collected",      value: fmt(contract.collectedAmount), sub: "paid / success", color: "text-emerald-600" },
          { label: "Unbilled Days",  value: String(contract.unbilledDays), sub: `${fmt(contract.unbilledDays * dailyRate)} outstanding`, color: contract.unbilledDays > 0 ? "text-amber-600" : "text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-muted/40 p-3 space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</p>
            <p className={`text-lg font-bold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Auto-invoice modal ───────────────────────────────────────────────────────

interface AutoInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  siteId: string;
  contract: ContractSummary;
  dailyRate: number;
  contractStart: string;
  contractEnd?: string | null;
}

function AutoInvoiceModal({
  open, onClose, customerId, siteId, contract, dailyRate, contractStart, contractEnd,
}: AutoInvoiceModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const today = format(new Date(), "yyyy-MM-dd");
  const defaultFrom = contractStart;
  const defaultTo   = contractEnd
    ? (contractEnd < today ? contractEnd : today)
    : today;

  const [strategy, setStrategy]   = useState<InvoiceStrategy>("monthly");
  const [txStatus, setTxStatus]   = useState<"pending" | "success">("pending");
  const [dateFrom, setDateFrom]   = useState(defaultFrom);
  const [dateTo,   setDateTo]     = useState(defaultTo);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", siteId],
    queryFn: () => import("@/services/customers.service").then((m) => m.getCustomers(siteId)),
  });
  const customer = customers.find((c) => c.id === customerId);

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      if (!customer) throw new Error("Customer not found");
      return generateContractInvoices(siteId, customer, {
        strategy,
        status: txStatus,
        dateFrom,
        dateTo,
      }, user?.id);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["transactions", siteId] });
      queryClient.invalidateQueries({ queryKey: ["contract-summary", siteId, customerId] });
      if (isDemoMode()) {
        toast.info(`Demo mode — would create ${result.created} invoice${result.created !== 1 ? "s" : ""} totalling ${fmt(result.totalAmount)}`);
      } else {
        toast.success(`Created ${result.created} invoice${result.created !== 1 ? "s" : ""} · ${fmt(result.totalAmount)} total`);
      }
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const strategyLabel: Record<InvoiceStrategy, string> = {
    daily:   "One transaction per day",
    monthly: "One transaction per month",
    full:    "Single transaction for full period",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> Auto-Invoice Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Unbilled notice */}
          {contract.unbilledDays > 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300">
              <strong>{contract.unbilledDays} unbilled days</strong> detected · approx.{" "}
              {fmt(contract.unbilledDays * dailyRate)} outstanding
            </div>
          )}

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>

          {/* Strategy */}
          <div className="space-y-1.5">
            <Label className="text-xs">Invoice Strategy</Label>
            <Select value={strategy} onValueChange={(v) => setStrategy(v as InvoiceStrategy)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily — {strategyLabel.daily}</SelectItem>
                <SelectItem value="monthly">Monthly — {strategyLabel.monthly}</SelectItem>
                <SelectItem value="full">Full period — {strategyLabel.full}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs">Initial Status</Label>
            <Select value={txStatus} onValueChange={(v) => setTxStatus(v as "pending" | "success")}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending (awaiting payment)</SelectItem>
                <SelectItem value="success">Success (already collected)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Rate: <strong>{fmt(dailyRate)}/day</strong> · {strategyLabel[strategy]}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={isPending || !dateFrom || !dateTo}>
            {isPending ? "Generating…" : "Generate Invoices"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
              ? <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
              : <ArrowDownCircle className="h-4 w-4 text-red-500" />}
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
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
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
            className={type === "income" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
            variant={type === "expense" ? "destructive" : "default"}
          >
            {isPending ? "Saving…" : `Add ${type === "income" ? "Income" : "Expense"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { activeSiteId } = useSite();
  const { user } = useAuth();

  const [dateFrom, setDateFrom] = useState(DEFAULT_FROM);
  const [dateTo,   setDateTo]   = useState(DEFAULT_TO);
  const [autoInvoiceOpen, setAutoInvoiceOpen] = useState(false);
  const [addTxType, setAddTxType] = useState<"income" | "expense" | null>(null);

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

  const { data: contractSummary } = useQuery({
    queryKey: ["contract-summary", activeSiteId, id],
    queryFn: () => getContractSummary(activeSiteId!, customer!),
    enabled: !!activeSiteId && !!customer && !!customer.daily_rate && !!customer.contract_start,
  });

  const { data: monthlyTrend = [] } = useQuery({
    queryKey: ["customer-trend", activeSiteId, id, dateFrom, dateTo],
    queryFn: () => getCustomerMonthlyTrend(activeSiteId!, id!, dateFrom, dateTo),
    ...opts,
  });

  const maxCat = Math.max(...(summary?.expensesByCategory ?? []).map((c) => c.total), 1);

  // Derive activity stats from transactions
  const sortedTx = [...transactions].sort(
    (a, b) => a.transaction_date.localeCompare(b.transaction_date)
  );
  const firstActivityDate = sortedTx.length > 0 ? sortedTx[0].transaction_date : null;
  const lastActivityDate  = sortedTx.length > 0 ? sortedTx[sortedTx.length - 1].transaction_date : null;
  const daysWorked = new Set(
    transactions.filter((t) => t.type === "income").map((t) => t.transaction_date)
  ).size;
  const revenuePerDay = daysWorked > 0 ? (summary?.totalIncome ?? 0) / daysWorked : 0;

  const txRows = [...sortedTx].reverse(); // show newest first in table

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
          success:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
          pending:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
          refunded:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
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
          <span className={`tabular-nums font-medium ${isIncome ? "text-emerald-600" : "text-red-500"}`}>
            {fmt(total)}
          </span>
        );
      },
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1200px]">

      {/* Back + Quick actions */}
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
            className="h-8 text-xs gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            onClick={() => setAddTxType("income")}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Income
          </Button>
          <Button
            size="sm" variant="outline"
            className="h-8 text-xs gap-1.5 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
            onClick={() => setAddTxType("expense")}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Customer header */}
      {customer ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center flex-wrap gap-2">
                <h1 className="font-display text-2xl font-bold">{customer.name}</h1>
                <Badge
                  variant="outline"
                  className={customer.type === "external" ? "text-blue-600 border-blue-200" : "text-muted-foreground"}
                >
                  {customer.type}
                </Badge>
                <StatusBadge status={customer.status} />
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {firstActivityDate ? (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Active since {format(new Date(firstActivityDate), "d MMM yyyy")}
                  </span>
                ) : customer.contract_start ? (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Active since {format(new Date(customer.contract_start), "d MMM yyyy")}
                  </span>
                ) : null}
                {lastActivityDate && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Last activity {format(new Date(lastActivityDate), "d MMM yyyy")}
                  </span>
                )}
                {daysWorked > 0 && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {daysWorked} days worked
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {customer.contact_name && <span>{customer.contact_name}</span>}
                {customer.contact_email && (
                  <a href={`mailto:${customer.contact_email}`} className="flex items-center gap-1 hover:text-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {customer.contact_email}
                  </a>
                )}
                {customer.contact_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {customer.contact_phone}
                  </span>
                )}
              </div>
              {customer.notes && (
                <p className="text-xs text-muted-foreground max-w-prose">{customer.notes}</p>
              )}
            </div>
            <div className="text-right shrink-0 space-y-1">
              {customer.daily_rate != null && (
                <p className="text-sm">
                  <span className="text-muted-foreground">Daily rate: </span>
                  <span className="font-semibold tabular-nums">
                    {fmt(Number(customer.daily_rate))}/day
                  </span>
                </p>
              )}
              {(customer.contract_start || customer.contract_end) && (
                <p className="text-xs text-muted-foreground">
                  {customer.contract_start ? format(new Date(customer.contract_start), "d MMM yyyy") : "—"}
                  {" → "}
                  {customer.contract_end ? format(new Date(customer.contract_end), "d MMM yyyy") : "ongoing"}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="h-24 animate-pulse bg-muted rounded-xl" />
      )}

      {/* Contract progress card — fixed-term clients only */}
      {contractSummary && customer?.daily_rate && customer.contract_end && (
        <ContractProgressCard
          contract={contractSummary}
          dailyRate={Number(customer.daily_rate)}
          onGenerateClick={() => setAutoInvoiceOpen(true)}
        />
      )}

      {/* Date range */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-38 h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-38 h-8 text-xs" />
        </div>
      </div>

      {/* Summary KPI cards */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-28 animate-pulse bg-muted rounded-xl" />)}
        </div>
      ) : summary ? (() => {
        const incomeSpark  = monthlyTrend.map((t) => t.income);
        const expenseSpark = monthlyTrend.map((t) => t.expenses);
        const netSpark     = monthlyTrend.map((t) => Math.max(0, t.income - t.expenses));
        const kpis = [
          {
            label: "Total Income",
            value: fmt(summary.totalIncome),
            sub: `${summary.transactionCount} transactions`,
            color: "text-emerald-600",
            spark: incomeSpark,
          },
          {
            label: "Total Expenses",
            value: fmt(summary.totalExpenses),
            sub: summary.expensesByCategory.length > 0
              ? `${summary.expensesByCategory[0].category} is largest`
              : "No expenses",
            color: "text-red-500",
            spark: expenseSpark,
          },
          {
            label: "Net Profit",
            value: fmt(summary.netProfit),
            sub: summary.totalIncome > 0
              ? `${Math.round((summary.netProfit / summary.totalIncome) * 100)}% margin`
              : "",
            color: summary.netProfit >= 0 ? "text-emerald-600" : "text-red-500",
            spark: netSpark,
          },
          {
            label: "Revenue / Day",
            value: daysWorked > 0 ? fmt(revenuePerDay) : "—",
            sub: daysWorked > 0 ? "avg per working day" : "no income days yet",
            color: "text-foreground",
            spark: null,
          },
          {
            label: "Days Worked",
            value: daysWorked > 0 ? String(daysWorked) : "—",
            sub: daysWorked > 0 ? "days with income" : "no income recorded",
            color: "text-foreground",
            spark: null,
          },
        ];
        return (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {kpis.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3 hover:border-foreground/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground">
                    {s.label}
                  </p>
                  {s.spark && s.spark.some((v) => v > 0) && <SparkBars values={s.spark} />}
                </div>
                <p className={`text-[28px] font-bold tracking-tight leading-none font-display ${s.color}`}>
                  {s.value}
                </p>
                {s.sub && (
                  <p className="text-[11px] text-muted-foreground">{s.sub}</p>
                )}
              </div>
            ))}
          </div>
        );
      })() : null}

      {/* Monthly trend chart */}
      {monthlyTrend.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground mb-4">
            Monthly Income vs Expenses
          </p>
          <ResponsiveContainer width="100%" height={210}>
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
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
              <Bar dataKey="income"   fill="hsl(var(--foreground))"          radius={[3, 3, 0, 0]} name="Income" />
              <Bar dataKey="expenses" fill="hsl(var(--muted-foreground))" opacity={0.35} radius={[3, 3, 0, 0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-foreground" /> Income
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-muted-foreground opacity-60" /> Expenses
            </span>
          </div>
        </div>
      )}

      {/* Expense breakdown + transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Category breakdown */}
        {summary && summary.expensesByCategory.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-muted-foreground mb-4">
              Expenses by Category
            </p>
            <div className="space-y-3">
              {summary.expensesByCategory.map((c) => {
                const pct = Math.round((c.total / maxCat) * 100);
                const sharePct = summary.totalExpenses > 0
                  ? ((c.total / summary.totalExpenses) * 100).toFixed(0)
                  : "0";
                return (
                  <div key={c.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate mr-2">{c.category}</span>
                      <span className="tabular-nums font-semibold shrink-0">
                        {fmt(c.total)}
                        <span className="text-muted-foreground font-normal ml-1">{sharePct}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-foreground/70 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Transactions table */}
        <div className={`${summary && summary.expensesByCategory.length > 0 ? "lg:col-span-2" : "lg:col-span-3"}`}>
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
        </div>
      </div>

      {/* Quick-add income / expense modal */}
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

      {/* Auto-invoice modal */}
      {autoInvoiceOpen && customer && contractSummary && (
        <AutoInvoiceModal
          open={autoInvoiceOpen}
          onClose={() => setAutoInvoiceOpen(false)}
          customerId={customer.id}
          siteId={activeSiteId!}
          contract={contractSummary}
          dailyRate={Number(customer.daily_rate)}
          contractStart={customer.contract_start!}
          contractEnd={customer.contract_end}
        />
      )}
    </div>
  );
}
