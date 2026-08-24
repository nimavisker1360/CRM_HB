import bcrypt from "bcryptjs";
import nextEnv from "@next/env";
import mongoose from "mongoose";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;

if (process.env.NODE_ENV === "production") {
  throw new Error("Seed script is disabled in production.");
}

if (!uri) {
  throw new Error("MONGODB_URI or DATABASE_URL is required.");
}

await mongoose.connect(uri, { bufferCommands: false });

const userSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true },
    name: String,
    passwordHash: String,
    phone: String,
    role: String,
    status: String,
  },
  { timestamps: true },
);
const agentSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true },
    fullName: String,
    isActive: Boolean,
    languages: [String],
    name: String,
    phone: String,
    role: String,
    specializedCities: [String],
    specializedDistricts: [String],
    status: String,
    user: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId,
  },
  { timestamps: true },
);
const projectSchema = new mongoose.Schema(
  {
    citizenshipSuitable: Boolean,
    city: String,
    deliveryDate: Date,
    description: String,
    developer: String,
    district: String,
    facilities: [String],
    name: String,
    paymentPlan: String,
    residenceSuitable: Boolean,
    status: String,
  },
  { timestamps: true },
);
const propertySchema = new mongoose.Schema(
  {
    assignedAgentId: mongoose.Schema.Types.ObjectId,
    bathrooms: Number,
    city: String,
    currency: String,
    district: String,
    grossArea: Number,
    price: Number,
    projectId: mongoose.Schema.Types.ObjectId,
    propertyCode: { type: String, unique: true },
    propertyType: String,
    rooms: Number,
    status: String,
    title: String,
    transactionType: String,
  },
  { timestamps: true },
);
const customerSchema = new mongoose.Schema(
  {
    assignedAgentId: mongoose.Schema.Types.ObjectId,
    currency: String,
    fullName: String,
    interestedCity: String,
    interestedDistrict: String,
    maxBudget: Number,
    maxRooms: Number,
    phone: String,
    propertyType: String,
    source: String,
    status: String,
    transactionType: String,
  },
  { timestamps: true },
);
const followUpSchema = new mongoose.Schema(
  {
    agentId: mongoose.Schema.Types.ObjectId,
    customerId: mongoose.Schema.Types.ObjectId,
    dueAt: Date,
    note: String,
    scheduledAt: Date,
    status: String,
    type: String,
  },
  { timestamps: true },
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Agent = mongoose.models.Agent || mongoose.model("Agent", agentSchema);
const Project = mongoose.models.Project || mongoose.model("Project", projectSchema);
const Property = mongoose.models.Property || mongoose.model("Property", propertySchema);
const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema);
const FollowUp = mongoose.models.FollowUp || mongoose.model("FollowUp", followUpSchema);

async function upsertUserAndAgent({ email, fullName, phone, role }) {
  const passwordHash = await bcrypt.hash(role === "ADMIN" ? "Admin123!" : "Agent123!", 12);
  const user = await User.findOneAndUpdate(
    { email },
    { email, name: fullName, passwordHash, phone, role, status: "ACTIVE" },
    { returnDocument: "after", setDefaultsOnInsert: true, upsert: true },
  );
  const agent = await Agent.findOneAndUpdate(
    { email },
    {
      email,
      fullName,
      isActive: true,
      languages: ["Turkish", "English"],
      name: fullName,
      phone,
      role,
      specializedCities: ["Istanbul"],
      specializedDistricts: ["Bagcilar", "Kadikoy"],
      status: "ACTIVE",
      user: user._id,
      userId: user._id,
    },
    { returnDocument: "after", setDefaultsOnInsert: true, upsert: true },
  );

  return { agent, user };
}

await upsertUserAndAgent({
  email: "admin@hbrealstate.com",
  fullName: "Admin HB",
  phone: "+90 555 000 0000",
  role: "ADMIN",
});
const mehmet = await upsertUserAndAgent({
  email: "mehmet@hbrealstate.com",
  fullName: "Mehmet Kaya",
  phone: "+90 555 111 1111",
  role: "AGENT",
});
await upsertUserAndAgent({
  email: "ali@hbrealstate.com",
  fullName: "Ali Demir",
  phone: "+90 555 222 2222",
  role: "AGENT",
});

const project = await Project.findOneAndUpdate(
  { name: "Makyol Santral" },
  {
    citizenshipSuitable: true,
    city: "Istanbul",
    deliveryDate: new Date("2027-12-01"),
    description: "Mixed-use residential project in Istanbul.",
    developer: "Makyol",
    district: "Bagcilar",
    facilities: ["Pool", "Parking", "Gym"],
    name: "Makyol Santral",
    paymentPlan: "50% down payment, 24 months installments",
    residenceSuitable: true,
    status: "ACTIVE",
  },
  { returnDocument: "after", setDefaultsOnInsert: true, upsert: true },
);

await Property.findOneAndUpdate(
  { propertyCode: "HB-MAK-3-1" },
  {
    assignedAgentId: mehmet.agent._id,
    bathrooms: 2,
    city: "Istanbul",
    currency: "TRY",
    district: "Bagcilar",
    grossArea: 177,
    price: 7500000,
    projectId: project._id,
    propertyCode: "HB-MAK-3-1",
    propertyType: "APARTMENT",
    rooms: 3,
    status: "ACTIVE",
    title: "Makyol Santral 3+1",
    transactionType: "SALE",
  },
  { returnDocument: "after", setDefaultsOnInsert: true, upsert: true },
);

const customer = await Customer.findOneAndUpdate(
  { phone: "+90 555 333 3333" },
  {
    assignedAgentId: mehmet.agent._id,
    currency: "TRY",
    fullName: "Ahmet Yılmaz",
    interestedCity: "Istanbul",
    interestedDistrict: "Bagcilar",
    maxBudget: 8000000,
    maxRooms: 3,
    phone: "+90 555 333 3333",
    propertyType: "APARTMENT",
    source: "Manual",
    status: "NEW_LEAD",
    transactionType: "SALE",
  },
  { returnDocument: "after", setDefaultsOnInsert: true, upsert: true },
);

await FollowUp.findOneAndUpdate(
  { customerId: customer._id, type: "WHATSAPP" },
  {
    agentId: mehmet.agent._id,
    customerId: customer._id,
    dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    note: "Send Makyol project details",
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: "PENDING",
    type: "WHATSAPP",
  },
  { returnDocument: "after", setDefaultsOnInsert: true, upsert: true },
);

console.log("Seed completed.");
console.log("Admin: admin@hbrealstate.com / Admin123!");
console.log("Agents use / Agent123!");

await mongoose.disconnect();
