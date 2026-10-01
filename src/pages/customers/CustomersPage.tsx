import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Receipt, Search, MoreHorizontal, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import EntityAvatar from "@/components/shared/EntityAvatar";
import KpiCell from "@/components/shared/KpiCell";
import {
  format, differenceInCalendarDays, differenceInDays, parseISO,
  startOfMonth, endOfMonth,
} from "date-fns";

import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";
import { isDemoMode } from "@/lib/demo";
import { invalidateCustomerCaches } from "@/lib/customerCache";
import { fmtCurrency, fmtCompact, CURRENCY_SYMBOL } from "@/lib/formatCurrency";
import { Button } from "@/components/ui/button";
import SharedStatusBadge from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type { Customer } from "@/lib/supabaseTypes";
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  type CustomerPayload,
} from "@/services/customers.service";
import { createTransaction } from "@/services/transactions.service";
import { getCustomerSummaries } from "@/services/reports.service";

// ─── Chart colors (matches Dashboard palette) ─────────────────────────────────

const C = {
  income:  "var(--chart-income)",
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Customer["status"] }) {
  return <SharedStatusBadge status={status} className="text-xs" />;
}

type StatusFilter = "all" | Customer["status"];
type TypeFilter   = "all" | Customer["type"];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all",       label: "All" },
  { value: "active",    label: "Active" },
  { value: "prospect",  label: "Prospect" },
  { value: "inactive",  label: "Inactive" },
  { value: "completed", label: "Completed" },
];

const TYPE_FILTERS: { value: Exclude<TypeFilter, "all">; label: string }[] = [
  { value: "external", label: "External" },
  { value: "internal", label: "Internal" },
];

function FilterPill({ active, count, onClick, children }: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-7 rounded-full border px-3 text-xs font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      <span className={cn("ml-1.5 tabular-nums", active ? "opacity-60" : "text-muted-foreground/70")}>{count}</span>
    </button>
  );
}

// ─── Rent Charge Modal ────────────────────────────────────────────────────────

interface RentChargeModalProps {
  open: boolean;
  onClose: () => void;
  customer: Customer;
  siteId: string;
  userId?: string;
}

