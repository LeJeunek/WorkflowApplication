import type { ActionConfig, ConditionConfig, TriggerConfig } from "../types";

export function isTriggerConfig(
  config: TriggerConfig | ActionConfig | ConditionConfig,
): config is TriggerConfig {
  return "kind" in config && (config.kind === "event" || config.kind === "schedule");
}

export function isActionConfig(
  config: TriggerConfig | ActionConfig | ConditionConfig,
): config is ActionConfig {
  return (
    "kind" in config &&
    (config.kind === "send_email" || config.kind === "http_request")
  );
}

export function isConditionConfig(
  config: TriggerConfig | ActionConfig | ConditionConfig,
): config is ConditionConfig {
  return "field" in config && "operator" in config && "value" in config;
}
