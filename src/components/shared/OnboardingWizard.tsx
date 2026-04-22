import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronDown, ChevronUp, ChevronRight, Pickaxe } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// ─── Steps ───────────────────────────────────────────────────────────────────

interface Step {
  id: number;
  label: string;
  href?: string;
}

const STEPS: Step[] = [
  { id: 1, label: "Create your account" },
  { id: 2, label: "Set up your organization" },
  { id: 3, label: "Add your first mining site" },
  { id: 4, label: "Invite a team member", href: "/team" },
  { id: 5, label: "Log your first inventory item", href: "/inventory" },
];

// ─── Component ───────────────────────────────────────────────────────────────

interface OnboardingWizardProps {
  onComplete: () => void;
}

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { user, userProfile, sites } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);
  const [dismissing, setDismissing] = useState(false);

  // Derive completion from auth context — no extra queries needed
  const completedIds = new Set<number>([1]); // always: account exists
  if (userProfile?.org_id) completedIds.add(2);
  if (sites && sites.length > 0) completedIds.add(3);

  const completedCount = completedIds.size;
  const total = STEPS.length;

  // First incomplete step drives the "current" visual
  const currentStepId = STEPS.find((s) => !completedIds.has(s.id))?.id ?? total + 1;

  async function dismiss() {
    setDismissing(true);
    await supabase
      .from("user_profiles")
      .update({ onboarding_completed: true })
      .eq("id", user!.id);
    onComplete();
  }

  function handleStepClick(step: Step) {
    if (completedIds.has(step.id) || !step.href) return;
    navigate(step.href);
  }

  return (
    <div className="mx-4 lg:mx-6 mt-4 mb-1 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* ── Collapsible header ── */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 shrink-0">
          <Pickaxe className="h-3.5 w-3.5 text-primary" />
        </div>

        <span className="font-semibold text-sm flex-1 text-left">Getting started</span>

        {/* Segmented progress bar */}
        <div className="flex items-center gap-[3px] mr-2">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={cn(
                "h-[5px] w-5 rounded-full transition-colors duration-300",
                completedIds.has(s.id) ? "bg-emerald-500" : "bg-muted"
              )}
            />
          ))}
        </div>

        <span className="text-xs font-medium tabular-nums text-muted-foreground shrink-0 mr-2">
          {completedCount}/{total}
        </span>

        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* ── Checklist ── */}
      {expanded && (
        <div className="border-t border-border">
          {STEPS.map((step) => {
            const done = completedIds.has(step.id);
            const isCurrent = step.id === currentStepId;
            const clickable = !done && !!step.href;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepClick(step)}
                disabled={!clickable}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border/50 last:border-b-0 transition-colors",
                  clickable ? "hover:bg-muted/30" : "cursor-default"
                )}
              >
                {/* Indicator */}
                {done ? (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                ) : (
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
                      isCurrent
                        ? "bg-foreground text-background"
                        : "border-2 border-border text-muted-foreground"
                    )}
                  >
                    {step.id}
                  </div>
                )}

                <span
                  className={cn(
                    "flex-1 text-sm",
                    done
                      ? "text-muted-foreground line-through decoration-muted-foreground/50"
                      : isCurrent
                      ? "font-medium text-foreground"
                      : "text-foreground/70"
                  )}
                >
                  {step.label}
                </span>

                {clickable && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>
            );
          })}

          {/* Dismiss */}
          <div className="px-4 py-2.5 bg-muted/20">
            <button
              type="button"
              onClick={dismiss}
              disabled={dismissing}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {dismissing ? "Dismissing…" : "Dismiss — I'll explore on my own"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
