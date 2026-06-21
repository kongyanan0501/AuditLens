import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/supabase/server";

export async function requireAuth(redirectTo: string): Promise<User> {
  const user = await getAuthUser();

  if (!user) {
    redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  return user;
}
