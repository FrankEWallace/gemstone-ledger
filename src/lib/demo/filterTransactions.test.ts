import { describe, it, expect } from "vitest";
import { filterDemoTransactions, demoCategoryBreakdown } from "./filterTransactions";
import type { Transaction } from "@/lib/supabaseTypes";

const tx = (id: string, date: string, extra: Partial<Transaction> = {}): Transaction =>
  ({
    id,
    transaction_date: date,
    type: "income",
    status: "success",
    category: "Sales",
    customer_id: null,
    expense_category_id: null,
    phase_id: null,
    source: null,
    ...extra,
  }) as Transaction;

const rows = [
  tx("a", "2026-09-01"),
  tx("b", "2026-09-15", { type: "expense", category: "Fuel" }),
  tx("c", "2026-08-20", { customer_id: "cust-1" }),
  tx("d", "2026-07-01", { status: "pending" }),
];

describe("filterDemoTransactions", () => {
  it("applies an inclusive date range", () => {
    const ids = filterDemoTransactions(rows, { dateFrom: "2026-08-20", dateTo: "2026-09-01" }).map((t) => t.id);
    expect(ids).toEqual(["a", "c"]);
  });

  it("returns newest first, like the real query", () => {
    expect(filterDemoTransactions(rows).map((t) => t.id)).toEqual(["b", "a", "c", "d"]);
  });

  it("treats 'all' and missing filters as no filter", () => {
    expect(filterDemoTransactions(rows, { type: "all", status: "all" })).toHaveLength(4);
  });

  it("filters by type, status, category and customer", () => {
    expect(filterDemoTransactions(rows, { type: "expense" }).map((t) => t.id)).toEqual(["b"]);
    expect(filterDemoTransactions(rows, { status: "pending" }).map((t) => t.id)).toEqual(["d"]);
    expect(filterDemoTransactions(rows, { category: "Fuel" }).map((t) => t.id)).toEqual(["b"]);
    expect(filterDemoTransactions(rows, { customerId: "cust-1" }).map((t) => t.id)).toEqual(["c"]);
  });

  it("paginates with limit and offset", () => {
    expect(filterDemoTransactions(rows, { limit: 2, offset: 1 }).map((t) => t.id)).toEqual(["a", "c"]);
  });
});

describe("demoCategoryBreakdown", () => {
  const data = [
    tx("1", "2026-09-10", { type: "expense", category: "Fuel", quantity: 2, unit_price: 50 }),
    tx("2", "2026-09-11", { type: "expense", category: "Fuel", quantity: 1, unit_price: 20, status: "cancelled" }),
    tx("3", "2026-09-12", { type: "expense", category: null, quantity: 1, unit_price: 500 }),
    tx("4", "2026-09-12", { type: "income", category: "Sales", quantity: 1, unit_price: 999 }),
    tx("5", "2026-08-01", { type: "expense", category: "Fuel", quantity: 1, unit_price: 999 }),
  ];

  it("sums by category within the range, including every status", () => {
    expect(demoCategoryBreakdown(data, "expense", "2026-09-01", "2026-09-30")).toEqual([
      { category: "Uncategorised", total: 500 },
      { category: "Fuel", total: 120 },
    ]);
  });

  it("returns nothing for a day with no transactions", () => {
    expect(demoCategoryBreakdown(data, "expense", "2026-09-20", "2026-09-20")).toEqual([]);
  });
});
