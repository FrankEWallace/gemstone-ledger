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
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm">
      {cells.map((cell) => (
        <Link
          key={cell.label}
          to={cell.href}
          className="flex items-center gap-2 hover:text-foreground transition-colors"
        >
          <cell.icon
            className={`h-4 w-4 shrink-0 ${cell.alert ? "text-warning" : "text-muted-foreground"}`}
          />
          <span className="text-muted-foreground">{cell.label}:</span>
          <span className="font-medium truncate">{cell.value}</span>
          {cell.alert && <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />}
        </Link>
      ))}
    </div>
  );
}
