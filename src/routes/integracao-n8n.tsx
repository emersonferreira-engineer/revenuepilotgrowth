import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useAppStore } from "@/lib/data/app-store";
import { buildWindows, compareMetrics } from "@/lib/analytics/metrics";
import { testWebhook, type AnalysisPayload } from "@/lib/ai/n8n.functions";

export const Route = createFileRoute("/integracao-n8n")({
  head: () => ({
    meta: [
      { title: "Integração n8n passo a passo — RevenuePilot" },
      {
        name: "description",
        content:
          "Guia prático para montar o workflow n8n do RevenuePilot: nó Webhook, normalização do payload, chamada do modelo e resposta no contrato JSON esperado.",
      },
      { property: "og:title", content: "Integração n8n passo a passo — RevenuePilot" },
      {
        property: "og:description",
        content: "Webhook, normalização e resposta no contrato JSON, com o payload real da sua oportunidade.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: N8nGuide,
});

const NORMALIZE_CODE = `// n8n · nó "Code" chamado Normalizar entrada (Run Once for All Items)
const p = $json.body ?? $json;

const req = ["store_id", "periodo", "tipo_de_oportunidade", "metricas", "pergunta_de_analise"];
const faltando = req.filter((k) => p[k] === undefined || p[k] === null);
if (faltando.length) {
  throw new Error("Payload inválido do RevenuePilot. Campos ausentes: " + faltando.join(", "));
}

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
const m = p.metricas ?? {};

const evidencias = Array.isArray(p.evidencias) ? p.evidencias : [];

return [
  {
    json: {
      store_id: String(p.store_id),
      tipo_de_oportunidade: String(p.tipo_de_oportunidade),
      periodo: {
        inicio: p.periodo.inicio,
        fim: p.periodo.fim,
        comparacao: p.periodo.comparacao,
      },
      moeda: m.moeda ?? "BRL",
      metricas: {
        receita_atual: num(m.receita_atual),
        receita_anterior: num(m.receita_anterior),
        pedidos_atual: num(m.pedidos_atual),
        pedidos_anterior: num(m.pedidos_anterior),
        conversao_atual: num(m.conversao_atual),
        conversao_anterior: num(m.conversao_anterior),
        investimento_midia: num(m.investimento_midia),
        cac_atual: num(m.cac_atual),
        cac_anterior: num(m.cac_anterior),
        roas_atual: num(m.roas_atual),
        impacto_estimado: num(m.impacto_estimado),
      },
      evidencias_texto: evidencias.map((e) => e.label + ": " + e.value).join("\\n"),
      pergunta_de_analise: String(p.pergunta_de_analise),
    },
  },
];`;

const PROMPT_CODE = `Você é analista de crescimento de e-commerce DTC. Analise SOMENTE os dados abaixo,
sem inventar métricas ou integrações. Responda em português.

Loja: {{ $json.store_id }}
Tipo de oportunidade: {{ $json.tipo_de_oportunidade }}
Período: {{ $json.periodo.inicio }} a {{ $json.periodo.fim }} (comparado com {{ $json.periodo.comparacao }})
Moeda: {{ $json.moeda }}
Métricas: {{ JSON.stringify($json.metricas) }}
Evidências:
{{ $json.evidencias_texto }}

Pergunta: {{ $json.pergunta_de_analise }}

Regras obrigatórias:
- Trate impacto estimado como premissa, nunca como fato.
- Liste explicitamente os dados usados e os riscos da recomendação.
- Se os dados não sustentarem uma conclusão, diga isso e use nivel_de_confianca "baixo".
- Devolva APENAS um objeto JSON válido, sem markdown e sem texto fora do JSON.`;

const RESPONSE_CONTRACT = `{
  "diagnostico": "string — o que os dados mostram, com números",
  "hipotese": "string — causa mais provável",
  "acao_recomendada": "string — próximo passo executável",
  "impacto_estimado": "string — premissa e como foi calculada",
  "nivel_de_confianca": "baixo | medio | alto",
  "dados_utilizados": ["string", "..."],
  "riscos": ["string", "..."],
  "metricas_de_sucesso": ["string", "..."]
}`;

const RESPOND_CODE = `// n8n · nó "Code" chamado Validar saída (antes do Respond to Webhook)
const bruto = $json.output ?? $json.text ?? $json.message?.content ?? $json;
const dados = typeof bruto === "string" ? JSON.parse(bruto.replace(/^\`\`\`json|\`\`\`$/g, "").trim()) : bruto;

const obrigatorios = [
  "diagnostico",
  "hipotese",
  "acao_recomendada",
  "impacto_estimado",
  "nivel_de_confianca",
  "dados_utilizados",
  "riscos",
  "metricas_de_sucesso",
];
const faltando = obrigatorios.filter((k) => dados[k] === undefined);
if (faltando.length) throw new Error("Resposta fora do contrato. Ausentes: " + faltando.join(", "));

const niveis = ["baixo", "medio", "alto"];
if (!niveis.includes(dados.nivel_de_confianca)) dados.nivel_de_confianca = "baixo";

const lista = (v) => (Array.isArray(v) ? v.map(String) : [String(v)]);

return [
  {
    json: {
      diagnostico: String(dados.diagnostico),
      hipotese: String(dados.hipotese),
      acao_recomendada: String(dados.acao_recomendada),
      impacto_estimado: String(dados.impacto_estimado),
      nivel_de_confianca: dados.nivel_de_confianca,
      dados_utilizados: lista(dados.dados_utilizados),
      riscos: Array.isArray(dados.riscos) ? dados.riscos.map(String) : [],
      metricas_de_sucesso: lista(dados.metricas_de_sucesso),
    },
  },
];`;

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/50">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              toast.success("Copiado para a área de transferência.");
            } catch {
              toast.error("Não foi possível copiar. Selecione o texto manualmente.");
            }
          }}
          className="rounded-md border border-input bg-background px-2 py-1 text-xs font-medium hover:bg-accent"
        >
          Copiar
        </button>
      </div>
      <pre className="max-h-96 overflow-auto p-3 text-xs leading-relaxed">{code}</pre>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {n}
        </span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

function N8nGuide() {
  const { activeStore, dataset, opportunities, settings, todayIso, hydrated } = useAppStore();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const example = useMemo<{ payload: AnalysisPayload; title: string } | null>(() => {
    if (!hydrated) return null;
    const opportunity = opportunities[0];
    if (!opportunity) return null;
    const windows = buildWindows(todayIso, activeStore.defaultPeriodDays);
    const { current, previous } = compareMetrics(dataset, todayIso, activeStore.defaultPeriodDays);
    return {
      title: opportunity.title,
      payload: {
        store_id: activeStore.id,
        periodo: {
          inicio: windows.current.start,
          fim: windows.current.end,
          comparacao: windows.previous.label,
        },
        tipo_de_oportunidade: opportunity.category,
        metricas: {
          moeda: activeStore.currency,
          receita_atual: Math.round(current.revenue),
          receita_anterior: Math.round(previous.revenue),
          pedidos_atual: current.orders,
          pedidos_anterior: previous.orders,
          conversao_atual: Number((current.conversionRate * 100).toFixed(3)),
          conversao_anterior: Number((previous.conversionRate * 100).toFixed(3)),
          investimento_midia: Math.round(current.adSpend),
          cac_atual: current.cac === null ? null : Math.round(current.cac),
          cac_anterior: previous.cac === null ? null : Math.round(previous.cac),
          roas_atual: current.roas === null ? null : Number(current.roas.toFixed(2)),
          impacto_estimado: Math.round(opportunity.estimatedImpact),
        },
        evidencias: opportunity.evidences.map((e) => ({
          label: e.label,
          value: e.comparison ? `${e.value} (${e.comparison})` : e.value,
        })),
        pergunta_de_analise: `${opportunity.title}. ${opportunity.hypothesis} Qual a ação com maior retorno nos próximos 14 dias?`,
      },
    };
  }, [hydrated, opportunities, activeStore, dataset, todayIso]);

  async function runTest() {
    if (!settings.webhookUrl) {
      toast.error("Configure a URL do webhook em Configurações antes de testar.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testWebhook({ data: { webhookUrl: settings.webhookUrl } });
      setTestResult(`status ${res.status} — ${res.body || "sem corpo"}`);
      if (res.ok) toast.success("O webhook respondeu.");
      else toast.error("O webhook não respondeu com sucesso.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha inesperada.";
      setTestResult(message);
      toast.error("Falha ao chamar o webhook.", { description: message });
    } finally {
      setTesting(false);
    }
  }

  return (
    <AppShell
      title="Integração n8n passo a passo"
      description="Monte o workflow que recebe o payload do RevenuePilot, normaliza os dados, consulta o modelo e responde no contrato JSON esperado."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Step n={1} title="Criar o nó Webhook (entrada)">
            <p>
              No n8n: <strong>+ New workflow</strong> → adicione o nó <strong>Webhook</strong>.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>HTTP Method:</strong> POST
              </li>
              <li>
                <strong>Path:</strong> <code>revenuepilot-analise</code>
              </li>
              <li>
                <strong>Respond:</strong> <code>Using Respond to Webhook node</code> — sem isso o n8n
                responde antes da análise e o RevenuePilot recebe um JSON vazio.
              </li>
            </ul>
            <p>
              Copie a <strong>Production URL</strong> e cole em{" "}
              <Link to="/configuracoes" className="text-primary underline">
                Configurações
              </Link>
              . A URL nunca vai para o navegador: a chamada sai do servidor do RevenuePilot.
            </p>
          </Step>

          <Step n={2} title="Normalizar o payload recebido">
            <p>
              O corpo chega em <code>$json.body</code>. Este nó valida os campos obrigatórios,
              converte números e achata as evidências em texto para o prompt. Se o payload estiver
              incompleto, o workflow falha aqui com mensagem clara em vez de alucinar.
            </p>
            <CodeBlock label="Code node · Normalizar entrada (JavaScript)" code={NORMALIZE_CODE} />
          </Step>

          <Step n={3} title="Consultar o modelo com o prompt controlado">
            <p>
              Adicione um nó de modelo (<strong>AI Agent</strong>, <strong>Basic LLM Chain</strong> ou
              um <strong>HTTP Request</strong> para o provedor). Use o prompt abaixo e ative
              saída em JSON quando o nó oferecer a opção.
            </p>
            <CodeBlock label="Prompt do sistema/usuário" code={PROMPT_CODE} />
          </Step>

          <Step n={4} title="Validar e responder no contrato JSON">
            <p>
              Antes de responder, valide a saída do modelo. Depois conecte o nó{" "}
              <strong>Respond to Webhook</strong> com <strong>Respond With: JSON</strong> e o corpo{" "}
              <code>{"{{ JSON.stringify($json) }}"}</code>.
            </p>
            <CodeBlock label="Code node · Validar saída (JavaScript)" code={RESPOND_CODE} />
            <p className="pt-2">
              Contrato que o RevenuePilot aceita (também aceita <code>[{"{ json: ... }"}]</code>, o
              formato bruto do n8n):
            </p>
            <CodeBlock label="Contrato de resposta" code={RESPONSE_CONTRACT} />
          </Step>

          <Step n={5} title="Testar ponta a ponta">
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                No n8n clique em <strong>Execute workflow</strong> (modo de teste) ou ative o
                workflow para usar a Production URL.
              </li>
              <li>Use o botão de teste ao lado para enviar um ping e confirmar a conectividade.</li>
              <li>
                Abra uma oportunidade e clique em <strong>Gerar análise</strong>. O detalhe mostra
                origem, duração, payload enviado e resposta bruta.
              </li>
            </ol>
            <div className="pt-2">
              <button
                onClick={runTest}
                disabled={testing}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {testing ? "Testando…" : "Enviar ping ao webhook"}
              </button>
              {testResult ? (
                <pre className="mt-3 max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {testResult}
                </pre>
              ) : null}
            </div>
          </Step>
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Webhook configurado</h2>
            <p className="mt-2 break-all text-xs text-muted-foreground">
              {hydrated ? settings.webhookUrl || "Nenhum — as análises serão simuladas em modo demo." : "Carregando…"}
            </p>
            <Link
              to="/configuracoes"
              className="mt-3 inline-block rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Abrir Configurações
            </Link>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Payload real desta loja</h2>
            {example ? (
              <>
                <p className="mt-2 text-xs text-muted-foreground">
                  Gerado agora a partir da oportunidade prioritária “{example.title}” de{" "}
                  {activeStore.name}. É exatamente o corpo que o nó Webhook receberá.
                </p>
                <pre className="mt-3 max-h-[28rem] overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(example.payload, null, 2)}
                </pre>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(JSON.stringify(example.payload, null, 2));
                        toast.success("Payload copiado — cole no n8n como dados de teste.");
                      } catch {
                        toast.error("Não foi possível copiar o payload.");
                      }
                    }}
                    className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    Copiar payload
                  </button>
                  <Link
                    to="/oportunidades"
                    className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    Ver oportunidades
                  </Link>
                </div>
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                {hydrated
                  ? "Nenhuma oportunidade detectada para esta loja no período atual."
                  : "Carregando dados da loja…"}
              </p>
            )}
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
