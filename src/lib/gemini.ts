import dns from 'dns';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Prioritize IPv4 DNS resolution to prevent intermittent IPv6 connect timeouts
try {
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch {
  // Ignore in environments where dns customization is not available
}

const PREFERRED_LLM_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const PREFERRED_EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'gemini-embedding-001';
export const EMBEDDING_DIMENSION = 1536;


// Verified, supported fallback models from Google Generative Language API
const FALLBACK_LLM_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
];
const FALLBACK_EMBEDDING_MODELS = ['gemini-embedding-001'];

let activeLLMModel = PREFERRED_LLM_MODEL;
let activeEmbeddingModel = PREFERRED_EMBEDDING_MODEL;

// Single centralized timeout configuration (defaults to 30 seconds)
const REQUEST_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS || '30000', 10);

export function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error(
      'GEMINI_API_KEY is missing or invalid. Please add your Google Gemini API key to .env.local or deployment environment variables.'
    );
  }
  return apiKey;
}

export function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = getGeminiApiKey();
  return new GoogleGenerativeAI(apiKey);
}

function isNetworkError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  return (
    msg.includes('enotfound') ||
    msg.includes('econnrefused') ||
    msg.includes('fetch failed') ||
    msg.includes('no such host') ||
    msg.includes('network')
  );
}

function isTimeoutError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  const name = (err?.name || '').toLowerCase();
  return (
    name === 'timeouterror' ||
    name === 'aborterror' ||
    msg.includes('timeout') ||
    msg.includes('aborted')
  );
}

/**
 * Generates a vector embedding for a single piece of text with timeout and fail-fast handling.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = getGeminiApiKey();
  const cleanText = text.replace(/\n+/g, ' ').trim();

  const modelsToTry = Array.from(
    new Set([activeEmbeddingModel, ...FALLBACK_EMBEDDING_MODELS])
  );

  let lastErrorMsg = 'Unknown error';

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: { parts: [{ text: cleanText }] },
            outputDimensionality: EMBEDDING_DIMENSION,
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.embedding && Array.isArray(data.embedding.values)) {
          activeEmbeddingModel = model;
          return data.embedding.values;
        }

        if (res.status === 401 || res.status === 403) {
          throw new Error(
            'Invalid or unauthorized Gemini API key. Please check your GEMINI_API_KEY in .env.local.'
          );
        }

        lastErrorMsg = data?.error?.message || `Embedding failed with status ${res.status}`;
        const isRetryable = res.status === 429 || (res.status >= 500 && res.status < 600);
        if (isRetryable && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        break;
      } catch (err: any) {
        if (err.message?.includes('GEMINI_API_KEY')) {
          throw err;
        }
        if (isNetworkError(err)) {
          throw new Error(
            'Network connection error reaching Google Gemini API. Please check your internet connection.'
          );
        }
        if (isTimeoutError(err)) {
          lastErrorMsg = `Embedding request timed out after ${Math.round(REQUEST_TIMEOUT_MS / 1000)}s on ${model}`;
          break;
        }
        lastErrorMsg = err?.message || 'Embedding request failed';
        break;
      }
    }
  }

  throw new Error(`Embedding generation failed: ${lastErrorMsg}`);
}

/**
 * Generates vector embeddings for a list of texts in small sequential batches.
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  const batchSize = 10;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchPromises = batch.map((txt) => generateEmbedding(txt));
    const results = await Promise.all(batchPromises);
    embeddings.push(...results);

    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  }

  return embeddings;
}

/**
 * Generates a grounded RAG answer from retrieved context chunks with low-latency configuration.
 */
export async function generateGroundedAnswer(
  question: string,
  contextChunks: Array<{ documentName: string; pageNumber: number | null; text: string }>
): Promise<string> {
  const apiKey = getGeminiApiKey();

  const formattedContext = contextChunks
    .map(
      (c, idx) =>
        `[Document Source ${idx + 1}: ${c.documentName}${c.pageNumber ? ` | Page ${c.pageNumber}` : ''
        }]\n${c.text}`
    )
    .join('\n\n---\n\n');

  const systemInstructions = `You are DocuMind, a reliable and accurate AI Knowledge Assistant.
Your primary role is to answer user questions using ONLY the facts present in the provided document context.

STRICT INSTRUCTIONS:
ANSWER LENGTH AND STYLE:
1. Answer in one short sentence, ideally under 25 words.
2. Use simple, natural English.
3. Answer the exact question without unnecessary introductions or repeated information.
4. Use only the provided document context.
5. Do not include source labels, document numbers, citations, or references in the generated answer and return only the direct answer.
6. If the answer is not in the context, say: "I couldn't find this information in the uploaded documents."
7. If the user explicitly asks for details or a list, provide the necessary information.
8. Avoid unnecessary headings, bullet points, and Markdown formatting.

**CHATBOT BEHAVIOUR RULES**

- **Greetings:** If the user says "Hi", "Hello", "Hey", or a similar greeting, respond warmly, such as "Hi! 👋 Welcome to ManaAgenda. How can I help you today?"
- **Normal conversation:** Be friendly, polite, professional, and natural.
- **Answer length:** Keep answers short and clear, ideally under 25 words.
- **Knowledge base:** Answer company-related questions using only the provided document context.
- **When information is unavailable:** Never say "I couldn't find this information in the uploaded documents." Instead, say something natural, such as "I don't have that information right now, but our team can help you with it."
- **Out-of-scope questions:** Politely guide the user back to ManaAgenda's services and support.
- **No citations:** Never display document names, source labels, document numbers, or citations in the answer.
- **No guessing:** Never invent company details, prices, policies, or promises.
- **Response format:** Return only the message intended for the user, without internal notes or explanations.`;

  const prompt = `${systemInstructions}

=== RETRIEVED DOCUMENT CONTEXT ===
${formattedContext}
=== END OF RETRIEVED CONTEXT ===

USER QUESTION:
${question}

ANSWER:`;

  const modelsToTry = Array.from(
    new Set([activeLLMModel, ...FALLBACK_LLM_MODELS])
  );

  let lastErrorMsg = 'Unknown error';

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 512,
            },
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
          activeLLMModel = model;
          return data.candidates[0].content.parts[0].text.trim();
        }

        // Fast-fail on authentication or permission errors
        if (res.status === 401 || res.status === 403) {
          throw new Error(
            'Invalid or unauthorized Gemini API key. Please check your GEMINI_API_KEY in .env.local.'
          );
        }

        lastErrorMsg = data?.error?.message || `LLM generation failed for ${model} (HTTP ${res.status})`;

        // Transient failure retry (429 rate limit or 5xx server overload)
        const isRetryable = res.status === 429 || (res.status >= 500 && res.status < 600);
        if (isRetryable && attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        // For non-retryable status (400, 404), break to next fallback model immediately
        break;
      } catch (err: any) {
        if (err.message?.includes('GEMINI_API_KEY')) {
          throw err;
        }
        if (isNetworkError(err)) {
          throw new Error(
            'Network connection error reaching Google Gemini API. Please check your internet connection.'
          );
        }
        if (isTimeoutError(err)) {
          lastErrorMsg = `Operation timed out after ${Math.round(REQUEST_TIMEOUT_MS / 1000)}s on ${model}`;
          // On timeout, switch directly to next fallback model instead of retrying same slow model
          break;
        }
        lastErrorMsg = err?.message || 'Request failed';
        break;
      }
    }
  }

  throw new Error(`Gemini LLM answer generation failed: ${lastErrorMsg}`);
}
