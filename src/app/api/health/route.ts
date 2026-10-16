import { NextRequest, NextResponse } from 'next/server';
import { getVectorStore } from '@/lib/vector-store';
import { HealthResponse } from '@/types';
import { applyCors, handleCorsPreflight } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function OPTIONS(req: NextRequest) {
  return handleCorsPreflight(req, 'GET, OPTIONS');
}

export async function GET(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const isGeminiConfigured = Boolean(
      apiKey && apiKey !== 'your_gemini_api_key_here' && apiKey.length > 5
    );

    const store = getVectorStore();
    const docs = await store.getDocuments();
    const provider = store.getProviderName();

    const response: HealthResponse = {
      status: isGeminiConfigured ? 'healthy' : 'warning',
      geminiConfigured: isGeminiConfigured,
      vectorStoreProvider: provider,
      documentCount: docs.length,
      chunkCount: docs.reduce((acc, d) => acc + (d.chunkCount || 0), 0),
      message: isGeminiConfigured
        ? `ManaAgenda RAG service is online and healthy. Vector provider: ${
            provider === 'upstash' ? 'Upstash Vector' : 'Local Vector Store'
          }.`
        : 'GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in server environment variables.',
    };

    return applyCors(NextResponse.json(response), req, 'GET, OPTIONS');
  } catch (error: any) {
    return applyCors(
      NextResponse.json(
        {
          status: 'error',
          geminiConfigured: false,
          vectorStoreProvider: 'local',
          documentCount: 0,
          chunkCount: 0,
          message: error?.message || 'Health check failed',
        },
        { status: 500 }
      ),
      req,
      'GET, OPTIONS'
    );
  }
}
