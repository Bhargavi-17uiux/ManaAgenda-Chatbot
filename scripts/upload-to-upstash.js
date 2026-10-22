/**
 * Migration Script: Seed .documind_store.json chunks into Upstash Vector
 *
 * Usage:
 *   node scripts/upload-to-upstash.js            # Live upload
 *   node scripts/upload-to-upstash.js --dry-run  # Validate chunks without uploading
 */

const fs = require('fs');
const path = require('path');
const { Index } = require('@upstash/vector');

// ==========================================
// 1. Safe Environment Loader
// ==========================================
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf-8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();

    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvLocal();

// ==========================================
// 2. Validate Flags and Secrets
// ==========================================
const isDryRun = process.argv.includes('--dry-run');
const EXPECTED_DIMENSION = 1536;

const upstashUrl = process.env.UPSTASH_VECTOR_REST_URL?.trim();
const upstashToken = process.env.UPSTASH_VECTOR_REST_TOKEN?.trim();

function maskSecret(val) {
  if (!val || val.length < 8) return '********';
  return `${val.slice(0, 4)}...${val.slice(-4)}`;
}

console.log(`\n========================================================`);
console.log(`  ManaAgenda RAG - Upstash Vector Migration Script`);
console.log(`  Mode: ${isDryRun ? 'DRY-RUN (Validation Only)' : 'LIVE UPLOAD'}`);
console.log(`========================================================\n`);

// ==========================================
// 3. Load & Validate Local Store
// ==========================================
const storePath = path.join(process.cwd(), '.documind_store.json');
if (!fs.existsSync(storePath)) {
  console.error(`❌ ERROR: Storage file not found at: ${storePath}`);
  process.exit(1);
}

let storeData;
try {
  storeData = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
} catch (err) {
  console.error(`❌ ERROR: Failed to parse .documind_store.json: ${err.message}`);
  process.exit(1);
}

const chunks = storeData.chunks || [];
const documents = storeData.documents || [];

console.log(`📁 Local Store Statistics:`);
console.log(`   - Documents registered: ${documents.length}`);
console.log(`   - Document chunks found: ${chunks.length}\n`);

if (chunks.length === 0) {
  console.error(`❌ ERROR: No chunks found in .documind_store.json.`);
  process.exit(1);
}

// ==========================================
// 4. Verify Chunk Embeddings (1536 Dimensions)
// ==========================================
console.log(`🔍 Verifying embedding dimensions (${EXPECTED_DIMENSION})...`);
let invalidCount = 0;

for (let i = 0; i < chunks.length; i++) {
  const chunk = chunks[i];
  if (!chunk.id || !chunk.text || !Array.isArray(chunk.embedding)) {
    console.error(`   ❌ Chunk #${i + 1} (${chunk.id || 'missing ID'}): Malformed record`);
    invalidCount++;
    continue;
  }

  if (chunk.embedding.length !== EXPECTED_DIMENSION) {
    console.error(
      `   ❌ Chunk #${i + 1} (${chunk.id}): Dimension mismatch! Expected ${EXPECTED_DIMENSION}, got ${chunk.embedding.length}`
    );
    invalidCount++;
  }
}

if (invalidCount > 0) {
  console.error(`\n❌ Validation failed: ${invalidCount} chunks do not match ${EXPECTED_DIMENSION} dimensions.`);
  console.error(`   Run "node scripts/reembed-store.js" first to recompute 1536-dim embeddings.`);
  process.exit(1);
}

console.log(`✅ All ${chunks.length} chunks verified with exact ${EXPECTED_DIMENSION} dimensions.\n`);

// Print sample chunk metadata
const sample = chunks[0];
console.log(`📋 Chunk Format Preview:`);
console.log(`   - ID: ${sample.id}`);
console.log(`   - Document: ${sample.documentName}`);
console.log(`   - Page: ${sample.pageNumber}`);
console.log(`   - Text preview: "${sample.text.slice(0, 90)}..."`);
console.log(`   - Embedding length: ${sample.embedding.length}\n`);

