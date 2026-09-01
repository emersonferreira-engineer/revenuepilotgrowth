import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useAppStore } from "@/lib/data/app-store";
import { testWebhook } from "@/lib/ai/n8n.functions";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações do experimento — RevenuePilot" },
      {
        name: "description",
        content:
          "Defina loja, moeda, período padrão, limiares dos diagnósticos e a URL do webhook n8n usado pela análise de IA.",
      },
      { property: "og:title", content: "Configurações do experimento — RevenuePilot" },
      {
        property: "og:description",
        content: "Limiares de diagnóstico, período padrão e integração com n8n.",
      },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, updateSettings, audit, resetDemo, log, activeStore } = useAppStore();
  const [testing, setTesting] = useState(false);

  const field = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  async function runTest() {
    if (!settings.webhookUrl) {
      toast.error("Informe a URL do webhook antes de testar.");
      return;
    }
    setTesting(true);
    try {
      const res = await testWebhook({ data: { webhookUrl: settings.webhookUrl } });
      if (res.ok) toast.success(`Webhook respondeu ${res.status}.`, { description: res.body.slice(0, 160) });
      else toast.error(`Falha no teste (status ${res.status}).`, { description: res.body.slice(0, 160) });
    } finally {
      setTesting(false);
    }
  }

  return (
    <AppShell
      title="Configurações"
      description="Tudo é salvo apenas no navegador. Nenhum dado sai daqui sem um webhook configurado por você."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Loja ativa</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {activeStore.name} · {activeStore.currency} · janela de {activeStore.defaultPeriodDays}{" "}
            dias.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Nome, moeda, período e parâmetros de geração de dados são editados na tela de Lojas.
          </p>
          <Link
            to="/lojas"
            className="mt-3 inline-flex rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
          >
            Gerenciar lojas
          </Link>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Limiares dos diagnósticos</h2>
          {(
            [
              ["conversionDropPct", "Queda de conversão (%)"],
              ["cacIncreasePct", "Aumento de CAC (%)"],
              ["productDropPct", "Queda por produto (%)"],
              ["inactiveDays", "Dias para cliente inativo"],
              ["channelDropPct", "Queda por canal de tráfego (%)"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="mt-3 block text-xs text-muted-foreground">
              {label}
              <input
                type="number"
                className={field}
                value={settings.thresholds[key]}
                onChange={(e) =>
                  updateSettings({
                    thresholds: { ...settings.thresholds, [key]: Number(e.target.value) || 0 },
                  })
                }
              />
            </label>
          ))}
        </section>

        <section className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-foreground">Integração n8n</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            O app envia o payload de análise para esta URL pelo servidor e valida a resposta contra o
            contrato JSON esperado. Sem URL, a análise de IA é simulada e marcada como demo.
          </p>
          <label className="mt-3 block text-xs text-muted-foreground">
            URL do webhook
            <input
              className={field}
              placeholder="https://seu-n8n/webhook/revenuepilot"
              value={settings.webhookUrl}
              onChange={(e) => updateSettings({ webhookUrl: e.target.value.trim() })}
            />
          </label>
          <button
            onClick={runTest}
            disabled={testing}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {testing ? "Testando…" : "Testar conexão"}
          </button>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Registro de atividades</h2>
            <button
              onClick={() => {
                resetDemo();
                toast.success("Experimento reiniciado.");
              }}
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
            >
              Reiniciar demo
            </button>
          </div>
          {audit.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
          ) : (
            <ul className="mt-3 max-h-72 space-y-2 overflow-auto text-xs text-muted-foreground">
              {audit.map((e) => (
                <li key={e.id}>
                  <span className="text-foreground">{new Date(e.createdAt).toLocaleString("pt-BR")}</span>{" "}
                  · {e.action} — {e.detail}
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => log("Nota manual", "Registro criado pelo usuário nas configurações")}
            className="mt-3 text-xs text-primary hover:underline"
          >
            Registrar nota manual
          </button>
        </section>
      </div>
    </AppShell>
  );
}
