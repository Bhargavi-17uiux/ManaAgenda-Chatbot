import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type AdminAuthorizationReason =
  | 'authorized'
  | 'not-configured'
  | 'unauthenticated'
  | 'not-admin';

export interface AdminAuthorization {
  isAuthenticated: boolean;
  isAdmin: boolean;
  reason: AdminAuthorizationReason;
}

export async function getAdminAuthorization(): Promise<AdminAuthorization> {
  const allowlist = process.env.ADMIN_EMAIL_ALLOWLIST?.split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return {
      isAuthenticated: false,
      isAdmin: false,
      reason: 'not-configured',
    };
  }

  if (!allowlist?.length) {
    return {
      isAuthenticated: true,
      isAdmin: false,
      reason: 'not-configured',
    };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      isAuthenticated: false,
      isAdmin: false,
      reason: 'unauthenticated',
    };
  }

  const email = user.email?.trim().toLowerCase();
  const isAdmin = Boolean(email && allowlist.includes(email));

  return {
    isAuthenticated: true,
    isAdmin,
    reason: isAdmin ? 'authorized' : 'not-admin',
  };
}
