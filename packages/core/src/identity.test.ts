import { describe, expect, it } from 'vitest';
import { assertActive, assertAdmin, assertInvitation, normalizeEmail, canAssign, assertAdminChange } from './identity';

describe('identity policy', () => {
  it('normalizes the email used by the unique constraint', () => {
    expect(normalizeEmail('  Person@Example.COM ')).toBe('person@example.com');
  });
  it('denies invited and inactive users regardless of admin flag', () => {
    for (const status of ['INVITED', 'DISABLED']) {
      expect(() => assertActive({ status })).toThrow();
      expect(() => assertAdmin({ status, isAdmin: true })).toThrow();
    }
    expect(() => assertAdmin({ status: 'ACTIVE', isAdmin: false })).toThrow();
    expect(() => assertAdmin({ status: 'ACTIVE', isAdmin: true })).not.toThrow();
  });
  it('rejects expired, consumed and revoked invitations', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const valid = { expiresAt: new Date(now.getTime() + 1), usedAt: null, revokedAt: null };
    expect(() => assertInvitation(valid, now)).not.toThrow();
    for (const invitation of [null, { ...valid, expiresAt: now }, { ...valid, usedAt: now }, { ...valid, revokedAt: now }]) {
      expect(() => assertInvitation(invitation, now)).toThrow();
    }
  });
  it('requires an active department and active user for assignments', () => {
    expect(canAssign('ACTIVE', true)).toBe(true);
    expect(canAssign('DISABLED', true)).toBe(false);
    expect(canAssign('INVITED', true)).toBe(false);
    expect(canAssign('ACTIVE', false)).toBe(false);
  });
  it('preserves the final active administrator', () => {
    const admin = { status: 'ACTIVE', isAdmin: true };
    expect(() => assertAdminChange(admin, { status: 'DISABLED', isAdmin: true }, 1)).toThrow();
    expect(() => assertAdminChange(admin, { status: 'ACTIVE', isAdmin: false }, 1)).toThrow();
    expect(() => assertAdminChange(admin, admin, 1)).not.toThrow();
    expect(() => assertAdminChange(admin, { status: 'DISABLED', isAdmin: true }, 2)).not.toThrow();
  });
});
