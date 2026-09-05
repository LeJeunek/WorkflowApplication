import { describe, expect, it } from "vitest";

import { isActionConfig, isConditionConfig, isTriggerConfig } from "./config";
import type { ActionConfig, ConditionConfig, TriggerConfig } from "../types";

const EVENT_TRIGGER: TriggerConfig = { kind: "event", event: "test" };
const SCHEDULE_TRIGGER: TriggerConfig = { kind: "schedule", cron: "* * * * *" };
const FORM_TRIGGER: TriggerConfig = {
  kind: "form_submission",
  formName: "Signup",
};
const SEND_EMAIL_ACTION: ActionConfig = { kind: "send_email" };
const HTTP_ACTION: ActionConfig = { kind: "http_request", url: "", method: "GET" };
const ADD_TAG_ACTION: ActionConfig = { kind: "add_tag", tag: "vip" };
const SLACK_ACTION: ActionConfig = {
  kind: "slack_message",
  channel: "#general",
  message: "hi",
};
const CONDITION: ConditionConfig = { field: "", operator: "equals", value: "" };

describe("isTriggerConfig", () => {
  it("accepts every trigger config variant", () => {
    expect(isTriggerConfig(EVENT_TRIGGER)).toBe(true);
    expect(isTriggerConfig(SCHEDULE_TRIGGER)).toBe(true);
    expect(isTriggerConfig(FORM_TRIGGER)).toBe(true);
  });

  it("rejects an action or condition config", () => {
    expect(isTriggerConfig(SEND_EMAIL_ACTION)).toBe(false);
    expect(isTriggerConfig(HTTP_ACTION)).toBe(false);
    expect(isTriggerConfig(ADD_TAG_ACTION)).toBe(false);
    expect(isTriggerConfig(SLACK_ACTION)).toBe(false);
    expect(isTriggerConfig(CONDITION)).toBe(false);
  });
});

describe("isActionConfig", () => {
  it("accepts every action config variant", () => {
    expect(isActionConfig(SEND_EMAIL_ACTION)).toBe(true);
    expect(isActionConfig(HTTP_ACTION)).toBe(true);
    expect(isActionConfig(ADD_TAG_ACTION)).toBe(true);
    expect(isActionConfig(SLACK_ACTION)).toBe(true);
  });

  it("rejects a trigger or condition config", () => {
    expect(isActionConfig(EVENT_TRIGGER)).toBe(false);
    expect(isActionConfig(SCHEDULE_TRIGGER)).toBe(false);
    expect(isActionConfig(FORM_TRIGGER)).toBe(false);
    expect(isActionConfig(CONDITION)).toBe(false);
  });
});

describe("isConditionConfig", () => {
  it("accepts a condition config", () => {
    expect(isConditionConfig(CONDITION)).toBe(true);
  });

  it("rejects a trigger or action config", () => {
    expect(isConditionConfig(EVENT_TRIGGER)).toBe(false);
    expect(isConditionConfig(SCHEDULE_TRIGGER)).toBe(false);
    expect(isConditionConfig(FORM_TRIGGER)).toBe(false);
    expect(isConditionConfig(SEND_EMAIL_ACTION)).toBe(false);
    expect(isConditionConfig(HTTP_ACTION)).toBe(false);
    expect(isConditionConfig(ADD_TAG_ACTION)).toBe(false);
    expect(isConditionConfig(SLACK_ACTION)).toBe(false);
  });
});
