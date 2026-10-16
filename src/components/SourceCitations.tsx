'use client';

import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { SourceCitation } from '@/types';

interface SourceCitationsProps {
  sources: SourceCitation[];
}

export function SourceCitations({ sources }: SourceCitationsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!sources || sources.length === 0) return null;

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="mt-4 pt-3 border-t border-slate-100">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
        <FileText className="w-3.5 h-3.5 text-indigo-500" />
        <span>Grounded Sources ({sources.length})</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sources.map((src, idx) => {
          const isExpanded = expandedIndex === idx;
          return (
            <div
              key={`${src.documentName}-${src.chunkIndex}-${idx}`}
              className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 text-xs transition-colors"
            >
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => toggleExpand(idx)}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="font-medium text-slate-800 truncate">
                    {src.documentName}
                  </span>
                  {src.pageNumber && (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold text-[10px] whitespace-nowrap">
                      p. {src.pageNumber}
                    </span>
                  )}
                  {src.similarityScore !== undefined && (
                    <span className="text-[10px] text-slate-400">
                      {Math.round(src.similarityScore * 100)}% match
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
                  aria-label={isExpanded ? 'Collapse snippet' : 'Expand snippet'}
                >
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {isExpanded && (
                <div className="mt-2 pt-2 border-t border-slate-200/60 text-slate-600 font-mono text-[11px] leading-relaxed bg-white/70 p-2 rounded">
                  <p className="whitespace-pre-wrap">{src.textSnippet}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
