import type { ReactNode } from "react";
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
import { SamplePayloadEditor } from "./SamplePayloadEditor";

/**
 * A one-line, plain-language explanation shown under a field, so someone
 * unfamiliar with the underlying concept (JSON, cron, dot-paths, HTTP
 * verbs) knows what to type without having to already know it.
 */
export function FieldHint({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
      {children}
    </p>
  );
}

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
  form_submission: "Form submission",
};

const ACTION_CONFIG_KIND_LABELS: Record<ActionConfigKind, string> = {
  send_email: "Send email",
  http_request: "Call a website",
  add_tag: "Add tag",
  slack_message: "Slack message",
  validate_order: "Validate order",
  cancel_order: "Cancel order",
};

/**
 * Fresh defaults for a config kind. Switching kind discards the previous
 * variant's fields rather than trying to preserve them -- there is no
 * meaningful mapping from, say, a schedule's `cron` onto an event's `event`,
 * and `updateNodeConfig` already replaces wholesale rather than merging.
 *
 * Returns the full union type rather than spelling it out inline: a
 * spelled-out return type has to be edited by hand every time a kind is
 * added (as just happened going from 2 to 3/4 kinds), where `TriggerConfig`
 * already grows on its own.
 */
/**
 * `samplePayload` is threaded through explicitly, not discarded like the
 * kind-specific fields (`event`/`cron`/`formName`) are: unlike those, it
 * isn't tied to any one kind -- it's the same field, same meaning, on
 * every variant -- so switching Kind has no reason to lose it.
 */
function defaultTriggerConfig(
  kind: TriggerConfigKind,
  samplePayload: string | undefined,
): TriggerConfig {
  switch (kind) {
    case "event":
      return { kind: "event", event: "", samplePayload };
    case "schedule":
      return { kind: "schedule", cron: "", samplePayload };
    case "form_submission":
      return { kind: "form_submission", formName: "", samplePayload };
  }
}

