import { Link, useLocation } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown after signup when email confirmation is enabled and there is no
 * session yet (Register navigates here). The email is passed via router
 * state; the page still reads fine without it (e.g. after a refresh).
 */
export default function CheckEmail() {
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email;

  return (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <MailCheck className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link{email ? <> to <span className="font-medium text-foreground">{email}</span></> : null}.
          Click it to activate your account, then sign in.
        </p>
      </div>

      <div className="space-y-3">
        <Button asChild className="w-full">
          <Link to="/login">Go to sign in</Link>
        </Button>
        <p className="text-xs text-muted-foreground">
          Didn't get it? Check your spam folder, or{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            try signing up again
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
