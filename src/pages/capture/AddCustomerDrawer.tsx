import { useEffect, useState } from "react";
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
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";
import { createCustomer } from "@/services/customers.service";
import type { Customer } from "@/lib/supabaseTypes";

/** Create a customer from the capture surface. Mirrors the iOS AddCustomerSheet:
 *  name, type, phone, daily rate, optional fixed-contract dates, notes. */
export default function AddCustomerDrawer({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (c: Customer) => void;
}) {
  const { orgId } = useAuth();
  const { activeSiteId } = useSite();

  const [name, setName] = useState("");
  const [type, setType] = useState<"external" | "internal">("external");
  const [phone, setPhone] = useState("");
  const [dailyRate, setDailyRate] = useState("");
  const [hasContract, setHasContract] = useState(false);
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setType("external");
    setPhone("");
    setDailyRate("");
    setHasContract(false);
    setNotes("");
  }, [open]);

  const canSave = name.trim().length > 0 && !!activeSiteId && !!orgId;

  async function save() {
    if (!canSave || !activeSiteId || !orgId) return;
    setSaving(true);
    try {
      const created = await createCustomer(activeSiteId, orgId, {
        name: name.trim(),
        type,
        status: "active",
        contact_phone: phone.trim() || undefined,
        daily_rate: dailyRate ? Number(dailyRate) : undefined,
        contract_start: hasContract ? start : undefined,
        contract_end: hasContract ? end : undefined,
        notes: notes.trim() || undefined,
      });
      toast.success("Customer added");
      onCreated(created);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not add customer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader className="pb-2">
          <DrawerTitle>New customer</DrawerTitle>
        </DrawerHeader>

        <div className="max-h-[70dvh] space-y-4 overflow-y-auto px-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" autoFocus />
          </Field>

          <Field label="Type">
            <div className="grid grid-cols-2 gap-2">
              {(["external", "internal"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    "rounded-lg border py-2 text-sm capitalize transition-colors",
                    type === t ? "border-primary font-medium text-primary" : "border-input text-muted-foreground",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Phone (optional)">
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
          </Field>

          <div className="rounded-xl border p-3">
            <Field label="Daily rate (TZS)">
              <Input
                type="number"
                inputMode="numeric"
                value={dailyRate}
                onChange={(e) => setDailyRate(e.target.value)}
                placeholder="0"
                className="text-right tabular-nums"
              />
            </Field>
            <label className="mt-3 flex items-center justify-between text-sm">
              <span>Fixed contract dates</span>
              <input
                type="checkbox"
                checked={hasContract}
                onChange={(e) => setHasContract(e.target.checked)}
                className="h-5 w-5 accent-primary"
              />
            </label>
            {hasContract && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Start">
                  <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
                </Field>
                <Field label="End">
                  <Input type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
                </Field>
              </div>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Daily rate × contract days projects the customer's contract value in their report.
            </p>
          </div>

          <Field label="Notes (optional)">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </Field>
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
