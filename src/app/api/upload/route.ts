import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { extractTextFromPDF, extractTextFromTXT } from '@/lib/pdf-parser';
import { chunkDocument } from '@/lib/chunker';
import { generateBatchEmbeddings } from '@/lib/gemini';
import { getVectorStore } from '@/lib/vector-store';
import { UploadedDocument } from '@/types';
import { applyCors, handleCorsPreflight } from '@/lib/cors';
import { getAdminAuthorization } from '@/lib/auth/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function OPTIONS(req: NextRequest) {
  return handleCorsPreflight(req, 'POST, OPTIONS');
}

export async function POST(req: NextRequest) {
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
                ? 'Document uploads are not configured.'
                : status === 403
                  ? 'Administrator access is required to upload documents.'
                  : 'Sign in with an administrator account to upload documents.',
          },
          { status }
        ),
        req,
        'POST, OPTIONS'
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return applyCors(
        NextResponse.json(
          { success: false, error: 'No file was provided in the upload request.' },
          { status: 400 }
        ),
        req,
        'POST, OPTIONS'
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return applyCors(
        NextResponse.json(
          {
            success: false,
            error: `File size exceeds the 10MB limit (${(file.size / (1024 * 1024)).toFixed(
              2
            )}MB). Please upload a smaller file.`,
          },
          { status: 400 }
        ),
        req,
        'POST, OPTIONS'
      );
    }

    const fileName = file.name;
    const lowerName = fileName.toLowerCase();
    const isPDF = lowerName.endsWith('.pdf');
    const isTXT = lowerName.endsWith('.txt');

    if (!isPDF && !isTXT) {
      return applyCors(
        NextResponse.json(
          {
            success: false,
            error:
              'Unsupported file format. DocuMind currently accepts PDF (.pdf) and Plain Text (.txt) files.',
          },
          { status: 400 }
        ),
        req,
        'POST, OPTIONS'
      );
    }

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Text Extraction
    let extracted;
    try {
      if (isPDF) {
        extracted = await extractTextFromPDF(buffer);
      } else {
        extracted = extractTextFromTXT(buffer);
      }
    } catch (extractError: any) {
      return applyCors(
        NextResponse.json(
          {
            success: false,
            error: extractError.message || 'Failed to extract text from document.',
          },
          { status: 400 }
        ),
        req,
        'POST, OPTIONS'
      );
    }

    if (!extracted.pages || extracted.pages.length === 0 || !extracted.text.trim()) {
      return applyCors(
        NextResponse.json(
          {
            success: false,
            error:
              'The uploaded document contains no extractable text. Please ensure it is not an image-only scan or empty file.',
          },
          { status: 400 }
        ),
        req,
        'POST, OPTIONS'
      );
    }

    const documentId = crypto.randomUUID();

    // 2. Text Chunking
    const chunks = chunkDocument(documentId, fileName, extracted.pages, {
      chunkSize: 600,
      overlap: 120,
    });

    if (chunks.length === 0) {
      return applyCors(
        NextResponse.json(
          {
            success: false,
            error: 'No text chunks could be produced from this document.',
          },
          { status: 400 }
        ),
        req,
        'POST, OPTIONS'
      );
    }

    // 3. Generate Embeddings using Gemini
    let embeddings: number[][];
    try {
      const texts = chunks.map((c) => c.text);
      embeddings = await generateBatchEmbeddings(texts);
    } catch (embError: any) {
      return applyCors(
        NextResponse.json(
          {
            success: false,
            error: `Embedding generation failed: ${embError.message}`,
            details: 'Please check if your GEMINI_API_KEY is configured correctly.',
          },
          { status: 500 }
        ),
        req,
        'POST, OPTIONS'
      );
    }

    // 4. Attach embeddings to chunks
    for (let i = 0; i < chunks.length; i++) {
      chunks[i].embedding = embeddings[i];
    }

    // 5. Store chunks in vector database
    const store = getVectorStore();
    await store.removeDocumentByName(fileName);
    await store.addChunks(chunks);

    const docMeta: UploadedDocument = {
      id: documentId,
      name: fileName,
      size: file.size,
      type: isPDF ? 'pdf' : 'txt',
      pageCount: extracted.totalPages,
      chunkCount: chunks.length,
      uploadedAt: new Date().toISOString(),
    };

    await store.addDocumentMeta(docMeta);

    return applyCors(
      NextResponse.json({
        success: true,
        document: docMeta,
        chunksCreated: chunks.length,
      }),
      req,
      'POST, OPTIONS'
    );
  } catch (error: any) {
    console.error('Upload handler error:', error);
    return applyCors(
      NextResponse.json(
        {
          success: false,
          error: error.message || 'An unexpected error occurred during document processing.',
        },
        { status: 500 }
      ),
      req,
      'POST, OPTIONS'
    );
  }
}
