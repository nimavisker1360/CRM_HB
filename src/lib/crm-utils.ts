import { Types } from "mongoose";

export const PAGE_SIZE = 20;

export type Pagination = {
  limit: number;
  page: number;
  pages: number;
  total: number;
};

export function getPagination(searchParams: URLSearchParams) {
  const page = Math.max(Number(searchParams.get("page") || "1"), 1);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") || String(PAGE_SIZE)), 1), 100);
  const skip = (page - 1) * limit;

  return { limit, page, skip };
}

export function paginationMeta(total: number, page: number, limit: number): Pagination {
  return {
    limit,
    page,
    pages: Math.max(Math.ceil(total / limit), 1),
    total,
  };
}

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function objectIdOrUndefined(value?: string | null) {
  if (!value || !Types.ObjectId.isValid(value)) return undefined;
  return new Types.ObjectId(value);
}

export function cleanObject<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (value === "" || value === undefined || value === null) return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    }),
  ) as Partial<T>;
}

export function dateRangeForDay(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { end, start };
}
