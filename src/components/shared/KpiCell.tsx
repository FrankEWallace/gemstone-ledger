/**
 * One column of a KPI summary strip — a single bordered/divided card holding
 * several of these, instead of a separate boxed StatCard per metric.
 */
export default function KpiCell({ label, value, sub, color }: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="p-4 flex flex-col gap-1 min-w-0">
      <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
      <p
        className="font-display text-xl font-medium tracking-tight tabular-nums leading-none truncate"
        style={color ? { color } : undefined}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
    </div>
  );
}
