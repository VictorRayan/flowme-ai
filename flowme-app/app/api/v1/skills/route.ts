import { NextRequest, NextResponse } from 'next/server';
import { requireApiKeyAuth } from '@/lib/api/api-key-auth';
import { apiSuccess, apiError, ErrorCode } from '@/lib/api/errors';
import { ilikeAny } from '@/lib/api/safe-filters';

/**
 * GET /api/v1/skills
 * List all active skills for the authenticated user.
 *
 * Query params:
 *   - category: Filter by category (general, calendar, notes, research, communication, automation, custom)
 *   - tag: Filter by tag
 *   - search: Search in name/description
 *   - source: Filter by source (user, system, external_ai)
 *   - limit: Max results (default 50)
 *   - offset: Pagination offset (default 0)
 *
 * Auth: Bearer <api_key> with scope "skills.read"
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req, ['skills.read']);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;

    const url = new URL(req.url);
    const category = url.searchParams.get('category');
    const tag = url.searchParams.get('tag');
    const search = url.searchParams.get('search');
    const source = url.searchParams.get('source');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    let query = supabase
      .from('skills')
      .select('id, name, display_name, description, instructions, input_schema, output_schema, category, tags, version, source, source_agent, is_active, created_at, updated_at')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) query = query.eq('category', category);
    if (source) query = query.eq('source', source);
    if (search) {
      query = query.or(ilikeAny(['name', 'display_name', 'description'], search));
    }
    if (tag) query = query.contains('tags', [tag]);

    const { data, error } = await query;
    if (error) return apiError(ErrorCode.INTERNAL_ERROR, error.message, 500);

    return apiSuccess({ skills: data || [], count: data?.length || 0, offset, limit });
  } catch (err: any) {
    console.error('GET /api/v1/skills error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}

/**
 * POST /api/v1/skills
 * Create a new skill.
 *
 * Body (JSON):
 *   - name (required): Unique skill identifier (snake_case recommended)
 *   - display_name (required): Human-readable name
 *   - description: What the skill does
 *   - instructions (required): The actual AI instructions/prompt
 *   - input_schema: JSON Schema for expected inputs
 *   - output_schema: JSON Schema for expected outputs
 *   - category: general | calendar | notes | research | communication | automation | custom
 *   - tags: Array of searchable tags
 *   - source_agent: Name of the AI creating the skill (e.g. "claude-3-opus")
 *
 * Auth: Bearer <api_key> with scope "skills.write"
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiKeyAuth(req, ['skills.write']);
    if (auth instanceof Response) return auth;
    const { userId, supabase, keyName } = auth;

    const body = await req.json();
    const {
      name, display_name, description, instructions,
      input_schema, output_schema, category, tags, source_agent
    } = body;

    if (!name || typeof name !== 'string') return apiError(ErrorCode.VALIDATION_ERROR, 'name is required (string)');
    if (!display_name || typeof display_name !== 'string') return apiError(ErrorCode.VALIDATION_ERROR, 'display_name is required');
    if (!instructions || typeof instructions !== 'string') return apiError(ErrorCode.VALIDATION_ERROR, 'instructions is required');

    // Validate name format (alphanumeric + underscores)
    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'name must be lowercase alphanumeric with underscores, starting with a letter');
    }

    const { data: skill, error } = await supabase
      .from('skills')
      .insert({
        user_id: userId,
        name,
        display_name,
        description: description || null,
        instructions,
        input_schema: input_schema || {},
        output_schema: output_schema || {},
        category: category || 'general',
        tags: Array.isArray(tags) ? tags : [],
        source: 'external_ai',
        source_agent: source_agent || keyName || 'unknown',
      })
      .select('id, name, display_name, category, version, created_at')
      .single();

    if (error) {
      if (error.code === '23505') { // unique_violation
        return apiError(ErrorCode.VALIDATION_ERROR, `A skill with name "${name}" already exists. Use PUT to update.`, 409);
      }
      return apiError(ErrorCode.INTERNAL_ERROR, error.message, 500);
    }

    return NextResponse.json({ ok: true, skill }, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/v1/skills error:', err);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Internal Server Error', 500);
  }
}
