import { NextRequest, NextResponse } from 'next/server';

/**
 * Parses and returns the list of allowed origins from environment variables.
 * In production, only origins configured in ALLOWED_ORIGINS are permitted.
 * In development, localhost is permitted by default for convenience.
 */
export function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS;

  if (envOrigins && envOrigins.trim()) {
    return envOrigins
      .split(',')
      .map((origin) => origin.trim().replace(/\/+$/, ''))
      .filter(Boolean);
  }

  // Development fallback: allow common local dev ports if no env is set
  if (process.env.NODE_ENV !== 'production') {
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:8000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
    ];
  }

  return [];
}

/**
 * Checks if the request origin is allowed based on ALLOWED_ORIGINS.
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;

  const cleanOrigin = origin.trim().replace(/\/+$/, '');
  const allowed = getAllowedOrigins();

  // Allow all if explicitly configured with wildcard (discouraged in strict production)
  if (allowed.includes('*')) {
    return true;
  }

  return allowed.some(
    (allowedOrigin) =>
      allowedOrigin === cleanOrigin ||
      (allowedOrigin.startsWith('*.') &&
        cleanOrigin.endsWith(allowedOrigin.replace('*.', '.')))
  );
}

/**
 * Computes secure CORS headers based on the incoming request's Origin header.
 */
export function getCorsHeaders(
  req: Request | NextRequest,
  allowedMethods = 'GET, POST, OPTIONS'
): Headers {
  const headers = new Headers();
  const origin = req.headers.get('origin');

  if (origin && isOriginAllowed(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }

  headers.set('Access-Control-Allow-Methods', allowedMethods);
  headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept'
  );
  headers.set('Access-Control-Max-Age', '86400');

  return headers;
}

/**
 * Handles HTTP OPTIONS preflight requests for any API route.
 */
export function handleCorsPreflight(
  req: Request | NextRequest,
  allowedMethods = 'GET, POST, OPTIONS'
): NextResponse {
  const headers = getCorsHeaders(req, allowedMethods);
  return new NextResponse(null, {
    status: 204,
    headers,
  });
}

/**
 * Helper to attach CORS headers to any NextResponse.
 */
export function applyCors(
  response: NextResponse,
  req: Request | NextRequest,
  allowedMethods = 'GET, POST, OPTIONS'
): NextResponse {
  const corsHeaders = getCorsHeaders(req, allowedMethods);
  corsHeaders.forEach((value, key) => {
    response.headers.set(key, value);
  });
  return response;
}
