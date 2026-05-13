import { describe, expect, it, beforeAll } from 'vitest';
import { signUnsubscribeToken, verifyUnsubscribeToken } from '../token';

beforeAll(() => {
  process.env.ORDER_TOKEN_SECRET =
    'test-secret-must-be-32-chars-long-xyz';
});

describe('newsletter unsubscribe token', () => {
  it('roundtrips a valid email', () => {
    const t = signUnsubscribeToken('foo@example.com');
    expect(verifyUnsubscribeToken(t)).toBe('foo@example.com');
  });

  it('normalises case + whitespace at sign time', () => {
    const a = signUnsubscribeToken('  FOO@example.com  ');
    expect(verifyUnsubscribeToken(a)).toBe('foo@example.com');
  });

  it('rejects a tampered token', () => {
    const t = signUnsubscribeToken('foo@example.com');
    const parts = t.split('.');
    const bad = `${parts[0]}.AAAA${parts[1].slice(4)}`;
    expect(verifyUnsubscribeToken(bad)).toBeNull();
  });

  it('rejects a malformed token', () => {
    expect(verifyUnsubscribeToken('nope')).toBeNull();
    expect(verifyUnsubscribeToken('')).toBeNull();
    expect(verifyUnsubscribeToken('a.b.c')).toBeNull();
  });

  it("can't be reused across different emails", () => {
    const t = signUnsubscribeToken('foo@example.com');
    const parts = t.split('.');
    const otherEmail = Buffer.from('bar@example.com').toString('base64url');
    const swapped = `${otherEmail}.${parts[1]}`;
    expect(verifyUnsubscribeToken(swapped)).toBeNull();
  });
});
