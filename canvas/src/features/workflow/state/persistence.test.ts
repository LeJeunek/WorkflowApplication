/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";

import { getLastOpenedWorkflowId, setLastOpenedWorkflowId } from "./persistence";

afterEach(() => {
  localStorage.clear();
});

describe("last opened workflow id", () => {
  it("returns null before anything has been recorded", () => {
    expect(getLastOpenedWorkflowId()).toBeNull();
  });

  it("returns whatever id was last set", () => {
    setLastOpenedWorkflowId("w1");
    expect(getLastOpenedWorkflowId()).toBe("w1");

    setLastOpenedWorkflowId("w2");
    expect(getLastOpenedWorkflowId()).toBe("w2");
  });
});
