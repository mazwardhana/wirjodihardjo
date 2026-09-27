import { Prisma } from "@prisma/client";

export type AuditLogQueryParams = {
  q?: string | string[];
  action?: string | string[];
  entityType?: string | string[];
  dateFrom?: string | string[];
  dateTo?: string | string[];
  limit?: string | string[];
  page?: string | string[];
};

export type AuditLogQueryResult = {
  where: Prisma.AuditLogWhereInput;
  limit: number;
  page: number;
  offset: number;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  // Reject rollover dates such as 2026-02-30, which JS silently normalizes.
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

const LIMIT_OPTIONS = new Set([25, 50, 100]);

export function auditLogQuery(params: AuditLogQueryParams): AuditLogQueryResult {
  const q = first(params.q).trim();
  const action = first(params.action).trim();
  const entityType = first(params.entityType).trim();
  const dateFrom = first(params.dateFrom).trim();
  const dateTo = first(params.dateTo).trim();

  const where: Prisma.AuditLogWhereInput = {};

  if (q) {
    where.OR = [
      { actorLabel: { contains: q, mode: "insensitive" } },
      { entityId: { contains: q, mode: "insensitive" } },
      { actor: { email: { contains: q, mode: "insensitive" } } },
      { actor: { person: { fullName: { contains: q, mode: "insensitive" } } } },
    ];
  }
  if (action) where.action = action;
  if (entityType) where.entityType = entityType;

  const from = parseDate(dateFrom);
  const to = parseDate(dateTo);
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lt: new Date(to.getTime() + 24 * 60 * 60 * 1000) } : {}),
    };
  }

  const rawLimit = Number.parseInt(first(params.limit), 10);
  const limit = LIMIT_OPTIONS.has(rawLimit) ? rawLimit : 50;

  const rawPage = Number(first(params.page));
  const page = Number.isSafeInteger(rawPage) && rawPage >= 1 && rawPage <= 1_000_000 ? rawPage : 1;
  const offset = (page - 1) * limit;

  return { where, limit, page, offset };
}
