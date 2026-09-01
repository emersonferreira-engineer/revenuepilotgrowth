import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre o experimento — RevenuePilot" },
      {
        name: "description",
        content:
          "Como o RevenuePilot gera diagnósticos, quais premissas usa, o contrato JSON esperado do n8n e as limitações conhecidas do MVP.",
      },
      { property: "og:title", content: "Sobre o experimento — RevenuePilot" },
      {
        property: "og:description",
        content: "Premissas, contrato de IA e limitações declaradas do MVP.",
      },
    ],
  }),
  component: AboutPage,
});

const CONTRACT = `{
  "diagnostico": "string",
  "hipotese": "string",
  "acao_recomendada": "string",
  "impacto_estimado": "string",
  "nivel_de_confianca": "baixo | medio | alto",
  "dados_utilizados": ["string"],
  "riscos": ["string"],
  "metricas_de_sucesso": ["string"]
}`;

function AboutPage() {
  return (
    <AppShell
      title="Sobre o experimento"
      description="Transparência sobre origem dos dados, método dos diagnósticos e limites do MVP."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Origem dos dados</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            O dataset é sintético e gerado por um PRNG determinístico: mesma seed produz os mesmos
            números, então servidor e navegador veem dados idênticos. Cada loja tem seu próprio seed
            e catálogo. Vêm duas lojas de demonstração (*Aurora Home* e *Nord Supply Co.*), cada uma
            com 90 dias de pedidos, sessões por canal de tráfego, campanhas e clientes. Nenhum dado
            real de loja é usado.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Como o diagnóstico é feito</h2>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            <li>Queda de conversão do período versus o anterior, acima do limiar configurado.</li>
            <li>Eficiência de aquisição: CAC e ROAS comparados ao período anterior.</li>
            <li>Produto com queda relevante de receita no período.</li>
            <li>Base de clientes inativos há mais dias que o limiar.</li>
            <li>Queda por canal de tráfego (pago ou orgânico) acima do limiar, com CAC quando aplicável.</li>
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            Todo impacto exibido é uma estimativa aritmética simples, com a premissa declarada junto
            ao número. Não é previsão nem garantia de resultado.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Contrato esperado do n8n</h2>
          <pre className="mt-2 overflow-auto rounded-lg bg-muted p-3 text-xs text-foreground">
            {CONTRACT}
          </pre>
          <p className="mt-2 text-xs text-muted-foreground">
            A resposta pode vir como objeto, array com um item ou envelopada em `json`. Qualquer
            desvio do contrato é rejeitado e mostrado como erro na interface.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Limitações conhecidas</h2>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            <li>Sem autenticação e sem banco: o estado vive no navegador.</li>
            <li>O CSV é validado, mas ainda não substitui o dataset demo nos diagnósticos.</li>
            <li>Atribuição de mídia é simplificada (last click do próprio dataset).</li>
            <li>A camada de IA é opcional e depende de um webhook externo configurado por você.</li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
