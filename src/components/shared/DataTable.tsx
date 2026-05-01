import { useState, useMemo } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Inbox,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render?: (value: unknown, row: T) => React.ReactNode;
}

interface DataTableProps<T extends Record<string, unknown>> {
  data: T[];
  columns: DataTableColumn<T>[];
  keyField: keyof T;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: string[];
  pageSize?: number;
  isLoading?: boolean;
  emptyMessage?: string;
  toolbar?: React.ReactNode;
}

type SortDir = "asc" | "desc" | null;

// Skeleton widths cycle for visual variety
const SKELETON_WIDTHS = ["w-24", "w-32", "w-20", "w-28", "w-16", "w-36"];

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  keyField,
  searchable = true,
  searchPlaceholder = "Search…",
  searchKeys = [],
  pageSize = 10,
  isLoading = false,
  emptyMessage = "No records found.",
  toolbar,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let rows = data;

    if (search.trim() && searchKeys.length > 0) {
      const q = search.toLowerCase();
      rows = rows.filter((row) =>
        searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(q))
      );
    }

    if (sortKey && sortDir) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortKey] ?? "";
        const bv = b[sortKey] ?? "";
        const cmp = String(av).localeCompare(String(bv), undefined, {
          numeric: true,
          sensitivity: "base",
        });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return rows;
  }, [data, search, searchKeys, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, filtered.length);

  function toggleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
      setSortDir(null);
    }
    setPage(1);
  }

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function SortButton({ col }: { col: string }) {
    const isActive = sortKey === col;
    return (
      <button
        onClick={() => toggleSort(col)}
        className={cn(
          "group/sort inline-flex items-center gap-1 transition-colors",
          isActive ? "text-foreground" : "hover:text-foreground"
        )}
      >
        <span>{columns.find((c) => c.key === col)?.header}</span>
        <span className={cn(
          "transition-opacity",
          isActive ? "opacity-100" : "opacity-0 group-hover/sort:opacity-40"
        )}>
          {isActive && sortDir === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : isActive && sortDir === "desc" ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronsUpDown className="h-3 w-3" />
          )}
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      {(searchable || toolbar) && (
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
          {searchable && (
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8 h-8 text-sm bg-background"
              />
            </div>
          )}
          {toolbar && (
            <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
              {toolbar}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20 hover:bg-muted/20 border-b border-border">
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.sortable ? (
                    <SortButton col={col.key} />
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              Array.from({ length: pageSize > 8 ? 6 : pageSize }).map((_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  {columns.map((col, ci) => (
                    <TableCell key={col.key}>
                      <Skeleton
                        className={cn(
                          "h-3.5 rounded",
                          SKELETON_WIDTHS[(i + ci) % SKELETON_WIDTHS.length]
                        )}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : slice.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length}>
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                    <Inbox className="h-8 w-8 opacity-30" />
                    <p className="text-sm font-medium">{emptyMessage}</p>
                    {search && (
                      <p className="text-xs opacity-60">
                        No results for &ldquo;{search}&rdquo;
                      </p>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              slice.map((row) => (
                <TableRow key={String(row[keyField])}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.render
                        ? col.render(row[col.key], row)
                        : String(row[col.key] ?? "—")}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination footer */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
          <span className="tabular-nums">
            {filtered.length < data.length ? (
              <>
                <span className="text-foreground font-medium">{rangeStart}–{rangeEnd}</span>
                {" of "}
                <span className="text-foreground font-medium">{filtered.length}</span>
                {" filtered · "}
                {data.length} total
              </>
            ) : (
              <>
                Showing{" "}
                <span className="text-foreground font-medium">{rangeStart}–{rangeEnd}</span>
                {" of "}
                <span className="text-foreground font-medium">{filtered.length}</span>
                {" record"}{filtered.length !== 1 ? "s" : ""}
              </>
            )}
          </span>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(1)}
              disabled={safePage <= 1}
              aria-label="First page"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 tabular-nums text-xs font-medium text-foreground">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage(totalPages)}
              disabled={safePage >= totalPages}
              aria-label="Last page"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
