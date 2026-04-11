import { NextRequest, NextResponse } from 'next/server';
import { requireApiKeyAuth } from '@/lib/api/api-key-auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { uploadToR2, buildR2Key, hashFileContent } from '@/lib/r2/storage';
import { analyzeDocument, extractTextFromBuffer, isTextProcessable } from '@/lib/ai/document-processor';

/**
 * GET /api/v1/documents
 * List documents for the authenticated user.
 *
 * Query params:
 *   - search: Search in filename, summary, content_text
 *   - tag: Filter by tag
 *   - status: Filter by processing_status
 *   - limit: Max results (default 50)
 *   - offset: Pagination offset
 *
 * Auth: Bearer <api_key> with scope "documents.read"
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req, ['documents.read']);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;

    const url = new URL(req.url);
    const search = url.searchParams.get('search');
    const tag = url.searchParams.get('tag');
    const status = url.searchParams.get('status');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase
      .from('documents')
      .select('id, filename, file_hash, mime_type, file_size, summary, key_points, tags, processing_status, created_at, updated_at')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`filename.ilike.%${search}%,summary.ilike.%${search}%,content_text.ilike.%${search}%`);
    }
    if (tag) query = query.contains('tags', [tag]);
    if (status) query = query.eq('processing_status', status);

    const { data, error } = await query;
    if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message, 500);

    return apiSuccess({ documents: data || [], count: data?.length || 0, offset, limit });
  } catch (err: any) {
    console.error('GET /api/v1/documents error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}

/**
 * POST /api/v1/documents
 * Upload a document. Accepts multipart/form-data with field "file".
 * Alternatively, accepts JSON body with base64-encoded content.
 *
 * Multipart: field "file" (File), optional "tags" (comma-separated)
 * JSON body: { filename, content_base64, mime_type, tags }
 *
 * Auth: Bearer <api_key> with scope "documents.write"
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req, ['documents.write']);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;

    let filename: string;
    let buffer: Buffer;
    let mimeType: string;
    let tags: string[] = [];

    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const tagsRaw = formData.get('tags') as string | null;

      if (!file) return apiError(ErrorCode.VALIDATION_ERROR, 'file field is required');

      filename = file.name;
      buffer = Buffer.from(await file.arrayBuffer());
      mimeType = file.type || 'application/octet-stream';
      if (tagsRaw) tags = tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    } else {
      // JSON body with base64
      const body = await req.json();
      if (!body.filename || !body.content_base64) {
        return apiError(ErrorCode.VALIDATION_ERROR, 'filename and content_base64 are required');
      }

      filename = body.filename;
      buffer = Buffer.from(body.content_base64, 'base64');
      mimeType = body.mime_type || 'application/octet-stream';
      if (body.tags) tags = Array.isArray(body.tags) ? body.tags : body.tags.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean);
    }

    const fileHash = await hashFileContent(buffer);

    // Check for duplicate
    const { data: existing } = await supabase
      .from('documents')
      .select('id, filename, summary, processing_status')
      .eq('user_id', userId)
      .eq('file_hash', fileHash)
      .eq('is_deleted', false)
      .single();

    if (existing) {
      return apiSuccess({
        document: existing,
        duplicate: true,
        message: `File already exists as "${existing.filename}"`,
      });
    }

    // Upload to R2
    const r2Key = buildR2Key(userId, fileHash, filename);
    await uploadToR2({
      key: r2Key,
      body: buffer,
      contentType: mimeType,
    });

    // Create DB record
    const { data: doc, error: insertError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        filename,
        file_hash: fileHash,
        mime_type: mimeType,
        file_size: buffer.length,
        r2_key: r2Key,
        tags,
        processing_status: 'pending',
      })
      .select('id, filename, file_hash, mime_type, file_size, tags, processing_status, created_at')
      .single();

    if (insertError) return apiError(ErrorCode.INTERNAL_ERROR, insertError.message, 500);

    // AI processing (sync for API — caller may need the result)
    if (isTextProcessable(mimeType)) {
      try {
        const textContent = extractTextFromBuffer(buffer, mimeType);
        if (textContent && textContent.trim().length > 0) {
          await supabase.from('documents').update({ processing_status: 'processing' }).eq('id', doc.id);

          const analysis = await analyzeDocument({ filename, content: textContent, mimeType });

          await supabase.from('documents').update({
            summary: analysis.summary,
            key_points: analysis.key_points,
            content_text: analysis.content_text,
            tags: [...new Set([...tags, ...analysis.tags])],
            processing_status: 'completed',
            processed_at: new Date().toISOString(),
          }).eq('id', doc.id);

          // Return the enriched document
          const { data: enriched } = await supabase
            .from('documents')
            .select('id, filename, file_hash, summary, key_points, tags, processing_status, created_at')
            .eq('id', doc.id)
            .single();

          return NextResponse.json({ ok: true, document: enriched }, { status: 201 });
        }
      } catch (procErr: any) {
        console.error(`[v1/documents] AI processing failed:`, procErr.message);
        await supabase.from('documents').update({
          processing_status: 'failed',
          processing_error: procErr.message,
        }).eq('id', doc.id);
      }
    }

    return NextResponse.json({ ok: true, document: doc }, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/v1/documents error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
