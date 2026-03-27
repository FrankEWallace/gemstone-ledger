import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  FileText,
} from "lucide-react";
import { useSite } from "@/hooks/useSite";
import { supabase } from "@/lib/supabase";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AuditLog } from "@/lib/supabaseTypes";

// ─── Service ─────────────────────────────────────────────────────────────────

const ENTITY_TYPES = [
  "inventory_item",
  "transaction",
  "equipment",
  "safety_incident",
  "order",
  "worker",
];

async function getAuditLogs(
  siteId: string,
  entityType: string | "all",
  action: string | "all",
  limit: number
): Promise<AuditLog[]> {
  let q = supabase
    .from("audit_logs")
    .select("*")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (entityType !== "all") q = q.eq("entity_type", entityType);
  if (action !== "all")     q = q.eq("action", action);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AuditLog[];
}

async function getActorName(actorId: string | null): Promise<string> {
  if (!actorId) return "System";
  const { data } = await supabase
    .from("user_profiles")
    .select("full_name")
    .eq("id", actorId)
    .single();
  return data?.full_name ?? actorId.slice(0, 8) + "…";
}

// ─── Diff viewer ─────────────────────────────────────────────────────────────

function DiffRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);

  const changed = log.action === "update" && log.old_data && log.new_data
    ? Object.keys(log.new_data).filter(
        (k) => JSON.stringify(log.old_data![k]) !== JSON.stringify(log.new_data![k])
          && !["updated_at"].includes(k)
      )
    : [];

  return (
    <div>
      {log.action === "update" && changed.length > 0 && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mt-0.5"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {changed.length} field{changed.length !== 1 ? "s" : ""} changed
        </button>
      )}
      {expanded && (
        <div className="mt-1.5 rounded-lg bg-muted/40 p-2 space-y-1 text-xs font-mono">
          {changed.map((k) => (
            <div key={k}>
              <span className="text-muted-foreground">{k}: </span>
              <span className="line-through text-red-500">{JSON.stringify(log.old_data![k])}</span>
              <span className="text-muted-foreground"> → </span>
              <span className="text-emerald-600">{JSON.stringify(log.new_data![k])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ACTION_ICON: Record<string, React.ReactNode> = {
  create: <Plus className="h-3.5 w-3.5 text-emerald-500" />,
  update: <Pencil className="h-3.5 w-3.5 text-blue-500" />,
  delete: <Trash2 className="h-3.5 w-3.5 text-red-500" />,
};

const ACTION_COLOR: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  update: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  delete: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function AuditLogPage() {
  const { activeSiteId } = useSite();
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [limit, setLimit] = useState(100);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", activeSiteId, entityFilter, actionFilter, limit],
    queryFn: () => getAuditLogs(activeSiteId!, entityFilter, actionFilter, limit),
    enabled: !!activeSiteId,
  });

  // Fetch actor names for visible logs
  const { data: actorNames = {} } = useQuery({
    queryKey: ["audit-actors", logs.map((l) => l.actor_id).join(",")],
    queryFn: async () => {
      const ids = [...new Set(logs.map((l) => l.actor_id).filter(Boolean))];
      const names: Record<string, string> = {};
      await Promise.all(ids.map(async (id) => {
        names[id!] = await getActorName(id);
      }));
      return names;
    },
    enabled: logs.length > 0,
  });

  const columns: DataTableColumn<AuditLog>[] = [
    {
      key: "created_at",
      header: "Time",
      sortable: true,
      render: (val) => (
        <span className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">
          {format(new Date(String(val)), "MMM d, HH:mm:ss")}
        </span>
      ),
    },
    {
      key: "actor_id",
      header: "User",
      render: (val) => (
        <span className="text-xs font-medium">
          {val ? (actorNames[String(val)] ?? String(val).slice(0, 8) + "…") : "System"}
        </span>
      ),
    },
    {
      key: "action",
      header: "Action",
      sortable: true,
      render: (val) => (
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize", ACTION_COLOR[String(val)])}>
          {ACTION_ICON[String(val)]}
          {String(val)}
        </span>
      ),
    },
    {
      key: "entity_type",
      header: "Entity",
      sortable: true,
      render: (val) => (
        <span className="text-xs capitalize">{String(val).replace(/_/g, " ")}</span>
      ),
    },
    {
      key: "new_data",
      header: "Details",
      render: (_, row) => {
        const displayName =
          (row.new_data as Record<string, unknown> | null)?.name ??
          (row.new_data as Record<string, unknown> | null)?.title ??
          (row.new_data as Record<string, unknown> | null)?.description ??
          (row.old_data as Record<string, unknown> | null)?.name ??
          (row.old_data as Record<string, unknown> | null)?.title ??
          row.entity_id?.toString().slice(0, 8) + "…";

        return (
          <div>
            <p className="text-xs text-muted-foreground truncate max-w-xs">{String(displayName ?? "—")}</p>
            <DiffRow log={row} />
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {logs.length} event{logs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          Immutable record of all data changes
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="All entities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            {ENTITY_TYPES.map((e) => (
              <SelectItem key={e} value={e} className="capitalize">
                {e.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        data={logs as unknown as Record<string, unknown>[]}
        columns={columns as DataTableColumn<Record<string, unknown>>[]}
        keyField="id"
        searchable={false}
        pageSize={25}
        isLoading={isLoading}
        emptyMessage="No audit events found for the selected filters."
      />

      {logs.length >= limit && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + 100)}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
