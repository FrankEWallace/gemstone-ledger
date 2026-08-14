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
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtCurrency } from "@/lib/formatCurrency";
import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";
import {
  getInventoryItems,
  createInventoryItem,
  consumeInventoryItem,
} from "@/services/inventory.service";
import { createTransaction, updateTransaction } from "@/services/transactions.service";
import { getExpenseCategories } from "@/services/expense-categories.service";
import { getProductionPhases } from "@/services/production-phases.service";
import { getCustomers, updateCustomer } from "@/services/customers.service";
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { InventoryItem, Transaction } from "@/lib/supabaseTypes";

type Kind = "income" | "expense" | "inventory";
const NONE = "__none__";

/** Simplified mobile entry pad. Mirrors the iOS capture pad: quantity-based item
 *  expenses (reusing consumeInventoryItem), plain income/expense, and adding stock. */
export default function EntryPad({
  open,
  onOpenChange,
  onSaved,
  editTx,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  /** When set, the pad opens pre-filled to edit this transaction instead of adding a new one. */
  editTx?: Transaction | null;
}) {
  const { user, orgId } = useAuth();
  const { activeSiteId } = useSite();
  const isEdit = !!editTx;

  const [kind, setKind] = useState<Kind>("expense");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<"success" | "pending">("pending");
  const [saving, setSaving] = useState(false);

  // income / expense
  const [itemId, setItemId] = useState<string>(NONE);
  // Free-typed item name for an expense that isn't in the catalog (one-off, plain
  // expense, no stock change) — mirrors the iOS item picker's "one-off" field.
  const [itemText, setItemText] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [amount, setAmount] = useState("");
  // Operating-cost mode (days × daily rate) — the category drives this.
  const [days, setDays] = useState("");
  const [ratePerDay, setRatePerDay] = useState("");
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
  // Skipped while editing — the prefill effect owns the field values there.
  useEffect(() => {
    if (!open || isEdit) return;
    setItemId(NONE);
    setItemText("");
    setQuantity("1");
    setAmount("");
    setDays("");
    setRatePerDay("");
    setDescription("");
    setCategoryId(NONE);
    setCustomerId(NONE);
    setPhaseId(NONE);
    setStatus("pending");
  }, [open, kind, isEdit]);

  // Pre-fill from the transaction being edited.
  useEffect(() => {
    if (!open || !editTx) return;
    setKind(editTx.type === "income" ? "income" : "expense");
    setDate(editTx.transaction_date ?? new Date().toISOString().slice(0, 10));
    setStatus(editTx.status === "success" ? "success" : "pending");
    setItemId(NONE);
    setItemText("");
    setQuantity("1");
    const total = Number(editTx.quantity ?? 1) * Number(editTx.unit_price ?? 0);
    setAmount(total ? String(total) : "");
    // Operating-cost edits keep their days × rate breakdown (quantity = days).
    setDays(editTx.quantity ? String(editTx.quantity) : "");
    setRatePerDay(editTx.unit_price ? String(editTx.unit_price) : "");
    setDescription(editTx.description ?? "");
    setCategoryId(editTx.expense_category_id ?? NONE);
    setCustomerId(editTx.customer_id ?? NONE);
    setPhaseId(editTx.phase_id ?? NONE);
  }, [open, editTx]);

  // Default to the newest open phase (adding only — never override an edited entry's phase).
  useEffect(() => {
    if (!open || isEdit || phaseId !== NONE || phases.length === 0) return;
    const openPhase = phases.find((p) => (p.status ?? "open") === "open") ?? phases[0];
    if (openPhase) setPhaseId(openPhase.id);
  }, [open, phases, phaseId, isEdit]);

  // Operating cost: seed the daily rate from the customer's stored rate, and default
  // the day count from the production start date → today. Both stay editable — the day
  // field IS the admin override. Only fills empty fields, so it never clobbers typing.
  useEffect(() => {
    if (!open || isEdit || !isOperating) return;
    const cust = customerId === NONE ? undefined : customers.find((c) => c.id === customerId);
    if (!cust) return;
    if (ratePerDay === "" && cust.daily_rate != null) setRatePerDay(String(cust.daily_rate));
    if (days === "" && cust.contract_start) {
      const elapsed = differenceInCalendarDays(new Date(), parseISO(cust.contract_start)) + 1;
      if (elapsed > 0) setDays(String(elapsed));
    }
  }, [open, isEdit, isOperating, customerId, customers, ratePerDay, days]);

  // The chosen expense category drives the input shape: an "operating" category
  // switches the amount box to days × daily-rate (accrued cost), computed live.
  const selectedCat = useMemo(
    () => (categoryId === NONE ? undefined : cats.find((c) => c.id === categoryId)),
    [categoryId, cats],
  );
  const isOperating =
    kind === "expense" && !selectedItem && !!selectedCat && /operating/i.test(selectedCat.name);

  const qtyNum = Number(quantity) || 0;
  const daysNum = Number(days) || 0;
  const rateNum = Number(ratePerDay) || 0;
  const computedAmount = selectedItem
    ? qtyNum * Number(selectedItem.unit_cost ?? 0)
    : isOperating
      ? daysNum * rateNum
      : Number(amount) || 0;

  const canSave = (() => {
    if (!activeSiteId) return false;
    if (kind === "inventory") return invName.trim().length > 0 && Number(invQty) > 0;
    if (selectedItem) return qtyNum > 0 && Number(selectedItem.unit_cost ?? 0) > 0;
    if (isOperating) return daysNum > 0 && rateNum > 0;
    return computedAmount > 0;
  })();

  const operatingLabel = (d: number) => `Operating cost — ${d} day${d === 1 ? "" : "s"}`;

  // Persist the daily rate onto the customer so next time it prefills and they only
  // confirm the days. Best-effort — a failure here shouldn't block the saved expense.
  async function rememberDailyRate() {
    if (customerId === NONE || rateNum <= 0) return;
    const cust = customers.find((c) => c.id === customerId);
    if (cust && Number(cust.daily_rate ?? 0) === rateNum) return;
    try {
      await updateCustomer(customerId, { daily_rate: rateNum });
    } catch {
      /* non-fatal: the expense is already saved */
    }
  }

  async function save() {
    if (!activeSiteId || !canSave) return;
    setSaving(true);
    try {
      if (editTx) {
        // Edit mode — update the existing transaction's fields in place.
        // Operating cost keeps its days × rate breakdown (quantity = days).
        await updateTransaction(editTx.id, {
          type: kind === "income" ? "income" : "expense",
          status,
          quantity: isOperating ? daysNum : 1,
          unit_price: isOperating ? rateNum : computedAmount,
          description: isOperating
            ? description.trim() || operatingLabel(daysNum)
            : description.trim() || undefined,
          expense_category_id: categoryId === NONE ? null : categoryId,
          customer_id: customerId === NONE ? null : customerId,
          phase_id: phaseId === NONE ? null : phaseId,
          transaction_date: date,
        });
        if (isOperating) await rememberDailyRate();
        toast.success("Entry updated");
        onSaved();
        onOpenChange(false);
        return;
      }
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
      } else if (isOperating) {
        // Operating cost = days × daily rate, stored as quantity(days) × unit_price(rate)
        // so the breakdown survives (no pre-multiplied lump).
        await createTransaction(
          activeSiteId,
          {
            type: "expense",
            status,
            quantity: daysNum,
            unit_price: rateNum,
            description: description.trim() || operatingLabel(daysNum),
            expense_category_id: categoryId === NONE ? null : categoryId,
            customer_id: customerId === NONE ? null : customerId,
            phase_id: phaseId === NONE ? null : phaseId,
            currency: "TZS",
            transaction_date: date,
          },
          user?.id,
        );
        await rememberDailyRate();
      } else {
        // One-off: for an expense the typed item name is the label; income keeps its own description.
        const oneOffDesc = (kind === "income" ? description : itemText).trim();
        await createTransaction(
          activeSiteId,
          {
            type: kind === "income" ? "income" : "expense",
            status,
            quantity: 1,
            unit_price: computedAmount,
            description: oneOffDesc || undefined,
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
    kind === "income" ? "text-success" : kind === "inventory" ? "text-info" : "text-destructive";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader className="pb-2">
          <DrawerTitle>{isEdit ? "Edit entry" : "New entry"}</DrawerTitle>
        </DrawerHeader>

        <div className="max-h-[70dvh] space-y-4 overflow-y-auto px-4">
          {/* Kind segmented — inventory (add stock) isn't editable, so hide it in edit mode */}
          <div className={cn("grid gap-2", isEdit ? "grid-cols-2" : "grid-cols-3")}>
            {(["income", "expense", "inventory"] as Kind[])
              .filter((k) => !isEdit || k !== "inventory")
              .map((k) => (
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
                  <MoneyInput value={invCost} onValueChange={setInvCost} placeholder="0" />
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
                      status === "success" ? "text-primary" : "text-warning",
                    )}
                  >
                    {status === "success" ? "Paid" : "Pending"}
                  </button>
                </Field>
              </div>

              {!isEdit && kind === "expense" && !isOperating && (
                <Field label="Item">
                  <ExpenseItemField
                    items={items}
                    selected={selectedItem}
                    text={itemText}
                    onText={setItemText}
                    onPick={(id) => { setItemId(id); setItemText(""); }}
                    onClear={() => setItemId(NONE)}
                  />
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
              ) : isOperating ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Days worked">
                      <Input type="number" inputMode="decimal" value={days} onChange={(e) => setDays(e.target.value)} placeholder="0" />
                    </Field>
                    <Field label="Rate / day">
                      <MoneyInput value={ratePerDay} onValueChange={setRatePerDay} placeholder="0" className="text-right" />
                    </Field>
                  </div>
                  <Field label="Amount">
                    <div className={cn("flex h-10 items-center justify-end rounded-md border bg-muted/40 px-3 font-semibold", accent)}>
                      {fmtCurrency(computedAmount)}
                    </div>
                  </Field>
                  <p className="-mt-1 text-[11px] text-muted-foreground">
                    Days default from the production start date — edit to override the days counted.
                  </p>
                </>
              ) : (
                <>
                  <Field label="Amount">
                    <MoneyInput value={amount} onValueChange={setAmount} placeholder="0" className={cn("text-right font-semibold", accent)} />
                  </Field>
                  {(isEdit || kind === "income") && (
                    <Field label="Description">
                      <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Gold sale" />
                    </Field>
                  )}
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
            {saving ? "Saving…" : isEdit ? "Save changes" : "Save"}
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

/** Typeable item picker for expenses. Type a one-off name (plain expense, no stock
 *  change) or tap a catalog match to auto-price it — mirrors the iOS ItemPickerSheet. */
function ExpenseItemField({
  items,
  selected,
  text,
  onText,
  onPick,
  onClear,
}: {
  items: InventoryItem[];
  selected?: InventoryItem;
  text: string;
  onText: (v: string) => void;
  onPick: (id: string) => void;
  onClear: () => void;
}) {
  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{selected.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {fmtCurrency(Number(selected.unit_cost ?? 0))}/{selected.unit || "unit"} · from catalog
          </div>
        </div>
        <button type="button" onClick={onClear} className="shrink-0 rounded-full p-1 text-muted-foreground" aria-label="Clear item">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const q = text.trim().toLowerCase();
  const matches = (q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items).slice(0, 6);

  return (
    <div className="space-y-1.5">
      <Input
        value={text}
        onChange={(e) => onText(e.target.value)}
        placeholder="Type an item, or pick from catalog"
      />
      {matches.length > 0 && (
        <div className="overflow-hidden rounded-md border">
          {matches.map((i, idx) => (
            <button
              key={i.id}
              type="button"
              onClick={() => onPick(i.id)}
              className={cn("flex w-full items-center justify-between px-3 py-2 text-left", idx > 0 && "border-t")}
            >
              <span className="truncate text-sm">{i.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {fmtCurrency(Number(i.unit_cost ?? 0))}/{i.unit || "unit"}
              </span>
            </button>
          ))}
        </div>
      )}
      {q.length > 0 && matches.length === 0 && (
        <p className="text-[11px] text-muted-foreground">Not in catalog — saved as a one-off expense.</p>
      )}
    </div>
  );
}
