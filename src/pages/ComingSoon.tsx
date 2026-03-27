import { Construction } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description?: string;
}

export default function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Construction className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <p className="text-muted-foreground max-w-sm">
        {description ?? "This module is coming in the next phase of development."}
      </p>
    </div>
  );
}
