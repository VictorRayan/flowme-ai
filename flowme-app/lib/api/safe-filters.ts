export function ilikeAny(columns: readonly string[], value: string): string {
  const escaped = value.replace(/[\\"%_]/g, character => `\\${character}`);
  const pattern = `"%${escaped}%"`;
  return columns.map(column => {
    if (!/^[a-z_][a-z0-9_]*$/i.test(column)) throw new Error('Invalid search column');
    return `${column}.ilike.${pattern}`;
  }).join(',');
}

export function goalIdFilter(value: string): string | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return null;
  return `linked_goal_id.eq.${value},linked_goal_ids.cs.{${value}}`;
}
