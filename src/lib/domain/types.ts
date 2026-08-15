export type Currency = "BRL" | "USD" | "EUR";

export interface Store {
  id: string;
  name: string;
  currency: Currency;
  defaultPeriodDays: number;
  demoMode: boolean;
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
  channel: "paid" | "organic" | "email" | "direct";
}

export interface DailyTraffic {
  date: string;
  sessions: number;
}

export interface Campaign {
  id: string;
  date: string;
  channel: "Meta Ads" | "Google Ads" | "TikTok Ads";
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
  storeName: string;
  currency: Currency;
  defaultPeriodDays: number;
  webhookUrl: string;
  demoMode: boolean;
  notifyOnNewOpportunity: boolean;
  thresholds: {
    conversionDropPct: number;
    cacIncreasePct: number;
    productDropPct: number;
    inactiveDays: number;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  storeName: "Aurora Home",
  currency: "BRL",
  defaultPeriodDays: 30,
  webhookUrl: "",
  demoMode: true,
  notifyOnNewOpportunity: true,
  thresholds: {
    conversionDropPct: 8,
    cacIncreasePct: 15,
    productDropPct: 25,
    inactiveDays: 60,
  },
};