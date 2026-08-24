import { Users } from "lucide-react";
import { ResourceManager, type FieldConfig, type FieldOption } from "@/components/crm/ResourceManager";
import { AccessDenied } from "@/components/layout/AccessDenied";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { firstParam, getAgentScope, type AgentScope } from "@/lib/auth/agent-scope";
import { canManageAll } from "@/lib/auth/permissions";
import { requireSession, type SessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const customerStatusOptions: FieldOption[] = [
  { label: "سرنخ جدید", value: "NEW_LEAD" },
  { label: "تماس گرفته‌شده", value: "CONTACTED" },
  { label: "واجد شرایط", value: "QUALIFIED" },
  { label: "ملک ارسال شد", value: "PROPERTY_SENT" },
  { label: "جلسه", value: "MEETING" },
  { label: "مذاکره", value: "NEGOTIATION" },
  { label: "موفق", value: "WON" },
  { label: "ناموفق", value: "LOST" },
  { label: "پیگیری", value: "FOLLOW_UP" },
];
const transactionOptions: FieldOption[] = [
  { label: "فروش", value: "SALE" },
  { label: "اجاره", value: "RENT" },
];
const currencyOptions: FieldOption[] = ["TRY", "USD", "EUR", "GBP"].map((value) => ({ label: value, value }));

export default async function CustomersPage({ searchParams }: { searchParams: PageSearchParams }) {
  const session = await requireSession();
  const params = await searchParams;
  const resolved = resolveScope(session, firstParam(params.assignedAgentId || params.agentId || params.agent));
  if (!resolved.scope) {
    return (
      <DashboardShell>
        <AccessDenied message="مشاور نمی‌تواند با تغییر پارامتر URL محدوده مشتریان را عوض کند." />
      </DashboardShell>
    );
  }
  const scope = resolved.scope;
  const canChooseAgent = canManageAll(session);
  const scopedAgentFilter: Record<string, string> = scope.effectiveAgentId ? { assignedAgentId: scope.effectiveAgentId } : {};
  const statusFilter = firstParam(params.status);
  const cityFilter = firstParam(params.interestedCity);
  const districtFilter = firstParam(params.interestedDistrict);
  const transactionFilter = firstParam(params.transactionType);
  const initialFilters: Record<string, string> = {
    ...scopedAgentFilter,
    ...(customerStatusOptions.some((option) => option.value === statusFilter) && statusFilter ? { status: statusFilter } : {}),
    ...(cityFilter ? { interestedCity: cityFilter } : {}),
    ...(districtFilter ? { interestedDistrict: districtFilter } : {}),
    ...(transactionOptions.some((option) => option.value === transactionFilter) && transactionFilter ? { transactionType: transactionFilter } : {}),
  };

  const fields: FieldConfig[] = [
    { label: "نام کامل", name: "fullName", required: true, section: "مشتری" },
    { label: "واتساپ", name: "whatsapp", required: true, section: "مشتری" },
    { label: "ایمیل", name: "email", section: "مشتری" },
    { label: "ملیت", name: "nationality", section: "مشتری" },
    { label: "زبان", name: "language", section: "مشتری" },
    { label: "منبع", name: "source", section: "مشتری" },
    { label: "وضعیت", name: "status", options: customerStatusOptions, section: "مشتری", type: "select" },
    ...(canChooseAgent ? [{ label: "مشاور", name: "assignedAgentId", optionEndpoint: "/api/agents", optionLabel: "fullName", section: "مالکیت", type: "select" as const }] : []),
    { label: "شهر هدف", name: "interestedCity", section: "نیازمندی‌ها" },
    { label: "منطقه هدف", name: "interestedDistrict", section: "نیازمندی‌ها" },
    { label: "نوع معامله", name: "transactionType", options: transactionOptions, section: "نیازمندی‌ها", type: "select" },
    { label: "نوع ملک", name: "propertyType", section: "نیازمندی‌ها" },
    { label: "حداقل بودجه", name: "minBudget", section: "بودجه", type: "number" },
    { label: "حداکثر بودجه", name: "maxBudget", section: "بودجه", type: "number" },
    { label: "ارز", name: "currency", options: currencyOptions, section: "بودجه", type: "select" },
    { label: "حداقل اتاق", name: "minRooms", section: "نیازمندی‌ها", type: "number" },
    { label: "حداکثر اتاق", name: "maxRooms", section: "نیازمندی‌ها", type: "number" },
    { label: "حداقل متراژ", name: "minArea", section: "نیازمندی‌ها", type: "number" },
    { label: "حداکثر متراژ", name: "maxArea", section: "نیازمندی‌ها", type: "number" },
    { label: "علاقه به شهروندی", name: "citizenshipInterest", section: "علایق", type: "checkbox" },
    { label: "علاقه به سرمایه‌گذاری", name: "investmentInterest", section: "علایق", type: "checkbox" },
    { label: "علاقه به اقامت", name: "residenceInterest", section: "علایق", type: "checkbox" },
    { label: "پیگیری بعدی", name: "nextFollowUp", section: "پیگیری", type: "date" },
    { label: "یادداشت‌ها", name: "notes", section: "یادداشت", type: "textarea" },
    { label: "تگ‌ها با کاما", name: "tags", section: "یادداشت" },
  ];

  return (
    <DashboardShell>
      <PageHeader
        action={<Users className="size-5 text-slate-400" />}
        title={scope.effectiveAgentId ? "مشتریان مشاور" : "مشتریان"}
        description="مشتریان، نیازمندی‌ها، بودجه، مشاور مسئول، وضعیت و یادداشت‌ها با محدوده امن سمت سرور."
      />
      <ResourceManager
        archivePayload={{ status: "LOST" }}
        columns={[
          { key: "fullName", label: "نام" },
          { key: "whatsapp", label: "واتساپ" },
          { key: "maxBudget", label: "بودجه" },
          { key: "interestedCity", label: "شهر هدف" },
          { key: "maxRooms", label: "اتاق" },
          { key: "assignedAgentId.fullName", label: "مشاور" },
          { key: "status", label: "وضعیت" },
          { key: "nextFollowUp", label: "پیگیری بعدی" },
          { key: "createdAt", label: "تاریخ ثبت" },
        ]}
        canDelete={session.role === "ADMIN"}
        createDefaults={scope.effectiveAgentId ? scopedAgentFilter : undefined}
        detailBasePath="/customers"
        endpoint="/api/customers"
        fields={fields}
        filters={[
          { label: "وضعیت", name: "status", options: customerStatusOptions, type: "select" },
          { label: "شهر هدف", name: "interestedCity" },
          { label: "منطقه هدف", name: "interestedDistrict" },
          { label: "نوع معامله", name: "transactionType", options: transactionOptions, type: "select" },
        ]}
        initialFilters={initialFilters}
        primaryLabel="مشتری"
      />
    </DashboardShell>
  );
}

function resolveScope(session: SessionUser, requestedAgentId?: string): { scope?: AgentScope } {
  try {
    return { scope: getAgentScope(session, requestedAgentId) };
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return {};
    throw error;
  }
}
