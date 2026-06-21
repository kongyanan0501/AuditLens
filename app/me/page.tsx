import { ProfileCard } from "@/components/ProfileCard";
import { requireAuth } from "@/lib/supabase/require-auth";

export default async function MePage() {
  await requireAuth("/me");

  return (
    <section className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">我的</h1>
        <p className="text-sm text-muted-foreground">账号信息与登录状态</p>
      </div>
      <ProfileCard />
    </section>
  );
}
