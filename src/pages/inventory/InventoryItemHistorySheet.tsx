import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ArrowDownCircle, ArrowUpCircle, PackageMinus, SlidersHorizontal } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getInventoryMovements, type InventoryMovementRow } from "@/services/inventory.service";
import { fmtCurrency, fmtCompactNum } from "@/lib/formatCurrency";
import type { InventoryItem } from "@/lib/supabaseTypes";

// ─── Movement row styling ───────────────────────────────────────────────────

const MOVEMENT_META: Record<InventoryMovementRow["type"], {
  icon: React.ElementType; color: string; label: string;
}> = {
  receive:   { icon: ArrowUpCircle,      color: "var(--chart-income)",  label: "Received" },
  use:       { icon: ArrowDownCircle,    color: "var(--chart-expense)", label: "Used" },
  write_off: { icon: PackageMinus,       color: "var(--destructive)",   label: "Written off" },
  adjustment:{ icon: SlidersHorizontal,  color: "var(--muted-foreground)", label: "Adjusted" },
};

function MovementRow({ movement, unit }: { movement: InventoryMovementRow; unit: string }) {
  const meta = MOVEMENT_META[movement.type];
  const Icon = meta.icon;
  const isPositive = movement.quantity > 0;

  return (
    <div className="flex items-start gap-3 py-3">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `color-mix(in oklch, ${meta.color} 15%, transparent)` }}
      >
        <Icon className="h-4 w-4" style={{ color: meta.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{meta.label}</p>
          <p className="text-sm font-semibold tabular-nums" style={{ color: meta.color }}>
            {isPositive ? "+" : ""}{fmtCompactNum(movement.quantity)} {unit}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground truncate">
            {format(parseISO(movement.createdAt), "d MMM yyyy")}
            {movement.customerName && ` · ${movement.customerName}`}
            {movement.notes && ` · ${movement.notes}`}
          </p>
          <p className="text-xs text-muted-foreground shrink-0 tabular-nums">
            → {fmtCompactNum(movement.quantityAfter)} {unit}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Sheet ──────────────────────────────────────────────────────────────────

export default function InventoryItemHistorySheet({
  open, onClose, item, siteId,
}: {
  open: boolean;
  onClose: () => void;
  item: InventoryItem;
  siteId: string;
}) {
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["inventory-movements", siteId, item.id],
    queryFn: () => getInventoryMovements(siteId, item.id, item.quantity),
    enabled: open,
  });

  const unit = item.unit ?? "units";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{item.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-3 rounded-xl border border-border bg-card divide-x divide-border">
          <div className="p-3 flex flex-col gap-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">Current Stock</p>
            <p className="font-display text-lg font-medium tabular-nums truncate">
              {fmtCompactNum(item.quantity)} {unit}
            </p>
          </div>
          <div className="p-3 flex flex-col gap-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">Unit Cost</p>
            <p className="font-display text-lg font-medium tabular-nums truncate">
              {item.unit_cost != null ? fmtCurrency(item.unit_cost, 2) : "—"}
            </p>
          </div>
          <div className="p-3 flex flex-col gap-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">Reorder At</p>
            <p className="font-display text-lg font-medium tabular-nums truncate">
              {item.reorder_level ?? "—"}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-1">
            History
          </p>

          {isLoading ? (
            <div className="space-y-3 mt-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)}
            </div>
          ) : movements.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">
              No movements recorded yet. Receiving, using, or writing off stock for this item will show up here going forward.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {movements.map((m) => (
                <MovementRow key={m.id} movement={m} unit={unit} />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
