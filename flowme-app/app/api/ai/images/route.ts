import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';
import { downloadFromR2 } from '@/lib/r2/storage';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(request);
    const key = request.nextUrl.searchParams.get('key') || '';
    const allowedPrefix = `users/${user.id}/generated-images/`;
    if (!key.startsWith(allowedPrefix)) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'Invalid image key');
    }

    const image = await downloadFromR2(key);
    return new NextResponse(image.body, {
      headers: {
        'Content-Type': image.contentType,
        'Content-Length': String(image.contentLength),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    console.error('GET /api/ai/images error:', error);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Could not load generated image', 500);
  }
}

