import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

export const DEFAULT_FROM = format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd");
export const DEFAULT_TO   = format(endOfMonth(new Date()), "yyyy-MM-dd");

export function useReportDateRange() {
  const [searchParams, setSearchParams] = useSearchParams();

  const dateFrom = searchParams.get("from") ?? DEFAULT_FROM;
  const dateTo   = searchParams.get("to")   ?? DEFAULT_TO;

  const setDateFrom = useCallback((val: string) => {
    setSearchParams((prev) => { prev.set("from", val); return prev; }, { replace: true });
  }, [setSearchParams]);

  const setDateTo = useCallback((val: string) => {
    setSearchParams((prev) => { prev.set("to", val); return prev; }, { replace: true });
  }, [setSearchParams]);

  return { dateFrom, dateTo, setDateFrom, setDateTo };
}
