import { NextRequest, NextResponse } from 'next/server';
import { generateEmbedding, generateGroundedAnswer } from '@/lib/gemini';
import { getVectorStore } from '@/lib/vector-store';
import { ChatResponse, SourceCitation } from '@/types';
import { applyCors, handleCorsPreflight } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Max execution duration for Vercel serverless functions

const NOT_FOUND_STRING = "I don't have that information right now, but our team can help you with it.";

/**
 * Handle HTTP OPTIONS preflight request for CORS
 */
export async function OPTIONS(req: NextRequest) {
  return handleCorsPreflight(req, 'POST, OPTIONS');
}

/**
 * Handle POST request for RAG Chatbot queries
 */
export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return applyCors(
        NextResponse.json(
          {
            error: 'Invalid JSON payload in request body.',
            answer: 'Invalid request format.',
            sources: [],
            retrievedChunksCount: 0,
          },
          { status: 400 }
        ),
        req,
        'POST, OPTIONS'
      );
    }

    // Support either "question", "message", or "prompt" for frontend convenience
    const rawQuestion = body.question ?? body.message ?? body.prompt;

    if (!rawQuestion || typeof rawQuestion !== 'string' || !rawQuestion.trim()) {
      return applyCors(
        NextResponse.json(
          {
            error: 'A valid "question" or "message" string is required.',
            answer: 'Please provide a valid question.',
            sources: [],
            retrievedChunksCount: 0,
          },
          { status: 400 }
        ),
        req,
        'POST, OPTIONS'
      );
    }

    const trimmedQuestion = rawQuestion.trim();
    const store = getVectorStore();
    const docs = await store.getDocuments();

    // If no documents are uploaded yet in local store
    if (docs.length === 0 && store.getProviderName() === 'local') {
      const response: ChatResponse = {
        answer: NOT_FOUND_STRING,
        sources: [],
        retrievedChunksCount: 0,
      };
      return applyCors(NextResponse.json(response), req, 'POST, OPTIONS');
    }

    // 1. Generate query embedding
    let queryEmbedding: number[];
    try {
      queryEmbedding = await generateEmbedding(trimmedQuestion);
    } catch (embErr: any) {
      console.error('[Chat API] Embedding generation error:', embErr.message);
      return applyCors(
        NextResponse.json(
          {
            error: embErr.message || 'Failed to compute question embedding.',
            answer: 'Error generating embedding. Please check network connectivity or GEMINI_API_KEY configuration.',
            sources: [],
            retrievedChunksCount: 0,
          },
          { status: 500 }
        ),
        req,
        'POST, OPTIONS'
      );
    }

    // 2. Retrieve top-k relevant chunks (top 4)
    const retrievedChunks = await store.similaritySearch(queryEmbedding, 4);

    if (!retrievedChunks || retrievedChunks.length === 0) {
      const response: ChatResponse = {
        answer: NOT_FOUND_STRING,
        sources: [],
        retrievedChunksCount: 0,
      };
      return applyCors(NextResponse.json(response), req, 'POST, OPTIONS');
    }

    // 3. Generate grounded answer using Gemini LLM
    let answer: string;
    try {
      answer = await generateGroundedAnswer(
        trimmedQuestion,
        retrievedChunks.map((c) => ({
          documentName: c.documentName,
          pageNumber: c.pageNumber,
          text: c.text,
        }))
      );
    } catch (genErr: any) {
      console.error('[Chat API] Gemini LLM generation error:', genErr.message);
      return applyCors(
        NextResponse.json(
          {
            error: genErr.message || 'Answer generation failed on server.',
            answer: 'An error occurred while generating the response from knowledge base.',
            sources: [],
            retrievedChunksCount: retrievedChunks.length,
          },
          { status: 500 }
        ),
        req,
        'POST, OPTIONS'
      );
    }

    // 4. Format source citations
    const isNotFound = answer.includes(NOT_FOUND_STRING);
    const sources: SourceCitation[] = isNotFound
      ? []
      : retrievedChunks.map((c) => ({
          documentName: c.documentName,
          pageNumber: c.pageNumber,
          chunkIndex: c.chunkIndex,
          textSnippet: c.text.length > 220 ? c.text.slice(0, 220) + '...' : c.text,
          similarityScore: c.similarityScore ? Math.round(c.similarityScore * 100) / 100 : undefined,
        }));

    const response: ChatResponse = {
      answer,
      sources,
      retrievedChunksCount: retrievedChunks.length,
    };

    return applyCors(NextResponse.json(response), req, 'POST, OPTIONS');
  } catch (error: any) {
    console.error('[Chat API] Unexpected error:', error?.message || error);
    return applyCors(
      NextResponse.json(
        {
          error: 'An unexpected internal server error occurred.',
          answer: 'An unexpected server error occurred while retrieving answers.',
          sources: [],
          retrievedChunksCount: 0,
        },
        { status: 500 }
      ),
      req,
      'POST, OPTIONS'
    );
  }
}
