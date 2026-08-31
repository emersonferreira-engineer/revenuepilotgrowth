import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getStoreDataset, isoDay } from "@/lib/data/demo-dataset";
import { runDiagnostics } from "@/lib/diagnostics/rules";
import {
  DEFAULT_SETTINGS,
  DEFAULT_STORES,
  type ActionPlan,
  type ActionTask,
  type AiExchange,
  type AiRecommendation,
  type AppSettings,
  type AuditEvent,
  type Dataset,
  type ImportRecord,
  type Opportunity,
  type OpportunityStatus,
  type Store,
} from "@/lib/domain/types";

const STORAGE_KEY = "revenuepilot.state.v2";

interface PersistedState {
  settings: AppSettings;
  stores: Store[];
  activeStoreId: string;
  statuses: Record<string, OpportunityStatus>;
  impactOverrides: Record<string, { impact: number; note: string }>;
  aiResults: Record<string, AiExchange>;
  plans: ActionPlan[];
  imports: ImportRecord[];
  audit: AuditEvent[];
}

const EMPTY: PersistedState = {
  settings: DEFAULT_SETTINGS,
  stores: DEFAULT_STORES,
  activeStoreId: DEFAULT_STORES[0]!.id,
  statuses: {},
  impactOverrides: {},
  aiResults: {},
  plans: [],
  imports: [],
  audit: [],
};

export type StoreDraft = Omit<Store, "id" | "createdAt" | "seed" | "demoMode"> &
  Partial<Pick<Store, "seed">>;

