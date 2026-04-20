import { NextResponse } from 'next/server';

import { addCorsHeaders, handleOptionsRequest } from '@/lib/cors';

export const runtime = 'edge';

const DEFAULT_ALLOWED_HOSTS = ['doubanio.com', 'douban.com'];

function getAllowedHosts(): string[] {
  const fromEnv = process.env.IMAGE_PROXY_ALLOWED_HOSTS;
  if (!fromEnv) {
    return DEFAULT_ALLOWED_HOSTS;
  }

  return fromEnv
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function isHostAllowed(hostname: string, allowedHosts: string[]) {
  const normalized = hostname.toLowerCase();
  return allowedHosts.some(
    (host) => normalized === host || normalized.endsWith(`.${host}`)
  );
}

export async function OPTIONS() {
  return handleOptionsRequest();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrlRaw = searchParams.get('url');

  if (!imageUrlRaw) {
    const response = NextResponse.json({ error: 'Missing image URL' }, { status: 400 });
    return addCorsHeaders(response);
  }

  try {
    const imageUrl = new URL(imageUrlRaw);
    if (imageUrl.protocol !== 'http:' && imageUrl.protocol !== 'https:') {
      const response = NextResponse.json(
        { error: 'Only http/https URLs are allowed' },
        { status: 400 }
      );
      return addCorsHeaders(response);
    }

    const allowedHosts = getAllowedHosts();
    if (!isHostAllowed(imageUrl.hostname, allowedHosts)) {
      const response = NextResponse.json(
        { error: `Host not allowed: ${imageUrl.hostname}` },
        { status: 403 }
      );
      return addCorsHeaders(response);
    }

    const imageResponse = await fetch(imageUrl.toString(), {
      headers: {
        Referer: 'https://movie.douban.com/',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    if (!imageResponse.ok) {
      const response = NextResponse.json(
        { error: imageResponse.statusText },
        { status: imageResponse.status }
      );
      return addCorsHeaders(response);
    }

    const contentType = imageResponse.headers.get('content-type');
    if (!imageResponse.body) {
      const response = NextResponse.json(
        { error: 'Image response has no body' },
        { status: 500 }
      );
      return addCorsHeaders(response);
    }

    const headers = new Headers();
    if (contentType) {
      headers.set('Content-Type', contentType);
    }
    headers.set('Cache-Control', 'public, max-age=15720000, s-maxage=15720000');
    headers.set('CDN-Cache-Control', 'public, s-maxage=15720000');
    headers.set('Vercel-CDN-Cache-Control', 'public, s-maxage=15720000');

    const response = new Response(imageResponse.body, {
      status: 200,
      headers,
    });
    return addCorsHeaders(response);
  } catch {
    const response = NextResponse.json(
      { error: 'Error fetching image' },
      { status: 500 }
    );
    return addCorsHeaders(response);
  }
}
