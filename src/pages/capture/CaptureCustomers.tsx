import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSite } from "@/hooks/useSite";
import { getCustomers } from "@/services/customers.service";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ChevronRight } from "lucide-react";

export default function CaptureCustomers() {
  const { activeSiteId } = useSite();
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["capture", "customers-page", activeSiteId],
    queryFn: () => getCustomers(activeSiteId!),
    enabled: !!activeSiteId,
  });

  return (
    <div className="p-4">
      <h1 className="mb-3 text-2xl font-bold">Customers</h1>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
      ) : customers.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No customers yet.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
          {customers.map((c, i) => (
            <Link
              key={c.id}
              to={`/capture/customers/${c.id}`}
              className={`flex items-center gap-3 px-3 py-3 ${i > 0 ? "border-t" : ""}`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.name}</div>
                {c.contact_phone && <div className="truncate text-xs text-muted-foreground">{c.contact_phone}</div>}
              </div>
              {c.type && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">{c.type}</span>}
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
