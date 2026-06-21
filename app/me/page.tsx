import { ProfileCard } from "@/components/ProfileCard";
import { PageHeader } from "@/components/PageHeader";
import { requireAuth } from "@/lib/supabase/require-auth";

export default async function MePage() {
  await requireAuth("/me");

  return (
    <section className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        title="我的"
        description="账号信息与登录状态"
      />
      <ProfileCard />
    </section>
  );
}
