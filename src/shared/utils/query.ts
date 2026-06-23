import type { AnyColumn } from 'drizzle-orm';
import { asc, desc } from 'drizzle-orm';

export function getOrderBy(column: AnyColumn, order?: string) {
  return order === 'desc' ? desc(column) : asc(column);
}
