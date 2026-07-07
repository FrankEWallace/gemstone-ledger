import { describe, it, expect } from "vitest";
import {
  aggregateMonthlyTrend,
  aggregateCategoryBreakdown,
  aggregateReportSummary,
  aggregateProductionByDay,
  aggregateCustomerTotals,
  aggregateCustomerSummaries,
} from "./reports.aggregators";

describe("aggregateMonthlyTrend", () => {
  it("groups by month and sums income/expenses separately", () => {
    const rows = [
      { type: "income", unit_price: 100, quantity: 2, transaction_date: "2026-01-05" },
      { type: "expense", unit_price: 30, quantity: 1, transaction_date: "2026-01-10" },
      { type: "income", unit_price: 50, quantity: 1, transaction_date: "2026-02-01" },
      { type: "expense", unit_price: 20, quantity: 2, transaction_date: "2026-02-15" },
      { type: "income", unit_price: 10, quantity: 1, transaction_date: "2026-01-20" },
    ];
    expect(aggregateMonthlyTrend(rows)).toEqual([
      { month: "2026-01", income: 210, expenses: 30 },
      { month: "2026-02", income: 50, expenses: 40 },
    ]);
  });

  it("sorts months ascending regardless of input order", () => {
    const rows = [
      { type: "income", unit_price: 1, quantity: 1, transaction_date: "2026-03-01" },
      { type: "income", unit_price: 1, quantity: 1, transaction_date: "2026-01-01" },
      { type: "income", unit_price: 1, quantity: 1, transaction_date: "2026-02-01" },
    ];
    expect(aggregateMonthlyTrend(rows).map((m) => m.month)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
  });

  it("includes cancelled-status rows (no status filter — intentional quirk)", () => {
    // The row shape doesn't carry status at all here, which reflects that
    // the query never filters it out; this is a documentation case.
    const rows = [
      { type: "income", unit_price: 100, quantity: 1, transaction_date: "2026-01-01" },
    ];
    expect(aggregateMonthlyTrend(rows)).toEqual([
      { month: "2026-01", income: 100, expenses: 0 },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(aggregateMonthlyTrend([])).toEqual([]);
  });
});

describe("aggregateCategoryBreakdown", () => {
  it("groups by category and sorts descending by total", () => {
    const rows = [
      { category: "fuel", unit_price: 10, quantity: 2 },
      { category: "tools", unit_price: 100, quantity: 1 },
      { category: "fuel", unit_price: 5, quantity: 1 },
    ];
    expect(aggregateCategoryBreakdown(rows)).toEqual([
      { category: "tools", total: 100 },
      { category: "fuel", total: 25 },
    ]);
  });

  it("falls back to 'Uncategorised' (British spelling) for null category", () => {
    const rows = [{ category: null, unit_price: 10, quantity: 1 }];
    expect(aggregateCategoryBreakdown(rows)).toEqual([
      { category: "Uncategorised", total: 10 },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(aggregateCategoryBreakdown([])).toEqual([]);
  });
});

describe("aggregateReportSummary", () => {
  it("sums income/expenses and shift hours independently", () => {
    const txRows = [
      { type: "income", unit_price: 100, quantity: 2 },
      { type: "expense", unit_price: 40, quantity: 1 },
    ];
    const shiftRows = [{ hours_worked: 8 }, { hours_worked: 6 }];
    expect(aggregateReportSummary(txRows, shiftRows)).toEqual({
      totalIncome: 200,
      totalExpenses: 40,
      netRevenue: 160,
      transactionCount: 2,
      totalShiftsLogged: 2,
      totalHoursWorked: 14,
    });
  });

  it("treats null hours_worked as zero", () => {
    const shiftRows = [{ hours_worked: null }, { hours_worked: 5 }];
    expect(aggregateReportSummary([], shiftRows)).toEqual({
      totalIncome: 0,
      totalExpenses: 0,
      netRevenue: 0,
      transactionCount: 0,
      totalShiftsLogged: 2,
      totalHoursWorked: 5,
    });
  });

  it("returns zeroed summary for empty input", () => {
    expect(aggregateReportSummary([], [])).toEqual({
      totalIncome: 0,
      totalExpenses: 0,
      netRevenue: 0,
      transactionCount: 0,
      totalShiftsLogged: 0,
      totalHoursWorked: 0,
    });
  });
});

describe("aggregateProductionByDay", () => {
  it("groups by shift_date and sums hours/output, counts shifts", () => {
    const rows = [
      { shift_date: "2026-01-01", hours_worked: 8, output_metric: 10 },
      { shift_date: "2026-01-01", hours_worked: 6, output_metric: 5 },
      { shift_date: "2026-01-02", hours_worked: 4, output_metric: null },
    ];
    expect(aggregateProductionByDay(rows)).toEqual([
      { date: "2026-01-01", totalHours: 14, totalOutput: 15, shiftsLogged: 2 },
      { date: "2026-01-02", totalHours: 4, totalOutput: 0, shiftsLogged: 1 },
    ]);
  });

  it("sorts by date ascending", () => {
    const rows = [
      { shift_date: "2026-02-01", hours_worked: 1, output_metric: 1 },
      { shift_date: "2026-01-01", hours_worked: 1, output_metric: 1 },
    ];
    expect(aggregateProductionByDay(rows).map((r) => r.date)).toEqual([
      "2026-01-01",
      "2026-02-01",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(aggregateProductionByDay([])).toEqual([]);
  });
});

describe("aggregateCustomerTotals", () => {
  // Rows are assumed pre-filtered by the caller's query for
  // status <> 'cancelled' and customer_id is not null.

  it("groups by customer and sorts descending by total", () => {
    const rows = [
      { unit_price: 10, quantity: 2, customer_id: "a", customers: { name: "Alpha" } },
      { unit_price: 100, quantity: 1, customer_id: "b", customers: { name: "Beta" } },
      { unit_price: 5, quantity: 1, customer_id: "a", customers: { name: "Alpha" } },
    ];
    expect(aggregateCustomerTotals(rows)).toEqual([
      { customerId: "b", customerName: "Beta", total: 100 },
      { customerId: "a", customerName: "Alpha", total: 25 },
    ]);
  });

  it("falls back to 'Unknown' when the customer join is null", () => {
    const rows = [{ unit_price: 10, quantity: 1, customer_id: "a", customers: null }];
    expect(aggregateCustomerTotals(rows)).toEqual([
      { customerId: "a", customerName: "Unknown", total: 10 },
    ]);
  });

  it("rounds totals to 2dp", () => {
    const rows = [
      { unit_price: 0.1, quantity: 1, customer_id: "a", customers: { name: "Alpha" } },
      { unit_price: 0.2, quantity: 1, customer_id: "a", customers: { name: "Alpha" } },
    ];
    expect(aggregateCustomerTotals(rows)[0].total).toBe(0.3);
  });

  it("returns empty array for empty input", () => {
    expect(aggregateCustomerTotals([])).toEqual([]);
  });
});

describe("aggregateCustomerSummaries", () => {
  // Rows are assumed pre-filtered by the caller's query for
  // status <> 'cancelled' and customer_id is not null.

  it("splits income/expenses per customer and rounds to 2dp", () => {
    const rows = [
      {
        type: "income",
        unit_price: 100,
        quantity: 1,
        category: null,
        customer_id: "a",
        customers: { name: "Alpha", type: "external" },
        expense_categories: null,
      },
      {
        type: "expense",
        unit_price: 30,
        quantity: 1,
        category: "fuel",
        customer_id: "a",
        customers: { name: "Alpha", type: "external" },
        expense_categories: null,
      },
    ];
    const result = aggregateCustomerSummaries(rows);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      customerId: "a",
      customerName: "Alpha",
      customerType: "external",
      totalIncome: 100,
      totalExpenses: 30,
      netProfit: 70,
      transactionCount: 2,
    });
  });

  it("uses expense_categories.name over category, falling back to 'Uncategorized' (American spelling)", () => {
    const rows = [
      {
        type: "expense",
        unit_price: 10,
        quantity: 1,
        category: "raw-category",
        customer_id: "a",
        customers: { name: "Alpha", type: "external" },
        expense_categories: { name: "Named Category" },
      },
      {
        type: "expense",
        unit_price: 5,
        quantity: 1,
        category: "raw-category-2",
        customer_id: "b",
        customers: { name: "Beta", type: "internal" },
        expense_categories: null,
      },
      {
        type: "expense",
        unit_price: 5,
        quantity: 1,
        category: null,
        customer_id: "c",
        customers: { name: "Gamma", type: "external" },
        expense_categories: null,
      },
    ];
    const result = aggregateCustomerSummaries(rows);
    const alpha = result.find((r) => r.customerId === "a")!;
    const beta = result.find((r) => r.customerId === "b")!;
    const gamma = result.find((r) => r.customerId === "c")!;
    expect(alpha.expensesByCategory).toEqual([{ category: "Named Category", total: 10 }]);
    expect(beta.expensesByCategory).toEqual([{ category: "raw-category-2", total: 5 }]);
    expect(gamma.expensesByCategory).toEqual([{ category: "Uncategorized", total: 5 }]);
  });

  it("sorts expensesByCategory descending by total", () => {
    const rows = [
      {
        type: "expense",
        unit_price: 5,
        quantity: 1,
        category: "small",
        customer_id: "a",
        customers: { name: "Alpha", type: "external" },
        expense_categories: null,
      },
      {
        type: "expense",
        unit_price: 50,
        quantity: 1,
        category: "big",
        customer_id: "a",
        customers: { name: "Alpha", type: "external" },
        expense_categories: null,
      },
    ];
    const result = aggregateCustomerSummaries(rows);
    expect(result[0].expensesByCategory.map((c) => c.category)).toEqual(["big", "small"]);
  });

  it("falls back to 'Unknown' customer name and 'external' type when the join is null", () => {
    const rows = [
      {
        type: "income",
        unit_price: 10,
        quantity: 1,
        category: null,
        customer_id: "a",
        customers: null,
        expense_categories: null,
      },
    ];
    const result = aggregateCustomerSummaries(rows);
    expect(result[0].customerName).toBe("Unknown");
    expect(result[0].customerType).toBe("external");
  });

  it("returns empty array for empty input", () => {
    expect(aggregateCustomerSummaries([])).toEqual([]);
  });
});
