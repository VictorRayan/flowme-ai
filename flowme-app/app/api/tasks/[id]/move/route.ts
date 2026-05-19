import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    await params;
    return apiError(
      ErrorCode.VALIDATION_ERROR,
      'Local task moves are no longer supported. Move the Google Calendar event instead.',
      410,
    );
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) {
      return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    }
    console.error('POST /api/tasks/[id]/move error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to move task', 500);
  }
}
