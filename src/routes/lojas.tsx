import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, DemoBanner } from "@/components/app-shell";
import { useAppStore, type StoreDraft } from "@/lib/data/app-store";
import { getStoreDataset, decliningChannelFor } from "@/lib/data/demo-dataset";
import { compareMetrics, delta } from "@/lib/analytics/metrics";
import { formatMoney, runDiagnostics } from "@/lib/diagnostics/rules";
import { CHANNEL_LABEL, type Currency, type Store } from "@/lib/domain/types";

export const Route = createFileRoute("/lojas")({
  head: () => ({
    meta: [
      { title: "Lojas conectadas — RevenuePilot" },
      {
        name: "description",
        content:
          "Crie, edite e troque de loja. Cada loja tem seu próprio conjunto de dados, métricas do período e oportunidades priorizadas.",
      },
      { property: "og:title", content: "Lojas conectadas — RevenuePilot" },
      {
        property: "og:description",
        content: "Multi-loja: métricas e oportunidades independentes por operação.",
      },
    ],
  }),
  component: StoresPage,
});

const EMPTY_DRAFT: StoreDraft = {
  name: "",
  segment: "",
  currency: "BRL",
  defaultPeriodDays: 30,
  monthlySessions: 30000,
  baselineConversionPct: 2.2,
  monthlyAdBudget: 60000,
};

