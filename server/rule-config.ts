import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getLocalActiveRuleConfig,
  isSchemaCacheMiss,
  publishLocalRuleConfig,
} from "@/server/rule-config-local";
import type { Database } from "@/types/database";
import { mapRuleConfigRow } from "@/types/database";
import type { RuleThresholdConfig } from "@/types/audit";
import {
  DEFAULT_RULE_SCOPE,
  DEFAULT_RULE_THRESHOLDS,
  RULE_IDS,
} from "@/types/audit";

type DbClient = SupabaseClient<Database>;

function asError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    const e = error as { message: string; code?: string; details?: string };
    return new Error(
      [e.message, e.code ? `(${e.code})` : null, e.details]
        .filter(Boolean)
        .join(" "),
    );
  }
  return new Error("未知数据库错误");
}

export type ActiveRuleConfig = RuleThresholdConfig & {
  id: string | null;
  scopeKey: string;
  version: number;
  changeNote: string | null;
  createdAt: string | null;
};

export function toRuntimeThresholds(
  config: Pick<
    ActiveRuleConfig,
    | "amountAnomalyMultiplier"
    | "vendorConcentrationThreshold"
    | "approvalRequiredMinAmount"
    | "version"
    | "scopeKey"
  >,
): RuleThresholdConfig {
  return {
    amountAnomalyMultiplier: config.amountAnomalyMultiplier,
    vendorConcentrationThreshold: config.vendorConcentrationThreshold,
    approvalRequiredMinAmount: config.approvalRequiredMinAmount,
    version: config.version,
    scopeKey: config.scopeKey,
  };
}

export function getDefaultActiveRuleConfig(
  scopeKey = DEFAULT_RULE_SCOPE,
): ActiveRuleConfig {
  return {
    id: null,
    scopeKey,
    ...DEFAULT_RULE_THRESHOLDS,
    version: 1,
    changeNote: "built-in defaults",
    createdAt: null,
  };
}

export async function getActiveRuleConfig(
  supabase: DbClient,
  scopeKey = DEFAULT_RULE_SCOPE,
): Promise<ActiveRuleConfig> {
  const { data, error } = await supabase
    .from("audit_rule_configs")
    .select("*")
    .eq("scope_key", scopeKey)
    .eq("is_active", true)
    .maybeSingle();

  if (!error && data) {
    const mapped = mapRuleConfigRow(data);
    return {
      id: mapped.id,
      scopeKey: mapped.scopeKey,
      amountAnomalyMultiplier: mapped.amountAnomalyMultiplier,
      vendorConcentrationThreshold: mapped.vendorConcentrationThreshold,
      approvalRequiredMinAmount: mapped.approvalRequiredMinAmount,
      version: mapped.version,
      changeNote: mapped.changeNote,
      createdAt: mapped.createdAt,
    };
  }

  if (error && isSchemaCacheMiss(error)) {
    const local = await getLocalActiveRuleConfig(scopeKey);
    if (local) return local;
  }

  const local = await getLocalActiveRuleConfig(scopeKey);
  if (local) return local;

  return getDefaultActiveRuleConfig(scopeKey);
}

export type RuleConfigInput = {
  amountAnomalyMultiplier: number;
  vendorConcentrationThreshold: number;
  approvalRequiredMinAmount: number;
  changeNote?: string;
  scopeKey?: string;
};

