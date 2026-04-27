import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pickaxe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z
  .object({
    fullName: z.string().min(2, "Enter your full name"),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type FormValues = z.infer<typeof schema>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function AcceptInvite() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    if (!user) return;
    setIsSubmitting(true);

    try {
      // 1. Set the password on their account (invited users have no password yet)
      const { error: pwErr } = await supabase.auth.updateUser({
        password: values.password,
      });
      if (pwErr) throw pwErr;

      // 2. Create profile + site role from the invite metadata
      const { error: rpcErr } = await supabase.rpc("handle_invited_user_signup", {
        p_user_id: user.id,
        p_full_name: values.fullName,
      });
      if (rpcErr) throw rpcErr;

      // 3. Refresh AuthContext so ProtectedRoute sees the new profile
      await refreshProfile();

      toast.success("Welcome! Your account is ready.");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Pickaxe className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">You've been invited</h1>
          <p className="text-sm text-muted-foreground text-center">
            Complete your account setup to join your team on FW Mining OS.
          </p>
          {user?.email && (
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {user.email}
            </span>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              placeholder="Jane Smith"
              autoFocus
              {...register("fullName")}
            />
            {errors.fullName && (
              <p className="text-xs text-destructive">{errors.fullName.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">Set a password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repeat password"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Setting up your account…</>
            ) : (
              "Complete setup"
            )}
          </Button>
        </form>

      </div>
    </div>
  );
}
