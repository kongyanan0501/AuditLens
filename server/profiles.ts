import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/audit";
import type { Database } from "@/types/database";

type DbClient = SupabaseClient<Database>;

export type UserProfile = {
  id: string;
  role: UserRole;
  displayName: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

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

/** Resolve login email → auth user id (service role). */
export async function resolveUserIdByEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) {
    throw new Error("请填写有效的用户邮箱");
  }

  const admin = createAdminClient();
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) {
      throw new Error(`查找用户失败：${error.message}`);
    }
    const match = data.users.find(
      (user) => user.email?.toLowerCase() === normalized,
    );
    if (match) {
      return match.id;
    }
    if (data.users.length < 200) {
      break;
    }
  }

  throw new Error(`未找到邮箱为 ${normalized} 的用户`);
}

/**
 * Accept email (preferred) or legacy UUID for assignee fields.
 * Returns null when input is empty / null.
 */
export async function resolveAssigneeUserId(
  value: string | null,
): Promise<string | null> {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (isUuid(trimmed)) {
    return trimmed;
  }
  return resolveUserIdByEmail(trimmed);
}

export async function getEmailsByUserIds(
  userIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) {
    return map;
  }

  const admin = createAdminClient();
  await Promise.all(
    unique.map(async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (!error && data.user?.email) {
        map.set(id, data.user.email);
      }
    }),
  );
  return map;
}
