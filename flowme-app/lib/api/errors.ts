import { NextResponse } from 'next/server';

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NOT_FOUND = 'NOT_FOUND',
  GOOGLE_AUTH_MISSING = 'GOOGLE_AUTH_MISSING',
  GOOGLE_TOKEN_REFRESH_FAILED = 'GOOGLE_TOKEN_REFRESH_FAILED',
  GOOGLE_API_ERROR = 'GOOGLE_API_ERROR',
  SLACK_AUTH_MISSING = 'SLACK_AUTH_MISSING',
  SLACK_TOKEN_REFRESH_FAILED = 'SLACK_TOKEN_REFRESH_FAILED',
  SUPABASE_ERROR = 'SUPABASE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export function apiSuccess(data: any = {}) {
  return NextResponse.json({ ok: true, ...data }, { status: 200 });
}

export function apiError(code: ErrorCode, message: string, status: number = 400) {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { status }
  );
}
