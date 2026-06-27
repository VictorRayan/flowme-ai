import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import { apiError, apiSuccess, ErrorCode } from '@/lib/api/errors';

const CHECKLIST_FIELDS = 'id,name,status,created_by,created_at,updated_at,completed_at';
const ITEM_FIELDS = 'id,checklist_id,title,checked,sort_order,created_at,updated_at,checked_at';
const VALID_CREATED_BY = ['user', 'balys', 'voice'] as const;
const VALID_STATUS = ['active', 'completed', 'archived', 'all'] as const;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter(Boolean).slice(0, 80);
}

async function loadItems(supabase: any, userId: string, checklistIds: string[]) {
  if (checklistIds.length === 0) return new Map<string, any[]>();
  const { data, error } = await supabase
    .from('checklist_items')
    .select(ITEM_FIELDS)
    .eq('user_id', userId)
    .in('checklist_id', checklistIds)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  const grouped = new Map<string, any[]>();
  for (const item of data || []) {
    const list = grouped.get(item.checklist_id) || [];
    list.push(item);
    grouped.set(item.checklist_id, list);
  }
  return grouped;
}

export async function GET(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'active';
    const limit = Math.min(Number(searchParams.get('limit') || 50), 100);
    if (!VALID_STATUS.includes(status as typeof VALID_STATUS[number])) {
      return apiError(ErrorCode.VALIDATION_ERROR, 'Invalid checklist status', 400);
    }

    let query = supabase
      .from('checklists')
      .select(CHECKLIST_FIELDS)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);
    const itemsByChecklist = await loadItems(supabase, user.id, (data || []).map((checklist: any) => checklist.id));
    return apiSuccess({
      checklists: (data || []).map((checklist: any) => ({
        ...checklist,
        items: itemsByChecklist.get(checklist.id) || [],
      })),
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to fetch checklists', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(req);
    const body = await req.json().catch(() => ({}));
    const name = text(body.name);
    const items = normalizeItems(body.items);
    const createdBy = VALID_CREATED_BY.includes(body.created_by) ? body.created_by : 'user';

    if (name.length < 2 || name.length > 120) return apiError(ErrorCode.VALIDATION_ERROR, 'Checklist name is required', 400);
    if (items.length === 0) return apiError(ErrorCode.VALIDATION_ERROR, 'At least one checklist item is required', 400);

    const { data: checklist, error } = await supabase
      .from('checklists')
      .insert({ user_id: user.id, name, created_by: createdBy, status: 'active' })
      .select(CHECKLIST_FIELDS)
      .single();
    if (error) return apiError(ErrorCode.SUPABASE_ERROR, error.message, 500);

    const rows = items.map((title, index) => ({
      checklist_id: checklist.id,
      user_id: user.id,
      title,
      sort_order: index,
    }));
    const { data: createdItems, error: itemsError } = await supabase
      .from('checklist_items')
      .insert(rows)
      .select(ITEM_FIELDS);
    if (itemsError) return apiError(ErrorCode.SUPABASE_ERROR, itemsError.message, 500);

    return apiSuccess({ checklist: { ...checklist, items: createdItems || [] } });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === ErrorCode.UNAUTHORIZED) return apiError(ErrorCode.UNAUTHORIZED, 'Unauthorized', 401);
    return apiError(ErrorCode.INTERNAL_ERROR, 'Failed to create checklist', 500);
  }
}
