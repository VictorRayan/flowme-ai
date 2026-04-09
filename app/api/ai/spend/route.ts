import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';

type UsageRow = {
  provider: 'openai' | 'gemini';
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  linked_account_id: string | null;
  created_at: string;
  feature: 'chat' | 'transcribe';
};

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const days = Number(searchParams.get('days') || 30);

    const defaultFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const fromDate = from || defaultFrom;
    const toDate = to || new Date().toISOString();

    const { data, error } = await supabase
      .from('ai_usage_logs')
      .select('provider,model,prompt_tokens,completion_tokens,total_tokens,cost_usd,linked_account_id,created_at,feature')
      .eq('user_id', user.id)
      .gte('created_at', fromDate)
      .lte('created_at', toDate)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []) as UsageRow[];

    const { data: accounts } = await supabase
      .from('linked_accounts')
      .select('id,name')
      .eq('user_id', user.id)
      .eq('is_deleted', false);

    const accountNameById = new Map<string, string>((accounts || []).map((a: any) => [a.id, a.name]));

    const total = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      cost_usd: 0,
    };

    const byModelMap = new Map<string, {
      provider: 'openai' | 'gemini';
      model: string;
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      cost_usd: number;
      requests: number;
    }>();

    const byAccountMap = new Map<string, {
      linked_account_id: string | null;
      account_name: string;
      total_tokens: number;
      cost_usd: number;
      requests: number;
    }>();

    for (const row of rows) {
      total.prompt_tokens += row.prompt_tokens || 0;
      total.completion_tokens += row.completion_tokens || 0;
      total.total_tokens += row.total_tokens || 0;
      total.cost_usd += Number(row.cost_usd || 0);

      const mKey = `${row.provider}:${row.model}`;
      const m = byModelMap.get(mKey) || {
        provider: row.provider,
        model: row.model,
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        cost_usd: 0,
        requests: 0,
      };
      m.prompt_tokens += row.prompt_tokens || 0;
      m.completion_tokens += row.completion_tokens || 0;
      m.total_tokens += row.total_tokens || 0;
      m.cost_usd += Number(row.cost_usd || 0);
      m.requests += 1;
      byModelMap.set(mKey, m);

      const accKey = row.linked_account_id || 'unlinked';
      const a = byAccountMap.get(accKey) || {
        linked_account_id: row.linked_account_id,
        account_name: row.linked_account_id ? (accountNameById.get(row.linked_account_id) || 'Unknown') : 'Unlinked',
        total_tokens: 0,
        cost_usd: 0,
        requests: 0,
      };
      a.total_tokens += row.total_tokens || 0;
      a.cost_usd += Number(row.cost_usd || 0);
      a.requests += 1;
      byAccountMap.set(accKey, a);
    }

    const byModel = Array.from(byModelMap.values())
      .sort((a, b) => b.cost_usd - a.cost_usd)
      .map(item => ({ ...item, cost_usd: Number(item.cost_usd.toFixed(6)) }));

    const byAccount = Array.from(byAccountMap.values())
      .sort((a, b) => b.cost_usd - a.cost_usd)
      .map(item => ({ ...item, cost_usd: Number(item.cost_usd.toFixed(6)) }));

    return NextResponse.json({
      total: {
        ...total,
        cost_usd: Number(total.cost_usd.toFixed(6)),
      },
      by_model: byModel,
      by_account: byAccount,
      rows_count: rows.length,
      range: { from: fromDate, to: toDate, days },
      fx_usd_brl: Number(process.env.FX_USD_BRL || 5.0),
    });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('GET /api/ai/spend error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

