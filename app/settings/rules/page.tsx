import { redirect } from "next/navigation";
import { RuleConfigForm } from "@/components/RuleConfigForm";
import { PageHeader } from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getUserRole } from "@/server/profiles";

export default async function RuleSettingsPage() {
  const user = await requireAuth("/settings/rules");
  const supabase = await createClient();
  const role = await getUserRole(supabase, user.id);

  if (role !== "auditor") {
    redirect("/dashboard");
  }

  return (
    <section className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title="规则配置"
        description="调整金额异常倍数、供应商集中阈值与必审金额；变更须备注并写入新版本"
      />
      <RuleConfigForm />
    </section>
  );
}
