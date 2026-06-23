import { and, eq, ilike, or } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

export function buildLookupListConditions(
  query: { search?: string | undefined; isActive?: boolean | undefined },
  cols: { code: AnyPgColumn; name: AnyPgColumn; isActive: AnyPgColumn }
) {
  const conditions: (ReturnType<typeof eq> | ReturnType<typeof or> | undefined)[] = [];

  if (query.search) {
    conditions.push(
      or(ilike(cols.code, `%${query.search}%`), ilike(cols.name, `%${query.search}%`))
    );
  }

  if (query.isActive !== undefined) {
    conditions.push(eq(cols.isActive, query.isActive));
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}
