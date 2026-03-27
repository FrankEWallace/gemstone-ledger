import { useRef, useState } from "react";
import Papa from "papaparse";
import { Upload, AlertCircle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface CsvColumn<T> {
  /** CSV header name (case-insensitive match) */
  header: string;
  /** Key to map to in the output object */
  key: keyof T;
  required?: boolean;
  /** Transform raw string value before storing */
  transform?: (raw: string) => unknown;
}

interface CsvImportModalProps<T> {
  open: boolean;
  onClose: () => void;
  /** Human-readable entity name, e.g. "Inventory Items" */
  entityName: string;
  columns: CsvColumn<T>[];
  /** Called with validated rows; should return a Promise */
  onImport: (rows: T[]) => Promise<void>;
  /** Example CSV row shown to user */
  exampleRow?: string;
  templateHeaders?: string;
}

interface ParsedRow<T> {
  index: number;
  data: Partial<T>;
  errors: string[];
}

function downloadTemplate(headers: string, entityName: string) {
  const blob = new Blob([headers + "\n"], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${entityName.toLowerCase().replace(/\s+/g, "-")}-template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CsvImportModal<T extends Record<string, unknown>>({
  open,
  onClose,
  entityName,
  columns,
  onImport,
  exampleRow,
  templateHeaders,
}: CsvImportModalProps<T>) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow<T>[]>([]);
  const [isParsed, setIsParsed] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorRows = rows.filter((r) => r.errors.length > 0);

  function reset() {
    setFileName(null);
    setRows([]);
    setIsParsed(false);
    setIsImporting(false);
    setImportDone(false);
    setImportError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  function parseFile(file: File) {
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        const parsed: ParsedRow<T>[] = data.map((rawRow, i) => {
          const errors: string[] = [];
          const obj: Partial<T> = {};

          // Normalize header keys for case-insensitive lookup
          const normalizedRaw: Record<string, string> = {};
          for (const [k, v] of Object.entries(rawRow)) {
            normalizedRaw[k.trim().toLowerCase()] = v?.trim() ?? "";
          }

          for (const col of columns) {
            const raw = normalizedRaw[col.header.toLowerCase()] ?? "";
            if (col.required && !raw) {
              errors.push(`"${col.header}" is required`);
              continue;
            }
            try {
              (obj as Record<string, unknown>)[col.key as string] = col.transform
                ? col.transform(raw)
                : raw || undefined;
            } catch {
              errors.push(`"${col.header}" has an invalid value: "${raw}"`);
            }
          }

          return { index: i + 1, data: obj, errors };
        });

        setRows(parsed);
        setIsParsed(true);
      },
      error: (err) => {
        setImportError(`Failed to parse CSV: ${err.message}`);
        setIsParsed(true);
      },
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".csv")) parseFile(file);
  }

  async function handleImport() {
    if (!validRows.length) return;
    setIsImporting(true);
    setImportError(null);
    try {
      await onImport(validRows.map((r) => r.data as T));
      setImportDone(true);
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import {entityName} from CSV</DialogTitle>
        </DialogHeader>

        {importDone ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <p className="font-semibold text-lg">Import complete</p>
            <p className="text-sm text-muted-foreground">
              {validRows.length} {entityName.toLowerCase()} imported successfully.
            </p>
            <Button onClick={handleClose} className="mt-2">Done</Button>
          </div>
        ) : !isParsed ? (
          // ── Drop zone ──────────────────────────────────────────────────────
          <div className="space-y-4">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/30"
              )}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">Drop a CSV file here, or click to browse</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Required columns: {columns.filter((c) => c.required).map((c) => c.header).join(", ")}
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {(templateHeaders || exampleRow) && (
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                {templateHeaders && (
                  <p><span className="font-medium text-foreground">Headers:</span> {templateHeaders}</p>
                )}
                {exampleRow && (
                  <p><span className="font-medium text-foreground">Example:</span> {exampleRow}</p>
                )}
              </div>
            )}

            {templateHeaders && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadTemplate(templateHeaders, entityName)}
              >
                Download Template CSV
              </Button>
            )}
          </div>
        ) : (
          // ── Preview ────────────────────────────────────────────────────────
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{fileName}</span> —{" "}
                <span className="text-emerald-600 font-medium">{validRows.length} valid</span>
                {errorRows.length > 0 && (
                  <span className="text-destructive font-medium"> · {errorRows.length} errors</span>
                )}
              </p>
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="h-4 w-4 mr-1" /> Change file
              </Button>
            </div>

            {/* Error rows */}
            {errorRows.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1 max-h-36 overflow-y-auto">
                {errorRows.map((r) => (
                  <div key={r.index} className="flex gap-2 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>Row {r.index}: {r.errors.join("; ")}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Valid rows preview */}
            {validRows.length > 0 && (
              <div className="rounded-lg border border-border overflow-auto max-h-64">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 sticky top-0">
                    <tr>
                      {columns.map((c) => (
                        <th key={c.header} className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">
                          {c.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.slice(0, 50).map((r) => (
                      <tr key={r.index} className="border-t border-border">
                        {columns.map((c) => (
                          <td key={c.header} className="px-3 py-1.5 text-foreground max-w-[180px] truncate">
                            {String((r.data as Record<string, unknown>)[c.key as string] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validRows.length > 50 && (
                  <p className="text-xs text-muted-foreground px-3 py-2 border-t border-border">
                    Showing first 50 of {validRows.length} rows.
                  </p>
                )}
              </div>
            )}

            {importError && (
              <p className="text-xs text-destructive flex gap-1.5 items-center">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {importError}
              </p>
            )}
          </div>
        )}

        {isParsed && !importDone && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isImporting}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={validRows.length === 0 || isImporting}
            >
              {isImporting
                ? "Importing…"
                : `Import ${validRows.length} Row${validRows.length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
