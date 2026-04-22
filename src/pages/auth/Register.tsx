import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Pickaxe,
  ArrowRight,
  Loader2,
  ChevronLeft,
  Mountain,
  Users,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const step1Schema = z
  .object({
    fullName: z.string().min(2, "Enter your full name"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const step2Schema = z.object({
  orgName: z.string().min(2, "Enter your organization name"),
});

type Step1Values = z.infer<typeof step1Schema>;
type Step2Values = z.infer<typeof step2Schema>;

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ─── Brand panel content ─────────────────────────────────────────────────────

const FEATURES = [
  { icon: Mountain, text: "Track inventory across multiple mine sites" },
  { icon: BarChart3, text: "Real-time reports on revenue and expenses" },
  { icon: Users, text: "Collaborate with your team from anywhere" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [step1Data, setStep1Data] = useState<Step1Values | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const form1 = useForm<Step1Values>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2Values>({ resolver: zodResolver(step2Schema) });

  function onStep1(values: Step1Values) {
    setStep1Data(values);
    setStep(2);
  }

  async function onStep2(values: Step2Values) {
    if (!step1Data) return;
    setServerError(null);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: step1Data.email,
      password: step1Data.password,
    });

    if (authError || !authData.user) {
      setServerError(authError?.message ?? "Sign up failed");
      return;
    }

    const userId = authData.user.id;
    const needsConfirmation = !authData.session;

    const { error: setupError } = await supabase.rpc("handle_new_user_signup", {
      p_user_id: userId,
      p_full_name: step1Data.fullName,
      p_org_name: values.orgName,
      p_org_slug: slugify(values.orgName),
    });

    if (setupError) {
      setServerError(setupError.message);
      return;
    }

    if (needsConfirmation) {
      navigate("/check-email", { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }

  const orgNameValue = form2.watch("orgName") ?? "";
  const slugPreview = slugify(orgNameValue);

  return (
    <div className="flex min-h-screen">
      {/* ── Left: brand panel ── */}
      <div className="hidden lg:flex lg:w-[400px] xl:w-[460px] shrink-0 flex-col justify-between bg-[#0f1117] p-10 text-white">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Pickaxe className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">FW Mining OS</span>
        </div>

        {/* Pitch */}
        <div className="space-y-8">
          <div className="space-y-3">
            <h1 className="font-display text-[2rem] font-bold leading-tight">
              Mining operations,<br />organized.
            </h1>
            <p className="text-sm text-white/55 leading-relaxed">
              From gemstone inventory to team management — everything your operation needs, in one place.
            </p>
          </div>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10">
                  <Icon className="h-3.5 w-3.5 text-white/70" />
                </div>
                <span className="text-sm text-white/60 leading-relaxed">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/25">© 2025 FW Mining OS. All rights reserved.</p>
      </div>

      {/* ── Right: form panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-background">
        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-8 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Pickaxe className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold">FW Mining OS</span>
        </div>

        <div className="w-full max-w-sm space-y-7">
          {/* Step progress */}
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-500",
                step >= 1 ? "bg-primary" : "bg-border"
              )}
            />
            <div
              className={cn(
                "h-1 flex-1 rounded-full transition-colors duration-500",
                step >= 2 ? "bg-primary" : "bg-border"
              )}
            />
          </div>

          {/* ── Step 1: Account ── */}
          {step === 1 && (
            <div
              key="step1"
              className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300"
            >
              <div>
                <h2 className="font-display text-2xl font-bold">Create your account</h2>
                <p className="text-sm text-muted-foreground mt-1">Step 1 of 2 — your personal details</p>
              </div>

              <form onSubmit={form1.handleSubmit(onStep1)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input id="fullName" placeholder="John Doe" {...form1.register("fullName")} />
                  {form1.formState.errors.fullName && (
                    <p className="text-xs text-destructive">{form1.formState.errors.fullName.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@miningco.com"
                    autoComplete="email"
                    {...form1.register("email")}
                  />
                  {form1.formState.errors.email && (
                    <p className="text-xs text-destructive">{form1.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    {...form1.register("password")}
                  />
                  {form1.formState.errors.password && (
                    <p className="text-xs text-destructive">{form1.formState.errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    {...form1.register("confirmPassword")}
                  />
                  {form1.formState.errors.confirmPassword && (
                    <p className="text-xs text-destructive">
                      {form1.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full">
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-foreground hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          )}

          {/* ── Step 2: Organization ── */}
          {step === 2 && (
            <div
              key="step2"
              className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300"
            >
              <div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="mb-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
                <h2 className="font-display text-2xl font-bold">Set up your workspace</h2>
                <p className="text-sm text-muted-foreground mt-1">Step 2 of 2 — your organization</p>
              </div>

              <form onSubmit={form2.handleSubmit(onStep2)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="orgName">Organization name</Label>
                  <Input
                    id="orgName"
                    placeholder="FW Mining Co."
                    {...form2.register("orgName")}
                  />
                  {form2.formState.errors.orgName && (
                    <p className="text-xs text-destructive">{form2.formState.errors.orgName.message}</p>
                  )}
                  {slugPreview && (
                    <p className="text-xs text-muted-foreground">
                      Workspace ID:{" "}
                      <span className="font-mono text-foreground">{slugPreview}</span>
                    </p>
                  )}
                </div>

                {serverError && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {serverError}
                  </p>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={form2.formState.isSubmitting}
                >
                  {form2.formState.isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create account
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
