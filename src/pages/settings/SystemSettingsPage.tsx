import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, Building2, Globe, DollarSign, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { getOrganization, updateOrganization, uploadOrgLogo } from "@/services/settings.service";

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Sao_Paulo", "Europe/London", "Europe/Paris", "Europe/Berlin", "Africa/Johannesburg",
  "Africa/Lagos", "Africa/Nairobi", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore",
  "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland",
];

const CURRENCIES = [
  { code: "USD", label: "US Dollar (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "GBP", label: "British Pound (GBP)" },
  { code: "ZAR", label: "South African Rand (ZAR)" },
  { code: "NGN", label: "Nigerian Naira (NGN)" },
  { code: "KES", label: "Kenyan Shilling (KES)" },
  { code: "AUD", label: "Australian Dollar (AUD)" },
  { code: "CAD", label: "Canadian Dollar (CAD)" },
  { code: "BRL", label: "Brazilian Real (BRL)" },
  { code: "INR", label: "Indian Rupee (INR)" },
];

// ─── Schema ──────────────────────────────────────────────────────────────────

const settingsSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  slug: z.string().min(2, "Slug must be at least 2 characters").regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
  timezone: z.string(),
  currency: z.string(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

// ─── Weekly report section ────────────────────────────────────────────────────

function WeeklyReportSection({
  orgId,
  org,
  queryClient,
}: {
  orgId: string | null;
  org: any;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const [reportEmail, setReportEmail] = useState<string>("");
  const [sending, setSending] = useState(false);

  // Sync email field from loaded org
  const emailValue = org?.weekly_report_email ?? "";

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("organizations")
        .update({ weekly_report_enabled: enabled })
        .eq("id", orgId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", orgId] });
      toast.success("Report preference saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase
        .from("organizations")
        .update({ weekly_report_email: email || null })
        .eq("id", orgId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", orgId] });
      toast.success("Report email saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function sendNow() {
    if (!orgId) return;
    setSending(true);
    try {
      await supabase.functions.invoke("send-weekly-report", {
        body: { org_id: orgId },
      });
      toast.success("Weekly report sent!");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (!orgId) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-sm">Weekly Email Report</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Send a weekly KPI digest every Monday at 08:00 UTC to the email below.
        Includes revenue, expenses, safety incidents, low stock and production data.
      </p>
      <div className="space-y-4">
        {/* Enable/disable toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div>
            <p className="text-sm font-medium">Enable Weekly Report</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {org?.weekly_report_enabled ? "Reports are enabled" : "Reports are disabled"}
            </p>
          </div>
          <button
            onClick={() => toggleMutation.mutate(!org?.weekly_report_enabled)}
            disabled={toggleMutation.isPending}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              org?.weekly_report_enabled ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                org?.weekly_report_enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {/* Email input */}
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="reports@company.com"
            defaultValue={emailValue}
            onChange={(e) => setReportEmail(e.target.value)}
            className="flex-1"
          />
          <Button
            variant="outline"
            onClick={() => saveEmailMutation.mutate(reportEmail || emailValue)}
            disabled={saveEmailMutation.isPending}
          >
            {saveEmailMutation.isPending ? "Saving…" : "Save Email"}
          </Button>
        </div>

        {/* Send now button */}
        <Button
          variant="outline"
          size="sm"
          onClick={sendNow}
          disabled={sending || !org?.weekly_report_email}
        >
          <Send className="h-3.5 w-3.5 mr-1.5" />
          {sending ? "Sending…" : "Send Report Now"}
        </Button>
        {!org?.weekly_report_email && (
          <p className="text-xs text-muted-foreground">Save an email address to enable manual send.</p>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SystemSettingsPage() {
  const { orgId } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const { data: org, isLoading } = useQuery({
    queryKey: ["org", orgId],
    queryFn: () => getOrganization(orgId!),
    enabled: !!orgId,
  });

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    values: org
      ? { name: org.name, slug: org.slug, timezone: "UTC", currency: "USD" }
      : { name: "", slug: "", timezone: "UTC", currency: "USD" },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (values: SettingsFormValues) =>
      updateOrganization(orgId!, { name: values.name, slug: values.slug }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org", orgId] });
      toast.success("Settings saved.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;

    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload
    setIsUploadingLogo(true);
    try {
      const url = await uploadOrgLogo(orgId, file);
      await updateOrganization(orgId, { logo_url: url });
      queryClient.invalidateQueries({ queryKey: ["org", orgId] });
      toast.success("Logo updated.");
    } catch (err) {
      toast.error((err as Error).message);
      setLogoPreview(null);
    } finally {
      setIsUploadingLogo(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-muted animate-pulse rounded" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-8 max-w-2xl">
      <h1 className="font-display text-2xl font-bold">System Settings</h1>

      {/* Logo */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Organization Logo</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
            {(logoPreview ?? org?.logo_url) ? (
              <img src={logoPreview ?? org?.logo_url!} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingLogo}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              {isUploadingLogo ? "Uploading…" : "Upload Logo"}
            </Button>
            <p className="text-xs text-muted-foreground mt-1">PNG, JPG or SVG · Max 2MB</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Requires the <code>org-assets</code> storage bucket to be created in Supabase.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>
      </div>

      <Separator />

      {/* Org details */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => mutate(v))} className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Organization Details</h2>
            </div>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. FW Mining Corp" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL Slug</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. fw-mining" {...field} />
                    </FormControl>
                    <FormDescription>Used in URLs and API references. Lowercase letters, numbers, hyphens only.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator />

          {/* Regional settings */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Regional Settings</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save Settings"}
            </Button>
          </div>
        </form>
      </Form>

      <Separator />

      {/* Weekly email report */}
      <WeeklyReportSection orgId={orgId} org={org} queryClient={queryClient} />
    </div>
  );
}
