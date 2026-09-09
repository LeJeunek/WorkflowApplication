import { AlertTriangle, Check, Circle, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * The store tracks `isSaving`/`isDirty`/`saveError` as independent flags
 * (see workflowStore.ts), not one enum field -- but WorkflowHeader and
 * WorkflowStatusBar each need to turn that combination into one label, so
 * the derivation lives here once instead of twice.
 */
export type SaveStatus = "saving" | "error" | "unsaved" | "saved";

export function getSaveStatus(state: {
  isSaving: boolean;
  isDirty: boolean;
  saveError: string | null;
}): SaveStatus {
  if (state.isSaving) return "saving";
  if (state.saveError !== null) return "error";
  if (state.isDirty) return "unsaved";
  return "saved";
}

export interface SaveStatusPresentation {
  icon: LucideIcon;
  label: string;
  /** Icon colour; `animate-spin` for the in-flight state. */
  className: string;
}

export const SAVE_STATUS_PRESENTATION: Record<SaveStatus, SaveStatusPresentation> = {
  saving: { icon: Loader2, label: "Saving…", className: "animate-spin text-ink-faint" },
  error: { icon: AlertTriangle, label: "Save failed", className: "text-danger" },
  unsaved: { icon: Circle, label: "Unsaved changes", className: "fill-current text-ink-faint" },
  saved: { icon: Check, label: "Saved", className: "text-trigger" },
};