function RentChargeModal({ open, onClose, customer, siteId, userId }: RentChargeModalProps) {
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo,   setDateTo]   = useState(today);

  const dailyRate = Number(customer.daily_rate ?? 0);
  const days = Math.max(1, differenceInCalendarDays(parseISO(dateTo), parseISO(dateFrom)) + 1);
  const total = days * dailyRate;

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      if (isDemoMode()) {
        toast.info("Demo mode — changes are not persisted.");
        return Promise.resolve({} as any);
      }
      return createTransaction(siteId, {
        description: `Daily rent — ${customer.name}`,
        type: "income",
        status: "pending",
        quantity: days,
        unit_price: dailyRate,
        transaction_date: dateTo,
        customer_id: customer.id,
      }, userId);
    },
    onSuccess: () => {
      if (!isDemoMode()) {
        queryClient.invalidateQueries({ queryKey: ["transactions", siteId] });
        toast.success(`Rent invoice created: ${days} day${days !== 1 ? "s" : ""} × ${CURRENCY_SYMBOL} ${dailyRate.toLocaleString()}`);
      }
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Charge Daily Rent</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg bg-muted/40 p-3 space-y-0.5">
            <p className="text-sm font-semibold">{customer.name}</p>
            <p className="text-xs text-muted-foreground">
              Daily rate: <span className="font-medium tabular-nums">{fmtCurrency(dailyRate, 2)}</span>
            </p>
          </div>

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

          <div className="rounded-lg border border-border p-3 space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Days</span>
              <span className="tabular-nums font-medium text-foreground">{days}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Rate / day</span>
              <span className="tabular-nums font-medium text-foreground">{fmtCurrency(dailyRate, 2)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1">
              <span>Total</span>
              <span className="tabular-nums" style={{ color: C.income }}>{fmtCurrency(total, 2)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={isPending || dailyRate <= 0}>
            {isPending ? "Creating…" : "Create Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Close Activity Modal ─────────────────────────────────────────────────────

const TODAY = format(new Date(), "yyyy-MM-dd");

function CloseActivityModal({ open, onClose, customer, siteId }: {
  open: boolean;
  onClose: () => void;
  customer: Customer;
  siteId: string;
}) {
  const queryClient = useQueryClient();
  const [endDate, setEndDate] = useState(TODAY);

  // Lifetime totals for this customer, fetched only while the modal is open.
  const { data: summaries = [] } = useQuery({
    queryKey: ["customer-lifetime-summary", siteId, customer.id],
    queryFn: () => getCustomerSummaries(siteId, "2000-01-01", TODAY),
    enabled: open,
  });
  const summary = summaries.find((s) => s.customerId === customer.id);
  const totalIncome = summary?.totalIncome ?? 0;
  const totalExpenses = summary?.totalExpenses ?? 0;
  const net = totalIncome - totalExpenses;

  const daysActive =
    customer.contract_start && endDate
      ? differenceInDays(new Date(endDate), parseISO(customer.contract_start))
      : null;

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      if (isDemoMode()) {
        toast.info("Demo mode — changes are not persisted.");
        return Promise.resolve({} as Customer);
      }
      return updateCustomer(customer.id, { contract_end: endDate, status: "completed" });
    },
    onSuccess: () => {
      if (!isDemoMode()) invalidateCustomerCaches(queryClient);
      toast.success(`${customer.name} activity closed`);
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Close Activity</DialogTitle>
          <p className="text-sm text-muted-foreground">{customer.name}</p>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="ca-end">End Date</Label>
          <Input
            id="ca-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          {customer.contract_start && (
            <p className="text-xs text-muted-foreground">
              Active since{" "}
              {format(parseISO(customer.contract_start), "MMM d, yyyy")}
              {daysActive !== null && daysActive >= 0 && ` · ${daysActive} day${daysActive !== 1 ? "s" : ""}`}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Income</span>
            <span className="font-semibold" style={{ color: "var(--chart-income)" }}>{fmtCompact(totalIncome)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Expenses</span>
            <span className="font-semibold" style={{ color: "var(--chart-expense)" }}>{fmtCompact(totalExpenses)}</span>
          </div>
          <div className="flex justify-between items-center border-t border-border pt-2">
            <span className="font-medium">Net</span>
            <span className="font-semibold" style={{ color: net >= 0 ? "var(--chart-income)" : "var(--chart-expense)" }}>
              {net < 0 ? "−" : ""}
              {fmtCompact(Math.abs(net))}
            </span>
          </div>
        </div>

        {net < 0 && (
          <p className="text-xs text-warning bg-warning/10 px-3 py-2 rounded-lg">
            Expenses exceed income for this period.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={isPending}>
            {isPending ? "Closing…" : "Confirm & Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["external", "internal"]),
  status: z.enum(["prospect", "active", "inactive", "completed"]),
  contact_name: z.string().optional(),
  contact_email: z.string().email("Invalid email").optional().or(z.literal("")),
  contact_phone: z.string().optional(),
  contract_start: z.string().optional(),
  contract_end: z.string().optional(),
  daily_rate: z.coerce.number().min(0).optional().or(z.literal("")),
  notes: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

// ─── Customer Modal ───────────────────────────────────────────────────────────

interface CustomerModalProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  orgId: string;
  editing: Customer | null;
}

function CustomerModal({ open, onClose, siteId, orgId, editing }: CustomerModalProps) {
  const queryClient = useQueryClient();

  // Infer from existing data whether this customer has a timed contract
  const [hasTimedContract, setHasTimedContract] = useState<boolean>(
    !!editing?.contract_start || !!editing?.daily_rate,
  );

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    values: editing
      ? ({
          name: editing.name,
          type: editing.type,
          status: editing.status,
          contact_name: editing.contact_name ?? "",
          contact_email: editing.contact_email ?? "",
          contact_phone: editing.contact_phone ?? "",
          contract_start: editing.contract_start ?? "",
          contract_end: editing.contract_end ?? "",
          daily_rate: editing.daily_rate ?? "",
          notes: editing.notes ?? "",
        } as CustomerFormValues)
      : {
          name: "",
          type: "external",
          status: "prospect",
          contact_name: "",
          contact_email: "",
          contact_phone: "",
          contract_start: "",
          contract_end: "",
          daily_rate: "",
          notes: "",
        },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: CustomerFormValues) => {
      if (isDemoMode()) {
        toast.info("Demo mode — changes are not persisted.");
        return Promise.resolve({} as Customer);
      }
      const payload: CustomerPayload = {
        name: values.name,
        type: values.type,
        status: values.status,
        contact_name: values.contact_name || undefined,
        contact_email: values.contact_email || undefined,
        contact_phone: values.contact_phone || undefined,
        contract_start: hasTimedContract ? (values.contract_start || undefined) : undefined,
        contract_end:   hasTimedContract ? (values.contract_end   || undefined) : undefined,
        daily_rate:     hasTimedContract && values.daily_rate !== "" ? Number(values.daily_rate) : undefined,
        notes: values.notes || undefined,
      };
      return editing
        ? updateCustomer(editing.id, payload)
        : createCustomer(siteId, orgId, payload);
    },
    onSuccess: () => {
      if (isDemoMode() && !editing) {
        onClose();
        return;
      }
      invalidateCustomerCaches(queryClient);
      toast.success(editing ? "Customer updated." : "Customer added.");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Customer" : "Add Customer"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Goldfield Contractors Pty Ltd" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="external">External</SelectItem>
                        <SelectItem value="internal">Internal</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="prospect">Prospect</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Jane Smith" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 555 000 0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contact@company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Time-based contract toggle */}
              <div className="col-span-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={hasTimedContract}
                  onClick={() => setHasTimedContract((v) => !v)}
                  className="flex items-center gap-3 w-full rounded-lg border border-border bg-muted/30 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className={`relative h-5 w-9 rounded-full transition-colors shrink-0 ${hasTimedContract ? "bg-foreground" : "bg-muted-foreground/30"}`}>
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${hasTimedContract ? "translate-x-4" : "translate-x-0.5"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-tight">Time-based contract</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {hasTimedContract
                        ? "Client billed on a daily rate with start/end dates"
                        : "Client with no fixed rate or contract period"}
                    </p>
                  </div>
                </button>
              </div>

              {hasTimedContract && (
                <>
                  <FormField
                    control={form.control}
                    name="contract_start"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contract Start</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contract_end"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contract End <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="daily_rate"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Daily Rate ($)</FormLabel>
                        <FormControl>
                          <MoneyInput
                            placeholder="0"
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            value={field.value}
                            onValueChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any relevant notes…" rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : editing ? "Save Changes" : "Add Customer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const { activeSiteId } = useSite();
  const { orgId, user } = useAuth();
  const queryClient = useQueryClient();

  const today = new Date();
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd   = format(endOfMonth(today),   "yyyy-MM-dd");

  const [search,       setSearch]       = useState("");
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editing,      setEditing]      = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [rentTarget,   setRentTarget]   = useState<Customer | null>(null);
  const [closeTarget,  setCloseTarget]  = useState<Customer | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", activeSiteId],
    queryFn: () => getCustomers(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const { data: summaries = [] } = useQuery({
    queryKey: ["customerSummaries", activeSiteId, monthStart, monthEnd],
    queryFn: () => getCustomerSummaries(activeSiteId!, monthStart, monthEnd),
    enabled: !!activeSiteId,
  });

  const summaryMap = useMemo(
    () => Object.fromEntries(summaries.map((s) => [s.customerId, s])),
    [summaries],
  );

  const { mutate: doDelete, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => {
      if (isDemoMode()) {
        toast.info("Demo mode — changes are not persisted.");
        return Promise.resolve();
      }
      return deleteCustomer(id);
    },
    onSuccess: () => {
      if (!isDemoMode()) {
        invalidateCustomerCaches(queryClient);
      }
      toast.success("Customer deleted.");
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const byType = useMemo(
    () => (typeFilter === "all" ? customers : customers.filter((c) => c.type === typeFilter)),
    [customers, typeFilter],
  );

  const filtered = useMemo(
    () =>
      byType.filter((c) => {
        if (statusFilter !== "all" && c.status !== statusFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          const hit =
            c.name.toLowerCase().includes(q) ||
            (c.contact_name  ?? "").toLowerCase().includes(q) ||
            (c.contact_email ?? "").toLowerCase().includes(q);
          if (!hit) return false;
        }
        return true;
      }),
    [byType, statusFilter, search],
  );

  return (
    <div className="p-4 lg:p-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-display">Customers</h1>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Customer
        </Button>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-3 rounded-xl border border-border bg-card divide-x divide-border">
        <KpiCell label="Total Customers" value={customers.length.toString()} />
        <KpiCell
          label="Active"
          value={customers.filter((c) => c.status === "active").length.toString()}
          color="var(--chart-income)"
        />
        <KpiCell
          label="Revenue This Month"
          value={fmtCompact(summaries.reduce((sum, s) => sum + s.netProfit, 0))}
          color="var(--chart-income)"
        />
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter customers">
          {STATUS_FILTERS.map((f) => (
            <FilterPill
              key={f.value}
              active={statusFilter === f.value}
              count={f.value === "all" ? byType.length : byType.filter((c) => c.status === f.value).length}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </FilterPill>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
            <SelectTrigger className="h-9 w-32 shrink-0" aria-label="Filter by type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TYPE_FILTERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              aria-label="Search customers"
              placeholder="Search name or contact"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
      </div>

      {/* ── List ── */}
      <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
        {isLoading ? (
          <div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-0">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-2.5 w-48 bg-muted/60 animate-pulse rounded" />
                </div>
                <div className="h-3 w-16 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            {customers.length === 0
              ? "No customers yet. Add your first customer."
              : "No customers match your filters."}
          </div>
        ) : (
          <ul>
            {filtered.map((c) => {
              const summary      = summaryMap[c.id];
              const hasDailyRate = c.daily_rate != null && Number(c.daily_rate) > 0;
              const meta = [
                c.type === "external" ? "External" : "Internal",
                c.contact_name,
                c.contract_start && `since ${format(parseISO(c.contract_start), "d MMM yyyy")}`,
              ].filter(Boolean).join(" · ");

              return (
                <li
                  key={c.id}
                  className="flex items-center gap-2 border-b border-border pr-2 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <Link
                    to={`/customers/${c.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 focus-visible:outline-none focus-visible:bg-muted/30"
                  >
                    <EntityAvatar name={c.name} seed={c.id} className="h-10 w-10 text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{meta}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {summary ? `${summary.netProfit < 0 ? "-" : ""}${fmtCompact(Math.abs(summary.netProfit))}` : "—"}
                      </span>
                      {c.status === "active" ? (
                        <span className="text-xs text-muted-foreground">This month</span>
                      ) : (
                        <StatusBadge status={c.status} />
                      )}
                    </span>
                  </Link>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground" aria-label={`Actions for ${c.name}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {hasDailyRate && (
                        <DropdownMenuItem className="gap-2" onSelect={() => setRentTarget(c)}>
                          <Receipt className="h-4 w-4" />
                          Charge daily rent
                        </DropdownMenuItem>
                      )}
                      {c.status === "active" && (
                        <DropdownMenuItem className="gap-2" onSelect={() => setCloseTarget(c)}>
                          <CheckCircle2 className="h-4 w-4" />
                          Close activity
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="gap-2" onSelect={() => { setEditing(c); setModalOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2 text-destructive focus:text-destructive"
                        onSelect={() => setDeleteTarget(c)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Row count */}
      {!isLoading && filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {filtered.length} {filtered.length === 1 ? "customer" : "customers"}
          {filtered.length !== customers.length && ` of ${customers.length}`}
        </p>
      )}

      {/* ── Modals ── */}
      {modalOpen && (
        <CustomerModal
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
              This will permanently remove the customer. Transactions linked to this customer will be unaffected.
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

      {rentTarget && (
        <RentChargeModal
          open={!!rentTarget}
          onClose={() => setRentTarget(null)}
          customer={rentTarget}
          siteId={activeSiteId!}
          userId={user?.id}
        />
      )}

      {closeTarget && (
        <CloseActivityModal
          open={!!closeTarget}
          onClose={() => setCloseTarget(null)}
          customer={closeTarget}
          siteId={activeSiteId!}
        />
      )}
    </div>
  );
}
