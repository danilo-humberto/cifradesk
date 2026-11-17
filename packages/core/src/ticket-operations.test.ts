import { describe, expect, it } from 'vitest';
import { assertTicketTransition, assertTicketDueDate } from './ticket-operations';

describe('ticket operation rules', () => {
  it('requires reasons, guidance, solution and eligible assignees', () => {
    for (const [from, to] of [['OPEN', 'CLOSED'], ['CLOSED', 'PENDING'], ['OPEN', 'BLOCKED']])
      expect(() => assertTicketTransition(from!, to!, 1, {})).toThrow();
    for (const to of ['IN_PROGRESS', 'REVIEW', 'DONE'])
      expect(() => assertTicketTransition('OPEN', to, 0, { solution: 'resolvido', reviewGuidance: 'verificar' })).toThrow();
    expect(() => assertTicketTransition('OPEN', 'REVIEW', 1, {})).toThrow();
    expect(() => assertTicketTransition('OPEN', 'DONE', 1, {})).toThrow();
    expect(() => assertTicketTransition('DONE', 'CLOSED', 1, {})).not.toThrow();
  });
  it('allows all distinct status pairs with the required data', () => {
    const statuses = ['OPEN', 'PENDING', 'IN_PROGRESS', 'DONE', 'REVIEW', 'BLOCKED', 'CLOSED'];
    for (const from of statuses) for (const to of statuses) if (from !== to)
      expect(() => assertTicketTransition(from, to, 1, { reason: 'motivo', solution: 'solução', reviewGuidance: 'orientação' })).not.toThrow();
  });
  it('uses the Sao Paulo calendar at the UTC day boundary', () => {
    const now = new Date('2026-11-14T01:00:00Z');
    expect(() => assertTicketDueDate('2026-11-13', now)).not.toThrow();
    expect(() => assertTicketDueDate('2026-11-12', now)).toThrow();
    expect(() => assertTicketDueDate(null, now)).not.toThrow();
  });
});
