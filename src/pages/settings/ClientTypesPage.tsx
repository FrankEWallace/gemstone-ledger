import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, Check, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { isDemoMode } from "@/lib/demo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { ClientType } from "@/lib/supabaseTypes";
import {
  getClientTypes,
  createClientType,
  updateClientType,
  deleteClientType,
} from "@/services/client-types.service";

export default function ClientTypesPage() {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const demo = isDemoMode();
  const queryKey = ["client-types", orgId];

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ClientType | null>(null);

  const { data: types = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => getClientTypes(orgId!),
    enabled: !!orgId,
  });

  function guardDemo(): boolean {
    if (demo) toast.info("Demo mode — changes are not persisted.");
    return demo;
  }

  const onError = (err: Error) => toast.error(err.message);
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  const add = useMutation({
    mutationFn: () => createClientType(orgId!, newName, types.length),
    onSuccess: () => { setNewName(""); refresh(); toast.success("Client type added."); },
    onError,
  });

  const rename = useMutation({
    mutationFn: () => updateClientType(editingId!, { name: editName }),
    onSuccess: () => { setEditingId(null); refresh(); toast.success("Client type renamed."); },
    onError,
  });

  const toggleArchive = useMutation({
    mutationFn: (t: ClientType) => updateClientType(t.id, { archived: !t.archived }),
    onSuccess: refresh,
    onError,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteClientType(id),
    onSuccess: () => {
      setDeleteTarget(null);
      refresh();
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Client type deleted.");
    },
    onError,
  });

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-display">Client types</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Group your external clients by type, such as Carbon Pulp. Types show on the client list and in reports.
        </p>
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim() || guardDemo()) return;
          add.mutate();
        }}
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="new-client-type">New client type</Label>
          <Input
            id="new-client-type"
            placeholder="e.g. Carbon Pulp"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={!newName.trim() || add.isPending}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add
        </Button>
      </form>

      <div className="rounded-lg border border-border bg-card shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        ) : types.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No client types yet. Add your first one above.
          </div>
        ) : (
          <ul>
            {types.map((t) => (
              <li key={t.id} className="flex items-center gap-2 border-b border-border px-4 py-3 last:border-0">
                {editingId === t.id ? (
                  <form
                    className="flex flex-1 items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!editName.trim() || guardDemo()) return;
                      rename.mutate();
                    }}
                  >
                    <Input
                      aria-label="Client type name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      className="h-8"
                    />
                    <Button type="submit" size="icon" variant="ghost" className="h-8 w-8" aria-label="Save name">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Cancel" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className={t.archived ? "flex-1 text-sm text-muted-foreground" : "flex-1 text-sm font-medium"}>
                      {t.name}
                    </span>
                    {t.archived && <Badge variant="outline">Archived</Badge>}
                    <Button
                      size="icon" variant="ghost" className="h-8 w-8" aria-label={`Rename ${t.name}`}
                      onClick={() => { setEditingId(t.id); setEditName(t.name); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-8 w-8"
                      aria-label={t.archived ? `Restore ${t.name}` : `Archive ${t.name}`}
                      title={t.archived ? "Restore" : "Archive — hide from new clients"}
                      onClick={() => !guardDemo() && toggleArchive.mutate(t)}
                    >
                      {t.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                      aria-label={`Delete ${t.name}`}
                      onClick={() => setDeleteTarget(t)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Clients of this type keep all their data and simply lose their type. Archive it instead to keep existing clients tagged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={() => deleteTarget && !guardDemo() && remove.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
