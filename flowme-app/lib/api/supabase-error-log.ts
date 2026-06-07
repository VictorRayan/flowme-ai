type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export function logSupabaseRouteError(route: string, table: string, error: SupabaseErrorLike) {
  console.error('[supabase-route-error]', {
    route,
    table,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}
