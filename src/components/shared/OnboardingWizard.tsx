import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2, ChevronRight, Pickaxe, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── Steps config ─────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Organisation" },
  { id: 2, label: "First Site" },
  { id: 3, label: "Invite" },
  { id: 4, label: "Inventory" },
];

// ─── Schemas ─────────────────────────────────────────────────────────────────

const orgSchema = z.object({
  org_name: z.string().min(2, "At least 2 characters"),
  org_slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
});

const siteSchema = z.object({
  site_name:     z.string().min(2, "At least 2 characters"),
  site_location: z.string().optional(),
});

const inviteSchema = z.object({
  invite_email: z.string().email("Valid email required").or(z.literal("")),
});

const inventorySchema = z.object({
  item_name:     z.string().min(1, "Name is required").or(z.literal("")),
  item_quantity: z.coerce.number().min(0).optional(),
  item_unit:     z.string().optional(),
});

// ─── Step components ─────────────────────────────────────────────────────────

function StepOrg({ onNext }: { onNext: (orgId: string) => void }) {
  const { user } = useAuth();
  const form = useForm<z.infer<typeof orgSchema>>({
    resolver: zodResolver(orgSchema),
    defaultValues: { org_name: "", org_slug: "" },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(values: z.infer<typeof orgSchema>) {
    setIsSubmitting(true);
    try {
      const { data: existing } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", values.org_slug)
        .single();
      if (existing) { form.setError("org_slug", { message: "Slug already taken" }); return; }

      const { data: org, error } = await supabase
        .from("organizations")
        .insert({ name: values.org_name, slug: values.org_slug })
        .select()
        .single();
      if (error) throw error;

      await supabase
        .from("user_profiles")
        .update({ org_id: org.id })
        .eq("id", user!.id);

      await supabase
        .from("org_members")
        .insert({ org_id: org.id, user_id: user!.id, role: "admin" });

      onNext(org.id);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="org_name" render={({ field }) => (
          <FormItem>
            <FormLabel>Organisation Name *</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. FW Mining Co."
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  const slug = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                  form.setValue("org_slug", slug);
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="org_slug" render={({ field }) => (
          <FormItem>
            <FormLabel>URL Slug *</FormLabel>
            <FormControl>
              <Input placeholder="fw-mining-co" {...field} />
            </FormControl>
            <FormMessage />
            <p className="text-xs text-muted-foreground">Used in your workspace URL. Lowercase, hyphens only.</p>
          </FormItem>
        )} />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create Organisation"}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </form>
    </Form>
  );
}

function StepSite({ orgId, onNext }: { orgId: string; onNext: (siteId: string) => void }) {
  const { user } = useAuth();
  const form = useForm<z.infer<typeof siteSchema>>({
    resolver: zodResolver(siteSchema),
    defaultValues: { site_name: "", site_location: "" },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(values: z.infer<typeof siteSchema>) {
    setIsSubmitting(true);
    try {
      const { data: site, error } = await supabase
        .from("sites")
        .insert({ org_id: orgId, name: values.site_name, location: values.site_location || null })
        .select()
        .single();
      if (error) throw error;

      await supabase
        .from("site_roles")
        .insert({ site_id: site.id, user_id: user!.id, role: "admin" });

      onNext(site.id);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="site_name" render={({ field }) => (
          <FormItem>
            <FormLabel>Site Name *</FormLabel>
            <FormControl><Input placeholder="e.g. North Pit Mine" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="site_location" render={({ field }) => (
          <FormItem>
            <FormLabel>Location</FormLabel>
            <FormControl><Input placeholder="e.g. Kalgoorlie, WA" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create Site"}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </form>
    </Form>
  );
}

function StepInvite({ siteId, onNext, onSkip }: { siteId: string; onNext: () => void; onSkip: () => void }) {
  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { invite_email: "" },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(values: z.infer<typeof inviteSchema>) {
    if (!values.invite_email) { onSkip(); return; }
    setIsSubmitting(true);
    try {
      await supabase.functions.invoke("invite-user", {
        body: { email: values.invite_email, site_id: siteId, role: "worker" },
      });
      toast.success(`Invitation sent to ${values.invite_email}`);
      onNext();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="invite_email" render={({ field }) => (
          <FormItem>
            <FormLabel>Team Member Email</FormLabel>
            <FormControl><Input type="email" placeholder="colleague@company.com" {...field} /></FormControl>
            <FormMessage />
            <p className="text-xs text-muted-foreground">They'll receive an invite link to join your site.</p>
          </FormItem>
        )} />

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onSkip}>
            Skip for now
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send Invite"}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </form>
    </Form>
  );
}

function StepInventory({ siteId, onDone }: { siteId: string; onDone: () => void }) {
  const form = useForm<z.infer<typeof inventorySchema>>({
    resolver: zodResolver(inventorySchema),
    defaultValues: { item_name: "", item_quantity: 0, item_unit: "" },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(values: z.infer<typeof inventorySchema>) {
    if (!values.item_name) { onDone(); return; }
    setIsSubmitting(true);
    try {
      await supabase.from("inventory_items").insert({
        site_id: siteId,
        name: values.item_name,
        quantity: values.item_quantity ?? 0,
        unit: values.item_unit || null,
      });
      toast.success("First inventory item added!");
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="item_name" render={({ field }) => (
          <FormItem>
            <FormLabel>Item Name</FormLabel>
            <FormControl><Input placeholder="e.g. Safety Helmets" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="item_quantity" render={({ field }) => (
            <FormItem>
              <FormLabel>Quantity</FormLabel>
              <FormControl><Input type="number" min={0} {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="item_unit" render={({ field }) => (
            <FormItem>
              <FormLabel>Unit</FormLabel>
              <FormControl><Input placeholder="pcs, kg, L…" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onDone}>
            Skip for now
          </Button>
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? "Adding…" : "Add Item & Finish"}
            <CheckCircle2 className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

interface OnboardingWizardProps {
  onComplete: () => void;
}

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { user, userProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [orgId, setOrgId] = useState<string>("");
  const [siteId, setSiteId] = useState<string>("");

  const firstName = userProfile?.full_name?.split(" ")[0] ?? null;

  function advance(nextStep: number) {
    setDirection("forward");
    setStep(nextStep);
  }

  async function markComplete() {
    await supabase
      .from("user_profiles")
      .update({ onboarding_completed: true })
      .eq("id", user!.id);
    onComplete();
  }

  const slideClass = direction === "forward"
    ? "animate-in slide-in-from-right-4 fade-in duration-300"
    : "animate-in slide-in-from-left-4 fade-in duration-300";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />

      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">

        {/* ── Welcome screen (step 0) ── */}
        {step === 0 && (
          <div
            key="welcome"
            className={cn("px-8 py-10 flex flex-col items-center text-center gap-5", slideClass)}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <Pickaxe className="h-8 w-8" />
            </div>

            <div className="space-y-1.5">
              <h1 className="font-display text-2xl font-bold">
                Welcome{firstName ? `, ${firstName}` : ""}!
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Let's get your FW Mining OS workspace ready.<br />
                It only takes a couple of minutes.
              </p>
            </div>

            {/* What to expect */}
            <div className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-left space-y-2">
              {[
                "Name your organisation",
                "Add your first mining site",
                "Invite a team member (optional)",
                "Log your first inventory item (optional)",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                    {i + 1}
                  </span>
                  {item}
                </div>
              ))}
            </div>

            <Button className="w-full" size="lg" onClick={() => advance(1)}>
              Let's get started
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* ── Setup steps (1–4) ── */}
        {step >= 1 && (
          <>
            {/* Header with progress */}
            <div className="bg-primary px-6 py-5 text-primary-foreground">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/20">
                  <Pickaxe className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display font-bold text-lg leading-tight">FW Mining OS</p>
                  <p className="text-xs text-primary-foreground/70">Setting up your workspace</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {STEPS.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-1 flex-1">
                    <div className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0 transition-all duration-300",
                      step > s.id
                        ? "bg-primary-foreground text-primary"
                        : step === s.id
                        ? "bg-primary-foreground/30 text-primary-foreground ring-2 ring-primary-foreground"
                        : "bg-primary-foreground/10 text-primary-foreground/40"
                    )}>
                      {step > s.id ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.id}
                    </div>
                    <span className={cn(
                      "text-[10px] font-medium hidden sm:block transition-colors duration-300",
                      step === s.id ? "text-primary-foreground" : "text-primary-foreground/40"
                    )}>
                      {s.label}
                    </span>
                    {i < STEPS.length - 1 && (
                      <div className={cn(
                        "h-px flex-1 mx-1 transition-colors duration-500",
                        step > s.id ? "bg-primary-foreground/60" : "bg-primary-foreground/20"
                      )} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <div
                key={step}
                className={cn(slideClass)}
              >
                <div className="mb-4">
                  <h2 className="font-semibold text-base">
                    {step === 1 && "Name your organisation"}
                    {step === 2 && "Add your first mining site"}
                    {step === 3 && "Invite a team member"}
                    {step === 4 && "Add your first inventory item"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {step === 1 && "This is the top-level workspace for your company."}
                    {step === 2 && "Sites are the individual mine locations you manage."}
                    {step === 3 && "You can always invite more people later from Management."}
                    {step === 4 && "Start tracking your supplies. You can import a CSV later."}
                  </p>
                </div>

                {step === 1 && (
                  <StepOrg onNext={(id) => { setOrgId(id); advance(2); }} />
                )}
                {step === 2 && (
                  <StepSite orgId={orgId} onNext={(id) => { setSiteId(id); advance(3); }} />
                )}
                {step === 3 && (
                  <StepInvite siteId={siteId} onNext={() => advance(4)} onSkip={() => advance(4)} />
                )}
                {step === 4 && (
                  <StepInventory siteId={siteId} onDone={markComplete} />
                )}
              </div>
            </div>

            {/* Skip all */}
            {step < 4 && (
              <div className="px-6 pb-4 text-center">
                <button
                  onClick={markComplete}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Skip setup — I'll do this later
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
