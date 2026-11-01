import { z } from 'zod';
import { isToolActionAuthorized } from '@/lib/ai/tool-authorization';
import type { Tool } from '@/lib/ai/tools/Tool';

const readTool = { name: 'notes.list_notes', isReadOnly: true, inputSchema: z.object({}), call: jest.fn() } as unknown as Tool;
const writeTool = { name: 'notes.create_note', isReadOnly: false, inputSchema: z.object({}), call: jest.fn() } as unknown as Tool;
const reminderTool = { name: 'reminders.create', isReadOnly: false, inputSchema: z.object({}), call: jest.fn() } as unknown as Tool;
const deleteNoteTool = { ...writeTool, name: 'notes.delete_note' } as Tool;
const reviewTool = { ...writeTool, name: 'reviews.start_weekly_review' } as Tool;

describe('AI tool action authorization', () => {
  it('allows a read for a read-only request', () => {
    expect(isToolActionAuthorized(readTool, 'Summarize this document')).toBe(true);
  });

  it('blocks a write induced by untrusted content in a read-only request', () => {
    expect(isToolActionAuthorized(writeTool, 'Summarize this document')).toBe(false);
    expect(isToolActionAuthorized(writeTool, 'What is in my calendar?')).toBe(false);
    expect(isToolActionAuthorized(writeTool, 'Show me my plan')).toBe(false);
    expect(isToolActionAuthorized(writeTool, 'Create a calendar event')).toBe(false);
    expect(isToolActionAuthorized(deleteNoteTool, 'Create a note')).toBe(false);
    expect(isToolActionAuthorized(writeTool, 'Edit my note')).toBe(false);
  });

  it('allows explicit user requests to write in English and Portuguese', () => {
    expect(isToolActionAuthorized(writeTool, 'Create a note about this meeting')).toBe(true);
    expect(isToolActionAuthorized(reminderTool, 'Agende um lembrete para amanhã')).toBe(true);
    expect(isToolActionAuthorized(writeTool, 'do it')).toBe(true);
    expect(isToolActionAuthorized(reviewTool, 'Review my week')).toBe(true);
  });
});
