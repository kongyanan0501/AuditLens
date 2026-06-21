import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function applyEnvFile(filePath: string, override: boolean): void {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    if (!key) {
      continue;
    }

    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/** Load `.env` then `.env.local` — same precedence as Next.js for standalone scripts. */
export function loadEnvFiles(cwd = process.cwd()): void {
  applyEnvFile(resolve(cwd, ".env"), false);
  applyEnvFile(resolve(cwd, ".env.local"), true);
}
