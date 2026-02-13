import { describe, expect, it } from '@jest/globals';
import {
  decodeAuditCursor,
  encodeAuditCursor,
  normalizeAuditPageLimit,
  sliceAuditLogsPage,
  sortAuditLogsByCreatedAtDesc,
} from '../auditLogPagination.util.js';

describe('auditLogPagination util', () => {
  it('normalizes limits within allowed bounds', () => {
    expect(normalizeAuditPageLimit(undefined)).toBe(100);
    expect(normalizeAuditPageLimit('25')).toBe(25);
    expect(normalizeAuditPageLimit('999')).toBe(500);
  });

  it('round-trips encoded cursor values', () => {
    const source = {
      id: 'log-1',
      createdAt: '2026-02-12T10:30:00.000Z',
    };
    const encoded = encodeAuditCursor(source);
    const decoded = decodeAuditCursor(encoded);
    expect(decoded).toEqual({
      id: 'log-1',
      createdAt: '2026-02-12T10:30:00.000Z',
    });
  });

  it('returns null for invalid cursors', () => {
    expect(decodeAuditCursor('not-a-valid-cursor')).toBeNull();
    expect(decodeAuditCursor('')).toBeNull();
    expect(decodeAuditCursor(null)).toBeNull();
  });

  it('sorts logs by createdAt desc with id tiebreaker', () => {
    const sorted = sortAuditLogsByCreatedAtDesc([
      { id: 'a', createdAt: '2026-02-12T10:30:00.000Z' },
      { id: 'c', createdAt: '2026-02-12T10:31:00.000Z' },
      { id: 'b', createdAt: '2026-02-12T10:30:00.000Z' },
    ]);
    expect(sorted.map((item) => item.id)).toEqual(['c', 'b', 'a']);
  });

  it('builds a page response with next cursor', () => {
    const page = sliceAuditLogsPage([
      { id: '3', createdAt: '2026-02-12T10:32:00.000Z' },
      { id: '2', createdAt: '2026-02-12T10:31:00.000Z' },
      { id: '1', createdAt: '2026-02-12T10:30:00.000Z' },
    ], 2);

    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    expect(typeof page.nextCursor).toBe('string');
    expect(page.nextCursor.length).toBeGreaterThan(0);
  });
});
