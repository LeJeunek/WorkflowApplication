import { describe, expect, it } from "vitest";

import { getSaveStatus } from "./saveStatusPresentation";

describe("getSaveStatus", () => {
  it("is 'saving' whenever a save is in flight, regardless of other flags", () => {
    expect(
      getSaveStatus({ isSaving: true, isDirty: true, saveError: "boom" }),
    ).toBe("saving");
  });

  it("is 'error' when the last save failed and none is in flight", () => {
    expect(
      getSaveStatus({ isSaving: false, isDirty: false, saveError: "500" }),
    ).toBe("error");
  });

  it("is 'unsaved' when dirty with no error", () => {
    expect(
      getSaveStatus({ isSaving: false, isDirty: true, saveError: null }),
    ).toBe("unsaved");
  });

  it("is 'saved' when clean with no error", () => {
    expect(
      getSaveStatus({ isSaving: false, isDirty: false, saveError: null }),
    ).toBe("saved");
  });
});
