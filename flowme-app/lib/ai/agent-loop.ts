import OpenAI from 'openai';
import { z } from 'zod';
import { Tool, ToolContext } from './tools/Tool';
import { getToolByName } from './tools/registry';
import { zodToJsonSchema } from 'zod-to-json-schema';

export type AgentProgressEvent =
  | { type: 'tool_call_start'; tool: string; args: any; call_id: string }
  | { type: 'tool_call_end'; tool: string; call_id: string; ok: boolean; receipt?: any; error?: string }
  | { type: 'assistant_text'; text: string }
  | { type: 'step_start'; step: number };

export type AgentLoopOptions = {
  messages: Array<{ role: 'user' | 'assistant' | 'system' | 'tool'; content: string | any; name?: string; tool_call_id?: string; tool_calls?: any[] }>;
  tools: Tool[];
  maxSteps: number;
  requiredFirstTool?: string;
  preExecuteFirstTool?: boolean;
  provider: 'openai' | 'gemini' | 'deepseek' | string;
  model: string;
  context: ToolContext;
  threadId: string;
  onProgress?: (event: AgentProgressEvent) => void;
};

// Map Zod schemas to JSON schema for the OpenAI tools parameter.
// We strip $schema and definitions to keep payloads clean, and add
// additionalProperties: false so models don't hallucinate nested wrappers.
function mapToolsToOpenAI(tools: Tool[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map(tool => {
    const raw = zodToJsonSchema(tool.inputSchema as any, { target: 'openApi3' }) as any;
    // Remove JSON-schema-only fields that confuse some providers
    delete raw['$schema'];
    delete raw['definitions'];
    delete raw['$defs'];
    // Enforce flat structure — no nested wrapping allowed
    if (raw.type === 'object') {
      raw.additionalProperties = false;
    }
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: raw,
        strict: false, // strict:true would require ALL properties to be listed; we have optionals
      },
    };
  });
}

// Some models (Gemini) wrap flat tool arguments inside a single nested object key,
// e.g. { plan: { problem_statement: "..." } } instead of { problem_statement: "..." }.
// Detects that pattern and unwraps one level so tools always receive flat args.
function unwrapNestedArgs(args: any, schema: z.ZodTypeAny): any {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return args;

  // Extract the shape from ZodObject — shape can be a function or plain object
  let shape: Record<string, unknown> | null = null;
  try {
    const def = (schema as any)._def;
    if (def?.shape) {
      shape = typeof def.shape === 'function' ? def.shape() : def.shape;
    }
  } catch {
    return args;
  }
  if (!shape) return args;

  const expectedKeys = Object.keys(shape);

  // Already flat — has at least one expected key at top level
  if (expectedKeys.some(k => k in args)) return args;

  // Exactly one top-level key wrapping an object that contains expected keys → unwrap
  const topKeys = Object.keys(args);
  if (topKeys.length === 1) {
    const inner = args[topKeys[0]];
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      if (expectedKeys.some(k => k in inner)) return inner;
    }
  }

  return args;
}

function truncateText(value: string, max = 900): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
}

function parseToolPayload(message: any): any | null {
  if (message?.role !== 'tool' || typeof message.content !== 'string') return null;
  try {
    const parsed = JSON.parse(message.content);
    return typeof parsed?.ok === 'boolean' ? parsed : null;
  } catch {
    return null;
  }
}

type RecentFileCandidate = { id: string; name: string; mimeType?: string; webViewLink?: string };

function collectRecentDriveFiles(messages: any[]): RecentFileCandidate[] {
  const files: RecentFileCandidate[] = [];
  for (const message of messages) {
    if (message?.name !== 'connectors.search_docs') continue;
    const payload = parseToolPayload(message);
    const list = payload?.receipt?.files || payload?.data?.files || [];
    if (!Array.isArray(list)) continue;
    for (const file of list) {
      if (typeof file?.id !== 'string' || typeof file?.name !== 'string') continue;
      files.push({ id: file.id, name: file.name, mimeType: file.mimeType, webViewLink: file.webViewLink });
    }
  }
  return files;
}

function matchFileByText(candidates: RecentFileCandidate[], text: string): RecentFileCandidate | null {
  if (!text) return null;
  const haystack = text.toLowerCase();
  for (const file of candidates) {
    const name = file.name.toLowerCase();
    if (haystack.includes(name)) return file;
  }
  for (const file of candidates) {
    const tokens = file.name.toLowerCase().split(/[\s\-_./]+/).filter((token) => token.length >= 4);
    if (tokens.some((token) => haystack.includes(token))) return file;
  }
  return null;
}

const FILE_ID_PARAM_TOOLS = new Set([
  'connectors.read_drive_file',
  'connectors.read_doc',
  'connectors.read_sheet',
  'connectors.find_and_read_doc',
  'connectors.sheets_agent',
  'connectors.docs_agent',
]);

