import type { AnyColumn } from 'drizzle-orm';
import { asc, desc } from 'drizzle-orm';

export function formatDateTime(d: Date | null): string {
  return d ? d.toISOString() : '';
}

export function getOrderBy(column: AnyColumn, order: 'asc' | 'desc') {
  return order === 'desc' ? desc(column) : asc(column);
}
