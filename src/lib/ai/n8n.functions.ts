import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const confidence = z.enum(["baixo", "medio", "alto"]);

export const aiRecommendationSchema = z.object({
  diagnostico: z.string().min(1),
  hipotese: z.string().min(1),
  acao_recomendada: z.string().min(1),
  impacto_estimado: z.string().min(1),
  nivel_de_confianca: confidence,
  dados_utilizados: z.array(z.string()).min(1),
  riscos: z.array(z.string()),
  metricas_de_sucesso: z.array(z.string()).min(1),
});

export const analysisPayloadSchema = z.object({
  store_id: z.string(),
  periodo: z.object({ inicio: z.string(), fim: z.string(), comparacao: z.string() }),
  tipo_de_oportunidade: z.string(),
  metricas: z.record(z.union([z.string(), z.number(), z.null()])),
  evidencias: z.array(z.object({ label: z.string(), value: z.string() })),
  pergunta_de_analise: z.string(),
});

export type AnalysisPayload = z.infer<typeof analysisPayloadSchema>;
export type AiRecommendationDto = z.infer<typeof aiRecommendationSchema>;

const requestSchema = z.object({
  webhookUrl: z.string().url("Informe uma URL de webhook válida (https://...)"),
  payload: analysisPayloadSchema,
});

export type N8nResponse =
  | { ok: true; result: AiRecommendationDto; raw: string }
  | { ok: false; error: string; detail?: string };

/** Server-side adapter for the n8n webhook. Nothing is called from the browser directly. */
export const requestAiAnalysis = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => requestSchema.parse(input))
  .handler(async ({ data }): Promise<N8nResponse> => {
    let response: Response;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      response = await fetch(data.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.payload),
        signal: controller.signal,
      });
    } catch (error) {
      return {
        ok: false,
        error: "Não foi possível alcançar o webhook do n8n.",
        detail: error instanceof Error ? error.message : "Falha de rede ou tempo esgotado.",
      };
    } finally {
      clearTimeout(timeout);
    }

    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        error: `O webhook respondeu com status ${response.status}.`,
        detail: text.slice(0, 300),
      };
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, error: "A resposta do webhook não é um JSON válido.", detail: text.slice(0, 300) };
    }

    const unwrapped = Array.isArray(json) && json.length > 0 ? json[0] : json;
    const candidate =
      unwrapped && typeof unwrapped === "object" && "json" in (unwrapped as Record<string, unknown>)
        ? (unwrapped as Record<string, unknown>)["json"]
        : unwrapped;

    const parsed = aiRecommendationSchema.safeParse(candidate);
    if (!parsed.success) {
      return {
        ok: false,
        error: "O JSON retornado não segue o contrato esperado.",
        detail: parsed.error.issues.map((i) => `${i.path.join(".") || "raiz"}: ${i.message}`).join(" | "),
      };
    }
    return { ok: true, result: parsed.data, raw: text.slice(0, 4000) };
  });

export const testWebhook = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ webhookUrl: z.string().url() }).parse(input))
  .handler(async ({ data }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(data.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ping: "revenuepilot", enviado_em: new Date().toISOString() }),
        signal: controller.signal,
      });
      const body = await res.text();
      return { ok: res.ok, status: res.status, body: body.slice(0, 400) };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        body: error instanceof Error ? error.message : "Falha de rede ao chamar o webhook.",
      };
    } finally {
      clearTimeout(timeout);
    }
  });