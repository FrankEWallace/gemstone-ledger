import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { UserPlus, Shield, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import type { UserRole } from "@/lib/supabaseTypes";
import {
  getOrgUsers,
  inviteUser,
  updateUserRole,
  removeUserFromSite,
  type OrgUser,
} from "@/services/auth.service";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: UserRole[] = ["admin", "site_manager", "worker", "viewer"];

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  site_manager: "Site Manager",
  worker: "Worker",
  viewer: "Viewer",
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  site_manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  worker: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  viewer: "bg-muted text-muted-foreground",
};

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

function userInitials(name: string | null) {
  if (!name) return "??";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email"),
  site_id: z.string().min(1, "Select a site"),
  role: z.enum(["admin", "site_manager", "worker", "viewer"]),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface InviteModalProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
}

function InviteModal({ open, onClose, orgId }: InviteModalProps) {
  const queryClient = useQueryClient();
  const { sites } = useSite();

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", site_id: "", role: "worker" },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: InviteFormValues) =>
      inviteUser({ email: values.email, org_id: orgId, site_id: values.site_id, role: values.role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-users", orgId] });
      toast.success("Invitation sent. The user will receive an email to join.");
      onClose();
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="colleague@company.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="site_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign to Site *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select site" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sites.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          <div className="flex items-center gap-2">
                            <RoleBadge role={r} />
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p><strong>Admin:</strong> Full access — manage users, all data, settings.</p>
              <p><strong>Site Manager:</strong> Manage site data and workers.</p>
              <p><strong>Worker:</strong> Log shifts, view inventory and transactions.</p>
              <p><strong>Viewer:</strong> Read-only access to site data.</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Sending…" : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ─── User Card ────────────────────────────────────────────────────────────────

interface UserCardProps {
  user: OrgUser;
  orgId: string;
  currentUserId?: string;
}

function UserCard({ user, orgId, currentUserId }: UserCardProps) {
  const queryClient = useQueryClient();
  const isCurrentUser = user.id === currentUserId;

  const { mutate: changeRole } = useMutation({
    mutationFn: ({ siteId, role }: { siteId: string; role: UserRole }) =>
      updateUserRole(user.id, siteId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-users", orgId] });
      toast.success("Role updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: removeRole } = useMutation({
    mutationFn: (siteId: string) => removeUserFromSite(user.id, siteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-users", orgId] });
      toast.success("User removed from site.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      {/* User header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
          {userInitials(user.full_name)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">
            {user.full_name ?? "Unnamed User"}
            {isCurrentUser && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">(you)</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Joined {new Date(user.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* Site roles */}
      {user.site_roles.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No site assignments.</p>
      ) : (
        <div className="space-y-2">
          {user.site_roles.map((sr) => (
            <div key={sr.site_id} className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground truncate min-w-0">{sr.site_name}</p>
              <div className="flex items-center gap-1 shrink-0">
                <Select
                  value={sr.role}
                  onValueChange={(v) => changeRole({ siteId: sr.site_id, role: v as UserRole })}
                  disabled={isCurrentUser}
                >
                  <SelectTrigger className="h-7 text-xs w-32 focus:ring-0">
                    <SelectValue>{<RoleBadge role={sr.role} />}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}><RoleBadge role={r} /></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isCurrentUser && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeRole(sr.site_id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RolesPermissionsPage() {
  const { orgId, user } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: orgUsers = [], isLoading } = useQuery({
    queryKey: ["org-users", orgId],
    queryFn: () => getOrgUsers(orgId!),
    enabled: !!orgId,
  });

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage team members and their access across sites.
          </p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-1.5" />
          Invite Member
        </Button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          <span>{orgUsers.length} member{orgUsers.length !== 1 ? "s" : ""} in organization</span>
        </div>
      </div>

      <Separator />

      {/* User list */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-border p-4 h-32 animate-pulse bg-muted/30" />
          ))}
        </div>
      ) : orgUsers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Shield className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No users in this organization yet.</p>
          <p className="text-sm mt-1">Invite team members to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {orgUsers.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              orgId={orgId!}
              currentUserId={user?.id}
            />
          ))}
        </div>
      )}

      {inviteOpen && (
        <InviteModal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          orgId={orgId!}
        />
      )}
    </div>
  );
}
