import { z } from 'zod';

export type ToolContext = {
  supabase: any;
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
    identities?: Array<{ identity_data?: Record<string, unknown> | null }> | null;
  };
  timezone: string;
  nowIso: string;
  threadId?: string;
  onProgress?: (event: { type: string; [key: string]: unknown }) => void;
};

export type ToolResult<T = unknown> = {
  ok: boolean;
  receipt?: T;
  error?: string;
  data?: unknown;
};

export interface Tool<InputSchema extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  inputSchema: InputSchema;
  isReadOnly: boolean;
  call: (args: z.infer<InputSchema>, context: ToolContext) => Promise<ToolResult>;
}

export function defineTool<S extends z.ZodTypeAny>(tool: Tool<S>): Tool<S> {
  return tool;
}
