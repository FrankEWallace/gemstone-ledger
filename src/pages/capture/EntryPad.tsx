import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fmtCurrency } from "@/lib/formatCurrency";
import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";
import {
  getInventoryItems,
  createInventoryItem,
  consumeInventoryItem,
} from "@/services/inventory.service";
import { createTransaction } from "@/services/transactions.service";
import { getExpenseCategories } from "@/services/expense-categories.service";
import { getProductionPhases } from "@/services/production-phases.service";
import { getCustomers } from "@/services/customers.service";
import type { InventoryItem } from "@/lib/supabaseTypes";

type Kind = "income" | "expense" | "inventory";
const NONE = "__none__";

/** Simplified mobile entry pad. Mirrors the iOS capture pad: quantity-based item
 *  expenses (reusing consumeInventoryItem), plain income/expense, and adding stock. */
export default function EntryPad({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const { user, orgId } = useAuth();
  const { activeSiteId } = useSite();

  const [kind, setKind] = useState<Kind>("expense");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<"success" | "pending">("success");
  const [saving, setSaving] = useState(false);

  // income / expense
  const [itemId, setItemId] = useState<string>(NONE);
  const [quantity, setQuantity] = useState("1");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>(NONE);
  const [customerId, setCustomerId] = useState<string>(NONE);
  const [phaseId, setPhaseId] = useState<string>(NONE);

  // inventory (add stock)
  const [invName, setInvName] = useState("");
  const [invUnit, setInvUnit] = useState("");
  const [invCost, setInvCost] = useState("");
  const [invQty, setInvQty] = useState("");

  const enabled = open && !!activeSiteId;
  const { data: items = [] } = useQuery({
    queryKey: ["capture", "items", activeSiteId],
    queryFn: () => getInventoryItems(activeSiteId!),
    enabled,
  });
  const { data: cats = [] } = useQuery({
    queryKey: ["capture", "cats", orgId],
    queryFn: () => getExpenseCategories(orgId!),
    enabled: enabled && !!orgId,
  });
  const { data: phases = [] } = useQuery({
    queryKey: ["capture", "phases", activeSiteId],
    queryFn: () => getProductionPhases(activeSiteId!),
    enabled,
  });
  const { data: customers = [] } = useQuery({
    queryKey: ["capture", "customers", activeSiteId],
    queryFn: () => getCustomers(activeSiteId!),
    enabled,
  });

  const kindCats = useMemo(
    () => cats.filter((c) => (c.type ?? "expense") === (kind === "income" ? "income" : "expense")),
    [cats, kind],
  );

  const selectedItem: InventoryItem | undefined = useMemo(
    () => (itemId === NONE ? undefined : items.find((i) => i.id === itemId)),
    [itemId, items],
  );

  // Reset per-open and when the kind changes so stale picks don't leak across types.
  useEffect(() => {
    if (!open) return;
    setItemId(NONE);
    setQuantity("1");
    setAmount("");
    setDescription("");
    setCategoryId(NONE);
    setCustomerId(NONE);
    setPhaseId(NONE);
    setStatus("success");
  }, [open, kind]);

  // Default to the newest open phase.
  useEffect(() => {
    if (!open || phaseId !== NONE || phases.length === 0) return;
    const openPhase = phases.find((p) => (p.status ?? "open") === "open") ?? phases[0];
    if (openPhase) setPhaseId(openPhase.id);
  }, [open, phases, phaseId]);

  const qtyNum = Number(quantity) || 0;
  const computedAmount = selectedItem
    ? qtyNum * Number(selectedItem.unit_cost ?? 0)
    : Number(amount) || 0;

  const canSave = (() => {
    if (!activeSiteId) return false;
    if (kind === "inventory") return invName.trim().length > 0 && Number(invQty) > 0;
    if (selectedItem) return qtyNum > 0 && Number(selectedItem.unit_cost ?? 0) > 0;
    return computedAmount > 0;
  })();

  async function save() {
    if (!activeSiteId || !canSave) return;
    setSaving(true);
    try {
      if (kind === "inventory") {
        await createInventoryItem(activeSiteId, {
          name: invName.trim(),
          quantity: Number(invQty) || 0,
          unit: invUnit.trim() || undefined,
          unit_cost: invCost ? Number(invCost) : undefined,
          category: undefined,
        });
      } else if (kind === "expense" && selectedItem) {
        // Reuse the web app's consume path: deduct stock + source:"inventory" expense.
        await consumeInventoryItem(activeSiteId, selectedItem, qtyNum, {
          customerId: customerId === NONE ? null : customerId,
          expenseCategoryId: categoryId === NONE ? null : categoryId,
          notes: description.trim() || undefined,
          userId: user?.id,
          transactionDate: date,
        });
      } else {
        await createTransaction(
          activeSiteId,
          {
            type: kind === "income" ? "income" : "expense",
            status,
            quantity: 1,
            unit_price: computedAmount,
            description: description.trim() || undefined,
            expense_category_id: categoryId === NONE ? null : categoryId,
            customer_id: customerId === NONE ? null : customerId,
            phase_id: phaseId === NONE ? null : phaseId,
            currency: "TZS",
            transaction_date: date,
          },
          user?.id,
        );
      }
      toast.success(kind === "inventory" ? "Item added" : "Entry saved");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  }

  const accent =
    kind === "income" ? "text-emerald-600" : kind === "inventory" ? "text-blue-600" : "text-red-600";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader className="pb-2">
          <DrawerTitle>New entry</DrawerTitle>
        </DrawerHeader>

        <div className="max-h-[70dvh] space-y-4 overflow-y-auto px-4">
          {/* Kind segmented */}
          <div className="grid grid-cols-3 gap-2">
            {(["income", "expense", "inventory"] as Kind[]).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-lg border py-2 text-sm capitalize transition-colors",
                  kind === k
                    ? "border-primary font-medium text-primary"
                    : "border-input text-muted-foreground",
                )}
              >
                {k}
              </button>
            ))}
          </div>

          {kind === "inventory" ? (
            <div className="space-y-3">
              <Field label="Name">
                <Input value={invName} onChange={(e) => setInvName(e.target.value)} placeholder="e.g. Diesel" />
              </Field>
              <Field label="Unit">
                <Input value={invUnit} onChange={(e) => setInvUnit(e.target.value)} placeholder="L, bag, ton…" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price / unit">
                  <Input type="number" inputMode="decimal" value={invCost} onChange={(e) => setInvCost(e.target.value)} placeholder="0" />
                </Field>
                <Field label="Opening stock">
                  <Input type="number" inputMode="decimal" value={invQty} onChange={(e) => setInvQty(e.target.value)} placeholder="0" />
                </Field>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>
                <Field label="Status">
                  <button
                    onClick={() => setStatus((s) => (s === "success" ? "pending" : "success"))}
                    className={cn(
                      "h-10 w-full rounded-md border text-sm font-medium",
                      status === "success" ? "text-primary" : "text-amber-600",
                    )}
                  >
                    {status === "success" ? "Paid" : "Pending"}
                  </button>
                </Field>
              </div>

              {kind === "expense" && (
                <Field label="Item (from catalog)">
                  <Select value={itemId} onValueChange={setItemId}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None (one-off)</SelectItem>
                      {items.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name} — {fmtCurrency(Number(i.unit_cost ?? 0))}/{i.unit || "unit"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {selectedItem ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Quantity">
                    <Input type="number" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                  </Field>
                  <Field label="Amount">
                    <div className={cn("flex h-10 items-center justify-end rounded-md border bg-muted/40 px-3 font-semibold", accent)}>
                      {fmtCurrency(computedAmount)}
                    </div>
                  </Field>
                </div>
              ) : (
                <>
                  <Field label="Amount">
                    <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={cn("text-right font-semibold", accent)} />
                  </Field>
                  <Field label="Description">
                    <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={kind === "income" ? "e.g. Gold sale" : "e.g. Generator repair"} />
                  </Field>
                </>
              )}

              <Field label="Category">
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {kindCats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Customer">
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Phase">
                  <Select value={phaseId} onValueChange={setPhaseId}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      {phases.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {selectedItem && (
                <Field label="Note (optional)">
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Extra detail" />
                </Field>
              )}
            </div>
          )}
        </div>

        <DrawerFooter>
          <Button onClick={save} disabled={!canSave || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
