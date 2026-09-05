import {
  ACTION_CONFIG_KINDS,
  TRIGGER_CONFIG_KINDS,
} from "../types";
import type { ActionConfig, ConditionConfig, TriggerConfig } from "../types";

// Checked against the vocabulary arrays (rather than a manual `kind ===`
// chain) so adding a kind to TRIGGER_CONFIG_KINDS/ACTION_CONFIG_KINDS in
// types.ts is enough on its own -- a manual chain here compiles fine even
// when it's silently wrong, since nothing about it is exhaustiveness
// checked against the union the way a Record<Kind, T> map would be.
const TRIGGER_KINDS: readonly string[] = TRIGGER_CONFIG_KINDS;
const ACTION_KINDS: readonly string[] = ACTION_CONFIG_KINDS;

export function isTriggerConfig(
  config: TriggerConfig | ActionConfig | ConditionConfig,
): config is TriggerConfig {
  return "kind" in config && TRIGGER_KINDS.includes(config.kind);
}

export function isActionConfig(
  config: TriggerConfig | ActionConfig | ConditionConfig,
): config is ActionConfig {
  return "kind" in config && ACTION_KINDS.includes(config.kind);
}

export function isConditionConfig(
  config: TriggerConfig | ActionConfig | ConditionConfig,
): config is ConditionConfig {
  return "field" in config && "operator" in config && "value" in config;
}