interface AppStoreValue extends PersistedState {
  hydrated: boolean;
  todayIso: string;
  activeStore: Store;
  dataset: Dataset;
  opportunities: Opportunity[];
  updateSettings: (patch: Partial<AppSettings>) => void;
  createStore: (draft: StoreDraft) => Store;
  updateStore: (id: string, patch: Partial<Store>) => void;
  deleteStore: (id: string) => void;
  setActiveStore: (id: string) => void;
  setStatus: (id: string, status: OpportunityStatus) => void;
  setImpactOverride: (id: string, impact: number, note: string) => void;
  saveAiResult: (
    id: string,
    result: AiRecommendation,
    source: "n8n" | "demo",
    meta?: Partial<Pick<AiExchange, "requestPayload" | "rawResponse" | "webhookUrl" | "durationMs">>,
  ) => void;
  createPlan: (opportunity: Opportunity) => ActionPlan;
  updateTask: (planId: string, taskId: string, patch: Partial<ActionTask>) => void;
  addComment: (planId: string, taskId: string, text: string) => void;
  addTask: (planId: string, task: Omit<ActionTask, "id" | "comments">) => void;
  addImport: (record: ImportRecord) => void;
  log: (action: string, detail: string) => void;
  resetDemo: () => void;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(globalThis.performance?.now() ?? 0)
    .toString(36)
    .replace(".", "")}`;

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [todayIso, setTodayIso] = useState("2026-01-01");

  useEffect(() => {
    setTodayIso(isoDay(new Date()));
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedState;
        const stores = parsed.stores?.length ? parsed.stores : DEFAULT_STORES;
        setState({
          ...EMPTY,
          ...parsed,
          stores,
          activeStoreId: stores.some((s) => s.id === parsed.activeStoreId)
            ? parsed.activeStoreId
            : stores[0]!.id,
          settings: {
            ...DEFAULT_SETTINGS,
            ...parsed.settings,
            thresholds: { ...DEFAULT_SETTINGS.thresholds, ...parsed.settings?.thresholds },
          },
        });
      }
    } catch {
      // corrupted storage: keep defaults
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full or unavailable: state stays in memory
    }
  }, [state, hydrated]);

  const log = useCallback((action: string, detail: string) => {
    setState((s) => ({
      ...s,
      audit: [
        { id: uid("ev"), createdAt: new Date().toISOString(), actor: "Usuário demo", action, detail },
        ...s.audit,
      ].slice(0, 120),
    }));
  }, []);

  const activeStore = useMemo(
    () => state.stores.find((s) => s.id === state.activeStoreId) ?? state.stores[0]!,
    [state.stores, state.activeStoreId],
  );

  const dataset = useMemo(
    () => getStoreDataset(activeStore, todayIso),
    [activeStore, todayIso],
  );

  const opportunities = useMemo(() => {
    const base = runDiagnostics(dataset, todayIso, state.settings);
    return base.map((o) => {
      const override = state.impactOverrides[o.id];
      return override
        ? { ...o, estimatedImpact: override.impact, impactBasis: `${override.note} (hipótese editada pelo usuário)` }
        : o;
    });
  }, [dataset, todayIso, state.settings, state.impactOverrides]);

  const value = useMemo<AppStoreValue>(
    () => ({
      ...state,
      hydrated,
      todayIso,
      activeStore,
      dataset,
      opportunities,
      updateSettings: (patch) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
      createStore: (draft) => {
        const store: Store = {
          ...draft,
          id: uid("store"),
          seed: draft.seed ?? Math.floor(Date.now() % 1_000_000),
          demoMode: true,
          createdAt: isoDay(new Date()),
        };
        setState((s) => ({ ...s, stores: [...s.stores, store], activeStoreId: store.id }));
        return store;
      },
      updateStore: (id, patch) =>
        setState((s) => ({
          ...s,
          stores: s.stores.map((st) => (st.id === id ? { ...st, ...patch } : st)),
        })),
      deleteStore: (id) =>
        setState((s) => {
          if (s.stores.length <= 1) return s;
          const stores = s.stores.filter((st) => st.id !== id);
          return {
            ...s,
            stores,
            activeStoreId: s.activeStoreId === id ? stores[0]!.id : s.activeStoreId,
            plans: s.plans.filter((p) => !p.opportunityId.startsWith(`${id}__`)),
          };
        }),
      setActiveStore: (id) => setState((s) => ({ ...s, activeStoreId: id })),
      setStatus: (id, status) => setState((s) => ({ ...s, statuses: { ...s.statuses, [id]: status } })),
      setImpactOverride: (id, impact, note) =>
        setState((s) => ({ ...s, impactOverrides: { ...s.impactOverrides, [id]: { impact, note } } })),
      saveAiResult: (id, result, source, meta) =>
        setState((s) => ({
          ...s,
          aiResults: {
            ...s.aiResults,
            [id]: {
              result,
              source,
              at: new Date().toISOString(),
              requestPayload: meta?.requestPayload ?? null,
              rawResponse: meta?.rawResponse ?? null,
              webhookUrl: meta?.webhookUrl ?? null,
              durationMs: meta?.durationMs ?? null,
            },
          },
        })),
      createPlan: (opportunity) => {
        const existing = state.plans.find((p) => p.opportunityId === opportunity.id);
        if (existing) return existing;
        const today = new Date();
        const due = (days: number) => {
          const d = new Date(today);
          d.setDate(d.getDate() + days);
          return isoDay(d);
        };
        const plan: ActionPlan = {
          id: uid("plan"),
          opportunityId: opportunity.id,
          title: opportunity.title,
          createdAt: new Date().toISOString(),
          tasks: [
            {
              id: uid("task"),
              title: "Validar o diagnóstico com os dados brutos",
              owner: "Growth",
              dueDate: due(3),
              priority: "alta",
              status: "todo",
              successMetric: opportunity.successMetrics[0] ?? "Diagnóstico confirmado",
              comments: [],
            },
            {
              id: uid("task"),
              title: opportunity.recommendation.split(".")[0] ?? "Executar a ação recomendada",
              owner: "Marketing",
              dueDate: due(7),
              priority: "alta",
              status: "todo",
              successMetric: opportunity.successMetrics[1] ?? opportunity.successMetrics[0] ?? "Impacto medido",
              comments: [],
            },
            {
              id: uid("task"),
              title: "Medir resultado e registrar aprendizado",
              owner: "Growth",
              dueDate: due(14),
              priority: "media",
              status: "todo",
              successMetric: opportunity.successMetrics[2] ?? "Resultado documentado",
              comments: [],
            },
          ],
        };
        setState((s) => ({
          ...s,
          plans: [plan, ...s.plans],
          statuses: { ...s.statuses, [opportunity.id]: "em_plano" },
        }));
        return plan;
      },
      updateTask: (planId, taskId, patch) =>
        setState((s) => ({
          ...s,
          plans: s.plans.map((p) =>
            p.id === planId
              ? { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) }
              : p,
          ),
        })),
      addComment: (planId, taskId, text) =>
        setState((s) => ({
          ...s,
          plans: s.plans.map((p) =>
            p.id === planId
              ? {
                  ...p,
                  tasks: p.tasks.map((t) =>
                    t.id === taskId
                      ? {
                          ...t,
                          comments: [
                            ...t.comments,
                            { id: uid("c"), author: "Você", text, createdAt: new Date().toISOString() },
                          ],
                        }
                      : t,
                  ),
                }
              : p,
          ),
        })),
      addTask: (planId, task) =>
        setState((s) => ({
          ...s,
          plans: s.plans.map((p) =>
            p.id === planId ? { ...p, tasks: [...p.tasks, { ...task, id: uid("task"), comments: [] }] } : p,
          ),
        })),
      addImport: (record) => setState((s) => ({ ...s, imports: [record, ...s.imports] })),
      log,
      resetDemo: () => setState({ ...EMPTY }),
    }),
    [state, hydrated, todayIso, activeStore, dataset, opportunities, log],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore precisa estar dentro de AppStoreProvider");
  return ctx;
}
