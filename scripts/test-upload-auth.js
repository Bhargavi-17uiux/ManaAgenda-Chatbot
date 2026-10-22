/**
 * Upload Authentication Test Suite for POST /api/upload
 * Tests that the UPLOAD_SECRET header gate works correctly.
 *
 * Usage (local dev server of the chatbot project):
 *   node scripts/test-upload-auth.js
 *
 * Usage (against deployed Vercel URL - auth tests only, safe):
 *   TEST_URL=https://mana-agenda-chatbot.vercel.app \
 *   UPLOAD_SECRET=<your_secret> node scripts/test-upload-auth.js
 *
 * The UPLOAD_SECRET env var must match what the server has configured.
 * No real PDF data is processed - only the authentication header gate is tested.
 * Node 18+ required (uses built-in fetch and FormData globals).
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3001';
const UPLOAD_SECRET = process.env.UPLOAD_SECRET || '';

console.log('\n======================================================');
console.log('  Upload Auth Test Suite');
console.log(`  Target: ${BASE_URL}/api/upload`);
console.log('======================================================\n');

let allPassed = true;

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`✅ PASS: ${testName}${detail ? ` (${detail})` : ''}`);
  } else {
    console.error(`❌ FAIL: ${testName}${detail ? ` (${detail})` : ''}`);
    allPassed = false;
  }
}

/**
 * POST to /api/upload with an empty FormData (no file).
 * We only test the HTTP status returned by auth check;
 * an empty body is enough — the route will 400 after auth passes.
 */
async function postUpload(headers = {}) {
  const form = new FormData(); // global in Node 18+
  const res = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers,
    body: form,
  });
  return res;
}

async function runTests() {
  // ── Test 1: No X-Upload-Secret header → 401 ───────────────────────────────
  try {
    console.log('--> Test 1: POST without X-Upload-Secret → expect 401');
    const res = await postUpload({});
    assert(res.status === 401, 'Returns HTTP 401 when header is absent', `Status: ${res.status}`);
    const data = await res.json();
    // Response must not leak the word "secret" (case-insensitive) in the body
    const errorText = JSON.stringify(data).toLowerCase();
    assert(
      !errorText.includes('upload_secret') && !errorText.includes('process.env'),
      'Error body does not expose secret variable name',
      `Body: ${JSON.stringify(data)}`
    );
  } catch (err) {
    assert(false, 'Test 1 error', err.message);
  }

  // ── Test 2: Wrong X-Upload-Secret → 401 ───────────────────────────────────
  try {
    console.log('\n--> Test 2: POST with wrong X-Upload-Secret → expect 401');
    const res = await postUpload({ 'x-upload-secret': 'this-is-not-the-right-secret' });
    assert(res.status === 401, 'Returns HTTP 401 for incorrect secret', `Status: ${res.status}`);
  } catch (err) {
    assert(false, 'Test 2 error', err.message);
  }

  // ── Test 3: Correct X-Upload-Secret → 400 (not 401) ──────────────────────
  if (!UPLOAD_SECRET) {
    console.log('\n⚠️  SKIP Test 3: UPLOAD_SECRET env var not set.');
    console.log('   Run with:  UPLOAD_SECRET=<your_secret> node scripts/test-upload-auth.js');
  } else {
    try {
      console.log('\n--> Test 3: POST with correct X-Upload-Secret → auth passes, expect 400 (no file)');
      const res = await postUpload({ 'x-upload-secret': UPLOAD_SECRET });
      assert(res.status !== 401, 'Valid secret is NOT rejected (auth gate passes)', `Status: ${res.status}`);
      assert(
        res.status === 400,
        'After auth passes, route correctly returns 400 for missing file',
        `Status: ${res.status}`
      );
    } catch (err) {
      assert(false, 'Test 3 error', err.message);
    }
  }

  // ── Test 4: OPTIONS preflight does not require the secret ─────────────────
  try {
    console.log('\n--> Test 4: OPTIONS preflight is allowed without X-Upload-Secret');
    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
      },
    });
    assert(res.status === 204, 'OPTIONS preflight returns 204 No Content', `Status: ${res.status}`);
  } catch (err) {
    assert(false, 'Test 4 error', err.message);
  }

  console.log('\n------------------------------------------------------');
  if (allPassed) {
    console.log('✅ ALL UPLOAD AUTH TESTS PASSED');
  } else {
    console.error('⚠️  SOME TESTS FAILED — review output above');
    process.exitCode = 1;
  }
  console.log('------------------------------------------------------\n');
}

runTests();
