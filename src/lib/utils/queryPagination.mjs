export const ISSUE_QUERY_PAGE_SIZE = 100;
export const ANALYTICS_QUERY_PAGE_SIZE = 100;
export const SPRINT_QUERY_PAGE_SIZE = 50;
export const COLUMN_RENDER_PAGE_SIZE = 40;

export function nextQueryLimit(currentLimit, pageSize) {
  const normalizedPageSize = Math.max(1, Math.trunc(Number(pageSize) || 1));
  const normalizedCurrent = Math.max(normalizedPageSize, Math.trunc(Number(currentLimit) || 0));
  return normalizedCurrent + normalizedPageSize;
}
