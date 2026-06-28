import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-md flex-col py-16">
      <EmptyState
        icon={FileQuestion}
        title="页面不存在"
        description="您访问的链接可能已失效，或该资源不属于当前账号。"
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/dashboard">返回仪表盘</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/upload">上传分析</Link>
            </Button>
          </div>
        }
      />
    </section>
  );
}
