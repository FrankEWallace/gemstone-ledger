import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Mail, Phone, Receipt } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInCalendarDays, parseISO } from "date-fns";

import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";
import { isDemoMode } from "@/lib/demo";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
        toast.success(`Rent invoice created: ${days} day${days !== 1 ? "s" : ""} × $${dailyRate.toLocaleString()}`);
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
              Daily rate: <span className="font-medium tabular-nums">${dailyRate.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
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
              <span className="tabular-nums font-medium text-foreground">${dailyRate.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-semibold border-t border-border pt-1 mt-1">
              <span>Total</span>
              <span className="tabular-nums text-emerald-600">${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
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

// ─── Modal ────────────────────────────────────────────────────────────────────

interface CustomerModalProps {
  open: boolean;
  onClose: () => void;
  siteId: string;
  orgId: string;
  editing: Customer | null;
}

function CustomerModal({ open, onClose, siteId, orgId, editing }: CustomerModalProps) {
  const queryClient = useQueryClient();

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
        contract_start: values.contract_start || undefined,
        contract_end: values.contract_end || undefined,
        daily_rate: values.daily_rate !== "" ? Number(values.daily_rate) : undefined,
        notes: values.notes || undefined,
      };
      return editing
        ? updateCustomer(editing.id, payload)
        : createCustomer(siteId, orgId, payload);
    },
    onSuccess: (_, values) => {
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
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
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
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
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

              <FormField
                control={form.control}
                name="contract_start"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Start</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contract_end"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract End</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
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

  const [typeFilter, setTypeFilter] = useState<"all" | "external" | "internal">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "prospect" | "active" | "inactive" | "completed">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [rentTarget, setRentTarget] = useState<Customer | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", activeSiteId],
    queryFn: () => getCustomers(activeSiteId!),
    enabled: !!activeSiteId,
  });

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

  const filtered = customers.filter((c) => {
    if (typeFilter !== "all" && c.type !== typeFilter) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    return true;
  });

  const columns: DataTableColumn<Customer>[] = [
    {
      key: "name",
      header: "Customer",
      sortable: true,
      render: (_, row) => (
        <div>
          <p className="font-medium">{row.name}</p>
          {row.contact_name && (
            <p className="text-xs text-muted-foreground">{row.contact_name}</p>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      render: (val) =>
        val === "external" ? (
          <Badge variant="outline" className="text-blue-600 border-blue-200">External</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">Internal</Badge>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (val) => {
        if (val === "prospect")  return <Badge variant="outline" className="text-violet-600 border-violet-200">Prospect</Badge>;
        if (val === "active")    return <Badge variant="outline" className="text-emerald-600 border-emerald-200">Active</Badge>;
        if (val === "completed") return <Badge variant="outline" className="text-blue-500 border-blue-100">Completed</Badge>;
        return <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>;
      },
    },
    {
      key: "contact_email",
      header: "Contact",
      render: (_, row) => (
        <div className="space-y-0.5">
          {row.contact_email && (
            <div className="flex items-center gap-1 text-xs">
              <Mail className="h-3 w-3 text-muted-foreground" />
              <a href={`mailto:${row.contact_email}`} className="hover:underline">{row.contact_email}</a>
            </div>
          )}
          {row.contact_phone && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              {row.contact_phone}
            </div>
          )}
          {!row.contact_email && !row.contact_phone && (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </div>
      ),
    },
    {
      key: "contract_start",
      header: "Contract Period",
      render: (_, row) => {
        if (!row.contract_start && !row.contract_end) return <span className="text-muted-foreground text-xs">—</span>;
        const start = row.contract_start ? format(new Date(row.contract_start), "d MMM yyyy") : "—";
        const end   = row.contract_end   ? format(new Date(row.contract_end),   "d MMM yyyy") : "—";
        return <span className="text-xs">{start} → {end}</span>;
      },
    },
    {
      key: "daily_rate",
      header: "Daily Rate",
      sortable: true,
      className: "text-right",
      render: (val) =>
        val != null
          ? <span className="tabular-nums text-xs">${Number(val).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      key: "id",
      header: "",
      className: "w-28 text-right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          {row.daily_rate != null && Number(row.daily_rate) > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
              title="Charge daily rent"
              onClick={() => setRentTarget(row)}
            >
              <Receipt className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => { setEditing(row); setModalOpen(true); }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(row)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Customers</h1>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Customer
        </Button>
      </div>

      <DataTable
        data={filtered as unknown as Record<string, unknown>[]}
        columns={columns as DataTableColumn<Record<string, unknown>>[]}
        keyField="id"
        searchable
        searchPlaceholder="Search by name or contact…"
        searchKeys={["name", "contact_name", "contact_email"]}
        pageSize={15}
        isLoading={isLoading}
        emptyMessage="No customers found. Add your first customer."
        toolbar={
          <>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger className="w-32 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="external">External</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

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
