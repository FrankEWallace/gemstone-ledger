import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import DateRangePicker from "@/components/shared/DateRangePicker";
import type { TransactionType, TransactionStatus } from "@/lib/supabaseTypes";
import type { Customer } from "@/lib/supabaseTypes";

const TYPES: TransactionType[]   = ["income", "expense", "refund"];
const STATUSES: TransactionStatus[] = ["success", "pending", "refunded", "cancelled"];

export interface TransactionFilters {
  typeFilter:     TransactionType | "all";
  statusFilter:   TransactionStatus | "all";
  categoryFilter: string;
  customerFilter: string;
  dateFrom:       string;
  dateTo:         string;
}

interface Props {
  filters: TransactionFilters;
  onChange: (f: Partial<TransactionFilters>) => void;
  categories: string[];
  customers: Customer[];
}

function activeCount(f: TransactionFilters): number {
  let n = 0;
  if (f.typeFilter     !== "all") n++;
  if (f.statusFilter   !== "all") n++;
  if (f.categoryFilter !== "all") n++;
  if (f.customerFilter !== "all") n++;
  if (f.dateFrom || f.dateTo)     n++;
  return n;
}

export default function TransactionFiltersPopover({
  filters,
  onChange,
  categories,
  customers,
}: Props) {
  const count = activeCount(filters);

  function clearAll() {
    onChange({
      typeFilter:     "all",
      statusFilter:   "all",
      categoryFilter: "all",
      customerFilter: "all",
      dateFrom:       "",
      dateTo:         "",
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {count > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold h-4 min-w-4 px-1 leading-none">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Filters</p>
          {count > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" /> Clear all
            </button>
          )}
        </div>

        {/* Date range */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Date range</Label>
          <DateRangePicker
            from={filters.dateFrom}
            to={filters.dateTo}
            onFromChange={(v) => onChange({ dateFrom: v })}
            onToChange={(v) => onChange({ dateTo: v })}
            className="w-full"
            placeholder="Any date"
          />
        </div>

        {/* Type */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Type</Label>
          <Select
            value={filters.typeFilter}
            onValueChange={(v) => onChange({ typeFilter: v as TransactionType | "all" })}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Status</Label>
          <Select
            value={filters.statusFilter}
            onValueChange={(v) => onChange({ statusFilter: v as TransactionStatus | "all" })}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
        {categories.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Category</Label>
            <Select
              value={filters.categoryFilter}
              onValueChange={(v) => onChange({ categoryFilter: v })}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Customer */}
        {customers.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Customer</Label>
            <Select
              value={filters.customerFilter}
              onValueChange={(v) => onChange({ customerFilter: v })}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="All customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All customers</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
