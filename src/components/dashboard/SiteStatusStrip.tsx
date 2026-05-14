import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { isPast, parseISO } from "date-fns";
import { Wrench, ShieldAlert, AlertTriangle } from "lucide-react";
import { getEquipment } from "@/services/equipment.service";
import { getSafetyIncidents } from "@/services/safety.service";

export default function SiteStatusStrip({ siteId }: { siteId: string }) {
  const { data: equipment = [] } = useQuery({
    queryKey: ["equipment", siteId],
    queryFn: () => getEquipment(siteId),
  });
  const { data: incidents = [] } = useQuery({
    queryKey: ["safety-incidents", siteId],
    queryFn: () => getSafetyIncidents(siteId),
  });

  const overdue = equipment.filter(
    (e) => e.next_service_date && isPast(parseISO(e.next_service_date)) && e.status !== "retired"
  ).length;
  const operational = equipment.filter((e) => e.status === "operational").length;
  const openIncidents = incidents.filter((i) => !i.resolved_at).length;
  const criticalIncidents = incidents.filter((i) => !i.resolved_at && i.severity === "critical").length;

  const cells = [
    {
      icon: ShieldAlert,
      label: "Safety",
      value:
        openIncidents === 0
          ? "All clear"
          : `${openIncidents} open${criticalIncidents > 0 ? ` · ${criticalIncidents} critical` : ""}`,
      alert: criticalIncidents > 0,
      href: "/safety",
    },
    {
      icon: Wrench,
      label: "Equipment",
      value: `${operational} operational${overdue > 0 ? ` · ${overdue} overdue` : ""}`,
      alert: overdue > 0,
      href: "/equipment",
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-2 divide-x divide-border">
        {cells.map((cell) => (
          <Link
            key={cell.label}
            to={cell.href}
            className="flex items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors"
          >
            <cell.icon
              className={`h-4 w-4 shrink-0 ${cell.alert ? "text-yellow-500" : "text-muted-foreground"}`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{cell.label}</p>
              <p className="text-sm font-semibold truncate mt-0.5">{cell.value}</p>
            </div>
            {cell.alert && <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />}
          </Link>
        ))}
      </div>
    </div>
  );
}
