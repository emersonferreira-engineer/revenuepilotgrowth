import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getDemoDataset, isoDay } from "@/lib/data/demo-dataset";
import { runDiagnostics } from "@/lib/diagnostics/rules";
import {
  DEFAULT_SETTINGS,
  type ActionPlan,
  type ActionTask,
  type AiRecommendation,
  type AppSettings,
  type AuditEvent,
  type ImportRecord,
  type Opportunity,
  type OpportunityStatus,
} from "@/lib/domain/types";

const STORAGE_KEY = "revenuepilot.state.v1";

interface PersistedState {
  settings: AppSettings;
  statuses: Record<string, OpportunityStatus>;
  impactOverrides: Record<string, { impact: number; note: string }>;
  aiResults: Record<string, { result: AiRecommendation; source: "n8n" | "demo"; at: string }>;
  plans: ActionPlan[];
  imports: ImportRecord[];
  audit: AuditEvent[];
}

const EMPTY: PersistedState = {
  settings: DEFAULT_SETTINGS,
  statuses: {},
  impactOverrides: {},
  aiResults: {},
  plans: [],
  imports: [],
  audit: [],
};

interface AppStoreValue extends PersistedState {
  hydrated: boolean;
  todayIso: string;
  opportunities: Opportunity[];
  updateSettings: (patch: Partial<AppSettings>) => void;
  setStatus: (id: string, status: OpportunityStatus) => void;
  setImpactOverride: (id: string, impact: number, note: string) => void;
  saveAiResult: (id: string, result: AiRecommendation, source: "n8n" | "demo") => void;
  createPlan: (opportunity: Opportunity) => ActionPlan;
  updateTask: (planId: string, taskId: string, patch: Partial<ActionTask>) => void;
  addComment: (planId: string, taskId: string, text: string) => void;
  addTask: (planId: string, task: Omit<ActionTask, "id" | "comments">) => void;
  addImport: (record: ImportRecord) => void;
  log: (action: string, detail: string) => void;
  resetDemo: () => void;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(globalThis.performance?.now() ?? 0).toString(36).replace(".", "")}`;

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
        setState({
          ...EMPTY,
          ...parsed,
          settings: { ...DEFAULT_SETTINGS, ...parsed.settings, thresholds: { ...DEFAULT_SETTINGS.thresholds, ...parsed.settings?.thresholds } },
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
      ].slice(0, 100),
    }));
  }, []);

  const opportunities = useMemo(() => {
    const base = runDiagnostics(getDemoDataset(), todayIso, state.settings);
    return base.map((o) => {
      const override = state.impactOverrides[o.id];
      return override
        ? { ...o, estimatedImpact: override.impact, impactBasis: `${override.note} (hipótese editada pelo usuário)` }
        : o;
    });
  }, [todayIso, state.settings, state.impactOverrides]);

  const value = useMemo<AppStoreValue>(
    () => ({
      ...state,
      hydrated,
      todayIso,
      opportunities,
      updateSettings: (patch) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
      setStatus: (id, status) => setState((s) => ({ ...s, statuses: { ...s.statuses, [id]: status } })),
      setImpactOverride: (id, impact, note) =>
        setState((s) => ({ ...s, impactOverrides: { ...s.impactOverrides, [id]: { impact, note } } })),
      saveAiResult: (id, result, source) =>
        setState((s) => ({ ...s, aiResults: { ...s.aiResults, [id]: { result, source, at: new Date().toISOString() } } })),
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
      resetDemo: () => setState({ ...EMPTY, settings: DEFAULT_SETTINGS }),
    }),
    [state, hydrated, todayIso, opportunities, log],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore precisa estar dentro de AppStoreProvider");
  return ctx;
}