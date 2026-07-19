import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest): Promise<{
  supabaseResponse: NextResponse;
  user: User | null;
}> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { supabaseResponse, user: null };
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value);
        });
      },
    },
  });

  // Prefer getUser() (validates with Auth API). Edge Runtime 在部分网络环境下
  // 会 fetch failed；此时回退 getSession() 读取 Cookie，避免登录后被踢回 /login。
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user) {
      return { supabaseResponse, user };
    }
  } catch {
    // fall through to cookie session
  }

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return { supabaseResponse, user: session?.user ?? null };
  } catch {
    return { supabaseResponse, user: null };
  }
}
