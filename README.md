# DocuMind — AI Knowledge Assistant (MVP)

> **DocuMind** is an enterprise-grade Retrieval-Augmented Generation (RAG) assistant that delivers accurate, hallucination-free answers strictly grounded in your uploaded PDF and TXT documents, complete with precise source citations.

---

## 🌟 Architecture & Features

### Core Capabilities
* **Document Ingestion:** Ingests Adobe PDF (`.pdf`) and Plain Text (`.txt`) files up to 10MB.
* **Per-Page Text Extraction:** Retains exact page numbers for all extracted sections using `pdf-parse`.
* **Boundary-Aware Chunking:** Splits text into 600-character segments with 120-character overlap, prioritizing natural paragraph and sentence endings.
* **High-Dimensional Embeddings:** Generates 768-dimensional normalized dense vectors using Google Gemini `text-embedding-004`.
* **Dual Vector Store Architecture:**
  * **Local Store (Zero Setup):** In-memory + persistent file cache with cosine similarity search for instant local developer testing without registering for any cloud database.
  * **Upstash Vector (Production Serverless):** Cloud serverless vector database over HTTPS REST (`@upstash/vector`) designed for Vercel Serverless Edge/Node runtimes with zero connection pooling limits.
* **Strict Grounding & Hallucination Prevention:** Configured with low temperature (`0.1`) and strict system prompt constraints. If context is missing, it explicitly returns:
  > *"I couldn't find this information in your uploaded documents."*
* **Source Citations:** Every response displays expandable citation cards showing the source document name, page number, match relevance percentage, and the exact text excerpt.
* **Modern Minimal SaaS Interface:** Built with Next.js 14 App Router, TypeScript, and Tailwind CSS.

---

## 🏗️ Project Structure

```
├── sample_documents/                 # Testing documents
│   ├── Acme_Handbook_2025.txt       # Sample company policy document
│   └── DocuMind_Architecture_Spec.pdf# Sample 2-page PDF specification
├── scripts/
│   ├── generate-samples.js          # Generator for sample PDF/TXT files
│   └── test-rag-workflow.js         # Automated RAG test verification suite
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts        # RAG query, vector retrieval & grounded LLM answer
│   │   │   ├── documents/route.ts   # Document listing and clearing
│   │   │   ├── health/route.ts      # Health check & provider status
│   │   │   └── upload/route.ts      # Ingestion, extraction, chunking & embeddings
│   │   ├── globals.css              # Global styles & typography
│   │   ├── layout.tsx               # Root layout & SEO metadata
│   │   └── page.tsx                 # SaaS dashboard page & state management
│   ├── components/
│   │   ├── ChatArea.tsx             # Interactive chat message view & input
│   │   ├── Sidebar.tsx              # Document upload dropzone, doc list, status
│   │   └── SourceCitations.tsx      # Citation cards with expandable snippets
│   ├── lib/
│   │   ├── chunker.ts               # Overlapping chunking engine with sentence breaks
│   │   ├── gemini.ts                # Google Gemini LLM & embedding API client
│   │   ├── pdf-parser.ts            # Multi-page PDF & TXT parser
│   │   └── vector-store.ts          # Upstash Vector & Local vector database engines
│   └── types/
│       └── index.ts                 # TypeScript data contracts & interfaces
├── .env.example                     # Environment variable template
├── next.config.js                   # Next.js bundler configuration
├── package.json                     # Project dependencies & scripts
├── tailwind.config.js               # Tailwind design system configuration
└── tsconfig.json                    # TypeScript compiler options
```

---

## 🚀 Quickstart Guide (Local Development)

### 1. Prerequisites
* **Node.js**: v18.0.0 or later (v20+ recommended)
* **npm**: v9.0.0 or later

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Open `.env.local` and add your **Google Gemini API Key**:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
> 💡 **Where to get a free Gemini API key?**
> Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to generate a free Gemini API key in under 1 minute.

### 3. Run the Automated Verification Suite
To verify document extraction, chunking math, and fallback logic:
```bash
node scripts/test-rag-workflow.js
```

### 4. Start the Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing the Complete RAG Workflow

Follow these steps to verify end-to-end functionality:

1. **Verify Health Check:**
   Visit `http://localhost:3000/api/health` in your browser. You will see:
   ```json
   {
     "status": "healthy",
     "geminiConfigured": true,
     "vectorStoreProvider": "local",
     "documentCount": 0,
     "chunkCount": 0
   }
   ```

2. **Upload a Sample PDF:**
   - In the sidebar, drag and drop `sample_documents/DocuMind_Architecture_Spec.pdf` or click **"Load Sample Document"** for 1-click test.
   - Observe the progress state: text extraction → embedding generation → indexed.
   - The document appears in the "Uploaded Documents" panel with page and chunk count.

3. **Ask an In-Context Question (Answer Present):**
   - Question: *"Who is the designated Data Privacy Officer?"*
   - Expected Output: Grounded response identifying **Dr. Sarah Lin (privacy@documind.example)**, with a citation card referencing **[DocuMind_Architecture_Spec.pdf | Page 2]**.

4. **Ask an Out-of-Context Question (Answer Absent):**
   - Question: *"What is the company's dress code policy for Friday?"*
   - Expected Output:
     > *"I couldn't find this information in your uploaded documents."*
   - Zero hallucinated citations will be returned.

5. **Test Invalid Files & Limits:**
   - Attempting to upload a `.jpg`, `.zip`, or empty document will display a clear error banner explaining that only non-empty `.pdf` and `.txt` files are supported.

---

## 🌐 Production Deployment (Vercel + Upstash Vector)

Why use Upstash Vector in production instead of local memory?
* Serverless functions on Vercel are ephemeral (stateless). In-memory globals and local filesystem storage reset between cold starts.
* **Upstash Vector** provides a serverless vector database over HTTPS REST that persists all document chunks and embeddings across serverless invocations.

### Step 1: Create a Free Upstash Vector Index
1. Go to [Upstash Console](https://console.upstash.com) and create a free account.
2. Click **Create Index** under the **Vector** tab.
3. Configure the index:
   * **Index Name:** `documind-index`
   * **Dimensions:** `768` (matches Google Gemini `text-embedding-004`)
   * **Distance Metric:** `Cosine`
4. Copy the **REST URL** and **REST Token** from the dashboard.

### Step 2: Deploy to Vercel
1. Push your repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "feat: DocuMind AI Knowledge Assistant MVP"
   git branch -M main
   git remote add origin https://github.com/your-username/documind.git
   git push -u origin main
   ```
2. Go to [Vercel](https://vercel.com) and click **Add New Project** → Import your repository.
3. In the **Environment Variables** section, configure the following:
   | Variable | Value | Required |
   |---|---|---|
   | `GEMINI_API_KEY` | Your Google AI Studio API key | Yes |
   | `UPSTASH_VECTOR_REST_URL` | `https://...-vector.upstash.io` | Yes (for persistent cloud retrieval) |
   | `UPSTASH_VECTOR_REST_TOKEN` | `AB...` | Yes (for persistent cloud retrieval) |
4. Click **Deploy**. Vercel will build and deploy the Next.js application.

### Free-Tier Limitations
* **Google Gemini Free Tier:** 15 requests per minute (RPM) for Gemini 1.5 Flash and text-embedding-004. Rate throttles are handled gracefully with retries in DocuMind.
* **Upstash Vector Free Tier:** 10,000 queries/day and 100,000 vector records, ample for hundreds of documents.
* **Vercel Hobby Plan:** 10s Serverless Function timeout and 4.5MB request payload limit (file upload chunks are restricted to 10MB maximum).
