import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Pickaxe } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { createSite } from "@/services/sites.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Full-screen first-run step shown when a signed-in user has no site yet.
 * One required field (site name) keeps onboarding friction near zero; on
 * success the new site becomes active and the app loads normally.
 */
export default function FirstSiteSetup() {
  const { setActiveSite, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: () => createSite(name, location),
    onSuccess: async (siteId) => {
      await refreshProfile();
      setActiveSite(siteId);
      toast.success("Site created — welcome aboard!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Enter a site name.");
      return;
    }
    mutate();
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Pickaxe className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-display">Create your first site</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            A site is where you track production, inventory, team, and finances.
            You can add more sites anytime.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="first-site-name">Site name</Label>
            <Input
              id="first-site-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main Pit"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="first-site-location">
              Location <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="first-site-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Geita, Tanzania"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creating…" : "Create site"}
          </Button>
        </form>

        <button
          type="button"
          onClick={signOut}
          className="mt-4 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
