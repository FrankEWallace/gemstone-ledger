import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload, Trash2, Download, FileText, FileImage,
  FileSpreadsheet, File, FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { useSite } from "@/hooks/useSite";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

import type { SiteDocument } from "@/lib/supabaseTypes";
import {
  getSiteDocuments,
  uploadDocument,
  getDocumentUrl,
  deleteSiteDocument,
} from "@/services/documents.service";

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORIES = ["Compliance", "Safety", "Contracts", "Permits", "Reports", "Training", "Other"];

const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fileIcon(mime: string | null) {
  if (!mime) return <File className="h-5 w-5 text-muted-foreground" />;
  if (mime.startsWith("image/")) return <FileImage className="h-5 w-5 text-blue-500" />;
  if (mime.includes("pdf")) return <FileText className="h-5 w-5 text-red-500" />;
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv"))
    return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />;
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { activeSiteId } = useSite();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [uploadCategory, setUploadCategory] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SiteDocument | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["site-documents", activeSiteId],
    queryFn: () => getSiteDocuments(activeSiteId!),
    enabled: !!activeSiteId,
  });

  const { mutate: doUpload, isPending: isUploading } = useMutation({
    mutationFn: (file: File) => uploadDocument(activeSiteId!, file, uploadCategory || undefined, user?.id),
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ["site-documents", activeSiteId] });
      toast.success(`"${doc.name}" uploaded.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: doDelete, isPending: isDeleting } = useMutation({
    mutationFn: (doc: SiteDocument) => deleteSiteDocument(doc),
    onMutate: async (doc) => {
      await queryClient.cancelQueries({ queryKey: ["site-documents", activeSiteId] });
      const prev = queryClient.getQueryData<SiteDocument[]>(["site-documents", activeSiteId]);
      queryClient.setQueryData<SiteDocument[]>(["site-documents", activeSiteId], (old) => old?.filter((d) => d.id !== doc.id) ?? []);
      setDeleteTarget(null);
      return { prev };
    },
    onError: (err: Error, _doc, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["site-documents", activeSiteId], ctx.prev);
      toast.error(err.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-documents", activeSiteId] });
      toast.success("Document deleted.");
    },
  });

  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const file = files[0];
    if (file.size > MAX_SIZE_BYTES) {
      toast.error(`File too large. Max ${MAX_SIZE_MB} MB.`);
      return;
    }
    doUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDownload(doc: SiteDocument) {
    setDownloadingId(doc.id);
    try {
      const url = await getDocumentUrl(doc.storage_path);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      a.click();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDownloadingId(null);
    }
  }

  const filtered = documents
    .filter((d) => categoryFilter === "all" || d.category === categoryFilter)
    .filter((d) => !search || d.name.toLowerCase().includes(search.toLowerCase()));

  const usedCategories = [...new Set(documents.map((d) => d.category).filter(Boolean))] as string[];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Documents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {documents.length} file{documents.length !== 1 ? "s" : ""} stored
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={uploadCategory} onValueChange={setUploadCategory}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Category…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No category</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="h-4 w-4 mr-1.5" />
            {isUploading ? "Uploading…" : "Upload File"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          "rounded-lg border-2 border-dashed p-6 flex flex-col items-center gap-2 transition-colors cursor-pointer",
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/20"
        )}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drop files here or <span className="text-primary font-medium">click to upload</span>
        </p>
        <p className="text-xs text-muted-foreground">Max {MAX_SIZE_MB} MB per file</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-xs">
          <Input
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-4"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {usedCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Document list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg border border-border animate-pulse bg-muted/30" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <FolderOpen className="h-12 w-12 mb-3 opacity-30" />
          <p className="font-medium">No documents yet</p>
          <p className="text-sm mt-1">Upload compliance, safety, and contract documents for this site.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
          {filtered.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
              <div className="shrink-0">{fileIcon(doc.mime_type)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{doc.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {doc.category && (
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">{doc.category}</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{formatBytes(doc.file_size)}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(doc.created_at), "MMM d, yyyy")}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDownload(doc)}
                  disabled={downloadingId === doc.id}
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(doc)}
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the file from storage. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && doDelete(deleteTarget)}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
