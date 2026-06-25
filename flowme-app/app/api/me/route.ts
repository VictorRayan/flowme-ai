import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

function metadataString(metadata: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAuth(req);
    const metadata = user.user_metadata as Record<string, unknown> | undefined;
    return apiSuccess({
      user: {
        id: user.id,
        email: user.email || null,
        name: metadataString(metadata, ['full_name', 'name']) || user.email?.split('@')[0] || null,
        avatar_url: metadataString(metadata, ['avatar_url', 'picture']),
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to load user profile', 500);
  }
}
