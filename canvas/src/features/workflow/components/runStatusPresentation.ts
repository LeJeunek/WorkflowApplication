import { Check, Minus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { NodeRunStatus } from "../types";

export interface RunStatusPresentation {
  icon: LucideIcon;
  /** Background + icon colour for a status badge/chip. */
  badgeClassName: string;
  /** Short word describing the status, e.g. as a badge's accessible name prefix. */
  label: string;
}

/**
 * Exhaustive over {@link NodeRunStatus} -- a new status fails to compile
 * here until it's given an appearance, rather than silently rendering
 * nothing. Shared between `WorkflowNode`'s per-node badge and
 * `RunResultsPanel`'s step list, so both ever agree on what "success" looks
 * like instead of two independently-drifting copies of the same mapping.
 *
 * Reuses the `trigger` token's green for "success" -- this codebase already
 * treats that colour as a generic affirmative signal (see the "Saved"
 * checkmarks in WorkflowHeader/WorkflowStatusBar), not something scoped to
 * trigger nodes specifically.
 */
export const RUN_STATUS_PRESENTATION: Record<
  NodeRunStatus,
  RunStatusPresentation
> = {
  success: {
    icon: Check,
    badgeClassName: "bg-trigger text-base",
    label: "Succeeded",
  },
  failure: { icon: X, badgeClassName: "bg-danger text-base", label: "Failed" },
  skipped: {
    icon: Minus,
    badgeClassName: "bg-elevated text-ink-faint ring-1 ring-line",
    label: "Skipped",
  },
};
