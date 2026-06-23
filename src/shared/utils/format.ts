export function formatDateTime(d: Date | null): string {
  return d ? d.toISOString() : '';
}
