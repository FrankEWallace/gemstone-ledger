import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload, Building2, Globe, DollarSign, Mail, Send, Database, Server, AlertTriangle, CheckCircle2, Loader2, ExternalLink, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  getBackendConfig,
  activateProvider,
  type BackendConfig,
} from "@/lib/providers/backendConfig";
import { testRestConnection } from "@/lib/providers/rest/client";

import { useAuth } from "@/hooks/useAuth";
import { useOrgModules, type ModuleKey } from "@/hooks/useOrgModules";
import { Switch } from "@/components/ui/switch";
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

// ─── Module Configuration Section ────────────────────────────────────────────

const MODULE_CONFIG: { key: ModuleKey; label: string; description: string }[] = [
  { key: "messages",     label: "Messages",            description: "Internal site messaging — general, safety, and operations channels" },
  { key: "campaigns",    label: "Campaigns",           description: "Marketing and operational campaign management" },
  { key: "customers",    label: "Customers",           description: "Customer accounts, contracts, and drill-down views" },
  { key: "reports",      label: "Reports & Analytics", description: "Financial and operational reporting with data exports" },
  { key: "team",         label: "Team & Scheduling",   description: "Team performance, shift scheduling, and timesheets" },
  { key: "supply_chain", label: "Supply Chain",        description: "Supplier list, distribution channels, and order management" },
  { key: "operations",   label: "Operations",          description: "Equipment, safety incidents, production logs, and documents" },
];

