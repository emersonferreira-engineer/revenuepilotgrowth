import {
  PAID_CHANNELS,
  TRAFFIC_CHANNELS,
  type Campaign,
  type CustomerSummary,
  type DailyTraffic,
  type Dataset,
  type Order,
  type PaidChannel,
  type Product,
  type Store,
  type TrafficChannel,
} from "@/lib/domain/types";
import { DEFAULT_STORES } from "@/lib/domain/types";

/** Deterministic PRNG (mulberry32) — no Math.random, so SSR and client agree. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDay(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000,
  );
}

const CATALOGS: Record<string, Product[]> = {
  default: [
    { id: "p-linho-01", name: "Jogo de Cama Linho Lavado", category: "Cama", price: 489 },
    { id: "p-toalha-02", name: "Toalha Aurora 600 fios", category: "Banho", price: 189 },
    { id: "p-difusor-03", name: "Difusor Cedro & Bergamota", category: "Aromas", price: 129 },
    { id: "p-manta-04", name: "Manta Tricô Inverno", category: "Sala", price: 279 },
    { id: "p-almof-05", name: "Kit 2 Almofadas Bouclé", category: "Sala", price: 219 },
    { id: "p-panela-06", name: "Panela Cerâmica 3L", category: "Cozinha", price: 349 },
    { id: "p-vela-07", name: "Vela Vetiver 220g", category: "Aromas", price: 99 },
    { id: "p-tapete-08", name: "Tapete Juta Redondo", category: "Sala", price: 399 },
  ],
  "store-nord-supply": [
    { id: "p-jaqueta-01", name: "Jaqueta Corta-Vento Fjord", category: "Casacos", price: 749 },
    { id: "p-fleece-02", name: "Fleece Térmico Nord", category: "Casacos", price: 429 },
    { id: "p-calca-03", name: "Calça Trilha Ripstop", category: "Calças", price: 389 },
    { id: "p-mochila-04", name: "Mochila 28L Impermeável", category: "Acessórios", price: 559 },
    { id: "p-boné-05", name: "Boné Técnico UV", category: "Acessórios", price: 129 },
    { id: "p-meia-06", name: "Kit 3 Meias Merino", category: "Acessórios", price: 179 },
    { id: "p-camisa-07", name: "Camiseta Merino Base", category: "Camisetas", price: 259 },
    { id: "p-luva-08", name: "Luva Windstop", category: "Acessórios", price: 199 },
  ],
};

function catalogFor(store: Store): Product[] {
  return CATALOGS[store.id] ?? CATALOGS["default"]!;
}

/** Share of sessions per channel, before the decline applied to one channel. */
const CHANNEL_MIX: Record<TrafficChannel, number> = {
  meta_ads: 0.28,
  google_ads: 0.22,
  tiktok_ads: 0.1,
  organic: 0.21,
  email: 0.09,
  direct: 0.1,
};

/** Relative conversion strength of each channel (multiplies the store baseline). */
const CHANNEL_CVR_FACTOR: Record<TrafficChannel, number> = {
  meta_ads: 0.85,
  google_ads: 1.15,
  tiktok_ads: 0.55,
  organic: 1.35,
  email: 1.9,
  direct: 1.5,
};

/** Which channel collapses in the recent window — deterministic per store. */
export function decliningChannelFor(store: Store): TrafficChannel {
  const pick = rng(store.seed + 7)();
  return TRAFFIC_CHANNELS[Math.floor(pick * TRAFFIC_CHANNELS.length)] ?? "meta_ads";
}

/**
 * Synthetic but internally consistent 90-day dataset for one store.
 * The last 30 days intentionally contain: conversion drop, CAC increase,
 * one product collapsing, a cohort of inactive customers and one channel
 * losing traffic and efficiency.
 */
