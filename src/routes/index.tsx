import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Bot, ListChecks, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RevenuePilot — de dados dispersos a plano de ação" },
      {
        name: "description",
        content:
          "MVP que lê dados de e-commerce e mídia paga, gera diagnósticos priorizados com evidências e transforma cada oportunidade em um plano de ação com responsáveis e métricas.",
      },
      { property: "og:title", content: "RevenuePilot — de dados dispersos a plano de ação" },
      {
        property: "og:description",
        content: "Diagnósticos priorizados com evidências e planos de ação para lojas DTC.",
      },
    ],
  }),
  component: Landing,
});

const PILLARS = [
  {
    icon: BarChart3,
    title: "Leitura do período",
    body: "Receita, pedidos, ticket médio, conversão, CAC e ROAS comparados ao período anterior.",
  },
  {
    icon: ShieldAlert,
    title: "Diagnóstico com evidência",
    body: "Regras determinísticas apontam queda de conversão, CAC em alta, produto em queda e base inativa.",
  },
  {
    icon: Bot,
    title: "Camada de IA opcional",
    body: "Um webhook n8n pode reescrever o diagnóstico em linguagem executiva, com contrato JSON validado.",
  },
  {
    icon: ListChecks,
    title: "Plano de ação",
    body: "Cada oportunidade vira tarefas com responsável, prazo, prioridade e métrica de sucesso.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <section className="border-b border-border bg-gradient-to-b from-primary-soft to-background">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center">
          <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            MVP demonstrativo com dados sintéticos
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            RevenuePilot
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Em poucos minutos, dados dispersos de loja e mídia viram uma lista curta de
            oportunidades priorizadas — com evidência, impacto estimado e próximo passo claro.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Abrir o dashboard <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/sobre"
              className="inline-flex items-center rounded-md border border-input bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Como funciona
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => (
            <article key={p.title} className="rounded-xl border border-border bg-card p-5">
              <p.icon className="h-5 w-5 text-primary" />
              <h2 className="mt-3 text-sm font-semibold text-foreground">{p.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
            </article>
          ))}
        </div>
        <p className="mt-10 text-center text-xs text-muted-foreground">
          Todos os números exibidos são estimativas sobre um dataset sintético. Nenhuma promessa de
          resultado é feita.
        </p>
      </section>
    </div>
  );
}
