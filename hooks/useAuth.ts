// Phase 2: Supabase Auth session hook
export function useAuth() {
  return {
    user: null as { id: string; email?: string } | null,
    loading: false,
  };
}
