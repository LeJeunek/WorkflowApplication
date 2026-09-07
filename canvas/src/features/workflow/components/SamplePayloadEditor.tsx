import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

import { isSamplePayloadValid } from "../domain/execution";
import {
  PAYLOAD_FIELD_TYPES,
  buildPayload,
  defaultValueForType,
  flattenPayload,
  nextFieldName,
} from "../domain/samplePayload";
import type { PayloadFieldType } from "../domain/samplePayload";
import { FieldHint } from "./Inspector";

const TAB_BASE_CLASSES =
  "rounded px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const TAB_ACTIVE_CLASSES = "bg-surface text-ink shadow-sm";
const TAB_INACTIVE_CLASSES = "text-ink-faint hover:text-ink";

const INPUT_CLASSES =
  "w-0 flex-1 rounded-md border border-line bg-elevated px-2 py-1 font-mono text-xs text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30";

const PAYLOAD_FIELD_TYPE_LABELS: Record<PayloadFieldType, string> = {
  text: "Text",
  number: "Number",
  boolean: "True/False",
  null: "Empty",
  json: "JSON",
};

/**
 * Editor for a trigger's `samplePayload`. Defaults to a field-by-field
 * "Simple" view -- a row per dot-path key with an explicit type, so someone
 * unfamiliar with JSON syntax never has to type a brace, a quote, or an
 * unquoted `true` to get a real boolean -- with an "Advanced" raw-JSON view
 * underneath it for anything the row editor can't express (arrays, hand-
 * crafted structures). Both views edit the exact same underlying text;
 * neither is the "real" one.
 */
