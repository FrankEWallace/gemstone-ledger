import { describe, it, expect } from "vitest";
import { bucketSeries, type SparkRow } from "./sparkline";

const row = (date: string, type: string, amount: number, status = "success"): SparkRow => ({
  transaction_date: date,
  type,
  status,
  quantity: 1,
  unit_price: amount,
});

describe("bucketSeries", () => {
  it("puts each day of a 7-day window in its own bucket", () => {
    const s = bucketSeries(
      [row("2026-09-01", "income", 100), row("2026-09-07", "income", 50), row("2026-09-04", "expense", 30)],
      "2026-09-01",
      7,
      7,
    );
    expect(s.revenue).toEqual([100, 0, 0, 0, 0, 0, 50]);
    expect(s.expenses).toEqual([0, 0, 0, 30, 0, 0, 0]);
    expect(s.net).toEqual([100, 0, 0, -30, 0, 0, 50]);
  });

  it("groups a 30-day window into equal slices", () => {
    const s = bucketSeries(
      [row("2026-09-01", "income", 10), row("2026-09-05", "income", 10), row("2026-09-30", "income", 10)],
      "2026-09-01",
      30,
      6,
    );
    expect(s.revenue).toEqual([20, 0, 0, 0, 0, 10]);
  });

  it("ignores rows outside the window and non-success rows", () => {
    const s = bucketSeries(
      [
        row("2026-08-31", "income", 999),
        row("2026-09-08", "income", 999),
        row("2026-09-02", "income", 999, "pending"),
        row("2026-09-02", "income", 5),
      ],
      "2026-09-01",
      7,
      7,
    );
    expect(s.revenue).toEqual([0, 5, 0, 0, 0, 0, 0]);
  });
});
