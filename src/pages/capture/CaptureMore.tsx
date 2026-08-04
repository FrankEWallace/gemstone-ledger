import { Link } from "react-router-dom";
import { Check, Hammer, ShieldAlert, LayoutGrid, LogOut, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSite } from "@/hooks/useSite";

export default function CaptureMore() {
  const { signOut, userProfile, user } = useAuth();
  const { sites, activeSiteId, setActiveSite } = useSite();

  return (
    <div className="p-4">
      <h1 className="mb-3 text-2xl font-bold">More</h1>

      {/* Capture — secondary captures live in the full app */}
      <Section title="Capture">
        <RowLink to="/production" icon={<Hammer className="h-4 w-4" />} label="Log production" />
        <RowLink to="/safety" icon={<ShieldAlert className="h-4 w-4" />} label="Report incident" />
      </Section>

      {/* Site switcher */}
      {sites.length > 0 && (
        <Section title="Site">
          {sites.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActiveSite(s.id)}
              className={`flex w-full items-center gap-3 px-3 py-3 text-left ${i > 0 ? "border-t" : ""}`}
            >
              <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
              {s.id === activeSiteId && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          ))}
        </Section>
      )}

      <Section title="App">
        <RowLink to="/" icon={<LayoutGrid className="h-4 w-4" />} label="Open full app" />
      </Section>

      <button
        onClick={() => signOut()}
        className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-card px-3 py-3 text-left shadow-sm"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <LogOut className="h-4 w-4" />
        </span>
        <span className="font-medium text-destructive">Sign out</span>
      </button>

      <p className="mt-3 px-1 text-center text-xs text-muted-foreground">
        {userProfile?.full_name || user?.email}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="overflow-hidden rounded-2xl bg-card shadow-sm">{children}</div>
    </div>
  );
}

function RowLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 border-t px-3 py-3 first:border-t-0">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
