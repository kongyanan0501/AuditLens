#!/usr/bin/env node
/**
 * Re-index CodeGraph when project or CLI major version changes.
 * Run manually: npm run codegraph:sync
 * Also runs automatically via npm postversion hook.
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const metaPath = join(root, ".codegraph-version");

function major(version) {
  return String(version).split(".")[0] ?? "0";
}

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

function readMeta() {
  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(readFileSync(metaPath, "utf8"));
  } catch {
    return null;
  }
}

function writeMeta({ projectVersion, codegraphVersion }) {
  writeFileSync(
    metaPath,
    `${JSON.stringify(
      {
        projectVersion,
        projectMajor: major(projectVersion),
        codegraphVersion,
        codegraphMajor: major(codegraphVersion),
        syncedAt: new Date().toISOString(),
      },
      null,
      2
    )}\n`
  );
}

function getCodegraphVersion() {
  try {
    return execSync("codegraph version", { encoding: "utf8" }).trim();
  } catch {
    console.warn("codegraph CLI 未安装，跳过同步。安装：npm i -g @colbymchenry/codegraph");
    return null;
  }
}

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const projectVersion = pkg.version;
const codegraphVersion = getCodegraphVersion();

if (!codegraphVersion) {
  process.exit(0);
}

const prev = readMeta();
const projectMajorChanged =
  prev?.projectMajor != null && prev.projectMajor !== major(projectVersion);
const codegraphMajorChanged =
  prev?.codegraphMajor != null && prev.codegraphMajor !== major(codegraphVersion);

if (projectMajorChanged || codegraphMajorChanged) {
  console.log("检测到 major 版本变更，正在更新 CodeGraph…");
  if (codegraphMajorChanged) {
    run("codegraph upgrade");
  }
  if (!existsSync(join(root, ".codegraph"))) {
    run("codegraph init");
  } else {
    run("codegraph index --force");
  }
  console.log("CodeGraph 索引已重建。");
} else if (!prev) {
  console.log("首次记录 CodeGraph 同步版本，跳过重建（install/init 已完成索引）。");
} else {
  console.log("major 版本未变，无需重建索引。");
}

writeMeta({ projectVersion, codegraphVersion: getCodegraphVersion() ?? codegraphVersion });
