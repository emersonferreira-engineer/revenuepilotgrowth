import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAppStore } from "@/lib/data/app-store";
import type { ActionTask } from "@/lib/domain/types";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos de ação — RevenuePilot" },
      {
        name: "description",
        content:
          "Tarefas com responsável, prazo, prioridade, métrica de sucesso e comentários para executar cada oportunidade priorizada.",
      },
      { property: "og:title", content: "Planos de ação — RevenuePilot" },
      {
        property: "og:description",
        content: "Execução das oportunidades em tarefas com responsáveis e métricas.",
      },
    ],
  }),
  component: PlansPage,
});

const STATUS_FLOW: ActionTask["status"][] = ["todo", "doing", "done"];

function PlansPage() {
  const { plans, updateTask, addComment, addTask, hydrated, log } = useAppStore();
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [taskDrafts, setTaskDrafts] = useState<Record<string, string>>({});

  return (
    <AppShell
      title="Planos de ação"
      description="Cada plano nasce de uma oportunidade e traz tarefas com responsável, prazo e métrica de sucesso."
    >
      {!hydrated ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum plano ainda. Abra uma oportunidade e clique em “Criar plano de ação”.
          </p>
          <Link
            to="/oportunidades"
            className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Ver oportunidades
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {plans.map((plan) => {
            const done = plan.tasks.filter((t) => t.status === "done").length;
            return (
              <section key={plan.id} id={plan.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-foreground">{plan.title}</h2>
                  <span className="text-xs text-muted-foreground">
                    {done}/{plan.tasks.length} concluídas
                  </span>
                </div>

                <ul className="mt-4 space-y-3">
                  {plan.tasks.map((task) => (
                    <li key={task.id} className="rounded-lg border border-border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground">{task.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {task.owner} · vence {task.dueDate} · prioridade {task.priority}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Métrica: {task.successMetric}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {STATUS_FLOW.map((s) => (
                            <button
                              key={s}
                              onClick={() => {
                                updateTask(plan.id, task.id, { status: s });
                                log("Tarefa atualizada", `${task.title} → ${s}`);
                              }}
                              className={
                                task.status === s
                                  ? "rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                                  : "rounded-md border border-input px-2.5 py-1 text-xs hover:bg-accent"
                              }
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>

                      {task.comments.length > 0 ? (
                        <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                          {task.comments.map((c) => (
                            <li key={c.id}>
                              <strong className="text-foreground">{c.author}:</strong> {c.text}
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      <div className="mt-3 flex gap-2">
                        <input
                          value={commentDrafts[task.id] ?? ""}
                          onChange={(e) =>
                            setCommentDrafts((d) => ({ ...d, [task.id]: e.target.value }))
                          }
                          placeholder="Comentar…"
                          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs"
                        />
                        <button
                          onClick={() => {
                            const text = (commentDrafts[task.id] ?? "").trim();
                            if (!text) return;
                            addComment(plan.id, task.id, text);
                            setCommentDrafts((d) => ({ ...d, [task.id]: "" }));
                          }}
                          className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent"
                        >
                          Enviar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex gap-2">
                  <input
                    value={taskDrafts[plan.id] ?? ""}
                    onChange={(e) => setTaskDrafts((d) => ({ ...d, [plan.id]: e.target.value }))}
                    placeholder="Nova tarefa"
                    className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => {
                      const title = (taskDrafts[plan.id] ?? "").trim();
                      if (!title) return;
                      addTask(plan.id, {
                        title,
                        owner: "Growth",
                        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
                        priority: "media",
                        status: "todo",
                        successMetric: "A definir",
                      });
                      setTaskDrafts((d) => ({ ...d, [plan.id]: "" }));
                    }}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Adicionar
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
