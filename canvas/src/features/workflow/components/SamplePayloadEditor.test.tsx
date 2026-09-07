/** @vitest-environment jsdom */
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SamplePayloadEditor } from "./SamplePayloadEditor";

afterEach(cleanup);

/**
 * A thin controlled wrapper -- SamplePayloadEditor is a fully controlled
 * component (no store dependency), so tests drive it the same way the real
 * Inspector does: state lives one level up, `onChange` feeds back in.
 */
function ControlledEditor({ initial }: { initial: string | undefined }) {
  const [samplePayload, setSamplePayload] = useState(initial);
  return (
    <SamplePayloadEditor samplePayload={samplePayload} onChange={setSamplePayload} />
  );
}

describe("SamplePayloadEditor", () => {
  it("defaults to Simple mode and shows no rows for an empty payload", () => {
    render(<ControlledEditor initial={undefined} />);

    expect(
      screen.getByRole("button", { name: "Simple" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByText(/no fields yet/i)).toBeDefined();
  });

  it("flattens an existing nested payload into field rows", () => {
    render(
      <ControlledEditor
        initial={JSON.stringify({ customer: { id: "cust_1", plan: "pro" } })}
      />,
    );

    expect(
      (screen.getByLabelText("Field 1 name") as HTMLInputElement).value,
    ).toBe("customer.id");
    expect(
      (screen.getByLabelText("Field 1 value") as HTMLInputElement).value,
    ).toBe("cust_1");
    expect(
      (screen.getByLabelText("Field 2 name") as HTMLInputElement).value,
    ).toBe("customer.plan");
    expect(
      (screen.getByLabelText("Field 2 value") as HTMLInputElement).value,
    ).toBe("pro");
  });

  it("adding a field appends a row and focuses its name for renaming", () => {
    render(<ControlledEditor initial={undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));

    const nameInput = screen.getByLabelText("Field 1 name") as HTMLInputElement;
    expect(nameInput.value).toBe("field1");
    expect(document.activeElement).toBe(nameInput);
  });

  it("editing a field's value updates the underlying JSON", () => {
    render(<ControlledEditor initial={JSON.stringify({ plan: "pro" })} />);

    fireEvent.change(screen.getByLabelText("Field 1 value"), {
      target: { value: "enterprise" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Advanced (JSON)" }));
    expect(
      JSON.parse((screen.getByLabelText("Example data") as HTMLTextAreaElement).value),
    ).toEqual({ plan: "enterprise" });
  });

  it("renaming a field's path renests it in the JSON", () => {
    render(<ControlledEditor initial={JSON.stringify({ plan: "pro" })} />);

    fireEvent.change(screen.getByLabelText("Field 1 name"), {
      target: { value: "customer.plan" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Advanced (JSON)" }));
    expect(
      JSON.parse((screen.getByLabelText("Example data") as HTMLTextAreaElement).value),
    ).toEqual({ customer: { plan: "pro" } });
  });

  it("a Text row keeps its value as a string even if it looks like a number", () => {
    render(<ControlledEditor initial={JSON.stringify({ seats: "x" })} />);

    fireEvent.change(screen.getByLabelText("Field 1 value"), {
      target: { value: "5" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Advanced (JSON)" }));
    expect(
      JSON.parse((screen.getByLabelText("Example data") as HTMLTextAreaElement).value),
    ).toEqual({ seats: "5" });
  });

  it("removing a field deletes its row and its key", () => {
    render(
      <ControlledEditor initial={JSON.stringify({ plan: "pro", seats: 5 })} />,
    );

    fireEvent.click(screen.getByLabelText("Remove field 1"));

    expect(screen.queryByLabelText("Field 2 name")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Advanced (JSON)" }));
    expect(
      JSON.parse((screen.getByLabelText("Example data") as HTMLTextAreaElement).value),
    ).toEqual({ seats: 5 });
  });

  it("switching to Advanced and editing raw JSON is reflected back in Simple mode", () => {
    render(<ControlledEditor initial={undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Advanced (JSON)" }));
    fireEvent.change(screen.getByLabelText("Example data"), {
      target: { value: '{"plan": "pro"}' },
    });

    fireEvent.click(screen.getByRole("button", { name: "Simple" }));
    expect(
      (screen.getByLabelText("Field 1 name") as HTMLInputElement).value,
    ).toBe("plan");
    expect(
      (screen.getByLabelText("Field 1 value") as HTMLInputElement).value,
    ).toBe("pro");
  });

  it("disables Simple mode and forces Advanced when the JSON isn't a plain object", () => {
    render(<ControlledEditor initial="[1, 2, 3]" />);

    const simpleTab = screen.getByRole("button", { name: "Simple" });
    expect(simpleTab).toHaveProperty("disabled", true);
    expect(
      screen
        .getByRole("button", { name: "Advanced (JSON)" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByLabelText("Example data")).toBeDefined();
  });

  it("disables Simple mode and forces Advanced for invalid JSON", () => {
    render(<ControlledEditor initial="{not valid" />);

    expect(
      screen.getByRole("button", { name: "Simple" }),
    ).toHaveProperty("disabled", true);
    expect(screen.getByLabelText("Example data")).toBeDefined();
  });

  it("infers each row's type from its value, and shows it in the type selector", () => {
    render(
      <ControlledEditor
        initial={JSON.stringify({
          plan: "pro",
          seats: 5,
          active: true,
          note: null,
        })}
      />,
    );

    expect(
      (screen.getByLabelText("Field 1 type") as HTMLSelectElement).value,
    ).toBe("text");
    expect(
      (screen.getByLabelText("Field 2 type") as HTMLSelectElement).value,
    ).toBe("number");
    expect(
      (screen.getByLabelText("Field 3 type") as HTMLSelectElement).value,
    ).toBe("boolean");
    expect(
      (screen.getByLabelText("Field 4 type") as HTMLSelectElement).value,
    ).toBe("null");
  });

  it("switching a row's type to Number stores its value as a real number", () => {
    render(<ControlledEditor initial={JSON.stringify({ seats: "x" })} />);

    fireEvent.change(screen.getByLabelText("Field 1 type"), {
      target: { value: "number" },
    });
    fireEvent.change(screen.getByLabelText("Field 1 value"), {
      target: { value: "5" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Advanced (JSON)" }));
    expect(
      JSON.parse((screen.getByLabelText("Example data") as HTMLTextAreaElement).value),
    ).toEqual({ seats: 5 });
  });

  it("switching a row's type to Number resets an incompatible value to 0", () => {
    render(<ControlledEditor initial={JSON.stringify({ plan: "pro" })} />);

    fireEvent.change(screen.getByLabelText("Field 1 type"), {
      target: { value: "number" },
    });

    expect(
      (screen.getByLabelText("Field 1 value") as HTMLInputElement).value,
    ).toBe("0");
  });

  it("switching a row's type to True/False shows a True/False selector", () => {
    render(<ControlledEditor initial={JSON.stringify({ active: "x" })} />);

    fireEvent.change(screen.getByLabelText("Field 1 type"), {
      target: { value: "boolean" },
    });
    const valueSelect = screen.getByLabelText("Field 1 value") as HTMLSelectElement;
    expect(valueSelect.value).toBe("true");

    fireEvent.change(valueSelect, { target: { value: "false" } });

    fireEvent.click(screen.getByRole("button", { name: "Advanced (JSON)" }));
    expect(
      JSON.parse((screen.getByLabelText("Example data") as HTMLTextAreaElement).value),
    ).toEqual({ active: false });
  });

  it("switching a row's type to Empty disables the value input and always writes null", () => {
    render(<ControlledEditor initial={JSON.stringify({ note: "x" })} />);

    fireEvent.change(screen.getByLabelText("Field 1 type"), {
      target: { value: "null" },
    });

    const valueInput = screen.getByLabelText("Field 1 value") as HTMLInputElement;
    expect(valueInput.disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Advanced (JSON)" }));
    expect(
      JSON.parse((screen.getByLabelText("Example data") as HTMLTextAreaElement).value),
    ).toEqual({ note: null });
  });

  it("switching a row's type back and forth preserves a value that's valid for both", () => {
    render(<ControlledEditor initial={JSON.stringify({ seats: 42 })} />);

    fireEvent.change(screen.getByLabelText("Field 1 type"), {
      target: { value: "text" },
    });
    expect(
      (screen.getByLabelText("Field 1 value") as HTMLInputElement).value,
    ).toBe("42");

    fireEvent.change(screen.getByLabelText("Field 1 type"), {
      target: { value: "number" },
    });
    expect(
      (screen.getByLabelText("Field 1 value") as HTMLInputElement).value,
    ).toBe("42");
  });

  it("keeps a non-object leaf (e.g. an array) intact as one row's JSON text", () => {
    render(
      <ControlledEditor initial={JSON.stringify({ tags: ["vip", "beta"] })} />,
    );

    expect(
      (screen.getByLabelText("Field 1 value") as HTMLInputElement).value,
    ).toBe('["vip","beta"]');

    // Untouched, it round-trips back through Advanced unchanged.
    fireEvent.click(screen.getByRole("button", { name: "Advanced (JSON)" }));
    expect(
      JSON.parse((screen.getByLabelText("Example data") as HTMLTextAreaElement).value),
    ).toEqual({ tags: ["vip", "beta"] });
  });
});