export async function publishRuleConfig(
  _userClient: DbClient,
  userId: string,
  input: RuleConfigInput,
): Promise<ActiveRuleConfig> {
  const scopeKey = input.scopeKey?.trim() || DEFAULT_RULE_SCOPE;

  if (
    !(
      Number.isFinite(input.amountAnomalyMultiplier) &&
      input.amountAnomalyMultiplier > 0
    )
  ) {
    throw new Error("金额异常倍数须为正数");
  }
  if (
    !(
      Number.isFinite(input.vendorConcentrationThreshold) &&
      input.vendorConcentrationThreshold > 0 &&
      input.vendorConcentrationThreshold <= 1
    )
  ) {
    throw new Error("供应商集中阈值须在 (0, 1] 之间");
  }
  if (
    !(
      Number.isFinite(input.approvalRequiredMinAmount) &&
      input.approvalRequiredMinAmount >= 0
    )
  ) {
    throw new Error("必审金额须为非负数");
  }

  const changeNote = input.changeNote?.trim() ?? "";
  if (changeNote.length === 0) {
    throw new Error("变更须填写备注");
  }

  void _userClient;

  try {
    const admin = createAdminClient();

    const { data: latest, error: latestError } = await admin
      .from("audit_rule_configs")
      .select("version")
      .eq("scope_key", scopeKey)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) {
      throw latestError;
    }

    const nextVersion = (latest?.version ?? 0) + 1;

    const { error: deactivateError } = await admin
      .from("audit_rule_configs")
      .update({ is_active: false })
      .eq("scope_key", scopeKey)
      .eq("is_active", true);

    if (deactivateError) {
      throw deactivateError;
    }

    const { data, error } = await admin
      .from("audit_rule_configs")
      .insert({
        scope_key: scopeKey,
        amount_anomaly_multiplier: input.amountAnomalyMultiplier,
        vendor_concentration_threshold: input.vendorConcentrationThreshold,
        approval_required_min_amount: input.approvalRequiredMinAmount,
        version: nextVersion,
        is_active: true,
        changed_by: userId,
        change_note: changeNote,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    const mapped = mapRuleConfigRow(data);
    return {
      id: mapped.id,
      scopeKey: mapped.scopeKey,
      amountAnomalyMultiplier: mapped.amountAnomalyMultiplier,
      vendorConcentrationThreshold: mapped.vendorConcentrationThreshold,
      approvalRequiredMinAmount: mapped.approvalRequiredMinAmount,
      version: mapped.version,
      changeNote: mapped.changeNote,
      createdAt: mapped.createdAt,
    };
  } catch (error) {
    if (!isSchemaCacheMiss(error)) {
      throw asError(error);
    }

    // Unblock local Demo when PostgREST cache has not picked up new tables yet.
    return publishLocalRuleConfig({
      scopeKey,
      amountAnomalyMultiplier: input.amountAnomalyMultiplier,
      vendorConcentrationThreshold: input.vendorConcentrationThreshold,
      approvalRequiredMinAmount: input.approvalRequiredMinAmount,
      changeNote,
    });
  }
}

export async function listRuleConfigHistory(
  supabase: DbClient,
  scopeKey = DEFAULT_RULE_SCOPE,
  limit = 10,
): Promise<ActiveRuleConfig[]> {
  const { data, error } = await supabase
    .from("audit_rule_configs")
    .select("*")
    .eq("scope_key", scopeKey)
    .order("version", { ascending: false })
    .limit(limit);

  if (error) {
    if (isSchemaCacheMiss(error)) {
      const local = await getLocalActiveRuleConfig(scopeKey);
      return local
        ? [
            {
              id: local.id,
              scopeKey: local.scopeKey,
              amountAnomalyMultiplier: local.amountAnomalyMultiplier,
              vendorConcentrationThreshold: local.vendorConcentrationThreshold,
              approvalRequiredMinAmount: local.approvalRequiredMinAmount,
              version: local.version,
              changeNote: local.changeNote,
              createdAt: local.createdAt,
            },
          ]
        : [];
    }
    throw asError(error);
  }

  return (data ?? []).map((row) => {
    const mapped = mapRuleConfigRow(row);
    return {
      id: mapped.id,
      scopeKey: mapped.scopeKey,
      amountAnomalyMultiplier: mapped.amountAnomalyMultiplier,
      vendorConcentrationThreshold: mapped.vendorConcentrationThreshold,
      approvalRequiredMinAmount: mapped.approvalRequiredMinAmount,
      version: mapped.version,
      changeNote: mapped.changeNote,
      createdAt: mapped.createdAt,
    };
  });
}

export function ruleHitMeta(
  ruleId: (typeof RULE_IDS)[keyof typeof RULE_IDS],
  config: RuleThresholdConfig,
  thresholds: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ruleId,
    ruleVersion: config.version,
    scopeKey: config.scopeKey,
    thresholds,
  };
}