function StoresPage() {
  const {
    stores,
    activeStoreId,
    setActiveStore,
    createStore,
    updateStore,
    deleteStore,
    settings,
    todayIso,
    log,
    hydrated,
  } = useAppStore();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<StoreDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);

  const summaries = useMemo(
    () =>
      stores.map((store) => {
        const dataset = getStoreDataset(store, todayIso);
        const { current, previous } = compareMetrics(dataset, todayIso, store.defaultPeriodDays);
        const opportunities = runDiagnostics(dataset, todayIso, settings);
        return {
          store,
          current,
          revenueChange: delta(current.revenue, previous.revenue),
          conversionChange: delta(current.conversionRate, previous.conversionRate),
          opportunities: opportunities.length,
          impact: opportunities.reduce((s, o) => s + o.estimatedImpact, 0),
          declining: decliningChannelFor(store),
        };
      }),
    [stores, todayIso, settings],
  );

  function submit() {
    if (!draft.name.trim()) {
      toast.error("Informe o nome da loja.");
      return;
    }
    if (editingId) {
      updateStore(editingId, draft);
      log("Loja atualizada", draft.name);
      toast.success("Loja atualizada.");
    } else {
      const created = createStore(draft);
      log("Loja criada", created.name);
      toast.success(`${created.name} criada e selecionada.`);
    }
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
  }

  function startEdit(store: Store) {
    setEditingId(store.id);
    setDraft({
      name: store.name,
      segment: store.segment,
      currency: store.currency,
      defaultPeriodDays: store.defaultPeriodDays,
      monthlySessions: store.monthlySessions,
      baselineConversionPct: store.baselineConversionPct,
      monthlyAdBudget: store.monthlyAdBudget,
      seed: store.seed,
    });
  }

  const field = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  const pctText = (v: number | null) =>
    v === null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

  return (
    <AppShell
      title="Lojas"
      description="Cada loja é um conjunto de dados independente: métricas, canais e oportunidades são calculados separadamente."
    >
      <DemoBanner />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {!hydrated ? (
            <p className="text-sm text-muted-foreground">Carregando lojas…</p>
          ) : (
            summaries.map((s) => (
              <article
                key={s.store.id}
                className={
                  s.store.id === activeStoreId
                    ? "rounded-xl border-2 border-primary bg-card p-5"
                    : "rounded-xl border border-border bg-card p-5"
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{s.store.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {s.store.segment || "Segmento não informado"} · {s.store.currency} · janela de{" "}
                      {s.store.defaultPeriodDays} dias
                    </p>
                  </div>
                  {s.store.id === activeStoreId ? (
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                      Loja ativa
                    </span>
                  ) : null}
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Receita do período</dt>
                    <dd className="font-semibold text-foreground">
                      {formatMoney(s.current.revenue, s.store.currency)}
                    </dd>
                    <dd className="text-xs text-muted-foreground">{pctText(s.revenueChange)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Conversão</dt>
                    <dd className="font-semibold text-foreground">
                      {(s.current.conversionRate * 100).toFixed(2)}%
                    </dd>
                    <dd className="text-xs text-muted-foreground">{pctText(s.conversionChange)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Oportunidades</dt>
                    <dd className="font-semibold text-foreground">{s.opportunities}</dd>
                    <dd className="text-xs text-muted-foreground">
                      {formatMoney(s.impact, s.store.currency)} estimados
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Canal em queda</dt>
                    <dd className="font-semibold text-foreground">{CHANNEL_LABEL[s.declining]}</dd>
                    <dd className="text-xs text-muted-foreground">detectado pelas regras</dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setActiveStore(s.store.id);
                      log("Loja selecionada", s.store.name);
                      navigate({ to: "/dashboard" });
                    }}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Abrir dashboard
                  </button>
                  <button
                    onClick={() => startEdit(s.store)}
                    className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      if (stores.length <= 1) {
                        toast.error("É preciso manter ao menos uma loja.");
                        return;
                      }
                      deleteStore(s.store.id);
                      log("Loja removida", s.store.name);
                      toast.success("Loja removida.");
                    }}
                    className="rounded-md border border-input px-3 py-1.5 text-sm text-destructive hover:bg-accent"
                  >
                    Remover
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <section className="h-fit rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">
            {editingId ? "Editar loja" : "Nova loja"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Os parâmetros abaixo alimentam o gerador determinístico de dados da loja.
          </p>

          <label className="mt-4 block text-xs text-muted-foreground">
            Nome
            <input
              className={field}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="mt-3 block text-xs text-muted-foreground">
            Segmento
            <input
              className={field}
              placeholder="Ex.: Beleza, Pet, Moda"
              value={draft.segment}
              onChange={(e) => setDraft({ ...draft, segment: e.target.value })}
            />
          </label>
          <label className="mt-3 block text-xs text-muted-foreground">
            Moeda
            <select
              className={field}
              value={draft.currency}
              onChange={(e) => setDraft({ ...draft, currency: e.target.value as Currency })}
            >
              <option value="BRL">BRL</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label className="mt-3 block text-xs text-muted-foreground">
            Período padrão (dias)
            <input
              type="number"
              min={7}
              max={90}
              className={field}
              value={draft.defaultPeriodDays}
              onChange={(e) =>
                setDraft({ ...draft, defaultPeriodDays: Math.max(7, Number(e.target.value) || 30) })
              }
            />
          </label>
          <label className="mt-3 block text-xs text-muted-foreground">
            Sessões por mês
            <input
              type="number"
              className={field}
              value={draft.monthlySessions}
              onChange={(e) =>
                setDraft({ ...draft, monthlySessions: Math.max(1000, Number(e.target.value) || 1000) })
              }
            />
          </label>
          <label className="mt-3 block text-xs text-muted-foreground">
            Conversão de referência (%)
            <input
              type="number"
              step="0.1"
              className={field}
              value={draft.baselineConversionPct}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  baselineConversionPct: Math.max(0.1, Number(e.target.value) || 1),
                })
              }
            />
          </label>
          <label className="mt-3 block text-xs text-muted-foreground">
            Investimento em mídia por mês
            <input
              type="number"
              className={field}
              value={draft.monthlyAdBudget}
              onChange={(e) =>
                setDraft({ ...draft, monthlyAdBudget: Math.max(0, Number(e.target.value) || 0) })
              }
            />
          </label>

          <div className="mt-4 flex gap-2">
            <button
              onClick={submit}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {editingId ? "Salvar alterações" : "Criar loja"}
            </button>
            {editingId ? (
              <button
                onClick={() => {
                  setEditingId(null);
                  setDraft(EMPTY_DRAFT);
                }}
                className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
