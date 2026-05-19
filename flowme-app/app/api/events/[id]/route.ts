import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, ErrorCode } from '@/lib/api/errors';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    await params;
    return apiError(
      ErrorCode.VALIDATION_ERROR,
      'Local event updates are no longer supported. Update the Google Calendar event instead.',
      410,
    );
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('PATCH /api/events/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to update event', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req);
    await params;
    return apiError(
      ErrorCode.VALIDATION_ERROR,
      'Local event deletion is no longer supported. Delete the Google Calendar event instead.',
      410,
    );
  } catch (err) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('DELETE /api/events/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to delete event', 500);
  }
}
