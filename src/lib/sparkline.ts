import { differenceInCalendarDays, parseISO } from "date-fns";

export interface SparkRow {
  transaction_date: string;
  type: string;
  status: string;
  quantity: number;
  unit_price: number;
}

export interface SparkSeries {
  revenue: number[];
  expenses: number[];
  net: number[];
}

/**
 * Split `days` days starting at `from` (yyyy-MM-dd) into `buckets` equal slices
 * and total successful income/expense per slice. Rows outside the window are ignored.
 */
export function bucketSeries(rows: SparkRow[], from: string, days: number, buckets: number): SparkSeries {
  const revenue = new Array<number>(buckets).fill(0);
  const expenses = new Array<number>(buckets).fill(0);
  const start = parseISO(from);

  for (const r of rows) {
    if (r.status !== "success") continue;
    const offset = differenceInCalendarDays(parseISO(r.transaction_date), start);
    if (offset < 0 || offset >= days) continue;
    const i = Math.min(buckets - 1, Math.floor((offset * buckets) / days));
    const amount = r.quantity * r.unit_price;
    if (r.type === "income") revenue[i] += amount;
    else if (r.type === "expense") expenses[i] += amount;
  }

  return { revenue, expenses, net: revenue.map((v, i) => v - expenses[i]) };
}
