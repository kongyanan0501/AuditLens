"use client";

export function UploadCard() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
      <p className="text-lg font-medium">拖拽文件到此处</p>
      <p className="mt-2 text-sm text-muted-foreground">
        支持 .xlsx、.xls、.csv（Phase 6 接入解析与审计 API）
      </p>
      <button
        type="button"
        className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        disabled
      >
        选择文件（即将开放）
      </button>
    </div>
  );
}
