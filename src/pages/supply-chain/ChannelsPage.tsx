import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
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

import type { Channel } from "@/lib/supabaseTypes";
import {
  getChannels,
  createChannel,
  updateChannel,
  deleteChannel,
} from "@/services/suppliers.service";

// ─── Schema ──────────────────────────────────────────────────────────────────

const channelSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().optional(),
  description: z.string().optional(),
});

type ChannelFormValues = z.infer<typeof channelSchema>;

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ChannelModalProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  editing: Channel | null;
}

function ChannelModal({ open, onClose, orgId, editing }: ChannelModalProps) {
  const queryClient = useQueryClient();

  const form = useForm<ChannelFormValues>({
    resolver: zodResolver(channelSchema),
    values: editing
      ? { name: editing.name, type: editing.type ?? "", description: editing.description ?? "" }
      : { name: "", type: "", description: "" },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: ChannelFormValues) => {
      const payload = {
        name: values.name,
        type: values.type || undefined,
        description: values.description || undefined,
      };
      return editing ? updateChannel(editing.id, payload) : createChannel(orgId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", orgId] });
      toast.success(editing ? "Channel updated." : "Channel added.");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Channel" : "Add Channel"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Channel Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Direct Sale, Export, Auction" {...field} />
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
                  <FormLabel>Type</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. retail, wholesale, online" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Brief description of this channel…" rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : editing ? "Save Changes" : "Add Channel"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChannelsPage() {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Channel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Channel | null>(null);

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["channels", orgId],
    queryFn: () => getChannels(orgId!),
    enabled: !!orgId,
  });

  const { mutate: doDelete, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => deleteChannel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", orgId] });
      toast.success("Channel deleted.");
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const columns: DataTableColumn<Channel>[] = [
    { key: "name", header: "Channel Name", sortable: true, render: (v) => <span className="font-medium">{String(v)}</span> },
    { key: "type", header: "Type", sortable: true, render: (v) => String(v || "—") },
    { key: "description", header: "Description", render: (v) => <span className="text-sm text-muted-foreground">{String(v || "—")}</span> },
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
        <div>
          <h1 className="font-display text-2xl font-bold">Channels</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Distribution channels used in purchase orders.</p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Channel
        </Button>
      </div>

      <DataTable
        data={channels as unknown as Record<string, unknown>[]}
        columns={columns as DataTableColumn<Record<string, unknown>>[]}
        keyField="id"
        searchable
        searchPlaceholder="Search channels…"
        searchKeys={["name", "type", "description"]}
        pageSize={20}
        isLoading={isLoading}
        emptyMessage="No channels yet. Add your first distribution channel."
      />

      {modalOpen && (
        <ChannelModal
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
              This will permanently remove the channel. Existing orders using this channel will be unaffected.
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
