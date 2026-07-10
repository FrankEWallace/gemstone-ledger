import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  User,
  Phone,
  Lock,
  Shield,
  Mail,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Bell,
  AlertTriangle,
  Copy,
  Check,
  Pencil,
  Calendar,
  Clock,
  Shuffle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/context/ThemeContext";
import {
  updateUserProfile,
  changePassword,
  changeEmail,
  resolveNotificationPrefs,
} from "@/services/profile.service";
import {
  avatarSrc,
  renderAvatar,
  parseAvatarConfig,
  defaultAvatarConfig,
  serializeAvatarConfig,
  randomSeed,
  AVATAR_STYLES,
  AVATAR_STYLE_LABELS,
  type AvatarStyle,
} from "@/lib/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isDemoMode } from "@/lib/demo";
import type { UserProfile, OrgRole } from "@/lib/supabaseTypes";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
});

const passwordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const emailSchema = z.object({
  newEmail: z.string().email("Enter a valid email address"),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;
type EmailFormValues = z.infer<typeof emailSchema>;

// ─── Helpers ────────────────────────────────────────────────────────────────────

const SITE_ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  site_manager: "Site Manager",
  worker: "Worker",
  viewer: "Viewer",
};

const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Org Admin",
  member: "Member",
};

function initialsOf(name: string | null): string {
  return (name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function SiteRoleBadge({ role }: { role: string }) {
  const label = SITE_ROLE_LABELS[role] ?? role;
  const className =
    role === "admin"
      ? "bg-chart-3/10 text-chart-3"
      : role === "site_manager"
      ? "bg-chart-4/10 text-chart-4"
      : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

/** Read-only label/value row used in view mode. */
function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="text-sm font-medium text-right break-words">{value}</span>
    </div>
  );
}

// ─── Identity card ──────────────────────────────────────────────────────────────

/** Modal for choosing an illustrated avatar: pick a style, shuffle for new
 *  options, select one, save. Persists a { style, seed } recipe — no upload. */
function AvatarPicker({
  userId,
  profile,
  open,
  onOpenChange,
  onSaved,
}: {
  userId: string;
  profile: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (profile: UserProfile) => void;
}) {
  const current = parseAvatarConfig(profile?.avatar_url) ?? defaultAvatarConfig(userId);
  const [style, setStyle] = useState<AvatarStyle>(current.style);
  const [selectedSeed, setSelectedSeed] = useState(current.seed);
  // The current seed is always pinned first so the active choice never scrolls away.
  const [seeds, setSeeds] = useState<string[]>(() => [
    current.seed,
    ...Array.from({ length: 7 }, () => randomSeed()),
  ]);

  // Re-sync when re-opened against the latest saved profile.
  function handleOpenChange(next: boolean) {
    if (next) {
      const cfg = parseAvatarConfig(profile?.avatar_url) ?? defaultAvatarConfig(userId);
      setStyle(cfg.style);
      setSelectedSeed(cfg.seed);
      setSeeds([cfg.seed, ...Array.from({ length: 7 }, () => randomSeed())]);
    }
    onOpenChange(next);
  }

  function shuffle() {
    setSeeds([selectedSeed, ...Array.from({ length: 7 }, () => randomSeed())]);
  }

  const { mutate: save, isPending } = useMutation({
    mutationFn: () =>
      updateUserProfile(userId, {
        avatar_url: serializeAvatarConfig({ style, seed: selectedSeed }),
      }),
    onSuccess: (updated) => {
      onSaved(updated);
      onOpenChange(false);
      toast.success("Avatar updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose your avatar</DialogTitle>
          <DialogDescription>Pick a style, then choose a character.</DialogDescription>
        </DialogHeader>

        {/* Style selector */}
        <div className="inline-flex self-start rounded-lg border border-border p-0.5">
          {AVATAR_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStyle(s)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                style === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={style === s}
            >
              {AVATAR_STYLE_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Options grid */}
        <div className="grid grid-cols-4 gap-3">
          {seeds.map((seed) => {
            const active = seed === selectedSeed;
            return (
              <button
                key={seed}
                type="button"
                onClick={() => setSelectedSeed(seed)}
                className={cn(
                  "rounded-full p-0.5 transition-colors",
                  active ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "hover:bg-muted"
                )}
                aria-label="Select avatar"
                aria-pressed={active}
              >
                <img
                  src={renderAvatar({ style, seed })}
                  alt=""
                  className="h-14 w-14 rounded-full"
                />
              </button>
            );
          })}
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={shuffle} disabled={isPending}>
            <Shuffle className="mr-2 h-4 w-4" />
            Shuffle
          </Button>
          <Button type="button" onClick={() => save()} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Identity card ──────────────────────────────────────────────────────────────

function IdentityCard({
  userId,
  profile,
  email,
  orgRole,
  memberSince,
  lastSignIn,
  demo,
  onSaved,
  onSignOut,
}: {
  userId: string;
  profile: UserProfile | null;
  email: string | null;
  orgRole: OrgRole | null;
  memberSince: string | null;
  lastSignIn: string | null;
  demo: boolean;
  onSaved: (profile: UserProfile) => void;
  onSignOut: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const fullName = profile?.full_name ?? null;
  // A real uploaded photo wins if one is ever stored; otherwise the chosen (or
  // default) illustrated avatar, generated locally — no upload, instant.
  const src = avatarSrc(profile?.avatar_url, userId);

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-6 sm:flex-row sm:items-center">
        {/* Avatar */}
        <div className="relative shrink-0 self-start sm:self-center">
          <Avatar className="h-20 w-20 border-2 border-border">
            <AvatarImage src={src} alt={fullName ?? "Avatar"} className="object-cover" />
            <AvatarFallback className="text-xl font-semibold">{initialsOf(fullName)}</AvatarFallback>
          </Avatar>
          {!demo && (
            <>
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card shadow transition-colors hover:bg-muted"
                title="Change avatar"
                aria-label="Change avatar"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <AvatarPicker
                userId={userId}
                profile={profile}
                open={picking}
                onOpenChange={setPicking}
                onSaved={onSaved}
              />
            </>
          )}
        </div>

        {/* Identity */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-bold truncate">{fullName ?? "Unnamed user"}</h2>
            {orgRole && (
              <Badge variant={orgRole === "owner" ? "default" : "secondary"}>
                {ORG_ROLE_LABELS[orgRole]}
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5 truncate">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              {email ?? "—"}
            </span>
            {profile?.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {profile.phone}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              Member since {formatDate(memberSince)}
            </span>
            {lastSignIn && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                Last sign-in {formatDate(lastSignIn)}
              </span>
            )}
          </div>
        </div>

        {/* Sign out */}
        <div className="shrink-0 self-start sm:self-center">
          <Button variant="outline" size="sm" onClick={onSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Account card (inline edit) ──────────────────────────────────────────────────

function AccountCard({
  userId,
  profile,
  demo,
  onSaved,
}: {
  userId: string;
  profile: UserProfile | null;
  demo: boolean;
  onSaved: (profile: UserProfile) => void;
}) {
  const [editing, setEditing] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
    },
  });

  const { mutate: save, isPending } = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      updateUserProfile(userId, {
        full_name: values.full_name,
        phone: values.phone || null,
      }),
    // Apply the change immediately and close the form — the server round-trip
    // happens in the background, so saving feels instant despite the latency.
    onMutate: (values: ProfileFormValues) => {
      const previous = profile;
      if (previous) {
        onSaved({ ...previous, full_name: values.full_name, phone: values.phone || null });
      }
      setEditing(false);
      return { previous };
    },
    onSuccess: (updated) => {
      onSaved(updated); // reconcile with the authoritative row
      toast.success("Profile saved.");
    },
    onError: (err: Error, _values, ctx) => {
      if (ctx?.previous) onSaved(ctx.previous); // roll back the optimistic patch
      setEditing(true);
      toast.error(err.message);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4 text-muted-foreground" />
          Account
        </CardTitle>
        <CardDescription>Your name and contact number.</CardDescription>
        {!editing && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)} disabled={demo}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {!editing ? (
          <div className="divide-y divide-border">
            <InfoRow icon={User} label="Full name" value={profile?.full_name ?? "—"} />
            <InfoRow icon={Phone} label="Phone" value={profile?.phone || "Not set"} />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => save(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Smith" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 555 000 0000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    form.reset();
                    setEditing(false);
                  }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Security card ────────────────────────────────────────────────────────────

function SecurityCard({ email, demo }: { email: string | null; demo: boolean }) {
  const [editingEmail, setEditingEmail] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { newEmail: "" },
  });
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const { mutate: updateEmail, isPending: savingEmail } = useMutation({
    mutationFn: (values: EmailFormValues) => changeEmail(values.newEmail),
    onSuccess: () => {
      emailForm.reset();
      setEditingEmail(false);
      toast.success("Confirmation sent — check your new email address to confirm the change.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: updatePassword, isPending: savingPassword } = useMutation({
    mutationFn: (values: PasswordFormValues) => changePassword(values.newPassword),
    onSuccess: () => {
      passwordForm.reset();
      setEditingPassword(false);
      toast.success("Password updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4 text-muted-foreground" />
          Security
        </CardTitle>
        <CardDescription>Manage your sign-in email and password.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Email */}
        <div>
          {!editingEmail ? (
            <div className="flex items-center justify-between gap-4">
              <InfoRow icon={Mail} label="Email" value={email ?? "—"} />
              <Button variant="outline" size="sm" onClick={() => setEditingEmail(true)} disabled={demo}>
                Change
              </Button>
            </div>
          ) : (
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit((v) => updateEmail(v))} className="space-y-3">
                <FormField
                  control={emailForm.control}
                  name="newEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="new@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  A confirmation link is sent to the new address — the change takes effect after you click it.
                </p>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      emailForm.reset();
                      setEditingEmail(false);
                    }}
                    disabled={savingEmail}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={savingEmail}>
                    {savingEmail ? "Sending…" : "Send Confirmation"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>

        <div className="h-px bg-border" />

        {/* Password */}
        <div>
          {!editingPassword ? (
            <div className="flex items-center justify-between gap-4">
              <InfoRow icon={Lock} label="Password" value="••••••••" />
              <Button variant="outline" size="sm" onClick={() => setEditingPassword(true)} disabled={demo}>
                Change
              </Button>
            </div>
          ) : (
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit((v) => updatePassword(v))} className="space-y-3">
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Min. 8 characters" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Repeat new password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <p className="text-xs text-muted-foreground">You'll remain signed in on this device.</p>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      passwordForm.reset();
                      setEditingPassword(false);
                    }}
                    disabled={savingPassword}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={savingPassword}>
                    {savingPassword ? "Updating…" : "Update Password"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Preferences card ────────────────────────────────────────────────────────────

const THEME_OPTIONS = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "dark" as const, label: "Dark", icon: Moon },
  { value: "system" as const, label: "System", icon: Monitor },
];

function PreferencesCard({
  userId,
  profile,
  demo,
  onSaved,
}: {
  userId: string;
  profile: UserProfile | null;
  demo: boolean;
  onSaved: (profile: UserProfile) => void;
}) {
  const { theme, setTheme } = useTheme();
  const prefs = resolveNotificationPrefs(profile);

  const { mutate: saveEmailPref, isPending } = useMutation({
    mutationFn: (email_enabled: boolean) =>
      updateUserProfile(userId, { notification_prefs: { ...prefs, email_enabled } }),
    onSuccess: (updated) => {
      onSaved(updated);
      toast.success("Preferences saved.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preferences</CardTitle>
        <CardDescription>Appearance and notifications.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Theme */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Theme</p>
            <p className="text-sm text-muted-foreground">Choose how the app looks.</p>
          </div>
          <div className="inline-flex rounded-lg border border-border p-0.5">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  theme === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={theme === opt.value}
              >
                <opt.icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Email notifications */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              Email notifications
            </p>
            <p className="text-sm text-muted-foreground">Receive alert and report emails.</p>
          </div>
          <Switch
            checked={prefs.email_enabled}
            disabled={demo || isPending}
            onCheckedChange={(checked) => saveEmailPref(checked)}
            aria-label="Email notifications"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Sites & roles card ──────────────────────────────────────────────────────────

function SitesRolesCard({ sites }: { sites: { id: string; name: string; location: string | null; role: string }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4 text-muted-foreground" />
          Sites & Roles
        </CardTitle>
        <CardDescription>Your access level on each site. Contact an admin to change roles.</CardDescription>
      </CardHeader>
      <CardContent>
        {sites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No site assignments found.</p>
        ) : (
          <div className="space-y-2">
            {sites.map((site) => (
              <div
                key={site.id}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{site.name}</p>
                  {site.location && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{site.location}</p>
                  )}
                </div>
                <SiteRoleBadge role={site.role} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Danger zone card ────────────────────────────────────────────────────────────

function DangerZoneCard({ userId }: { userId: string }) {
  const [copied, setCopied] = useState(false);

  function copyId() {
    navigator.clipboard.writeText(userId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Danger Zone
        </CardTitle>
        <CardDescription>Irreversible account actions. These require backend setup and are not yet enabled.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
          <div>
            <p className="text-sm font-medium">Leave organization</p>
            <p className="text-sm text-muted-foreground">Remove yourself from this organization.</p>
          </div>
          <Button variant="outline" size="sm" disabled title="Requires backend setup">
            Leave
          </Button>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/40 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-destructive">Delete account</p>
            <p className="text-sm text-muted-foreground">Permanently delete your account and data.</p>
          </div>
          <Button variant="destructive" size="sm" disabled title="Requires backend setup">
            Delete
          </Button>
        </div>
        <button
          type="button"
          onClick={copyId}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          title="Copy user ID"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          <span className="font-mono">{userId}</span>
        </button>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, userProfile, sites, orgRole, signOut, setProfile } = useAuth();
  const queryClient = useQueryClient();
  const demo = isDemoMode();

  // Single place to push a freshly-returned profile into context + query cache.
  function applyProfile(updated: UserProfile) {
    setProfile(updated);
    queryClient.setQueryData(["userProfile", user?.id], updated);
  }

  const userId = user!.id;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="font-display text-2xl font-bold">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account, security, and preferences.</p>
      </div>

      <IdentityCard
        userId={userId}
        profile={userProfile}
        email={user?.email ?? null}
        orgRole={orgRole}
        memberSince={user?.created_at ?? null}
        lastSignIn={user?.last_sign_in_at ?? null}
        demo={demo}
        onSaved={applyProfile}
        onSignOut={signOut}
      />

      {demo && (
        <p className="rounded-lg border border-warning/20 bg-warning/10 px-4 py-2 text-xs text-warning">
          You're in demo mode — profile changes are disabled.
        </p>
      )}

      <AccountCard userId={userId} profile={userProfile} demo={demo} onSaved={applyProfile} />

      <SecurityCard email={user?.email ?? null} demo={demo} />

      <PreferencesCard userId={userId} profile={userProfile} demo={demo} onSaved={applyProfile} />

      <SitesRolesCard sites={sites} />

      <DangerZoneCard userId={userId} />
    </div>
  );
}