export function autoResolveFileArgs(toolName: string, args: any, messages: any[], userText: string): any {
  if (!FILE_ID_PARAM_TOOLS.has(toolName) || !args || typeof args !== 'object') return args;

  const hasExplicitId = Boolean(
    args.file_id || args.file_url || args.document_url || args.spreadsheet_url || args.spreadsheet_name || args.doc_name
  );
  if (hasExplicitId) return args;

  const candidates = collectRecentDriveFiles(messages);
  if (candidates.length === 0) return args;

  const matched = matchFileByText(candidates, userText) || (candidates.length === 1 ? candidates[0] : candidates[candidates.length - 1]);
  if (!matched) return args;

  const patched: Record<string, unknown> = { ...args };
  patched.file_id = matched.id;
  if (toolName === 'connectors.read_sheet' || toolName === 'connectors.sheets_agent') {
    patched.spreadsheet_name = patched.spreadsheet_name || matched.name;
  }
  if (toolName === 'connectors.find_and_read_doc' || toolName === 'connectors.docs_agent') {
    patched.doc_name = patched.doc_name || matched.name;
  }
  return patched;
}

function latestGmailSearchMessageId(messages: any[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.name !== 'gmail.search_messages') continue;
    const payload = parseToolPayload(message);
    const emails = payload?.receipt?.messages || payload?.data?.messages || [];
    if (Array.isArray(emails) && typeof emails[0]?.id === 'string') return emails[0].id;
  }
  return null;
}

function buildFallbackContentFromToolMessages(messages: any[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const payload = parseToolPayload(message);
    if (!payload) continue;
    if (payload.ok === false) {
      const error = String(payload.error || '');
      if (/Connector needs connection/i.test(error)) {
        return 'Essa conexão ainda não está conectada. Abra Connectors e clique em Connect account para essa fonte.';
      }
      if (/needs refresh|Reconnect account/i.test(error)) {
        return 'A conexão com o Google precisa ser renovada. Abra Connectors e clique em Reconnect account para essa fonte.';
      }
      continue;
    }

    if (message.name === 'gmail.read_message') {
      const email = payload.data?.message;
      if (!email) continue;
      const body = truncateText(email.body_text || email.snippet || '', 1200);
      return [
        `Li o email "${email.subject || 'sem assunto'}" de ${email.from || 'remetente desconhecido'}.`,
        body ? `Conteúdo principal: ${body}` : 'O Gmail abriu a mensagem, mas ela não trouxe texto legível no corpo.',
      ].join('\n\n');
    }

    if (message.name === 'gmail.search_messages') {
      const emails = payload.receipt?.messages || payload.data?.messages || [];
      if (!Array.isArray(emails) || emails.length === 0) continue;
      return [
        'Encontrei estes emails:',
        ...emails.slice(0, 10).map((email: any) => `* ${email.from || 'Remetente desconhecido'} — ${email.subject || 'sem assunto'}`),
      ].join('\n');
    }

    if (message.name === 'connectors.search_docs') {
      const files = payload.receipt?.files || payload.data?.files || [];
      if (!Array.isArray(files) || files.length === 0) continue;
      return [
        'Encontrei estes arquivos:',
        ...files.slice(0, 10).map((file: any) => `* ${file.name || 'Sem nome'}`),
      ].join('\n');
    }

    if (message.name === 'connectors.read_doc' || message.name === 'connectors.find_and_read_doc') {
      const receipt = payload.receipt || {};
      const content = truncateText(receipt.content || payload.data?.content || '', 1200);
      return [
        `Li o documento "${receipt.title || payload.data?.title || 'sem título'}".`,
        content ? `Resumo rápido do conteúdo: ${content}` : 'O documento abriu, mas não trouxe texto legível.',
      ].join('\n\n');
    }

    if (message.name === 'connectors.sheets_agent') {
      const receipt = payload.receipt || {};
      const insights = Array.isArray(receipt.insights)
        ? receipt.insights.slice(0, 3).map((item: any) => `* ${item.title || 'Insight'}: ${item.evidence || item.recommendation || ''}`.trim())
        : [];
      return [receipt.summary || 'Analisei a planilha.', ...insights].filter(Boolean).join('\n');
    }

    if (message.name === 'connectors.read_drive_file') {
      const receipt = payload.receipt || {};
      const content = truncateText(receipt.content || '', 1200);
      return [
        `Li o arquivo "${receipt.title || 'sem título'}".`,
        content ? `Conteúdo principal: ${content}` : 'O arquivo abriu, mas não trouxe texto legível.',
      ].join('\n\n');
    }
  }
  return null;
}

