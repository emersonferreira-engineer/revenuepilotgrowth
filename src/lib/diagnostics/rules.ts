import { buildWindows, compareMetrics, delta, productRevenue } from "@/lib/analytics/metrics";
import { daysBetween } from "@/lib/data/demo-dataset";
import type { AppSettings, Dataset, Opportunity } from "@/lib/domain/types";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export function formatMoney(value: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Rule 1 — conversion drop vs previous period. */
export function detectConversionDrop(
  dataset: Dataset,
  todayIso: string,
  settings: AppSettings,
): Opportunity | null {
  const { current, previous } = compareMetrics(dataset, todayIso, settings.defaultPeriodDays);
  const change = delta(current.conversionRate, previous.conversionRate);
  if (change === null || change > -settings.thresholds.conversionDropPct / 100) return null;

  const recoveredOrders = current.sessions * (previous.conversionRate - current.conversionRate);
  const impact = recoveredOrders * current.aov;

  return {
    id: "opp-conversao",
    title: "Queda de conversão do site no período atual",
    category: "conversao",
    severity: change < -0.2 ? "critico" : "atencao",
    diagnosis: `A taxa de conversão caiu de ${pct(previous.conversionRate)} para ${pct(current.conversionRate)} (${pct(change)}), enquanto as sessões cresceram ${pct(delta(current.sessions, previous.sessions) ?? 0)}. Há mais tráfego chegando e menos pedidos saindo.`,
    hypothesis:
      "O tráfego adicional está vindo de campanhas com intenção mais baixa e/ou há fricção no checkout (frete e prazo aparecendo tarde), reduzindo a conversão mesmo com mais visitas.",
    recommendation:
      "Segmentar a análise por canal e device antes de mexer em preço: comparar conversão de tráfego pago vs orgânico, revisar as 3 campanhas com maior volume e testar exibição de frete estimado na página de produto.",
    estimatedImpact: Math.max(0, impact),
    impactBasis: `Estimativa: sessões do período (${current.sessions.toLocaleString("pt-BR")}) × diferença de conversão (${pct(previous.conversionRate - current.conversionRate)}) × ticket médio (${formatMoney(current.aov)}).`,
    effort: "medio",
    confidence: Math.abs(change) > 0.15 ? "alto" : "medio",
    risks: [
      "Mix de canais pode explicar parte da queda sem que exista problema no site.",
      "Mudanças de rastreamento/consentimento podem inflar sessões e distorcer a taxa.",
    ],
    successMetrics: [
      "Taxa de conversão global voltar ao patamar anterior",
      "Conversão do tráfego pago por device",
      "Taxa de abandono no checkout",
    ],
    evidences: [
      { label: "Conversão atual", value: pct(current.conversionRate), comparison: `antes ${pct(previous.conversionRate)}` },
      { label: "Sessões", value: current.sessions.toLocaleString("pt-BR"), comparison: `antes ${previous.sessions.toLocaleString("pt-BR")}` },
      { label: "Pedidos", value: String(current.orders), comparison: `antes ${previous.orders}` },
      { label: "Ticket médio", value: formatMoney(current.aov), comparison: `antes ${formatMoney(previous.aov)}` },
    ],
    dataUsed: ["orders (pedidos diários)", "traffic (sessões diárias)"],
    periodLabel: `${current.window.label} vs ${previous.window.label}`,
    recordRefs: [`orders: ${current.orders} registros`, `traffic: ${settings.defaultPeriodDays} dias`],
    createdAt: todayIso,
  };
}

/** Rule 2 — CAC increase / ROAS drop (only with campaign data). */
export function detectAcquisitionEfficiency(
  dataset: Dataset,
  todayIso: string,
  settings: AppSettings,
): Opportunity | null {
  const { current, previous } = compareMetrics(dataset, todayIso, settings.defaultPeriodDays);
  if (current.cac === null || previous.cac === null) return null;
  const cacChange = delta(current.cac, previous.cac);
  const roasChange =
    current.roas !== null && previous.roas !== null ? delta(current.roas, previous.roas) : null;
  if (cacChange === null || cacChange < settings.thresholds.cacIncreasePct / 100) return null;

  const impact = current.adConversions * (current.cac - previous.cac);

  return {
    id: "opp-aquisicao",
    title: "CAC subiu e ROAS caiu na mídia paga",
    category: "aquisicao",
    severity: cacChange > 0.4 ? "critico" : "atencao",
    diagnosis: `O CAC passou de ${formatMoney(previous.cac)} para ${formatMoney(current.cac)} (+${pct(cacChange)}) com investimento de ${formatMoney(current.adSpend)}. O ROAS foi de ${previous.roas?.toFixed(2)} para ${current.roas?.toFixed(2)}${roasChange !== null ? ` (${pct(roasChange)})` : ""}.`,
    hypothesis:
      "Aumento de investimento sem ampliação de criativos e públicos gerou saturação: o custo por clique subiu e a taxa de conversão pós-clique caiu.",
    recommendation:
      "Congelar o aumento de verba por 7 dias, cortar os conjuntos com CAC acima da média e realocar 20% do orçamento para criativos novos e retargeting de carrinho, medindo CAC por conjunto semanalmente.",
    estimatedImpact: Math.max(0, impact),
    impactBasis: `Estimativa: conversões pagas (${current.adConversions}) × aumento de CAC (${formatMoney(current.cac - previous.cac)}) — economia potencial se o CAC voltar ao patamar anterior.`,
    effort: "baixo",
    confidence: "alto",
    risks: [
      "Cortar verba pode reduzir receita no curto prazo.",
      "Atribuição de última clique pode subestimar canais de topo de funil.",
    ],
    successMetrics: ["CAC por canal", "ROAS consolidado", "Participação da receita paga no total"],
    evidences: [
      { label: "CAC", value: formatMoney(current.cac), comparison: `antes ${formatMoney(previous.cac)}` },
      { label: "ROAS", value: current.roas?.toFixed(2) ?? "—", comparison: `antes ${previous.roas?.toFixed(2) ?? "—"}` },
      { label: "Investimento", value: formatMoney(current.adSpend), comparison: `antes ${formatMoney(previous.adSpend)}` },
      { label: "Conversões pagas", value: String(current.adConversions), comparison: `antes ${previous.adConversions}` },
    ],
    dataUsed: ["campaigns (investimento, cliques, conversões, receita)"],
    periodLabel: `${current.window.label} vs ${previous.window.label}`,
    recordRefs: [`campaigns: ${dataset.campaigns.length} registros diários por canal`],
    createdAt: todayIso,
  };
}

/** Rule 3 — product with relevant revenue drop. */
export function detectProductDrop(
  dataset: Dataset,
  todayIso: string,
  settings: AppSettings,
): Opportunity | null {
  const windows = buildWindows(todayIso, settings.defaultPeriodDays);
  const cur = productRevenue(dataset, windows.current);
  const prev = productRevenue(dataset, windows.previous);

  let worst: { id: string; drop: number; curRev: number; prevRev: number } | null = null;
  for (const [id, prevVal] of prev) {
    if (prevVal.revenue < 3000) continue;
    const curRev = cur.get(id)?.revenue ?? 0;
    const drop = (curRev - prevVal.revenue) / prevVal.revenue;
    if (drop < -settings.thresholds.productDropPct / 100 && (!worst || drop < worst.drop)) {
      worst = { id, drop, curRev, prevRev: prevVal.revenue };
    }
  }
  if (!worst) return null;
  const product = dataset.products.find((p) => p.id === worst!.id);
  if (!product) return null;

  return {
    id: "opp-produto",
    title: `Queda relevante de receita em ${product.name}`,
    category: "produto",
    severity: "atencao",
    diagnosis: `A receita de ${product.name} (${product.category}) caiu de ${formatMoney(worst.prevRev)} para ${formatMoney(worst.curRev)} (${pct(worst.drop)}) entre os dois períodos, enquanto a receita total da loja variou de forma diferente.`,
    hypothesis:
      "Ruptura de estoque, perda de posição em busca interna ou sazonalidade da categoria reduziram a exposição do produto — não necessariamente queda de demanda.",
    recommendation:
      "Verificar disponibilidade e variações esgotadas, reativar o produto nas vitrines de home e coleção, e incluí-lo em um fluxo de e-mail para quem visualizou nos últimos 30 dias antes de considerar desconto.",
    estimatedImpact: Math.max(0, worst.prevRev - worst.curRev),
    impactBasis: `Estimativa: diferença de receita do produto entre os períodos (${formatMoney(worst.prevRev)} − ${formatMoney(worst.curRev)}), assumindo recuperação total do patamar anterior.`,
    effort: "baixo",
    confidence: "medio",
    risks: [
      "Sazonalidade pode tornar a recuperação inviável no curto prazo.",
      "Canibalização: parte da receita pode ter migrado para outro SKU.",
    ],
    successMetrics: ["Receita do SKU", "Unidades vendidas por semana", "Taxa de ruptura"],
    evidences: [
      { label: "Receita atual", value: formatMoney(worst.curRev), comparison: `antes ${formatMoney(worst.prevRev)}` },
      { label: "Unidades", value: String(cur.get(worst.id)?.units ?? 0), comparison: `antes ${prev.get(worst.id)?.units ?? 0}` },
      { label: "Queda", value: pct(worst.drop) },
    ],
    dataUsed: ["orders.items (SKU, quantidade, preço)", "products (catálogo)"],
    periodLabel: `${windows.current.label} vs ${windows.previous.label}`,
    recordRefs: [`product_id: ${product.id}`],
    createdAt: todayIso,
  };
}

/** Rule 4 — repurchase opportunity from inactive customers. */
export function detectRetentionOpportunity(
  dataset: Dataset,
  todayIso: string,
  settings: AppSettings,
): Opportunity | null {
  const limit = settings.thresholds.inactiveDays;
  const inactive = dataset.customers.filter(
    (c) => c.orders >= 2 && daysBetween(c.lastOrderDate, todayIso) >= limit,
  );
  if (inactive.length < 10) return null;

  const avgTicket = inactive.reduce((s, c) => s + c.revenue / c.orders, 0) / inactive.length;
  const assumedReactivation = 0.06;
  const impact = inactive.length * assumedReactivation * avgTicket;

  return {
    id: "opp-retencao",
    title: `${inactive.length} clientes recorrentes inativos há ${limit}+ dias`,
    category: "retencao",
    severity: "oportunidade",
    diagnosis: `Existem ${inactive.length} clientes com 2 ou mais pedidos que não compram há pelo menos ${limit} dias. O ticket médio histórico desse grupo é ${formatMoney(avgTicket)}, acima da média de novos clientes.`,
    hypothesis:
      "Esses clientes já validaram a marca e pararam por falta de estímulo, não por insatisfação. Uma régua de recompra com recomendação por categoria comprada deve reativar parte do grupo.",
    recommendation:
      "Criar fluxo de recompra em 3 e-mails (lembrete de reposição, prova social da categoria e incentivo modesto apenas no terceiro), segmentado pela categoria do último pedido.",
    estimatedImpact: impact,
    impactBasis: `Estimativa: ${inactive.length} clientes × ${(assumedReactivation * 100).toFixed(0)}% de reativação assumida × ticket médio do grupo (${formatMoney(avgTicket)}). A taxa de reativação é uma hipótese editável.`,
    effort: "medio",
    confidence: "medio",
    risks: [
      "Taxa de reativação assumida pode não se confirmar sem teste.",
      "Desconto agressivo pode antecipar receita e corroer margem.",
    ],
    successMetrics: ["Clientes reativados no período", "Receita por e-mail enviado", "Taxa de recompra em 90 dias"],
    evidences: [
      { label: "Clientes inativos", value: String(inactive.length) },
      { label: "Ticket médio do grupo", value: formatMoney(avgTicket) },
      { label: "Janela de inatividade", value: `${limit} dias` },
    ],
    dataUsed: ["customers (data do último pedido, frequência)", "orders (receita histórica)"],
    periodLabel: `Base completa até ${todayIso}`,
    recordRefs: [`customers: ${inactive.length} de ${dataset.customers.length}`],
    createdAt: todayIso,
  };
}

export function runDiagnostics(
  dataset: Dataset,
  todayIso: string,
  settings: AppSettings,
): Opportunity[] {
  return [
    detectConversionDrop(dataset, todayIso, settings),
    detectAcquisitionEfficiency(dataset, todayIso, settings),
    detectProductDrop(dataset, todayIso, settings),
    detectRetentionOpportunity(dataset, todayIso, settings),
  ]
    .filter((o): o is Opportunity => o !== null)
    .sort((a, b) => b.estimatedImpact - a.estimatedImpact);
}