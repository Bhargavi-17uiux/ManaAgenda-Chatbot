import { DocumentChunk } from '@/types';
import { ExtractedPage } from './pdf-parser';

interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

/**
 * Splits text into overlapping chunks while trying to preserve sentence and paragraph boundaries.
 */
function splitTextIntoSegments(text: string, chunkSize: number, overlap: number): string[] {
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  if (normalizedText.length <= chunkSize) {
    return [normalizedText];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < normalizedText.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex >= normalizedText.length) {
      const finalChunk = normalizedText.slice(startIndex).trim();
      if (finalChunk.length > 0) {
        chunks.push(finalChunk);
      }
      break;
    }

    // Try to find a natural break near endIndex
    const searchWindow = normalizedText.slice(Math.max(startIndex, endIndex - 80), endIndex + 20);
    const breakMatches = [
      searchWindow.lastIndexOf('. '),
      searchWindow.lastIndexOf('? '),
      searchWindow.lastIndexOf('! '),
      searchWindow.lastIndexOf('; '),
      searchWindow.lastIndexOf(', '),
      searchWindow.lastIndexOf(' '),
    ];

    const bestRelativeBreak = Math.max(...breakMatches);

    if (bestRelativeBreak !== -1) {
      const naturalEnd = Math.max(startIndex, endIndex - 80) + bestRelativeBreak + 1;
      if (naturalEnd > startIndex + 100) {
        endIndex = naturalEnd;
      }
    }

    const chunk = normalizedText.slice(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    const nextStart = endIndex - overlap;
    startIndex = nextStart > startIndex ? nextStart : endIndex;
  }

  return chunks;
}

/**
 * Chunks extracted document pages into tagged DocumentChunk objects
 */
export function chunkDocument(
  documentId: string,
  documentName: string,
  pages: ExtractedPage[],
  options: ChunkOptions = {}
): DocumentChunk[] {
  const { chunkSize = 600, overlap = 120 } = options;
  const chunks: DocumentChunk[] = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const pageSegments = splitTextIntoSegments(page.text, chunkSize, overlap);

    for (const segment of pageSegments) {
      chunks.push({
        id: `${documentId}_chunk_${chunkIndex}`,
        documentId,
        documentName,
        pageNumber: page.pageNumber,
        text: segment,
        chunkIndex,
      });
      chunkIndex++;
    }
  }

  return chunks;
}
