import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/mongodb";
import { Agent, User } from "@/models";
import type { UserRole } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/session";

type UserRecord = {
  _id: unknown;
  email: string;
  name: string;
  passwordHash?: string;
  role: UserRole;
  status?: string;
};

type AgentRecord = {
  _id: unknown;
  email: string;
  fullName: string;
  isActive?: boolean;
  phone?: string;
  role?: UserRole;
  status?: string;
  user?: unknown;
  userId?: unknown;
};

type AgentUserProfile = {
  email: string;
  fullName: string;
  password?: string;
  phone?: string;
  role: UserRole;
  status: string;
};

async function findAgentForSessionUser(user: UserRecord) {
  return Agent.findOne({
    $or: [{ userId: user._id }, { user: user._id }, { email: user.email }],
    isActive: { $ne: false },
    status: { $ne: "SUSPENDED" },
  })
    .select("_id")
    .lean<{ _id: unknown }>();
}

function toSessionUser(user: UserRecord, agent?: { _id: unknown } | null): SessionUser {
  return {
    agentId: agent ? String(agent._id) : undefined,
    email: user.email,
    name: user.name,
    role: user.role,
    userId: String(user._id),
  };
}

export async function syncUserForAgentProfile(profile: AgentUserProfile, linkedUserId?: unknown) {
  await connectToDatabase();

  const email = profile.email.toLowerCase();
  const userUpdate: Record<string, unknown> = {
    email,
    name: profile.fullName,
    phone: profile.phone,
    role: profile.role,
    status: profile.status,
  };

  if (profile.password) {
    userUpdate.passwordHash = await bcrypt.hash(profile.password, 12);
  }

  const user = await User.findOneAndUpdate(
    linkedUserId ? { _id: linkedUserId } : { email },
    userUpdate,
    { returnDocument: "after", setDefaultsOnInsert: true, upsert: true },
  );

  return user;
}

export async function findSessionUser(userId: string): Promise<SessionUser | null> {
  await connectToDatabase();

  const user = await User.findById(userId).lean<UserRecord>();

  if (!user || user.status === "SUSPENDED") return null;

  const agent = await findAgentForSessionUser(user);

  return toSessionUser(user, agent);
}

export async function authenticateUser(email: string, password: string): Promise<SessionUser | null> {
  await connectToDatabase();

  const user = await User.findOne({ email: email.toLowerCase(), status: { $ne: "SUSPENDED" } }).lean<UserRecord>();

  if (!user?.passwordHash) return null;

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) return null;

  const agent = await findAgentForSessionUser(user);

  await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });

  return toSessionUser(user, agent);
}

export async function authenticateGoogleUser(email: string): Promise<SessionUser | null> {
  await connectToDatabase();

  const normalizedEmail = email.toLowerCase();
  let user = await User.findOne({ email: normalizedEmail, status: { $ne: "SUSPENDED" } }).lean<UserRecord>();

  if (!user) {
    const agent = await Agent.findOne({
      email: normalizedEmail,
      isActive: { $ne: false },
      status: { $ne: "SUSPENDED" },
    }).lean<AgentRecord>();

    if (!agent) return null;

    const syncedUser = await syncUserForAgentProfile({
      email: agent.email,
      fullName: agent.fullName,
      phone: agent.phone,
      role: agent.role || "AGENT",
      status: agent.status || "ACTIVE",
    });

    await Agent.updateOne({ _id: agent._id }, { user: syncedUser._id, userId: syncedUser._id });
    user = {
      _id: syncedUser._id,
      email: syncedUser.email,
      name: syncedUser.name,
      role: syncedUser.role,
      status: syncedUser.status,
    };
  }

  const agent = await findAgentForSessionUser(user);

  await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });

  return toSessionUser(user, agent);
}
