import { z } from 'zod';
import { FeatureLockedError, requireFeature, type FeatureKey } from '@/lib/billing/entitlements';

export type UserLocation = {
  lat: number;
  lon: number;
  name?: string;
};

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
  requestId?: string;
  preferredConnectorType?: 'gmail' | 'google_drive' | 'google_docs' | 'google_sheets';
  userLocation?: UserLocation;
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

export function defineFeatureTool<S extends z.ZodTypeAny>(
  feature: FeatureKey,
  lockedMessage: string,
  tool: Tool<S>,
): Tool<S> {
  return defineTool({
    ...tool,
    call: async (args, context) => {
      try {
        await requireFeature(context.supabase, context.user.id, feature);
      } catch (error: unknown) {
        if (error instanceof FeatureLockedError) {
          return {
            ok: false,
            error: lockedMessage,
            data: {
              code: 'FEATURE_LOCKED',
              required_plan: error.required_plan,
              feature_key: error.feature,
              checkout_available: true,
            },
          };
        }
        throw error;
      }
      return tool.call(args, context);
    },
  });
}
