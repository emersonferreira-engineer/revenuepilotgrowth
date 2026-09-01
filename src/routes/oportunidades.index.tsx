import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, DemoBanner } from "@/components/app-shell";
import { useAppStore } from "@/lib/data/app-store";
import { formatMoney } from "@/lib/diagnostics/rules";
import type { OpportunityCategory, OpportunityStatus } from "@/lib/domain/types";

export const Route = createFileRoute("/oportunidades/")({
  head: () => ({
    meta: [
      { title: "Oportunidades priorizadas — RevenuePilot" },
      {
        name: "description",
        content:
          "Lista de diagnósticos priorizados por impacto estimado, com esforço, confiança e evidências que sustentam cada hipótese.",
      },
      { property: "og:title", content: "Oportunidades priorizadas — RevenuePilot" },
      {
        property: "og:description",
        content: "Diagnósticos ordenados por impacto estimado, esforço e nível de confiança.",
      },
    ],
  }),
  component: OpportunitiesPage,
});

const CATEGORY_LABEL: Record<OpportunityCategory, string> = {
  conversao: "Conversão",
  aquisicao: "Aquisição",
  produto: "Produto",
  retencao: "Retenção",
};

export const STATUS_LABEL: Record<OpportunityStatus, string> = {
  nova: "Nova",
  revisada: "Revisada",
  em_plano: "Em plano",
  descartada: "Descartada",
};

function OpportunitiesPage() {
  const { opportunities, statuses, activeStore, hydrated } = useAppStore();
  const [category, setCategory] = useState<"todas" | OpportunityCategory>("todas");

  const list = opportunities.filter((o) => category === "todas" || o.category === category);
  const money = (v: number) => formatMoney(v, activeStore.currency);

  return (
    <AppShell
      title={`Oportunidades — ${activeStore.name}`}
      description="Ordenadas por impacto estimado. Cada item declara a evidência usada, o esforço e o nível de confiança."
    >
      <DemoBanner />

      <div className="mb-4 flex flex-wrap gap-2">
        {(["todas", "conversao", "aquisicao", "produto", "retencao"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={
              category === c
                ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                : "rounded-md border border-input px-3 py-1.5 text-sm text-foreground hover:bg-accent"
            }
          >
            {c === "todas" ? "Todas" : CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {!hydrated ? (
        <p className="text-sm text-muted-foreground">Calculando diagnósticos…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma oportunidade nesta categoria.</p>
      ) : (
        <div className="space-y-4">
          {list.map((o) => (
            <article key={o.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                      {CATEGORY_LABEL[o.category]}
                    </span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                      {STATUS_LABEL[statuses[o.id] ?? "nova"]}
                    </span>
                  </div>
                  <h2 className="mt-2 text-base font-semibold text-foreground">{o.title}</h2>
                  <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{o.diagnosis}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-primary">{money(o.estimatedImpact)}</p>
                  <p className="text-xs text-muted-foreground">impacto estimado</p>
                </div>
              </div>

              <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Esforço</dt>
                  <dd className="font-medium text-foreground">{o.effort}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Confiança</dt>
                  <dd className="font-medium text-foreground">{o.confidence}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Período</dt>
                  <dd className="font-medium text-foreground">{o.periodLabel}</dd>
                </div>
              </dl>

              <div className="mt-4">
                <Link
                  to="/oportunidades/$id"
                  params={{ id: o.id }}
                  className="inline-flex rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Abrir detalhe
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
