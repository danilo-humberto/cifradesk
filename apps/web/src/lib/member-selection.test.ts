import { describe, expect, it, vi } from 'vitest';
import { loadPeople, toggleVisible, addSelected } from './member-selection';

describe('seleção de integrantes', () => {
  it('carrega todas as páginas e remove duplicados', async () => {
    const read = vi.fn().mockResolvedValueOnce({ items: [{ id: 'a' }, { id: 'b' }], total: 4, page: 1 })
      .mockResolvedValueOnce({ items: [{ id: 'b' }, { id: 'c' }], total: 4, page: 2 });
    expect(await loadPeople(read)).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    expect(read.mock.calls).toEqual([[1], [2]]);
  });
  it('não apresenta carga parcial como lista completa', async () => {
    const read = vi.fn().mockResolvedValueOnce({ items: [{ id: 'a' }], total: 2, page: 1 })
      .mockResolvedValueOnce({ items: [], total: 2, page: 2 });
    await expect(loadPeople(read)).rejects.toThrow('Recarregue');
  });
  it('marca e desmarca resultados preservando seleções fora da busca', () => {
    expect(toggleVisible(['outside', 'a'], ['a', 'b'])).toEqual(['outside', 'a', 'b']);
    expect(toggleVisible(['outside', 'a', 'b'], ['a', 'b'])).toEqual(['outside']);
    expect(toggleVisible(['outside'], [])).toEqual(['outside']);
  });
  it('interrompe no primeiro erro e preserva falha e pendentes para nova tentativa', async () => {
    const save = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Limite atingido'));
    expect(await addSelected(['a', 'b', 'c'], save)).toEqual({ added: ['a'], remaining: ['b', 'c'], error: 'Limite atingido' });
    expect(save.mock.calls).toEqual([['a'], ['b']]);
  });
  it('conclui todas as inclusões sem reenviar IDs duplicados', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    expect(await addSelected(['a', 'a', 'b'], save)).toEqual({ added: ['a', 'b'], remaining: [], error: '' });
    expect(save).toHaveBeenCalledTimes(2);
  });
});
