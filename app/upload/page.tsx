import { UploadCard } from "@/components/UploadCard";
import { PageHeader } from "@/components/PageHeader";
import { requireAuth } from "@/lib/supabase/require-auth";

export default async function UploadPage() {
  await requireAuth("/upload");

  return (
    <section className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title="上传财务数据"
        description="支持 Excel / CSV 格式。上传后将触发 LangGraph 审计流水线，自动完成规则检测、异常分析与风险评分。"
      />
      <UploadCard />
    </section>
  );
}
