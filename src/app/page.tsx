'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { ChatArea } from '@/components/ChatArea';
import { UploadedDocument, ChatMessage, HealthResponse, ChatResponse } from '@/types';

export default function Home() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const fetchHealthAndDocs = useCallback(async () => {
    try {
      setIsLoadingDocs(true);
      const [healthRes, docsRes] = await Promise.all([
        fetch('/api/health').then((r) => r.json()),
        fetch('/api/documents').then((r) => r.json()),
      ]);

      setHealth(healthRes);
      if (docsRes.success && Array.isArray(docsRes.documents)) {
        setDocuments(docsRes.documents);
      }
    } catch (err: any) {
      console.error('Error fetching initial status:', err);
    } finally {
      setIsLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    fetchHealthAndDocs();
  }, [fetchHealthAndDocs]);

  const handleUploadSuccess = (newDoc: UploadedDocument) => {
    setDocuments((prev) => [
      newDoc,
      ...prev.filter((d) => d.id !== newDoc.id && d.name !== newDoc.name),
    ]);
    setApiError(null);

    // Add a welcome system message for the newly ingested document
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        role: 'assistant',
        content: `Successfully ingested "${newDoc.name}" (${newDoc.chunkCount} chunks indexed). You can now ask any question grounded in this document.`,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const handleClearDocuments = async () => {
    if (!confirm('Are you sure you want to clear all indexed documents?')) return;
    try {
      const res = await fetch('/api/documents', { method: 'DELETE' });
      if (res.ok) {
        setDocuments([]);
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            role: 'assistant',
            content: 'All documents and embeddings have been cleared.',
            createdAt: new Date().toISOString(),
          },
        ]);
        fetchHealthAndDocs();
      }
    } catch (err: any) {
      setApiError(err.message || 'Failed to clear documents');
    }
  };

  const handleDeleteDocument = async (doc: UploadedDocument) => {
    try {
      const res = await fetch(`/api/documents?id=${encodeURIComponent(doc.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to delete "${doc.name}"`);
      }

      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          role: 'assistant',
          content: `Document "${doc.name}" has been deleted. Its chunks and embeddings were removed.`,
          createdAt: new Date().toISOString(),
        },
      ]);
      fetchHealthAndDocs();
      return true;
    } catch (err: any) {
      setApiError(err.message || `Failed to delete "${doc.name}"`);
      throw err;
    }
  };

  const handleSendMessage = async (question: string) => {
    setApiError(null);
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: question,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      const data: ChatResponse = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to receive answer from assistant.');
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setApiError(err.message || 'Error occurred while contacting DocuMind.');
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-err-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${err.message || 'Failed to generate answer. Check your connection or API key.'}`,
          createdAt: new Date().toISOString(),
          error: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setApiError(null);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white">
      {/* Desktop & Mobile Drawer Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          documents={documents}
          health={health}
          onUploadSuccess={handleUploadSuccess}
          onClearDocuments={handleClearDocuments}
          onDeleteDocument={handleDeleteDocument}
          isLoadingDocs={isLoadingDocs}
        />
      </div>

      {/* Backdrop for mobile drawer */}
      {mobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-30 lg:hidden"
        />
      )}

      {/* Main Chat Interface */}
      <ChatArea
        messages={messages}
        onSendMessage={handleSendMessage}
        onClearChat={handleClearChat}
        isLoading={isLoading}
        onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        documentCount={documents.length}
        apiError={apiError}
      />
    </div>
  );
}
