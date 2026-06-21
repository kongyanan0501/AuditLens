"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

const ACCEPT = ".xlsx,.xls,.csv";
const ACCEPT_LABEL = "Excel / CSV";

type AuditApiResponse = {
  data?: {
    taskId: string;
    score: number | null;
    issueCount: number;
    recordCount: number;
    status: string;
  };
  error?: string;
  code?: string;
  taskId?: string;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadCard() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    setFile(files[0]);
    setError(null);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles],
  );

  const clearFile = useCallback(() => {
    setFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!file || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/audit", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as AuditApiResponse;

      if (!response.ok) {
        setError(payload.error ?? "分析失败，请稍后重试");
        return;
      }

      const taskId = payload.data?.taskId;
      if (taskId) {
        router.push(`/dashboard?taskId=${taskId}`);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("网络错误，请检查连接后重试");
    } finally {
      setIsSubmitting(false);
    }
  }, [file, isSubmitting, router]);

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "al-panel cursor-pointer border-2 border-dashed p-12 text-center transition-all active:scale-[0.995]",
          isDragging
            ? "border-primary bg-[var(--primary-muted)] shadow-[var(--shadow-glow)]"
            : "border-[var(--border-subtle)] hover:border-primary/40 hover:bg-muted/30",
          file && "border-success/40 bg-success/[0.06]",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />

        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--primary-muted)] text-primary">
          <Upload className="size-6" aria-hidden />
        </div>

        <p className="mt-4 text-lg font-medium">拖拽文件到此处</p>
        <p className="mt-2 text-sm text-muted-foreground">
          或点击选择 {ACCEPT_LABEL} 文件
        </p>
        <p className="mt-1 text-xs text-muted-foreground/80">
          支持 .xlsx、.xls、.csv
        </p>
      </div>

      {file && (
        <Panel className="flex items-center gap-3 px-4 py-3">
          <FileSpreadsheet
            className="size-5 shrink-0 text-primary"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="al-metric text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={(event) => {
              event.stopPropagation();
              clearFile();
            }}
            aria-label="移除文件"
          >
            <X className="size-4" />
          </Button>
        </Panel>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          disabled={!file || isSubmitting}
          size="lg"
          className="shadow-[var(--shadow-glow)]"
          onClick={() => void handleAnalyze()}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              分析中…
            </>
          ) : (
            "开始分析"
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          上传后将运行 LangGraph 审计流水线并写入任务结果
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
