import { NextRequest, NextResponse } from 'next/server';
import { getVectorStore } from '@/lib/vector-store';
import { applyCors, handleCorsPreflight } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(req: NextRequest) {
  return handleCorsPreflight(req, 'GET, DELETE, OPTIONS');
}

export async function GET(req: NextRequest) {
  try {
    const store = getVectorStore();
    const documents = await store.getDocuments();
    return applyCors(
      NextResponse.json({
        success: true,
        documents,
        provider: store.getProviderName(),
      }),
      req,
      'GET, DELETE, OPTIONS'
    );
  } catch (error: any) {
    return applyCors(
      NextResponse.json(
        { success: false, error: error?.message || 'Failed to list documents' },
        { status: 500 }
      ),
      req,
      'GET, DELETE, OPTIONS'
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const store = getVectorStore();

    if (id) {
      const deleted = await store.deleteDocumentById(id);
      if (!deleted) {
        return applyCors(
          NextResponse.json(
            { success: false, error: `Document with ID "${id}" was not found.` },
            { status: 404 }
          ),
          req,
          'GET, DELETE, OPTIONS'
        );
      }
      return applyCors(
        NextResponse.json({
          success: true,
          message: 'Document and its embeddings deleted successfully.',
          id,
        }),
        req,
        'GET, DELETE, OPTIONS'
      );
    }

    await store.clearAll();
    return applyCors(
      NextResponse.json({
        success: true,
        message: 'All documents and embeddings cleared successfully.',
      }),
      req,
      'GET, DELETE, OPTIONS'
    );
  } catch (error: any) {
    return applyCors(
      NextResponse.json(
        { success: false, error: error?.message || 'Failed to delete documents' },
        { status: 500 }
      ),
      req,
      'GET, DELETE, OPTIONS'
    );
  }
}
