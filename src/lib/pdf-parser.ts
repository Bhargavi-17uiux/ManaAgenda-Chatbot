import { PDFParse } from 'pdf-parse';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedDocument {
  text: string;
  pages: ExtractedPage[];
  totalPages: number;
}

/**
 * Extracts clean text and per-page content from a PDF Buffer
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<ExtractedDocument> {
  if (!buffer || buffer.length === 0) {
    throw new Error('PDF file buffer is empty.');
  }

  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();

    if (!result || !result.pages || result.pages.length === 0) {
      throw new Error('Could not parse any pages from this PDF file.');
    }

    const pages: ExtractedPage[] = [];
    let fullText = '';

    for (const page of result.pages) {
      const pageText = (page.text || '').replace(/\r\n/g, '\n').trim();
      if (pageText.length > 0) {
        pages.push({
          pageNumber: page.num,
          text: pageText,
        });
        fullText += (fullText ? '\n\n' : '') + pageText;
      }
    }

    if (pages.length === 0 || fullText.trim().length === 0) {
      throw new Error(
        'The uploaded PDF contains no extractable text. It may be a scanned image or empty document.'
      );
    }

    return {
      text: fullText,
      pages,
      totalPages: result.total || pages.length,
    };
  } catch (error: any) {
    if (error.message?.includes('no extractable text')) {
      throw error;
    }
    throw new Error(`Failed to extract text from PDF: ${error.message || 'Unknown parser error'}`);
  }
}

/**
 * Extracts clean text from a plain TXT Buffer
 */
export function extractTextFromTXT(buffer: Buffer): ExtractedDocument {
  if (!buffer || buffer.length === 0) {
    throw new Error('Text file is empty.');
  }

  const rawText = buffer.toString('utf-8').replace(/\r\n/g, '\n').trim();

  if (!rawText || rawText.length === 0) {
    throw new Error('The uploaded TXT file is empty or contains only whitespace.');
  }

  return {
    text: rawText,
    pages: [{ pageNumber: 1, text: rawText }],
    totalPages: 1,
  };
}
