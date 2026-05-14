import { User, ChevronDown } from "lucide-react";

interface CustomerSelectProps {
  customers: { id: string; name: string }[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
}

export default function CustomerSelect({
  customers,
  value,
  onChange,
  placeholder = "All customers",
}: CustomerSelectProps) {
  if (!customers.length) return null;
  return (
    <div className="relative flex items-center">
      <User className="absolute left-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-9 rounded-lg border border-border bg-card pl-8 pr-8 text-sm appearance-none cursor-pointer hover:border-foreground/30 transition-colors focus:outline-none focus:ring-1 focus:ring-ring max-w-[180px] text-foreground"
      >
        <option value="">{placeholder}</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
    </div>
  );
}
