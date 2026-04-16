import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Phone, Lock, Shield, Upload, LogOut, Camera } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { updateUserProfile, uploadUserAvatar, changePassword } from "@/services/profile.service";
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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { isDemoMode } from "@/lib/demo";

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

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

// ─── Role badge ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin:        "Admin",
  site_manager: "Site Manager",
  worker:       "Worker",
  viewer:       "Viewer",
};

function RoleBadge({ role }: { role: string }) {
  const label = ROLE_LABELS[role] ?? role;
  const className =
    role === "admin"
      ? "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300"
      : role === "site_manager"
      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
      : "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {label}
    </span>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function AvatarSection({
  userId,
  avatarUrl,
  fullName,
  onUploaded,
}: {
  userId: string;
  avatarUrl: string | null;
  fullName: string | null;
  onUploaded: (url: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const initials = (fullName ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const url = await uploadUserAvatar(userId, file);
      await updateUserProfile(userId, { avatar_url: url });
      onUploaded(url);
      toast.success("Avatar updated.");
    } catch (err) {
      toast.error((err as Error).message);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  const src = preview ?? avatarUrl;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <div className="h-20 w-20 rounded-full border-2 border-border overflow-hidden bg-muted flex items-center justify-center text-xl font-semibold text-muted-foreground">
          {src ? (
            <img src={src} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card shadow hover:bg-muted transition-colors disabled:opacity-50"
          title="Change avatar"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
      </div>
      <div>
        <p className="text-sm font-medium">{fullName ?? "—"}</p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          <Upload className="h-3 w-3" />
          {uploading ? "Uploading…" : "Change photo"}
        </button>
        <p className="text-[11px] text-muted-foreground mt-0.5">PNG, JPG · Max 2MB</p>
        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
          Requires <code>user-avatars</code> bucket in Supabase Storage.
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, userProfile, sites, signOut, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const demo = isDemoMode();

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: {
      full_name: userProfile?.full_name ?? "",
      phone:     userProfile?.phone ?? "",
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const { mutate: saveProfile, isPending: savingProfile } = useMutation({
    mutationFn: (values: ProfileFormValues) =>
      updateUserProfile(user!.id, {
        full_name: values.full_name,
        phone:     values.phone || null,
      }),
    onSuccess: async () => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["userProfile", user?.id] });
      toast.success("Profile saved.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { mutate: updatePassword, isPending: savingPassword } = useMutation({
    mutationFn: (values: PasswordFormValues) => changePassword(values.newPassword),
    onSuccess: () => {
      passwordForm.reset();
      toast.success("Password updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="p-4 lg:p-6 space-y-8 max-w-2xl">
      <h1 className="font-display text-2xl font-bold">My Profile</h1>

      {/* Avatar */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Photo</h2>
        </div>
        {demo ? (
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full border-2 border-border bg-muted flex items-center justify-center text-xl font-semibold text-muted-foreground">
              DM
            </div>
            <p className="text-sm text-muted-foreground">Avatar upload is disabled in demo mode.</p>
          </div>
        ) : (
          <AvatarSection
            userId={user!.id}
            avatarUrl={userProfile?.avatar_url ?? null}
            fullName={userProfile?.full_name ?? null}
            onUploaded={() => refreshProfile()}
          />
        )}
      </div>

      <Separator />

      {/* Personal info */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Personal Information</h2>
        </div>

        {/* Email — read-only, from auth */}
        <div className="mb-4">
          <label className="text-sm font-medium leading-none">Email</label>
          <div className="mt-1.5 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {user?.email ?? "—"}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Email is managed by your authentication provider and cannot be changed here.
          </p>
        </div>

        <Form {...profileForm}>
          <form
            onSubmit={profileForm.handleSubmit((v) => saveProfile(v))}
            className="space-y-4"
          >
            <FormField
              control={profileForm.control}
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
              control={profileForm.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      Phone
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="+1 555 000 0000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={savingProfile || demo}>
                {savingProfile ? "Saving…" : "Save Changes"}
              </Button>
            </div>
            {demo && (
              <p className="text-xs text-amber-600 dark:text-amber-400 text-right">
                Profile edits are disabled in demo mode.
              </p>
            )}
          </form>
        </Form>
      </div>

      <Separator />

      {/* Password */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Change Password</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Choose a new password. You'll remain signed in on this device.
        </p>
        <Form {...passwordForm}>
          <form
            onSubmit={passwordForm.handleSubmit((v) => updatePassword(v))}
            className="space-y-4"
          >
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
            <div className="flex justify-end">
              <Button type="submit" variant="outline" disabled={savingPassword || demo}>
                {savingPassword ? "Updating…" : "Update Password"}
              </Button>
            </div>
            {demo && (
              <p className="text-xs text-amber-600 dark:text-amber-400 text-right">
                Password changes are disabled in demo mode.
              </p>
            )}
          </form>
        </Form>
      </div>

      <Separator />

      {/* Sites & roles */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Sites & Roles</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Your access level on each site you belong to. Contact an admin to change roles.
        </p>
        {sites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No site assignments found.</p>
        ) : (
          <div className="space-y-2">
            {sites.map((site) => (
              <div
                key={site.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{site.name}</p>
                  {site.location && (
                    <p className="text-xs text-muted-foreground mt-0.5">{site.location}</p>
                  )}
                </div>
                <RoleBadge role={site.role} />
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Sign out */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <LogOut className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Session</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Sign out of FW Mining OS on this device.
        </p>
        <Button variant="destructive" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
