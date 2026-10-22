import { NextResponse } from 'next/server';
import { getAdminAuthorization } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const authorization = await getAdminAuthorization();
  return NextResponse.json(
    {
      isAuthenticated: authorization.isAuthenticated,
      isAdmin: authorization.isAdmin,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
