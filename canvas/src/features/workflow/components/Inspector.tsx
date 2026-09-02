import { SlidersHorizontal } from "lucide-react";

import { useWorkflowStore } from "../state/workflowStore";
import { ACTION_CONFIG_KINDS, CONDITION_OPERATORS, TRIGGER_CONFIG_KINDS } from "../types";
import type {
  ActionConfig,
  ActionConfigKind,
  ConditionOperator,
  NodeType,
  TriggerConfig,
  TriggerConfigKind,
} from "../types";

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

const TRIGGER_CONFIG_KIND_LABELS: Record<TriggerConfigKind, string> = {
  event: "Event",
  schedule: "Schedule",
};

const ACTION_CONFIG_KIND_LABELS: Record<ActionConfigKind, string> = {
  send_email: "Send email",
  http_request: "HTTP request",
};

/**
 * Fresh defaults for a config kind. Switching kind discards the previous
 * variant's fields rather than trying to preserve them -- there is no
 * meaningful mapping from, say, a schedule's `cron` onto an event's `event`,
 * and `updateNodeConfig` already replaces wholesale rather than merging.
 */
function defaultTriggerConfig(kind: TriggerConfigKind): {
  kind: "event";
  event: string;
} | { kind: "schedule"; cron: string } {
  switch (kind) {
    case "event":
      return { kind: "event", event: "" };
    case "schedule":
      return { kind: "schedule", cron: "" };
  }
}

function defaultActionConfig(kind: ActionConfigKind):
  | { kind: "send_email"; recipient?: string }
  | { kind: "http_request"; url: string; method: "GET" | "POST" } {
  switch (kind) {
    case "send_email":
      return { kind: "send_email" };
    case "http_request":
      return { kind: "http_request", url: "", method: "GET" };
  }
}

/**
 * The fields specific to one {@link TriggerConfig} variant.
 *
 * Split out as its own component (rather than a ternary inline in
 * `Inspector`) because narrowing a deeply nested property chain like
 * `selectedNode.data.config.kind` does not survive into a JSX event handler,
 * which is its own function scope -- TypeScript can't prove a property
 * hasn't changed by the time a closure runs, so it falls back to the whole
 * union there and rejects fields specific to one variant. A component
 * parameter is a plain identifier, and narrowing an identifier *does*
 * survive into closures defined within the same function body.
 */
function TriggerConfigFields({
  config,
  onChange,
}: {
  config: TriggerConfig;
  onChange: (config: TriggerConfig) => void;
}) {
  if (config.kind === "event") {
    return (
      <label className="block">
        <span className="mb-1 block text-xs text-ink-faint">Event</span>

        <input
          type="text"
          value={config.event}
          onChange={(event) =>
            onChange({ kind: "event", event: event.target.value })
          }
          className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
        />
      </label>
    );
  }

  return (
    <label className="block">
      <span className="mb-1 block text-xs text-ink-faint">
        Cron expression
      </span>

      <input
        type="text"
        value={config.cron}
        onChange={(event) =>
          onChange({ kind: "schedule", cron: event.target.value })
        }
        className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
      />
    </label>
  );
}

/** The fields specific to one {@link ActionConfig} variant. See {@link TriggerConfigFields} for why this is a component rather than an inline ternary. */
function ActionConfigFields({
  config,
  onChange,
}: {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
}) {
  if (config.kind === "send_email") {
    return (
      <label className="block">
        <span className="mb-1 block text-xs text-ink-faint">Recipient</span>

        <input
          type="text"
          value={config.recipient ?? ""}
          onChange={(event) =>
            onChange({ kind: "send_email", recipient: event.target.value })
          }
          className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
        />
      </label>
    );
  }

  return (
    <>
      <label className="block">
        <span className="mb-1 block text-xs text-ink-faint">URL</span>

        <input
          type="text"
          value={config.url}
          onChange={(event) =>
            onChange({ ...config, url: event.target.value })
          }
          className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-ink-faint">Method</span>

        <select
          value={config.method}
          onChange={(event) =>
            onChange({
              ...config,
              method: event.target.value as "GET" | "POST",
            })
          }
          className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
        </select>
      </label>
    </>
  );
}

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

                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-ink-faint">
                      Kind
                    </span>

                    <select
                      aria-label="Kind"
                      value={selectedNode.data.config.kind}
                      onChange={(event) =>
                        updateNodeConfig(
                          selectedNode.id,
                          defaultTriggerConfig(
                            event.target.value as TriggerConfigKind,
                          ),
                        )
                      }
                      className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                    >
                      {TRIGGER_CONFIG_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {TRIGGER_CONFIG_KIND_LABELS[kind]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <TriggerConfigFields
                    config={selectedNode.data.config}
                    onChange={(config) =>
                      updateNodeConfig(selectedNode.id, config)
                    }
                  />
                </div>
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
                      Kind
                    </span>

                    <select
                      aria-label="Kind"
                      value={selectedNode.data.config.kind}
                      onChange={(event) =>
                        updateNodeConfig(
                          selectedNode.id,
                          defaultActionConfig(
                            event.target.value as ActionConfigKind,
                          ),
                        )
                      }
                      className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                    >
                      {ACTION_CONFIG_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {ACTION_CONFIG_KIND_LABELS[kind]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <ActionConfigFields
                    config={selectedNode.data.config}
                    onChange={(config) =>
                      updateNodeConfig(selectedNode.id, config)
                    }
                  />
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
