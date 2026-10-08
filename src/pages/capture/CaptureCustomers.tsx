import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSite } from "@/hooks/useSite";
import { getCustomers } from "@/services/customers.service";
import { invalidateCustomerCaches } from "@/lib/customerCache";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Plus, Users } from "lucide-react";
import { TypeBadge } from "./CustomerAvatar";
import EntityAvatar from "@/components/shared/EntityAvatar";
import AddCustomerDrawer from "./AddCustomerDrawer";

export default function CaptureCustomers() {
  const { activeSiteId } = useSite();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["capture", "customers-page", activeSiteId],
    queryFn: () => getCustomers(activeSiteId!),
    enabled: !!activeSiteId,
  });

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-display">Clients</h1>
        <button
          onClick={() => setAdding(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm active:scale-95"
          aria-label="Add client"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
      ) : customers.length === 0 ? (
        <div className="py-16 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Users className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground">No clients yet.</p>
          <button onClick={() => setAdding(true)} className="mt-3 text-sm font-medium text-primary">
            Add your first client
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
          {customers.map((c, i) => (
            <Link
              key={c.id}
              to={`/capture/clients/${c.id}`}
              className={`flex items-center gap-3 px-3 py-3 ${i > 0 ? "border-t" : ""}`}
            >
              <EntityAvatar name={c.name} seed={c.id} className="h-9 w-9 text-xs" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.name}</div>
                <div className="mt-0.5 flex items-center gap-2">
                  <TypeBadge type={c.type} />
                  {c.contact_phone && <span className="truncate text-xs text-muted-foreground">{c.contact_phone}</span>}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}

      <AddCustomerDrawer
        open={adding}
        onOpenChange={setAdding}
        onCreated={() => invalidateCustomerCaches(qc)}
      />
    </div>
  );
}