export function buildDatasetForStore(store: Store, todayIso: string): Dataset {
  const rand = rng(store.seed);
  const products = catalogFor(store);
  const start = addDays(todayIso, -89);
  const orders: Order[] = [];
  const traffic: DailyTraffic[] = [];
  const campaigns: Campaign[] = [];
  const customerMap = new Map<string, CustomerSummary>();
  const declining = decliningChannelFor(store);
  const dailySessions = store.monthlySessions / 30;
  const dailyBudget = store.monthlyAdBudget / 30;
  const baseCvr = store.baselineConversionPct / 100;
  const fadingProduct = products[3]!;
  let orderSeq = 0;

  for (let i = 0; i < 90; i++) {
    const date = addDays(start, i);
    const recent = i >= 60; // last 30 days
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const weekendBoost = weekday === 0 || weekday === 6 ? 1.18 : 1;

    const totalSessions = Math.round(
      dailySessions * weekendBoost * (0.92 + rand() * 0.16) * (recent ? 1.06 : 1),
    );

    const byChannel = {} as Record<TrafficChannel, number>;
    for (const ch of TRAFFIC_CHANNELS) {
      const declineFactor = recent && ch === declining ? 0.62 : 1;
      byChannel[ch] = Math.max(
        1,
        Math.round(totalSessions * CHANNEL_MIX[ch] * declineFactor * (0.9 + rand() * 0.2)),
      );
    }
    const sessions = TRAFFIC_CHANNELS.reduce((s, ch) => s + byChannel[ch], 0);
    traffic.push({ date, sessions, byChannel });

    for (const ch of TRAFFIC_CHANNELS) {
      // global conversion erosion in the recent window + extra erosion on the declining channel
      const globalFactor = recent ? 0.74 : 1;
      const channelPenalty = recent && ch === declining ? 0.72 : 1;
      const cvr =
        baseCvr * CHANNEL_CVR_FACTOR[ch] * globalFactor * channelPenalty * (0.9 + rand() * 0.2);
      const orderCount = Math.round(byChannel[ch] * cvr);

      for (let o = 0; o < orderCount; o++) {
        orderSeq += 1;
        const returning = rand() < (recent ? 0.21 : 0.34);
        const customerId = returning
          ? `${store.id}-c-ret-${Math.floor(rand() * 320) + 1}`
          : `${store.id}-c-new-${orderSeq}`;

        const items = [];
        const itemCount = rand() < 0.32 ? 2 : 1;
        for (let k = 0; k < itemCount; k++) {
          let pick = products[Math.floor(rand() * products.length)]!;
          // one SKU collapses in the recent window (stock / seasonality)
          if (recent && pick.id === fadingProduct.id && rand() < 0.72) pick = products[0]!;
          items.push({ productId: pick.id, quantity: 1, unitPrice: pick.price });
        }
        const revenue = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
        orders.push({ id: `${store.id}-o-${orderSeq}`, date, customerId, revenue, items, channel: ch });

        const existing = customerMap.get(customerId);
        if (existing) {
          existing.lastOrderDate = date;
          existing.orders += 1;
          existing.revenue += revenue;
        } else {
          customerMap.set(customerId, {
            id: customerId,
            firstOrderDate: date,
            lastOrderDate: date,
            orders: 1,
            revenue,
          });
        }
      }
    }

    // Campaigns: spend grows while conversions fall -> CAC up, ROAS down
    const spendBase = dailyBudget * (recent ? 1.32 : 1);
    const split: Record<PaidChannel, number> = { meta_ads: 0.52, google_ads: 0.33, tiktok_ads: 0.15 };
    for (const ch of PAID_CHANNELS) {
      const declineFactor = recent && ch === declining ? 1.18 : 1;
      const spend = Math.round(spendBase * split[ch] * declineFactor * (0.92 + rand() * 0.18));
      const clicks = Math.round(spend / (recent ? 2.35 : 1.85));
      const conversions = Math.max(1, Math.round(clicks * (recent ? 0.021 : 0.031)));
      const cvRevenue = Math.round(conversions * (recent ? 296 : 322));
      campaigns.push({
        id: `${store.id}-cmp-${date}-${ch}`,
        date,
        channel: ch,
        spend,
        clicks,
        conversions,
        revenue: cvRevenue,
      });
    }
  }

  return {
    store,
    products,
    orders,
    traffic,
    campaigns,
    customers: [...customerMap.values()],
    source: { kind: "demo", label: "Modo demonstração — dados sintéticos" },
  };
}

const cache = new Map<string, Dataset>();

/** Lazily built + memoized (never at module scope: Workers forbid global-scope I/O). */
export function getStoreDataset(store: Store, todayIso?: string): Dataset {
  const today = todayIso ?? isoDay(new Date());
  const key = `${store.id}|${store.seed}|${store.monthlySessions}|${store.baselineConversionPct}|${store.monthlyAdBudget}|${today}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const data = buildDatasetForStore(store, today);
  if (cache.size > 12) cache.clear();
  cache.set(key, data);
  return data;
}

/** Backwards-compatible helper: the first demo store. */
export function getDemoDataset(): Dataset {
  return getStoreDataset(DEFAULT_STORES[0]!);
}
