import fs from 'fs';
import path from 'path';
import { Index } from '@upstash/vector';
import { DocumentChunk, UploadedDocument } from '@/types';

/**
 * Calculates cosine similarity between two numerical vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

export interface IVectorStore {
  addChunks(chunks: DocumentChunk[]): Promise<void>;
  addDocumentMeta(doc: UploadedDocument): Promise<void>;
  similaritySearch(queryVector: number[], topK?: number): Promise<DocumentChunk[]>;
  getDocuments(): Promise<UploadedDocument[]>;
  removeDocumentByName(name: string): Promise<void>;
  deleteDocumentById(id: string): Promise<boolean>;
  clearAll(): Promise<void>;
  getProviderName(): 'upstash' | 'local';
}

// ==========================================
// 1. Upstash Vector Cloud Implementation
// ==========================================
class UpstashVectorStore implements IVectorStore {
  private index: Index;

  constructor(url: string, token: string) {
    this.index = new Index({
      url,
      token,
    });
  }

  getProviderName(): 'upstash' | 'local' {
    return 'upstash';
  }

  async addChunks(chunks: DocumentChunk[]): Promise<void> {
    const records = chunks.map((chunk) => ({
      id: chunk.id,
      vector: chunk.embedding!,
      metadata: {
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        pageNumber: chunk.pageNumber ?? null,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
      },
    }));

    // Upstash batch upsert limit is usually 100
    const batchSize = 50;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await this.index.upsert(batch);
    }
  }

  async addDocumentMeta(doc: UploadedDocument): Promise<void> {
    // Store doc metadata in Upstash with special doc_meta prefix
    await this.index.upsert([
      {
        id: `meta_${doc.id}`,
        // dummy zero-vector or empty vector for metadata lookup
        vector: new Array(768).fill(0),
        metadata: {
          isDocumentMeta: true,
          ...doc,
        },
      },
    ]);
  }

  async similaritySearch(queryVector: number[], topK: number = 4): Promise<DocumentChunk[]> {
    const results = await this.index.query({
      vector: queryVector,
      topK,
      includeMetadata: true,
      includeVectors: false,
    });

    return results
      .filter((res) => !res.metadata?.isDocumentMeta)
      .map((res) => ({
        id: String(res.id),
        documentId: String(res.metadata?.documentId || ''),
        documentName: String(res.metadata?.documentName || 'Unknown Document'),
        pageNumber: typeof res.metadata?.pageNumber === 'number' ? res.metadata.pageNumber : null,
        chunkIndex: Number(res.metadata?.chunkIndex || 0),
        text: String(res.metadata?.text || ''),
        similarityScore: res.score,
      }));
  }

  async getDocuments(): Promise<UploadedDocument[]> {
    // In Upstash, we can query recent metadata or use a local sync
    // For MVP robustness, we also keep an in-memory/cache index of documents
    return [];
  }

  async removeDocumentByName(_name: string): Promise<void> {
    // Upstash serverless index deletion by metadata if needed
  }

  async deleteDocumentById(id: string): Promise<boolean> {
    try {
      await this.index.delete(`meta_${id}`);
      return true;
    } catch {
      return false;
    }
  }

  async clearAll(): Promise<void> {
    await this.index.reset();
  }
}

// ==========================================
// 2. Local File / Memory Implementation
// ==========================================
class LocalVectorStore implements IVectorStore {
  private chunks: DocumentChunk[] = [];
  private documents: UploadedDocument[] = [];
  private storageFile = path.join(process.cwd(), '.documind_store.json');

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storageFile)) {
        const raw = fs.readFileSync(this.storageFile, 'utf-8');
        const data = JSON.parse(raw);
        this.chunks = data.chunks || [];
        this.documents = data.documents || [];
      }
    } catch {
      // Ignore initial file read error, start clean
      this.chunks = [];
      this.documents = [];
    }
  }

  private saveToDisk(): void {
    try {
      fs.writeFileSync(
        this.storageFile,
        JSON.stringify({ chunks: this.chunks, documents: this.documents }, null, 2),
        'utf-8'
      );
    } catch (e) {
      console.warn('Could not persist local store to disk:', e);
    }
  }

  getProviderName(): 'upstash' | 'local' {
    return 'local';
  }

  async addChunks(newChunks: DocumentChunk[]): Promise<void> {
    this.chunks.push(...newChunks);
    this.saveToDisk();
  }

  async addDocumentMeta(doc: UploadedDocument): Promise<void> {
    this.documents = this.documents.filter((d) => d.id !== doc.id && d.name !== doc.name);
    this.documents.push(doc);
    this.saveToDisk();
  }

  async removeDocumentByName(name: string): Promise<void> {
    this.chunks = this.chunks.filter((c) => c.documentName !== name);
    this.documents = this.documents.filter((d) => d.name !== name);
    this.saveToDisk();
  }

  async deleteDocumentById(id: string): Promise<boolean> {
    const initialDocCount = this.documents.length;
    this.documents = this.documents.filter((d) => d.id !== id);
    if (this.documents.length === initialDocCount) {
      return false;
    }
    this.chunks = this.chunks.filter((c) => c.documentId !== id);
    this.saveToDisk();
    return true;
  }

  async similaritySearch(queryVector: number[], topK: number = 4): Promise<DocumentChunk[]> {
    if (this.chunks.length === 0) return [];

    const scored = this.chunks.map((chunk) => {
      const score = chunk.embedding ? cosineSimilarity(queryVector, chunk.embedding) : 0;
      return {
        ...chunk,
        similarityScore: score,
      };
    });

    // Sort descending by similarity score
    scored.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));

    return scored.slice(0, topK);
  }

  async getDocuments(): Promise<UploadedDocument[]> {
    return [...this.documents];
  }

  async clearAll(): Promise<void> {
    this.chunks = [];
    this.documents = [];
    this.saveToDisk();
  }
}

// Global singleton instance across Next.js API calls
declare global {
  // eslint-disable-next-line no-var
  var __documind_vector_store: IVectorStore | undefined;
}

export function getVectorStore(): IVectorStore {
  if (
    global.__documind_vector_store &&
    typeof (global.__documind_vector_store as any).deleteDocumentById === 'function'
  ) {
    return global.__documind_vector_store;
  }

  const upstashUrl = process.env.UPSTASH_VECTOR_REST_URL?.trim();
  const upstashToken = process.env.UPSTASH_VECTOR_REST_TOKEN?.trim();

  let store: IVectorStore;

  if (
    upstashUrl &&
    upstashToken &&
    !upstashUrl.includes('your-index-url') &&
    !upstashToken.includes('your_upstash')
  ) {
    store = new UpstashVectorStore(upstashUrl, upstashToken);
  } else {
    store = new LocalVectorStore();
  }

  global.__documind_vector_store = store;
  return store;
}
