export interface DocumentChunk {
  id: string;
  documentId: string;
  documentName: string;
  pageNumber: number | null;
  text: string;
  chunkIndex: number;
  embedding?: number[];
  similarityScore?: number;
}

export interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  type: 'pdf' | 'txt';
  pageCount: number;
  chunkCount: number;
  uploadedAt: string;
}

export interface SourceCitation {
  documentName: string;
  pageNumber: number | null;
  chunkIndex: number;
  textSnippet: string;
  similarityScore?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: SourceCitation[];
  createdAt: string;
  error?: boolean;
}

export interface UploadResponse {
  success: boolean;
  document?: UploadedDocument;
  chunksCreated?: number;
  error?: string;
  details?: string;
}

export interface ChatResponse {
  answer: string;
  sources: SourceCitation[];
  retrievedChunksCount: number;
  error?: string;
}

export interface HealthResponse {
  status: 'healthy' | 'warning' | 'error';
  geminiConfigured: boolean;
  vectorStoreProvider: 'upstash' | 'local';
  documentCount: number;
  chunkCount: number;
  message: string;
}
