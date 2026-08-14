import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { cn } from "@/lib/utils";

/**
 * Days worked × Rate/day → live Amount, shared by every add-transaction surface.
 * The engine (state, seeding, persistence) lives in `useOperatingCost`; this only
 * renders the trio so each surface stays consistent. Date is rendered by the caller.
 */
export function OperatingCostFields({
  days,
  setDays,
  ratePerDay,
  setRatePerDay,
  amount,
  fmt,
  dense,
  amountClassName,
}: {
  days: string;
  setDays: (v: string) => void;
  ratePerDay: string;
  setRatePerDay: (v: string) => void;
  amount: number;
  /** Currency formatter for the read-only total. */
  fmt: (n: number) => string;
  /** Compact sizing to match tighter dialogs. */
  dense?: boolean;
  amountClassName?: string;
}) {
  const h = dense ? "h-9 text-sm" : "";
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Days worked</Label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className={h}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Rate / day</Label>
          <MoneyInput
            placeholder="0"
            value={ratePerDay}
            onValueChange={setRatePerDay}
            className={cn("text-right", h)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Amount</Label>
        <div
          className={cn(
            "flex items-center justify-end rounded-md border bg-muted/40 px-3 font-semibold",
            dense ? "h-9 text-sm" : "h-10",
            amountClassName,
          )}
        >
          {fmt(amount)}
        </div>
      </div>
      <p className="-mt-1 text-[11px] text-muted-foreground">
        Days default from the production start date — edit to override the days counted.
      </p>
    </div>
  );
}
