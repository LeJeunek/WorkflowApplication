import { Cog, GitBranch, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useWorkflowStore } from "../state/workflowStore";
import type { NewNodeInput } from "../state/workflowStore";

import type {
  ActionConfig,
  ConditionConfig,
  NodeType,
  TriggerConfig,
} from "../types";

/** Icon and accent colour keyed to each node type, matching WorkflowNode. */
const NODE_PRESENTATION: Record<NodeType, { icon: LucideIcon; tone: string }> = {
  trigger: { icon: Zap, tone: "text-trigger" },
  action: { icon: Cog, tone: "text-action" },
  condition: { icon: GitBranch, tone: "text-condition" },
};

const NODE_OPTIONS: Array<{
  type: NodeType;
  label: string;
}> = [
  {
    type: "trigger",
    label: "Trigger",
  },
  {
    type: "action",
    label: "Action",
  },
  {
    type: "condition",
    label: "Condition",
  },
];

function createDefaultNodeInput(type: NodeType, label: string): NewNodeInput {
  switch (type) {
    case "trigger": {
      const config: TriggerConfig = {
        event: "customer.created",
      };

      return {
        type: "trigger",
        label,
        config,
      };
    }

    case "action": {
      const config: ActionConfig = {
        action: "send_email",
      };

      return {
        type: "action",
        label,
        config,
      };
    }

    case "condition": {
      const config: ConditionConfig = {
        field: "",
        operator: "equals",
        value: "",
      };

      return {
        type: "condition",
        label,
        config,
      };
    }
  }
}

export function NodePalette() {
  const addNode = useWorkflowStore((state) => state.addNode);

  return (
    <aside
      aria-label="Nodes"
      className="hidden w-56 shrink-0 flex-col border-r border-line bg-surface md:flex"
    >
      <div className="flex h-9 shrink-0 items-center border-b border-line px-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
          Nodes
        </h2>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-1">
          {NODE_OPTIONS.map(({ type, label }) => {
            const defaultLabel =
              type === "trigger"
                ? "New Trigger"
                : type === "action"
                  ? "New Action"
                  : "New Condition";
            const { icon: Icon, tone } = NODE_PRESENTATION[type];

            return (
              <li key={type}>
                <button
                  type="button"
                  aria-label={`Add ${label} node`}
                  onClick={() =>
                    addNode(createDefaultNodeInput(type, defaultLabel))
                  }
                  className="flex w-full items-center gap-2.5 rounded-md border border-transparent px-2 py-2 text-left transition-colors hover:border-line-strong hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                >
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-md bg-elevated ring-1 ring-line ${tone}`}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-medium text-ink">
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