// If dry run, stop here
if (isDryRun) {
  console.log(`--------------------------------------------------------`);
  console.log(`🎉 DRY RUN COMPLETED SUCCESSFULLY!`);
  console.log(`   All ${chunks.length} chunks are valid and ready for upload.`);
  console.log(`   To perform the live upload, run:`);
  console.log(`   node scripts/upload-to-upstash.js`);
  console.log(`--------------------------------------------------------\n`);
  process.exit(0);
}

// ==========================================
// 5. Check Upstash Credentials for Live Upload
// ==========================================
if (
  !upstashUrl ||
  !upstashToken ||
  upstashUrl.includes('your-index-url') ||
  upstashToken.includes('your_token') ||
  upstashToken.includes('your_upstash')
) {
  console.error(`❌ UPSTASH CREDENTIALS MISSING:`);
  console.error(`   Please set UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN`);
  console.error(`   in your .env.local file or environment variables.\n`);
  console.error(`   Example in .env.local:`);
  console.error(`   UPSTASH_VECTOR_REST_URL=https://xxxx-us1-vector.upstash.io`);
  console.error(`   UPSTASH_VECTOR_REST_TOKEN=ABxxxxxxxxxxxxxxxxxxxx==\n`);
  console.error(`   (Note: Use "node scripts/upload-to-upstash.js --dry-run" to test without credentials.)`);
  process.exit(1);
}

console.log(`🌐 Connecting to Upstash Vector:`);
console.log(`   - Endpoint: ${upstashUrl}`);
console.log(`   - Token:    ${maskSecret(upstashToken)}\n`);

const index = new Index({
  url: upstashUrl,
  token: upstashToken,
});

// ==========================================
// 6. Batch Upload to Upstash
// ==========================================
async function uploadToUpstash() {
  // Check index info if available
  try {
    const info = await index.info();
    console.log(`ℹ️ Current Upstash Index Info:`);
    console.log(`   - Dimension:           ${info.dimension || 'unknown'}`);
    console.log(`   - Similarity Metric:   ${info.similarityFunction || 'unknown'}`);
    console.log(`   - Existing Vectors:    ${info.vectorCount ?? 0}\n`);

    if (info.dimension && info.dimension !== EXPECTED_DIMENSION) {
      console.error(
        `❌ DIMENSION MISMATCH: Upstash index has dimension ${info.dimension}, but chunks have dimension ${EXPECTED_DIMENSION}.`
      );
      console.error(`   Please create or select an Upstash index configured with 1536 dimensions.`);
      process.exit(1);
    }
  } catch (infoErr) {
    console.warn(`⚠️ Could not retrieve index info (continuing with upload): ${infoErr.message}\n`);
  }

  // Format records to match src/lib/vector-store.ts
  const records = chunks.map((chunk) => ({
    id: chunk.id,
    vector: chunk.embedding,
    metadata: {
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      pageNumber: chunk.pageNumber ?? null,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
    },
  }));

  const BATCH_SIZE = 25;
  let uploadedCount = 0;

  console.log(`🚀 Uploading ${records.length} chunks in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);

    process.stdout.write(`   Batch ${batchNum}/${totalBatches} (${batch.length} chunks)... `);

    try {
      await index.upsert(batch);
      uploadedCount += batch.length;
      console.log(`✓ Uploaded`);
    } catch (batchErr) {
      console.error(`✗ Failed: ${batchErr.message}`);
      console.error(`   Aborting remaining batches.`);
      break;
    }
  }

  console.log(`\n--------------------------------------------------------`);
  if (uploadedCount === records.length) {
    console.log(`🎉 SUCCESS! All ${uploadedCount} chunks uploaded to Upstash Vector!`);
  } else {
    console.log(`⚠️ Partial upload: ${uploadedCount}/${records.length} chunks uploaded.`);
  }

  // Verify final index stats
  try {
    const finalInfo = await index.info();
    console.log(`📊 Updated Index Vector Count: ${finalInfo.vectorCount ?? 'unknown'}`);
  } catch {}

  console.log(`--------------------------------------------------------\n`);
}

uploadToUpstash().catch((err) => {
  console.error(`❌ Unexpected upload error: ${err.message}`);
  process.exit(1);
});
