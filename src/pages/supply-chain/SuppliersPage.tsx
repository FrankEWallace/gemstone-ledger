import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
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

import type { Supplier } from "@/lib/supabaseTypes";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "@/services/suppliers.service";

// ─── Schema ──────────────────────────────────────────────────────────────────

const supplierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contact_name: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(["active", "inactive"]),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

// ─── Modal ────────────────────────────────────────────────────────────────────

interface SupplierModalProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  editing: Supplier | null;
}

function SupplierModal({ open, onClose, orgId, editing }: SupplierModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    values: editing
      ? {
          name: editing.name,
          contact_name: editing.contact_name ?? "",
          email: editing.email ?? "",
          phone: editing.phone ?? "",
          address: editing.address ?? "",
          category: editing.category ?? "",
          status: editing.status,
        }
      : { name: "", contact_name: "", email: "", phone: "", address: "", category: "", status: "active" },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: SupplierFormValues) => {
      const payload = {
        name: values.name,
        contact_name: values.contact_name || undefined,
        email: values.email || undefined,
        phone: values.phone || undefined,
        address: values.address || undefined,
        category: values.category || undefined,
        status: values.status,
      };
      return editing
        ? updateSupplier(editing.id, payload)
        : createSupplier(orgId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers", orgId] });
      toast.success(editing ? "Supplier updated." : "Supplier added.");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Apex Mining Supplies" {...field} />
                    </FormControl>
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
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Equipment, PPE, Fuel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contact@supplier.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
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
                name="address"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Street, City, Country" rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
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
                {isPending ? "Saving…" : editing ? "Save Changes" : "Add Supplier"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers", orgId],
    queryFn: () => getSuppliers(orgId!),
    enabled: !!orgId,
  });

  const { mutate: doDelete, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers", orgId] });
      toast.success("Supplier deleted.");
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered =
    statusFilter === "all" ? suppliers : suppliers.filter((s) => s.status === statusFilter);

  const columns: DataTableColumn<Supplier>[] = [
    {
      key: "name",
      header: "Supplier",
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
    { key: "category", header: "Category", sortable: true, render: (v) => String(v || "—") },
    {
      key: "email",
      header: "Contact",
      render: (_, row) => (
        <div className="space-y-0.5">
          {row.email && (
            <div className="flex items-center gap-1 text-xs">
              <Mail className="h-3 w-3 text-muted-foreground" />
              <a href={`mailto:${row.email}`} className="hover:underline">{row.email}</a>
            </div>
          )}
          {row.phone && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              {row.phone}
            </div>
          )}
          {!row.email && !row.phone && <span className="text-muted-foreground text-xs">—</span>}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (val) =>
        val === "active" ? (
          <Badge variant="outline" className="text-emerald-600 border-emerald-200">Active</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
        ),
    },
    {
      key: "id",
      header: "",
      className: "w-20 text-right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
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
        <h1 className="font-display text-2xl font-bold">Suppliers</h1>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Supplier
        </Button>
      </div>

      <DataTable
        data={filtered as unknown as Record<string, unknown>[]}
        columns={columns as DataTableColumn<Record<string, unknown>>[]}
        keyField="id"
        searchable
        searchPlaceholder="Search by name or category…"
        searchKeys={["name", "contact_name", "category", "email"]}
        pageSize={15}
        isLoading={isLoading}
        emptyMessage="No suppliers found. Add your first supplier."
        toolbar={
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {modalOpen && (
        <SupplierModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          orgId={orgId!}
          editing={editing}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the supplier. Orders referencing this supplier will be unaffected.
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
    </div>
  );
}
