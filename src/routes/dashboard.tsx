import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell, DemoBanner } from "@/components/app-shell";
import { useAppStore } from "@/lib/data/app-store";
import { getDemoDataset } from "@/lib/data/demo-dataset";
import { compareMetrics, dailyRevenueSeries, delta } from "@/lib/analytics/metrics";
import { formatMoney } from "@/lib/diagnostics/rules";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard de receita — RevenuePilot" },
      {
        name: "description",
        content:
          "Receita, pedidos, ticket médio, conversão, CAC e ROAS do período com comparação ao período anterior.",
      },
      { property: "og:title", content: "Dashboard de receita — RevenuePilot" },
      {
        property: "og:description",
        content: "Indicadores do período e as oportunidades de maior impacto estimado.",
      },
    ],
  }),
  component: DashboardPage,
});

function pct(value: number | null) {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function Kpi({
  label,
  value,
  variation,
  hint,
  invert,
}: {
  label: string;
  value: string;
  variation: number | null;
  hint: string;
  invert?: boolean;
}) {
  const good = variation === null ? null : invert ? variation < 0 : variation > 0;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <p
        className={
          good === null
            ? "mt-1 text-xs text-muted-foreground"
            : good
              ? "mt-1 text-xs font-medium text-success"
              : "mt-1 text-xs font-medium text-destructive"
        }
      >
        {pct(variation)} vs. período anterior
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function DashboardPage() {
  const { settings, opportunities, todayIso, hydrated } = useAppStore();
  const dataset = useMemo(() => getDemoDataset(), []);
  const comparison = useMemo(
    () => compareMetrics(dataset, todayIso, settings.defaultPeriodDays),
    [dataset, todayIso, settings.defaultPeriodDays],
  );
  const series = useMemo(
    () => dailyRevenueSeries(dataset, comparison.current.window),
    [dataset, comparison],
  );

  const c = comparison.current;
  const p = comparison.previous;
  const money = (v: number) => formatMoney(v, settings.currency);
  const totalImpact = opportunities.reduce((s, o) => s + o.estimatedImpact, 0);

  return (
    <AppShell
      title={`${settings.storeName} — últimos ${settings.defaultPeriodDays} dias`}
      description={`Período ${c.window.label}, comparado com ${p.window.label}.`}
    >
      <DemoBanner />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi
          label="Receita"
          value={money(c.revenue)}
          variation={delta(c.revenue, p.revenue)}
          hint={`${c.orders} pedidos no período`}
        />
        <Kpi
          label="Ticket médio"
          value={money(c.aov)}
          variation={delta(c.aov, p.aov)}
          hint="Receita dividida por pedidos"
        />
        <Kpi
          label="Taxa de conversão"
          value={`${(c.conversionRate * 100).toFixed(2)}%`}
          variation={delta(c.conversionRate, p.conversionRate)}
          hint={`${c.sessions.toLocaleString("pt-BR")} sessões`}
        />
        <Kpi
          label="Investimento em mídia"
          value={money(c.adSpend)}
          variation={delta(c.adSpend, p.adSpend)}
          hint={`${c.adConversions} conversões atribuídas`}
          invert
        />
        <Kpi
          label="CAC estimado"
          value={c.cac === null ? "—" : money(c.cac)}
          variation={c.cac && p.cac ? delta(c.cac, p.cac) : null}
          hint="Investimento dividido por novos clientes"
          invert
        />
        <Kpi
          label="ROAS"
          value={c.roas === null ? "—" : `${c.roas.toFixed(2)}x`}
          variation={c.roas && p.roas ? delta(c.roas, p.roas) : null}
          hint="Receita de campanhas sobre investimento"
        />
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground">Receita diária no período</h2>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
              <YAxis tick={{ fontSize: 11 }} width={70} />
              <Tooltip
                formatter={(v: number) => money(v)}
                labelStyle={{ fontSize: 12 }}
                contentStyle={{ fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-primary)"
                fill="url(#rev)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Oportunidades priorizadas</h2>
            <p className="text-xs text-muted-foreground">
              Impacto potencial somado: {money(totalImpact)} (estimativa)
            </p>
          </div>
          <Link
            to="/oportunidades"
            className="rounded-md border border-input px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            Ver todas
          </Link>
        </div>
        <ul className="mt-4 space-y-3">
          {!hydrated ? (
            <li className="text-sm text-muted-foreground">Calculando diagnósticos…</li>
          ) : opportunities.length === 0 ? (
            <li className="text-sm text-muted-foreground">
              Nenhum limiar foi ultrapassado neste período.
            </li>
          ) : (
            opportunities.slice(0, 3).map((o) => (
              <li key={o.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to="/oportunidades/$id"
                    params={{ id: o.id }}
                    className="text-sm font-semibold text-foreground hover:underline"
                  >
                    {o.title}
                  </Link>
                  <span className="text-sm font-medium text-primary">
                    {money(o.estimatedImpact)} estimados
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{o.diagnosis}</p>
              </li>
            ))
          )}
        </ul>
      </section>
    </AppShell>
  );
}
