import { z } from "zod";
import { USER_ROLES } from "@/lib/auth/roles";

const optionalString = z.string().trim().optional().or(z.literal(""));
const csvArray = z
  .union([z.array(z.string()), z.string()])
  .optional()
  .transform((value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  });
const optionalDate = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.date().optional(),
);

export const propertySchema = z.object({
  title: z.string().trim().min(1).max(160),
  propertyCode: z.string().trim().min(1).max(60),
  description: optionalString,
  transactionType: z.enum(["SALE", "RENT"]),
  propertyType: z.enum(["APARTMENT", "VILLA", "LAND", "COMMERCIAL", "OFFICE", "SHOP"]),
  status: z.enum(["ACTIVE", "RESERVED", "SOLD", "RENTED", "PASSIVE"]).default("ACTIVE"),
  projectId: optionalString,
  assignedAgentId: optionalString,
  city: z.string().trim().min(1).max(80),
  district: z.string().trim().max(80).optional(),
  neighborhood: optionalString,
  address: z.string().trim().max(240).optional(),
  price: z.coerce.number().nonnegative().default(0),
  currency: z.enum(["TRY", "USD", "EUR", "GBP"]).default("TRY"),
  rooms: z.coerce.number().nonnegative().optional(),
  bedrooms: z.coerce.number().int().nonnegative().optional(),
  bathrooms: z.coerce.number().int().nonnegative().optional(),
  grossArea: z.coerce.number().nonnegative().default(0),
  netArea: z.coerce.number().nonnegative().optional(),
  floor: z.coerce.number().optional(),
  totalFloors: z.coerce.number().optional(),
  buildingAge: z.coerce.number().nonnegative().optional(),
  furnished: z.coerce.boolean().default(false),
  balcony: z.coerce.boolean().default(false),
  parking: z.coerce.boolean().default(false),
  pool: z.coerce.boolean().default(false),
  socialFacilities: csvArray,
  citizenshipSuitable: z.coerce.boolean().default(false),
  residencePermitSuitable: z.coerce.boolean().default(false),
  images: csvArray,
  videoUrl: optionalString,
  source: optionalString.default("Manual"),
  sourceUrl: optionalString,
  type: z.enum(["APARTMENT", "VILLA", "LAND", "COMMERCIAL"]).optional(),
  areaSqm: z.coerce.number().int().positive().optional(),
  assignedAgent: z.string().trim().optional(),
});

const whatsappNumber = z.string().trim().refine((value) => {
  if (!/^\+[\d\s().-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 && !digits.startsWith("0");
}, "شماره واتساپ را با کد کشور وارد کنید؛ نمونه: +905526078900").transform((value) => `+${value.replace(/\D/g, "")}`);

export const customerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: optionalString,
  whatsapp: whatsappNumber,
  email: z.string().trim().email().optional().or(z.literal("")),
  nationality: optionalString,
  language: optionalString.default("Turkish"),
  status: z
    .enum([
      "NEW_LEAD",
      "CONTACTED",
      "QUALIFIED",
      "PROPERTY_SENT",
      "MEETING",
      "NEGOTIATION",
      "WON",
      "LOST",
      "FOLLOW_UP",
    ])
    .default("NEW_LEAD"),
  source: z.string().trim().max(80).default("Manual"),
  assignedAgentId: optionalString,
  interestedCity: optionalString,
  interestedDistrict: optionalString,
  transactionType: z.enum(["SALE", "RENT"]).default("SALE"),
  propertyType: optionalString,
  minBudget: z.coerce.number().nonnegative().optional(),
  maxBudget: z.coerce.number().nonnegative().optional(),
  currency: z.enum(["TRY", "USD", "EUR", "GBP"]).default("TRY"),
  minRooms: z.coerce.number().nonnegative().optional(),
  maxRooms: z.coerce.number().nonnegative().optional(),
  minArea: z.coerce.number().nonnegative().optional(),
  maxArea: z.coerce.number().nonnegative().optional(),
  citizenshipInterest: z.coerce.boolean().default(false),
  investmentInterest: z.coerce.boolean().default(false),
  residenceInterest: z.coerce.boolean().default(false),
  notes: z.string().trim().max(4000).optional(),
  tags: csvArray,
  lastContact: optionalDate,
  nextFollowUp: optionalDate,
  budgetMin: z.coerce.number().nonnegative().optional(),
  budgetMax: z.coerce.number().nonnegative().optional(),
  preferredCities: z.array(z.string().trim().min(1)).default([]),
  assignedAgent: z.string().trim().optional(),
});

export const followUpSchema = z.object({
  customerId: z.string().trim().min(1),
  agentId: optionalString,
  type: z.enum(["CALL", "WHATSAPP", "EMAIL", "MEETING", "PROPERTY_VISIT", "OTHER"]).default("CALL"),
  scheduledAt: z.coerce.date(),
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]).default("PENDING"),
  note: z.string().trim().max(1000).optional(),
  result: z.string().trim().max(1000).optional(),
  managerMessage: z.string().trim().max(2000).optional(),
  customer: z.string().trim().optional(),
  title: z.string().trim().optional(),
  channel: z.enum(["CALL", "WHATSAPP", "EMAIL", "MEETING"]).optional(),
  dueAt: optionalDate,
  notes: z.string().trim().max(1000).optional(),
  assignedAgent: z.string().trim().optional(),
});

export const agentSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  name: z.string().trim().optional(),
  email: z.string().trim().email(),
  phone: z.string().trim().max(32).optional(),
  role: z.enum(USER_ROLES).default("AGENT"),
  status: z.enum(["INVITED", "ACTIVE", "SUSPENDED"]).default("ACTIVE"),
  languages: csvArray,
  specializedCities: csvArray,
  specializedDistricts: csvArray,
  isActive: z.coerce.boolean().default(true),
  territory: z.string().trim().max(120).optional(),
  password: z.string().trim().min(6).max(128).optional().or(z.literal("")),
});

export const projectSchema = z.object({
  name: z.string().trim().min(2).max(160),
  developer: optionalString,
  description: z.string().trim().max(3000).optional(),
  city: z.string().trim().min(1).max(80),
  district: optionalString,
  deliveryDate: optionalDate,
  paymentPlan: z.string().trim().max(2000).optional(),
  citizenshipSuitable: z.coerce.boolean().default(false),
  residenceSuitable: z.coerce.boolean().default(false),
  facilities: csvArray,
  images: csvArray,
  documents: csvArray,
  status: z.enum(["PLANNED", "ACTIVE", "DELIVERED", "ARCHIVED"]).default("ACTIVE"),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});
