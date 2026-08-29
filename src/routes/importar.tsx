import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useAppStore } from "@/lib/data/app-store";
import {
  ORDERS_TEMPLATE_COLUMNS,
  ORDERS_TEMPLATE_CSV,
  parseCsv,
  validateOrdersCsv,
  type ValidationOutcome,
} from "@/lib/import/csv";

export const Route = createFileRoute("/importar")({
  head: () => ({
    meta: [
      { title: "Importar dados por CSV — RevenuePilot" },
      {
        name: "description",
        content:
          "Envie um CSV de pedidos, veja a validação linha a linha e acompanhe o histórico de importações do experimento.",
      },
      { property: "og:title", content: "Importar dados por CSV — RevenuePilot" },
      {
        property: "og:description",
        content: "Modelo de CSV, validação linha a linha e histórico de importações.",
      },
    ],
  }),
  component: ImportPage,
});

function ImportPage() {
  const { imports, addImport, log, hydrated } = useAppStore();
  const [outcome, setOutcome] = useState<ValidationOutcome | null>(null);
  const [fileName, setFileName] = useState("");

  async function handleFile(file: File) {
    const text = await file.text();
    const parsed = parseCsv(text);
    const result = validateOrdersCsv(parsed);
    setOutcome(result);
    setFileName(file.name);

    const record = {
      id: `imp-${Date.now().toString(36)}`,
      fileName: file.name,
      createdAt: new Date().toISOString(),
      type: "orders" as const,
      rowsTotal: parsed.rows.length,
      rowsValid: result.validRows.length,
      rowsInvalid: result.rowErrors.length,
      errors: [
        ...result.missingColumns.map((c) => `Coluna obrigatória ausente: ${c}`),
        ...result.rowErrors.slice(0, 20).map((e) => `Linha ${e.line}: ${e.message}`),
      ],
    };
    addImport(record);
    log("Importação CSV", `${file.name}: ${record.rowsValid} válidas, ${record.rowsInvalid} com erro`);

    if (result.missingColumns.length > 0) toast.error("O arquivo não tem todas as colunas exigidas.");
    else if (result.rowErrors.length > 0) toast.warning("Importação parcial: algumas linhas têm erro.");
    else toast.success("Arquivo validado com sucesso.");
  }

  function downloadTemplate() {
    const blob = new Blob([ORDERS_TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "revenuepilot-pedidos-modelo.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell
      title="Importar dados"
      description="O MVP valida o arquivo e mostra o resultado da checagem. Os diagnósticos continuam calculados sobre o dataset demo."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-foreground">Upload de pedidos (CSV)</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Colunas obrigatórias: {ORDERS_TEMPLATE_COLUMNS.join(", ")}.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
              className="text-sm"
            />
            <button
              onClick={downloadTemplate}
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
            >
              Baixar modelo
            </button>
          </div>

          {outcome ? (
            <div className="mt-5 rounded-lg border border-border p-4 text-sm">
              <p className="font-medium text-foreground">{fileName}</p>
              <p className="mt-1 text-muted-foreground">
                {outcome.validRows.length} linhas válidas · {outcome.rowErrors.length} com erro
              </p>
              {outcome.missingColumns.length > 0 ? (
                <p className="mt-2 text-destructive">
                  Colunas ausentes: {outcome.missingColumns.join(", ")}
                </p>
              ) : null}
              {outcome.rowErrors.length > 0 ? (
                <ul className="mt-3 max-h-56 space-y-1 overflow-auto text-xs text-muted-foreground">
                  {outcome.rowErrors.slice(0, 50).map((e) => (
                    <li key={e.line}>
                      Linha {e.line}: {e.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground">Histórico</h2>
          {!hydrated ? (
            <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
          ) : imports.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nenhuma importação registrada.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {imports.map((i) => (
                <li key={i.id} className="border-b border-border pb-2">
                  <p className="font-medium text-foreground">{i.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(i.createdAt).toLocaleString("pt-BR")} · {i.rowsValid} válidas /{" "}
                    {i.rowsInvalid} com erro
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
