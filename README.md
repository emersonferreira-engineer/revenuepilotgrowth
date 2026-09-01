# RevenuePilot

Transforma dados de e-commerce e marketing em **diagnósticos priorizados e planos de ação**.
Em poucos minutos, dados dispersos viram uma lista priorizada de ações comerciais com explicação,
responsável, prazo e impacto estimado.

## Público

Profissionais de marketing, growth e operação comercial de lojas DTC pequenas e médias, que têm
dados espalhados entre plataforma de e-commerce e mídia paga e pouco tempo para análise.

## Arquitetura

- **TanStack Start (React 19 + Vite)** com rotas em `src/routes`.
- **Camada de domínio** em `src/lib/domain/types.ts` — entidades: store, product, order (+`OrderItem`
  com `channel`), `DailyTraffic` (+`byChannel`), campaign, customer, opportunity, action plan, import
  record, audit event, settings. `TrafficChannel` cobre Meta/Google/TikTok Ads + orgânico, e-mail e
  direto.
- **Dados** em `src/lib/data/demo-dataset.ts` — dataset sintético determinístico por loja (mesma seed
  → mesmos números). Vêm duas lojas de demonstração, *Aurora Home* e *Nord Supply Co.*, cada uma com
  catálogo próprio e 90 dias de pedidos, tráfego por canal, campanhas e clientes. Substituível por um
  banco real sem tocar nas telas.
- **Analytics** em `src/lib/analytics/metrics.ts` — comparação período atual x anterior, série de
  receita, AOV, CVR, CAC, ROAS e métricas por canal de tráfego.
- **Motor de diagnóstico** em `src/lib/diagnostics/rules.ts` — cinco regras determinísticas.
- **Estado da aplicação** em `src/lib/data/app-store.tsx` — React Context persistido em
  `localStorage` (`revenuepilot.state.v2`) com suporte a múltiplas lojas e troca de loja ativa.
- **Adaptador de IA** em `src/lib/ai/n8n.functions.ts` — `createServerFn`, chamada server-side ao
  webhook n8n com validação Zod na entrada e na resposta.
- **Importação CSV** em `src/lib/import/csv.ts` — parsing e validação linha a linha.

## Telas

| Rota | Descrição |
| --- | --- |
| `/` | Landing page com proposta de valor e acesso à demonstração |
| `/dashboard` | KPIs comparados, curva de receita, tabela por canal e top oportunidades |
| `/lojas` | Lista de lojas, criação/edição/exclusão e troca da loja ativa |
| `/importar` | Upload de CSV, modelo, validação e histórico |
| `/oportunidades` | Lista priorizada por impacto, com filtro por categoria |
| `/oportunidades/$id` | Detalhe: evidências, riscos, IA, status e criação de plano |
| `/planos` | Tarefas com responsável, prazo, prioridade, métrica e comentários |
| `/configuracoes` | Limiares de diagnóstico, webhook n8n e registro de atividades |
| `/sobre` | Premissas, contrato de IA e limitações |

## Setup

```bash
bun install
bun run dev   # http://localhost:8080
```

## Variáveis de ambiente

O MVP não exige nenhuma variável para rodar em modo demonstração. A URL do webhook n8n é
configurada pela interface em `/configuracoes` e fica no navegador do usuário. Chaves de API nunca
ficam no frontend: qualquer chamada externa acontece dentro de `createServerFn` no servidor.

## Modelo de dados

`Store`, `Product`, `Order` (+`OrderItem`), `DailyTraffic`, `Campaign`, `CustomerSummary`,
`Opportunity`, `AiRecommendation`, `ActionPlan` (+`ActionTask`), `ImportRecord`, `AuditEvent`,
`AppSettings`. Quando um banco for conectado, cada uma vira uma tabela com `store_id` como chave de
tenant e RLS por usuário.

## Regras de negócio (diagnósticos)

1. **Queda de conversão** — CVR do período atual x anterior, acima do limiar configurado.
2. **Eficiência de aquisição** — aumento de CAC ou queda de ROAS com dados de campanha.
3. **Queda por produto** — SKU com perda relevante de receita no período.
4. **Retenção** — clientes inativos há mais dias que o limiar, com potencial de recompra.

Cada oportunidade declara período analisado, dados utilizados, hipótese, nível de confiança,
riscos, métricas de sucesso e a premissa por trás do impacto estimado.

## Integração n8n

`POST` server-side para a URL configurada, com payload:

```json
{
  "store_id": "...",
  "periodo": { "inicio": "...", "fim": "...", "comparacao": "..." },
  "tipo_de_oportunidade": "conversao | aquisicao | produto | retencao",
  "metricas": {},
  "evidencias": [{ "label": "...", "value": "..." }],
  "pergunta_de_analise": "..."
}
```

Resposta esperada (objeto, array de um item ou envelopada em `json`):

```json
{
  "diagnostico": "string",
  "hipotese": "string",
  "acao_recomendada": "string",
  "impacto_estimado": "string",
  "nivel_de_confianca": "baixo | medio | alto",
  "dados_utilizados": ["string"],
  "riscos": ["string"],
  "metricas_de_sucesso": ["string"]
}
```

Sem webhook configurado, a análise é simulada e rotulada explicitamente como *demo*. Nenhum dado
pessoal é enviado — apenas métricas agregadas e evidências.

## Limitações

- Sem autenticação e sem banco: o estado vive no `localStorage`.
- O CSV é validado, mas ainda não substitui o dataset demo nos diagnósticos.
- Atribuição de mídia simplificada (last click do próprio dataset).
- Impactos são estimativas aritméticas com premissa declarada, não previsões.

## Decisões de produto

- IA como copiloto: nenhuma ação irreversível sem aprovação humana; toda recomendação vem com
  evidência, confiança e riscos.
- Diagnóstico determinístico primeiro, IA depois: o valor não depende do modelo estar disponível.
- Modo demonstração explícito em vez de dados inventados sem aviso.
- Impacto estimado editável pelo usuário, com a premissa registrada.

## Roadmap

1. Banco com multi-tenant, autenticação e auditoria server-side.
2. Conectores nativos (Shopify, Meta Ads, Google Ads) substituindo o CSV.
3. CSV importado alimentando os diagnósticos de verdade.
4. Alertas programados e digest semanal por e-mail.
5. Backtest das recomendações: comparar impacto estimado com resultado real.
