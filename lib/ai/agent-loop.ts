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
  provider: 'openai' | 'gemini' | 'deepseek' | string;
  model: string;
  context: ToolContext;
  threadId: string;
  onProgress?: (event: AgentProgressEvent) => void;
};

// Map Zod schemas to JSON schema for the OpenAI tools parameter
function mapToolsToOpenAI(tools: Tool[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.inputSchema as any) as any,
    }
  }));
}

export async function runBalysAgentLoop(options: AgentLoopOptions) {
  let steps = 0;
  const messages = [...options.messages];
  const availableTools = mapToolsToOpenAI(options.tools);

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

  const maxSteps = Math.min(options.maxSteps, 8); // Enforce flexible limit up to 8

  const emit = (event: AgentProgressEvent) => {
    try { options.onProgress?.(event); } catch (e) { console.error('[agent-loop] onProgress threw', e); }
  };

  while (steps < maxSteps) {
    steps++;
    emit({ type: 'step_start', step: steps });

    const response = await openai.chat.completions.create({
      model: options.model,
      messages: messages as any,
      tools: availableTools.length > 0 ? availableTools : undefined,
      tool_choice: availableTools.length > 0 ? 'auto' : 'none',
      temperature: 0.2,
    });

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

        emit({ type: 'tool_call_start', tool: toolCall.function.name, args: parsedArgs, call_id: toolCall.id });

        // Execute Tool
        let status: 'success' | 'error' = 'success';
        let resultJson: any = null;
        let errorMessage: string | null = null;
        let receiptJson: any = null;

        try {
          const result = await tool.call(parsedArgs, options.context);
          if (result.ok) {
            resultJson = result.data || result.receipt || { success: true };
            receiptJson = result.receipt || null;

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify({ ok: true, receipt: receiptJson, data: result.data })
            });
            emit({ type: 'tool_call_end', tool: toolCall.function.name, call_id: toolCall.id, ok: true, receipt: receiptJson });
          } else {
            status = 'error';
            errorMessage = result.error || 'Unknown error';
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify({ ok: false, error: errorMessage })
            });
            emit({ type: 'tool_call_end', tool: toolCall.function.name, call_id: toolCall.id, ok: false, error: errorMessage });
          }
        } catch (e: any) {
          status = 'error';
          errorMessage = e.message;
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify({ ok: false, error: errorMessage })
          });
          emit({ type: 'tool_call_end', tool: toolCall.function.name, call_id: toolCall.id, ok: false, error: errorMessage || 'exception' });
        }

        // Log to ai_tool_runs (The Operation Ledger)
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