export async function runBalysAgentLoop(options: AgentLoopOptions) {
  let steps = 0;
  const messages = [...options.messages];
  const availableTools = mapToolsToOpenAI(options.tools);
  const toolSignatureCounts = new Map<string, number>();
  const latestUserText = [...messages].reverse().find((message) => message.role === 'user' && typeof message.content === 'string')?.content || '';

  // Initialize OpenAI (we use OpenAI SDK as the universal interface for LLMs)
  // Gemini provides an OpenAI compatible endpoint. Deepseek does as well.
  let apiKey = process.env.OPENAI_API_KEY;
  let baseURL: string | undefined = undefined;

  if (options.provider === 'gemini') {
    apiKey = process.env.GEMINI_API_KEY;
    baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
  } else if (options.provider === 'deepseek') {
    apiKey = process.env.DEEPSEEK_API_KEY;
    baseURL = 'https://api.deepseek.com';
  }

  const openai = new OpenAI({ apiKey, baseURL });

  const maxSteps = Math.max(1, options.maxSteps);
  const preExecutableFirstTools = new Set(['gmail.search_messages', 'connectors.search_docs']);

  const emit = (event: AgentProgressEvent) => {
    try { options.onProgress?.(event); } catch (e) { console.error('[agent-loop] onProgress threw', e); }
  };

  const executeToolCall = async (toolName: string, parsedArgs: any, callId: string): Promise<void> => {
    const tool = getToolByName(toolName);
    if (!tool) {
      messages.push({
        role: 'tool',
        tool_call_id: callId,
        name: toolName,
        content: JSON.stringify({ error: `Tool ${toolName} not found or not allowed in this context.` })
      });
      emit({ type: 'tool_call_end', tool: toolName, call_id: callId, ok: false, error: 'tool not found' });
      return;
    }

    emit({ type: 'tool_call_start', tool: toolName, args: parsedArgs, call_id: callId });

    let status: 'success' | 'error' = 'success';
    let resultJson: any = null;
    let errorMessage: string | null = null;
    let receiptJson: any = null;

    try {
      const result = await tool.call(parsedArgs, {
        ...options.context,
        onProgress: options.onProgress as any,
      });
      if (result.ok) {
        resultJson = result.data || result.receipt || { success: true };
        receiptJson = result.receipt || null;

        messages.push({
          role: 'tool',
          tool_call_id: callId,
          name: toolName,
          content: JSON.stringify({ ok: true, receipt: receiptJson, data: result.data })
        });
        emit({ type: 'tool_call_end', tool: toolName, call_id: callId, ok: true, receipt: receiptJson });
      } else {
        status = 'error';
        errorMessage = result.error || 'Unknown error';
        messages.push({
          role: 'tool',
          tool_call_id: callId,
          name: toolName,
          content: JSON.stringify({ ok: false, error: errorMessage })
        });
        emit({ type: 'tool_call_end', tool: toolName, call_id: callId, ok: false, error: errorMessage });
      }
    } catch (e: any) {
      status = 'error';
      errorMessage = e.message;
      messages.push({
        role: 'tool',
        tool_call_id: callId,
        name: toolName,
        content: JSON.stringify({ ok: false, error: errorMessage })
      });
      emit({ type: 'tool_call_end', tool: toolName, call_id: callId, ok: false, error: errorMessage || 'exception' });
    }

    await options.context.supabase
      .from('ai_tool_runs')
      .insert({
        user_id: options.context.user.id,
        thread_id: options.threadId,
        tool_name: tool.name,
        input_json: parsedArgs,
        status,
        result_json: resultJson,
        receipt_json: receiptJson,
        error_message: errorMessage,
        verified_at: status === 'success' ? new Date().toISOString() : null
      });
  };

  let preExecutedFirstTool = false;
  if (options.preExecuteFirstTool && options.requiredFirstTool && preExecutableFirstTools.has(options.requiredFirstTool)) {
    preExecutedFirstTool = true;
    await executeToolCall(options.requiredFirstTool, {}, `pre-${options.requiredFirstTool}-${Date.now()}`);
    const fallbackContent = buildFallbackContentFromToolMessages(messages);
    if (fallbackContent) {
      return { content: fallbackContent, messages, steps };
    }
  }

  while (steps < maxSteps) {
    steps++;
    emit({ type: 'step_start', step: steps });

    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await openai.chat.completions.create({
        model: options.model,
        messages: messages as any,
        tools: availableTools.length > 0 ? availableTools : undefined,
        tool_choice: options.requiredFirstTool && steps === 1 && !preExecutedFirstTool
          ? { type: 'function', function: { name: options.requiredFirstTool } }
          : availableTools.length > 0 ? 'auto' : 'none',
        temperature: 0.2,
      });
    } catch (error) {
      const fallbackContent = buildFallbackContentFromToolMessages(messages);
      if (fallbackContent) {
        return { content: fallbackContent, messages, steps };
      }
      throw error;
    }

    const choice = response.choices[0];
    const message = choice.message;

    // Add assistant's message to the conversation
    messages.push(message as any);

    if (typeof message.content === 'string' && message.content.trim() && message.tool_calls && message.tool_calls.length > 0) {
      emit({ type: 'assistant_text', text: message.content });
    }

    if (choice.finish_reason !== 'tool_calls' && !message.tool_calls) {
      // Loop finished, no more tools to call
      return {
        content: message.content,
        messages,
        steps,
      };
    }

    // Handle tool calls
    if (message.tool_calls) {
      for (const rawToolCall of message.tool_calls) {
        if (rawToolCall.type !== 'function') continue;
        const toolCall = rawToolCall as Extract<typeof rawToolCall, { type: 'function' }>;
        const tool = getToolByName(toolCall.function.name);

        if (!tool) {
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify({ error: `Tool ${toolCall.function.name} not found or not allowed in this context.` })
          });
          emit({ type: 'tool_call_end', tool: toolCall.function.name, call_id: toolCall.id, ok: false, error: 'tool not found' });
          continue;
        }

        let parsedArgs: any;
        try {
          parsedArgs = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify({ error: 'Invalid JSON arguments.' })
          });
          emit({ type: 'tool_call_end', tool: toolCall.function.name, call_id: toolCall.id, ok: false, error: 'invalid args' });
          continue;
        }

        // Log raw args to diagnose model wrapping issues
        console.log(`[agent-loop] tool=${toolCall.function.name} raw_args=${JSON.stringify(parsedArgs)}`);

        // Auto-unwrap: some models (Gemini) wrap flat args inside a single nested object.
        // If the top-level has exactly one key whose value is an object containing the
        // expected fields, unwrap one level so the tool still works.
        parsedArgs = unwrapNestedArgs(parsedArgs, tool.inputSchema as any);

        // The user shouldn't be asked for file IDs — if a recent search receipt has them, use it.
        parsedArgs = autoResolveFileArgs(toolCall.function.name, parsedArgs, messages, latestUserText);

        const validation = tool.inputSchema.safeParse(parsedArgs);
        if (!validation.success) {
          const details = validation.error.issues
            .map((issue) => `${issue.path.join('.') || 'args'}: ${issue.message}`)
            .join('; ');
          const errorMessage = `Invalid arguments for ${toolCall.function.name}: ${details}`;
          emit({ type: 'tool_call_start', tool: toolCall.function.name, args: parsedArgs, call_id: toolCall.id });
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify({ ok: false, error: errorMessage })
          });
          emit({ type: 'tool_call_end', tool: toolCall.function.name, call_id: toolCall.id, ok: false, error: errorMessage });
          // Without this counter, a model that keeps calling a tool with invalid args
          // would loop forever because the success-side dedup below is never reached.
          const failSig = `${toolCall.function.name}:invalid:${JSON.stringify(parsedArgs)}`;
          const failCount = (toolSignatureCounts.get(failSig) || 0) + 1;
          toolSignatureCounts.set(failSig, failCount);
          if (failCount > 2) {
            const fallbackContent = buildFallbackContentFromToolMessages(messages)
              || 'Não consegui montar a chamada certa pra essa ferramenta. Tenta reformular dizendo o que quer fazer e qual arquivo.';
            return { content: fallbackContent, messages, steps };
          }
          continue;
        }
        parsedArgs = validation.data;

        const signature = `${toolCall.function.name}:${JSON.stringify(parsedArgs)}`;
        const repeatedCount = (toolSignatureCounts.get(signature) || 0) + 1;
        toolSignatureCounts.set(signature, repeatedCount);
        if (repeatedCount > 2) {
          if (
            toolCall.function.name === 'gmail.search_messages'
            && /\b(read|open|latest|newest|summari[sz]e|leia|ler|mais recente|conte[uú]do|resume|resuma)\b/i.test(latestUserText)
          ) {
            const messageId = latestGmailSearchMessageId(messages);
            if (messageId) {
              await executeToolCall('gmail.read_message', { message_id: messageId }, `auto-read-${Date.now()}`);
              const readFallbackContent = buildFallbackContentFromToolMessages(messages);
              if (readFallbackContent) return { content: readFallbackContent, messages, steps };
            }
          }
          const fallbackContent = buildFallbackContentFromToolMessages(messages);
          if (fallbackContent) {
            return { content: fallbackContent, messages, steps };
          }
        }

        await executeToolCall(toolCall.function.name, parsedArgs, toolCall.id);
      }
    }
  }

  // Max steps reached
  return {
    content: "I reached the maximum number of internal steps allowed for this operation. Here is what I have so far.",
    messages,
    steps,
  };
}
