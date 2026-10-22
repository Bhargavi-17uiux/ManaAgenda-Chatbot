/**
 * Re-embed all chunks in .documind_store.json using 1536-dimensional embeddings
 */
const fs = require('fs');
const path = require('path');
const dns = require('dns');

if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}

// Load .env.local
const envFile = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  const content = fs.readFileSync(envFile, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...rest] = trimmed.split('=');
      process.env[key.trim()] = rest.join('=').trim();
    }
  }
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY missing in .env.local');
  process.exit(1);
}

const storePath = path.join(process.cwd(), '.documind_store.json');
if (!fs.existsSync(storePath)) {
  console.log('No .documind_store.json found to re-embed.');
  process.exit(0);
}

const storeData = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
const chunks = storeData.chunks || [];
console.log(`Found ${chunks.length} chunks to update to 1536 dimensions...`);

async function embedText(text) {
  const clean = text.replace(/\n+/g, ' ').trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: { parts: [{ text: clean }] },
      outputDimensionality: 1536,
    }),
  });
  const data = await res.json();
  if (res.ok && data.embedding && Array.isArray(data.embedding.values)) {
    return data.embedding.values;
  }
  throw new Error(data.error?.message || `HTTP ${res.status}`);
}

async function run() {
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    process.stdout.write(`Embedding chunk ${i + 1}/${chunks.length} (${chunk.documentName})... `);
    try {
      const vec = await embedText(chunk.text);
      chunk.embedding = vec;
      console.log(`✓ (dim: ${vec.length})`);
    } catch (err) {
      console.error(`✗ Error: ${err.message}`);
    }
    // Small delay to respect rate limits
    await new Promise((r) => setTimeout(r, 100));
  }

  fs.writeFileSync(storePath, JSON.stringify(storeData, null, 2), 'utf-8');
  console.log(`\n🎉 Successfully updated all chunks to 1536-dimensional embeddings!`);
}

run();
