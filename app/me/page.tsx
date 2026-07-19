import { ProfileCard } from "@/components/ProfileCard";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { RuleConfigForm } from "@/components/RuleConfigForm";
import { PageHeader } from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/supabase/require-auth";
import { getUserRole } from "@/server/profiles";

export default async function MePage() {
  const user = await requireAuth("/me");
  const supabase = await createClient();
  const role = await getUserRole(supabase, user.id);
  const allowDemoSwitch = process.env.ALLOW_DEMO_ROLE_SWITCH === "true";

  return (
    <section className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title="我的"
        description="账号信息与角色权限；规则阈值见「规则配置」"
      />
      <ProfileCard />
      <RoleSwitcher allowDemoSwitch={allowDemoSwitch} />
      {role === "auditor" ? <RuleConfigForm /> : null}
    </section>
  );
}
