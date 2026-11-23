import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { isOverdue, deadlineLabel } from './time.js';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-03-05T10:00:00Z')); });
afterEach(() => vi.useRealTimers());

describe('isOverdue', () => {
  it('is true for past dates only', () => {
    expect(isOverdue('2026-03-05T09:59:59Z')).toBe(true);
    expect(isOverdue('2026-03-05T10:00:01Z')).toBe(false);
  });
  it('is false for empty values', () => { expect(isOverdue(null)).toBe(false); expect(isOverdue(undefined)).toBe(false); expect(isOverdue('')).toBe(false); });
});

describe('deadlineLabel', () => {
  it('dash for empty', () => expect(deadlineLabel(null)).toBe('—'));
  it('overdue', () => expect(deadlineLabel('2026-03-05T09:00:00Z')).toBe('મર્યાદા વટાવી'));
  it('rounds hours up under a day', () => {
    expect(deadlineLabel('2026-03-05T10:30:00Z')).toBe('1 કલાક બાકી');
    expect(deadlineLabel('2026-03-05T20:00:00Z')).toBe('10 કલાક બાકી');
    expect(deadlineLabel('2026-03-06T09:00:00Z')).toBe('23 કલાક બાકી');
  });
  it('switches to days from 24 hours', () => {
    expect(deadlineLabel('2026-03-06T10:00:00Z')).toBe('1 દિવસ બાકી');
    expect(deadlineLabel('2026-03-06T10:30:00Z')).toBe('2 દિવસ બાકી');
    expect(deadlineLabel('2026-03-10T10:00:00Z')).toBe('5 દિવસ બાકી');
  });
});
