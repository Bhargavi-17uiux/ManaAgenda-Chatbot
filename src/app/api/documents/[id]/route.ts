import { NextRequest, NextResponse } from 'next/server';
import { getVectorStore } from '@/lib/vector-store';
import { applyCors, handleCorsPreflight } from '@/lib/cors';
import { getAdminAuthorization } from '@/lib/auth/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: NextRequest) {
  return handleCorsPreflight(req, 'DELETE, OPTIONS');
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authorization = await getAdminAuthorization();
    if (!authorization.isAdmin) {
      const status =
        authorization.reason === 'not-configured'
          ? 503
          : authorization.reason === 'not-admin'
            ? 403
            : 401;
      return applyCors(
        NextResponse.json(
          {
            success: false,
            error:
              status === 503
                ? 'Document management is not configured.'
                : status === 403
                  ? 'Administrator access is required to delete documents.'
                  : 'Sign in with an administrator account to delete documents.',
          },
          { status }
        ),
        req,
        'DELETE, OPTIONS'
      );
    }

    const store = getVectorStore();
    const deleted = await store.deleteDocumentById(params.id);
    if (!deleted) {
      return applyCors(
        NextResponse.json(
          { success: false, error: `Document with ID "${params.id}" was not found.` },
          { status: 404 }
        ),
        req,
        'DELETE, OPTIONS'
      );
    }
    return applyCors(
      NextResponse.json({
        success: true,
        message: 'Document and its embeddings deleted successfully.',
        id: params.id,
      }),
      req,
      'DELETE, OPTIONS'
    );
  } catch (error: any) {
    return applyCors(
      NextResponse.json(
        { success: false, error: error.message || 'Failed to delete document' },
        { status: 500 }
      ),
      req,
      'DELETE, OPTIONS'
    );
  }
}
