import { NextRequest, NextResponse } from 'next/server';
import { requireApiKeyAuth } from '@/lib/api/api-key-auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';

/**
 * GET /api/v1/skills/[id]
 * Get a specific skill by ID or name.
 *
 * Auth: Bearer <api_key> with scope "skills.read"
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiKeyAuth(req, ['skills.read']);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;
    const { id } = await params;

    // Try by UUID first, then by name
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let query = supabase
      .from('skills')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false);

    if (isUuid) {
      query = query.eq('id', id);
    } else {
      query = query.eq('name', id);
    }

    const { data, error } = await query.single();

    if (error || !data) return apiError(ErrorCode.NOT_FOUND, 'Skill not found', 404);
    return apiSuccess({ skill: data });
  } catch (err: any) {
    console.error('GET /api/v1/skills/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}

/**
 * PUT /api/v1/skills/[id]
 * Update a skill by ID or name. Increments version.
 *
 * Body (JSON): Same fields as POST, all optional except the ones you want to change.
 *
 * Auth: Bearer <api_key> with scope "skills.write"
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiKeyAuth(req, ['skills.write']);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;
    const { id } = await params;

    const body = await req.json();
    const {
      display_name, description, instructions,
      input_schema, output_schema, category, tags, source_agent, is_active
    } = body;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // Get existing skill to increment version
    let existingQuery = supabase
      .from('skills')
      .select('id, version')
      .eq('user_id', userId)
      .eq('is_deleted', false);

    if (isUuid) {
      existingQuery = existingQuery.eq('id', id);
    } else {
      existingQuery = existingQuery.eq('name', id);
    }

    const { data: existing, error: lookupError } = await existingQuery.single();
    if (lookupError || !existing) return apiError(ErrorCode.NOT_FOUND, 'Skill not found', 404);

    const updates: Record<string, unknown> = { version: existing.version + 1 };
    if (display_name !== undefined) updates.display_name = display_name;
    if (description !== undefined) updates.description = description;
    if (instructions !== undefined) updates.instructions = instructions;
    if (input_schema !== undefined) updates.input_schema = input_schema;
    if (output_schema !== undefined) updates.output_schema = output_schema;
    if (category !== undefined) updates.category = category;
    if (tags !== undefined) updates.tags = tags;
    if (source_agent !== undefined) updates.source_agent = source_agent;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from('skills')
      .update(updates)
      .eq('id', existing.id)
      .eq('user_id', userId)
      .select('id, name, display_name, category, version, updated_at')
      .single();

    if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message, 500);
    return apiSuccess({ skill: data });
  } catch (err: any) {
    console.error('PUT /api/v1/skills/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}

/**
 * DELETE /api/v1/skills/[id]
 * Soft-delete a skill by ID or name.
 *
 * Auth: Bearer <api_key> with scope "skills.write"
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiKeyAuth(req, ['skills.write']);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;
    const { id } = await params;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let query = supabase
      .from('skills')
      .update({ is_deleted: true })
      .eq('user_id', userId);

    if (isUuid) {
      query = query.eq('id', id);
    } else {
      query = query.eq('name', id);
    }

    const { error } = await query;
    if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message, 500);

    return apiSuccess({ deleted: true, id });
  } catch (err: any) {
    console.error('DELETE /api/v1/skills/[id] error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
