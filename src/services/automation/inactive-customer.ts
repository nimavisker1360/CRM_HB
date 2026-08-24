import { ACTIVE_CUSTOMER_STATUSES } from "@/services/matching/matching.config";

export function inactiveCustomerBaseFilter(cutoff: Date): Record<string, unknown> {
  return {
    $and: [
      { status: { $in: ACTIVE_CUSTOMER_STATUSES } },
      {
        $or: [
          { lastActivityAt: { $lt: cutoff } },
          { lastActivityAt: { $exists: false }, lastContact: { $lt: cutoff } },
          { lastActivityAt: { $exists: false }, lastContact: { $exists: false }, updatedAt: { $lt: cutoff } },
        ],
      },
    ],
  };
}
