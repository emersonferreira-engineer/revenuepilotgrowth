import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Gauge, Lightbulb, ListChecks, Upload, Settings, Info, Rocket, Store, Workflow } from "lucide-react";
import { useAppStore } from "@/lib/data/app-store";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/lojas", label: "Lojas", icon: Store },
  { to: "/oportunidades", label: "Oportunidades", icon: Lightbulb },
  { to: "/planos", label: "Planos de ação", icon: ListChecks },
  { to: "/importar", label: "Importar dados", icon: Upload },
  { to: "/integracao-n8n", label: "Integração n8n", icon: Workflow },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
  { to: "/sobre", label: "Sobre", icon: Info },
] as const;


export function AppShell({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Rocket className="h-4 w-4" />
            </span>
            RevenuePilot
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-primary-soft text-primary font-medium" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <StoreSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {description ? (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions}
        </div>
        {children}
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        MVP demonstrativo. Os dados são sintéticos e os impactos são estimativas, não garantias.
      </footer>
    </div>
  );
}

function StoreSwitcher() {
  const { stores, activeStoreId, setActiveStore, hydrated } = useAppStore();
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="hidden sm:inline">Loja</span>
      <select
        aria-label="Trocar de loja"
        value={activeStoreId}
        disabled={!hydrated}
        onChange={(e) => setActiveStore(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
      >
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DemoBanner() {
  return (
    <div className="mb-6 rounded-lg border border-warning bg-warning-soft px-4 py-3 text-sm text-foreground">
      <strong>Modo demonstração:</strong> os números vêm de um dataset sintético gerado
      deterministicamente. Impactos são estimativas com premissas explícitas.
    </div>
  );
}
