import { Check, Maximize } from 'lucide-react';

/** Bottom rail carrying ambient document and viewport state. */
export function WorkflowStatusBar() {
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-surface px-3 text-[11px] text-ink-faint">
      <span className="inline-flex items-center gap-1.5">
        <Check className="size-3 text-trigger" aria-hidden="true" />
        Saved
      </span>

      <span className="ml-auto inline-flex items-center gap-1.5">
        <Maximize className="size-3" aria-hidden="true" />
        <span className="sr-only">Zoom level</span>
        <span className="tabular-nums">100%</span>
      </span>
    </footer>
  );
}
