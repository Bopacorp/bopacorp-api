import { describe, expect, it } from 'vitest';
import {
  buildLookupListConditions,
  getLookupOrderBy,
  isValidImageBody,
} from './catalog.helpers.js';

const columns = {
  code: { name: 'code' },
  name: { name: 'name' },
  isActive: { name: 'is_active' },
};

describe('catalog helpers', () => {
  it('builds no lookup condition when no filters are supplied', () => {
    expect(buildLookupListConditions({}, columns)).toBeUndefined();
  });

  it('builds search and active lookup conditions', () => {
    const condition = buildLookupListConditions({ search: 'voice', isActive: false }, columns);

    expect(condition).toBeDefined();
    expect(JSON.stringify(condition)).toContain('voice');
    expect(JSON.stringify(condition)).toContain('false');
  });

  it('selects lookup sort columns and direction with a safe fallback', () => {
    expect(getLookupOrderBy(columns, 'name', 'asc')).toBeDefined();
    expect(getLookupOrderBy(columns, 'code', 'desc')).toBeDefined();
    expect(getLookupOrderBy(columns, 'unknown', 'desc')).toBeDefined();
    expect(getLookupOrderBy(columns, undefined, undefined)).toBeDefined();
  });

  it.each([
    [undefined, true],
    [null, true],
    ['', true],
    ['https://cdn.example.test/image.png', true],
    ['http://cdn.example.test/image.png', true],
    ['ftp://cdn.example.test/image.png', false],
    ['not-a-url', false],
  ])('validates image body %s as %s', (body, expected) => {
    expect(isValidImageBody(body)).toBe(expected);
  });
});
