import { Badge } from "@/components/ui/badge";
import { statusVariant, statusLabel } from "@/lib/status";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  /** Overrides the auto-generated label derived from the status key. */
  label?: string;
  className?: string;
}

export default function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <Badge variant={statusVariant(status)} className={cn("font-medium", className)}>
      {label ?? statusLabel(status)}
    </Badge>
  );
}
