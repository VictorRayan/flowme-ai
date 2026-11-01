import { goalIdFilter, ilikeAny } from '@/lib/api/safe-filters';
import { cleanUntrustedText, untrustedToolResult } from '@/lib/ai/untrusted-content';
import fs from 'node:fs';
import path from 'node:path';

describe('security boundaries', () => {
  it('quotes PostgREST search values and escapes syntax and LIKE wildcards', () => {
    expect(ilikeAny(['title', 'content_text'], 'a,b)"%_\\')).toBe(
      'title.ilike."%a,b)\\"\\%\\_\\\\%",content_text.ilike."%a,b)\\"\\%\\_\\\\%"',
    );
    expect(() => ilikeAny(['title)'], 'x')).toThrow('Invalid search column');
  });

  it('rejects filter grammar in goal IDs', () => {
    expect(goalIdFilter('abc,linked_goal_id.not.is.null')).toBeNull();
    expect(goalIdFilter('7b90b913-625f-4da0-badc-dd29e9833593')).toBe(
      'linked_goal_id.eq.7b90b913-625f-4da0-badc-dd29e9833593,linked_goal_ids.cs.{7b90b913-625f-4da0-badc-dd29e9833593}',
    );
  });

  it('strips invisible controls and labels tool data as untrusted', () => {
    expect(cleanUntrustedText('ignore\u202E me\u200B\u{E0001}\nnow')).toBe('ignore me\nnow');
    const parsed = JSON.parse(untrustedToolResult({ ok: true, data: { text: 'hello\u200B' } }));
    expect(parsed.data.text).toBe('hello');
    expect(parsed.trust_boundary).toMatch(/UNTRUSTED_TOOL_DATA/);
  });

  it('enables RLS for every public table created by migrations', () => {
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
    const sql = fs.readdirSync(migrationsDir).filter(name => name.endsWith('.sql'))
      .map(name => fs.readFileSync(path.join(migrationsDir, name), 'utf8')).join('\n');
    const tables = [...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.([a-z_][a-z_0-9]*)/gi)]
      .map(match => match[1]);
    const protectedTables = new Set([...sql.matchAll(/ALTER\s+TABLE\s+public\.([a-z_][a-z_0-9]*)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi)]
      .map(match => match[1]));
    expect(tables.filter(table => !protectedTables.has(table))).toEqual([]);
  });

  it('keeps every service-role API-key route scoped to its authenticated owner', () => {
    const routesDir = path.join(process.cwd(), 'app', 'api', 'v1');
    const visit = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
      const filename = path.join(dir, entry.name);
      return entry.isDirectory() ? visit(filename) : entry.name === 'route.ts' ? [filename] : [];
    });
    const unscoped = visit(routesDir).filter(filename => {
      const source = fs.readFileSync(filename, 'utf8');
      return source.includes('requireApiKeyAuth') && !source.includes(".eq('user_id', userId)");
    });
    expect(unscoped).toEqual([]);
  });
});
