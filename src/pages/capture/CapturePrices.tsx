import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSite } from "@/hooks/useSite";
import { getInventoryItems, updateInventoryItem } from "@/services/inventory.service";
import { fmtCurrency } from "@/lib/formatCurrency";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import type { InventoryItem } from "@/lib/supabaseTypes";

export default function CapturePrices() {
  const { activeSiteId } = useSite();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["capture", "prices", activeSiteId],
    queryFn: () => getInventoryItems(activeSiteId!),
    enabled: !!activeSiteId,
  });

  function openEdit(item: InventoryItem) {
    setEditing(item);
    setPrice(String(item.unit_cost ?? ""));
  }

  async function savePrice() {
    if (!editing) return;
    const value = Number(price);
    if (!(value > 0)) return;
    setSaving(true);
    try {
      await updateInventoryItem(editing.id, { unit_cost: value });
      toast.success("Price updated");
      qc.invalidateQueries({ queryKey: ["capture"] });
      setEditing(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update price");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4">
      <h1 className="mb-1 text-2xl font-bold">Prices</h1>
      <p className="mb-3 text-xs text-muted-foreground">
        Tap an item to update today's price. Prices apply to new entries only — past records keep the price they were saved at.
      </p>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No priced items yet. Tap + and choose “inventory” to add one.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
          {items.map((item, i) => (
            <button
              key={item.id}
              onClick={() => openEdit(item)}
              className={`flex w-full items-center gap-3 px-3 py-3 text-left ${i > 0 ? "border-t" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{item.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {item.category ? `${item.category} · ` : ""}{Number(item.quantity ?? 0).toLocaleString()} {item.unit || "unit"} on hand
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-semibold tabular-nums text-primary">
                  {item.unit_cost != null ? fmtCurrency(Number(item.unit_cost)) : "—"}
                </div>
                <div className="text-[11px] text-muted-foreground">/ {item.unit || "unit"}</div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing?.name}</DialogTitle>
            <DialogDescription>
              Updates the current price only. Expenses already recorded keep the price they were saved at.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Price per {editing?.unit || "unit"}</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              autoFocus
              className="text-right text-lg font-semibold"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={savePrice} disabled={saving || !(Number(price) > 0)}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
