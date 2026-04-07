import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pickaxe, Loader2, FlaskConical } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { enterDemoMode } from "@/lib/demo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormValues = z.infer<typeof schema>;

export default function Login() {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";
  const [serverError, setServerError] = useState<string | null>(null);

  function handleTryDemo() {
    enterDemoMode();
    window.location.replace("/");
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setServerError(error.message);
    } else {
      // Full page reload instead of a SPA navigation — guarantees the JS module
      // graph, React Query cache, and any service worker state all start fresh
      // for the newly authenticated user. Prevents partially-hydrated UI.
      window.location.replace(redirect);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Pickaxe className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl font-bold">Sign in</h1>
        <p className="text-sm text-muted-foreground">Welcome back to FW Mining OS</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@miningco.com"
            autoComplete="email"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              to="/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        {serverError && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Link to="/register" className="font-medium text-foreground hover:underline">
          Create one
        </Link>
      </p>

      {/* Demo account */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleTryDemo}
        className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 text-primary px-4 py-3 text-sm font-semibold transition-colors"
      >
        <FlaskConical className="h-4 w-4" />
        Try Demo — no account needed
      </button>
      <p className="text-center text-xs text-muted-foreground -mt-2">
        Explore the full app with realistic mining data. Nothing is saved.
      </p>
    </div>
  );
}
