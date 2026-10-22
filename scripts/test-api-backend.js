/**
 * Production Verification Suite for ManaAgenda RAG Backend API
 * Tests CORS, Preflight (OPTIONS), RAG QA, Error Handling, and Security.
 */

async function runApiVerification() {
  const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
  console.log(`\n======================================================`);
  console.log(`   ManaAgenda RAG Backend - API & CORS Test Suite`);
  console.log(`======================================================\n`);

  let allPassed = true;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${testName} ${details ? `(${details})` : ''}`);
    } else {
      console.error(`❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
      allPassed = false;
    }
  }

  // 1. Health Check GET & CORS
  try {
    console.log(`--> Test 1: GET /api/health with Allowed Origin`);
    const res = await fetch(`${BASE_URL}/api/health`, {
      method: 'GET',
      headers: {
        Origin: 'https://manaagenda.vercel.app',
      },
    });
    const data = await res.json();
    assert(res.ok, 'Health check HTTP status is 200', `Status: ${res.status}`);
    assert(data.status === 'healthy', 'Health check reports healthy status', `status=${data.status}`);
    assert(data.geminiConfigured === true, 'Gemini API key is configured');
    assert(data.vectorStoreProvider === 'upstash', 'Vector store provider is upstash', `provider=${data.vectorStoreProvider}`);
    assert(data.documentCount === 3, 'Document count accurately reports 3 documents', `documentCount=${data.documentCount}`);
    assert(data.chunkCount === 24, 'Chunk count accurately reports 24 chunks', `chunkCount=${data.chunkCount}`);
    assert(
      res.headers.get('access-control-allow-origin') === 'https://manaagenda.vercel.app',
      'CORS Allow-Origin matches website origin',
      `Header: ${res.headers.get('access-control-allow-origin')}`
    );
  } catch (err) {
    assert(false, 'Test 1: Health check encountered network error', err.message);
  }

  // 2. Preflight OPTIONS on /api/chat
  try {
    console.log(`\n--> Test 2: OPTIONS /api/chat (CORS Preflight)`);
    const optionsRes = await fetch(`${BASE_URL}/api/chat`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://manaagenda.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    });
    assert(optionsRes.status === 204, 'Preflight status is 204 No Content', `Status: ${optionsRes.status}`);
    assert(
      optionsRes.headers.get('access-control-allow-origin') === 'https://manaagenda.vercel.app',
      'Preflight returns Access-Control-Allow-Origin'
    );
    assert(
      (optionsRes.headers.get('access-control-allow-methods') || '').includes('POST'),
      'Preflight allows POST method'
    );
  } catch (err) {
    assert(false, 'Test 2: Preflight error', err.message);
  }

  // 3. Unauthorized Origin Check
  try {
    console.log(`\n--> Test 3: Unauthorized Origin CORS Rejection`);
    const unauthRes = await fetch(`${BASE_URL}/api/chat`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://unauthorized-attacker.com',
      },
    });
    const allowOrigin = unauthRes.headers.get('access-control-allow-origin');
    assert(
      allowOrigin !== 'https://unauthorized-attacker.com',
      'Unauthorized origin is NOT granted CORS permission',
      `Allow-Origin header is: "${allowOrigin || 'null/none'}"`
    );
  } catch (err) {
    assert(false, 'Test 3: Unauthorized origin check error', err.message);
  }

  // 4. POST /api/chat with question field
  try {
    console.log(`\n--> Test 4: POST /api/chat with user question`);
    const chatRes = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://manaagenda.vercel.app',
      },
      body: JSON.stringify({ question: 'What is ManaAgenda?' }),
    });

    const chatData = await chatRes.json();
    assert(chatRes.ok, 'POST /api/chat returned HTTP 200', `Status: ${chatRes.status}`);
    assert(
      typeof chatData.answer === 'string' && chatData.answer.length > 10,
      'Response contains grounded answer text',
      `Answer: "${chatData.answer.slice(0, 60)}..."`
    );
    assert(
      Array.isArray(chatData.sources) && chatData.retrievedChunksCount > 0,
      'Response includes document sources and retrieved chunks count',
      `Chunks: ${chatData.retrievedChunksCount}, Sources: ${chatData.sources.length}`
    );
    assert(
      chatRes.headers.get('access-control-allow-origin') === 'https://manaagenda.vercel.app',
      'Chat response includes Access-Control-Allow-Origin header'
    );
  } catch (err) {
    assert(false, 'Test 4: Chat POST error', err.message);
  }

  // 5. POST /api/chat with alternative "message" payload
  try {
    // Brief pause to respect API rate limits
    await new Promise((r) => setTimeout(r, 1200));

    console.log(`\n--> Test 5: POST /api/chat with "message" payload`);
    const altRes = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: 'What core services does ManaAgenda offer?' }),
    });
    const altData = await altRes.json();
    assert(altRes.ok, 'Alternative payload returned HTTP 200');
    assert(
      typeof altData.answer === 'string' && altData.answer.length > 5,
      'Answer generated successfully using message parameter'
    );
  } catch (err) {
    assert(false, 'Test 5: Alternative payload error', err.message);
  }

  // 6. Safe Error Handling: Missing question
  try {
    console.log(`\n--> Test 6: Safe error handling for empty request`);
    const emptyRes = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const emptyData = await emptyRes.json();
    assert(emptyRes.status === 400, 'Returns HTTP 400 on missing question', `Status: ${emptyRes.status}`);
    assert(Boolean(emptyData.error), 'Returns clean JSON error message', `Error: "${emptyData.error}"`);
  } catch (err) {
    assert(false, 'Test 6: Error handling test failed', err.message);
  }

  console.log(`\n------------------------------------------------------`);
  if (allPassed) {
    console.log(`🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY!`);
  } else {
    console.error(`⚠️ SOME TESTS FAILED. Check logs above.`);
  }
  console.log(`------------------------------------------------------\n`);
}

runApiVerification();
