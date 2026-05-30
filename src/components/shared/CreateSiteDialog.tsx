import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { createSite } from "@/services/sites.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

/**
 * Add a new site to the org. On success activates the new site and refreshes
 * the user's site list. Owner/admin only (enforced by the create_site RPC).
 */
export default function CreateSiteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { setActiveSite, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  const { mutate, isPending } = useMutation({
    mutationFn: () => createSite(name, location),
    onSuccess: async (siteId) => {
      await refreshProfile();
      setActiveSite(siteId);
      toast.success("Site created.");
      setName("");
      setLocation("");
      onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a site</DialogTitle>
          <DialogDescription>
            Create another site for your organization. You'll be set as its admin.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-site-name">Site name</Label>
            <Input
              id="new-site-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. North Pit"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-site-location">
              Location <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="new-site-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Geita, Tanzania"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create site"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
