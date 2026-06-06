import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { uploadToR2 } from '@/lib/r2/storage';
import { defineTool } from './Tool';

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

function resolveAspectRatio(size?: '1024x1024' | '1536x1024' | '1024x1536'): '1:1' | '3:2' | '2:3' {
  if (size === '1536x1024') return '3:2';
  if (size === '1024x1536') return '2:3';
  return '1:1';
}

function noImageError(response: any): string {
  const candidate = response?.candidates?.[0];
  const text = candidate?.content?.parts
    ?.map((part: any) => part.text)
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  const details = [
    candidate?.finishReason ? `finishReason=${candidate.finishReason}` : '',
    candidate?.finishMessage ? `finishMessage="${String(candidate.finishMessage).slice(0, 300)}"` : '',
    response?.promptFeedback?.blockReason ? `promptBlock=${response.promptFeedback.blockReason}` : '',
    Array.isArray(candidate?.safetyRatings) && candidate.safetyRatings.length > 0
      ? `safety=${candidate.safetyRatings.map((item: any) => `${item.category}:${item.probability}`).join(',')}`
      : '',
    text ? `text="${text.slice(0, 240)}"` : '',
  ].filter(Boolean).join(' | ');
  return details ? `Gemini returned no image. ${details}` : 'Gemini returned no image.';
}

export function buildGeneratedImageKey(userId: string, imageId: string): string {
  return `users/${userId}/generated-images/${imageId.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

export function buildGeneratedImageUrl(key: string): string {
  return `/api/ai/images?key=${encodeURIComponent(key)}`;
}

export const imagesGenerateTool = defineTool({
  name: 'images.generate',
  description: `Generate an image from a text description and attach it to the Balys chat.

WHEN TO USE: the user asks to create, draw, illustrate, design, or generate an image, picture, visual, poster, cover, mockup, or wallpaper.

CONTRACT:
- prompt: describe the requested image clearly, preserving the user's intent and requested text.
- size: square, landscape, or portrait dimensions. Default square.
- Returns an image attachment for the chat. Confirm naturally after generation.`,
  isReadOnly: false,
  inputSchema: z.object({
    prompt: z.string().trim().min(2).max(32000).describe('Detailed text description of the image to generate.'),
    size: z.enum(['1024x1024', '1536x1024', '1024x1536']).optional().describe('Image dimensions. Default 1024x1024.'),
  }),
  call: async (args, context) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { ok: false, error: 'Gemini image generation is not configured.' };

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents: args.prompt,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: resolveAspectRatio(args.size),
          },
        },
      });
      const generated = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
      if (!generated?.data) return { ok: false, error: noImageError(response) };
      const mimeType = generated.mimeType || 'image/png';
      const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';

      const imageId = crypto.randomUUID();
      const key = buildGeneratedImageKey(context.user.id, `${imageId}.${extension}`);
      await uploadToR2({
        key,
        body: Buffer.from(generated.data, 'base64'),
        contentType: mimeType,
        metadata: {
          userId: context.user.id,
          source: 'balys-image-generation',
        },
      });

      return {
        ok: true,
        receipt: {
          message: 'Image generated successfully.',
          image: {
            type: 'image' as const,
            name: `balys-${imageId}.${extension}`,
            mimeType,
            url: buildGeneratedImageUrl(key),
          },
        },
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Failed to generate image.' };
    }
  },
});
