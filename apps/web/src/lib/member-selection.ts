type PeoplePage<T> = { items: T[]; total: number; page: number };

// Read the existing paginated endpoints only when the picker is opened.
export async function loadPeople<T extends { id: string }>(read: (page: number) => Promise<PeoplePage<T>>): Promise<T[]> {
  const first = await read(1);
  if (!first.total) return [];
  if (!first.items.length) throw new Error('Recarregue a lista de pessoas.');
  const items = [...first.items];
  const pages = Math.ceil(first.total / first.items.length);
  for (let page = 2; page <= pages; page++) {
    const next = await read(page);
    if (!next.items.length) throw new Error('Recarregue a lista de pessoas.');
    items.push(...next.items);
  }
  return [...new Map(items.map(item => [item.id, item])).values()];
}

export function toggleVisible(selected: string[], visible: string[]): string[] {
  const current = new Set(selected);
  const all = visible.length > 0 && visible.every(id => current.has(id));
  for (const id of visible) {
    if (all) current.delete(id); else current.add(id);
  }
  return [...current];
}

export async function addSelected(selected: string[], save: (id: string) => Promise<unknown>) {
  const ids = [...new Set(selected)];
  const added: string[] = [];
  for (const id of ids) {
    try { await save(id); added.push(id); }
    catch (error) {
      return { added, remaining: ids.slice(added.length), error: error instanceof Error ? error.message : 'Falha de conexão.' };
    }
  }
  return { added, remaining: [], error: '' };
}
