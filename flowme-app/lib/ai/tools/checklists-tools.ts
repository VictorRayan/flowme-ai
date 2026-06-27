import { z } from 'zod';
import { defineTool, type Tool, type ToolContext } from './Tool';

const CHECKLIST_FIELDS = 'id,name,status,created_by,created_at,updated_at,completed_at';
const ITEM_FIELDS = 'id,checklist_id,title,checked,sort_order,created_at,updated_at,checked_at';

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function renderChecklist(checklist: any, items: any[]) {
  return {
    id: checklist.id,
    name: checklist.name,
    status: checklist.status,
    created_at: checklist.created_at,
    completed_at: checklist.completed_at,
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      checked: item.checked,
    })),
  };
}

async function listChecklists(context: ToolContext, status: 'active' | 'completed' | 'archived' | 'all' = 'active') {
  let query = context.supabase
    .from('checklists')
    .select(CHECKLIST_FIELDS)
    .eq('user_id', context.user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

async function getChecklistItems(context: ToolContext, checklistId: string) {
  const { data, error } = await context.supabase
    .from('checklist_items')
    .select(ITEM_FIELDS)
    .eq('user_id', context.user.id)
    .eq('checklist_id', checklistId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

async function findChecklistByName(context: ToolContext, listName: string) {
  const lists = await listChecklists(context, 'all');
  const wanted = normalize(listName);
  return lists.find((list: any) => normalize(list.name) === wanted)
    || lists.find((list: any) => normalize(list.name).includes(wanted) || wanted.includes(normalize(list.name)))
    || null;
}

function findItemByName(items: any[], itemName: string) {
  const wanted = normalize(itemName);
  return items.find((item) => normalize(item.title) === wanted)
    || items.find((item) => normalize(item.title).includes(wanted) || wanted.includes(normalize(item.title)))
    || null;
}

export const checklistsCreateTool = defineTool({
  name: 'checklists.create',
  description: `Creates a named checklist with ordered items. Use for shopping lists, packing lists, clothing purchases, chores, or any user request like "crie uma checklist de mercado com arroz, leite e banana".

Infer a concise list name and item titles from natural language. Do not ask for technical IDs. Return a short confirmation with the list name and item count.`,
  isReadOnly: false,
  inputSchema: z.object({
    name: z.string().min(2).max(120),
    items: z.array(z.string().min(1).max(200)).min(1).max(80),
  }),
  call: async (args, context) => {
    const { data: checklist, error } = await context.supabase
      .from('checklists')
      .insert({ user_id: context.user.id, name: args.name.trim(), status: 'active', created_by: 'balys' })
      .select(CHECKLIST_FIELDS)
      .single();
    if (error) return { ok: false, error: error.message };

    const rows = args.items.map((item, index) => ({
      checklist_id: checklist.id,
      user_id: context.user.id,
      title: item.trim(),
      sort_order: index,
    }));
    const { data: items, error: itemError } = await context.supabase
      .from('checklist_items')
      .insert(rows)
      .select(ITEM_FIELDS);
    if (itemError) return { ok: false, error: itemError.message };

    return { ok: true, receipt: renderChecklist(checklist, items || []) };
  },
});

export const checklistsListTool = defineTool({
  name: 'checklists.list',
  description: 'Lists user checklists and their visible items. Use before updating a checklist when the target is ambiguous. Never expose technical IDs.',
  isReadOnly: true,
  inputSchema: z.object({
    status: z.enum(['active', 'completed', 'archived', 'all']).optional().default('active'),
  }),
  call: async (args, context) => {
    const lists = await listChecklists(context, args.status);
    const checklists = await Promise.all(lists.map(async (checklist: any) => renderChecklist(checklist, await getChecklistItems(context, checklist.id))));
    return { ok: true, receipt: { checklists, count: checklists.length } };
  },
});

export const checklistsSetItemTool = defineTool({
  name: 'checklists.set_item',
  description: `Marks or unmarks a checklist item using natural names. Use list_name and item_name from the user's words or from checklists.list results. Never ask the user for a checklist ID or item ID.`,
  isReadOnly: false,
  inputSchema: z.object({
    list_name: z.string().min(1),
    item_name: z.string().min(1),
    checked: z.boolean().default(true),
  }),
  call: async (args, context) => {
    const checklist = await findChecklistByName(context, args.list_name);
    if (!checklist) return { ok: false, error: `Não encontrei a checklist "${args.list_name}".` };
    const items = await getChecklistItems(context, checklist.id);
    const item = findItemByName(items, args.item_name);
    if (!item) return { ok: false, error: `Não encontrei o item "${args.item_name}" em "${checklist.name}".` };
    const { data, error } = await context.supabase
      .from('checklist_items')
      .update({
        checked: args.checked,
        checked_at: args.checked ? new Date(context.nowIso).toISOString() : null,
        updated_at: new Date(context.nowIso).toISOString(),
      })
      .eq('id', item.id)
      .eq('user_id', context.user.id)
      .select(ITEM_FIELDS)
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, receipt: { list_name: checklist.name, item: data } };
  },
});

export const checklistsCompleteTool = defineTool({
  name: 'checklists.complete',
  description: 'Completes a checklist by natural list name. Use when the user says the list is done/concluded/finalizada.',
  isReadOnly: false,
  inputSchema: z.object({
    list_name: z.string().min(1),
  }),
  call: async (args, context) => {
    const checklist = await findChecklistByName(context, args.list_name);
    if (!checklist) return { ok: false, error: `Não encontrei a checklist "${args.list_name}".` };
    const now = new Date(context.nowIso).toISOString();
    const { data, error } = await context.supabase
      .from('checklists')
      .update({ status: 'completed', completed_at: now, updated_at: now })
      .eq('id', checklist.id)
      .eq('user_id', context.user.id)
      .select(CHECKLIST_FIELDS)
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, receipt: { name: data.name, status: data.status, completed_at: data.completed_at } };
  },
});

export const CHECKLIST_TOOLS: Tool[] = [
  checklistsCreateTool,
  checklistsListTool,
  checklistsSetItemTool,
  checklistsCompleteTool,
];
