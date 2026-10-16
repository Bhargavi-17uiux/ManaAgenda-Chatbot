'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Loader2,
  Trash2,
  Menu,
  Sparkles,
  HelpCircle,
  FileQuestion,
  AlertCircle,
} from 'lucide-react';
import { ChatMessage, SourceCitation } from '@/types';
import { SourceCitations } from './SourceCitations';

interface ChatAreaProps {
  messages: ChatMessage[];
  onSendMessage: (question: string) => Promise<void>;
  onClearChat: () => void;
  isLoading: boolean;
  onToggleSidebar: () => void;
  documentCount: number;
  apiError: string | null;
}

export function ChatArea({
  messages,
  onSendMessage,
  onClearChat,
  isLoading,
  onToggleSidebar,
  documentCount,
  apiError,
}: ChatAreaProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const question = input.trim();
    setInput('');
    await onSendMessage(question);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const samplePrompts = [
    'What is the overview and primary goal described in the document?',
    'What are the chunking specifications and boundary rules?',
    'What does the document state regarding security and compliance?',
    'What is the refund policy or contact information?',
  ];

  return (
    <main className="flex-1 flex flex-col h-full bg-slate-50/50 overflow-hidden">
      {/* Chat Header */}
      <header className="h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            aria-label="Toggle document sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-800">DocuMind Chat</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                {documentCount} {documentCount === 1 ? 'Doc Indexed' : 'Docs Indexed'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Grounded QA with vector similarity retrieval & citations
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={onClearChat}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset Chat</span>
          </button>
        )}
      </header>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center max-w-xl mx-auto text-center px-4 py-8">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">
              Ask DocuMind anything about your documents
            </h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed max-w-md">
              Upload PDF or TXT files using the sidebar. DocuMind will retrieve relevant chunks and generate accurate, strictly grounded answers with exact source citations.
            </p>

            <div className="w-full space-y-2 text-left">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Suggested Questions:
              </p>
              {samplePrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setInput(prompt);
                    inputRef.current?.focus();
                  }}
                  className="w-full text-left text-xs bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-indigo-300 rounded-lg p-2.5 text-slate-700 transition-all flex items-center justify-between group shadow-2xs"
                >
                  <span className="truncate pr-2">{prompt}</span>
                  <Send className="w-3 h-3 text-slate-300 group-hover:text-indigo-600 transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-3xl ${
                msg.role === 'user' ? 'ml-auto justify-end' : 'mr-auto justify-start'
              }`}
            >
              {msg.role !== 'user' && (
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%] md:max-w-[78%] shadow-xs ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-xs'
                    : 'bg-white border border-slate-200/90 text-slate-800 rounded-bl-xs'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {msg.sources && msg.sources.length > 0 && (
                  <SourceCitations sources={msg.sources} />
                )}

                <div
                  className={`mt-1.5 text-[10px] ${
                    msg.role === 'user' ? 'text-indigo-200 text-right' : 'text-slate-400'
                  }`}
                >
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-3 max-w-3xl mr-auto justify-start items-center">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-4 py-3 text-xs text-slate-600 flex items-center gap-2.5 shadow-xs">
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
              <span>Retrieving relevant context and generating answer...</span>
            </div>
          </div>
        )}

        {/* API Error Banner if any */}
        {apiError && (
          <div className="max-w-2xl mx-auto p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{apiError}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3 md:p-4 bg-white border-t border-slate-200 flex-shrink-0">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto relative flex items-center"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={
              documentCount === 0
                ? 'Upload a document first, or ask a question...'
                : 'Ask a question about your documents...'
            }
            disabled={isLoading}
            className="w-full resize-none bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 pr-12 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2.5 p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
            aria-label="Send question"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
        <p className="text-[10px] text-center text-slate-400 mt-2">
          Press <kbd className="px-1 py-0.5 bg-slate-100 rounded text-slate-600">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-slate-100 rounded text-slate-600">Shift + Enter</kbd> for new line. Grounded on retrieved context only.
        </p>
      </div>
    </main>
  );
}
