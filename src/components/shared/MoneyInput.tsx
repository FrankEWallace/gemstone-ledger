import * as React from "react";
import { Input } from "@/components/ui/input";

/**
 * Live thousands-grouping for amount fields.
 *
 * `type="number"` inputs can't show grouping separators, so these helpers back a
 * plain text input: the integer part is grouped with commas as the user types
 * (6000 → "6,000") while the raw, comma-free string is what gets stored.
 */

/** Format a raw numeric string for display — groups the integer part, keeps a
 *  trailing/partial decimal the user is mid-typing. */
export function groupThousands(raw: string): string {
  if (raw == null || raw === "") return "";
  const negative = String(raw).trim().startsWith("-");
  // Keep digits and dots only, then collapse to a single decimal point.
  let s = String(raw).replace(/[^\d.]/g, "");
  const firstDot = s.indexOf(".");
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "");
  }
  if (s === "" || s === ".") return negative ? "-" + s : s;
  const [rawInt, decPart] = s.split(".");
  // Drop leading zeros ("06000" → "6000") but keep a lone "0".
  const intPart = (rawInt || "").replace(/^0+(?=\d)/, "");
  const groupedInt = (intPart || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const out = s.includes(".") ? `${groupedInt}.${decPart ?? ""}` : groupedInt;
  return (negative ? "-" : "") + out;
}

/** Strip grouping separators, leaving a clean numeric string for storage. */
export function stripGroups(display: string): string {
  return display.replace(/,/g, "");
}

type MoneyInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type" | "inputMode"
> & {
  value: string | number | null | undefined;
  /** Receives the raw, comma-free numeric string. */
  onValueChange: (raw: string) => void;
};

/** Amount input that shows thousands separators while typing but reports the
 *  raw numeric string. Drop-in for money fields backed by string or number state. */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onValueChange, ...props }, ref) => {
    const raw = value == null ? "" : String(value);
    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        value={groupThousands(raw)}
        onChange={(e) => onValueChange(stripGroups(e.target.value))}
      />
    );
  },
);
MoneyInput.displayName = "MoneyInput";
