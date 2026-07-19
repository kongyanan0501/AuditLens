import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_RULE_SCOPE } from "@/types/audit";

export type LocalRuleConfig = {
  id: string | null;
  scopeKey: string;
  amountAnomalyMultiplier: number;
  vendorConcentrationThreshold: number;
  approvalRequiredMinAmount: number;
  version: number;
  changeNote: string | null;
  createdAt: string | null;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "rule-configs.json");

type LocalStore = {
  byScope: Record<string, LocalRuleConfig>;
};

async function readStore(): Promise<LocalStore> {
  try {
    const raw = await readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as LocalStore;
    if (!parsed?.byScope || typeof parsed.byScope !== "object") {
      return { byScope: {} };
    }
    return parsed;
  } catch {
    return { byScope: {} };
  }
}

async function writeStore(store: LocalStore): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export async function getLocalActiveRuleConfig(
  scopeKey = DEFAULT_RULE_SCOPE,
): Promise<LocalRuleConfig | null> {
  const store = await readStore();
  return store.byScope[scopeKey] ?? null;
}

export async function publishLocalRuleConfig(input: {
  scopeKey: string;
  amountAnomalyMultiplier: number;
  vendorConcentrationThreshold: number;
  approvalRequiredMinAmount: number;
  changeNote: string;
}): Promise<LocalRuleConfig> {
  const store = await readStore();
  const prev = store.byScope[input.scopeKey];
  const nextVersion = (prev?.version ?? 1) + 1;
  const next: LocalRuleConfig = {
    id: `local-${input.scopeKey}-v${nextVersion}`,
    scopeKey: input.scopeKey,
    amountAnomalyMultiplier: input.amountAnomalyMultiplier,
    vendorConcentrationThreshold: input.vendorConcentrationThreshold,
    approvalRequiredMinAmount: input.approvalRequiredMinAmount,
    version: nextVersion,
    changeNote: `${input.changeNote}（本地回退；请刷新 Supabase schema cache）`,
    createdAt: new Date().toISOString(),
  };
  store.byScope[input.scopeKey] = next;
  await writeStore(store);
  console.warn(
    "[rule-config] PostgREST schema cache miss — saved to .data/rule-configs.json",
  );
  return next;
}

export function isSchemaCacheMiss(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : error &&
          typeof error === "object" &&
          "message" in error &&
          typeof (error as { message: unknown }).message === "string"
        ? (error as { message: string }).message
        : String(error ?? "");
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  return (
    code === "PGRST205" ||
    code === "PGRST204" ||
    message.includes("schema cache") ||
    message.includes("Could not find the table")
  );
}
