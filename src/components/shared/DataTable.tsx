import { useState, useMemo } from "react";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
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

export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  /** Custom cell renderer. Receives the raw value at `key` and the full row. */
  render?: (value: unknown, row: T) => React.ReactNode;
}

interface DataTableProps<T extends Record<string, unknown>> {
  data: T[];
  columns: DataTableColumn<T>[];
  /** Field used as the React key for each row. */
  keyField: keyof T;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Fields searched by the global search input. */
  searchKeys?: string[];
  pageSize?: number;
  isLoading?: boolean;
  emptyMessage?: string;
  /**
   * Slot rendered to the right of the search box.
   * Use for filter dropdowns, "Add" buttons, CSV export, etc.
   */
  toolbar?: React.ReactNode;
}

type SortDir = "asc" | "desc" | null;

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

  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col)
      return <ChevronsUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground/50" />;
    return sortDir === "asc" ? (
      <ChevronUp className="ml-1 h-3.5 w-3.5" />
    ) : (
      <ChevronDown className="ml-1 h-3.5 w-3.5" />
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      {(searchable || toolbar) && (
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
          {searchable && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8"
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
      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.sortable ? (
                    <button
                      onClick={() => toggleSort(col.key)}
                      className="flex items-center font-medium hover:text-foreground transition-colors"
                    >
                      {col.header}
                      <SortIcon col={col.key} />
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : slice.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              slice.map((row) => (
                <TableRow key={String(row[keyField])} className="transition-transform duration-150 hover:translate-x-0.5">
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
        <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
          <span>
            {filtered.length === data.length
              ? `${filtered.length} record${filtered.length !== 1 ? "s" : ""}`
              : `${filtered.length} of ${data.length} records`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 tabular-nums">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
