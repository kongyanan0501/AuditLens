export type ReportExportMeta = {
  taskId: string;
  exportedAt: string;
  exportedBy: string;
  fileName?: string;
  ruleConfigVersion?: number | null;
};

/** Append workpaper export metadata (task id / timestamp / operator). */
export function withExportMetadata(
  content: string,
  meta: ReportExportMeta,
): string {
  const lines = [
    content.trimEnd(),
    "",
    "---",
    "",
    "## 导出元数据",
    "",
    `| 项 | 值 |`,
    `| --- | --- |`,
    `| 任务号 | ${meta.taskId} |`,
    `| 导出时间 | ${meta.exportedAt} |`,
    `| 操作人 | ${meta.exportedBy} |`,
    `| 规则配置版本 | ${meta.ruleConfigVersion ?? "—"} |`,
  ];

  if (meta.fileName) {
    lines.push(`| 源文件 | ${meta.fileName} |`);
  }

  lines.push("", "*本导出用于工作底稿归档，请勿篡改元数据区。*", "");
  return lines.join("\n");
}
