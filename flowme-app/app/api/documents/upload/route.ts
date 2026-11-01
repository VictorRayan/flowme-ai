import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { uploadToR2, buildR2Key, hashFileContent } from '@/lib/r2/storage';
import { analyzeDocument, extractTextFromBuffer, isTextProcessable } from '@/lib/ai/document-processor';
import { createClient } from '@supabase/supabase-js';

// Allow larger uploads (up to 50MB)
export const runtime = 'nodejs';

/**
 * POST /api/documents/upload
 * Upload a file → store in R2 → create DB record → AI process.
 *
 * Accepts: multipart/form-data with field "file"
 * Optional fields: "tags" (comma-separated)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const { user } = auth;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const tagsRaw = formData.get('tags') as string | null;

    if (!file) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'file field is required (multipart/form-data)');
    }
    if (file.size > 50 * 1024 * 1024) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'File exceeds 50 MB limit', 413);
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileHash = await hashFileContent(arrayBuffer);

    // Use service role for DB operations (file upload context)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check for duplicate
    const { data: existing } = await supabase
      .from('documents')
      .select('id, filename, summary, processing_status')
      .eq('user_id', user.id)
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
    const r2Key = buildR2Key(user.id, fileHash, file.name);

    await uploadToR2({
      key: r2Key,
      body: buffer,
      contentType: file.type || 'application/octet-stream',
      metadata: {
        userId: user.id,
        originalName: file.name,
      },
    });

    // Parse tags
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];

    // Create DB record
    const { data: doc, error: insertError } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        filename: file.name,
        file_hash: fileHash,
        mime_type: file.type || 'application/octet-stream',
        file_size: buffer.length,
        r2_key: r2Key,
        tags,
        processing_status: 'pending',
      })
      .select('id, filename, file_hash, mime_type, file_size, tags, processing_status, created_at')
      .single();

    if (insertError) {
      return apiError(ErrorCode.INTERNAL_ERROR, insertError.message, 500);
    }

    // AI processing (async — don't block the response)
    processDocumentAsync(supabase, user.id, doc.id, file.name, buffer, file.type || 'application/octet-stream');

    return NextResponse.json({ ok: true, document: doc }, { status: 201 });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    console.error('POST /api/documents/upload error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}

/**
 * Process document with AI in background (fire-and-forget).
 */
async function processDocumentAsync(
  supabase: any,
  userId: string,
  docId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
) {
  try {
    // Mark as processing
    await supabase.from('documents').update({ processing_status: 'processing' }).eq('id', docId).eq('user_id', userId);

    if (!isTextProcessable(mimeType)) {
      // Can't extract text from binary formats yet
      await supabase.from('documents').update({
        processing_status: 'skipped',
        processing_error: `Binary format "${mimeType}" not yet supported for AI processing`,
      }).eq('id', docId).eq('user_id', userId);
      return;
    }

    const textContent = extractTextFromBuffer(buffer, mimeType);
    if (!textContent || textContent.trim().length === 0) {
      await supabase.from('documents').update({
        processing_status: 'skipped',
        processing_error: 'No text content could be extracted',
      }).eq('id', docId).eq('user_id', userId);
      return;
    }

    // Run AI analysis
    const analysis = await analyzeDocument({
      filename,
      content: textContent,
      mimeType,
    });

    // Update document with AI results
    await supabase.from('documents').update({
      summary: analysis.summary,
      key_points: analysis.key_points,
      content_text: analysis.content_text,
      tags: analysis.tags,
      processing_status: 'completed',
      processed_at: new Date().toISOString(),
    }).eq('id', docId).eq('user_id', userId);

  } catch (err: any) {
    console.error(`[document-processor] Failed for doc ${docId}:`, err.message);
    await supabase.from('documents').update({
      processing_status: 'failed',
      processing_error: err.message || 'Unknown processing error',
    }).eq('id', docId).eq('user_id', userId);
  }
}
