/**
 * Cloudflare Worker for R2 Image Storage
 *
 * Handles image uploads and retrieval for the Virtual Try-On extension.
 *
 * Setup instructions:
 * 1. Install Wrangler: npm install -g wrangler
 * 2. Login: wrangler login
 * 3. Create R2 bucket: wrangler r2 bucket create tryon-images
 * 4. Deploy: cd cloudflare-worker && wrangler deploy
 * 5. Set ALLOWED_ORIGINS in Cloudflare dashboard (Settings > Variables)
 */

interface Env {
  IMAGES_BUCKET: R2Bucket;
  ALLOWED_ORIGINS?: string; // Comma-separated list of allowed origins
}

interface UploadResponse {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

// Generate a unique key for the image
function generateKey(type: 'user' | 'clothing' | 'result'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${type}/${timestamp}-${random}`;
}

// Get allowed origins from env or use default
function getAllowedOrigins(env: Env): string[] {
  if (env.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  }
  // Default: allow all chrome extensions (for development)
  return ['*'];
}

// CORS headers
function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') || '';
  const allowed = getAllowedOrigins(env);

  const isAllowed = allowed.includes('*') ||
    allowed.some(a => origin.startsWith(a) || origin === a);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Image-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    try {
      // POST /upload - Upload an image
      if (request.method === 'POST' && url.pathname === '/upload') {
        const contentType = request.headers.get('Content-Type') || '';
        const imageType = request.headers.get('X-Image-Type') as 'user' | 'clothing' | 'result' || 'user';

        if (!contentType.startsWith('image/')) {
          return Response.json(
            { success: false, error: 'Invalid content type. Must be an image.' } as UploadResponse,
            { status: 400, headers: cors }
          );
        }

        const key = generateKey(imageType);
        const body = await request.arrayBuffer();

        // Upload to R2
        await env.IMAGES_BUCKET.put(key, body, {
          httpMetadata: { contentType },
        });

        // Return the URL
        const imageUrl = `${url.origin}/images/${key}`;

        return Response.json(
          { success: true, url: imageUrl, key } as UploadResponse,
          { headers: cors }
        );
      }

      // GET /images/:key - Retrieve an image
      if (request.method === 'GET' && url.pathname.startsWith('/images/')) {
        const key = url.pathname.replace('/images/', '');

        const object = await env.IMAGES_BUCKET.get(key);

        if (!object) {
          return Response.json(
            { success: false, error: 'Image not found' },
            { status: 404, headers: cors }
          );
        }

        const headers = new Headers(cors);
        headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
        headers.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
        headers.set('ETag', object.httpEtag);

        return new Response(object.body, { headers });
      }

      // DELETE /images/:key - Delete an image
      if (request.method === 'DELETE' && url.pathname.startsWith('/images/')) {
        const key = url.pathname.replace('/images/', '');

        await env.IMAGES_BUCKET.delete(key);

        return Response.json(
          { success: true },
          { headers: cors }
        );
      }

      // GET /list/:type - List images by type (user, clothing, result)
      // GET /list - List all images
      if (request.method === 'GET' && url.pathname.startsWith('/list')) {
        const type = url.pathname.replace('/list/', '').replace('/list', '');
        const prefix = type && type !== '' ? `${type}/` : undefined;

        const listed = await env.IMAGES_BUCKET.list({ prefix, limit: 100 });

        const images = listed.objects.map(obj => ({
          key: obj.key,
          url: `${url.origin}/images/${obj.key}`,
          size: obj.size,
          uploaded: obj.uploaded.toISOString(),
        }));

        return Response.json(
          { success: true, images, truncated: listed.truncated },
          { headers: cors }
        );
      }

      // GET /health - Health check
      if (request.method === 'GET' && url.pathname === '/health') {
        return Response.json(
          { status: 'ok', timestamp: new Date().toISOString() },
          { headers: cors }
        );
      }

      // 404 for unknown routes
      return Response.json(
        { error: 'Not found' },
        { status: 404, headers: cors }
      );

    } catch (error) {
      console.error('Worker error:', error);
      return Response.json(
        { success: false, error: 'Internal server error' } as UploadResponse,
        { status: 500, headers: cors }
      );
    }
  },
};
