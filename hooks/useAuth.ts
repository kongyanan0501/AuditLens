"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthError, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let supabase: ReturnType<typeof getSupabaseBrowserClient> | null = null;

    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      setLoading(false);
      return;
    }

    void supabase.auth
      .getUser()
      .then(({ data: { user: currentUser } }) => {
        setUser(currentUser);
        setLoading(false);
      })
      .catch(() => {
        setUser(null);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error as AuthError | null };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch";
      return {
        error: {
          name: "AuthRetryableFetchError",
          message,
          status: 0,
        } as AuthError,
      };
    }
  }, []);

  const signOut = useCallback(async () => {
    window.location.assign("/auth/signout");
    return { error: null };
  }, []);

  return { user, loading, signIn, signOut };
}
