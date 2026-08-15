import type {
  Campaign,
  CustomerSummary,
  DailyTraffic,
  Dataset,
  Order,
  Product,
} from "@/lib/domain/types";

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

const PRODUCTS: Product[] = [
  { id: "p-linho-01", name: "Jogo de Cama Linho Lavado", category: "Cama", price: 489 },
  { id: "p-toalha-02", name: "Toalha Aurora 600 fios", category: "Banho", price: 189 },
  { id: "p-difusor-03", name: "Difusor Cedro & Bergamota", category: "Aromas", price: 129 },
  { id: "p-manta-04", name: "Manta Tricô Inverno", category: "Sala", price: 279 },
  { id: "p-almof-05", name: "Kit 2 Almofadas Bouclé", category: "Sala", price: 219 },
  { id: "p-panela-06", name: "Panela Cerâmica 3L", category: "Cozinha", price: 349 },
  { id: "p-vela-07", name: "Vela Vetiver 220g", category: "Aromas", price: 99 },
  { id: "p-tapete-08", name: "Tapete Juta Redondo", category: "Sala", price: 399 },
];

/**
 * Synthetic but internally consistent 90-day dataset for the demo store.
 * Last 30 days intentionally contain: conversion drop, CAC increase,
 * one product collapsing and a cohort of inactive customers.
 */
export function buildDemoDataset(todayIso: string): Dataset {
  const rand = rng(20260815);
  const start = addDays(todayIso, -89);
  const orders: Order[] = [];
  const traffic: DailyTraffic[] = [];
  const campaigns: Campaign[] = [];
  const customerMap = new Map<string, CustomerSummary>();
  let orderSeq = 0;

  for (let i = 0; i < 90; i++) {
    const date = addDays(start, i);
    const recent = i >= 60; // last 30 days
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const weekendBoost = weekday === 0 || weekday === 6 ? 1.18 : 1;

    const sessions = Math.round((1450 + rand() * 260) * weekendBoost * (recent ? 1.12 : 1));
    traffic.push({ date, sessions });

    // conversion rate: ~2.6% before, ~1.9% in the last 30 days
    const cvr = (recent ? 0.019 : 0.0262) + (rand() - 0.5) * 0.0022;
    const orderCount = Math.max(12, Math.round(sessions * cvr));

    for (let o = 0; o < orderCount; o++) {
      orderSeq += 1;
      const returning = rand() < (recent ? 0.21 : 0.34);
      const customerId = returning
        ? `c-ret-${Math.floor(rand() * 320) + 1}`
        : `c-new-${orderSeq}`;

      const items = [];
      const itemCount = rand() < 0.32 ? 2 : 1;
      for (let k = 0; k < itemCount; k++) {
        let pick = PRODUCTS[Math.floor(rand() * PRODUCTS.length)]!;
        // "Manta Tricô Inverno" collapses in the recent window (stock/seasonality)
        if (recent && pick.id === "p-manta-04" && rand() < 0.72) {
          pick = PRODUCTS[0]!;
        }
        items.push({ productId: pick.id, quantity: 1, unitPrice: pick.price });
      }
      const revenue = items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
      const channelRoll = rand();
      const channel: Order["channel"] =
        channelRoll < 0.52 ? "paid" : channelRoll < 0.72 ? "organic" : channelRoll < 0.88 ? "email" : "direct";

      orders.push({ id: `o-${orderSeq}`, date, customerId, revenue, items, channel });

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

    // Campaigns: spend grows while conversions fall -> CAC up, ROAS down
    const spendBase = recent ? 3150 : 2380;
    const channelsList: Campaign["channel"][] = ["Meta Ads", "Google Ads", "TikTok Ads"];
    const split = [0.52, 0.33, 0.15];
    channelsList.forEach((ch, idx) => {
      const spend = Math.round(spendBase * split[idx]! * (0.92 + rand() * 0.18));
      const clicks = Math.round(spend / (recent ? 2.35 : 1.85));
      const conversions = Math.max(1, Math.round(clicks * (recent ? 0.021 : 0.031)));
      const revenue = Math.round(conversions * (recent ? 296 : 322));
      campaigns.push({ id: `cmp-${date}-${idx}`, date, channel: ch, spend, clicks, conversions, revenue });
    });
  }

  return {
    store: {
      id: "store-aurora-home",
      name: "Aurora Home",
      currency: "BRL",
      defaultPeriodDays: 30,
      demoMode: true,
    },
    products: PRODUCTS,
    orders,
    traffic,
    campaigns,
    customers: [...customerMap.values()],
    source: { kind: "demo", label: "Modo demonstração — dados sintéticos" },
  };
}

let cache: { key: string; data: Dataset } | null = null;

/** Lazily built + memoized (never at module scope: Workers forbid global-scope I/O). */
export function getDemoDataset(): Dataset {
  const today = isoDay(new Date());
  if (!cache || cache.key !== today) {
    cache = { key: today, data: buildDemoDataset(today) };
  }
  return cache.data;
}