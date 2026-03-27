import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Play, CheckCircle, Trash2, Megaphone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

import type { Campaign, CampaignStatus } from "@/lib/supabaseTypes";
import {
  getCampaigns,
  createCampaign,
  updateCampaignStatus,
  deleteCampaign,
} from "@/services/campaigns.service";

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  cancelled: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

function StatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[status]}`}>
      {status}
    </span>
  );
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const campaignSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  target_sites: z.array(z.string()),
});

type CampaignFormValues = z.infer<typeof campaignSchema>;

// ─── Create Modal ─────────────────────────────────────────────────────────────

interface CreateCampaignModalProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  userId?: string;
}

function CreateCampaignModal({ open, onClose, orgId, userId }: CreateCampaignModalProps) {
  const { sites } = useSite();
  const queryClient = useQueryClient();

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: { title: "", description: "", start_date: "", end_date: "", target_sites: [] },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: CampaignFormValues) =>
      createCampaign(
        orgId,
        {
          title: values.title,
          description: values.description || undefined,
          start_date: values.start_date || undefined,
          end_date: values.end_date || undefined,
          target_sites: values.target_sites.length > 0 ? values.target_sites : undefined,
        },
        userId
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns", orgId] });
      toast.success("Campaign created.");
      onClose();
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const watchedSites = form.watch("target_sites");

  function toggleSite(siteId: string) {
    const current = form.getValues("target_sites");
    if (current.includes(siteId)) {
      form.setValue("target_sites", current.filter((s) => s !== siteId));
    } else {
      form.setValue("target_sites", [...current, siteId]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Campaign</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Campaign Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Q2 Safety Drive" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Campaign objectives and details…" rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Target sites */}
            {sites.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Target Sites</p>
                <div className="space-y-2">
                  {sites.map((site) => (
                    <label key={site.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={watchedSites.includes(site.id)}
                        onCheckedChange={() => toggleSite(site.id)}
                      />
                      <span className="text-sm">{site.name}</span>
                    </label>
                  ))}
                </div>
                {watchedSites.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">No sites selected — campaign will target all sites.</p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create Campaign"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Status Actions ───────────────────────────────────────────────────────────

function CampaignActions({ campaign, orgId }: { campaign: Campaign; orgId: string }) {
  const queryClient = useQueryClient();

  const { mutate: advance } = useMutation({
    mutationFn: (status: CampaignStatus) => updateCampaignStatus(campaign.id, status),
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns", orgId] });
      toast.success(`Campaign marked as ${status}.`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (campaign.status === "draft") {
    return (
      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => advance("active")}>
        <Play className="h-3 w-3" />
        Activate
      </Button>
    );
  }
  if (campaign.status === "active") {
    return (
      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => advance("completed")}>
        <CheckCircle className="h-3 w-3" />
        Complete
      </Button>
    );
  }
  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const { orgId, user } = useAuth();
  const { sites } = useSite();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns", orgId],
    queryFn: () => getCampaigns(orgId!),
    enabled: !!orgId,
  });

  const { mutate: doDelete, isPending: isDeleting } = useMutation({
    mutationFn: (id: string) => deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns", orgId] });
      toast.success("Campaign deleted.");
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = statusFilter === "all" ? campaigns : campaigns.filter((c) => c.status === statusFilter);

  const counts: Record<string, number> = {};
  for (const c of campaigns) counts[c.status] = (counts[c.status] ?? 0) + 1;

  const columns: DataTableColumn<Campaign>[] = [
    {
      key: "title",
      header: "Campaign",
      sortable: true,
      render: (_, row) => (
        <div>
          <p className="font-medium">{row.title}</p>
          {row.description && <p className="text-xs text-muted-foreground truncate max-w-sm">{row.description}</p>}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (val) => <StatusBadge status={val as CampaignStatus} />,
    },
    {
      key: "start_date",
      header: "Period",
      render: (_, row) => {
        if (!row.start_date && !row.end_date) return <span className="text-muted-foreground">—</span>;
        const from = row.start_date ? format(new Date(row.start_date as string), "MMM d") : "?";
        const to = row.end_date ? format(new Date(row.end_date as string), "MMM d, yyyy") : "ongoing";
        return <span className="text-sm">{from} → {to}</span>;
      },
    },
    {
      key: "target_sites",
      header: "Sites",
      render: (val) => {
        const ids = (val as string[] | null) ?? [];
        if (ids.length === 0) return <span className="text-xs text-muted-foreground">All sites</span>;
        const names = ids.map((id) => sites.find((s) => s.id === id)?.name ?? id.slice(0, 8));
        return (
          <div className="flex items-center gap-1 flex-wrap">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs">{names.join(", ")}</span>
          </div>
        );
      },
    },
    {
      key: "id",
      header: "",
      className: "w-32 text-right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <CampaignActions campaign={row as unknown as Campaign} orgId={orgId!} />
          {(row.status === "draft" || row.status === "completed" || row.status === "cancelled") && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => setDeleteTarget(row as unknown as Campaign)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Campaigns</h1>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Campaign
        </Button>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2">
        {(["all", "draft", "active", "completed", "cancelled"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {s === "all" ? `All (${campaigns.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${counts[s] ?? 0})`}
          </button>
        ))}
      </div>

      <DataTable
        data={filtered as unknown as Record<string, unknown>[]}
        columns={columns as DataTableColumn<Record<string, unknown>>[]}
        keyField="id"
        searchable
        searchPlaceholder="Search campaigns…"
        searchKeys={["title", "description"]}
        pageSize={15}
        isLoading={isLoading}
        emptyMessage={
          statusFilter !== "all"
            ? `No ${statusFilter} campaigns.`
            : "No campaigns yet. Create your first campaign."
        }
      />

      {modalOpen && (
        <CreateCampaignModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          orgId={orgId!}
          userId={user?.id}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>This campaign will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && doDelete(deleteTarget.id)}
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
