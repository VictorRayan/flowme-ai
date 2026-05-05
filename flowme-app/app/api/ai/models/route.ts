import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api/auth';
import OpenAI from 'openai';

const GEMINI_LABELS: Record<string, { label: string; desc: string }> = {
  'gemini-3.1-pro-preview':     { label: 'Gemini 3.1 Pro',       desc: 'Latest preview' },
  'gemini-3-pro-preview':       { label: 'Gemini 3 Pro',          desc: 'Most capable' },
  'gemini-3-flash-preview':     { label: 'Gemini 3 Flash',        desc: 'Fast preview' },
  'gemini-2.5-pro':             { label: 'Gemini 2.5 Pro',        desc: 'Powerful & smart' },
  'gemini-2.5-flash':           { label: 'Gemini 2.5 Flash',      desc: 'Fast & smart' },
  'gemini-2.0-flash':           { label: 'Gemini 2.0 Flash',      desc: 'Multimodal' },
  'gemini-2.0-flash-lite':      { label: 'Gemini 2.0 Flash Lite', desc: 'Fastest' },
  'gemini-pro-latest':          { label: 'Gemini Pro (latest)',    desc: 'Stable pro' },
  'gemini-flash-latest':        { label: 'Gemini Flash (latest)',  desc: 'Stable flash' },
};

// Priority order for sorting
const PRIORITY = ['gemini-3.1-pro-preview','gemini-3-pro-preview','gemini-3-flash-preview','gemini-2.5-pro','gemini-2.5-flash','gemini-2.0-flash','gemini-2.0-flash-lite','gemini-pro-latest','gemini-flash-latest'];

export async function GET(request: NextRequest) {
  await requireAuth(request);

  const openaiModels: { id: string; label: string; provider: string; desc: string }[] = [];
  const geminiModels: { id: string; label: string; provider: string; desc: string }[] = [];

  // OpenAI — dynamic
  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const list = await openai.models.list();
      list.data
        .filter(m => m.id.startsWith('gpt-') || /^o\d/.test(m.id))
        .sort((a, b) => b.created - a.created)
        .slice(0, 20)
        .forEach(m => openaiModels.push({
          id: m.id, label: m.id, provider: 'openai',
          desc: m.id.includes('mini') || m.id.includes('nano') ? 'Fast & efficient' : /^o\d/.test(m.id) ? 'Reasoning model' : 'GPT model',
        }));
    } catch {
      openaiModels.push(
        { id: 'gpt-4o',      label: 'GPT-4o',      provider: 'openai', desc: 'Most capable' },
        { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai', desc: 'Fast & cheap' },
      );
    }
  }

  // Gemini — dynamic via v1beta
  if (process.env.GEMINI_API_KEY) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}&pageSize=100`);
      const data = await res.json();
      const available = (data.models || [])
        .filter((m: { name: string; supportedGenerationMethods?: string[] }) =>
          m.supportedGenerationMethods?.includes('generateContent') &&
          m.name.includes('gemini') &&
          !m.name.includes('tts') && !m.name.includes('image') &&
          !m.name.includes('computer-use') && !m.name.includes('research') &&
          !m.name.includes('robotics') && !m.name.includes('banana')
        )
        .map((m: { name: string }) => m.name.replace('models/', ''))
        .filter((id: string) => id !== 'gemini-2.5-flash-lite');

      // Sort by priority first, then alphabetically
      const sorted = [
        ...PRIORITY.filter(id => available.includes(id)),
        ...available.filter((id: string) => !PRIORITY.includes(id)).sort(),
      ];

      sorted.forEach((id: string) => {
        const meta = GEMINI_LABELS[id];
        geminiModels.push({ id, label: meta?.label || id, provider: 'gemini', desc: meta?.desc || 'Gemini model' });
      });
    } catch {
      geminiModels.push(
        { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'gemini', desc: 'Multimodal' },
      );
    }
  }

  return NextResponse.json({ openai: openaiModels, gemini: geminiModels });
}
