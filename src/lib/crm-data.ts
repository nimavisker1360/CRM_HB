import { connectToDatabase } from "@/lib/mongodb";
import { Agent, Customer, FollowUp, ImportJob, Property, PropertyMatch } from "@/models";
import { getBusinessTodayBounds } from "@/services/automation/automation-date";
import type { AgentScope } from "@/lib/auth/agent-scope";
import { agentScopeFilter } from "@/lib/auth/agent-scope";

export type DashboardStats = {
  activeProperties: number;
  agents: number;
  customers: number;
  followUpsToday: number;
  inactiveCustomers: number;
  interestedMatches: number;
  meetingMatches: number;
  newLeads: number;
  newMatches: number;
  overdueFollowUps: number;
  pendingAutomationItems: number;
  pendingImports: number;
  properties: number;
};

export async function getDashboardStats(scope?: AgentScope): Promise<DashboardStats> {
  try {
    await connectToDatabase();
    const today = getBusinessTodayBounds();
    const customerScope = agentScopeFilter(scope || companyScope(), "assignedAgentId");
    const followUpScope = agentScopeFilter(scope || companyScope(), "agentId");
    const matchScope = agentScopeFilter(scope || companyScope(), "agentId");

    const [
      activeProperties,
      agents,
      customers,
      followUpsToday,
      inactiveCustomers,
      interestedMatches,
      meetingMatches,
      newLeads,
      newMatches,
      overdueFollowUps,
      pendingCustomers,
      pendingImports,
      pendingProperties,
      properties,
    ] = await Promise.all([
      Property.countDocuments({ status: "ACTIVE" }),
      Agent.countDocuments({}),
      Customer.countDocuments(customerScope),
      FollowUp.countDocuments({
        ...followUpScope,
        status: { $in: ["PENDING", "OPEN"] },
        $or: [
          { scheduledAt: { $gte: today.start, $lt: today.end } },
          { scheduledAt: { $exists: false }, dueAt: { $gte: today.start, $lt: today.end } },
        ],
      }),
      Customer.countDocuments({ ...customerScope, lastActivityAt: { $lt: inactiveCutoff() } }),
      PropertyMatch.countDocuments({ ...matchScope, status: "INTERESTED" }),
      PropertyMatch.countDocuments({ ...matchScope, status: "MEETING" }),
      Customer.countDocuments({ ...customerScope, status: "NEW_LEAD" }),
      PropertyMatch.countDocuments({ ...matchScope, status: "NEW" }),
      FollowUp.countDocuments({
        ...followUpScope,
        status: { $in: ["PENDING", "OPEN", "OVERDUE"] },
        $or: [{ scheduledAt: { $lt: new Date() } }, { scheduledAt: { $exists: false }, dueAt: { $lt: new Date() } }],
      }),
      Customer.countDocuments({ matchingPending: true }),
      ImportJob.countDocuments({
        matchingPending: true,
        $or: [
          { matchingStatus: { $in: ["PENDING", "PROCESSING", "PARTIAL", "FAILED"] } },
          { matchingStatus: { $exists: false } },
        ],
      }),
      Property.countDocuments({ matchingPending: true, status: "ACTIVE" }),
      Property.countDocuments({}),
    ]);

    return {
      activeProperties,
      agents,
      customers,
      followUpsToday,
      inactiveCustomers,
      interestedMatches,
      meetingMatches,
      newLeads,
      newMatches,
      overdueFollowUps,
      pendingAutomationItems: pendingCustomers + pendingImports + pendingProperties,
      pendingImports,
      properties,
    };
  } catch {
    return {
      activeProperties: 0,
      agents: 0,
      customers: 0,
      followUpsToday: 0,
      inactiveCustomers: 0,
      interestedMatches: 0,
      meetingMatches: 0,
      newLeads: 0,
      newMatches: 0,
      overdueFollowUps: 0,
      pendingAutomationItems: 0,
      pendingImports: 0,
      properties: 0,
    };
  }
}

export async function getTopMatchesToday(limit = 5, scope?: AgentScope) {
  try {
    await connectToDatabase();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    return PropertyMatch.find({ ...agentScopeFilter(scope || companyScope(), "agentId"), createdAt: { $gte: start, $lt: end }, status: { $ne: "ARCHIVED" } })
      .sort({ score: -1, createdAt: -1 })
      .limit(limit)
      .populate("customerId", "fullName")
      .populate("propertyId", "title")
      .lean();
  } catch {
    return [];
  }
}

export async function getRecentCustomers(limit = 5, scope?: AgentScope) {
  try {
    await connectToDatabase();

    return Customer.find(agentScopeFilter(scope || companyScope(), "assignedAgentId"))
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("fullName whatsapp status source maxBudget currency createdAt")
      .lean();
  } catch {
    return [];
  }
}

export async function getRecentProperties(limit = 5) {
  try {
    await connectToDatabase();

    return Property.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("propertyCode title city district status price currency createdAt")
      .lean();
  } catch {
    return [];
  }
}

export async function getTodayFollowUps(limit = 5, scope?: AgentScope) {
  try {
    await connectToDatabase();
    const today = getBusinessTodayBounds();

    return FollowUp.find({
      ...agentScopeFilter(scope || companyScope(), "agentId"),
      status: { $in: ["PENDING", "OPEN"] },
      $or: [
        { scheduledAt: { $gte: today.start, $lt: today.end } },
        { scheduledAt: { $exists: false }, dueAt: { $gte: today.start, $lt: today.end } },
      ],
    })
      .sort({ scheduledAt: 1, dueAt: 1 })
      .limit(limit)
      .populate("customerId", "fullName phone")
      .populate("agentId", "fullName name")
      .lean();
  } catch {
    return [];
  }
}

export async function getDashboardAgents() {
  try {
    await connectToDatabase();
    return Agent.find({ isActive: { $ne: false } }).sort({ fullName: 1, name: 1 }).select("fullName name email").lean();
  } catch {
    return [];
  }
}

export async function getDashboardAgentProfile(agentId?: string) {
  if (!agentId) return null;
  try {
    await connectToDatabase();
    return Agent.findById(agentId).select("avatarDataUrl fullName name email").lean();
  } catch {
    return null;
  }
}

function companyScope(): AgentScope {
  return {
    currentRole: "ADMIN",
    currentUserId: "system",
    isAdminViewingAgent: false,
  };
}

function inactiveCutoff() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date;
}
