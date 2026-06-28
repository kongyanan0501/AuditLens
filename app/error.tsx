"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { AlertBanner } from "@/components/AlertBanner";
import { Button } from "@/components/ui/button";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto flex max-w-lg flex-col gap-6 py-12">
      <AlertBanner
        icon={AlertCircle}
        variant="error"
        title="页面加载失败"
        description="请稍后重试。若问题持续，请检查网络连接或联系管理员。"
      />
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => reset()}>
          重试
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard">返回仪表盘</Link>
        </Button>
      </div>
    </section>
  );
}
