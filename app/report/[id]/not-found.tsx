import Link from "next/link";
import { FileX2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";

export default function ReportNotFound() {
  return (
    <section className="mx-auto flex max-w-md flex-col py-16">
      <EmptyState
        icon={FileX2}
        title="报告不存在"
        description="未找到该审计任务，请确认链接有效或重新上传分析。"
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/dashboard">返回仪表盘</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/upload">重新上传</Link>
            </Button>
          </div>
        }
      />
    </section>
  );
}
