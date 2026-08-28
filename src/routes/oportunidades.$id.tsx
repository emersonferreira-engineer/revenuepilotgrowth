import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useAppStore } from "@/lib/data/app-store";
import { formatMoney } from "@/lib/diagnostics/rules";
import { requestAiAnalysis } from "@/lib/ai/n8n.functions";
import type { AiRecommendation, OpportunityStatus } from "@/lib/domain/types";

export const Route = createFileRoute("/oportunidades/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe da oportunidade — RevenuePilot" },
      {
        name: "description",
        content:
          "Diagnóstico, hipótese, evidências, riscos e métricas de sucesso de uma oportunidade, com análise de IA opcional e criação de plano de ação.",
      },
      { property: "og:title", content: "Detalhe da oportunidade — RevenuePilot" },
      {
        property: "og:description",
        content: "Evidências, riscos e próximo passo de uma oportunidade priorizada.",
      },
    ],
  }),
  component: OpportunityDetail,
});

const STATUSES: OpportunityStatus[] = ["nova", "revisada", "em_plano", "descartada"];

function demoRecommendation(title: string, diagnosis: string): AiRecommendation {
  return {
    diagnostico: diagnosis,
    hipotese: `Hipótese sintética gerada localmente para "${title}" porque nenhum webhook foi configurado.`,
    acao_recomendada:
      "Rodar um teste controlado de duas semanas na alavanca principal e medir contra o período anterior.",
    impacto_estimado: "Estimativa local baseada nas mesmas regras determinísticas do diagnóstico.",
    nivel_de_confianca: "baixo",
    dados_utilizados: ["Dataset demo sintético"],
    riscos: ["Resposta simulada: não substitui a análise real do modelo."],
    metricas_de_sucesso: ["Variação da métrica principal versus período anterior"],
  };
}

function OpportunityDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const {
    opportunities,
    statuses,
    setStatus,
    settings,
    aiResults,
    saveAiResult,
    createPlan,
    setImpactOverride,
    log,
    hydrated,
  } = useAppStore();

  const opportunity = opportunities.find((o) => o.id === id);
  const [loading, setLoading] = useState(false);
  const [impact, setImpact] = useState("");
  const [note, setNote] = useState("");

  if (!hydrated) {
    return (
      <AppShell title="Oportunidade">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </AppShell>
    );
  }

  if (!opportunity) {
    return (
      <AppShell title="Oportunidade não encontrada">
        <Link to="/oportunidades" className="text-sm text-primary hover:underline">
          Voltar para a lista
        </Link>
      </AppShell>
    );
  }

  const money = (v: number) => formatMoney(v, settings.currency);
  const ai = aiResults[opportunity.id];

  async function runAi() {
    if (!opportunity) return;
    setLoading(true);
    try {
      if (!settings.webhookUrl) {
        const result = demoRecommendation(opportunity.title, opportunity.diagnosis);
        saveAiResult(opportunity.id, result, "demo");
        log("Análise IA (demo)", opportunity.title);
        toast.warning("Sem webhook configurado: resposta simulada em modo demonstração.");
        return;
      }
      const response = await requestAiAnalysis({
        data: {
          webhookUrl: settings.webhookUrl,
          payload: {
            store_id: settings.storeName,
            periodo: {
              inicio: opportunity.periodLabel,
              fim: opportunity.periodLabel,
              comparacao: "periodo anterior equivalente",
            },
            tipo_de_oportunidade: opportunity.category,
            metricas: { impacto_estimado: opportunity.estimatedImpact },
            evidencias: opportunity.evidences.map((e) => ({ label: e.label, value: e.value })),
            pergunta_de_analise: `${opportunity.title}. ${opportunity.hypothesis}`,
          },
        },
      });
      if (response.ok) {
        saveAiResult(opportunity.id, response.result, "n8n");
        log("Análise IA (n8n)", opportunity.title);
        toast.success("Análise recebida do n8n.");
      } else {
        toast.error(response.error, { description: response.detail });
      }
    } catch (error) {
      toast.error("Falha ao chamar a análise.", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title={opportunity.title} description={opportunity.diagnosis}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Hipótese e recomendação</h2>
            <p className="mt-2 text-sm text-muted-foreground">{opportunity.hypothesis}</p>
            <p className="mt-3 text-sm text-foreground">{opportunity.recommendation}</p>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Evidências</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {opportunity.evidences.map((e) => (
                <li key={e.label} className="flex flex-wrap justify-between gap-2 border-b border-border pb-2">
                  <span className="text-muted-foreground">{e.label}</span>
                  <span className="font-medium text-foreground">
                    {e.value}
                    {e.comparison ? ` (${e.comparison})` : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Dados usados: {opportunity.dataUsed.join("; ")}. Registros:{" "}
              {opportunity.recordRefs.join("; ")}.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Riscos e métricas de sucesso</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 text-sm">
              <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                {opportunity.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
                {opportunity.successMetrics.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-foreground">Análise de IA</h2>
              <button
                onClick={runAi}
                disabled={loading}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {loading ? "Analisando…" : "Gerar análise"}
              </button>
            </div>
            {!settings.webhookUrl ? (
              <p className="mt-2 text-xs text-warning-foreground">
                Nenhum webhook n8n configurado — a análise será simulada localmente. Configure em{" "}
                <Link to="/configuracoes" className="underline">
                  Configurações
                </Link>
                .
              </p>
            ) : null}
            {ai ? (
              <div className="mt-4 space-y-2 rounded-lg border border-border p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Origem: {ai.source === "n8n" ? "webhook n8n" : "simulação demo"} ·{" "}
                  {new Date(ai.at).toLocaleString("pt-BR")}
                </p>
                <p>
                  <strong>Diagnóstico:</strong> {ai.result.diagnostico}
                </p>
                <p>
                  <strong>Hipótese:</strong> {ai.result.hipotese}
                </p>
                <p>
                  <strong>Ação:</strong> {ai.result.acao_recomendada}
                </p>
                <p>
                  <strong>Impacto:</strong> {ai.result.impacto_estimado} (confiança:{" "}
                  {ai.result.nivel_de_confianca})
                </p>
                <p className="text-muted-foreground">
                  Riscos: {ai.result.riscos.join("; ") || "não informados"}
                </p>
                <p className="text-muted-foreground">
                  Métricas: {ai.result.metricas_de_sucesso.join("; ")}
                </p>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Impacto estimado
            </p>
            <p className="mt-1 text-2xl font-semibold text-primary">
              {money(opportunity.estimatedImpact)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{opportunity.impactBasis}</p>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Status</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStatus(opportunity.id, s);
                    log("Status alterado", `${opportunity.title} → ${s}`);
                  }}
                  className={
                    (statuses[opportunity.id] ?? "nova") === s
                      ? "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                      : "rounded-md border border-input px-3 py-1.5 text-xs text-foreground hover:bg-accent"
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Editar hipótese de impacto</h2>
            <input
              value={impact}
              onChange={(e) => setImpact(e.target.value)}
              inputMode="decimal"
              placeholder="Novo impacto estimado"
              className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Premissa usada"
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              onClick={() => {
                const parsed = Number(impact.replace(",", "."));
                if (!Number.isFinite(parsed) || parsed < 0) {
                  toast.error("Informe um valor numérico válido.");
                  return;
                }
                setImpactOverride(opportunity.id, parsed, note || "Premissa não descrita");
                log("Impacto editado", `${opportunity.title} → ${parsed}`);
                toast.success("Hipótese de impacto atualizada.");
              }}
              className="mt-3 w-full rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              Salvar hipótese
            </button>
          </section>

          <button
            onClick={() => {
              const plan = createPlan(opportunity);
              log("Plano criado", opportunity.title);
              toast.success("Plano de ação criado.");
              navigate({ to: "/planos", hash: plan.id });
            }}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Criar plano de ação
          </button>
        </aside>
      </div>
    </AppShell>
  );
}
