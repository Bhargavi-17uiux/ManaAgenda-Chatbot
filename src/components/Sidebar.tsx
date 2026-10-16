'use client';

import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileText,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  Database,
  Sparkles,
  Info,
} from 'lucide-react';
import { UploadedDocument, HealthResponse } from '@/types';

interface SidebarProps {
  documents: UploadedDocument[];
  health: HealthResponse | null;
  onUploadSuccess: (doc: UploadedDocument) => void;
  onClearDocuments: () => void;
  onDeleteDocument?: (doc: UploadedDocument) => Promise<boolean | void>;
  isLoadingDocs: boolean;
}

export function Sidebar({
  documents,
  health,
  onUploadSuccess,
  onClearDocuments,
  onDeleteDocument,
  isLoadingDocs,
}: SidebarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<UploadedDocument | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const confirmDeleteDocument = async (doc: UploadedDocument) => {
    if (deletingDocId) return; // Prevent duplicate delete requests
    setDeletingDocId(doc.id);
    setDeleteError(null);
    setDeleteSuccess(null);
    try {
      if (onDeleteDocument) {
        await onDeleteDocument(doc);
      } else {
        const res = await fetch(`/api/documents?id=${encodeURIComponent(doc.id)}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to delete document');
        }
      }
      setDeleteSuccess(`Deleted "${doc.name}" successfully.`);
      setDocumentToDelete(null);
      setTimeout(() => setDeleteSuccess(null), 3500);
    } catch (err: any) {
      setDeleteError(err.message || `Failed to delete "${doc.name}".`);
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFile = async (file: File) => {
    setUploadError(null);
    setIsUploading(true);
    setUploadProgress('Extracting text from document...');

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploadProgress('Generating embeddings and vector indexing...');
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await responseToJson(res);

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadProgress('Done!');
      onUploadSuccess(data.document);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to process document');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const responseToJson = async (res: Response) => {
    try {
      return await res.json();
    } catch {
      throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  const loadSampleDocument = async () => {
    setUploadError(null);
    setIsUploading(true);
    setUploadProgress('Loading sample document...');

    const sampleContent = `# DocuMind Enterprise AI Knowledge Assistant
Version: 2.4.0
Last Updated: October 2025

1. OVERVIEW
DocuMind is an enterprise knowledge assistant utilizing Retrieval-Augmented Generation (RAG).
It parses internal documentation, extracts text into structured chunks, embeds them into vector space, and generates strictly grounded answers.

2. CHUNKING SPECIFICATIONS
- Target Chunk Size: 600 characters per chunk with 120 character overlap.
- Boundaries: Semantic splits prioritize paragraph breaks, then sentence terminators (. ! ?), then commas and spaces.
- Metadata: Every chunk tracks its parent Document ID, Document Name, Page Number, and Chunk Index.

3. SECURITY & COMPLIANCE
- All API interactions with Google Gemini transmit context via TLS 1.3 encrypted endpoints.
- User queries are never stored or used to train third-party public models.
- Retention Period: Ephemeral session indexes expire after 24 hours unless explicitly persisted.

4. SUPPORTED FORMATS
- Adobe PDF (.pdf) with multi-page text extraction and per-page citation referencing.
- Plain Text (.txt) UTF-8 encoded files.

5. CONTACT & ESCALATIONS
For system maintenance or escalated queries, reach out to knowledge-ops@documind.internal or Slack channel #documind-support.`;

    const blob = new Blob([sampleContent], { type: 'text/plain' });
    const file = new File([blob], 'DocuMind_Overview_Guide.txt', { type: 'text/plain' });
    await uploadFile(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <aside className="w-full lg:w-80 bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shadow-indigo-100">
            D
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800 leading-tight">DocuMind</h1>
            <p className="text-[11px] text-slate-500">Knowledge Assistant</p>
          </div>
        </div>

        {health && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              health.geminiConfigured
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
            title={health.message}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                health.geminiConfigured ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            {health.geminiConfigured ? 'Ready' : 'Setup Key'}
          </span>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Upload Dropzone */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Ingest Document
          </label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/50'
                : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50/60'
            } ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.txt"
              className="hidden"
            />
            <div className="flex flex-col items-center">
              {isUploading ? (
                <>
                  <Loader2 className="w-7 h-7 text-indigo-600 animate-spin mb-2" />
                  <p className="text-xs font-medium text-slate-700">{uploadProgress}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Please wait a moment...</p>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-700">
                    Click to upload or drag & drop
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Supports PDF & TXT (Max 10MB)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Quick Sample Button */}
          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={loadSampleDocument}
              disabled={isUploading}
              className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 hover:underline disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3" />
              Load Sample Document
            </button>
            <span className="text-[10px] text-slate-400">1-click test</span>
          </div>

          {uploadError && (
            <div className="mt-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-1.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Upload failed</p>
                <p className="text-[11px] mt-0.5">{uploadError}</p>
              </div>
            </div>
          )}
        </div>

        {/* Uploaded Documents List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">
              Uploaded Documents ({documents.length})
            </span>
            {documents.length > 0 && (
              <button
                type="button"
                onClick={onClearDocuments}
                className="text-[11px] text-slate-400 hover:text-red-600 flex items-center gap-1 transition-colors"
                title="Clear all documents and index"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>

          {deleteSuccess && (
            <div className="mb-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{deleteSuccess}</span>
            </div>
          )}

          {deleteError && (
            <div className="mb-2 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold block">Delete failed</span>
                <span className="text-[11px] break-words">{deleteError}</span>
              </div>
            </div>
          )}

          {documents.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 text-center">
              <FileText className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
              <p className="text-xs text-slate-500 font-medium">No documents yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Upload a PDF or TXT to start asking questions.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-xs hover:border-slate-300 transition-colors flex items-center justify-between gap-2"
                >
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase flex-shrink-0 ${
                        doc.type === 'pdf'
                          ? 'bg-rose-50 text-rose-600 border border-rose-100'
                          : 'bg-sky-50 text-sky-600 border border-sky-100'
                      }`}
                    >
                      {doc.type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs font-medium text-slate-800 truncate"
                        title={doc.name}
                      >
                        {doc.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                        <span>{formatFileSize(doc.size)}</span>
                        <span>•</span>
                        <span>{doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}</span>
                        <span>•</span>
                        <span className="text-indigo-600 font-medium">{doc.chunkCount} chunks</span>
                      </div>
                    </div>
                  </div>

                  {/* Individual Delete Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteError(null);
                      setDeleteSuccess(null);
                      setDocumentToDelete(doc);
                    }}
                    disabled={deletingDocId !== null}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-40 flex-shrink-0"
                    title={`Delete "${doc.name}"`}
                    aria-label={`Delete ${doc.name}`}
                    data-testid={`delete-doc-${doc.id}`}
                  >
                    {deletingDocId === doc.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System & Vector Info Box */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-2 text-slate-600">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <Database className="w-3 h-3 text-indigo-500" />
              Vector Index
            </span>
            <span className="font-medium text-slate-500 capitalize">
              {health?.vectorStoreProvider || 'Local'}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Gemini LLM</span>
            <span className="font-mono text-[10px] text-slate-600">gemini-3.5-flash</span>
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Embeddings</span>
            <span className="font-mono text-[10px] text-slate-600">gemini-embedding-001</span>
          </div>
        </div>

        {/* Missing API Key Warning if applicable */}
        {health && !health.geminiConfigured && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <div className="flex items-center gap-1 font-semibold mb-1">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              Missing API Key
            </div>
            <p className="text-[11px] leading-relaxed">
              Add your Google Gemini API key to <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">.env.local</code> as <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">GEMINI_API_KEY</code> to enable embedding and answers.
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {documentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 border border-slate-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 id="delete-dialog-title" className="text-sm font-bold text-slate-800">
                  Delete Document?
                </h3>
                <p className="text-[11px] text-slate-500">
                  Permanently remove from vector index
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to delete <span className="font-semibold text-slate-800">"{documentToDelete.name}"</span>? Its {documentToDelete.chunkCount} text chunks and vector embeddings will be permanently removed.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (deletingDocId === null) {
                    setDocumentToDelete(null);
                  }
                }}
                disabled={deletingDocId !== null}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteDocument(documentToDelete)}
                disabled={deletingDocId !== null}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-xs shadow-red-200"
              >
                {deletingDocId === documentToDelete.id && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Delete Document
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
