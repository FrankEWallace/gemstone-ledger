import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, differenceInCalendarDays, parseISO } from "date-fns";
import { getInventoryItems } from "@/services/inventory.service";
import { getTransactions } from "@/services/transactions.service";
import { getCustomerSummaries } from "@/services/reports.service";

export type SystemAlertLevel = "critical" | "warning" | "info";
export type SystemAlertCategory = "contracts" | "customers" | "financials" | "inventory";

export interface SystemAlert {
  id: string;
  level: SystemAlertLevel;
  category: SystemAlertCategory;
  message: string;
  href?: string;
}

const DISMISSED_KEY = "systemAlertsDismissed";

function readDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function useSystemAlerts(siteId: string | null) {
  const [dismissed, setDismissed] = useState<Set<string>>(readDismissed);

  // Use a stable date — recalculates only when siteId changes (mount)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const today = useMemo(() => new Date(), [siteId]);
  const thisMonthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const todayStr = format(today, "yyyy-MM-dd");

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", siteId],
    queryFn: () =>
      import("@/services/customers.service").then((m) => m.getCustomers(siteId!)),
    enabled: !!siteId,
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory", siteId],
    queryFn: () => getInventoryItems(siteId!),
    enabled: !!siteId,
  });

  const { data: customerSummaries = [] } = useQuery({
    queryKey: ["customer-summaries", siteId, thisMonthStart, todayStr],
    queryFn: () => getCustomerSummaries(siteId!, thisMonthStart, todayStr),
    enabled: !!siteId,
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["transactions", siteId, "all", "all", "all"],
    queryFn: () => getTransactions(siteId!),
    enabled: !!siteId,
  });

  const alerts = useMemo<SystemAlert[]>(() => {
    const result: SystemAlert[] = [];

    // 1. Contracts expiring within 14 days
    customers
      .filter((c) => c.status === "active" && c.contract_end)
      .forEach((c) => {
        const end = parseISO(c.contract_end!);
        const daysLeft = differenceInCalendarDays(end, today);
        if (daysLeft >= 0 && daysLeft <= 14) {
          result.push({
            id: `expiring-${c.id}`,
            level: daysLeft <= 3 ? "critical" : "warning",
            category: "contracts",
            message: `Contract expiring in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}: ${c.name}`,
            href: `/customers/${c.id}`,
          });
        }
      });

    // 2. Customers with negative profitability this month
    customerSummaries
      .filter((cs) => cs.netProfit < 0 && cs.transactionCount > 0)
      .forEach((cs) => {
        result.push({
          id: `negative-profit-${cs.customerId}`,
          level: "warning",
          category: "customers",
          message: `${cs.customerName} is unprofitable this month (net −$${Math.abs(Math.round(cs.netProfit)).toLocaleString()})`,
          href: `/customers/${cs.customerId}`,
        });
      });

    // 3. High expense ratio site-wide this month
    const monthTxs = txs.filter(
      (t) => t.transaction_date >= thisMonthStart && t.status === "success"
    );
    const monthIncome = monthTxs
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + t.unit_price * t.quantity, 0);
    const monthExpenses = monthTxs
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + t.unit_price * t.quantity, 0);
    if (monthIncome > 0 && monthExpenses / monthIncome > 0.85) {
      result.push({
        id: "high-expense-ratio",
        level: "warning",
        category: "financials",
        message: `High expense ratio this month: ${Math.round((monthExpenses / monthIncome) * 100)}% of income spent on expenses`,
        href: "/reports",
      });
    }

    // 4. Inventory below reorder level
    inventory
      .filter((item) => item.reorder_level != null && item.quantity <= item.reorder_level!)
      .forEach((item) => {
        result.push({
          id: `low-stock-${item.id}`,
          level: item.quantity === 0 ? "critical" : "info",
          category: "inventory",
          message: `Low stock: ${item.name} — ${item.quantity} ${item.unit ?? "units"} remaining (reorder at ${item.reorder_level})`,
          href: "/inventory",
        });
      });

    return result;
  }, [customers, inventory, customerSummaries, txs, today, thisMonthStart]);

  const visibleAlerts = useMemo(
    () => alerts.filter((a) => !dismissed.has(a.id)),
    [alerts, dismissed]
  );

  const dismiss = (id: string) => {
    setDismissed((prev) => {
      const next = new Set([...prev, id]);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const dismissAll = () => {
    setDismissed((prev) => {
      const next = new Set([...prev, ...alerts.map((a) => a.id)]);
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  return {
    alerts: visibleAlerts,
    totalCount: visibleAlerts.length,
    criticalCount: visibleAlerts.filter((a) => a.level === "critical").length,
    dismiss,
    dismissAll,
  };
}