function ModuleConfigSection() {
  const { isModuleEnabled, toggleModule, isSaving } = useOrgModules();

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-sm">Module Configuration</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Enable or disable modules for all users in your organization. Disabled modules
        are hidden from the sidebar and inaccessible org-wide.
      </p>
      <div className="space-y-2">
        {MODULE_CONFIG.map(({ key, label, description }) => (
          <div
            key={key}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 gap-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
            ) : (
              <Switch
                checked={isModuleEnabled(key)}
                onCheckedChange={() => toggleModule(key)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Backend Provider Section ─────────────────────────────────────────────────

function BackendProviderSection({ role }: { role: string | null }) {
  const config = getBackendConfig();
  const isRest = config.provider === "rest";

  const [showDialog, setShowDialog] = useState(false);
  const [restUrl, setRestUrl] = useState(config.restBaseUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"idle" | "ok" | "fail">("idle");
  const [confirming, setConfirming] = useState(false);

  // Only org admins see this section
  if (role !== "admin") return null;

  async function handleTest() {
    if (!restUrl.trim()) {
      toast.error("Enter a base URL first");
      return;
    }
    setTesting(true);
    setTestResult("idle");
    const ok = await testRestConnection(restUrl.trim());
    setTesting(false);
    setTestResult(ok ? "ok" : "fail");
    if (!ok) toast.error("Connection failed — check the URL and that /health returns { data: { status: 'ok' } }");
  }

  function handleActivateRest() {
    if (testResult !== "ok") {
      toast.error("Test the connection successfully before activating");
      return;
    }
    const next: BackendConfig = {
      provider: "rest",
      restBaseUrl: restUrl.trim(),
      restActivatedAt: new Date().toISOString(),
    };
    activateProvider(next); // reloads the page
  }

  function handleRevertToSupabase() {
    activateProvider({ provider: "supabase", restBaseUrl: "" });
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Database className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-sm">Backend Provider</h2>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 uppercase tracking-wide">
          Developer
        </span>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Switch the data backend from Supabase to the self-hosted Laravel API (cPanel, VPS, or any PHP 8+ host).
        The app's service layer is designed so each backend can be swapped without UI changes.
      </p>

      {/* Provider cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {/* Supabase card */}
        <div className={`rounded-lg border p-4 flex items-start gap-3 transition-colors ${
          !isRest
            ? "border-primary bg-primary/5"
            : "border-border bg-card opacity-60"
        }`}>
          <Database className={`h-5 w-5 mt-0.5 flex-shrink-0 ${!isRest ? "text-primary" : "text-muted-foreground"}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Supabase</span>
              {!isRest && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              PostgreSQL · Auth · Realtime · Storage · Edge Functions
            </p>
          </div>
        </div>

        {/* REST / cPanel card */}
        <div className={`rounded-lg border p-4 flex items-start gap-3 transition-colors ${
          isRest
            ? "border-primary bg-primary/5"
            : "border-dashed border-border bg-card"
        }`}>
          <Server className={`h-5 w-5 mt-0.5 flex-shrink-0 ${isRest ? "text-primary" : "text-muted-foreground"}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Custom REST API</span>
              {isRest ? (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                  Active
                </span>
              ) : (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isRest ? config.restBaseUrl : "Laravel 11 · Sanctum · MySQL · cPanel / VPS"}
            </p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {isRest ? (
          <>
            <button
              onClick={() => setConfirming(true)}
              className="text-sm px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted transition-colors"
            >
              Edit REST URL
            </button>
            <button
              onClick={handleRevertToSupabase}
              className="text-sm px-3 py-1.5 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/5 transition-colors"
            >
              Revert to Supabase
            </button>
          </>
        ) : (
          <button
            onClick={() => { setShowDialog(true); setTestResult("idle"); }}
            className="text-sm px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted transition-colors flex items-center gap-1.5"
          >
            <Server className="h-3.5 w-3.5" />
            Configure REST API
          </button>
        )}
        <a
          href="https://github.com/FrankEWallace/gemstone-ledger"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted transition-colors flex items-center gap-1.5 text-muted-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Laravel API (DEPLOY.md)
        </a>
      </div>

      {/* Migration checklist (always visible as a guide) */}
      <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Migration checklist</p>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Deploy <code>mining-os-api</code> (Laravel 11) to cPanel or VPS — see <code>DEPLOY.md</code></li>
          <li>Create MySQL DB, run <code>php artisan migrate</code>, set <code>APP_KEY</code></li>
          <li>Set the base URL to <code>https://your-domain.com/api/v1</code></li>
          <li>Click "Configure REST API", paste the URL, and test the connection</li>
          <li>Flip the toggle — page reloads with Laravel as the active backend</li>
          <li>Both Supabase and Laravel backends are always available — switch anytime</li>
        </ol>
      </div>

      {/* Configure dialog (inline, no Radix Dialog to keep it simple) */}
      {(showDialog || confirming) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <h3 className="font-semibold">Configure REST Backend</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Switching backends reloads the app. Make sure the PHP API is deployed and
              all service files are updated before activating in production.
            </p>

            <div className="space-y-2">
              <label className="text-sm font-medium">REST API Base URL</label>
              <input
                type="url"
                value={restUrl}
                onChange={(e) => { setRestUrl(e.target.value); setTestResult("idle"); }}
                placeholder="https://yoursite.com/api/v1"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">No trailing slash. Must be HTTPS in production.</p>
            </div>

            {/* Test connection */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleTest}
                disabled={testing || !restUrl.trim()}
                className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {testing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Server className="h-3.5 w-3.5" />
                )}
                {testing ? "Testing…" : "Test Connection"}
              </button>
              {testResult === "ok" && (
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Connected
                </span>
              )}
              {testResult === "fail" && (
                <span className="flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Failed
                </span>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { setShowDialog(false); setConfirming(false); setTestResult("idle"); }}
                className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleActivateRest}
                disabled={testResult !== "ok"}
                className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
              >
                Activate REST Provider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SystemSettingsPage() {
  const { orgId, activeRole } = useAuth();
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

      {/* Module configuration — admin only */}
      {activeRole === "admin" && (
        <>
          <Separator />
          <ModuleConfigSection />
        </>
      )}

      {/* Backend provider — admin only, inactive by default */}
      {activeRole === "admin" && (
        <>
          <Separator />
          <BackendProviderSection role={activeRole} />
        </>
      )}
    </div>
  );
}