export function SamplePayloadEditor({
  samplePayload,
  onChange,
}: {
  samplePayload: string | undefined;
  onChange: (samplePayload: string) => void;
}) {
  // A payload that isn't a plain object (invalid JSON, or valid JSON that's
  // an array/primitive) can't be shown as field rows at all -- Simple mode
  // is unavailable, not just unselected, until the JSON below is fixed.
  const canEditSimply = isSamplePayloadValid(samplePayload);
  const [mode, setMode] = useState<"simple" | "advanced">(
    canEditSimply ? "simple" : "advanced",
  );
  const effectiveMode = canEditSimply ? mode : "advanced";

  const rows = flattenPayload(samplePayload);

  // Rows are derived fresh from `samplePayload` on every render (never
  // stored locally), so an external change to it -- undo/redo chief among
  // them -- is reflected immediately with no sync effect required. Only
  // which tab is showing is real local state.
  const pathInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const focusRowIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (focusRowIndexRef.current !== null) {
      const input = pathInputRefs.current[focusRowIndexRef.current];
      input?.focus();
      input?.select();
      focusRowIndexRef.current = null;
    }
  });

  function handleAddRow() {
    focusRowIndexRef.current = rows.length;
    onChange(
      buildPayload([
        ...rows,
        { path: nextFieldName(rows), type: "text", value: "" },
      ]),
    );
  }

  function handlePathChange(index: number, path: string) {
    onChange(
      buildPayload(rows.map((row, i) => (i === index ? { ...row, path } : row))),
    );
  }

  function handleTypeChange(index: number, type: PayloadFieldType) {
    onChange(
      buildPayload(
        rows.map((row, i) =>
          i === index
            ? { ...row, type, value: defaultValueForType(type, row.value) }
            : row,
        ),
      ),
    );
  }

  function handleValueChange(index: number, value: string) {
    onChange(
      buildPayload(rows.map((row, i) => (i === index ? { ...row, value } : row))),
    );
  }

  function handleRemoveRow(index: number) {
    onChange(buildPayload(rows.filter((_, i) => i !== index)));
  }

  return (
    <div>
      <div className="mb-2 inline-flex gap-0.5 rounded-md border border-line bg-elevated p-0.5">
        <button
          type="button"
          aria-pressed={effectiveMode === "simple"}
          disabled={!canEditSimply}
          title={
            canEditSimply
              ? undefined
              : "Only works for a plain object -- fix the JSON below first."
          }
          onClick={() => setMode("simple")}
          className={`${TAB_BASE_CLASSES} ${effectiveMode === "simple" ? TAB_ACTIVE_CLASSES : TAB_INACTIVE_CLASSES}`}
        >
          Simple
        </button>
        <button
          type="button"
          aria-pressed={effectiveMode === "advanced"}
          onClick={() => setMode("advanced")}
          className={`${TAB_BASE_CLASSES} ${effectiveMode === "advanced" ? TAB_ACTIVE_CLASSES : TAB_INACTIVE_CLASSES}`}
        >
          Advanced (JSON)
        </button>
      </div>

      {effectiveMode === "simple" ? (
        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="text-[11px] leading-relaxed text-ink-faint">
              No fields yet -- add one below to test your workflow with
              realistic data.
            </p>
          )}

          {rows.map((row, index) => (
            <div
              key={index}
              className="space-y-1.5 rounded-md border border-line p-1.5"
            >
              <div className="flex items-center gap-1.5">
                <input
                  ref={(el) => {
                    pathInputRefs.current[index] = el;
                  }}
                  type="text"
                  aria-label={`Field ${index + 1} name`}
                  value={row.path}
                  placeholder="customer.plan"
                  onChange={(event) => handlePathChange(index, event.target.value)}
                  className={INPUT_CLASSES}
                />
                <button
                  type="button"
                  aria-label={`Remove field ${index + 1}`}
                  onClick={() => handleRemoveRow(index)}
                  className="shrink-0 rounded-md p-1 text-ink-faint transition-colors hover:bg-elevated hover:text-danger"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  aria-label={`Field ${index + 1} type`}
                  value={row.type}
                  onChange={(event) =>
                    handleTypeChange(index, event.target.value as PayloadFieldType)
                  }
                  className="w-26 shrink-0 rounded-md border border-line bg-elevated px-1.5 py-1 text-[11px] text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
                >
                  {PAYLOAD_FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {PAYLOAD_FIELD_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>

                {row.type === "boolean" ? (
                  <select
                    aria-label={`Field ${index + 1} value`}
                    value={row.value}
                    onChange={(event) => handleValueChange(index, event.target.value)}
                    className={INPUT_CLASSES}
                  >
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                ) : row.type === "null" ? (
                  <input
                    type="text"
                    aria-label={`Field ${index + 1} value`}
                    value="null"
                    disabled
                    className="w-0 flex-1 rounded-md border border-line bg-base px-2 py-1 font-mono text-xs text-ink-faint outline-none"
                  />
                ) : (
                  <input
                    type="text"
                    inputMode={row.type === "number" ? "decimal" : undefined}
                    aria-label={`Field ${index + 1} value`}
                    value={row.value}
                    placeholder={row.type === "json" ? '["vip","beta"]' : "pro"}
                    onChange={(event) => handleValueChange(index, event.target.value)}
                    className={INPUT_CLASSES}
                  />
                )}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/10"
          >
            <Plus className="size-3" aria-hidden="true" />
            Add field
          </button>

          <FieldHint>
            Not real data -- just a stand-in used when you click Run, so you
            can see how this workflow would behave. Use a dot in the name to
            nest data, like <code>customer.plan</code>, and pick a type so
            Run sees a real number or true/false, not just text.
          </FieldHint>
        </div>
      ) : (
        <>
          <textarea
            aria-label="Example data"
            aria-invalid={!canEditSimply}
            value={samplePayload ?? ""}
            onChange={(event) => onChange(event.target.value)}
            rows={4}
            spellCheck={false}
            className="w-full resize-none rounded-md border border-line bg-elevated px-2 py-1.5 font-mono text-xs leading-relaxed text-ink outline-none transition-colors focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
          />

          {canEditSimply ? (
            <FieldHint>
              Not real data -- just a stand-in used when you click Run, so you
              can see how this workflow would behave.
            </FieldHint>
          ) : (
            <p className="mt-1 text-[11px] text-danger">
              This isn't valid JSON, so Run will treat it as empty until it's
              fixed. Data goes in curly braces, e.g.{" "}
              <code>{'{"plan": "pro"}'}</code>.
            </p>
          )}
        </>
      )}
    </div>
  );
}
