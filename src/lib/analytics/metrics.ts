import { addDays, daysBetween } from "@/lib/data/demo-dataset";
import { TRAFFIC_CHANNELS, type Dataset, type TrafficChannel } from "@/lib/domain/types";

export interface PeriodWindow {
  start: string;
  end: string;
  label: string;
}

export interface PeriodMetrics {
  window: PeriodWindow;
  revenue: number;
  orders: number;
  aov: number;
  sessions: number;
  conversionRate: number; // 0..1
  adSpend: number;
  adConversions: number;
  adRevenue: number;
  cac: number | null;
  roas: number | null;
  newCustomers: number;
  returningOrders: number;
}

export interface MetricsComparison {
  current: PeriodMetrics;
  previous: PeriodMetrics;
}

export function buildWindows(todayIso: string, periodDays: number) {
  const end = todayIso;
  const start = addDays(end, -(periodDays - 1));
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(periodDays - 1));
  return {
    current: { start, end, label: `${start} a ${end}` } satisfies PeriodWindow,
    previous: { start: prevStart, end: prevEnd, label: `${prevStart} a ${prevEnd}` } satisfies PeriodWindow,
  };
}

const inWindow = (date: string, w: PeriodWindow) => date >= w.start && date <= w.end;

export function computePeriodMetrics(dataset: Dataset, w: PeriodWindow): PeriodMetrics {
  const orders = dataset.orders.filter((o) => inWindow(o.date, w));
  const traffic = dataset.traffic.filter((t) => inWindow(t.date, w));
  const campaigns = dataset.campaigns.filter((c) => inWindow(c.date, w));

  const revenue = orders.reduce((s, o) => s + o.revenue, 0);
  const sessions = traffic.reduce((s, t) => s + t.sessions, 0);
  const adSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const adConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const adRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);

  const firstOrderIds = new Set(
    dataset.customers.filter((c) => inWindow(c.firstOrderDate, w)).map((c) => c.id),
  );

  return {
    window: w,
    revenue,
    orders: orders.length,
    aov: orders.length ? revenue / orders.length : 0,
    sessions,
    conversionRate: sessions ? orders.length / sessions : 0,
    adSpend,
    adConversions,
    adRevenue,
    cac: adConversions > 0 ? adSpend / adConversions : null,
    roas: adSpend > 0 ? adRevenue / adSpend : null,
    newCustomers: firstOrderIds.size,
    returningOrders: orders.filter((o) => !firstOrderIds.has(o.customerId)).length,
  };
}

export function compareMetrics(dataset: Dataset, todayIso: string, periodDays: number): MetricsComparison {
  const windows = buildWindows(todayIso, periodDays);
  return {
    current: computePeriodMetrics(dataset, windows.current),
    previous: computePeriodMetrics(dataset, windows.previous),
  };
}

export function delta(current: number, previous: number): number | null {
  if (!previous) return null;
  return (current - previous) / previous;
}

export function dailyRevenueSeries(dataset: Dataset, w: PeriodWindow) {
  const days = daysBetween(w.start, w.end) + 1;
  const map = new Map<string, { revenue: number; orders: number }>();
  for (let i = 0; i < days; i++) {
    map.set(addDays(w.start, i), { revenue: 0, orders: 0 });
  }
  for (const o of dataset.orders) {
    const bucket = map.get(o.date);
    if (bucket) {
      bucket.revenue += o.revenue;
      bucket.orders += 1;
    }
  }
  return [...map.entries()].map(([date, v]) => ({ date, ...v }));
}

export function productRevenue(dataset: Dataset, w: PeriodWindow) {
  const totals = new Map<string, { revenue: number; units: number }>();
  for (const o of dataset.orders) {
    if (!inWindow(o.date, w)) continue;
    for (const item of o.items) {
      const cur = totals.get(item.productId) ?? { revenue: 0, units: 0 };
      cur.revenue += item.unitPrice * item.quantity;
      cur.units += item.quantity;
      totals.set(item.productId, cur);
    }
  }
  return totals;
}
export interface ChannelMetrics {
  channel: TrafficChannel;
  sessions: number;
  orders: number;
  revenue: number;
  conversionRate: number;
  spend: number;
  cac: number | null;
  roas: number | null;
}

export interface ChannelComparison {
  channel: TrafficChannel;
  current: ChannelMetrics;
  previous: ChannelMetrics;
  revenueChange: number | null;
  conversionChange: number | null;
  cacChange: number | null;
}

function emptyChannelMetrics(channel: TrafficChannel): ChannelMetrics {
  return {
    channel,
    sessions: 0,
    orders: 0,
    revenue: 0,
    conversionRate: 0,
    spend: 0,
    cac: null,
    roas: null,
  };
}

/** Revenue, conversion and CAC per traffic channel inside a window. */
export function channelMetrics(dataset: Dataset, w: PeriodWindow): ChannelMetrics[] {
  const acc = new Map<TrafficChannel, ChannelMetrics>(
    TRAFFIC_CHANNELS.map((c) => [c, emptyChannelMetrics(c)]),
  );

  for (const t of dataset.traffic) {
    if (!inWindow(t.date, w)) continue;
    for (const ch of TRAFFIC_CHANNELS) acc.get(ch)!.sessions += t.byChannel[ch] ?? 0;
  }
  for (const o of dataset.orders) {
    if (!inWindow(o.date, w)) continue;
    const row = acc.get(o.channel);
    if (!row) continue;
    row.orders += 1;
    row.revenue += o.revenue;
  }
  for (const c of dataset.campaigns) {
    if (!inWindow(c.date, w)) continue;
    acc.get(c.channel)!.spend += c.spend;
  }

  return TRAFFIC_CHANNELS.map((ch) => {
    const row = acc.get(ch)!;
    row.conversionRate = row.sessions ? row.orders / row.sessions : 0;
    row.cac = row.spend > 0 && row.orders > 0 ? row.spend / row.orders : null;
    row.roas = row.spend > 0 ? row.revenue / row.spend : null;
    return row;
  });
}

export function compareChannels(
  dataset: Dataset,
  todayIso: string,
  periodDays: number,
): ChannelComparison[] {
  const windows = buildWindows(todayIso, periodDays);
  const cur = channelMetrics(dataset, windows.current);
  const prev = channelMetrics(dataset, windows.previous);
  return cur.map((c, i) => {
    const p = prev[i]!;
    return {
      channel: c.channel,
      current: c,
      previous: p,
      revenueChange: delta(c.revenue, p.revenue),
      conversionChange: delta(c.conversionRate, p.conversionRate),
      cacChange: c.cac !== null && p.cac !== null ? delta(c.cac, p.cac) : null,
    };
  });
}
