"use client";

import { useState } from "react";
import { Check, Copy, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReportActionsProps = {
  content: string;
  taskId: string;
  fileName?: string;
};

export function ReportActions({
  content,
  taskId,
  fileName,
}: ReportActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const shortId = taskId.slice(0, 8);
    anchor.href = url;
    anchor.download = `audit-report-${shortId}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="print:hidden flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" onClick={handleDownload}>
        <Download className="size-4" aria-hidden />
        下载 Markdown
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => void handleCopy()}>
        {copied ? (
          <Check className="size-4" aria-hidden />
        ) : (
          <Copy className="size-4" aria-hidden />
        )}
        {copied ? "已复制" : "复制全文"}
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={handlePrint}>
        <Printer className="size-4" aria-hidden />
        打印
      </Button>
      {fileName ? (
        <span className="text-xs text-muted-foreground">{fileName}</span>
      ) : null}
    </div>
  );
}
