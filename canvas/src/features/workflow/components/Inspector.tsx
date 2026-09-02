import { SlidersHorizontal } from "lucide-react";

import { useWorkflowStore } from "../state/workflowStore";
import { CONDITION_OPERATORS } from "../types";
import type { ConditionOperator, NodeType } from "../types";

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  trigger: "Trigger",
  action: "Action",
  condition: "Condition",
};

/**
 * Human-readable label for each {@link CONDITION_OPERATORS} value.
 *
 * Typed `Record<ConditionOperator, string>` so a new operator added to the
 * union fails to compile here until it's given a label -- the same
 * exhaustiveness guarantee `NODE_TYPE_LABELS` gets from `NodeType`.
 */
const CONDITION_OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "Equals",
  not_equals: "Not equals",
  contains: "Contains",
  greater_than: "Greater than",
  less_than: "Less than",
};

/** Right rail for editing the properties of the current selection. */
export function Inspector() {
  const workflow = useWorkflowStore((state) => state.workflow);
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);

  const selectedNode = workflow.nodes.find(
    (node) => node.id === selectedNodeId,
  );
  const updateNode = useWorkflowStore((state) => state.updateNode);
  const updateNodeConfig = useWorkflowStore((state) => state.updateNodeConfig);

  return (
    <aside
      aria-label="Inspector"
      className="hidden w-72 shrink-0 flex-col border-l border-line bg-surface lg:flex"
    >
      <div className="flex h-9 shrink-0 items-center border-b border-line px-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          Inspector
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {selectedNode ? (
          <div className="space-y-5">
            <section>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                Type
              </p>

              <p className="text-sm font-medium text-ink">
                {NODE_TYPE_LABELS[selectedNode.type]}
              </p>
            </section>
            <section>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                Label
              </p>

              <input
                type="text"
                aria-label="Label"
                value={selectedNode.data.label}
                onChange={(event) =>
                  updateNode(selectedNode.id, {
                    label: event.target.value,
                  })
                }
                className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
              />
            </section>
            {selectedNode.data.description !== undefined && (
              <section>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                  Description
                </p>

                <textarea
                  aria-label="Description"
                  value={selectedNode.data.description}
                  onChange={(event) =>
                    updateNode(selectedNode.id, {
                      description: event.target.value,
                    })
                  }
                  rows={3}
                  className="w-full resize-none rounded-md border border-line bg-elevated px-2 py-1.5 text-xs leading-relaxed text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                />
              </section>
            )}
            {selectedNode.type === "trigger" && (
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                  Configuration
                </p>

                <label className="block">
                  <span className="mb-1 block text-xs text-ink-faint">
                    Event
                  </span>

                  <input
                    type="text"
                    value={selectedNode.data.config.event}
                    onChange={(event) =>
                      updateNodeConfig(selectedNode.id, {
                        event: event.target.value,
                      })
                    }
                    className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                  />
                </label>
              </section>
            )}
            {selectedNode.type === "action" && (
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                  Configuration
                </p>

                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-ink-faint">
                      Action
                    </span>

                    <input
                      type="text"
                      value={selectedNode.data.config.action}
                      onChange={(event) =>
                        updateNodeConfig(selectedNode.id, {
                          ...selectedNode.data.config,
                          action: event.target.value,
                        })
                      }
                      className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs text-ink-faint">
                      Recipient
                    </span>

                    <input
                      type="text"
                      value={selectedNode.data.config.recipient ?? ""}
                      onChange={(event) =>
                        updateNodeConfig(selectedNode.id, {
                          ...selectedNode.data.config,
                          recipient: event.target.value,
                        })
                      }
                      className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                    />
                  </label>
                </div>
              </section>
            )}
            {selectedNode.type === "condition" && (
              <section>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                  Configuration
                </p>

                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-ink-faint">
                      Field
                    </span>

                    <input
                      type="text"
                      value={selectedNode.data.config.field}
                      onChange={(event) =>
                        updateNodeConfig(selectedNode.id, {
                          ...selectedNode.data.config,
                          field: event.target.value,
                        })
                      }
                      className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs text-ink-faint">
                      Operator
                    </span>

                    <select
                      value={selectedNode.data.config.operator}
                      onChange={(event) =>
                        updateNodeConfig(selectedNode.id, {
                          ...selectedNode.data.config,
                          // The <option> values below are generated from
                          // CONDITION_OPERATORS, so this can only ever be
                          // one of the 5 real operators -- the browser's
                          // DOM types just don't know that, hence the cast.
                          operator: event.target.value as ConditionOperator,
                        })
                      }
                      className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                    >
                      {CONDITION_OPERATORS.map((operator) => (
                        <option key={operator} value={operator}>
                          {CONDITION_OPERATOR_LABELS[operator]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs text-ink-faint">
                      Value
                    </span>

                    <input
                      type="text"
                      value={selectedNode.data.config.value}
                      onChange={(event) =>
                        updateNodeConfig(selectedNode.id, {
                          ...selectedNode.data.config,
                          value: event.target.value,
                        })
                      }
                      className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                    />
                  </label>
                </div>
              </section>
            )}
          </div>
        ) : (
          <p className="flex h-full items-center justify-center text-center text-xs leading-relaxed text-ink-faint">
            <span className="max-w-[13rem]">
              <SlidersHorizontal
                className="mx-auto mb-3 size-5"
                aria-hidden="true"
              />
              Select a node to inspect its properties.
            </span>
          </p>
        )}
      </div>
    </aside>
  );
}
