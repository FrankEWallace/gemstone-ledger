import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, Pencil, Trash2, Mail, Phone, Receipt,
  Search, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  format, differenceInCalendarDays, parseISO,
  startOfMonth, endOfMonth,
} from "date-fns";

import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";
import { isDemoMode } from "@/lib/demo";
import { fmtCurrency, fmtCompact, CURRENCY_SYMBOL } from "@/lib/formatCurrency";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  income:  "hsl(var(--chart-income))",
  expense: "hsl(var(--chart-expense))",
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: Customer["type"] }) {
  return type === "external"
    ? <Badge variant="outline" className="text-blue-600 border-blue-200 text-[10px]">External</Badge>
    : <Badge variant="outline" className="text-muted-foreground text-[10px]">Internal</Badge>;
}

function StatusBadge({ status }: { status: Customer["status"] }) {
  if (status === "prospect")  return <Badge variant="outline" className="text-violet-600 border-violet-200 text-[10px]">Prospect</Badge>;
  if (status === "active")    return <Badge variant="outline" className="text-blue-600 border-blue-200 text-[10px]">Active</Badge>;
  if (status === "completed") return <Badge variant="outline" className="text-blue-500 border-blue-100 text-[10px]">Completed</Badge>;
  return <Badge variant="outline" className="text-muted-foreground text-[10px]">Inactive</Badge>;
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
      ? {
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
        }
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
      queryClient.invalidateQueries({ queryKey: ["customers", siteId] });
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
                    <p className="text-[11px] text-muted-foreground mt-0.5">
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
                          <Input type="number" min={0} step="0.01" placeholder="0.00" {...field} />
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const today = new Date();
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd   = format(endOfMonth(today),   "yyyy-MM-dd");

  const [search,       setSearch]       = useState("");
  const [typeFilter,   setTypeFilter]   = useState<"all" | "external" | "internal">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "prospect" | "active" | "inactive" | "completed">("all");
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editing,      setEditing]      = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [rentTarget,   setRentTarget]   = useState<Customer | null>(null);

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
        queryClient.invalidateQueries({ queryKey: ["customers", activeSiteId] });
      }
      toast.success("Customer deleted.");
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = useMemo(
    () =>
      customers.filter((c) => {
        if (typeFilter !== "all" && c.type !== typeFilter) return false;
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
    [customers, typeFilter, statusFilter, search],
  );

  return (
    <div className="p-4 lg:p-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Financial metrics reflect {format(startOfMonth(today), "MMMM yyyy")}
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Customer
        </Button>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name or contact…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="external">External</SelectItem>
            <SelectItem value="internal">Internal</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="prospect">Prospect</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="space-y-0">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-border last:border-0">
                <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-2.5 w-48 bg-muted/60 animate-pulse rounded" />
                </div>
                <div className="h-3 w-20 bg-muted animate-pulse rounded hidden sm:block" />
                <div className="h-3 w-24 bg-muted animate-pulse rounded hidden lg:block" />
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                    Customer
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground hidden sm:table-cell">
                    Contact
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground hidden md:table-cell">
                    Started
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                    Status
                  </th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                    End Date
                  </th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground hidden lg:table-cell">
                    Net Revenue
                  </th>
                  <th className="px-4 py-2.5 w-[88px]" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const summary      = summaryMap[c.id];
                  const hasDailyRate = c.daily_rate != null && Number(c.daily_rate) > 0;

                  const avatarCls: Record<string, string> = {
                    active:    "bg-blue-100 text-blue-700",
                    prospect:  "bg-violet-100 text-violet-700",
                    completed: "bg-blue-100 text-blue-700",
                    inactive:  "bg-muted text-muted-foreground",
                  };

                  return (
                    <tr
                      key={c.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/customers/${c.id}`)}
                    >
                      {/* Customer */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${avatarCls[c.status] ?? "bg-muted text-muted-foreground"}`}>
                            <span className="text-[11px] font-semibold uppercase">
                              {c.name.slice(0, 2)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium leading-tight truncate">{c.name}</p>
                            <TypeBadge type={c.type} />
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          {c.contact_name && (
                            <p className="font-medium text-foreground">{c.contact_name}</p>
                          )}
                          {c.contact_email && (
                            <a
                              href={`mailto:${c.contact_email}`}
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-[160px]">{c.contact_email}</span>
                            </a>
                          )}
                          {c.contact_phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3 shrink-0" />
                              {c.contact_phone}
                            </span>
                          )}
                          {!c.contact_name && !c.contact_email && !c.contact_phone && (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </div>
                      </td>

                      {/* Started */}
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        {c.contract_start ? (
                          <span className="text-xs text-foreground tabular-nums">
                            {format(parseISO(c.contract_start), "d MMM yyyy")}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <StatusBadge status={c.status} />
                      </td>

                      {/* End Date */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        {c.contract_end ? (
                          <span className="text-xs text-foreground tabular-nums">
                            {format(parseISO(c.contract_end), "d MMM yyyy")}
                          </span>
                        ) : (
                          <span
                            className="text-xs font-medium"
                            style={{ color: c.status === "active" ? C.income : undefined }}
                          >
                            {c.status === "active" ? "Ongoing" : <span className="text-muted-foreground/50">—</span>}
                          </span>
                        )}
                      </td>

                      {/* Net Revenue */}
                      <td className="px-4 py-3.5 text-right hidden lg:table-cell">
                        {summary ? (
                          <div>
                            <p className="font-semibold tabular-nums text-sm" style={{ color: summary.netProfit >= 0 ? C.income : C.expense }}>
                              {summary.netProfit < 0 ? "-" : ""}
                              {fmtCompact(Math.abs(summary.netProfit))}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {summary.transactionCount} txn{summary.transactionCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        className="px-3 py-3.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {hasDailyRate && (
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-blue-600 hover:text-blue-700"
                              title="Charge daily rent"
                              onClick={() => setRentTarget(c)}
                            >
                              <Receipt className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            title="Edit"
                            onClick={() => { setEditing(c); setModalOpen(true); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="Delete"
                            onClick={() => setDeleteTarget(c)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-0.5" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row count */}
      {!isLoading && filtered.length > 0 && (
        <p className="text-[11px] text-muted-foreground text-right">
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
    </div>
  );
}
