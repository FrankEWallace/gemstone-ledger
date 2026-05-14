import { useState } from "react";
import { format, parseISO, isValid } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}

function parseDate(s: string): Date | undefined {
  if (!s) return undefined;
  const d = parseISO(s);
  return isValid(d) ? d : undefined;
}

function toIso(d: Date | undefined): string {
  return d ? format(d, "yyyy-MM-dd") : "";
}

export default function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  className,
  placeholder = "Pick a date range",
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const fromDate = parseDate(from);
  const toDate   = parseDate(to);

  const range: DateRange = { from: fromDate, to: toDate };

  function handleSelect(r: DateRange | undefined) {
    onFromChange(toIso(r?.from));
    onToChange(toIso(r?.to));
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onFromChange("");
    onToChange("");
  }

  const hasRange = !!from || !!to;

  const label = hasRange
    ? [
        fromDate ? format(fromDate, "MMM d, yyyy") : "…",
        toDate   ? format(toDate,   "MMM d, yyyy") : "…",
      ].join(" — ")
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-left transition-colors hover:bg-muted/50",
            hasRange ? "text-foreground" : "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">{label}</span>
          {hasRange && (
            <X
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              onClick={handleClear}
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          onSelect={handleSelect}
          numberOfMonths={2}
          initialFocus
        />
        {hasRange && (
          <div className="flex justify-end border-t border-border px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => { onFromChange(""); onToChange(""); }}
            >
              Clear
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs ml-2"
              onClick={() => setOpen(false)}
            >
              Apply
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