function defaultActionConfig(kind: ActionConfigKind): ActionConfig {
  switch (kind) {
    case "send_email":
      return { kind: "send_email" };
    case "http_request":
      return { kind: "http_request", url: "", method: "GET" };
    case "add_tag":
      return { kind: "add_tag", tag: "" };
    case "slack_message":
      return { kind: "slack_message", channel: "", message: "" };
    case "validate_order":
      return { kind: "validate_order" };
    case "cancel_order":
      return { kind: "cancel_order" };
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
  // Every trigger kind carries samplePayload (see the TriggerConfig doc
  // comment in types.ts), so spreading ...config rather than writing a
  // fresh literal here matters: a literal would silently drop whatever the
  // Sample payload field below already holds every time this field changes.
  const kindField =
    config.kind === "event" ? (
      <label className="block">
        <span className="mb-1 block text-xs text-ink-faint">Event</span>

        <input
          type="text"
          aria-label="Event"
          value={config.event}
          placeholder="customer.created"
          onChange={(event) =>
            onChange({ ...config, event: event.target.value })
          }
          className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
        />
        <FieldHint>
          A short name for what just happened, like{" "}
          <code>customer.created</code> or <code>order.placed</code>.
        </FieldHint>
      </label>
    ) : config.kind === "schedule" ? (
      <label className="block">
        <span className="mb-1 block text-xs text-ink-faint">Schedule</span>

        <input
          type="text"
          aria-label="Schedule"
          value={config.cron}
          placeholder="0 9 * * *"
          onChange={(event) =>
            onChange({ ...config, cron: event.target.value })
          }
          className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
        />
        <FieldHint>
          When this should run, in cron format. <code>0 9 * * *</code> means
          every day at 9am; <code>*/30 * * * *</code> means every 30
          minutes.
        </FieldHint>
      </label>
    ) : (
      <label className="block">
        <span className="mb-1 block text-xs text-ink-faint">Form name</span>

        <input
          type="text"
          aria-label="Form name"
          value={config.formName}
          placeholder="Contact form"
          onChange={(event) =>
            onChange({ ...config, formName: event.target.value })
          }
          className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
        />
        <FieldHint>The name of the form that was submitted.</FieldHint>
      </label>
    );

  return (
    <>
      {kindField}

      <div>
        <span className="mb-1 block text-xs text-ink-faint">
          Example data
        </span>

        <SamplePayloadEditor
          samplePayload={config.samplePayload}
          onChange={(samplePayload) => onChange({ ...config, samplePayload })}
        />
      </div>
    </>
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
          aria-label="Recipient"
          value={config.recipient ?? ""}
          placeholder="name@example.com"
          onChange={(event) =>
            onChange({ ...config, recipient: event.target.value })
          }
          className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
        />
        <FieldHint>Who the simulated email would be sent to.</FieldHint>
      </label>
    );
  }

  if (config.kind === "http_request") {
    return (
      <>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-faint">
            Web address
          </span>

          <input
            type="text"
            aria-label="Web address"
            value={config.url}
            placeholder="https://example.com/webhook"
            onChange={(event) =>
              onChange({ ...config, url: event.target.value })
            }
            className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
          />
          <FieldHint>The website or service this would contact.</FieldHint>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-ink-faint">Method</span>

          <select
            aria-label="Method"
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
          <FieldHint>
            <strong>GET</strong> asks the website for information.{" "}
            <strong>POST</strong> sends new information to it.
          </FieldHint>
        </label>
      </>
    );
  }

  if (config.kind === "add_tag") {
    return (
      <label className="block">
        <span className="mb-1 block text-xs text-ink-faint">Tag</span>

        <input
          type="text"
          aria-label="Tag"
          value={config.tag}
          placeholder="vip"
          onChange={(event) =>
            onChange({ ...config, tag: event.target.value })
          }
          className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
        />
        <FieldHint>
          A short label to attach, for organizing or filtering later.
        </FieldHint>
      </label>
    );
  }

  if (config.kind === "slack_message") {
    return (
      <>
        <label className="block">
          <span className="mb-1 block text-xs text-ink-faint">Channel</span>

          <input
            type="text"
            aria-label="Channel"
            value={config.channel}
            placeholder="#general"
            onChange={(event) =>
              onChange({ ...config, channel: event.target.value })
            }
            className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
          />
          <FieldHint>
            Which Slack channel the simulated message would be posted to.
          </FieldHint>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-ink-faint">Message</span>

          <input
            type="text"
            aria-label="Message"
            value={config.message}
            placeholder="Welcome to the team!"
            onChange={(event) =>
              onChange({ ...config, message: event.target.value })
            }
            className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
          />
          <FieldHint>The text of the simulated message.</FieldHint>
        </label>
      </>
    );
  }

  return (
    <p className="text-xs text-ink-faint">
      Checks the trigger's sample payload against order validity rules. No
      configuration needed.
    </p>
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
              <FieldHint>
                A name to help you recognize this step on the canvas.
              </FieldHint>
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
                <p className="mb-3 text-xs leading-relaxed text-ink-muted">
                  Decides what starts this workflow.
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
                            selectedNode.data.config.samplePayload,
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
                    <FieldHint>
                      The kind of thing that starts this workflow.
                    </FieldHint>
                  </label>

                  <TriggerConfigFields
                    key={selectedNode.id}
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
                <p className="mb-3 text-xs leading-relaxed text-ink-muted">
                  Decides what happens when this step runs.
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
                    <FieldHint>What this step actually does.</FieldHint>
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
                <p className="mb-3 text-xs leading-relaxed text-ink-muted">
                  Decides which path the workflow takes next.
                </p>

                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-ink-faint">
                      Field
                    </span>

                    <input
                      type="text"
                      aria-label="Field"
                      value={selectedNode.data.config.field}
                      placeholder="customer.plan"
                      onChange={(event) =>
                        updateNodeConfig(selectedNode.id, {
                          ...selectedNode.data.config,
                          field: event.target.value,
                        })
                      }
                      className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                    />
                    <FieldHint>
                      The piece of information to check, e.g.{" "}
                      <code>customer.plan</code>. Use a dot to look inside
                      nested data.
                    </FieldHint>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs text-ink-faint">
                      Operator
                    </span>

                    <select
                      aria-label="Operator"
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
                    <FieldHint>
                      How to compare the field above to the value below.
                    </FieldHint>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs text-ink-faint">
                      Value
                    </span>

                    <input
                      type="text"
                      aria-label="Value"
                      value={selectedNode.data.config.value}
                      placeholder="pro"
                      onChange={(event) =>
                        updateNodeConfig(selectedNode.id, {
                          ...selectedNode.data.config,
                          value: event.target.value,
                        })
                      }
                      className="w-full rounded-md border border-line bg-elevated px-2 py-1.5 text-sm text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                    />
                    <FieldHint>
                      What to compare the field against.
                    </FieldHint>
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
