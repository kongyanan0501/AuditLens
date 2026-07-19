import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/types/audit";
import type { Database } from "@/types/database";

type DbClient = SupabaseClient<Database>;

export type UserProfile = {
  id: string;
  role: UserRole;
  displayName: string | null;
};

function normalizeRole(value: string | null | undefined): UserRole {
  return value === "business" ? "business" : "auditor";
}

function defaultAuditorProfile(userId: string): UserProfile {
  return { id: userId, role: "auditor", displayName: null };
}

/** PostgREST schema cache lag after migrations (PGRST205 / schema cache). */
function isSchemaCacheError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const message = error.message ?? "";
  return (
    error.code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("Could not find the table")
  );
}

export async function ensureProfile(
  supabase: DbClient,
  userId: string,
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, display_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (isSchemaCacheError(error)) {
      console.warn(
        "[profiles] schema cache miss for public.profiles — defaulting to auditor. Run: notify pgrst, 'reload schema';",
      );
      return defaultAuditorProfile(userId);
    }
    throw error;
  }

  if (data) {
    return {
      id: data.id,
      role: normalizeRole(data.role),
      displayName: data.display_name,
    };
  }

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({ id: userId, role: "auditor" })
    .select("id, role, display_name")
    .single();

  if (insertError) {
    if (isSchemaCacheError(insertError)) {
      console.warn(
        "[profiles] schema cache miss on insert — defaulting to auditor",
      );
      return defaultAuditorProfile(userId);
    }
    // Race: another request created the row
    const { data: retry, error: retryError } = await supabase
      .from("profiles")
      .select("id, role, display_name")
      .eq("id", userId)
      .single();
    if (retryError) {
      throw insertError;
    }
    return {
      id: retry.id,
      role: normalizeRole(retry.role),
      displayName: retry.display_name,
    };
  }

  return {
    id: created.id,
    role: normalizeRole(created.role),
    displayName: created.display_name,
  };
}

export async function getUserRole(
  supabase: DbClient,
  userId: string,
): Promise<UserRole> {
  const profile = await ensureProfile(supabase, userId);
  return profile.role;
}

export async function updateUserRole(
  supabase: DbClient,
  userId: string,
  role: UserRole,
): Promise<UserProfile> {
  await ensureProfile(supabase, userId);

  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("id, role, display_name")
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    role: normalizeRole(data.role),
    displayName: data.display_name,
  };
}
