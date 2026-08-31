export type Currency = "BRL" | "USD" | "EUR";

export type TrafficChannel =
  | "meta_ads"
  | "google_ads"
  | "tiktok_ads"
  | "organic"
  | "email"
  | "direct";

export type PaidChannel = Extract<TrafficChannel, "meta_ads" | "google_ads" | "tiktok_ads">;

export const TRAFFIC_CHANNELS: TrafficChannel[] = [
  "meta_ads",
  "google_ads",
  "tiktok_ads",
  "organic",
  "email",
  "direct",
];

export const PAID_CHANNELS: PaidChannel[] = ["meta_ads", "google_ads", "tiktok_ads"];

export const CHANNEL_LABEL: Record<TrafficChannel, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  tiktok_ads: "TikTok Ads",
  organic: "Busca orgânica",
  email: "E-mail e CRM",
  direct: "Direto e referências",
};

/** A store is the tenant unit: its own dataset, metrics and opportunities. */
export interface Store {
  id: string;
  name: string;
  segment: string;
  currency: Currency;
  defaultPeriodDays: number;
  /** Seed of the synthetic generator: same seed, same numbers. */
  seed: number;
  monthlySessions: number;
  baselineConversionPct: number;
  monthlyAdBudget: number;
  demoMode: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  date: string; // ISO yyyy-mm-dd
  customerId: string;
  revenue: number;
  items: OrderItem[];
  channel: TrafficChannel;
}

export interface DailyTraffic {
  date: string;
  sessions: number;
  byChannel: Record<TrafficChannel, number>;
}

export interface Campaign {
  id: string;
  date: string;
  channel: PaidChannel;
  spend: number;
  clicks: number;
  conversions: number;
  revenue: number;
}

export interface CustomerSummary {
  id: string;
  firstOrderDate: string;
  lastOrderDate: string;
  orders: number;
  revenue: number;
}

export interface DatasetSource {
  kind: "demo" | "import";
  label: string;
}

export interface Dataset {
  store: Store;
  products: Product[];
  orders: Order[];
  traffic: DailyTraffic[];
  campaigns: Campaign[];
  customers: CustomerSummary[];
  source: DatasetSource;
}

export type ChannelOpportunityMeta = { channel: TrafficChannel };

export type Confidence = "baixo" | "medio" | "alto";
export type OpportunityCategory = "conversao" | "aquisicao" | "produto" | "retencao";
export type OpportunityStatus = "nova" | "revisada" | "em_plano" | "descartada";

export interface Evidence {
  label: string;
  value: string;
  comparison?: string;
}

export interface Opportunity {
  id: string;
  title: string;
  category: OpportunityCategory;
  severity: "atencao" | "critico" | "oportunidade";
  diagnosis: string;
  hypothesis: string;
  recommendation: string;
  estimatedImpact: number; // currency units, ESTIMATE
  impactBasis: string;
  effort: "baixo" | "medio" | "alto";
  confidence: Confidence;
  risks: string[];
  successMetrics: string[];
  evidences: Evidence[];
  dataUsed: string[];
  periodLabel: string;
  recordRefs: string[];
  createdAt: string;
}

export interface AiRecommendation {
  diagnostico: string;
  hipotese: string;
  acao_recomendada: string;
  impacto_estimado: string;
  nivel_de_confianca: Confidence;
  dados_utilizados: string[];
  riscos: string[];
  metricas_de_sucesso: string[];
}

export interface AiExchange {
  result: AiRecommendation;
  source: "n8n" | "demo";
  at: string;
  requestPayload: unknown;
  rawResponse: string | null;
  webhookUrl: string | null;
  durationMs: number | null;
}

export interface ActionTask {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  priority: "alta" | "media" | "baixa";
  status: "todo" | "doing" | "done";
  successMetric: string;
  comments: { id: string; author: string; text: string; createdAt: string }[];
}

export interface ActionPlan {
  id: string;
  opportunityId: string;
  title: string;
  createdAt: string;
  tasks: ActionTask[];
}

export interface ImportRecord {
  id: string;
  fileName: string;
  createdAt: string;
  type: "orders" | "campaigns";
  rowsTotal: number;
  rowsValid: number;
  rowsInvalid: number;
  errors: string[];
}

export interface AuditEvent {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  detail: string;
}

export interface AppSettings {
  webhookUrl: string;
  notifyOnNewOpportunity: boolean;
  thresholds: {
    conversionDropPct: number;
    cacIncreasePct: number;
    productDropPct: number;
    inactiveDays: number;
    channelDropPct: number;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  webhookUrl: "",
  notifyOnNewOpportunity: true,
  thresholds: {
    conversionDropPct: 8,
    cacIncreasePct: 15,
    productDropPct: 25,
    inactiveDays: 60,
    channelDropPct: 12,
  },
};

export const DEFAULT_STORES: Store[] = [
  {
    id: "store-aurora-home",
    name: "Aurora Home",
    segment: "Casa e decoração",
    currency: "BRL",
    defaultPeriodDays: 30,
    seed: 20260815,
    monthlySessions: 45000,
    baselineConversionPct: 2.6,
    monthlyAdBudget: 95000,
    demoMode: true,
    createdAt: "2026-01-10",
  },
  {
    id: "store-nord-supply",
    name: "Nord Supply Co.",
    segment: "Moda outdoor",
    currency: "BRL",
    defaultPeriodDays: 30,
    seed: 771302,
    monthlySessions: 28000,
    baselineConversionPct: 1.9,
    monthlyAdBudget: 52000,
    demoMode: true,
    createdAt: "2026-03-02",
  },
];