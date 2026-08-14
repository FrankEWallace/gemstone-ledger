import { useCallback, useEffect, useState } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { updateCustomer } from "@/services/customers.service";

/** A category is "operating cost" (days × daily rate) when its name mentions
 *  operating. Shared by every add-transaction surface so the behaviour matches. */
export function isOperatingCategory(name?: string | null): boolean {
  return !!name && /operating/i.test(name);
}

/** Default description for an operating-cost line, e.g. "Operating cost — 40 days". */
export function operatingLabel(days: number): string {
  return `Operating cost — ${days} day${days === 1 ? "" : "s"}`;
}

/**
 * Shared engine for the "operating cost = days × daily rate" input used across
 * every add-transaction surface (capture pad, customer detail, activity, main form).
 *
 * Owns the days/rate fields and their live total, seeds the rate from the customer
 * and the day count from the production start date (both stay editable — the day
 * field is the admin override), and persists the rate back to the customer on save.
 */
export function useOperatingCost(opts: {
  /** Category is operating AND the entry is an expense. */
  active: boolean;
  /** Form/drawer is open — gates the seeding effect. */
  open: boolean;
  dailyRate?: number | null;
  contractStart?: string | null;
}) {
  const { active, open, dailyRate, contractStart } = opts;
  const [days, setDays] = useState("");
  const [ratePerDay, setRatePerDay] = useState("");

  const daysNum = Number(days) || 0;
  const rateNum = Number(ratePerDay) || 0;
  const amount = daysNum * rateNum;

  // Seed rate from the customer and default days from production start → today.
  // Only fills empty fields, so it never clobbers what the operator typed.
  useEffect(() => {
    if (!open || !active) return;
    if (ratePerDay === "" && dailyRate != null) setRatePerDay(String(dailyRate));
    if (days === "" && contractStart) {
      const elapsed = differenceInCalendarDays(new Date(), parseISO(contractStart)) + 1;
      if (elapsed > 0) setDays(String(elapsed));
    }
  }, [open, active, dailyRate, contractStart, ratePerDay, days]);

  const reset = useCallback(() => {
    setDays("");
    setRatePerDay("");
  }, []);

  /** Persist the entered rate onto the customer so it prefills next time.
   *  Best-effort — a failure here must not block the already-saved expense. */
  async function rememberRate(customerId?: string | null) {
    if (!customerId || rateNum <= 0 || Number(dailyRate ?? 0) === rateNum) return;
    try {
      await updateCustomer(customerId, { daily_rate: rateNum });
    } catch {
      /* non-fatal */
    }
  }

  return { days, setDays, ratePerDay, setRatePerDay, daysNum, rateNum, amount, reset, rememberRate };
}
