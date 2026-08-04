import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSite } from "@/hooks/useSite";
import {
  getInventoryItems,
  updateInventoryItem,
  createInventoryItem,
  receiveInventoryStock,
} from "@/services/inventory.service";
import { fmtCurrency } from "@/lib/formatCurrency";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronRight, Plus } from "lucide-react";
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
  const [adding, setAdding] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["capture", "prices", activeSiteId],
    queryFn: () => getInventoryItems(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["capture"] });

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Prices</h1>
        <button
          onClick={() => setAdding(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm active:scale-95"
          aria-label="Add item"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground">No priced items yet.</p>
          <button onClick={() => setAdding(true)} className="mt-3 text-sm font-medium text-primary">
            Add an item
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
          {items.map((item, i) => (
            <button
              key={item.id}
              onClick={() => setEditing(item)}
              className={`flex w-full items-center gap-3 px-3 py-3 text-left ${i > 0 ? "border-t" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{item.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {item.category ? `${item.category} · ` : ""}{Number(item.quantity ?? 0).toLocaleString()} {item.unit || "unit"} on hand
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-medium tabular-nums text-primary">
                  {item.unit_cost != null ? fmtCurrency(Number(item.unit_cost)) : "—"}
                </div>
                <div className="text-[11px] text-muted-foreground">/ {item.unit || "unit"}</div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      <ItemSheet item={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      <AddItemDialog open={adding} onOpenChange={setAdding} onSaved={refresh} />
    </div>
  );
}

/** Tap-through sheet for an existing item: update price + receive more stock. */
function ItemSheet({ item, onClose, onSaved }: { item: InventoryItem | null; onClose: () => void; onSaved: () => void }) {
  const { activeSiteId } = useSite();
  const [price, setPrice] = useState("");
  const [receive, setReceive] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPrice(item?.unit_cost != null ? String(item.unit_cost) : "");
    setReceive("");
  }, [item]);

  async function savePrice() {
    if (!item) return;
    const value = Number(price);
    if (!(value > 0)) return;
    setSaving(true);
    try {
      await updateInventoryItem(item.id, { unit_cost: value });
      toast.success("Price updated");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update price");
    } finally {
      setSaving(false);
    }
  }

  async function addStock() {
    if (!item || !activeSiteId) return;
    const qty = Number(receive);
    if (!(qty > 0)) return;
    setSaving(true);
    try {
      await receiveInventoryStock(activeSiteId, item, qty);
      toast.success(`Added ${qty} ${item.unit || "unit"} to stock`);
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not receive stock");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{item?.name}</DialogTitle>
          <DialogDescription>
            {Number(item?.quantity ?? 0).toLocaleString()} {item?.unit || "unit"} on hand
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Price per {item?.unit || "unit"}</Label>
          <Input
            type="number"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="text-right text-lg font-semibold"
          />
          <p className="text-[11px] text-muted-foreground">
            Updates the current price only. Expenses already recorded keep the price they were saved at.
          </p>
        </div>

        <div className="mt-1 space-y-1.5 border-t pt-3">
          <Label className="text-xs text-muted-foreground">Receive stock (add to on hand)</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              inputMode="decimal"
              value={receive}
              onChange={(e) => setReceive(e.target.value)}
              placeholder="0"
              className="text-right"
            />
            <Button variant="outline" onClick={addStock} disabled={saving || !(Number(receive) > 0)}>
              Add
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Increases quantity on hand. The cost is recorded when the stock is used, not when it's received.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={savePrice} disabled={saving || !(Number(price) > 0)}>
            {saving ? "Saving…" : "Save price"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Create a new priced item (mirrors the iOS AddItemSheet). */
function AddItemDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const { activeSiteId } = useSite();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(""); setUnit(""); setPrice(""); setQuantity(""); setCategory("");
  }, [open]);

  const canSave = name.trim().length > 0 && !!activeSiteId;

  async function save() {
    if (!canSave || !activeSiteId) return;
    setSaving(true);
    try {
      await createInventoryItem(activeSiteId, {
        name: name.trim(),
        quantity: quantity ? Number(quantity) : 0,
        unit: unit.trim() || undefined,
        unit_cost: price ? Number(price) : undefined,
        category: category.trim() || undefined,
      });
      toast.success("Item added");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not add item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New item</DialogTitle>
          <DialogDescription>
            Add something you buy by quantity — diesel, cement, gravel — with today's price.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Diesel" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Unit</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="L, bag, ton…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Price / unit</Label>
              <Input type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" className="text-right" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Opening stock</Label>
              <Input type="number" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" className="text-right" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Optional" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!canSave || saving}>{saving ? "Saving…" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
